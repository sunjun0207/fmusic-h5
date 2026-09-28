export type TabId = 'home' | 'search' | 'favorite' | 'download' | 'setting'

export type Screen =
  | { name: 'tabs'; tab: TabId }
  | { name: 'musicDetail'; music: MusicItem }

export type MusicItem = {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  albumId?: string
  image?: string
  fileInfo?: string
  lrc?: string
}

export type LyricLine = {
  time: number
  lineLyric: string
}

export type UpdateInfo = {
  version: string
  version_code: number
  content: string
  type: string
  url: string
  create_time: string
}

export type NotificationInfo = {
  title: string
  content: string
  type: string
  target: string
  create_time: string
}

export type DownloadTask = {
  id: string
  mid: string
  title: string
  artist: string
  quality: string
  url: string
  status: 'pending' | 'ready' | 'opened' | 'failed'
  createdAt: number
  image?: string
}

export type AppSettings = {
  quality: string
  showNotification: boolean
}

export type PlayMeta = {
  url: string
  format: string
  bitrate: string
}

export type QualityOption = {
  id: string
  label: string
  format: string
  br: string
}
