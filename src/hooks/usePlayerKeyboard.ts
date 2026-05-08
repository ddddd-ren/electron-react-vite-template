import { useEffect } from 'react'
import { SKIP_TIME, SPEED_BOOST, KEYBOARD_LONG_PRESS_MS } from '../constants'

interface KeyboardDeps {
  togglePlay: () => void
  toggleFullscreen: () => void
  speedStep: (dir: number) => void
  setSpeed: (rate: number) => void
  setVolume: React.Dispatch<React.SetStateAction<number>>
  goBack: () => void
  playNextEpisode: () => void
  playPrevEpisode: () => void
  beginSpeedBoost: () => void
  endSpeedBoost: (wasLongPress: boolean) => void
  showToast: (msg: string) => void
  videoRef: React.RefObject<HTMLVideoElement | null>
  showSpeedMenu: boolean
  showAspectMenu: boolean
  isSpeedBoost: boolean
}

export function usePlayerKeyboard(deps: KeyboardDeps) {
  const {
    togglePlay, toggleFullscreen, speedStep, setSpeed, setVolume, goBack,
    playNextEpisode, playPrevEpisode, beginSpeedBoost, endSpeedBoost, showToast,
    videoRef, showSpeedMenu, showAspectMenu, isSpeedBoost,
  } = deps

  useEffect(() => {
    const pressedKeys = new Set<string>()
    const keyTimers: Record<string, NodeJS.Timeout> = {}

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      pressedKeys.add(e.key)
      const video = videoRef.current
      if (!video) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault(); togglePlay(); break
        case 'ArrowRight':
          e.preventDefault()
          keyTimers['ArrowRight'] = setTimeout(() => {
            if (pressedKeys.has('ArrowRight')) beginSpeedBoost()
          }, KEYBOARD_LONG_PRESS_MS)
          break
        case 'ArrowLeft':
          e.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - SKIP_TIME)
          showToast(`-${SKIP_TIME}s`)
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(v => { const nv = Math.min(1, v + 0.1); video.volume = nv; return nv })
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(v => { const nv = Math.max(0, v - 0.1); video.volume = nv; return nv })
          break
        case 'f': e.preventDefault(); toggleFullscreen(); break
        case 'Escape':
          if (document.fullscreenElement) document.exitFullscreen()
          else goBack()
          break
        case 'x': case 'X': e.preventDefault(); speedStep(1); break
        case 'z': case 'Z': e.preventDefault(); speedStep(-1); break
        case '1': setSpeed(1.0); break
        case '2': setSpeed(2.0); break
        case '3': setSpeed(3.0); break
        case 'n': case 'N': e.preventDefault(); playNextEpisode(); break
        case 'p': case 'P': e.preventDefault(); playPrevEpisode(); break
        case 'm': case 'M':
          e.preventDefault()
          setVolume(v => { const nv = v > 0 ? 0 : 1; video.volume = nv; return nv })
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.delete(e.key)
      if (e.key === 'ArrowRight') {
        if (keyTimers['ArrowRight']) {
          clearTimeout(keyTimers['ArrowRight'])
          delete keyTimers['ArrowRight']
        }
        endSpeedBoost(isSpeedBoost)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      Object.values(keyTimers).forEach(clearTimeout)
    }
  }, [togglePlay, toggleFullscreen, speedStep, setSpeed, setVolume, goBack,
    playNextEpisode, playPrevEpisode, beginSpeedBoost, endSpeedBoost, showToast,
    videoRef, showSpeedMenu, showAspectMenu, isSpeedBoost])
}
