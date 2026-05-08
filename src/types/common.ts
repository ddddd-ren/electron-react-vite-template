export interface MediaItem {
  id: string
  title: string
  source: 'local' | 'bangumi' | 'scraper'
  path: string
  cover?: string
  year?: string
  series?: string
  episodes?: Episode[]
  pluginName?: string
  bangumiId?: number
  headers?: Record<string, string>
}

export interface Episode {
  name: string
  url: string
}

export type Page = 'home' | 'library' | 'player' | 'settings' | 'download' | 'source'
