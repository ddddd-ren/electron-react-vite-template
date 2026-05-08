import { create } from 'zustand'
import type { Page, MediaItem } from '../types/common'
import { MAX_RECENT_PLAY } from '../constants'


interface StoreState {
  // 页面
  currentPage: Page
  pageHistory: Page[]
  setPage: (page: Page) => void

  // 播放
  currentMedia: MediaItem | null
  playMedia: (media: MediaItem) => void
  goBack: () => void

  // 搜索
  searchQuery: string
  setSearchQuery: (q: string) => void
  searchResults: MediaItem[]
  setSearchResults: (items: MediaItem[]) => void
  isSearching: boolean
  setIsSearching: (v: boolean) => void

  // 本地库
  localFolders: string[]
  _foldersLoaded: boolean
  _loadFolders: () => Promise<void>
  _saveFolders: () => Promise<void>
  _recentLoaded: boolean
  _loadRecent: () => Promise<void>
  _saveRecent: () => Promise<void>
  addLocalFolder: (folder: string) => void
  removeLocalFolder: (folder: string) => void
  localFiles: MediaItem[]
  setLocalFiles: (files: MediaItem[]) => void

  // 最近播放
  recentPlay: MediaItem[]
  addRecentPlay: (media: MediaItem) => void

  // 侧边栏
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useStore = create<StoreState>((set, get) => ({
  // 页面
  currentPage: 'home',
  pageHistory: [],
  setPage: (page) => {
    const current = get().currentPage
    if (current !== page) {
      const history = get().pageHistory
      set({ pageHistory: [...history, current], currentPage: page })
    }
  },

  // 播放
  currentMedia: null,
  playMedia: (media) => {
    const current = get().currentPage
    const history = get().pageHistory
    set({ currentMedia: media, currentPage: 'player', pageHistory: [...history, current] })
    // 添加到最近播放
    const recent = get().recentPlay.filter(r => r.id !== media.id)
    set({ recentPlay: [media, ...recent].slice(0, MAX_RECENT_PLAY) })
    get()._saveRecent()
  },
  goBack: () => {
    const history = get().pageHistory
    if (history.length > 0) {
      const prev = history[history.length - 1]
      set({ currentPage: prev, pageHistory: history.slice(0, -1) })
    } else {
      set({ currentPage: 'home' })
    }
  },

  // 搜索
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  searchResults: [],
  setSearchResults: (items) => set({ searchResults: items }),
  isSearching: false,
  setIsSearching: (v) => set({ isSearching: v }),

  // 本地库
  localFolders: [],
  _foldersLoaded: false,
  _loadFolders: async () => {
    if (get()._foldersLoaded) return
    const isElectron = !!window.electronAPI
    if (isElectron) {
      try {
        const s = await window.electronAPI.getSettings()
        if (s?.localFolders?.length) {
          set({ localFolders: s.localFolders, _foldersLoaded: true })
        } else {
          set({ _foldersLoaded: true })
        }
      } catch (e) {
        console.error('Failed to load folders:', e)
        set({ _foldersLoaded: true })
      }
    }
  },
  _saveFolders: async () => {
    const isElectron = !!window.electronAPI
    if (isElectron) {
      try {
        const s = await window.electronAPI.getSettings()
        await window.electronAPI.setSettings({ ...s, localFolders: get().localFolders })
      } catch (e) {
        console.error('Failed to save folders:', e)
      }
    }
  },
  addLocalFolder: (folder) => {
    const folders = get().localFolders
    if (!folders.includes(folder)) {
      set({ localFolders: [...folders, folder] })
      get()._saveFolders()
    }
  },
  removeLocalFolder: (folder) => {
    set({ localFolders: get().localFolders.filter(f => f !== folder) })
    get()._saveFolders()
  },
  localFiles: [],
  setLocalFiles: (files) => set({ localFiles: files }),

  // 最近播放
  recentPlay: [],
  _recentLoaded: false,
  _loadRecent: async () => {
    if (get()._recentLoaded) return
    const isElectron = !!window.electronAPI
    if (isElectron) {
      try {
        const s = await window.electronAPI.getSettings()
        if (s?.recentPlay?.length) set({ recentPlay: s.recentPlay, _recentLoaded: true })
        else set({ _recentLoaded: true })
      } catch (e) { console.error('Failed to load recent:', e); set({ _recentLoaded: true }) }
    }
  },
  _saveRecent: async () => {
    const isElectron = !!window.electronAPI
    if (isElectron) {
      try {
        const s = await window.electronAPI.getSettings()
        await window.electronAPI.setSettings({ ...s, recentPlay: get().recentPlay })
      } catch (e) {
        console.error('Failed to save recent:', e)
      }
    }
  },
  addRecentPlay: (media) => {
    const recent = get().recentPlay.filter(r => r.id !== media.id)
    set({ recentPlay: [media, ...recent].slice(0, MAX_RECENT_PLAY) })
    get()._saveRecent()
  },

  // 侧边栏
  sidebarCollapsed: false,
  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
}))
