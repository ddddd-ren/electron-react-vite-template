import { create } from 'zustand'
import type { SourceResult, SearchResult, DetailData } from '../types/scraper'
import type { Episode } from '../types/common'
import { useStore } from './useStore'

type View = 'home' | 'search' | 'detail'

interface ScraperStore {
  view: View
  loading: boolean
  error: string
  sourceResults: SourceResult[]
  enabledSources: Set<string>
  searchResults: SearchResult[]
  detail: DetailData | null
  selectedRoad: number

  setView: (view: View) => void
  toggleSource: (name: string) => void
  setSelectedRoad: (road: number) => void
  loadHome: () => Promise<void>
  search: (keyword: string) => Promise<void>
  openDetail: (url: string) => Promise<void>
  handlePlay: (ep: Episode) => Promise<void>
}

const api = () => window.electronAPI

export const useScraperStore = create<ScraperStore>((set, get) => ({
  view: 'home',
  loading: false,
  error: '',
  sourceResults: [],
  enabledSources: new Set<string>(),
  searchResults: [],
  detail: null,
  selectedRoad: 0,

  setView: (view) => set({ view }),
  toggleSource: (name) => set((s) => {
    const next = new Set(s.enabledSources)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    return { enabledSources: next }
  }),
  setSelectedRoad: (road) => set({ selectedRoad: road }),

  loadHome: async () => {
    set({ loading: true, error: '' })
    try {
      const resp = await api().scraperFetchHome()
      if (resp.success) {
        const results = resp.results || []
        set({
          sourceResults: results,
          enabledSources: new Set(results.map((r: SourceResult) => r.sourceName)),
        })
      } else {
        set({ error: resp.error || '加载失败' })
      }
    } catch (e: any) {
      set({ error: e.message })
    }
    set({ loading: false })
  },

  search: async (keyword: string) => {
    if (!keyword) return
    set({ loading: true, error: '', view: 'search' })
    try {
      const resp = await api().scraperSearch(keyword)
      if (resp.success) {
        set({ searchResults: resp.items })
      } else {
        set({ error: resp.error || '搜索失败' })
      }
    } catch (e: any) {
      set({ error: e.message })
    }
    set({ loading: false })
  },

  openDetail: async (url: string) => {
    set({ loading: true, error: '', view: 'detail' })
    try {
      const resp = await api().scraperFetchDetail(url)
      if (resp.success) {
        set({ detail: resp, selectedRoad: 0 })
      } else {
        set({ error: resp.error || '加载详情失败' })
      }
    } catch (e: any) {
      set({ error: e.message })
    }
    set({ loading: false })
  },

  handlePlay: async (ep: Episode) => {
    const { detail, selectedRoad } = get()
    set({ loading: true })
    try {
      const resp = await api().scraperFetchPlayUrl(ep.url)
      if (resp.success && resp.url) {
        const road = detail?.roads[selectedRoad]
        const episodes = road?.episodes || []
        useStore.getState().playMedia({
          id: ep.url,
          title: detail?.title || ep.name,
          source: 'scraper',
          path: resp.url,
          cover: detail?.cover,
          episodes,
        })
      } else {
        set({ error: resp.error || '获取播放地址失败' })
      }
    } catch (e: any) {
      set({ error: e.message })
    }
    set({ loading: false })
  },
}))
