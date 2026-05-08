import { useState, useRef, useEffect, useCallback } from 'react'
import { Anime4KRenderer, Anime4KMode } from '../lib/anime4k'

export function useAnime4k(videoRef: React.RefObject<HTMLVideoElement | null>, showToast: (msg: string) => void) {
  const anime4kRef = useRef<Anime4KRenderer | null>(null)
  const [anime4kEnabled, setAnime4kEnabled] = useState(false)
  const [anime4kMode, setAnime4kMode] = useState<Anime4KMode>('upscale')
  const [showAnime4kMenu, setShowAnime4kMenu] = useState(false)

  useEffect(() => {
    return () => { anime4kRef.current?.destroy(); anime4kRef.current = null }
  }, [])

  const toggleAnime4k = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (!anime4kRef.current) {
      try {
        const renderer = new Anime4KRenderer()
        renderer.init(video)
        renderer.setMode(anime4kMode)
        anime4kRef.current = renderer
      } catch (e) {
        console.error('[Anime4K] init failed:', e)
        showToast('WebGL2 不可用')
        return
      }
    }
    const next = anime4kRef.current.toggle()
    setAnime4kEnabled(next)
    showToast(next ? `Anime4K ${anime4kMode}` : 'Anime4K 关闭')
  }, [anime4kMode, showToast])

  const setAnime4kModeAndSync = useCallback((mode: Anime4KMode) => {
    setAnime4kMode(mode)
    if (anime4kRef.current) anime4kRef.current.setMode(mode)
    setShowAnime4kMenu(false)
    if (anime4kRef.current?.isEnabled()) showToast(`Anime4K ${mode}`)
  }, [showToast])

  return {
    anime4kRef, anime4kEnabled, anime4kMode, showAnime4kMenu,
    setShowAnime4kMenu, toggleAnime4k, setAnime4kModeAndSync,
  }
}
