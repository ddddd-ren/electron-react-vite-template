const axios = require('axios')
const { parse } = require('node-html-parser')
const { BrowserWindow } = require('electron')
const { createLogger } = require('./logger')
const log = createLogger('scraper')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ═══ BrowserWindow 并发池 ═══
const MAX_CONCURRENT_WINS = 3
let activeWinCount = 0
const winQueue = []

function acquireWinSlot() {
  return new Promise((resolve) => {
    if (activeWinCount < MAX_CONCURRENT_WINS) {
      activeWinCount++
      resolve()
    } else {
      winQueue.push(resolve)
    }
  })
}

function releaseWinSlot() {
  activeWinCount--
  if (winQueue.length > 0 && activeWinCount < MAX_CONCURRENT_WINS) {
    activeWinCount++
    winQueue.shift()()
  }
}

function headers(baseUrl, referer) {
  const h = { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', 'Referer': baseUrl + '/' }
  if (referer) h['Referer'] = referer
  return h
}

function absUrl(base, href) {
  if (!href) return ''
  if (href.startsWith('http://') || href.startsWith('https://')) return href
  try {
    const u = new URL(base)
    if (href.startsWith('/')) return `${u.protocol}//${u.host}${href}`
    return `${u.protocol}//${u.host}/${href}`
  } catch {
    return href
  }
}

// ═══ XPath 简易求值器 ═══
// 支持 Kazumi 源常用的模式: //tag/nested[n]/tag, //tag[n], //tag/tag, //tag
function xpathQueryAll(root, xpath) {
  if (!xpath || !xpath.startsWith('//')) return []

  const clean = xpath.replace(/^\/\//, '')
  const parts = clean.split('/').filter(Boolean)
  if (parts.length === 0) return []

  // 解析每个路径段: "div[2]" -> { tag: 'div', index: 2 }
  const steps = parts.map(part => {
    const m = part.match(/^(\w+)(?:\[(\d+)\])?$/)
    if (!m) return null
    return { tag: m[1].toLowerCase(), index: m[2] ? parseInt(m[2]) : 0 }
  })

  // 第一步：搜索所有后代（// 前缀含义）
  const firstStep = steps[0]
  if (!firstStep) return []

  let current = []
  // 递归搜索所有后代
  function findDescendants(node, tag, index) {
    const children = node.childNodes || []
    let count = 0
    for (const child of children) {
      if (child.tagName && child.tagName.toLowerCase() === tag) {
        count++
        if (index === 0 || count === index) {
          current.push(child)
          if (index !== 0) return // 找到指定索引的就停止
        }
      }
      findDescendants(child, tag, index)
    }
  }
  findDescendants(root, firstStep.tag, firstStep.index)

  // 后续步骤：匹配直接子元素
  for (let i = 1; i < steps.length; i++) {
    const step = steps[i]
    if (!step) return []
    const next = []
    for (const parent of current) {
      const children = parent.childNodes || []
      let count = 0
      for (const child of children) {
        if (!child.tagName || child.tagName.toLowerCase() !== step.tag) continue
        count++
        if (step.index === 0 || count === step.index) {
          next.push(child)
          if (step.index !== 0) break
        }
      }
    }
    current = next
    if (current.length === 0) break
  }

  return current.filter(el => el && el.tagName)
}

function xpathQueryFirst(root, xpath) {
  const results = xpathQueryAll(root, xpath)
  return results.length > 0 ? results[0] : null
}

// XPath 结果节点的属性提取
function xpathGetAttr(node, attrName) {
  if (!node) return ''
  if (attrName === 'href') {
    // node-html-parser 中 <a href="..."> 的 href 在 attributes 里
    return node.getAttribute?.('href') || node.rawAttrs?.match(/href=["']([^"']+)["']/)?.[1] || ''
  }
  return node.getAttribute?.(attrName) || node.rawAttrs?.match(new RegExp(attrName + '=["\']([^"\']+)["\']'))?.[1] || ''
}

function xpathGetText(node) {
  if (!node) return ''
  return node.text?.trim() || ''
}

// 统一查询接口：根据选择器前缀自动使用 CSS 或 XPath
function queryAll(root, selector) {
  if (!selector) return []
  if (selector.startsWith('//')) return xpathQueryAll(root, selector)
  return root.querySelectorAll(selector)
}

function queryFirst(root, selector) {
  if (!selector) return null
  if (selector.startsWith('//')) return xpathQueryFirst(root, selector)
  return root.querySelector(selector)
}

// ═══ 规则默认值 ═══
const DEFAULT_RULE = {
  name: '未命名',
  baseURL: '',
  searchURL: '',
  useWebview: false,
  homeSections: '.myui-panel',
  homeTitle: '.myui-panel__head .title',
  homeMore: '.myui-panel__head .more',
  homeItems: '.myui-vodlist__box',
  searchList: '.myui-vodlist__box',
  searchName: '.myui-vodlist__thumb',
  searchNameAttr: 'title',
  searchResult: '.myui-vodlist__thumb',
  searchResultAttr: 'href',
  searchCover: '',
  searchCoverAttr: 'data-original',
  searchTag: '.pic-tag',
  searchEpisode: '.pic-text',
  detailTitle: '.myui-player__detail h1',
  detailCover: '.myui-vodlist__thumb.img-md-220 img',
  detailCoverAttr: 'data-original',
  detailDesc: '.myui-content__detail .text',
  chapterRoads: '.tab-pane',
  chapterRoadNames: '.nav-tabs li a',
  chapterResult: '.myui-content__list li a',
  chapterNameAttr: 'title',
  chapterUrlAttr: 'href',
  playUrlRegex: 'var\\s+now\\s*=\\s*["\']([^"\']+)["\']',
}

function applyDefaults(rule) {
  return { ...DEFAULT_RULE, ...rule }
}

function extractText(el, selector) {
  if (!selector) return ''
  const found = queryFirst(el, selector)
  return found ? found.text.trim() : ''
}

// ═══ 从视频卡片提取信息 ═══
function parseVodItems(root, rule, baseUrl, listSelector) {
  const items = []
  const selector = listSelector || rule.searchList
  const boxes = queryAll(root, selector)
  log.debug('parseVodItems: selector=' + selector + ', found=' + boxes.length)
  for (const li of boxes) {
    try {
      const nameEl = queryFirst(li, rule.searchName)

      // 标题：XPath 规则用 text，CSS 规则用属性
      let title = ''
      if (nameEl) {
        title = rule.searchNameAttr
          ? (nameEl.getAttribute(rule.searchNameAttr) || '')
          : (nameEl.text?.trim() || '')
      }

      // URL：优先 href，回退 text
      let url = ''
      if (nameEl) {
        url = nameEl.getAttribute('href') || ''
        if (!url) url = nameEl.text?.trim() || ''
      }

      // 封面
      let cover = ''
      if (rule.searchCover) {
        const coverEl = queryFirst(li, rule.searchCover)
        if (coverEl) {
          cover = coverEl.getAttribute(rule.searchCoverAttr || 'data-original')
            || coverEl.getAttribute('data-src')
            || coverEl.getAttribute('src')
            || ''
        }
      }
      if (!cover) {
        const img = li.querySelector?.('img') || queryFirst(li, 'img')
        cover = img ? (img.getAttribute('data-original') || img.getAttribute('data-src') || img.getAttribute('src') || '') : ''
      }

      const tag = extractText(li, rule.searchTag)
      const episode = extractText(li, rule.searchEpisode)

      if (title && url) {
        items.push({ title, url: absUrl(baseUrl, url), cover: absUrl(baseUrl, cover), tag, episode })
      }
    } catch (e) {
      log.error('parseVodItems item error:', e.message)
    }
  }
  const seen = new Set()
  return items.filter(item => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

// ═══ 用 BrowserWindow 加载页面（处理 JS 反爬和 JS 重定向） ═══
async function fetchWithWebview(url, baseUrl) {
  await acquireWinSlot()
  let win = null
  log.info('fetchWithWebview:', url)
  try {
    win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 720,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    const html = await new Promise((resolve, reject) => {
      let loadCount = 0
      let settled = false
      const globalTimeout = setTimeout(() => {
        if (!settled) {
          settled = true
          log.warn('fetchWithWebview 全局超时')
          win.webContents.executeJavaScript('document.documentElement.outerHTML')
            .then(resolve).catch(reject)
        }
      }, 15000)

      win.webContents.on('did-finish-load', async () => {
        if (settled) return
        loadCount++
        const currentUrl = win.webContents.getURL()
        log.debug(`fetchWithWebview did-finish-load #${loadCount}, url: ${currentUrl}`)

        // 等待 JS 渲染完成
        await new Promise(r => setTimeout(r, 3000))
        if (settled) return

        // 检查页面是否有搜索结果内容（避免在重定向页面就提取）
        try {
          const testHtml = await win.webContents.executeJavaScript('document.documentElement.outerHTML')
          // 如果 HTML 很短（重定向页面），继续等待
          if (testHtml.length < 500 && loadCount < 3) {
            log.debug('fetchWithWebview 页面内容过短，等待重定向...')
            return
          }
          settled = true
          clearTimeout(globalTimeout)
          resolve(testHtml)
        } catch (e) {
          if (!settled) { settled = true; clearTimeout(globalTimeout); reject(e) }
        }
      })

      win.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
        if (!settled) {
          settled = true
          clearTimeout(globalTimeout)
          log.error('fetchWithWebview 页面加载失败:', errorCode, errorDesc)
          reject(new Error(`Page load failed: ${errorDesc}`))
        }
      })

      win.loadURL(url, { userAgent: UA }).catch(reject)
    })

    return html
  } finally {
    if (win && !win.isDestroyed()) win.destroy()
    releaseWinSlot()
  }
}
async function extractPlayUrlWithWebview(episodeUrl, baseUrl) {
  await acquireWinSlot()
  let win = null
  log.info('extractPlayUrlWithWebview:', episodeUrl)
  try {
    win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 720,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    // 先注册 dom-ready 事件，再加载页面
    const playUrl = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        log.warn('extractPlayUrl 超时')
        resolve(null)
      }, 15000)

      win.webContents.on('dom-ready', () => {
        log.debug('extractPlayUrl dom-ready, 注入拦截脚本')
        // 注入拦截脚本
        win.webContents.executeJavaScript(`
          (function() {
            window.__playUrl = null;
            // 拦截 fetch
            const origFetch = window.fetch;
            window.fetch = function(...args) {
              const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
              if (url.includes('.m3u8') || url.includes('.mp4')) {
                window.__playUrl = url;
              }
              return origFetch.apply(this, args);
            };
            // 拦截 XMLHttpRequest
            const origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, ...rest) {
              if (typeof url === 'string' && (url.includes('.m3u8') || url.includes('.mp4'))) {
                window.__playUrl = url;
              }
              return origOpen.call(this, method, url, ...rest);
            };
            // 监听 video 元素
            const observer = new MutationObserver(function(mutations) {
              for (const m of mutations) {
                for (const node of m.addedNodes) {
                  if (node.tagName === 'VIDEO' && node.src) {
                    window.__playUrl = node.src;
                  }
                  if (node.querySelectorAll) {
                    const vids = node.querySelectorAll('video');
                    for (const v of vids) {
                      if (v.src) window.__playUrl = v.src;
                    }
                  }
                }
              }
            });
            if (document.body) {
              observer.observe(document.body, { childList: true, subtree: true });
            }
            // 检查已有 video/source
            setTimeout(function() {
              var v = document.querySelector('video');
              if (v) {
                if (v.src) { window.__playUrl = v.src; return; }
                var s = v.querySelector('source');
                if (s && s.src) { window.__playUrl = s.src; return; }
              }
              // 从 script 中提取 var now
              var scripts = document.querySelectorAll('script');
              for (var i = 0; i < scripts.length; i++) {
                var text = scripts[i].textContent || '';
                var m = text.match(/var\\s+now\\s*=\\s*["'](https?:\\/\\/[^"']+)["']/);
                if (m) { window.__playUrl = m[1]; return; }
                var m2 = text.match(/["'](https?:\\/\\/[^"']*\\.m3u8[^"']*?)["']/i);
                if (m2) { window.__playUrl = m2[1]; return; }
              }
            }, 2000);
          })();
        `).catch(() => {})
      })

      win.webContents.on('did-finish-load', async () => {
        log.debug('extractPlayUrl 页面加载完成，等待 m3u8 拦截...')
        // 等 5 秒让 JS 拦截到 m3u8 请求
        await new Promise(r => setTimeout(r, 5000))
        try {
          const url = await win.webContents.executeJavaScript('window.__playUrl || null')
          log.debug('extractPlayUrl 注入结果:', url)
          if (url) {
            clearTimeout(timeout)
            resolve(url)
            return
          }
          // 回退：从 HTML 正则提取
          const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML')
          const m1 = html.match(/var\s+now\s*=\s*["'](https?:\/\/[^"']+)["']/)
          if (m1) { clearTimeout(timeout); resolve(m1[1]); return }
          const m2 = html.match(/["'](https?:\/\/[^"']*\.m3u8[^"']*?)["']/i)
          if (m2) { clearTimeout(timeout); resolve(m2[1]); return }
          const m3 = html.match(/["'](https?:\/\/[^"']*\.mp4[^"']*?)["']/i)
          if (m3) { clearTimeout(timeout); resolve(m3[1]); return }
          clearTimeout(timeout)
          resolve(null)
        } catch (e) {
          log.error('extractPlayUrl 错误:', e.message)
          clearTimeout(timeout)
          resolve(null)
        }
      })

      win.webContents.on('did-fail-load', (event, errorCode, errorDesc) => {
        log.error('extractPlayUrl 页面加载失败:', errorCode, errorDesc)
        clearTimeout(timeout)
        resolve(null)
      })

      win.loadURL(episodeUrl, { userAgent: UA }).catch(e => {
        log.error('extractPlayUrl loadURL 错误:', e.message)
        clearTimeout(timeout)
        resolve(null)
      })
    })

    return playUrl
  } finally {
    if (win && !win.isDestroyed()) win.destroy()
    releaseWinSlot()
  }
}

class Scraper {
  // ═══ 首页 ═══
  async fetchHome(rule) {
    rule = applyDefaults(rule)
    log.info('fetchHome:', rule.name, rule.baseURL, 'useWebview:', rule.useWebview)
    try {
      let html
      if (rule.useWebview) {
        html = await fetchWithWebview(rule.baseURL, rule.baseURL)
      } else {
        const resp = await axios.get(rule.baseURL, { headers: headers(rule.baseURL), timeout: 15000 })
        html = resp.data
      }

      log.debug('fetchHome HTML 长度:', html?.length)
      const root = parse(html)
      const sections = []
      const panels = queryAll(root, rule.homeSections)
      log.debug('fetchHome 找到面板:', panels.length)

      for (const panel of panels) {
        const title = extractText(panel, rule.homeTitle)
        const moreEl = queryFirst(panel, rule.homeMore)
        const moreUrl = moreEl ? absUrl(rule.baseURL, moreEl.getAttribute('href')) : ''
        const items = parseVodItems(panel, rule, rule.baseURL, rule.homeItems)
        if (items.length > 0) {
          sections.push({ title, moreUrl, items })
        }
      }
      log.info('fetchHome 结果: sections=' + sections.length)
      return { success: true, sections }
    } catch (e) {
      log.error('fetchHome 错误:', e.message)
      return { success: false, error: e.message }
    }
  }

  // ═══ 搜索 ═══
  async search(rule, keyword) {
    rule = applyDefaults(rule)
    const searchUrl = rule.searchURL.replace('@keyword', encodeURIComponent(keyword))
    log.info('search:', rule.name, searchUrl, 'useWebview:', rule.useWebview)

    try {
      let html
      if (rule.useWebview) {
        html = await fetchWithWebview(searchUrl, rule.baseURL)
      } else {
        const resp = await axios.get(searchUrl, { headers: headers(rule.baseURL), timeout: 15000 })
        html = resp.data
      }

      log.debug('search HTML 长度:', html?.length)
      const root = parse(html)
      let items = parseVodItems(root, rule, rule.baseURL, rule.searchList)
      log.debug('search 选择器结果:', items.length)

      // 兜底：全局扫描 a 标签
      if (items.length === 0) {
        log.debug('search: 尝试全局 a 标签扫描')
        const allLinks = root.querySelectorAll('a')
        const seen = new Set()
        for (const a of allLinks) {
          const href = a.getAttribute('href') || ''
          const name = a.getAttribute('title') || a.text.trim()
          if (href && name && name.length > 1 && name.length < 80 &&
              (href.includes('.html') || href.includes('/detail') || href.includes('/anime')) &&
              !href.includes('javascript') && !seen.has(href)) {
            seen.add(href)
            const img = a.querySelector('img')
            const cover = img ? (img.getAttribute('data-original') || img.getAttribute('src') || '') : ''
            items.push({ title: name, url: absUrl(rule.baseURL, href), cover: absUrl(rule.baseURL, cover), tag: '', episode: '' })
          }
        }
        log.debug('search 全局扫描结果:', items.length)
      }

      return { success: true, items }
    } catch (e) {
      log.error('search 错误:', e.message)
      return { success: false, error: e.message }
    }
  }

  // ═══ 详情 + 剧集 ═══
  async fetchDetail(rule, url) {
    rule = applyDefaults(rule)
    log.info('fetchDetail:', rule.name, url, 'useWebview:', rule.useWebview)
    try {
      let html
      if (rule.useWebview) {
        html = await fetchWithWebview(url, rule.baseURL)
      } else {
        const resp = await axios.get(url, { headers: headers(rule.baseURL, url), timeout: 15000 })
        html = resp.data
      }
      const root = parse(html)

      const title = extractText(root, rule.detailTitle) ||
                    extractText(root, 'h1') ||
                    extractText(root, 'title')

      let cover = ''
      if (rule.detailCover) {
        const coverEl = queryFirst(root, rule.detailCover)
        if (coverEl) {
          cover = coverEl.getAttribute?.(rule.detailCoverAttr || 'data-original')
            || coverEl.getAttribute?.('data-src')
            || coverEl.getAttribute?.('src')
            || coverEl.rawAttrs?.match(/(?:data-original|data-src|src)=["']([^"']+)["']/)?.[1]
            || ''
        }
      }

      const desc = extractText(root, rule.detailDesc).slice(0, 300)

      // 剧集线路
      const roads = []
      const tabPanes = queryAll(root, rule.chapterRoads)
      const tabNames = rule.chapterRoadNames ? queryAll(root, rule.chapterRoadNames) : []
      const sourceNames = []
      for (const li of tabNames) {
        const a = queryFirst(li, 'a') || li
        sourceNames.push(a.text.trim())
      }
      log.debug('fetchDetail tabPanes:', tabPanes.length, 'sourceNames:', sourceNames.length)

      let roadIdx = 0
      for (const pane of tabPanes) {
        const links = queryAll(pane, rule.chapterResult)
        const episodes = []
        for (const a of links) {
          // 提取 href：兼容 CSS 和 XPath 结果
          let href = a.getAttribute?.(rule.chapterUrlAttr || 'href') || ''
          if (!href) href = a.rawAttrs?.match(/href=["']([^"']+)["']/)?.[1] || ''
          href = absUrl(rule.baseURL, href)
          // 提取名称：XPath 用 text，CSS 用属性
          const name = rule.chapterNameAttr
            ? (a.getAttribute?.(rule.chapterNameAttr) || a.text?.trim() || '')
            : (a.text?.trim() || '')
          if (href && name && !href.includes('javascript')) {
            episodes.push({ name, url: href })
          }
        }
        if (episodes.length > 0) {
          roads.push({ name: sourceNames[roadIdx] || `播放源${roadIdx + 1}`, episodes })
          roadIdx++
        }
      }

      // 兜底：全局扫描
      if (roads.length === 0) {
        log.debug('fetchDetail: 尝试全局 a 标签扫描剧集')
        const allLinks = root.querySelectorAll('a')
        const episodes = []
        for (const a of allLinks) {
          const href = a.getAttribute('href') || ''
          const name = a.getAttribute('title') || a.text.trim()
          if (href && name && name.length > 0 && name.length < 30 &&
              (href.includes('/bofang/') || href.includes('/play/') || href.includes('/episode')) &&
              !href.includes('javascript')) {
            episodes.push({ name, url: absUrl(rule.baseURL, href) })
          }
        }
        if (episodes.length > 0) {
          roads.push({ name: '默认', episodes })
        }
      }

      log.info('fetchDetail 结果: title=' + title + ', roads=' + roads.length)
      return { success: true, title, cover, desc, roads }
    } catch (e) {
      log.error('fetchDetail 错误:', e.message)
      return { success: false, error: e.message }
    }
  }

  // ═══ 播放地址 ═══
  async fetchPlayUrl(rule, episodeUrl) {
    rule = applyDefaults(rule)
    log.info('fetchPlayUrl:', rule.name, episodeUrl)
    try {
      // 先尝试普通 HTTP 请求
      const resp = await axios.get(episodeUrl, { headers: headers(rule.baseURL, episodeUrl), timeout: 15000 })
      const html = resp.data

      // 用规则中的正则提取
      if (rule.playUrlRegex) {
        const m = html.match(new RegExp(rule.playUrlRegex))
        if (m) { log.debug('fetchPlayUrl 正则匹配:', m[1]); return { success: true, url: m[1] } }
      }

      // 通用提取
      const m1 = html.match(/var\s+now\s*=\s*["'](https?:\/\/[^"']+)["']/)
      if (m1) { log.debug('fetchPlayUrl now 匹配:', m1[1]); return { success: true, url: m1[1] } }
      const m2 = html.match(/["'](https?:\/\/[^"']*\.m3u8[^"']*?)["']/i)
      if (m2) { log.debug('fetchPlayUrl m3u8 匹配:', m2[1]); return { success: true, url: m2[1] } }
      const m3 = html.match(/["'](https?:\/\/[^"']*\.mp4[^"']*?)["']/i)
      if (m3) { log.debug('fetchPlayUrl mp4 匹配:', m3[1]); return { success: true, url: m3[1] } }

      // iframe 回退
      const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)
      if (iframeMatch) {
        log.debug('fetchPlayUrl 尝试 iframe:', iframeMatch[1])
        const iframeUrl = absUrl(rule.baseURL, iframeMatch[1])
        try {
          const iframeResp = await axios.get(iframeUrl, {
            headers: { ...headers(rule.baseURL), 'Referer': episodeUrl },
            timeout: 10000,
          })
          const im1 = iframeResp.data.match(/var\s+now\s*=\s*["'](https?:\/\/[^"']+)["']/)
          if (im1) return { success: true, url: im1[1] }
          const im2 = iframeResp.data.match(/["'](https?:\/\/[^"']*\.m3u8[^"']*?)["']/i)
          if (im2) return { success: true, url: im2[1] }
        } catch {}
      }

      // 最后用 BrowserWindow + JS 注入拦截
      log.debug('fetchPlayUrl 回退到 webview 注入')
      const webviewUrl = await extractPlayUrlWithWebview(episodeUrl, rule.baseURL)
      if (webviewUrl) { log.debug('fetchPlayUrl webview 匹配:', webviewUrl); return { success: true, url: webviewUrl } }

      return { success: false, error: '未找到视频地址' }
    } catch (e) {
      log.error('fetchPlayUrl 错误:', e.message)
      return { success: false, error: e.message }
    }
  }
}

module.exports = new Scraper()
