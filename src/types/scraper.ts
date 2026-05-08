import type { Episode } from './common'

export interface HomeItem {
  title: string
  url: string
  cover: string
  tag: string
  episode: string
}

export interface HomeSection {
  title: string
  moreUrl: string
  items: HomeItem[]
}

export interface SourceResult {
  sourceName: string
  sourceUrl: string
  sections: HomeSection[]
}

export interface SearchResult {
  title: string
  url: string
  cover: string
  tag: string
  episode: string
  sourceName?: string
}

export interface RoadData {
  name: string
  episodes: Episode[]
}

export interface DetailData {
  title: string
  cover: string
  desc: string
  roads: RoadData[]
}
