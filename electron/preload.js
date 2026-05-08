const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // 文件对话框
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // 文件系统
  readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
  getSubtitles: (videoPath) => ipcRenderer.invoke('fs:getSubtitles', videoPath),

  // 进度
  getProgress: (mediaId) => ipcRenderer.invoke('progress:get', mediaId),
  setProgress: (mediaId, progress) => ipcRenderer.invoke('progress:set', mediaId, progress),

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),

  // ═══ Bangumi ═══
  bangumiGetCalendar: () => ipcRenderer.invoke('bangumi:getCalendar'),
  bangumiGetUsername: (token) => ipcRenderer.invoke('bangumi:getUsername', token),
  bangumiGetTrending: () => ipcRenderer.invoke('bangumi:getTrending'),

  // ═══ 下载管理 ═══
  downloadEnqueue: (request) => ipcRenderer.invoke('download:enqueue', request),
  downloadEnqueuePriority: (request) => ipcRenderer.invoke('download:enqueuePriority', request),
  downloadPause: (recordKey, episodeNumber) => ipcRenderer.invoke('download:pause', recordKey, episodeNumber),
  downloadResume: (request) => ipcRenderer.invoke('download:resume', request),
  downloadCancel: (recordKey, episodeNumber) => ipcRenderer.invoke('download:cancel', recordKey, episodeNumber),
  downloadGetRecords: () => ipcRenderer.invoke('download:getRecords'),
  downloadDeleteEpisode: (bangumiId, pluginName, episodeNumber) => ipcRenderer.invoke('download:deleteEpisode', bangumiId, pluginName, episodeNumber),
  downloadDeleteRecord: (bangumiId, pluginName) => ipcRenderer.invoke('download:deleteRecord', bangumiId, pluginName),
  downloadGetLocalPath: (episode) => ipcRenderer.invoke('download:getLocalPath', episode),
  downloadGetSpeed: (recordKey, episodeNumber) => ipcRenderer.invoke('download:getSpeed', recordKey, episodeNumber),
  downloadOnProgress: (callback) => {
    const handler = (_event, ...args) => callback(...args)
    ipcRenderer.on('download:progress', handler)
    return () => ipcRenderer.removeListener('download:progress', handler)
  },

  // ═══ WebDAV ═══
  webdavInit: (config) => ipcRenderer.invoke('webdav:init', config),
  webdavSyncHistory: () => ipcRenderer.invoke('webdav:syncHistory'),
  webdavSyncCollectibles: () => ipcRenderer.invoke('webdav:syncCollectibles'),
  webdavUpdateHistory: () => ipcRenderer.invoke('webdav:updateHistory'),
  webdavUpdateCollectibles: () => ipcRenderer.invoke('webdav:updateCollectibles'),

  // ═══ 代理 ═══
  proxySet: (config) => ipcRenderer.invoke('proxy:set', config),
  proxyClear: () => ipcRenderer.invoke('proxy:clear'),
  proxyGet: () => ipcRenderer.invoke('proxy:get'),

  // ═══ 在线源爬虫 ═══
  scraperFetchHome: () => ipcRenderer.invoke('scraper:fetchHome'),
  scraperSearch: (keyword) => ipcRenderer.invoke('scraper:search', keyword),
  scraperFetchDetail: (url) => ipcRenderer.invoke('scraper:fetchDetail', url),
  scraperFetchPlayUrl: (episodeUrl) => ipcRenderer.invoke('scraper:fetchPlayUrl', episodeUrl),
  scraperGetSources: () => ipcRenderer.invoke('scraper:getSources'),
  scraperSaveSources: (sources) => ipcRenderer.invoke('scraper:saveSources', sources),
  scraperResetSources: () => ipcRenderer.invoke('scraper:resetSources'),

  // ═══ 音频转码 ═══
  audioTranscoderDetect: (filePath) => ipcRenderer.invoke('audio-transcoder:detect', filePath),
  audioTranscoderStart: (filePath) => ipcRenderer.invoke('audio-transcoder:start', filePath),
  audioTranscoderStop: (key) => ipcRenderer.invoke('audio-transcoder:stop', key),

  // ═══ 版本信息 ═══
  getVersionInfo: () => ipcRenderer.invoke('get-version-info'),
  onShowUpdateDialog: (callback) => {
    const handler = (_event, ...args) => callback(...args)
    ipcRenderer.on('show-update-dialog', handler)
    return () => ipcRenderer.removeListener('show-update-dialog', handler)
  },
})
