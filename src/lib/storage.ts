import type { AppSettings, DownloadTask, MusicItem } from './types'

const KEYS = {
  uid: 'fmusic_uid',
  searchHistory: 'fmusic_search_history',
  downloads: 'fmusic_downloads',
  settings: 'fmusic_settings',
  dismissedNotification: 'fmusic_dismissed_notification',
  recentPlays: 'fmusic_recent_plays',
  favorites: 'fmusic_favorites',
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
  return readJson<DownloadTask[]>(KEYS.downloads, [])
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
  showNotification: true,
}

export function getSettings(): AppSettings {
  return { ...defaultSettings, ...readJson<Partial<AppSettings>>(KEYS.settings, {}) }
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

export function getRecentPlays(): MusicItem[] {
  return readJson<MusicItem[]>(KEYS.recentPlays, [])
}

export function addRecentPlay(item: MusicItem) {
  const list = getRecentPlays().filter((x) => x.id !== item.id)
  list.unshift(item)
  writeJson(KEYS.recentPlays, list.slice(0, 40))
}

export function getFavorites(): MusicItem[] {
  return readJson<MusicItem[]>(KEYS.favorites, [])
}

export function isFavorite(id: string): boolean {
  return getFavorites().some((x) => x.id === id)
}

export function toggleFavorite(item: MusicItem): boolean {
  const list = getFavorites()
  const exists = list.some((x) => x.id === item.id)
  if (exists) {
    writeJson(
      KEYS.favorites,
      list.filter((x) => x.id !== item.id),
    )
    return false
  }
  writeJson(KEYS.favorites, [item, ...list].slice(0, 200))
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
