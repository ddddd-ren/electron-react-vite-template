import { useState, useRef, useEffect, useCallback } from 'react'
import Hls from 'hls.js'
import type { MediaItem, Episode } from '../types/common'
import { useStore } from '../store/useStore'
import { SPEED_LIST, SPEED_BOOST, SKIP_TIME, TOAST_DURATION, PROGRESS_SAVE_INTERVAL } from '../constants'

export function useVideoPlayer(media: MediaItem | null, transcodeUrl: string | null, audioChecking: boolean) {
  const { goBack, playMedia } = useStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<NodeJS.Timeout>()
  const hlsRef = useRef<Hls | null>(null)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [buffered, setBuffered] = useState(0)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [aspectMode, setAspectMode] = useState(0)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [showAspectMenu, setShowAspectMenu] = useState(false)
  const [showEpisodePanel, setShowEpisodePanel] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<NodeJS.Timeout>()
  const [isSpeedBoost, setIsSpeedBoost] = useState(false)
  const normalSpeedRef = useRef(1.0)

  const isElectron = !!window.electronAPI

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION)
  }, [])

  const getVideoUrl = useCallback(() => {
    if (transcodeUrl) return transcodeUrl
    if (!media) return ''
    if (media.source === 'local') {
      const normalized = media.path.replace(/\\/g, '/')
      return new URL(`file:///${normalized}`).href.replace(/^file:\/\//, 'local-file://')
    }
    return media.path
  }, [transcodeUrl, media])

  const formatTime = useCallback((s: number) => {
    if (!s || isNaN(s)) return '00:00'
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = Math.floor(s % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }, [])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) { video.play(); setPlaying(true) }
    else { video.pause(); setPlaying(false) }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (document.fullscreenElement) document.exitFullscreen()
    else containerRef.current.requestFullscreen()
  }, [])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (transcodeUrl && videoRef.current) {
      videoRef.current.src = transcodeUrl
      videoRef.current.load()
    }
  }, [transcodeUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !media) return
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    const url = getVideoUrl()
    if (!url) return
    const isHls = url.includes('.m3u8') || url.includes('m3u8')
    setError(null)
    setPlaybackRate(1.0)
    normalSpeedRef.current = 1.0
    video.playbackRate = 1.0

    if (isHls && Hls.isSupported()) {
      const pluginHeaders = media.headers || {}
      const hlsConfig: any = { maxBufferLength: 30, maxMaxBufferLength: 60 }
      if (Object.keys(pluginHeaders).length > 0) {
        hlsConfig.xhrSetup = (xhr: XMLHttpRequest) => {
          for (const [key, value] of Object.entries(pluginHeaders)) xhr.setRequestHeader(key, value as string)
        }
      }
      const hls = new Hls(hlsConfig)
      hlsRef.current = hls
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.volume = volume })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
          else { setError('视频流加载失败: ' + (data.details || data.type)); hls.destroy() }
        }
      })
    } else if (isHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
    }
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null } }
  }, [media?.path, media?.id])

  useEffect(() => {
    if (!media) return
    if (videoRef.current) videoRef.current.volume = volume
    if (isElectron) {
      (async () => {
        const progress = await window.electronAPI.getProgress(media.id)
        if (progress && progress.position > 0 && videoRef.current) videoRef.current.currentTime = progress.position
      })()
    }
  }, [media])

  useEffect(() => {
    if (!media || !isElectron) return
    const interval = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        window.electronAPI.setProgress(media.id, {
          position: videoRef.current.currentTime,
          duration: videoRef.current.duration,
        })
      }
    }, PROGRESS_SAVE_INTERVAL)
    return () => clearInterval(interval)
  }, [media])

  const setSpeed = useCallback((rate: number) => {
    const video = videoRef.current
    if (!video) return
    const clamped = Math.max(0.25, Math.min(3.0, rate))
    video.playbackRate = clamped
    setPlaybackRate(clamped)
    normalSpeedRef.current = clamped
    showToast(`${clamped}x`)
  }, [showToast])

  const speedStep = useCallback((direction: number) => {
    const idx = SPEED_LIST.indexOf(playbackRate)
    const nextIdx = idx === -1
      ? (direction > 0 ? SPEED_LIST.findIndex(s => s > playbackRate) : SPEED_LIST.length - 1 - [...SPEED_LIST].reverse().findIndex(s => s < playbackRate))
      : idx + direction
    if (nextIdx >= 0 && nextIdx < SPEED_LIST.length) setSpeed(SPEED_LIST[nextIdx])
    else showToast(direction > 0 ? '已是最高速' : '已是最低速')
  }, [playbackRate, setSpeed, showToast])

  const playNextEpisode = useCallback(() => {
    if (!media?.episodes || media.episodes.length === 0) return
    const currentIdx = media.episodes.findIndex(ep => ep.url === media.id)
    if (currentIdx >= 0 && currentIdx < media.episodes.length - 1) {
      const next = media.episodes[currentIdx + 1]
      playMedia({ ...media, id: next.url, title: `${media.title} - ${next.name}`, path: next.url })
    }
  }, [media, playMedia])

  const playPrevEpisode = useCallback(() => {
    if (!media?.episodes || media.episodes.length === 0) return
    const currentIdx = media.episodes.findIndex(ep => ep.url === media.id)
    if (currentIdx > 0) {
      const prev = media.episodes[currentIdx - 1]
      playMedia({ ...media, id: prev.url, title: `${media.title} - ${prev.name}`, path: prev.url })
    }
  }, [media, playMedia])

  const playEpisode = useCallback((ep: Episode) => {
    if (!media) return
    playMedia({ ...media, id: ep.url, title: `${media.title} - ${ep.name}`, path: ep.url })
  }, [media, playMedia])

  const handleProgressClick = useCallback((e: React.MouseEvent) => {
    if (!progressRef.current || !videoRef.current) return
    const rect = progressRef.current.getBoundingClientRect()
    videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }, [duration])

  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => { if (playing) setShowControls(false) }, 3000)
  }, [playing])

  const beginSpeedBoost = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    normalSpeedRef.current = video.playbackRate
    video.playbackRate = SPEED_BOOST
    setIsSpeedBoost(true)
    showToast(`${SPEED_BOOST}x →`)
  }, [showToast])

  const endSpeedBoost = useCallback((wasLongPress: boolean) => {
    if (wasLongPress && videoRef.current) {
      videoRef.current.playbackRate = normalSpeedRef.current
      setIsSpeedBoost(false)
    } else if (!wasLongPress) {
      const video = videoRef.current
      if (video) {
        video.currentTime = Math.min(video.duration, video.currentTime + SKIP_TIME)
        showToast(`+${SKIP_TIME}s`)
      }
    }
  }, [showToast])

  return {
    videoRef, containerRef, progressRef,
    playing, setPlaying, currentTime, setCurrentTime, duration, setDuration,
    volume, setVolume, showControls, setShowControls, isFullscreen,
    buffered, setBuffered, showVolumeSlider, setShowVolumeSlider,
    isLoading, setIsLoading, error, setError,
    playbackRate, aspectMode, setAspectMode,
    showSpeedMenu, setShowSpeedMenu, showAspectMenu, setShowAspectMenu,
    showEpisodePanel, setShowEpisodePanel,
    toast, isSpeedBoost, setIsSpeedBoost,
    isElectron, showToast, getVideoUrl, formatTime,
    goBack, togglePlay, toggleFullscreen,
    setSpeed, speedStep, playNextEpisode, playPrevEpisode, playEpisode,
    handleProgressClick, handleMouseMove, beginSpeedBoost, endSpeedBoost,
  }
}
