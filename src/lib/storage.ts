import { isPosterSize, visibleMvQuality } from './quality'
import { cleanArtist, cleanText, normalizeMusic } from './text'
import type { AppSettings, DownloadTask, MusicItem, MyPlaylist, PlayMode, PlaylistCard } from './types'

const KEYS = {
  uid: 'fmusic_uid',
  searchHistory: 'fmusic_search_history',
  downloads: 'fmusic_downloads',
  settings: 'fmusic_settings',
  dismissedNotification: 'fmusic_dismissed_notification',
  recentPlays: 'fmusic_recent_plays',
  favorites: 'fmusic_favorites',
  playMode: 'fmusic_play_mode',
  showLyric: 'fmusic_show_lyric',
  myPlaylists: 'fmusic_my_playlists',
  savedPlaylists: 'fmusic_saved_playlists',
  dailyMix: 'fmusic_daily_mix',
} as const

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getUid(): string {
  let uid = localStorage.getItem(KEYS.uid)
  if (!uid) {
    uid = `h5-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
    localStorage.setItem(KEYS.uid, uid)
  }
  return uid
}

export function getSearchHistory(): string[] {
  return readJson<string[]>(KEYS.searchHistory, [])
}

export function addSearchHistory(keyword: string) {
  const k = keyword.trim()
  if (!k) return
  const list = getSearchHistory().filter((x) => x !== k)
  list.unshift(k)
  writeJson(KEYS.searchHistory, list.slice(0, 30))
}

export function removeSearchHistory(keyword: string) {
  writeJson(
    KEYS.searchHistory,
    getSearchHistory().filter((x) => x !== keyword),
  )
}

export function clearSearchHistory() {
  writeJson(KEYS.searchHistory, [])
}

export function getDownloads(): DownloadTask[] {
  return readJson<DownloadTask[]>(KEYS.downloads, []).map((task) => ({
    ...task,
    title: cleanText(task.title),
    artist: cleanArtist(task.artist),
  }))
}

export function saveDownloads(tasks: DownloadTask[]) {
  writeJson(KEYS.downloads, tasks)
}

export function upsertDownload(task: DownloadTask) {
  const list = getDownloads().filter((t) => t.id !== task.id)
  list.unshift(task)
  saveDownloads(list.slice(0, 100))
}

export function removeDownload(id: string) {
  saveDownloads(getDownloads().filter((t) => t.id !== id))
}

const defaultSettings: AppSettings = {
  quality: '320kmp3',
  posterSize: 1000,
  mvQuality: 'MP4UL',
  showNotification: true,
  showDanmaku: true,
}

export function getSettings(): AppSettings {
  const raw = { ...defaultSettings, ...readJson<Partial<AppSettings>>(KEYS.settings, {}) }
  const posterSize = Number(raw.posterSize)
  return {
    ...raw,
    posterSize: isPosterSize(posterSize) ? posterSize : defaultSettings.posterSize,
    mvQuality: visibleMvQuality(raw.mvQuality),
  }
}

export function saveSettings(patch: Partial<AppSettings>) {
  writeJson(KEYS.settings, { ...getSettings(), ...patch })
}

export function getDismissedNotification(): string | null {
  return localStorage.getItem(KEYS.dismissedNotification)
}

export function setDismissedNotification(key: string) {
  localStorage.setItem(KEYS.dismissedNotification, key)
}

function keepMv(prev: MusicItem | undefined, item: MusicItem): MusicItem {
  if (!prev) return item
  return {
    ...item,
    hasMv: typeof item.hasMv === 'boolean' ? item.hasMv : prev.hasMv,
    mvPic: item.mvPic || prev.mvPic,
    mvQualities: item.mvQualities ?? prev.mvQualities,
  }
}

export function getRecentPlays(): MusicItem[] {
  return readJson<MusicItem[]>(KEYS.recentPlays, []).map(normalizeMusic)
}

export function addRecentPlay(item: MusicItem) {
  const clean = normalizeMusic(item)
  const list = getRecentPlays()
  const prev = list.find((song) => song.id === clean.id)
  const next = keepMv(prev, clean)
  writeJson(KEYS.recentPlays, [next, ...list.filter((song) => song.id !== clean.id)].slice(0, 40))
}

export function clearRecentPlays() {
  writeJson(KEYS.recentPlays, [])
}

export function getFavorites(): MusicItem[] {
  return readJson<MusicItem[]>(KEYS.favorites, []).map(normalizeMusic)
}

export function isFavorite(id: string): boolean {
  return getFavorites().some((x) => x.id === id)
}

export function toggleFavorite(item: MusicItem): boolean {
  const clean = normalizeMusic(item)
  const list = getFavorites()
  const exists = list.some((x) => x.id === clean.id)
  if (exists) {
    writeJson(
      KEYS.favorites,
      list.filter((x) => x.id !== clean.id),
    )
    return false
  }
  const prev = list.find((song) => song.id === clean.id) ?? getRecentPlays().find((song) => song.id === clean.id)
  writeJson(KEYS.favorites, [keepMv(prev, clean), ...list].slice(0, 200))
  return true
}

export function removeFavorite(id: string) {
  writeJson(
    KEYS.favorites,
    getFavorites().filter((x) => x.id !== id),
  )
}

export function clearFavorites() {
  writeJson(KEYS.favorites, [])
}

const PLAY_MODES: PlayMode[] = ['list', 'single', 'shuffle']

export function getPlayMode(): PlayMode {
  const raw = localStorage.getItem(KEYS.playMode)
  return PLAY_MODES.includes(raw as PlayMode) ? (raw as PlayMode) : 'list'
}

export function savePlayMode(mode: PlayMode) {
  localStorage.setItem(KEYS.playMode, mode)
}

export function getShowLyric(): boolean {
  return localStorage.getItem(KEYS.showLyric) === '1'
}

export function saveShowLyric(open: boolean) {
  localStorage.setItem(KEYS.showLyric, open ? '1' : '0')
}

export function rememberMusicMv(id: string, hasMv: boolean, mvPic?: string) {
  const patch = (list: MusicItem[]) => {
    let changed = false
    const next = list.map((item) => {
      if (item.id !== id) return item
      const pic = mvPic || item.mvPic
      if (item.hasMv === hasMv && item.mvPic === pic) return item
      changed = true
      return { ...item, hasMv, mvPic: pic }
    })
    return { changed, next }
  }
  const recent = patch(getRecentPlays())
  if (recent.changed) writeJson(KEYS.recentPlays, recent.next)
  const favorites = patch(getFavorites())
  if (favorites.changed) writeJson(KEYS.favorites, favorites.next)
  let listsChanged = false
  const lists = getMyPlaylists().map((list) => {
    const songs = patch(list.songs)
    if (!songs.changed) return list
    listsChanged = true
    return { ...list, songs: songs.next }
  })
  if (listsChanged) writeJson(KEYS.myPlaylists, lists)
}

export function getMyPlaylists(): MyPlaylist[] {
  return readJson<MyPlaylist[]>(KEYS.myPlaylists, []).map((list) => ({
    ...list,
    name: cleanText(list.name) || '我的专属歌单',
    songs: (list.songs ?? []).map(normalizeMusic),
  }))
}

export function getMyPlaylist(id: string): MyPlaylist | undefined {
  return getMyPlaylists().find((list) => list.id === id)
}

export function createMyPlaylist(name: string): MyPlaylist {
  const list: MyPlaylist = {
    id: `pl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: cleanText(name).slice(0, 40) || '我的专属歌单',
    createdAt: Date.now(),
    songs: [],
  }
  writeJson(KEYS.myPlaylists, [list, ...getMyPlaylists()].slice(0, 100))
  return list
}

export function renameMyPlaylist(id: string, name: string) {
  const clean = cleanText(name).slice(0, 40)
  if (!clean) return
  writeJson(
    KEYS.myPlaylists,
    getMyPlaylists().map((list) => (list.id === id ? { ...list, name: clean } : list)),
  )
}

export function deleteMyPlaylist(id: string) {
  writeJson(
    KEYS.myPlaylists,
    getMyPlaylists().filter((list) => list.id !== id),
  )
}

/** 已在歌单里时返回 false。 */
export function addToMyPlaylist(id: string, item: MusicItem): boolean {
  const clean = normalizeMusic(item)
  let added = false
  const lists = getMyPlaylists().map((list) => {
    if (list.id !== id || list.songs.some((song) => song.id === clean.id)) return list
    added = true
    return { ...list, songs: [clean, ...list.songs].slice(0, 500) }
  })
  if (added) writeJson(KEYS.myPlaylists, lists)
  return added
}

export function removeFromMyPlaylist(id: string, songId: string) {
  writeJson(
    KEYS.myPlaylists,
    getMyPlaylists().map((list) =>
      list.id === id ? { ...list, songs: list.songs.filter((song) => song.id !== songId) } : list,
    ),
  )
}

export function getSavedPlaylists(): PlaylistCard[] {
  return readJson<PlaylistCard[]>(KEYS.savedPlaylists, [])
}

export function isSavedPlaylist(id: string): boolean {
  return getSavedPlaylists().some((item) => item.id === id)
}

export function toggleSavedPlaylist(card: PlaylistCard): boolean {
  const list = getSavedPlaylists()
  if (list.some((item) => item.id === card.id)) {
    writeJson(
      KEYS.savedPlaylists,
      list.filter((item) => item.id !== card.id),
    )
    return false
  }
  writeJson(KEYS.savedPlaylists, [card, ...list].slice(0, 200))
  return true
}

export type DailyMixRecord = {
  date: string
  list: MusicItem[]
  basedOn: string[]
}

export function readDailyMix(): DailyMixRecord | null {
  const data = readJson<DailyMixRecord | null>(KEYS.dailyMix, null)
  if (!data?.date || !Array.isArray(data.list)) return null
  return { ...data, list: data.list.map(normalizeMusic), basedOn: data.basedOn ?? [] }
}

export function saveDailyMix(record: DailyMixRecord) {
  writeJson(KEYS.dailyMix, record)
}
