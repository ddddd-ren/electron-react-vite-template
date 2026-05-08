const path = require('path')
const fs = require('fs')
const os = require('os')
const storage = require('./storage')
const { createLogger } = require('./logger')
const log = createLogger('webdav')

class WebDavService {
  constructor() {
    this.client = null
    this.initialized = false
    this.isSyncing = false
    this.tempDir = path.join(os.tmpdir(), 'anime-player-webdav')
    this.webdavModule = null
  }

  async _loadWebDav() {
    if (!this.webdavModule) {
      // 动态导入 ESM 模块
      this.webdavModule = await import('webdav')
    }
    return this.webdavModule
  }

  async init(config) {
    if (!config.url) {
      throw new Error('请先填写 WebDAV URL')
    }

    try {
      const webdav = await this._loadWebDav()
      this.client = webdav.createClient(config.url, {
        username: config.username,
        password: config.password,
      })

      // Test connection
      await this.client.ping()

      // Create sync directory if not exists
      try {
        const exists = await this.client.exists('/anime-player-sync')
        if (!exists) {
          await this.client.createDirectory('/anime-player-sync')
        }
      } catch (e) {
        // Directory might already exist
      }

      // Create temp directory
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true })
      }

      this.initialized = true
      return true
    } catch (e) {
      log.error('初始化失败:', e)
      throw e
    }
  }

  async ping() {
    if (!this.client) {
      throw new Error('WebDAV 未初始化')
    }
    await this.client.ping()
    return true
  }

  async _upload(filename) {
    const localPath = path.join(storage.userDataPath, `${filename}.json`)
    const tempPath = path.join(this.tempDir, `${filename}.tmp`)
    const remotePath = `/anime-player-sync/${filename}.tmp`
    const remoteFinalPath = `/anime-player-sync/${filename}.json`

    // Copy to temp
    if (fs.existsSync(localPath)) {
      fs.copyFileSync(localPath, tempPath)
    } else {
      // Create empty file
      fs.writeFileSync(tempPath, '{}', 'utf-8')
    }

    try {
      // Remove old cache file if exists
      try {
        await this.client.deleteFile(remotePath)
      } catch {}

      // Upload to temp location
      await this.client.putFileContents(remotePath, fs.readFileSync(tempPath, 'utf-8'))

      // Remove old final file
      try {
        await this.client.deleteFile(remoteFinalPath)
      } catch {}

      // Rename to final location
      await this.client.moveFile(remotePath, remoteFinalPath)
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempPath)
      } catch {}
    }
  }

  async _download(filename) {
    const remotePath = `/anime-player-sync/${filename}.json`
    const localPath = path.join(this.tempDir, `${filename}.tmp`)

    try {
      const content = await this.client.getFileContents(remotePath, { format: 'text' })
      fs.writeFileSync(localPath, content, 'utf-8')
      return localPath
    } catch (e) {
      log.error(`下载 ${filename} 失败:`, e)
      throw e
    }
  }

  async updateHistory() {
    if (this.isSyncing) {
      throw new Error('正在同步中，请稍后再试')
    }
    this.isSyncing = true
    try {
      await this._upload('histories')
      return true
    } catch (e) {
      log.error('上传历史记录失败:', e)
      throw e
    } finally {
      this.isSyncing = false
    }
  }

  async updateCollectibles() {
    if (this.isSyncing) {
      throw new Error('正在同步中，请稍后再试')
    }
    this.isSyncing = true
    try {
      await this._upload('collectibles')
      // Also upload changes if exists
      const changes = storage.getCollectChanges()
      if (changes.length > 0) {
        await this._upload('collectchanges')
      }
      return true
    } catch (e) {
      log.error('上传收藏失败:', e)
      throw e
    } finally {
      this.isSyncing = false
    }
  }

  async syncHistory() {
    if (this.isSyncing) {
      throw new Error('正在同步中，请稍后再试')
    }
    this.isSyncing = true
    try {
      const tempPath = await this._download('histories')
      const remoteData = JSON.parse(fs.readFileSync(tempPath, 'utf-8'))

      // Merge with local data
      const localData = storage.getHistories()
      const merged = { ...localData, ...remoteData }
      storage.saveHistories(merged)

      // Upload merged data
      await this._upload('histories')
      return true
    } catch (e) {
      log.error('同步历史记录失败:', e)
      throw e
    } finally {
      this.isSyncing = false
    }
  }

  async syncCollectibles() {
    if (this.isSyncing) {
      throw new Error('正在同步中，请稍后再试')
    }
    this.isSyncing = true
    try {
      // Download remote collectibles
      let remoteCollectibles = []
      let remoteChanges = []

      try {
        const tempPath = await this._download('collectibles')
        remoteCollectibles = JSON.parse(fs.readFileSync(tempPath, 'utf-8'))
      } catch (e) {
        // Remote file might not exist
      }

      try {
        const tempPath = await this._download('collectchanges')
        remoteChanges = JSON.parse(fs.readFileSync(tempPath, 'utf-8'))
      } catch (e) {
        // Remote file might not exist
      }

      // Merge with local data
      const localCollectibles = storage.getCollectibles()
      const merged = this._mergeCollectibles(localCollectibles, remoteCollectibles, remoteChanges)
      storage.saveCollectibles(merged)

      // Clear local changes
      storage.saveCollectChanges([])

      // Upload merged data
      await this._upload('collectibles')
      return true
    } catch (e) {
      log.error('同步收藏失败:', e)
      throw e
    } finally {
      this.isSyncing = false
    }
  }

  _mergeCollectibles(local, remote, changes) {
    const merged = new Map()

    // Add local items
    for (const item of local) {
      merged.set(item.bangumiId || item.id, item)
    }

    // Apply remote items (remote takes precedence for conflicts)
    for (const item of remote) {
      const key = item.bangumiId || item.id
      if (!merged.has(key)) {
        merged.set(key, item)
      } else {
        // Update if remote is newer
        const existing = merged.get(key)
        if (new Date(item.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
          merged.set(key, item)
        }
      }
    }

    // Apply changes
    for (const change of changes) {
      const key = change.bangumiId
      if (change.action === 1) {
        // Add
        if (!merged.has(key)) {
          merged.set(key, { bangumiId: key, type: change.type, updatedAt: new Date(change.timestamp).toISOString() })
        }
      } else if (change.action === 2) {
        // Update
        if (merged.has(key)) {
          merged.get(key).type = change.type
          merged.get(key).updatedAt = new Date(change.timestamp).toISOString()
        }
      }
    }

    return Array.from(merged.values())
  }
}

module.exports = new WebDavService()
