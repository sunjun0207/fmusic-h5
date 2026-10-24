import { buildMvNmobiPath, buildNmobiPath } from './kuwoDes'
import { isMvQuality, mvFallback, mvQualitiesFromFormats, visibleMvQuality } from './quality'
import { cleanArtist, cleanText } from './text'
import type {
  DownloadTask,
  LyricLine,
  MusicItem,
  NotificationInfo,
  PlayMeta,
  UpdateInfo,
} from './types'
import { getSettings, getUid } from './storage'

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

function mvPicture(raw: Record<string, unknown>) {
  const direct = String(pick(raw, 'hts_MVPIC') ?? '')
  if (direct) return direct
  const path = String(pick(raw, 'MVPIC') ?? '').replace(/^\/+/, '')
  return path ? `https://img4.kuwo.cn/wmvpic/${path}` : ''
}

function songHasMv(raw: Record<string, unknown>) {
  const flag = String(pick(raw, 'MVFLAG') ?? '')
  const mkv = String(pick(raw, 'MKVRID') ?? '')
  // 没有 MV 时酷我也会给 MKVRID=MV_0，不能用 startsWith('MV_') 判断。
  if (flag === '1') return true
  return /^MV_[1-9]\d*$/.test(mkv)
}

function mapSearchItem(raw: Record<string, unknown>): MusicItem | null {
  const id = String(pick(raw, 'DC_TARGETID', 'musicId', 'MUSICRID') ?? '').replace(/^MUSIC_/, '')
  if (!id) return null
  const title = cleanText(String(pick(raw, 'SONGNAME', 'songName', 'NAME') ?? '')) || '未知歌曲'
  const artist = cleanArtist(String(pick(raw, 'ARTIST', 'artist', 'ARTISTNAME') ?? '')) || '未知歌手'
  const album = cleanText(String(pick(raw, 'ALBUM', 'album') ?? ''))
  const albumId = String(pick(raw, 'ALBUMID', 'albumId') ?? '')
  const duration = parseDuration(pick(raw, 'DURATION', 'duration'))
  const albumPic = String(pick(raw, 'web_albumpic_short', 'albumPic', 'pic') ?? '')
  const artistPic = String(pick(raw, 'web_artistpic_short') ?? '')
  const fileInfo = String(pick(raw, 'MINFO', 'mInfo') ?? '')
  const mvPic = mvPicture(raw)
  const mvQualities = mvQualitiesFromFormats(String(pick(raw, 'FORMATS', 'formats') ?? ''))
  return {
    id,
    title: title || '未知歌曲',
    artist,
    album,
    albumId,
    duration,
    image: albumPic,
    artistImage: artistPic || undefined,
    hasMv: songHasMv(raw),
    mvPic: mvPic || undefined,
    mvQualities,
    fileInfo,
  }
}

const IMAGE_LADDER = [1000, 700, 500, 300, 120]

function resizeKuwoImage(url: string, size?: number): string {
  if (!url || !size) return url
  return url.replace(/(\/(?:albumcover|starheads)\/)\d+\//, `$1${size}/`)
}

export function coverUrl(path?: string, size?: number): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const u = new URL(path)
      if (u.hostname.includes('kuwo.cn')) {
        if (u.hostname.startsWith('img4.') || u.pathname.includes('/wmvpic/')) {
          u.protocol = 'https:'
          return u.toString()
        }
        return resizeKuwoImage(`/proxy/kw-img${u.pathname}${u.search}`, size)
      }
    } catch {
      /* ignore */
    }
    return path
  }
  const cleaned = path.replace(/^\/+/, '')
  if (cleaned.startsWith('star/albumcover/')) {
    return resizeKuwoImage(`/proxy/kw-img/${cleaned}`, size)
  }
  return resizeKuwoImage(`/proxy/kw-img/star/albumcover/${cleaned}`, size)
}

/** 歌手图在 starheads，和专辑封面不是同一目录。现图最大约 500。 */
export function artistUrl(path?: string, size?: number): string {
  const capped = size ? Math.min(size, 500) : undefined
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return coverUrl(path, capped)
  const cleaned = path.replace(/^\/+/, '')
  if (cleaned.startsWith('star/')) return resizeKuwoImage(`/proxy/kw-img/${cleaned}`, capped)
  return resizeKuwoImage(`/proxy/kw-img/star/starheads/${cleaned}`, capped)
}

export function posterList(item: { image?: string; artistImage?: string }, size = 1000): string[] {
  const list = [coverUrl(item.image, size), artistUrl(item.artistImage, size)].filter(Boolean)
  return [...new Set(list)]
}

/** 大图 404 时换成下一档，直到 120。 */
export function smallerImageUrl(url: string): string {
  const matched = url.match(/(\/(?:albumcover|starheads)\/)(\d+)(\/)/)
  if (!matched) return url
  const next = IMAGE_LADDER.find((size) => size < Number(matched[2]))
  if (!next) return url
  return url.replace(matched[0], `${matched[1]}${next}${matched[3]}`)
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

const mvInfoCache = new Map<string, { hasMv: boolean; mvPic?: string }>()

/** 最近播放、收藏里的旧记录可能没有 MV 标记，按歌曲 id 再查一次并记住。 */
export async function resolveMvInfo(
  item: MusicItem,
  force = false,
): Promise<{ hasMv: boolean; mvPic?: string } | null> {
  if (!force && typeof item.hasMv === 'boolean') return { hasMv: item.hasMv, mvPic: item.mvPic }
  const cached = mvInfoCache.get(item.id)
  if (cached) return cached
  const queries = [`${item.title} ${item.artist}`.trim(), item.title.trim()].filter((query, index, all) => query && all.indexOf(query) === index)
  for (const keyword of queries) {
    try {
      const result = await searchMusic(keyword, 0, 20)
      const matched = result.list.find((song) => song.id === item.id)
      if (!matched) continue
      const info = { hasMv: matched.hasMv === true, mvPic: matched.mvPic }
      mvInfoCache.set(item.id, info)
      return info
    } catch {
      return null
    }
  }
  return null
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
        if (typeof item === 'string') return cleanText(extractRelWord(item))
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>
          return cleanText(String(o.RELWORD ?? o.keyword ?? o.name ?? ''))
        }
        return ''
      })
      .filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/\n(?=RELWORD=)/i)
      .map((part) => cleanText(extractRelWord(part)))
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
      lineLyric: cleanText(String(line.lineLyric ?? '')),
    }))
    .filter((l) => l.lineLyric)
}

function parseKv(text: string): Record<string, string> {
  const map: Record<string, string> = {}
  text.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf('=')
    if (idx > 0) map[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  })
  return map
}

export async function getPlayMeta(rid: string, br = '320kmp3'): Promise<PlayMeta> {
  const isFlac = br.includes('flac')
  const format = isFlac ? 'flac|mp3' : 'mp3'
  const path = buildNmobiPath(rid, format, isFlac ? '' : br)
  const res = await fetch(path)
  const map = parseKv(await res.text())
  const url = map.url
  if (!url) throw new Error('未获取到播放地址')
  return {
    url: rewriteAudioUrl(url),
    format: map.format ?? '',
    bitrate: map.bitrate ?? '',
  }
}

export type MvSource = {
  url: string
  quality: string
  bitrate: string
}

const MV_BITRATE: Record<string, string> = {
  MP4: '512',
  MP4HV: '1000',
  MP4UL: '2000',
}

const mvCache = new Map<string, Promise<MvSource>>()

function mvTierMatches(map: Record<string, string>, item: string): boolean {
  if (!map.url) return false
  const reported = (map.quality || '').trim().toUpperCase()
  if (reported) return reported === item.toUpperCase()
  const expected = MV_BITRATE[item]
  const bitrate = (map.bitrate || '').replace(/[^\d]/g, '')
  return Boolean(expected && bitrate && bitrate === expected)
}

async function probeMvTier(rid: string, item: string): Promise<MvSource | null> {
  try {
    const path = `${buildMvNmobiPath(rid, item)}&req=${encodeURIComponent(item)}`
    const res = await fetch(path, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    })
    if (!res.ok) return null
    const map = parseKv(await res.text())
    if (!mvTierMatches(map, item)) return null
    const bitrate = (map.bitrate || '').replace(/[^\d]/g, '') || MV_BITRATE[item] || ''
    return {
      url: rewriteAudioUrl(map.url),
      quality: visibleMvQuality(item),
      bitrate,
    }
  } catch {
    return null
  }
}

const mvAvailability = new Map<string, Promise<string[]>>()

/** 旧记录没有 FORMATS 时，按三档各问一次，只留下真正有地址的。 */
export function getAvailableMvQualities(rid: string): Promise<string[]> {
  const cached = mvAvailability.get(rid)
  if (cached) return cached
  const groups: Array<[string, string[]]> = [
    ['MP4', ['MP4', 'MP4L']],
    ['MP4HV', ['MP4HV', 'MP4H']],
    ['MP4UL', ['MP4UL']],
  ]
  const job = Promise.all(
    groups.map(async ([visible, ids]) => {
      for (const item of ids) {
        const source = await probeMvTier(rid, item)
        if (!source) continue
        mvCache.set(`${rid}:${visible}`, Promise.resolve({ ...source, quality: visible }))
        return visible
      }
      return ''
    }),
  ).then((list) => list.filter(Boolean))
  mvAvailability.set(rid, job)
  return job
}

export function getMvUrl(rid: string, quality?: string): Promise<MvSource> {
  const picked = quality && isMvQuality(quality) ? visibleMvQuality(quality) : getSettings().mvQuality
  const key = `${rid}:${picked}`
  const cached = mvCache.get(key)
  if (cached) return cached
  const job = fetchMvUrl(rid, picked)
    .then((source) => {
      if (source.quality !== picked) {
        mvCache.delete(key)
        mvCache.set(`${rid}:${source.quality}`, Promise.resolve(source))
      }
      return source
    })
    .catch((error: unknown) => {
      mvCache.delete(key)
      throw error
    })
  mvCache.set(key, job)
  return job
}

async function fetchMvUrl(rid: string, quality: string): Promise<MvSource> {
  for (const item of mvFallback(quality)) {
    try {
      const path = `${buildMvNmobiPath(rid, item)}&req=${encodeURIComponent(item)}`
      const res = await fetch(path, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      })
      if (!res.ok) continue
      const map = parseKv(await res.text())
      if (!mvTierMatches(map, item)) continue
      const picked = isMvQuality(map.quality) ? map.quality : item
      const bitrate = (map.bitrate || '').replace(/[^\d]/g, '') || MV_BITRATE[item] || ''
      return {
        url: rewriteAudioUrl(map.url),
        quality: visibleMvQuality(picked),
        bitrate,
      }
    } catch {
      /* try the next lower quality */
    }
  }
  throw new Error('这首歌暂时没有可播放的 MV')
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

export { APP_VERSION, cleanText }
