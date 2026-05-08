const { spawn } = require('child_process')
const http = require('http')
const net = require('net')
const { createLogger } = require('./logger')
const log = createLogger('audio-transcoder')

function findFfmpeg() {
  try {
    const { execSync } = require('child_process')
    const result = execSync('where ffmpeg', { encoding: 'utf-8', timeout: 5000 })
    const lines = result.trim().split('\n')
    if (lines.length > 0) return lines[0].trim()
  } catch {}
  return 'ffmpeg'
}

const FFMPEG_PATH = findFfmpeg()

// Chromium 不支持的音频编码
const UNSUPPORTED_AUDIO_CODECS = new Set([
  'dts', 'dts-hd', 'dts_hd', 'dtshd', 'truehd', 'true-hd',
  'eac3', 'e-ac-3', 'mlp', 'pcm_bluray', 'pcm_bd',
])

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

// 检测音频编码是否不受支持
function detectUnsupportedAudio(filePath) {
  return new Promise((resolve) => {
    try {
      const proc = spawn(FFMPEG_PATH, ['-i', filePath, '-t', '2', '-f', 'null', '-'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      let stderr = ''
      proc.stderr.on('data', (data) => { stderr += data.toString() })
      proc.on('close', () => {
        // 提取音频编码信息
        const audioMatch = stderr.match(/Audio:\s*(\w[\w-]*)/i)
        if (audioMatch) {
          const codec = audioMatch[1].toLowerCase()
          resolve({ codec, unsupported: UNSUPPORTED_AUDIO_CODECS.has(codec) })
        } else {
          resolve({ codec: 'unknown', unsupported: false })
        }
      })
      proc.on('error', () => resolve({ codec: 'unknown', unsupported: false }))
      setTimeout(() => { try { proc.kill() } catch {} ; resolve({ codec: 'unknown', unsupported: false }) }, 8000)
    } catch {
      resolve({ codec: 'unknown', unsupported: false })
    }
  })
}

class AudioTranscoder {
  constructor() {
    this.activeProcesses = new Map()
  }

  stop(key) {
    const entry = this.activeProcesses.get(key)
    if (entry) {
      try { entry.proc.kill() } catch {}
      try { entry.server.close() } catch {}
      this.activeProcesses.delete(key)
      log.info('停止转码:', key)
    }
  }

  stopAll() {
    for (const [key] of this.activeProcesses) this.stop(key)
  }

  // 音频转码：视频直接复制，音频转 AAC
  async start(inputPath) {
    const key = inputPath
    this.stop(key)

    const port = await findFreePort()
    log.info('启动转码服务, port:', port)

    return new Promise((resolve, reject) => {
      const proc = spawn(FFMPEG_PATH, [
        '-i', inputPath,
        '-c:v', 'copy',           // 视频直接复制
        '-c:a', 'aac',            // 音频转 AAC
        '-b:a', '192k',           // 音频码率
        '-ac', '2',               // 立体声
        '-f', 'matroska',         // MKV 容器（支持更多编码）
        'pipe:1',
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })

      let stderrOutput = ''
      let started = false

      proc.stderr.on('data', (data) => {
        stderrOutput += data.toString()
        if (!started && stderrOutput.includes('frame=')) started = true
      })

      proc.on('error', (err) => {
        log.error('转码错误:', err.message)
        this.stop(key)
        reject(err)
      })

      proc.on('close', (code) => {
        log.info('转码进程退出, code:', code)
        this.stop(key)
      })

      const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'video/x-matroska')
        res.setHeader('Transfer-Encoding', 'chunked')
        res.setHeader('Cache-Control', 'no-cache')
        if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }
        proc.stdout.pipe(res)
        req.on('close', () => { proc.stdout.unpipe(res) })
      })

      server.listen(port, '127.0.0.1', () => {
        const url = `http://127.0.0.1:${port}/video.mkv`
        this.activeProcesses.set(key, { proc, server, port })

        const check = setInterval(() => {
          if (started || stderrOutput.includes('Stream mapping')) {
            clearInterval(check)
            resolve({ success: true, url, port })
          }
          if (proc.exitCode !== null && proc.exitCode !== 0) {
            clearInterval(check)
            this.stop(key)
            resolve({ success: false, error: stderrOutput.slice(-300) })
          }
        }, 200)

        setTimeout(() => {
          if (!started) {
            clearInterval(check)
            if (proc.exitCode === null) resolve({ success: true, url, port })
            else { this.stop(key); resolve({ success: false, error: '启动超时' }) }
          }
        }, 10000)
      })

      server.on('error', (err) => { this.stop(key); reject(err) })
    })
  }
}

module.exports = { AudioTranscoder, detectUnsupportedAudio, findFfmpeg }
