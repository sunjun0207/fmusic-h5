export type TabId = 'home' | 'discover' | 'charts' | 'community' | 'mine'

/** 叠在标签页上的二级页面，返回时逐层退出。 */
export type View =
  | { kind: 'search' }
  | { kind: 'chart'; id: string; name: string; pic?: string }
  | { kind: 'playlist'; id: string; name?: string; pic?: string }
  | { kind: 'pick'; id: string }
  | { kind: 'artist'; id: string; name: string; pic?: string }
  | { kind: 'daily' }
  | { kind: 'private' }
  | { kind: 'radio' }
  | { kind: 'myPlaylist'; id: string }
  | { kind: 'favorite' }
  | { kind: 'recent' }
  | { kind: 'download' }
  | { kind: 'setting' }

export type MusicItem = {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  albumId?: string
  image?: string
  artistImage?: string
  hasMv?: boolean
  mvPic?: string
  mvQualities?: string[]
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
  posterSize: number
  mvQuality: string
  showNotification: boolean
  showDanmaku: boolean
}

export type SongComment = {
  id: string
  name: string
  avatar: string
  text: string
  time: string
  likes: number
  replies: SongComment[]
}

export type PlayMode = 'list' | 'single' | 'shuffle'

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

export type ChartInfo = {
  id: string
  name: string
  intro: string
  pic: string
  pub: string
}

export type ChartGroup = {
  name: string
  list: ChartInfo[]
}

export type Trend = {
  dir: 'up' | 'down' | 'same' | 'new'
  change: number
}

export type ChartSongs = {
  list: MusicItem[]
  trends: Record<string, Trend>
  total: number
  pub: string
}

export type PlaylistCard = {
  id: string
  name: string
  pic: string
  playCount: number
  total: number
  creator: string
}

export type PlaylistDetail = PlaylistCard & {
  info: string
  tags: string[]
  songs: MusicItem[]
}

export type ArtistCard = {
  id: string
  name: string
  pic: string
  fans: number
  songCount: number
}

export type MyPlaylist = {
  id: string
  name: string
  createdAt: number
  songs: MusicItem[]
}

export type HotComment = {
  song: MusicItem
  comments: SongComment[]
}
