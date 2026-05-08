const { session } = require('electron')
const storage = require('./storage')
const { createLogger } = require('./logger')
const log = createLogger('proxy')

class ProxyManager {
  constructor() {
    this.currentProxy = null
  }

  async setProxy(config) {
    try {
      const proxyRules = this._buildProxyRules(config)
      await session.defaultSession.setProxy({
        proxyRules,
      })
      this.currentProxy = config

      // Save to settings
      const settings = storage.getSettings()
      settings.proxy = config
      storage.saveSettings(settings)

      return true
    } catch (e) {
      log.error('设置代理失败:', e)
      throw e
    }
  }

  async clearProxy() {
    try {
      await session.defaultSession.setProxy({
        proxyRules: '',
      })
      this.currentProxy = null

      // Remove from settings
      const settings = storage.getSettings()
      delete settings.proxy
      storage.saveSettings(settings)

      return true
    } catch (e) {
      log.error('清除代理失败:', e)
      throw e
    }
  }

  getProxy() {
    if (!this.currentProxy) {
      // Try to load from settings
      const settings = storage.getSettings()
      this.currentProxy = settings.proxy || null
    }
    return this.currentProxy
  }

  _buildProxyRules(config) {
    if (!config || !config.host) return ''

    const protocol = config.protocol || 'http'
    const host = config.host
    const port = config.port || (protocol === 'socks5' ? 1080 : 8080)

    if (protocol === 'socks5') {
      return `socks5://${host}:${port}`
    }

    return `${protocol}://${host}:${port}`
  }

  async loadSavedProxy() {
    const proxy = this.getProxy()
    if (proxy && proxy.host) {
      try {
        await this.setProxy(proxy)
        return true
      } catch (e) {
        log.error('加载已保存代理失败:', e)
        return false
      }
    }
    return false
  }
}

module.exports = new ProxyManager()
