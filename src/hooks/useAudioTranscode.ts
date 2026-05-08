import { useState, useEffect, useRef } from 'react'
import type { MediaItem } from '../types/common'

export function useAudioTranscode(media: MediaItem | null) {
  const [transcodeUrl, setTranscodeUrl] = useState<string | null>(null)
  const [audioChecking, setAudioChecking] = useState(false)
  const transcodeKeyRef = useRef<string | null>(null)
  const isElectron = !!window.electronAPI

  useEffect(() => {
    if (!media || media.source !== 'local' || !isElectron) {
      setAudioChecking(false)
      return
    }
    const api = window.electronAPI
    let cancelled = false
    setAudioChecking(true)

    ;(async () => {
      try {
        const result = await api.audioTranscoderDetect(media.path)
        if (cancelled) return
        if (result.unsupported) {
          const resp = await api.audioTranscoderStart(media.path)
          if (cancelled || !resp.success) return
          transcodeKeyRef.current = media.path
          setTranscodeUrl(resp.url)
        }
      } catch (e) {
        console.error('[audio-transcode] error:', e)
      } finally {
        if (!cancelled) setAudioChecking(false)
      }
    })()

    return () => {
      cancelled = true
      if (transcodeKeyRef.current) {
        api.audioTranscoderStop(transcodeKeyRef.current)
        transcodeKeyRef.current = null
      }
      setTranscodeUrl(null)
      setAudioChecking(false)
    }
  }, [media?.path, media?.source])

  return { transcodeUrl, audioChecking }
}
