const { ipcMain } = require('electron')
const { createLogger } = require('../services/logger')
const log = createLogger('webdav')

// WebDAV service will be loaded lazily to avoid ESM import issues
let webdavService = null

async function getWebDavService() {
  if (!webdavService) {
    webdavService = require('../services/webdav-service')
  }
  return webdavService
}

function registerWebDavHandlers() {
  ipcMain.handle('webdav:init', async (event, config) => {
    try {
      const service = await getWebDavService()
      return await service.init(config)
    } catch (e) {
      log.error('初始化失败:', e)
      throw e
    }
  })

  ipcMain.handle('webdav:syncHistory', async () => {
    try {
      const service = await getWebDavService()
      return await service.syncHistory()
    } catch (e) {
      log.error('同步历史记录失败:', e)
      throw e
    }
  })

  ipcMain.handle('webdav:syncCollectibles', async () => {
    try {
      const service = await getWebDavService()
      return await service.syncCollectibles()
    } catch (e) {
      log.error('同步收藏失败:', e)
      throw e
    }
  })

  ipcMain.handle('webdav:updateHistory', async () => {
    try {
      const service = await getWebDavService()
      return await service.updateHistory()
    } catch (e) {
      log.error('上传历史记录失败:', e)
      throw e
    }
  })

  ipcMain.handle('webdav:updateCollectibles', async () => {
    try {
      const service = await getWebDavService()
      return await service.updateCollectibles()
    } catch (e) {
      log.error('上传收藏失败:', e)
      throw e
    }
  })
}

module.exports = { registerWebDavHandlers }
