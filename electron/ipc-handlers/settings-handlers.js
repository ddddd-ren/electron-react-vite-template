const { ipcMain } = require('electron')
const storage = require('../services/storage')

function registerSettingsHandlers() {
  ipcMain.handle('settings:get', () => storage.getSettings())
  ipcMain.handle('settings:set', (event, settings) => {
    storage.saveSettings(settings)
    return true
  })
}

module.exports = { registerSettingsHandlers }
