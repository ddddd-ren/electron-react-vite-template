export enum DownloadStatus {
  pending = 'pending',
  downloading = 'downloading',
  paused = 'paused',
  completed = 'completed',
  failed = 'failed',
}

export interface DownloadEpisode {
  status: DownloadStatus
  networkM3u8Url: string
  localM3u8Path: string
  downloadDirectory: string
  totalSegments: number
  downloadedSegments: number
  progressPercent: number
  totalBytes: number
  errorMessage: string
  completedAt: Date | null
}

export interface DownloadRecord {
  bangumiId: number
  pluginName: string
  bangumiName: string
  cover: string
  episodes: Record<number, DownloadEpisode>
}

export interface DownloadRequest {
  recordKey: string
  bangumiId: number
  pluginName: string
  bangumiName: string
  cover: string
  episodeNumber: number
  m3u8Url: string
  httpHeaders: Record<string, string>
  adBlockerEnabled: boolean
}

export interface DownloadTaskState {
  recordKey: string
  episodeNumber: number
  isPaused: boolean
  speed: number
}
