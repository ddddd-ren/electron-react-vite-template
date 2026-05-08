const { ipcMain } = require('electron')
const storage = require('../services/storage')

function registerProgressHandlers() {
  ipcMain.handle('progress:get', (event, mediaId) => {
    return storage.getProgressForMedia(mediaId)
  })

  ipcMain.handle('progress:set', (event, mediaId, progress) => {
    storage.setProgressForMedia(mediaId, progress)
    return true
  })
}

module.exports = { registerProgressHandlers }
