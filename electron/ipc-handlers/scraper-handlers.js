const { ipcMain } = require('electron')
const scraper = require('../services/scraper')
const storage = require('../services/storage')
const { YIDIAN_RULE, KAZUMI_RULES } = require('../services/kazumi-rules')

const DEFAULT_RULES = [YIDIAN_RULE, ...KAZUMI_RULES].map(r => ({ ...r, enabled: true }))

function getRules() {
  try {
    const settings = storage.getSettings()
    // 仅在从未保存过规则时使用默认值；用户主动清空则尊重
    return settings.scraperRules != null
      ? settings.scraperRules
      : DEFAULT_RULES
  } catch {
    return DEFAULT_RULES
  }
}

function getEnabledRules() {
  return getRules().filter(r => r.enabled !== false)
}

function registerScraperHandlers() {
  // 获取规则列表
  ipcMain.handle('scraper:getSources', async () => {
    return getRules()
  })

  // 保存规则列表
  ipcMain.handle('scraper:saveSources', async (event, rules) => {
    const settings = storage.getSettings() || {}
    settings.scraperRules = rules
    storage.saveSettings(settings)
    return true
  })

  // 恢复默认规则
  ipcMain.handle('scraper:resetSources', async () => {
    const settings = storage.getSettings() || {}
    settings.scraperRules = DEFAULT_RULES
    storage.saveSettings(settings)
    return DEFAULT_RULES
  })

  // 首页（有 homeSections 的源并发）
  ipcMain.handle('scraper:fetchHome', async () => {
    const rules = getEnabledRules().filter(r => r.homeSections)
    const promises = rules.map(async (rule) => {
      try {
        const resp = await scraper.fetchHome(rule)
        if (resp.success && resp.sections.length > 0) {
          return { sourceName: rule.name, sourceUrl: rule.baseURL, sections: resp.sections }
        }
      } catch {}
      return null
    })
    const results = (await Promise.all(promises)).filter(Boolean)
    return { success: true, results }
  })

  // 搜索（所有启用的源并行）
  ipcMain.handle('scraper:search', async (event, keyword) => {
    const rules = getEnabledRules()
    const allItems = []
    const promises = rules.map(async (rule) => {
      try {
        const resp = await scraper.search(rule, keyword)
        if (resp.success) {
          return resp.items.map(item => ({ ...item, sourceName: rule.name }))
        }
      } catch {}
      return []
    })
    const results = await Promise.all(promises)
    for (const items of results) allItems.push(...items)
    return { success: true, items: allItems }
  })

  // 详情
  ipcMain.handle('scraper:fetchDetail', async (event, url) => {
    const rules = getRules()
    let rule = rules[0]
    for (const r of rules) {
      if (url.startsWith(r.baseURL)) { rule = r; break }
    }
    return await scraper.fetchDetail(rule, url)
  })

  // 播放地址
  ipcMain.handle('scraper:fetchPlayUrl', async (event, episodeUrl) => {
    const rules = getRules()
    let rule = rules[0]
    for (const r of rules) {
      if (episodeUrl.startsWith(r.baseURL)) { rule = r; break }
    }
    return await scraper.fetchPlayUrl(rule, episodeUrl)
  })
}

module.exports = { registerScraperHandlers }
