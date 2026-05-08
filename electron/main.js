const { app, BrowserWindow, ipcMain, protocol } = require('electron')
const path = require('path')
const fs = require('fs')

// 启用硬件加速和 HEVC 解码支持
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport,PlatformHEVCEncoderSupport')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-accelerated-video-decode')
app.commandLine.appendSwitch('enable-hevc-decoding')

const { createLogger } = require('./services/logger')
const log = createLogger('main')
const { versionHistory } = require('./version-history')

// IPC handler 注册
const { registerBangumiHandlers } = require('./ipc-handlers/bangumi-handlers')
const { registerDownloadHandlers } = require('./ipc-handlers/download-handlers')
const { downloadWorker } = require('./services/download-worker')
const { registerProxyHandlers } = require('./ipc-handlers/proxy-handlers')
const proxyManager = require('./services/proxy-manager')
const { registerScraperHandlers } = require('./ipc-handlers/scraper-handlers')
const { registerAudioTranscoderHandlers } = require('./ipc-handlers/audio-transcoder-handlers')
const { registerWindowHandlers } = require('./ipc-handlers/window-handlers')
const { registerFsHandlers } = require('./ipc-handlers/fs-handlers')
const { registerSettingsHandlers } = require('./ipc-handlers/settings-handlers')
const { registerProgressHandlers } = require('./ipc-handlers/progress-handlers')

const isDev = !app.isPackaged
let mainWindow

// 版本检测
const currentVersion = app.getVersion()
const versionFile = path.join(app.getPath('userData'), 'last-version.json')

function getLastVersion() {
  try {
    if (fs.existsSync(versionFile)) {
      const data = JSON.parse(fs.readFileSync(versionFile, 'utf-8'))
      return data.version || '0.0.0'
    }
  } catch {}
  return '0.0.0'
}

function saveLastVersion(version) {
  fs.writeFileSync(versionFile, JSON.stringify({ version, updatedAt: Date.now() }), 'utf-8')
}

function getVersionHistoryToShow(lastVersion) {
  const lastIdx = versionHistory.findIndex(v => v.version === lastVersion)
  if (lastIdx === -1) return versionHistory
  return versionHistory.slice(lastIdx + 1)
}

function createWindow() {
  log.info('创建主窗口')
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    frame: false,
    thickFrame: true,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f13',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'icon.ico'),
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const prefix = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'][level] || 'LOG'
      log.debug(`[renderer ${prefix}] ${message} (${sourceId}:${line})`)
    })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    const lastVersion = getLastVersion()
    if (lastVersion !== currentVersion) {
      const historyToShow = getVersionHistoryToShow(lastVersion)
      if (historyToShow.length > 0) {
        mainWindow.webContents.send('show-update-dialog', {
          currentVersion,
          history: historyToShow,
        })
      }
      saveLastVersion(currentVersion)
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(async () => {
  log.info('应用启动', { version: currentVersion, isDev })
  protocol.registerFileProtocol('local-file', (request, callback) => {
    const urlPath = request.url.replace(/^local-file:\/\/\//, '')
    const filePath = decodeURIComponent(urlPath).replace(/\//g, path.sep)
    callback({ path: filePath })
  })

  createWindow()

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; media-src 'self' local-file: file: data: blob: http: https:"],
      },
    })
  })

  // 注册所有 IPC handlers
  registerWindowHandlers(() => mainWindow)
  registerFsHandlers()
  registerSettingsHandlers()
  registerProgressHandlers()
  registerBangumiHandlers()
  registerDownloadHandlers()
  downloadWorker.setMainWindow(mainWindow)
  registerProxyHandlers()
  proxyManager.loadSavedProxy()
  registerScraperHandlers()
  registerAudioTranscoderHandlers()

  try {
    const { registerWebDavHandlers } = require('./ipc-handlers/webdav-handlers')
    registerWebDavHandlers()
  } catch (e) {
    log.error('加载 WebDAV handlers 失败:', e)
  }

  ipcMain.handle('get-version-info', () => ({ currentVersion, versionHistory }))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
