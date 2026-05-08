/**
 * Anime4K WebGL2 超分辨率渲染引擎 (TypeScript 版)
 *
 * 架构: 视频帧 → WebGL2纹理 → 多Pass shader处理 → 输出Canvas
 * Shader算法参考 bloc97/Anime4K (Unlicense)
 */

export type Anime4KMode = 'upscale' | 'sharpen' | 'upscale+sharpen'

export class Anime4KRenderer {
  private gl: WebGL2RenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private video: HTMLVideoElement | null = null
  private enabled = false
  private running = false
  private animFrameId: number | null = null

  private programs: Record<string, WebGLProgram> = {}
  private textures: Record<string, WebGLTexture> = {}
  private framebuffers: Record<string, WebGLFramebuffer> = {}
  private quadVAO: WebGLVertexArrayObject | null = null

  private scaleFactor = 2
  private mode: Anime4KMode = 'upscale'

  private _lastW = 0
  private _lastH = 0

  init(videoElement: HTMLVideoElement) {
    this.video = videoElement
    this._createCanvas()
    this._initWebGL()
    this._createShaders()
    this._createGeometry()
    this._createFramebuffers()
  }

  private _createCanvas() {
    this.canvas = document.createElement('canvas')
    this.canvas.id = 'anime4k-canvas'
    this.canvas.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 10;
      display: none;
    `
    const parent = this.video!.parentElement
    if (parent) {
      parent.style.position = 'relative'
      parent.insertBefore(this.canvas, this.video!.nextSibling)
    }
  }

  private _initWebGL() {
    this.gl = this.canvas!.getContext('webgl2', {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    })
    if (!this.gl) throw new Error('WebGL2 不可用')
    const gl = this.gl
    gl.getExtension('EXT_color_buffer_float')
    gl.getExtension('OES_texture_float_linear')
    gl.clearColor(0, 0, 0, 1)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
  }

  private _compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl!
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(`Shader 编译失败: ${info}`)
    }
    return shader
  }

  private _createProgram(name: string, vertSrc: string, fragSrc: string): WebGLProgram {
    const gl = this.gl!
    const vert = this._compileShader(gl.VERTEX_SHADER, vertSrc)
    const frag = this._compileShader(gl.FRAGMENT_SHADER, fragSrc)
    const program = gl.createProgram()!
    gl.attachShader(program, vert)
    gl.attachShader(program, frag)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`)
    }
    gl.deleteShader(vert)
    gl.deleteShader(frag)
    this.programs[name] = program
    return program
  }

  private _createGeometry() {
    const gl = this.gl!
    const verts = new Float32Array([-1, -1, 0, 1, 3, -1, 2, 1, -1, 3, 0, -1])
    this.quadVAO = gl.createVertexArray()!
    gl.bindVertexArray(this.quadVAO)
    const vbo = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)
    gl.bindVertexArray(null)
  }

  private _createFramebuffers() {
    const gl = this.gl!
    const w = this.video!.videoWidth || 1920
    const h = this.video!.videoHeight || 1080
    this.textures.input = this._createTexture(w, h)
    this.textures.pass0 = this._createTexture(w, h)
    this.textures.pass1 = this._createTexture(w * this.scaleFactor, h * this.scaleFactor)
    this.framebuffers.pass0 = this._createFramebuffer(this.textures.pass0)
    this.framebuffers.pass1 = this._createFramebuffer(this.textures.pass1)
  }

  private _createTexture(w: number, h: number): WebGLTexture {
    const gl = this.gl!
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    return tex
  }

  private _createFramebuffer(colorTex: WebGLTexture): WebGLFramebuffer {
    const gl = this.gl!
    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return fb
  }

  private _createShaders() {
    const vert = `#version 300 es
      layout(location=0) in vec2 aPos;
      layout(location=1) in vec2 aUV;
      out vec2 vUV;
      void main() {
        vUV = aUV;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }`

    const edgeFrag = `#version 300 es
      precision highp float;
      in vec2 vUV;
      out vec4 fragColor;
      uniform sampler2D uInput;
      uniform vec2 uTexelSize;
      float luminance(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
      void main() {
        vec2 ts = uTexelSize;
        float tl = luminance(texture(uInput, vUV + vec2(-ts.x, -ts.y)).rgb);
        float tc = luminance(texture(uInput, vUV + vec2(  0.0, -ts.y)).rgb);
        float tr = luminance(texture(uInput, vUV + vec2( ts.x, -ts.y)).rgb);
        float ml = luminance(texture(uInput, vUV + vec2(-ts.x,   0.0)).rgb);
        float mc = luminance(texture(uInput, vUV).rgb);
        float mr = luminance(texture(uInput, vUV + vec2( ts.x,   0.0)).rgb);
        float bl = luminance(texture(uInput, vUV + vec2(-ts.x,  ts.y)).rgb);
        float bc = luminance(texture(uInput, vUV + vec2(  0.0,  ts.y)).rgb);
        float br = luminance(texture(uInput, vUV + vec2( ts.x,  ts.y)).rgb);
        float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
        float gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;
        float edgeStrength = sqrt(gx*gx + gy*gy);
        float laplacian = abs(-4.0*mc + (tl + tr + bl + br) + 2.0*(tc + ml + mr + bc) - 4.0*mc);
        float combined = clamp(edgeStrength * 0.7 + laplacian * 0.3, 0.0, 1.0);
        vec4 original = texture(uInput, vUV);
        fragColor = vec4(original.rgb, combined);
      }`

    const sharpenFrag = `#version 300 es
      precision highp float;
      in vec2 vUV;
      out vec4 fragColor;
      uniform sampler2D uInput;
      uniform sampler2D uEdgeMap;
      uniform vec2 uTexelSize;
      uniform float uStrength;
      void main() {
        vec4 center = texture(uInput, vUV);
        float edge = texture(uEdgeMap, vUV).a;
        float sharpMix = edge * uStrength;
        vec2 ts = uTexelSize;
        vec3 n  = texture(uInput, vUV + vec2( 0.0, -ts.y)).rgb;
        vec3 s  = texture(uInput, vUV + vec2( 0.0,  ts.y)).rgb;
        vec3 e  = texture(uInput, vUV + vec2( ts.x,  0.0)).rgb;
        vec3 w  = texture(uInput, vUV + vec2(-ts.x,  0.0)).rgb;
        vec3 ne = texture(uInput, vUV + vec2( ts.x, -ts.y)).rgb;
        vec3 nw = texture(uInput, vUV + vec2(-ts.x, -ts.y)).rgb;
        vec3 se = texture(uInput, vUV + vec2( ts.x,  ts.y)).rgb;
        vec3 sw = texture(uInput, vUV + vec2(-ts.x,  ts.y)).rgb;
        vec3 blurred = (n + s + e + w + ne + nw + se + sw) / 8.0;
        vec3 sharpened = center.rgb + (center.rgb - blurred) * sharpMix * 2.5;
        vec3 minVal = min(min(min(n, s), min(e, w)), center.rgb);
        vec3 maxVal = max(max(max(n, s), max(e, w)), center.rgb);
        sharpened = clamp(sharpened, minVal - 0.05, maxVal + 0.05);
        fragColor = vec4(sharpened, center.a);
      }`

    const upscaleFrag = `#version 300 es
      precision highp float;
      in vec2 vUV;
      out vec4 fragColor;
      uniform sampler2D uInput;
      uniform vec2 uInputSize;
      uniform vec2 uOutputSize;
      vec3 bicubicSample(sampler2D tex, vec2 uv, vec2 texSize) {
        vec2 texel = 1.0 / texSize;
        vec2 coord = uv * texSize - 0.5;
        vec2 f = fract(coord);
        vec2 base = (floor(coord) + 0.5) * texel;
        vec3 result = vec3(0.0);
        float totalWeight = 0.0;
        for (int j = -1; j <= 2; j++) {
          for (int i = -1; i <= 2; i++) {
            vec2 offset = vec2(float(i), float(j)) * texel;
            vec3 sample_ = texture(tex, base + offset).rgb;
            float wx = abs(float(i) - f.x);
            float wy = abs(float(j) - f.y);
            float w = (wx < 1.0 ? (1.5*wx*wx*wx - 2.5*wx*wx + 1.0) : (-0.5*wx*wx*wx + 2.5*wx*wx - 4.0*wx + 2.0))
                    * (wy < 1.0 ? (1.5*wy*wy*wy - 2.5*wy*wy + 1.0) : (-0.5*wy*wy*wy + 2.5*wy*wy - 4.0*wy + 2.0));
            result += sample_ * w;
            totalWeight += w;
          }
        }
        return result / totalWeight;
      }
      void main() {
        vec3 color = bicubicSample(uInput, vUV, uInputSize);
        fragColor = vec4(color, 1.0);
      }`

    const postFrag = `#version 300 es
      precision highp float;
      in vec2 vUV;
      out vec4 fragColor;
      uniform sampler2D uInput;
      uniform vec2 uTexelSize;
      uniform float uSharpenStrength;
      uniform float uSaturationBoost;
      void main() {
        vec3 color = texture(uInput, vUV).rgb;
        vec2 ts = uTexelSize;
        vec3 n = texture(uInput, vUV + vec2( 0.0, -ts.y)).rgb;
        vec3 s = texture(uInput, vUV + vec2( 0.0,  ts.y)).rgb;
        vec3 e = texture(uInput, vUV + vec2( ts.x,  0.0)).rgb;
        vec3 w = texture(uInput, vUV + vec2(-ts.x,  0.0)).rgb;
        vec3 blur = (n + s + e + w + color * 4.0) / 8.0;
        color += (color - blur) * uSharpenStrength;
        float luma = dot(color, vec3(0.299, 0.587, 0.114));
        color = mix(vec3(luma), color, 1.0 + uSaturationBoost);
        fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
      }`

    this._createProgram('edge', vert, edgeFrag)
    this._createProgram('sharpen', vert, sharpenFrag)
    this._createProgram('upscale', vert, upscaleFrag)
    this._createProgram('post', vert, postFrag)
  }

  private _uploadVideoFrame() {
    const gl = this.gl!
    const vw = this.video!.videoWidth
    const vh = this.video!.videoHeight
    if (this._lastW !== vw || this._lastH !== vh) {
      this._recreateFramebuffers(vw, vh)
      this._lastW = vw
      this._lastH = vh
    }
    gl.bindTexture(gl.TEXTURE_2D, this.textures.input)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, vw, vh, gl.RGBA, gl.UNSIGNED_BYTE, this.video!)
  }

  private _recreateFramebuffers(w: number, h: number) {
    const gl = this.gl!
    Object.values(this.textures).forEach(t => gl.deleteTexture(t))
    Object.values(this.framebuffers).forEach(f => gl.deleteFramebuffer(f))
    const sw = w * this.scaleFactor
    const sh = h * this.scaleFactor
    this.textures.input = this._createTexture(w, h)
    this.textures.pass0 = this._createTexture(w, h)
    this.textures.pass1 = this._createTexture(sw, sh)
    this.framebuffers.pass0 = this._createFramebuffer(this.textures.pass0)
    this.framebuffers.pass1 = this._createFramebuffer(this.textures.pass1)
    this.canvas!.width = sw
    this.canvas!.height = sh
  }

  private _drawQuad() {
    const gl = this.gl!
    gl.bindVertexArray(this.quadVAO)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private _render() {
    const gl = this.gl!
    const vw = this.video!.videoWidth
    const vh = this.video!.videoHeight
    if (!vw || !vh) return
    this._uploadVideoFrame()

    if (this.mode === 'upscale' || this.mode === 'upscale+sharpen') {
      this._renderUpscale(vw, vh)
    } else if (this.mode === 'sharpen') {
      this._renderSharpenOnly(vw, vh)
    }
  }

  private _renderUpscale(vw: number, vh: number) {
    const gl = this.gl!
    const sw = vw * this.scaleFactor
    const sh = vh * this.scaleFactor

    // Pass 0: 边缘检测
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.pass0)
    gl.viewport(0, 0, vw, vh)
    gl.useProgram(this.programs.edge)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textures.input)
    gl.uniform1i(gl.getUniformLocation(this.programs.edge, 'uInput'), 0)
    gl.uniform2f(gl.getUniformLocation(this.programs.edge, 'uTexelSize'), 1.0 / vw, 1.0 / vh)
    this._drawQuad()

    // Pass 1: 方向性锐化
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.pass0)
    gl.viewport(0, 0, vw, vh)
    gl.useProgram(this.programs.sharpen)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textures.input)
    gl.uniform1i(gl.getUniformLocation(this.programs.sharpen, 'uInput'), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.textures.pass0)
    gl.uniform1i(gl.getUniformLocation(this.programs.sharpen, 'uEdgeMap'), 1)
    gl.uniform2f(gl.getUniformLocation(this.programs.sharpen, 'uTexelSize'), 1.0 / vw, 1.0 / vh)
    gl.uniform1f(gl.getUniformLocation(this.programs.sharpen, 'uStrength'), 0.6)
    this._drawQuad()

    // Pass 2: 双三次上采样 2x
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.pass1)
    gl.viewport(0, 0, sw, sh)
    gl.useProgram(this.programs.upscale)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textures.pass0)
    gl.uniform1i(gl.getUniformLocation(this.programs.upscale, 'uInput'), 0)
    gl.uniform2f(gl.getUniformLocation(this.programs.upscale, 'uInputSize'), vw, vh)
    gl.uniform2f(gl.getUniformLocation(this.programs.upscale, 'uOutputSize'), sw, sh)
    this._drawQuad()

    // Pass 3: 后处理
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, sw, sh)
    gl.useProgram(this.programs.post)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textures.pass1)
    gl.uniform1i(gl.getUniformLocation(this.programs.post, 'uInput'), 0)
    gl.uniform2f(gl.getUniformLocation(this.programs.post, 'uTexelSize'), 1.0 / sw, 1.0 / sh)
    gl.uniform1f(gl.getUniformLocation(this.programs.post, 'uSharpenStrength'), 0.3)
    gl.uniform1f(gl.getUniformLocation(this.programs.post, 'uSaturationBoost'), 0.05)
    this._drawQuad()
  }

  private _renderSharpenOnly(vw: number, vh: number) {
    const gl = this.gl!

    // Pass 0: 边缘检测
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers.pass0)
    gl.viewport(0, 0, vw, vh)
    gl.useProgram(this.programs.edge)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textures.input)
    gl.uniform1i(gl.getUniformLocation(this.programs.edge, 'uInput'), 0)
    gl.uniform2f(gl.getUniformLocation(this.programs.edge, 'uTexelSize'), 1.0 / vw, 1.0 / vh)
    this._drawQuad()

    // Pass 1: 锐化
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas!.width || vw, this.canvas!.height || vh)
    gl.useProgram(this.programs.sharpen)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textures.input)
    gl.uniform1i(gl.getUniformLocation(this.programs.sharpen, 'uInput'), 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.textures.pass0)
    gl.uniform1i(gl.getUniformLocation(this.programs.sharpen, 'uEdgeMap'), 1)
    gl.uniform2f(gl.getUniformLocation(this.programs.sharpen, 'uTexelSize'), 1.0 / vw, 1.0 / vh)
    gl.uniform1f(gl.getUniformLocation(this.programs.sharpen, 'uStrength'), 0.8)
    this._drawQuad()
  }

  private _renderLoop() {
    if (!this.running) return
    this._render()
    this.animFrameId = requestAnimationFrame(() => this._renderLoop())
  }

  enable() {
    if (this.enabled) return
    this.enabled = true
    this.running = true
    const vw = this.video!.videoWidth || 1920
    const vh = this.video!.videoHeight || 1080
    this.canvas!.width = vw * this.scaleFactor
    this.canvas!.height = vh * this.scaleFactor
    this.canvas!.style.display = 'block'
    this.video!.style.opacity = '0'
    this._renderLoop()
  }

  disable() {
    if (!this.enabled) return
    this.enabled = false
    this.running = false
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
    if (this.canvas) this.canvas.style.display = 'none'
    if (this.video) this.video.style.opacity = '1'
  }

  toggle(): boolean {
    if (this.enabled) this.disable()
    else this.enable()
    return this.enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setMode(mode: Anime4KMode) {
    this.mode = mode
  }

  getMode(): Anime4KMode {
    return this.mode
  }

  destroy() {
    this.disable()
    if (!this.gl) return
    const gl = this.gl
    Object.values(this.textures).forEach(t => gl.deleteTexture(t))
    Object.values(this.framebuffers).forEach(f => gl.deleteFramebuffer(f))
    Object.values(this.programs).forEach(p => gl.deleteProgram(p))
    if (this.quadVAO) gl.deleteVertexArray(this.quadVAO)
    if (this.canvas?.parentElement) this.canvas.parentElement.removeChild(this.canvas)
    this.gl = null
  }
}
