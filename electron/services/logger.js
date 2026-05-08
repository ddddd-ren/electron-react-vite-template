const fs = require('fs')
const path = require('path')
const { app } = require('electron')

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const LEVEL_LABELS = { debug: 'DEBUG', info: 'INFO', warn: 'WARN', error: 'ERROR' }
const MAX_LOG_DAYS = 7

let logDir = null
let currentLevel = LOG_LEVELS.debug

function getLogDir() {
  if (!logDir) {
    logDir = path.join(app.getPath('userData'), 'logs')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    cleanOldLogs()
  }
  return logDir
}

function getDateStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getTimeStr() {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function getLogFilePath() {
  return path.join(getLogDir(), `${getDateStr()}.log`)
}

function cleanOldLogs() {
  try {
    const files = fs.readdirSync(logDir)
    const cutoff = Date.now() - MAX_LOG_DAYS * 24 * 60 * 60 * 1000
    for (const file of files) {
      if (!file.endsWith('.log')) continue
      const dateStr = file.replace('.log', '')
      const fileDate = new Date(dateStr).getTime()
      if (fileDate < cutoff) {
        fs.unlinkSync(path.join(logDir, file))
      }
    }
  } catch {}
}

function formatArgs(args) {
  return args.map(a => {
    if (a instanceof Error) return a.stack || a.message
    if (typeof a === 'object') {
      try { return JSON.stringify(a) } catch { return String(a) }
    }
    return String(a)
  }).join(' ')
}

function write(level, module, message) {
  if (level < currentLevel) return
  const timestamp = `${getDateStr()} ${getTimeStr()}`
  const label = LEVEL_LABELS[level]
  const prefix = module ? `[${module}] ` : ''
  const line = `[${timestamp}] [${label}] ${prefix}${message}\n`

  // 控制台输出
  const consoleMethod = level >= 2 ? 'error' : level >= 1 ? 'log' : 'log'
  process[consoleMethod](line.trimEnd())

  // 文件输出
  try {
    fs.appendFileSync(getLogFilePath(), line)
  } catch {}
}

function createLogger(module) {
  return {
    debug: (...args) => write(LOG_LEVELS.debug, module, formatArgs(args)),
    info: (...args) => write(LOG_LEVELS.info, module, formatArgs(args)),
    warn: (...args) => write(LOG_LEVELS.warn, module, formatArgs(args)),
    error: (...args) => write(LOG_LEVELS.error, module, formatArgs(args)),
  }
}

function setLevel(level) {
  if (LOG_LEVELS[level] !== undefined) {
    currentLevel = LOG_LEVELS[level]
  }
}

module.exports = { createLogger, setLevel }
