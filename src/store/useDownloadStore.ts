import { create } from 'zustand'
import type { DownloadRecord, DownloadRequest, DownloadEpisode, DownloadTaskState } from '../types/download'

interface DownloadStore {
  records: DownloadRecord[]
  activeDownloads: Map<string, DownloadTaskState>
  isLoading: boolean

  loadRecords: () => Promise<void>
  enqueue: (request: DownloadRequest) => Promise<void>
  enqueuePriority: (request: DownloadRequest) => Promise<void>
  pause: (recordKey: string, episodeNumber: number) => void
  resume: (request: DownloadRequest) => Promise<void>
  cancel: (recordKey: string, episodeNumber: number) => void
  getLocalPath: (episode: DownloadEpisode) => Promise<string | null>
  deleteEpisode: (bangumiId: number, pluginName: string, episodeNumber: number) => Promise<void>
  deleteRecord: (bangumiId: number, pluginName: string) => Promise<void>
  getSpeed: (recordKey: string, episodeNumber: number) => Promise<number>
  updateProgress: (recordKey: string, episodeNumber: number, episode: DownloadEpisode, speed: number) => void
  subscribeProgress: () => (() => void) | undefined
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  records: [],
  activeDownloads: new Map(),
  isLoading: false,

  loadRecords: async () => {
    set({ isLoading: true })
    try {
      const records = await window.electronAPI.downloadGetRecords()
      set({ records: records || [] })
    } catch (e) {
      console.error('Failed to load download records:', e)
    } finally {
      set({ isLoading: false })
    }
  },

  enqueue: async (request: DownloadRequest) => {
    try {
      await window.electronAPI.downloadEnqueue(request)
      await get().loadRecords()
    } catch (e) {
      console.error('Failed to enqueue download:', e)
    }
  },

  enqueuePriority: async (request: DownloadRequest) => {
    try {
      await window.electronAPI.downloadEnqueuePriority(request)
      await get().loadRecords()
    } catch (e) {
      console.error('Failed to enqueue priority download:', e)
    }
  },

  pause: (recordKey: string, episodeNumber: number) => {
    window.electronAPI.downloadPause(recordKey, episodeNumber)
    const key = `${recordKey}_${episodeNumber}`
    const active = new Map(get().activeDownloads)
    const task = active.get(key)
    if (task) {
      active.set(key, { ...task, isPaused: true })
      set({ activeDownloads: active })
    }
  },

  resume: async (request: DownloadRequest) => {
    try {
      await window.electronAPI.downloadResume(request)
    } catch (e) {
      console.error('Failed to resume download:', e)
    }
  },

  cancel: (recordKey: string, episodeNumber: number) => {
    window.electronAPI.downloadCancel(recordKey, episodeNumber)
    const key = `${recordKey}_${episodeNumber}`
    const active = new Map(get().activeDownloads)
    active.delete(key)
    set({ activeDownloads: active })
  },

  getLocalPath: async (episode: DownloadEpisode) => {
    try {
      return await window.electronAPI.downloadGetLocalPath(episode)
    } catch {
      return null
    }
  },

  deleteEpisode: async (bangumiId: number, pluginName: string, episodeNumber: number) => {
    try {
      await window.electronAPI.downloadDeleteEpisode(bangumiId, pluginName, episodeNumber)
      await get().loadRecords()
    } catch (e) {
      console.error('Failed to delete episode:', e)
    }
  },

  deleteRecord: async (bangumiId: number, pluginName: string) => {
    try {
      await window.electronAPI.downloadDeleteRecord(bangumiId, pluginName)
      await get().loadRecords()
    } catch (e) {
      console.error('Failed to delete record:', e)
    }
  },

  getSpeed: async (recordKey: string, episodeNumber: number) => {
    try {
      return await window.electronAPI.downloadGetSpeed(recordKey, episodeNumber)
    } catch {
      return 0
    }
  },

  updateProgress: (recordKey: string, episodeNumber: number, episode: DownloadEpisode, speed: number) => {
    const key = `${recordKey}_${episodeNumber}`
    const active = new Map(get().activeDownloads)
    active.set(key, {
      recordKey,
      episodeNumber,
      isPaused: episode.status === 'paused',
      speed,
    })
    set({ activeDownloads: active })

    // Update records
    const records = [...get().records]
    const recordIdx = records.findIndex(r => `${r.bangumiId}_${r.pluginName}` === recordKey)
    if (recordIdx >= 0) {
      records[recordIdx] = {
        ...records[recordIdx],
        episodes: {
          ...records[recordIdx].episodes,
          [episodeNumber]: episode,
        },
      }
      set({ records })
    }
  },

  subscribeProgress: () => {
    if (!window.electronAPI?.downloadOnProgress) return
    return window.electronAPI.downloadOnProgress((data: { recordKey: string; episodeNumber: number; episode: DownloadEpisode; speed: number }) => {
      get().updateProgress(data.recordKey, data.episodeNumber, data.episode, data.speed)
    })
  },
}))
