import { useState, useEffect, useRef } from 'react'
import type { MediaItem } from '../types/common'

export interface SubtitleTrack {
  label: string
  url: string
  blobUrl: string
}

function toVtt(content: string, ext: string): string {
  if (ext === '.vtt') return content.startsWith('WEBVTT') ? content : 'WEBVTT\n\n' + content
  if (ext === '.srt') {
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    let vtt = 'WEBVTT\n\n'
    for (const line of lines) {
      if (line.includes('-->')) vtt += line.replace(/,/g, '.') + '\n'
      else vtt += line + '\n'
    }
    return vtt
  }
  if (ext === '.ass' || ext === '.ssa') {
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    let vtt = 'WEBVTT\n\n'
    const toVttTime = (t: string) => {
      const m = t.match(/(\d+):(\d+):(\d+)\.(\d+)/)
      if (!m) return t
      return `${m[1]}:${m[2]}:${m[3]}.${m[4].padEnd(3, '0').slice(0, 3)}`
    }
    for (const line of lines) {
      if (line.startsWith('Dialogue:')) {
        const commaIdx = line.indexOf(',')
        const afterLayer = line.slice(commaIdx + 1)
        const parts = afterLayer.split(',')
        if (parts.length >= 9) {
          const start = parts[0].trim()
          const end = parts[1].trim()
          const text = parts.slice(8).join(',').replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n').replace(/\\n/g, '\n').replace(/\\h/g, ' ').trim()
          if (text) vtt += `${toVttTime(start)} --> ${toVttTime(end)}\n${text}\n\n`
        }
      }
    }
    return vtt
  }
  return content
}

export function useSubtitles(media: MediaItem | null) {
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([])
  const [activeSubIdx, setActiveSubIdx] = useState<number>(-1)
  const tracksRef = useRef<SubtitleTrack[]>([])
  const isElectron = !!window.electronAPI

  useEffect(() => {
    tracksRef.current.forEach(s => URL.revokeObjectURL(s.blobUrl))
    tracksRef.current = []
    setSubtitles([])
    setActiveSubIdx(-1)
    if (!media || media.source !== 'local' || !isElectron) return
    let cancelled = false
    ;(async () => {
      try {
        const files = await window.electronAPI.getSubtitles(media.path)
        if (cancelled || !files?.length) return
        const tracks: SubtitleTrack[] = files.map((f: any) => {
          const vtt = toVtt(f.content, f.ext)
          const blob = new Blob([vtt], { type: 'text/vtt' })
          return { label: f.label, url: f.path, blobUrl: URL.createObjectURL(blob) }
        })
        tracksRef.current = tracks
        setSubtitles(tracks)
        if (tracks.length > 0) setActiveSubIdx(0)
      } catch (e) { console.error('Failed to load subtitles:', e) }
    })()
    return () => {
      cancelled = true
      tracksRef.current.forEach(s => URL.revokeObjectURL(s.blobUrl))
      tracksRef.current = []
    }
  }, [media?.path])

  return { subtitles, activeSubIdx, setActiveSubIdx }
}
