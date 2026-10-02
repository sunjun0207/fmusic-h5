import { buildNmobiPath } from './kuwoDes'
import type {
  DownloadTask,
  LyricLine,
  MusicItem,
  NotificationInfo,
  PlayMeta,
  UpdateInfo,
} from './types'
import { getUid } from './storage'

const APP_VERSION = '1.0.10'

function pick<T>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k] as T
  }
  return undefined
}

function parseDuration(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function mapSearchItem(raw: Record<string, unknown>): MusicItem | null {
  const id = String(pick(raw, 'DC_TARGETID', 'musicId', 'MUSICRID') ?? '').replace(/^MUSIC_/, '')
  if (!id) return null
  const title = String(pick(raw, 'SONGNAME', 'songName', 'NAME') ?? '未知歌曲')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
  const artist = String(pick(raw, 'ARTIST', 'artist', 'ARTISTNAME') ?? '未知歌手')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
  const album = String(pick(raw, 'ALBUM', 'album') ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
  const albumId = String(pick(raw, 'ALBUMID', 'albumId') ?? '')
  const duration = parseDuration(pick(raw, 'DURATION', 'duration'))
  const albumPic = String(pick(raw, 'web_albumpic_short', 'albumPic', 'pic') ?? '')
  const fileInfo = String(pick(raw, 'MINFO', 'mInfo') ?? '')
  return {
    id,
    title: title || '未知歌曲',
    artist,
    album,
    albumId,
    duration,
    image: albumPic,
    fileInfo,
  }
}

export function coverUrl(path?: string): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const u = new URL(path)
      if (u.hostname.includes('kuwo.cn')) {
        return `/proxy/kw-img${u.pathname}${u.search}`
      }
    } catch {
      /* ignore */
    }
    return path
  }
  const cleaned = path.replace(/^\/+/, '')
  if (cleaned.startsWith('star/albumcover/')) {
    return `/proxy/kw-img/${cleaned}`
  }
  return `/proxy/kw-img/star/albumcover/${cleaned}`
}

const KUWO_AUDIO_HOST = /^kw-[a-z0-9-]+\.kuwo\.cn$/i

/**
 * 播放地址常为 http://kw-lv.kuwo.cn 等。这些 CDN 提供 HTTPS，
 * 直接把协议换成 https，避免 HTTPS 页面的混合内容，也避免反代返回网页导致无法播放。
 */
function rewriteAudioUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (!KUWO_AUDIO_HOST.test(parsed.hostname)) return url
    if (parsed.protocol === 'https:') return url
    return `https://${url.slice('http://'.length)}`
  } catch {
    return url
  }
}

/** 下载需要同源拉取文件，把酷我音频地址改到本站反代。 */
export function toProxyAudioUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (!KUWO_AUDIO_HOST.test(parsed.hostname)) return url
    return `/proxy/kw-audio/${parsed.hostname}${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

export type SearchPageResult = {
  list: MusicItem[]
  total: number
  pn: number
  rn: number
}

export async function searchMusic(
  keyword: string,
  pn = 0,
  rn = 20,
): Promise<SearchPageResult> {
  const qs = new URLSearchParams({
    all: keyword,
    ft: 'music',
    client: 'kt',
    cluster: '0',
    pn: String(pn),
    rn: String(rn),
    rformat: 'json',
    encoding: 'utf8',
    vipver: '1',
  })
  const res = await fetch(`/proxy/kw-search/r.s?${qs}`)
  const text = await res.text()
  // Kuwo sometimes returns JSON with single quotes / trailing commas — try normal parse first
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    const fixed = text.replace(/'/g, '"')
    data = JSON.parse(fixed) as Record<string, unknown>
  }
  const list = (pick(data, 'abslist', 'list') as Record<string, unknown>[] | undefined) ?? []
  const total = Number(pick(data, 'TOTAL', 'total', 'HIT', 'hit') ?? list.length) || 0
  return {
    list: list.map(mapSearchItem).filter((x): x is MusicItem => !!x),
    total,
    pn,
    rn,
  }
}

export async function searchKey(keyword: string): Promise<string[]> {
  if (!keyword.trim()) return []
  const res = await fetch(
    `/proxy/kw-openapi/openapi/v1/www/search/searchKey?key=${encodeURIComponent(keyword)}`,
  )
  const data = (await res.json()) as { code?: number; data?: unknown }
  const raw = data.data
  if (!raw) return []

  const extractRelWord = (text: string): string => {
    const m = text.match(/(?:^|\r?\n)RELWORD=([^\r\n]+)/i)
    if (m?.[1]) return m[1].trim()
    // 兼容旧格式：tab / 纯文本
    const first = text.split(/\t|\r?\n/)[0]?.trim() ?? ''
    if (/^[A-Z_]+=/.test(first)) return ''
    return first
  }

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return extractRelWord(item)
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>
          return String(o.RELWORD ?? o.keyword ?? o.name ?? '').trim()
        }
        return ''
      })
      .filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/\n(?=RELWORD=)/i)
      .map(extractRelWord)
      .filter(Boolean)
  }
  return []
}

export async function getLyric(musicId: string): Promise<LyricLine[]> {
  const res = await fetch(
    `/proxy/kw-openapi/openapi/v1/www/lyric/getlyric?musicId=${encodeURIComponent(musicId)}`,
  )
  const data = (await res.json()) as {
    data?: { lrclist?: LyricLine[]; lrcList?: LyricLine[] }
  }
  const list = data.data?.lrclist ?? data.data?.lrcList ?? []
  return list
    .map((line) => ({
      time: Number(line.time) || 0,
      lineLyric: String(line.lineLyric ?? ''),
    }))
    .filter((l) => l.lineLyric)
}

export async function getPlayMeta(rid: string, br = '320kmp3'): Promise<PlayMeta> {
  const isFlac = br.includes('flac')
  const format = isFlac ? 'flac|mp3' : 'mp3'
  const path = buildNmobiPath(rid, format, isFlac ? '' : br)
  const res = await fetch(path)
  const text = await res.text()
  const map: Record<string, string> = {}
  text.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf('=')
    if (idx > 0) {
      map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    }
  })
  const url = map.url
  if (!url) throw new Error('未获取到播放地址')
  return {
    url: rewriteAudioUrl(url),
    format: map.format ?? '',
    bitrate: map.bitrate ?? '',
  }
}

export async function getUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch('/proxy/api/update')
    const data = (await res.json()) as UpdateInfo
    if (!data?.version) return null
    return data
  } catch {
    return null
  }
}

export async function getNotification(): Promise<NotificationInfo | null> {
  try {
    const res = await fetch('/proxy/api/notification')
    const data = (await res.json()) as NotificationInfo
    if (!data?.title && !data?.content) return null
    return data
  } catch {
    return null
  }
}

export async function postAccess(): Promise<void> {
  try {
    await fetch('/proxy/api/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: getUid(),
        version: APP_VERSION,
        android: 'H5',
        brand: navigator.vendor || 'browser',
        model: navigator.userAgent.slice(0, 80),
      }),
    })
  } catch {
    /* ignore */
  }
}

export async function postSearch(keyword: string): Promise<void> {
  try {
    await fetch('/proxy/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: getUid(), keyword }),
    })
  } catch {
    /* ignore */
  }
}

export async function postDownload(task: Pick<DownloadTask, 'mid' | 'title' | 'artist' | 'quality' | 'url'>): Promise<void> {
  try {
    await fetch('/proxy/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: getUid(),
        mid: task.mid,
        title: task.title,
        singer: task.artist,
        quality: task.quality,
        url: task.url,
      }),
    })
  } catch {
    /* ignore */
  }
}

export { APP_VERSION }
