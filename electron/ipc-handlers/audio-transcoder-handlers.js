const { ipcMain } = require('electron')
const { AudioTranscoder, detectUnsupportedAudio } = require('../services/audio-transcoder')

const transcoder = new AudioTranscoder()

function registerAudioTranscoderHandlers() {
  ipcMain.handle('audio-transcoder:detect', async (event, filePath) => {
    return detectUnsupportedAudio(filePath)
  })

  ipcMain.handle('audio-transcoder:start', async (event, filePath) => {
    return transcoder.start(filePath)
  })

  ipcMain.handle('audio-transcoder:stop', (event, key) => {
    transcoder.stop(key)
    return true
  })
}

module.exports = { registerAudioTranscoderHandlers }
