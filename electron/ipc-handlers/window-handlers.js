const { ipcMain, dialog } = require('electron')

function registerWindowHandlers(getMainWindow) {
  ipcMain.on('window:minimize', () => getMainWindow()?.minimize())
  ipcMain.on('window:maximize', () => {
    const win = getMainWindow()
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })
  ipcMain.on('window:close', () => getMainWindow()?.close())

  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'flv', 'webm', 'm4v', 'ts', 'rmvb', 'wmv', 'mov', 'rm', '3gp'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    return result.filePaths
  })

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      properties: ['openDirectory'],
    })
    return result.filePaths[0] || null
  })
}

module.exports = { registerWindowHandlers }
