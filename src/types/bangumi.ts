export interface BangumiTag {
  name: string
  count: number
  totalCont: number
}

export interface BangumiItem {
  id: number
  type: number
  name: string
  nameCn: string
  summary: string
  airDate: string
  airWeekday: number
  rank: number
  images: Record<string, string>
  tags: BangumiTag[]
  alias: string[]
  ratingScore: number
  votes: number
  votesCount: number
  info: string
}

export enum CollectType {
  None = 0,
  PlanToWatch = 1,
  Watched = 2,
  Watching = 3,
  OnHold = 4,
  Abandoned = 5,
}

export interface BangumiCalendarItem {
  weekday: number
  items: BangumiItem[]
}

export interface BangumiEpisode {
  id: number
  type: number
  name: string
  nameCn: string
  sort: number
  airdate: string
  duration: string
  desc: string
}

export interface BangumiCharacter {
  id: number
  name: string
  nameCn: string
  images: Record<string, string>
  role: string
  actors: { id: number; name: string; nameCn: string }[]
}

export interface BangumiStaff {
  id: number
  name: string
  nameCn: string
  images: Record<string, string>
  jobs: string[]
}
