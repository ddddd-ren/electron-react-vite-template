const { ipcMain } = require('electron')
const axios = require('axios')
const storage = require('../services/storage')
const { createLogger } = require('../services/logger')
const log = createLogger('bangumi')

const BANGUMI_API_BASE = 'https://api.bgm.tv'

function getBangumiHeaders(token) {
  const headers = {
    'User-Agent': 'anime-player-v2/1.0',
    'Accept': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

function getToken() {
  return storage.getSettings().bangumiAccessToken || ''
}

function registerBangumiHandlers() {
  // Get username (validate token)
  ipcMain.handle('bangumi:getUsername', async (event, token) => {
    try {
      const response = await axios.get(`${BANGUMI_API_BASE}/v0/me`, {
        headers: getBangumiHeaders(token),
        timeout: 10000,
      })
      return response.data.username || null
    } catch (e) {
      log.error('getUsername 失败:', e.message)
      return null
    }
  })

  // Get calendar (new anime schedule)
  ipcMain.handle('bangumi:getCalendar', async () => {
    try {
      const token = getToken()
      const response = await axios.get(`${BANGUMI_API_BASE}/calendar`, {
        headers: getBangumiHeaders(token),
        timeout: 15000,
      })
      const data = response.data || []
      // 统一格式：确保每个 item 有 image 字段
      return data.map(day => ({
        ...day,
        items: (day.items || []).map(item => ({
          ...item,
          image: item.images?.large || item.images?.common || item.images?.medium || '',
        }))
      }))
    } catch (e) {
      log.error('getCalendar 失败:', e.message)
      return []
    }
  })

  // Get trending (热门番剧)
  ipcMain.handle('bangumi:getTrending', async () => {
    try {
      const token = getToken()
      const response = await axios.post(`${BANGUMI_API_BASE}/v0/search/subjects`, {
        sort: 'heat',
        type: 2,
        limit: 24,
      }, {
        headers: { ...getBangumiHeaders(token), 'Content-Type': 'application/json' },
        timeout: 15000,
      })
      const raw = response.data
      const items = Array.isArray(raw?.data) ? raw.data : []
      return items.map(s => ({
        ...s,
        image: s.image || s.images?.large || s.images?.common || s.images?.medium || '',
      }))
    } catch (e) {
      log.error('getTrending 失败:', e.message)
      return []
    }
  })
}

module.exports = { registerBangumiHandlers }
