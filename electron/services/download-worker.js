const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { m3u8Parser, m3u8AdFilter } = require('./m3u8-parser')
const storage = require('./storage')
const { createLogger } = require('./logger')
const log = createLogger('download')

class DownloadWorker {
  constructor() {
    this.activeTasks = new Map() // key -> task
    this.queue = []
    this.speedTrackers = new Map()
    this.maxParallelEpisodes = 2
    this.maxParallelSegments = 3
    this.runningCount = 0
    this.mainWindow = null
  }

  setMainWindow(win) {
    this.mainWindow = win
  }

  _taskKey(recordKey, episodeNumber) {
    return `${recordKey}_${episodeNumber}`
  }

  _sendProgress(recordKey, episodeNumber, episode, speed) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('download:progress', {
        recordKey,
        episodeNumber,
        episode,
        speed,
      })
    }
  }

  async _fetchM3u8(url, headers, cancelToken) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http
      const req = protocol.get(url, {
        headers: {
          ...headers,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 15000,
      }, (res) => {
        let data = ''
        let bytes = 0

        res.on('data', (chunk) => {
          bytes += chunk.length
          if (bytes > 2 * 1024 * 1024) {
            req.destroy()
            reject(new Error('Response too large, not M3U8'))
            return
          }
          data += chunk.toString()
        })

        res.on('end', () => {
          if (!data.trimLeft().startsWith('#EXTM3U')) {
            reject(new Error('URL is not M3U8'))
            return
          }
          resolve(data)
        })

        res.on('error', reject)
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })

      if (cancelToken) {
        cancelToken.cancel = () => {
          req.destroy()
          reject(new Error('Cancelled'))
        }
      }
    })
  }

  async _downloadFile(url, savePath, headers, cancelToken) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http
      const req = protocol.get(url, {
        headers: {
          ...headers,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 30000,
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          this._downloadFile(res.headers.location, savePath, headers, cancelToken)
            .then(resolve)
            .catch(reject)
          return
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }

        const file = fs.createWriteStream(savePath)
        res.pipe(file)

        file.on('finish', () => {
          file.close()
          resolve()
        })

        file.on('error', (err) => {
          fs.unlink(savePath, () => {})
          reject(err)
        })
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Download timeout'))
      })

      if (cancelToken) {
        cancelToken.cancel = () => {
          req.destroy()
          reject(new Error('Cancelled'))
        }
      }
    })
  }

  async _downloadSegmentWithRetry(url, savePath, headers, cancelToken, maxRetries = 3) {
    const tmpPath = savePath + '.tmp'
    let retryCount = 0

    while (true) {
      try {
        await this._downloadFile(url, tmpPath, headers, cancelToken)
        fs.renameSync(tmpPath, savePath)
        return fs.statSync(savePath).size
      } catch (e) {
        try {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
        } catch {}

        if (cancelToken && cancelToken.cancelled) throw e
        retryCount++
        if (retryCount >= maxRetries) throw e
        const delay = [1000, 3000, 9000][retryCount - 1]
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }

  async enqueue(request) {
    const key = this._taskKey(request.recordKey, request.episodeNumber)
    if (this.activeTasks.has(key)) return
    log.info('加入下载队列:', request.bangumiName, 'EP' + request.episodeNumber)

    const task = {
      recordKey: request.recordKey,
      episodeNumber: request.episodeNumber,
      cancelToken: { cancelled: false, cancel: null },
      isPaused: false,
    }

    if (this.runningCount < this.maxParallelEpisodes) {
      this.runningCount++
      this.activeTasks.set(key, task)
      this._runEpisodeDownload(task, request)
    } else {
      this.queue.push(request)
      this.activeTasks.set(key, task)
    }
  }

  async enqueuePriority(request) {
    const key = this._taskKey(request.recordKey, request.episodeNumber)
    log.info('优先下载:', request.bangumiName, 'EP' + request.episodeNumber)

    this.queue = this.queue.filter(r =>
      !(r.recordKey === request.recordKey && r.episodeNumber === request.episodeNumber)
    )
    this.activeTasks.delete(key)

    const task = {
      recordKey: request.recordKey,
      episodeNumber: request.episodeNumber,
      cancelToken: { cancelled: false, cancel: null },
      isPaused: false,
    }

    this.runningCount++
    this.activeTasks.set(key, task)
    this._runEpisodeDownload(task, request)
  }

  pause(recordKey, episodeNumber) {
    const key = this._taskKey(recordKey, episodeNumber)
    const task = this.activeTasks.get(key)
    if (task) {
      log.info('暂停下载:', key)
      task.isPaused = true
      if (task.cancelToken.cancel) {
        task.cancelToken.cancel()
      }
    }
  }

  async resume(request) {
    const key = this._taskKey(request.recordKey, request.episodeNumber)
    log.info('恢复下载:', key)
    this.activeTasks.delete(key)

    const task = {
      recordKey: request.recordKey,
      episodeNumber: request.episodeNumber,
      cancelToken: { cancelled: false, cancel: null },
      isPaused: false,
    }

    this.activeTasks.set(key, task)

    if (this.runningCount < this.maxParallelEpisodes) {
      this.runningCount++
      this._runEpisodeDownload(task, request)
    } else {
      this.queue.push(request)
    }
  }

  cancel(recordKey, episodeNumber) {
    const key = this._taskKey(recordKey, episodeNumber)
    const task = this.activeTasks.get(key)
    if (task) {
      log.info('取消下载:', key)
      task.cancelToken.cancelled = true
      if (task.cancelToken.cancel) {
        task.cancelToken.cancel()
      }
      this.activeTasks.delete(key)
      this.queue = this.queue.filter(r =>
        !(r.recordKey === recordKey && r.episodeNumber === episodeNumber)
      )
    }
  }

  getSpeed(recordKey, episodeNumber) {
    const key = this._taskKey(recordKey, episodeNumber)
    const tracker = this.speedTrackers.get(key)
    return tracker ? tracker.currentSpeed : 0
  }

  _processQueue() {
    while (this.runningCount < this.maxParallelEpisodes && this.queue.length > 0) {
      const request = this.queue.shift()
      const key = this._taskKey(request.recordKey, request.episodeNumber)
      const existingTask = this.activeTasks.get(key)

      if (!existingTask || existingTask.isPaused || existingTask.cancelToken.cancelled) {
        this.activeTasks.delete(key)
        continue
      }

      this.runningCount++
      this._runEpisodeDownload(existingTask, request)
    }
  }

  _onTaskComplete(key) {
    this.activeTasks.delete(key)
    this.speedTrackers.delete(key)
    this.runningCount--
    this._processQueue()
  }

  async _runEpisodeDownload(task, request) {
    const key = this._taskKey(task.recordKey, task.episodeNumber)
    const episode = {
      status: 'downloading',
      networkM3u8Url: request.m3u8Url,
      localM3u8Path: '',
      downloadDirectory: '',
      totalSegments: 0,
      downloadedSegments: 0,
      progressPercent: 0,
      totalBytes: 0,
      errorMessage: '',
      completedAt: null,
    }

    this._sendProgress(task.recordKey, task.episodeNumber, episode, 0)

    try {
      // Fetch M3U8
      let m3u8Content
      try {
        m3u8Content = await this._fetchM3u8(request.m3u8Url, request.httpHeaders, task.cancelToken)
      } catch (e) {
        if (e.message === 'URL is not M3U8' || e.message === 'Response too large, not M3U8') {
          // Fall back to direct file download
          await this._runDirectFileDownload(task, request, episode)
          return
        }
        throw e
      }

      // Parse M3U8
      const type = m3u8Parser.detectType(m3u8Content)
      let mediaM3u8Content = m3u8Content
      let mediaM3u8Url = request.m3u8Url

      if (type === 'master') {
        const master = m3u8Parser.parseMasterPlaylist(m3u8Content, request.m3u8Url)
        const bestVariant = master.variants.reduce((a, b) => a.bandwidth > b.bandwidth ? a : b)
        mediaM3u8Url = bestVariant.uri
        mediaM3u8Content = await this._fetchM3u8(mediaM3u8Url, request.httpHeaders, task.cancelToken)
      }

      const playlist = m3u8Parser.parseMediaPlaylist(mediaM3u8Content, mediaM3u8Url)

      // Resolve nested segments
      const resolvedSegments = await m3u8Parser.resolveNestedSegments(
        playlist.segments,
        (url) => this._fetchM3u8(url, request.httpHeaders, task.cancelToken)
      )

      if (!playlist.isVod) {
        log.warn('不支持下载直播流:', key)
        episode.status = 'failed'
        episode.errorMessage = '不支持下载直播流'
        this._sendProgress(task.recordKey, task.episodeNumber, episode, 0)
        return
      }

      if (resolvedSegments.length === 0) {
        log.warn('M3U8 中未找到可下载的分片:', key)
        episode.status = 'failed'
        episode.errorMessage = 'M3U8 中未找到可下载的分片'
        this._sendProgress(task.recordKey, task.episodeNumber, episode, 0)
        return
      }

      // Filter ads
      let segments = resolvedSegments
      if (request.adBlockerEnabled) {
        segments = m3u8AdFilter.filterAds(segments)
      }

      // Create download directory
      const episodeDir = storage.getEpisodeDir(request.bangumiId, request.pluginName, request.episodeNumber)
      fs.mkdirSync(episodeDir, { recursive: true })
      episode.downloadDirectory = episodeDir

      // Download keys
      const keys = m3u8Parser.extractUniqueKeys({
        segments,
        targetDuration: playlist.targetDuration,
        isVod: true,
      })
      const keyUriToLocal = {}
      for (let i = 0; i < keys.length; i++) {
        const keyFile = `key_${i}.key`
        const keyPath = path.join(episodeDir, keyFile)
        await this._downloadFile(keys[i].uri, keyPath, request.httpHeaders, task.cancelToken)
        keyUriToLocal[keys[i].uri] = keyFile
      }

      // Check existing segments
      episode.totalSegments = segments.length
      episode.downloadedSegments = 0

      const existingSegments = new Set()
      for (let i = 0; i < segments.length; i++) {
        const segFile = path.join(episodeDir, `seg_${String(i).padStart(5, '0')}.ts`)
        if (fs.existsSync(segFile) && fs.statSync(segFile).size > 0) {
          existingSegments.add(i)
          episode.downloadedSegments++
        }
      }

      const pendingIndices = []
      for (let i = 0; i < segments.length; i++) {
        if (!existingSegments.has(i)) {
          pendingIndices.push(i)
        }
      }

      // Download segments with concurrency control
      let totalBytes = 0
      let completedCount = 0
      let failedCount = 0
      const semaphore = new Semaphore(this.maxParallelSegments)

      this.speedTrackers.set(key, { currentSpeed: 0, _lastBytes: 0, _lastTime: Date.now() })

      if (pendingIndices.length > 0) {
        const promises = pendingIndices.map(async (idx) => {
          if (task.isPaused || task.cancelToken.cancelled) return

          await semaphore.acquire()
          if (task.isPaused || task.cancelToken.cancelled) {
            semaphore.release()
            return
          }

          try {
            const bytes = await this._downloadSegmentWithRetry(
              segments[idx].uri,
              path.join(episodeDir, `seg_${String(idx).padStart(5, '0')}.ts`),
              request.httpHeaders,
              task.cancelToken
            )
            totalBytes += bytes
            episode.downloadedSegments++
            episode.totalBytes = totalBytes
            episode.progressPercent = episode.downloadedSegments / episode.totalSegments

            // Update speed
            const tracker = this.speedTrackers.get(key)
            if (tracker) {
              const now = Date.now()
              const elapsed = now - tracker._lastTime
              if (elapsed > 500) {
                const bytesDownloaded = totalBytes - tracker._lastBytes
                tracker.currentSpeed = bytesDownloaded / (elapsed / 1000)
                tracker._lastBytes = totalBytes
                tracker._lastTime = now
              }
            }

            this._sendProgress(task.recordKey, task.episodeNumber, episode, this.speedTrackers.get(key)?.currentSpeed || 0)
            completedCount++
          } catch (e) {
            failedCount++
          } finally {
            semaphore.release()
          }
        })

        await Promise.all(promises)
      }

      if (task.isPaused || task.cancelToken.cancelled) {
        if (task.isPaused) {
          episode.status = 'paused'
        }
        this._sendProgress(task.recordKey, task.episodeNumber, episode, 0)
        return
      }

      if (failedCount > 0) {
        episode.status = 'failed'
        episode.errorMessage = `${failedCount} 个分片下载失败`
        log.error('下载失败:', key, episode.errorMessage)
        this._sendProgress(task.recordKey, task.episodeNumber, episode, 0)
        return
      }

      // Build local M3U8
      const targetDuration = request.adBlockerEnabled
        ? m3u8AdFilter.calculateTargetDuration(segments)
        : playlist.targetDuration
      const localM3u8 = m3u8Parser.buildLocalM3u8(segments, targetDuration, keyUriToLocal)
      const m3u8Path = path.join(episodeDir, 'playlist.m3u8')
      fs.writeFileSync(m3u8Path, localM3u8)

      episode.status = 'completed'
      episode.localM3u8Path = m3u8Path
      episode.progressPercent = 1.0
      episode.completedAt = new Date()
      log.info('下载完成:', key, `共 ${episode.totalSegments} 个分片`)
      this._sendProgress(task.recordKey, task.episodeNumber, episode, 0)

      // Update download records
      this._updateDownloadRecord(request, episode)
    } catch (e) {
      if (e.message === 'Cancelled' || task.cancelToken.cancelled) {
        if (task.isPaused) {
          episode.status = 'paused'
          log.info('下载已暂停:', key)
        }
      } else {
        episode.status = 'failed'
        episode.errorMessage = e.message
        log.error('下载异常:', key, e.message)
      }
      this._sendProgress(task.recordKey, task.episodeNumber, episode, 0)
    } finally {
      this._onTaskComplete(key)
    }
  }

  async _runDirectFileDownload(task, request, episode) {
    const episodeDir = storage.getEpisodeDir(request.bangumiId, request.pluginName, request.episodeNumber)
    fs.mkdirSync(episodeDir, { recursive: true })
    episode.downloadDirectory = episodeDir

    const filePath = path.join(episodeDir, 'video.mp4')
    const tmpPath = filePath + '.tmp'

    let existingBytes = 0
    if (fs.existsSync(tmpPath)) {
      existingBytes = fs.statSync(tmpPath).size
    }

    episode.totalSegments = 1
    episode.downloadedSegments = 0
    this._sendProgress(task.recordKey, task.episodeNumber, episode, 0)

    // TODO: Implement direct file download with Range support
    log.warn('直链下载暂未实现:', request.m3u8Url)
    episode.status = 'failed'
    episode.errorMessage = '直链下载暂未实现'
    this._sendProgress(task.recordKey, task.episodeNumber, episode, 0)
  }

  _updateDownloadRecord(request, episode) {
    const records = storage.getDownloads()
    const recordKey = `${request.bangumiId}_${request.pluginName}`

    if (!records[recordKey]) {
      records[recordKey] = {
        bangumiId: request.bangumiId,
        pluginName: request.pluginName,
        bangumiName: request.bangumiName,
        cover: request.cover,
        episodes: {},
      }
    }

    records[recordKey].episodes[request.episodeNumber] = episode
    storage.saveDownloads(records)
  }

  getRecords() {
    const records = storage.getDownloads()
    return Object.values(records)
  }

  deleteEpisode(bangumiId, pluginName, episodeNumber) {
    const episodeDir = storage.getEpisodeDir(bangumiId, pluginName, episodeNumber)
    log.info('删除剧集:', `${bangumiId}_${pluginName}`, 'EP' + episodeNumber)
    if (fs.existsSync(episodeDir)) {
      fs.rmSync(episodeDir, { recursive: true, force: true })
    }

    const records = storage.getDownloads()
    const recordKey = `${bangumiId}_${pluginName}`
    if (records[recordKey]?.episodes?.[episodeNumber]) {
      delete records[recordKey].episodes[episodeNumber]
      if (Object.keys(records[recordKey].episodes).length === 0) {
        delete records[recordKey]
      }
      storage.saveDownloads(records)
    }
  }

  deleteRecord(bangumiId, pluginName) {
    const baseDir = storage.getDownloadDir()
    const recordDir = path.join(baseDir, `${bangumiId}_${pluginName}`)
    log.info('删除下载记录:', `${bangumiId}_${pluginName}`)
    if (fs.existsSync(recordDir)) {
      fs.rmSync(recordDir, { recursive: true, force: true })
    }

    const records = storage.getDownloads()
    const recordKey = `${bangumiId}_${pluginName}`
    delete records[recordKey]
    storage.saveDownloads(records)
  }

  getLocalPath(episode) {
    if (!episode || episode.status !== 'completed' || !episode.localM3u8Path) return null
    if (!fs.existsSync(episode.localM3u8Path)) return null
    return episode.localM3u8Path
  }
}

class Semaphore {
  constructor(maxCount) {
    this.maxCount = maxCount
    this.currentCount = 0
    this.waitQueue = []
  }

  async acquire() {
    if (this.currentCount < this.maxCount) {
      this.currentCount++
      return
    }
    return new Promise(resolve => {
      this.waitQueue.push(resolve)
    })
  }

  release() {
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()
      resolve()
    } else {
      this.currentCount--
    }
  }
}

module.exports = { downloadWorker: new DownloadWorker() }
