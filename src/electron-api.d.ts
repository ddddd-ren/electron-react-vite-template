import type { BangumiCalendarItem, BangumiItem } from './types/bangumi'
import type { DownloadRecord, DownloadEpisode, DownloadRequest } from './types/download'
import type { SourceResult, SearchResult, DetailData } from './types/scraper'

interface LocalFile {
  name: string
  path: string
  ext: string
  size: number
  mtime: number
}

interface SubtitleFile {
  label: string
  path: string
  content: string
  ext: string
}

interface ProgressData {
  position: number
  duration: number
  updated_at?: number
}

interface DownloadProgressEvent {
  recordKey: string
  episodeNumber: number
  episode: DownloadEpisode
  speed: number
}

interface VersionInfo {
  version: string
  date: string
  changes: string[]
}

interface Window {
  electronAPI: {
    minimize: () => void
    maximize: () => void
    close: () => void
    openFiles: () => Promise<string[]>
    openFolder: () => Promise<string | null>
    readDir: (dirPath: string) => Promise<{ files: LocalFile[]; error: string | null }>
    getSubtitles: (videoPath: string) => Promise<SubtitleFile[]>
    getProgress: (mediaId: string) => Promise<ProgressData>
    setProgress: (mediaId: string, progress: ProgressData) => Promise<boolean>
    getSettings: () => Promise<Record<string, any>>
    setSettings: (settings: Record<string, any>) => Promise<boolean>
    bangumiGetCalendar: () => Promise<BangumiCalendarItem[]>
    bangumiGetUsername: (token: string) => Promise<string | null>
    bangumiGetTrending: () => Promise<BangumiItem[]>
    downloadEnqueue: (request: DownloadRequest) => Promise<boolean>
    downloadEnqueuePriority: (request: DownloadRequest) => Promise<boolean>
    downloadPause: (recordKey: string, episodeNumber: number) => Promise<boolean>
    downloadResume: (request: DownloadRequest) => Promise<boolean>
    downloadCancel: (recordKey: string, episodeNumber: number) => Promise<boolean>
    downloadGetRecords: () => Promise<DownloadRecord[]>
    downloadDeleteEpisode: (bangumiId: number, pluginName: string, episodeNumber: number) => Promise<boolean>
    downloadDeleteRecord: (bangumiId: number, pluginName: string) => Promise<boolean>
    downloadGetLocalPath: (episode: DownloadEpisode) => Promise<string | null>
    downloadGetSpeed: (recordKey: string, episodeNumber: number) => Promise<number>
    downloadOnProgress: (callback: (data: DownloadProgressEvent) => void) => () => void
    webdavInit: (config: { url: string; username: string; password: string }) => Promise<boolean>
    webdavSyncHistory: () => Promise<boolean>
    webdavSyncCollectibles: () => Promise<boolean>
    webdavUpdateHistory: () => Promise<boolean>
    webdavUpdateCollectibles: () => Promise<boolean>
    proxySet: (config: { protocol: string; host: string; port: number }) => Promise<boolean>
    proxyClear: () => Promise<boolean>
    proxyGet: () => Promise<{ protocol: string; host: string; port: number } | null>
    scraperFetchHome: () => Promise<{ success: boolean; results?: SourceResult[]; error?: string }>
    scraperSearch: (keyword: string) => Promise<{ success: boolean; items?: SearchResult[]; error?: string }>
    scraperFetchDetail: (url: string) => Promise<{ success: boolean } & Partial<DetailData> & { error?: string }>
    scraperFetchPlayUrl: (episodeUrl: string) => Promise<{ success: boolean; url?: string; error?: string }>
    scraperGetSources: () => Promise<any[]>
    scraperSaveSources: (sources: any[]) => Promise<boolean>
    scraperResetSources: () => Promise<any[]>
    audioTranscoderDetect: (filePath: string) => Promise<{ codec: string; unsupported: boolean }>
    audioTranscoderStart: (filePath: string) => Promise<{ success: boolean; url?: string; port?: number; error?: string }>
    audioTranscoderStop: (key: string) => Promise<boolean>
    getVersionInfo: () => Promise<{ currentVersion: string; versionHistory: VersionInfo[] }>
    onShowUpdateDialog: (callback: (data: { currentVersion: string; history: VersionInfo[] }) => void) => () => void
  }
}
