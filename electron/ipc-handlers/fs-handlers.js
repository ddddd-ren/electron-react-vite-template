const { ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { createLogger } = require('../services/logger')
const log = createLogger('fs')

const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.flv', '.webm', '.m4v', '.ts', '.rmvb', '.wmv', '.mov', '.rm', '.3gp']
const SUB_EXTS = ['.srt', '.ass', '.ssa', '.vtt', '.sub']
const MAX_DEPTH = 4

function scanDir(dir, depth) {
  if (depth > MAX_DEPTH) return []
  let items
  try {
    items = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const results = []
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) {
      if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '$RECYCLE.BIN') continue
      results.push(...scanDir(fullPath, depth + 1))
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase()
      if (VIDEO_EXTS.includes(ext)) {
        let size = 0, mtime = 0
        try {
          const stat = fs.statSync(fullPath)
          size = stat.size
          mtime = stat.mtimeMs
        } catch {}
        results.push({ name: item.name, path: fullPath, ext, size, mtime })
      }
    }
  }
  return results
}

function registerFsHandlers() {
  ipcMain.handle('fs:readDir', async (event, dirPath) => {
    try {
      log.info('readDir:', dirPath)
      if (!fs.existsSync(dirPath)) {
        return { files: [], error: '目录不存在: ' + dirPath }
      }
      const files = scanDir(dirPath, 0).sort((a, b) => b.mtime - a.mtime)
      log.info('readDir 找到视频文件:', files.length, '个')
      return { files, error: null }
    } catch (e) {
      log.error('readDir 异常:', e)
      return { files: [], error: e.message }
    }
  })

  ipcMain.handle('fs:getSubtitles', async (event, videoPath) => {
    try {
      const dir = path.dirname(videoPath)
      const videoName = path.basename(videoPath, path.extname(videoPath))
      const subtitles = []
      const subDirs = [dir, path.join(dir, 'Subs'), path.join(dir, 'subs'), path.join(dir, '字幕')]

      for (const searchDir of subDirs) {
        if (!fs.existsSync(searchDir)) continue
        let items
        try { items = fs.readdirSync(searchDir, { withFileTypes: true }) } catch { continue }

        for (const item of items) {
          if (!item.isFile()) continue
          const ext = path.extname(item.name).toLowerCase()
          if (!SUB_EXTS.includes(ext)) continue

          const baseName = path.basename(item.name, ext)
          const isMatch = baseName === videoName || baseName.startsWith(videoName + '.') || baseName.startsWith(videoName + '_')
          if (isMatch || subtitles.length < 5) {
            const content = fs.readFileSync(path.join(searchDir, item.name), 'utf-8')
            subtitles.push({
              name: item.name,
              path: path.join(searchDir, item.name),
              ext,
              content,
              label: baseName === videoName ? '默认字幕' : baseName,
            })
          }
        }
      }
      return subtitles
    } catch (e) {
      return []
    }
  })
}

module.exports = { registerFsHandlers }
