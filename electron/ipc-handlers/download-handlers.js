const { ipcMain } = require('electron')
const { downloadWorker } = require('../services/download-worker')

function registerDownloadHandlers() {
  ipcMain.handle('download:enqueue', async (event, request) => {
    await downloadWorker.enqueue(request)
    return true
  })

  ipcMain.handle('download:enqueuePriority', async (event, request) => {
    await downloadWorker.enqueuePriority(request)
    return true
  })

  ipcMain.handle('download:pause', (event, recordKey, episodeNumber) => {
    downloadWorker.pause(recordKey, episodeNumber)
    return true
  })

  ipcMain.handle('download:resume', async (event, request) => {
    await downloadWorker.resume(request)
    return true
  })

  ipcMain.handle('download:cancel', (event, recordKey, episodeNumber) => {
    downloadWorker.cancel(recordKey, episodeNumber)
    return true
  })

  ipcMain.handle('download:getRecords', () => {
    return downloadWorker.getRecords()
  })

  ipcMain.handle('download:deleteEpisode', (event, bangumiId, pluginName, episodeNumber) => {
    downloadWorker.deleteEpisode(bangumiId, pluginName, episodeNumber)
    return true
  })

  ipcMain.handle('download:deleteRecord', (event, bangumiId, pluginName) => {
    downloadWorker.deleteRecord(bangumiId, pluginName)
    return true
  })

  ipcMain.handle('download:getLocalPath', (event, episode) => {
    return downloadWorker.getLocalPath(episode)
  })

  ipcMain.handle('download:getSpeed', (event, recordKey, episodeNumber) => {
    return downloadWorker.getSpeed(recordKey, episodeNumber)
  })
}

module.exports = { registerDownloadHandlers }
