import { create } from 'zustand'
import type { BangumiItem, BangumiCalendarItem } from '../types/bangumi'
import { MAX_TRENDING } from '../constants'

interface BangumiStore {
  accessToken: string
  username: string
  isLoggedIn: boolean
  error: string

  calendar: BangumiCalendarItem[]
  isLoadingCalendar: boolean

  trending: BangumiItem[]
  isLoadingTrending: boolean

  setAccessToken: (token: string) => Promise<boolean>
  fetchCalendar: () => Promise<void>
  fetchTrending: () => Promise<void>
  clearError: () => void
}

export const useBangumiStore = create<BangumiStore>((set) => ({
  accessToken: '',
  username: '',
  isLoggedIn: false,
  error: '',

  calendar: [],
  isLoadingCalendar: false,

  trending: [],
  isLoadingTrending: false,

  setAccessToken: async (token: string) => {
    try {
      const username = await window.electronAPI.bangumiGetUsername(token)
      if (username) {
        set({ accessToken: token, username, isLoggedIn: true })
        return true
      }
      return false
    } catch (e) {
      console.error('Bangumi login failed:', e)
      return false
    }
  },

  fetchCalendar: async () => {
    set({ isLoadingCalendar: true })
    try {
      const data = await window.electronAPI.bangumiGetCalendar()
      set({ calendar: data || [] })
    } catch (e) {
      console.error('Failed to fetch calendar:', e)
      set({ error: '获取新番日历失败' })
    } finally {
      set({ isLoadingCalendar: false })
    }
  },

  fetchTrending: async () => {
    set({ isLoadingTrending: true })
    try {
      const data = await window.electronAPI.bangumiGetTrending()
      set({ trending: Array.isArray(data) ? data.slice(0, MAX_TRENDING) : [] })
    } catch (e) {
      console.error('Failed to get trending:', e)
      set({ error: '获取热门番剧失败' })
    } finally {
      set({ isLoadingTrending: false })
    }
  },

  clearError: () => set({ error: '' }),
}))
