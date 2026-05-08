const { app } = require('electron')
const path = require('path')
const fs = require('fs')
const { createLogger } = require('./logger')
const log = createLogger('storage')

class Storage {
  constructor() {
    this.userDataPath = app.getPath('userData')
  }

  _getFilePath(filename) {
    return path.join(this.userDataPath, filename)
  }

  load(filename, defaultValue = {}) {
    const filePath = this._getFilePath(filename)
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      }
    } catch (e) {
      log.error(`加载 ${filename} 失败:`, e)
    }
    return defaultValue
  }

  save(filename, data) {
    const filePath = this._getFilePath(filename)
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    } catch (e) {
      log.error(`保存 ${filename} 失败:`, e)
      return false
    }
  }

  // Settings
  getSettings() {
    return this.load('settings.json', { theme: 'dark' })
  }

  saveSettings(settings) {
    return this.save('settings.json', settings)
  }

  // Downloads
  getDownloads() {
    return this.load('downloads.json', {})
  }

  saveDownloads(downloads) {
    return this.save('downloads.json', downloads)
  }

  // Collectibles
  getCollectibles() {
    return this.load('collectibles.json', [])
  }

  saveCollectibles(collectibles) {
    return this.save('collectibles.json', collectibles)
  }

  // Collect changes (for WebDAV incremental sync)
  getCollectChanges() {
    return this.load('collectchanges.json', [])
  }

  saveCollectChanges(changes) {
    return this.save('collectchanges.json', changes)
  }

  appendCollectChange(bangumiId, action, type) {
    const changes = this.getCollectChanges()
    changes.push({
      bangumiId,
      action, // 1=add, 2=update
      type,
      timestamp: Date.now(),
    })
    return this.save('collectchanges.json', changes)
  }

  // Histories
  getHistories() {
    return this.load('histories.json', {})
  }

  saveHistories(histories) {
    return this.save('histories.json', histories)
  }

  // Progress
  getProgress() {
    return this.load('progress.json', {})
  }

  saveProgress(data) {
    return this.save('progress.json', data)
  }

  getProgressForMedia(mediaId) {
    const data = this.getProgress()
    return data[mediaId] || { position: 0, duration: 0 }
  }

  setProgressForMedia(mediaId, progress) {
    const data = this.getProgress()
    data[mediaId] = { ...progress, updated_at: Date.now() }
    return this.saveProgress(data)
  }

  // Download base directory
  getDownloadDir() {
    return path.join(this.userDataPath, 'downloads')
  }

  getEpisodeDir(bangumiId, pluginName, episodeNumber) {
    return path.join(this.getDownloadDir(), `${bangumiId}_${pluginName}`, String(episodeNumber))
  }
}

module.exports = new Storage()
