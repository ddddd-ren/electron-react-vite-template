const { ipcMain } = require('electron')
const proxyManager = require('../services/proxy-manager')
const { createLogger } = require('../services/logger')
const log = createLogger('proxy')

function registerProxyHandlers() {
  ipcMain.handle('proxy:set', async (event, config) => {
    try {
      return await proxyManager.setProxy(config)
    } catch (e) {
      log.error('设置代理失败:', e)
      throw e
    }
  })

  ipcMain.handle('proxy:clear', async () => {
    try {
      return await proxyManager.clearProxy()
    } catch (e) {
      log.error('清除代理失败:', e)
      throw e
    }
  })

  ipcMain.handle('proxy:get', () => {
    return proxyManager.getProxy()
  })
}

module.exports = { registerProxyHandlers }
