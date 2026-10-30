import { getHotComments, searchMusic, searchQuery } from './api'
import { momentStation, type Station } from './brand'
import { mvQualitiesFromFormats } from './quality'
import { apiFetch, endpoint } from './source'
import { getFavorites, getRecentPlays, getUid, readDailyMix, saveDailyMix } from './storage'
import { cleanArtist, cleanText, stripSourceBrand } from './text'
import type {
  ArtistCard,
  ChartGroup,
  ChartInfo,
  ChartSongs,
  HotComment,
  MusicItem,
  PlaylistCard,
  PlaylistDetail,
  Trend,
} from './types'

const TTL = 10 * 60 * 1000

type Entry = { at: number; value?: unknown; job?: Promise<unknown> }

const cache = new Map<string, Entry>()

/** 有缓存就先拿来画页面，过期的照样返回，由 remember 在后台刷新。 */
export function peek<T>(key: string): T | undefined {
  return cache.get(key)?.value as T | undefined
}

export function forget(key: string) {
  cache.delete(key)
}

export function remember<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit?.job) return hit.job as Promise<T>
  if (hit && hit.value !== undefined && Date.now() - hit.at < TTL) return Promise.resolve(hit.value as T)
  const job = load().then(
    (value) => {
      cache.set(key, { at: Date.now(), value })
      return value
    },
    (error: unknown) => {
      if (hit?.value !== undefined) cache.set(key, { at: hit.at, value: hit.value })
      else cache.delete(key)
      throw error
    },
  )
  cache.set(key, { at: hit?.at ?? 0, value: hit?.value, job })
  return job
}

const WAPI_USER = 'loginUid=0&loginSid=0&appUid=76039576'

async function wapi<T>(path: string): Promise<T> {
  const res = await apiFetch(endpoint('wapi', path))
  if (!res.ok) throw new Error(`曲库返回 ${res.status}`)
  const data = (await res.json()) as { code?: number; data?: T; msg?: string }
  if (data.code !== 200 || data.data === undefined || data.data === null) {
    throw new Error(data.msg || '曲库没有返回数据')
  }
  return data.data
}

/** 封面统一存成 albumcover 下的短路径，交给 coverUrl 换尺寸、走代理。 */
function albumPath(url: string): string {
  return url.match(/\/star\/albumcover\/(.+)$/)?.[1] ?? url
}

function starPath(url: string): string {
  return url.match(/\/star\/starheads\/(.+)$/)?.[1] ?? url
}

/** 歌单图同一张有 _150 / _240 / _500 几档，取 500。 */
function playlistPic(url: string): string {
  if (!url) return ''
  if (/\/userpl\d*\//.test(url)) return url.replace(/_\d+(\.\w+)$/, '_500$1')
  return url.replace(/(\/star\/albumcover\/)\d+\//, '$1500/')
}

function text(value: unknown): string {
  return cleanText(String(value ?? ''))
}

/** 榜单、歌单这些展示文案去掉曲库品牌，歌名和歌手名不动。 */
function catalogText(value: unknown): string {
  return stripSourceBrand(text(value))
}

function songId(raw: Record<string, unknown>): string {
  return String(raw.rid ?? raw.id ?? raw.musicrid ?? '').replace(/^MUSIC_/, '')
}

/** 榜单、歌手歌曲（wapi）和歌单详情（nplserver）字段不同，这里统一成 MusicItem。 */
function mapSong(raw: Record<string, unknown>): MusicItem | null {
  const id = songId(raw)
  if (!id || !/^\d+$/.test(id)) return null
  const hasMv = Number(raw.hasmv) === 1
  const formats = String(raw.formats ?? '')
  const fileInfo = String(raw.MINFO ?? '')
  const artistPic = String(raw.artistPic ?? '')
  return {
    id,
    title: text(raw.name) || '未知歌曲',
    artist: cleanArtist(String(raw.artist ?? '')) || '未知歌手',
    album: text(raw.album),
    albumId: String(raw.albumid ?? ''),
    duration: Number(raw.duration) || 0,
    image: albumPath(String(raw.pic ?? raw.albumpic ?? '')),
    artistImage: artistPic ? starPath(artistPic) : undefined,
    hasMv,
    mvQualities: hasMv ? mvQualitiesFromFormats(formats) : undefined,
    fileInfo: fileInfo || undefined,
  }
}

function parseTrend(raw: Record<string, unknown>): Trend {
  const flag = String(raw.trend ?? '').charAt(0)
  const change = Number(raw.rank_change) || 0
  if (flag === 'u' && change > 0) return { dir: 'up', change }
  if (flag === 'd' && change > 0) return { dir: 'down', change }
  if (flag === 'n') return { dir: 'new', change: 0 }
  return { dir: 'same', change: 0 }
}

/** 相声、故事不是音乐，不放进榜单。 */
const NON_MUSIC_CHARTS = new Set(['291', '344'])

export function getChartMenu(): Promise<ChartGroup[]> {
  return remember('chart-menu', async () => {
    const groups = await wapi<Array<{ name?: string; list?: Array<Record<string, unknown>> }>>(
      '/api/www/bang/bang/bangMenu?httpsStatus=1',
    )
    return groups
      .map((group) => ({
        name: catalogText(group.name),
        list: (group.list ?? [])
          .map((raw): ChartInfo | null => {
            const id = String(raw.sourceid ?? raw.id ?? '')
            if (!id || NON_MUSIC_CHARTS.has(id)) return null
            return {
              id,
              name: catalogText(raw.name) || '榜单',
              intro: catalogText(raw.intro),
              // 官方封面图带有曲库品牌字样，页面改用歌曲封面。
              pic: '',
              pub: text(raw.pub),
            }
          })
          .filter((item): item is ChartInfo => !!item),
      }))
      .filter((group) => group.list.length > 0)
  })
}

export const CHART_PAGE = 30

export function getChartSongs(id: string, pn = 1): Promise<ChartSongs> {
  return remember(`chart:${id}:${pn}`, async () => {
    const data = await wapi<{ num?: string; pub?: string; musicList?: Array<Record<string, unknown>> }>(
      `/api/www/bang/bang/musicList?bangId=${encodeURIComponent(id)}&pn=${pn}&rn=${CHART_PAGE}&httpsStatus=1`,
    )
    const list: MusicItem[] = []
    const trends: Record<string, Trend> = {}
    for (const raw of data.musicList ?? []) {
      const song = mapSong(raw)
      if (!song || trends[song.id]) continue
      list.push(song)
      trends[song.id] = parseTrend(raw)
    }
    return { list, trends, total: Number(data.num) || list.length, pub: text(data.pub) }
  })
}

function mapPlaylistCard(raw: Record<string, unknown>): PlaylistCard | null {
  const id = String(raw.id ?? raw.playlistid ?? raw.DC_TARGETID ?? '')
  if (!id) return null
  return {
    id,
    name: catalogText(raw.name) || '未命名歌单',
    pic: playlistPic(String(raw.img ?? raw.pic ?? raw.hts_pic ?? '')),
    playCount: Number(raw.listencnt ?? raw.playcnt) || 0,
    total: Number(raw.total ?? raw.songnum) || 0,
    creator: catalogText(raw.uname ?? raw.nickname),
  }
}

export const PLAYLIST_PAGE = 18

export function getRecommendPlaylists(pn = 1): Promise<PlaylistCard[]> {
  return remember(`rcm-playlists:${pn}`, async () => {
    const data = await wapi<{ data?: Array<Record<string, unknown>> }>(
      `/api/pc/classify/playlist/getRcmPlayList?${WAPI_USER}&pn=${pn}&rn=${PLAYLIST_PAGE}&order=hot`,
    )
    return (data.data ?? []).map(mapPlaylistCard).filter((item): item is PlaylistCard => !!item)
  })
}

/** 分类歌单接口按时间排，冷门的太多；按关键词搜歌单再按播放量排，质量好很多。 */
export function searchPlaylists(keyword: string, pn = 0): Promise<PlaylistCard[]> {
  return remember(`playlist-search:${keyword}:${pn}`, async () => {
    const data = await searchQuery({
      all: keyword,
      ft: 'playlist',
      rformat: 'json',
      encoding: 'utf8',
      rn: String(PLAYLIST_PAGE),
      pn: String(pn),
      vipver: '1',
    })
    const list = (Array.isArray(data.abslist) ? (data.abslist as Record<string, unknown>[]) : [])
      .map(mapPlaylistCard)
      .filter((item): item is PlaylistCard => !!item && item.total >= 15)
    // 和关键词同名的个人歌单往往只有几百次播放；热门的够一屏时只留热门的。
    const popular = list.filter((item) => item.playCount >= 10000)
    return (popular.length >= 6 ? popular : list).sort((a, b) => b.playCount - a.playCount)
  })
}

export const PLAYLIST_SONG_PAGE = 50

export function getPlaylistDetail(id: string, pn = 0): Promise<PlaylistDetail> {
  return remember(`playlist:${id}:${pn}`, async () => {
    const qs = new URLSearchParams({
      op: 'getlistinfo',
      pid: id,
      pn: String(pn),
      rn: String(PLAYLIST_SONG_PAGE),
      encode: 'utf8',
      keyset: 'pl2012',
      identity: 'kuwo',
      pcmp4: '1',
      vipver: 'MUSIC_9.0.5.0_W1',
      newver: '1',
    })
    const res = await apiFetch(endpoint('npl', `/pl.svc?${qs}`))
    if (!res.ok) throw new Error(`曲库返回 ${res.status}`)
    const data = JSON.parse(await res.text()) as Record<string, unknown>
    if (data.result !== 'ok') throw new Error('歌单暂时打不开')
    const seen = new Set<string>()
    const songs = (Array.isArray(data.musiclist) ? (data.musiclist as Record<string, unknown>[]) : [])
      .map(mapSong)
      .filter((song): song is MusicItem => {
        if (!song || seen.has(song.id)) return false
        seen.add(song.id)
        return true
      })
    return {
      id,
      name: catalogText(data.title) || '未命名歌单',
      pic: playlistPic(String(data.pic ?? '')),
      playCount: Number(data.playnum) || 0,
      total: Number(data.total) || songs.length,
      creator: catalogText(data.uname),
      info: catalogText(data.info),
      tags: String(data.tag ?? '')
        .split(/[,;，]/)
        .map((tag) => catalogText(tag))
        .filter(Boolean),
      songs,
    }
  })
}

export function getHotArtists(): Promise<ArtistCard[]> {
  return remember('hot-artists', async () => {
    const data = await wapi<{ artistList?: Array<Record<string, unknown>> }>(
      '/api/www/artist/artistInfo?category=0&pn=1&rn=16&httpsStatus=1',
    )
    return (data.artistList ?? [])
      .map((raw): ArtistCard | null => {
        const id = String(raw.id ?? '')
        if (!id) return null
        return {
          id,
          name: text(raw.name),
          pic: String(raw.pic300 ?? raw.pic ?? ''),
          fans: Number(raw.artistFans) || 0,
          songCount: Number(raw.musicNum) || 0,
        }
      })
      .filter((item): item is ArtistCard => !!item)
  })
}

export function getArtistSongs(id: string, pn = 1): Promise<{ list: MusicItem[]; total: number }> {
  return remember(`artist:${id}:${pn}`, async () => {
    const data = await wapi<{ total?: string | number; list?: Array<Record<string, unknown>> }>(
      `/api/www/artist/artistMusic?artistid=${encodeURIComponent(id)}&pn=${pn}&rn=${CHART_PAGE}&httpsStatus=1`,
    )
    const list = (data.list ?? []).map(mapSong).filter((song): song is MusicItem => !!song)
    return { list, total: Number(data.total) || list.length }
  })
}

/** 酷我热评榜：讨论度最高的歌，每首配上点赞最多的评论。 */
export const HOT_COMMENT_CHART = '284'

export function getHotCommentFeed(page: number, size = 6): Promise<HotComment[]> {
  return remember(`hot-comment-feed:${page}:${size}`, async () => {
    const start = page * size
    const chartPage = Math.floor(start / CHART_PAGE) + 1
    const chart = await getChartSongs(HOT_COMMENT_CHART, chartPage)
    const offset = start - (chartPage - 1) * CHART_PAGE
    const songs = chart.list.slice(offset, offset + size)
    const results = await Promise.allSettled(songs.map((song) => getHotComments(song.id, 2)))
    return songs
      .map((song, index) => {
        const result = results[index]
        return { song, comments: result?.status === 'fulfilled' ? result.value : [] }
      })
      .filter((item) => item.comments.length > 0)
  })
}

export function today(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function hashSeed(raw: string): number {
  let hash = 2166136261
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** 同一天、同一个人打乱的结果固定，刷新页面不会变。 */
export function shuffleOfDay<T>(list: T[], salt: string): T[] {
  let seed = hashSeed(`${today()}:${getUid()}:${salt}`)
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const copy = list.slice()
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

/** 收藏权重高于最近播放，越近播放的越重要。合作歌曲只取第一位歌手。 */
export function tasteArtists(limit = 4): string[] {
  const score = new Map<string, number>()
  const add = (artist: string, weight: number) => {
    const name = artist.split(/[、,，/&]/)[0]?.trim()
    if (!name || name === '未知歌手') return
    score.set(name, (score.get(name) ?? 0) + weight)
  }
  getFavorites().forEach((song) => add(song.artist, 3))
  getRecentPlays().forEach((song, index) => add(song.artist, Math.max(0.4, 2 - index * 0.06)))
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name)
}

function songKey(song: MusicItem): string {
  return `${song.title.replace(/\s|\(.*?\)|（.*?）/g, '').toLowerCase()}|${song.artist}`
}

function mergeUnique(groups: MusicItem[][], limit: number, skip = new Set<string>()): MusicItem[] {
  const seenId = new Set<string>(skip)
  const seenKey = new Set<string>()
  const out: MusicItem[] = []
  const queues = groups.map((group) => group.slice())
  while (out.length < limit && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const song = queue.shift()
      if (!song || seenId.has(song.id) || seenKey.has(songKey(song))) continue
      seenId.add(song.id)
      seenKey.add(songKey(song))
      out.push(song)
      if (out.length >= limit) break
    }
  }
  return out
}

export type DailyMix = { list: MusicItem[]; basedOn: string[] }

async function artistPicks(artists: string[], heard: Set<string>, salt: string): Promise<MusicItem[][]> {
  const results = await Promise.allSettled(artists.map((artist) => searchMusic(artist, 0, 30)))
  return results.map((result, index) => {
    if (result.status !== 'fulfilled') return []
    const artist = artists[index]!
    const songs = result.value.list.filter((song) => song.artist.includes(artist) && !heard.has(song.id))
    return shuffleOfDay(songs, `${salt}:${artist}`).slice(0, 8)
  })
}

/** 有听歌记录时，按常听歌手找没听过的歌，再掺新歌和热歌；没有记录就先给新歌和热歌。 */
export async function getDailyMix(): Promise<DailyMix> {
  const date = today()
  const saved = readDailyMix()
  if (saved?.date === date && saved.list.length) return { list: saved.list, basedOn: saved.basedOn }
  return remember(`daily-mix:${date}`, async () => {
    const artists = tasteArtists()
    const heard = new Set([...getFavorites(), ...getRecentPlays()].map((song) => song.id))
    const [picks, fresh, hot] = await Promise.all([
      artistPicks(artists, heard, 'daily'),
      getChartSongs('17').then((data) => data.list).catch(() => [] as MusicItem[]),
      getChartSongs('16').then((data) => data.list).catch(() => [] as MusicItem[]),
    ])
    const discovery = [
      shuffleOfDay(fresh.filter((song) => !heard.has(song.id)), 'daily:fresh').slice(0, 10),
      shuffleOfDay(hot.filter((song) => !heard.has(song.id)), 'daily:hot').slice(0, 10),
    ]
    const list = mergeUnique([...picks, ...discovery], 30)
    if (!list.length) throw new Error('今天的推荐还没准备好')
    const basedOn = picks.some((group) => group.length) ? artists.filter((_, index) => picks[index]?.length) : []
    if (basedOn.length) saveDailyMix({ date, list, basedOn })
    return { list, basedOn }
  })
}

export type StationMix = { list: MusicItem[]; playlist: PlaylistCard }

/** 电台：按关键词找播放量最高的几张歌单，当天固定选一张，打乱后连续播放。 */
export function getStationMix(station: Station): Promise<StationMix> {
  return remember(`station:${station.id}:${today()}`, async () => {
    const cards = (await searchPlaylists(station.keyword)).slice(0, 3)
    const playlist = shuffleOfDay(cards, `station:${station.id}`)[0]
    if (!playlist) throw new Error('电台暂时没有信号')
    const detail = await getPlaylistDetail(playlist.id)
    const list = shuffleOfDay(detail.songs, `station-songs:${station.id}`)
    if (!list.length) throw new Error('电台暂时没有信号')
    return { list, playlist: { ...playlist, pic: playlist.pic || detail.pic } }
  })
}

export type PrivateMix = { list: MusicItem[]; station: Station; basedOn: string[] }

/** 私人专属：一半是常听歌手的歌，一半是此刻时段电台里的歌，交替排开。 */
export async function getPrivateMix(): Promise<PrivateMix> {
  const station = momentStation()
  return remember(`private-mix:${today()}:${station.id}`, async () => {
    const [daily, mood] = await Promise.all([
      getDailyMix().catch(() => ({ list: [] as MusicItem[], basedOn: [] as string[] })),
      getStationMix(station).catch(() => null),
    ])
    const taste = shuffleOfDay(daily.list, 'private')
    const list = mergeUnique([taste, mood?.list ?? []], 40)
    if (!list.length) throw new Error('私人专属还没准备好')
    return { list, station, basedOn: daily.basedOn }
  })
}
