import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { BottomBar } from './components/BottomBar'
import { Dialogs } from './components/Dialogs'
import { DownloadGuide } from './components/DownloadGuide'
import {
  AddListIcon,
  CommentIcon,
  HeartIcon,
  MvIcon,
  NextIcon,
  ShareIcon,
  TrashIcon,
} from './components/Icons'
import { MiniPlayer } from './components/MiniPlayer'
import { MvPlayer } from './components/MvPlayer'
import { PlayQueueSheet } from './components/PlayQueueSheet'
import { PlaylistPicker, PromptDialog, SongMenu, type MenuEntry } from './components/Sheets'
import { TopBar } from './components/TopBar'
import { SubHeader } from './components/UI'
import {
  clearPendingDownload,
  isWeChat,
  readPendingDownload,
  saveTrackFile,
  type PendingDownload,
} from './lib/download'
import { coverUrl, getAvailableMvQualities, getLyric, getMvUrl, getPlayMeta, getUpdate, postAccess, resolveMvInfo } from './lib/api'
import { AppContext, type AppActions, type SongMenuExtra } from './lib/appContext'
import { friendlyError, PICKS, TEXT } from './lib/brand'
import { applyMediaLevel, getLevels, LEVELS_EVENT } from './lib/levels'
import { createSongPlayer, currentNativeUrl, hasNativeAudio, noteNativeFavorite, noteNativeLyrics, noteNativeSong, noteNativeTrack, prepareNativeNext, prepareNativePrev, prepareRepeatOne, prepareUpcoming, yieldNativeAudio, type NativeTrackInfo } from './lib/nativeAudio'
import { nextPlayMode, planUpcoming, resolveAdvance } from './lib/playback'
import { bestMvQuality } from './lib/quality'
import { clearSharedLink, readSharedLink, shareTarget, type ShareTarget } from './lib/share'
import {
  addRecentPlay,
  addToMyPlaylist,
  createMyPlaylist,
  getFavorites,
  getMyPlaylist,
  getMyPlaylists,
  getPlayMode,
  getRecentPlays,
  getSettings,
  isFavorite,
  rememberMusicMv,
  savePlayMode,
  saveSettings,
  toggleFavorite,
} from './lib/storage'
import type { MusicItem, PlayMode, TabId, UpdateInfo, View } from './lib/types'
import { ChartsPage } from './pages/ChartsPage'
import { CommunityPage } from './pages/CommunityPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { DownloadPage } from './pages/DownloadPage'
import { FavoritePage } from './pages/FavoritePage'
import { HomePage } from './pages/HomePage'
import {
  ArtistView,
  ChartView,
  DailyView,
  MyPlaylistView,
  PickView,
  PlaylistView,
  PrivateView,
  RecentView,
} from './pages/ListViews'
import { MinePage } from './pages/MinePage'
import { MusicDetailPage } from './pages/MusicDetailPage'
import { RadioPage } from './pages/RadioPage'
import { SearchPage } from './pages/SearchPage'
import { SettingPage } from './pages/SettingPage'

type Entry = { key: string; view: View }

function viewKey(view: View): string {
  switch (view.kind) {
    case 'chart':
    case 'playlist':
    case 'pick':
    case 'artist':
    case 'myPlaylist':
      return `${view.kind}:${view.id}`
    default:
      return view.kind
  }
}

function viewTitle(view: View): string {
  switch (view.kind) {
    case 'search':
      return '搜索'
    case 'chart':
      return view.name
    case 'playlist':
      return '歌单'
    case 'pick':
      return PICKS.find((pick) => pick.id === view.id)?.title ?? '精选推荐'
    case 'artist':
      return view.name
    case 'daily':
      return '每日推荐'
    case 'private':
      return '私人专属'
    case 'radio':
      return '音乐电台'
    case 'myPlaylist':
      return getMyPlaylist(view.id)?.name ?? '我的歌单'
    case 'favorite':
      return '我的收藏'
    case 'recent':
      return '最近播放'
    case 'download':
      return '下载管理'
    case 'setting':
      return '设置'
  }
}

type HistoryMark = { depth?: number }

type PrimedTrack = { item: MusicItem; url: string; history: string[] }

function nativeInfo(track: PrimedTrack): NativeTrackInfo {
  return {
    url: track.url,
    title: track.item.title,
    artist: track.item.artist,
    cover: coverUrl(track.item.image, 300),
  }
}

function rememberNativeTrack(tracks: Map<string, PrimedTrack>, track: PrimedTrack | null) {
  if (!track?.url) return
  tracks.delete(track.url)
  tracks.set(track.url, track)
  while (tracks.size > 48) {
    const first = tracks.keys().next().value
    if (!first) break
    tracks.delete(first)
  }
}

async function resolveNativeTrack(
  current: MusicItem,
  currentUrl: string,
  result: { item: MusicItem | null; history: string[]; replay: boolean },
): Promise<PrimedTrack | null> {
  if (result.replay || !result.item || result.item.id === current.id) {
    return { item: current, url: currentUrl, history: result.history }
  }
  const meta = await getPlayMeta(result.item.id, getSettings().quality)
  if (!meta.url) return null
  return { item: result.item, url: meta.url, history: result.history }
}

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [visited, setVisited] = useState<TabId[]>(['home'])
  const [stack, setStack] = useState<Entry[]>([])
  const [detail, setDetail] = useState<MusicItem | null>(null)
  const [commentsToken, setCommentsToken] = useState(0)
  const [queue, setQueue] = useState<MusicItem[]>([])
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [pendingDl, setPendingDl] = useState<PendingDownload | null>(null)
  const [dlGuideHidden, setDlGuideHidden] = useState(false)
  const [dlSaving, setDlSaving] = useState(false)
  const [dlError, setDlError] = useState('')
  const [playMode, setPlayMode] = useState<PlayMode>(() => getPlayMode())
  const [queueOpen, setQueueOpen] = useState(false)
  const [libraryVersion, setLibraryVersion] = useState(0)
  const [mvVersion, setMvVersion] = useState(0)
  const [mvMusic, setMvMusic] = useState<MusicItem | null>(null)
  const [mvUrl, setMvUrl] = useState('')
  const [mvQuality, setMvQuality] = useState(() => getSettings().mvQuality)
  const [mvChoices, setMvChoices] = useState<string[]>([])
  const [mvLoading, setMvLoading] = useState(false)
  const [noMvStamp, setNoMvStamp] = useState<{ id: string; token: number } | null>(null)
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const [menu, setMenu] = useState<{ item: MusicItem; list?: MusicItem[]; extra?: SongMenuExtra[] } | null>(null)
  const [picker, setPicker] = useState<MusicItem | null>(null)
  const [creating, setCreating] = useState<MusicItem | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [current, setCurrent] = useState<MusicItem | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const playToken = useRef(0)
  const queueRef = useRef<MusicItem[]>([])
  const currentRef = useRef<MusicItem | null>(null)
  const playModeRef = useRef<PlayMode>(playMode)
  const playHistoryRef = useRef<string[]>([])
  const mvToken = useRef(0)
  const mvRequest = useRef(0)
  const mvActiveRef = useRef(false)
  const mvMusicRef = useRef<MusicItem | null>(null)
  const resumeAudioRef = useRef(false)
  const playInFlightRef = useRef(false)
  const heldAudioRef = useRef<{ src: string; time: number } | null>(null)
  const userPauseRef = useRef(false)
  const skipEndRef = useRef(false)
  const finishedSrcRef = useRef('')
  const heardTimeRef = useRef(0)
  const loadedIdRef = useRef('')
  const primedNextRef = useRef<PrimedTrack | null>(null)
  const primedPrevRef = useRef<PrimedTrack | null>(null)
  const nativeTracksRef = useRef(new Map<string, PrimedTrack>())
  const primeGenRef = useRef(0)
  const mainRef = useRef<HTMLElement | null>(null)
  const scrollMemo = useRef(new Map<string, number>())
  const entrySeq = useRef(0)
  const lastToast = useRef({ text: '', at: 0 })
  const tabRef = useRef(tab)
  const stackRef = useRef(stack)
  const detailRef = useRef(detail)
  tabRef.current = tab
  stackRef.current = stack
  detailRef.current = detail
  queueRef.current = queue

  const top = stack[stack.length - 1]
  const screenKey = detail ? 'detail' : top ? `view:${top.key}` : `tab:${tab}`
  const screenKeyRef = useRef(screenKey)
  screenKeyRef.current = screenKey

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    currentRef.current = current
  }, [current])

  useEffect(() => {
    playModeRef.current = playMode
  }, [playMode])

  const notify = useCallback((text: string) => {
    if (!text) return
    const now = Date.now()
    if (lastToast.current.text === text && now - lastToast.current.at < 1500) return
    lastToast.current = { text, at: now }
    setToast({ id: now, text })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const bumpLibrary = useCallback(() => setLibraryVersion((v) => v + 1), [])

  useEffect(() => {
    let cancel = false
    const seen = new Set<string>()
    const missing = [...getRecentPlays(), ...getFavorites()].filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      if (typeof item.hasMv !== 'boolean') return true
      // 旧数据把 MKVRID=MV_0 记成了有 MV，这类记录没有海报，需要再核一次。
      return item.hasMv === true && !item.mvPic
    })
    if (!missing.length) return
    void (async () => {
      let changed = false
      for (const item of missing) {
        if (cancel) return
        const info = await resolveMvInfo(item, item.hasMv === true)
        if (!info || cancel) continue
        rememberMusicMv(item.id, info.hasMv, info.mvPic)
        const patch = (song: MusicItem) =>
          song.id === item.id ? { ...song, hasMv: info.hasMv, mvPic: info.mvPic || song.mvPic } : song
        setQueue((list) => list.map(patch))
        setDetail((song) => (song && song.id === item.id ? patch(song) : song))
        setCurrent((song) => (song && song.id === item.id ? patch(song) : song))
        changed = true
      }
      if (!cancel && changed) setMvVersion((version) => version + 1)
    })()
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    mvMusicRef.current = mvMusic
  }, [mvMusic])

  const saveScroll = useCallback(() => {
    const el = mainRef.current
    if (el) scrollMemo.current.set(screenKeyRef.current, el.scrollTop)
  }, [])

  const holdSong = useCallback(() => {
    if (!mvActiveRef.current) return
    const audio = audioRef.current
    if (!audio) return
    const src = audio.getAttribute('src')
    if (src && !heldAudioRef.current) {
      heldAudioRef.current = {
        src: audio.src,
        time: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      }
    }
    yieldNativeAudio()
    if (!audio.paused) userPauseRef.current = true
    audio.pause()
    audio.muted = true
    audio.volume = 0
    if (src) {
      audio.removeAttribute('src')
      audio.load()
    }
  }, [])

  const releaseSong = useCallback((resume: boolean) => {
    const audio = audioRef.current
    const held = heldAudioRef.current
    heldAudioRef.current = null
    if (!audio) return
    applyMediaLevel(audio, getLevels('song').volume)
    if (held?.src) {
      audio.src = held.src
      const applyTime = () => {
        if (held.time > 0) {
          try {
            audio.currentTime = held.time
          } catch {
            /* metadata not ready */
          }
        }
      }
      if (audio.readyState >= 1) applyTime()
      else audio.addEventListener('loadedmetadata', applyTime, { once: true })
    }
    if (resume) {
      const time = held?.time ?? 0
      void audio.play()
        .then(() => {
          if (time > 0.5) audio.currentTime = time
        })
        .catch(() => setPlaying(false))
    }
  }, [])

  const closeMv = useCallback((resume = true) => {
    mvToken.current += 1
    mvActiveRef.current = false
    setMvMusic(null)
    setMvUrl('')
    setMvChoices([])
    setMvLoading(false)
    const shouldResume = resume && resumeAudioRef.current
    resumeAudioRef.current = false
    window.setTimeout(() => {
      if (mvActiveRef.current) return
      releaseSong(shouldResume)
    }, 160)
  }, [releaseSong])

  const reportPlayError = useCallback(
    (error: unknown) => {
      if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')) return
      notify(friendlyError(error, TEXT.playFailed))
    },
    [notify],
  )

  const primeNativeQueue = useCallback(async () => {
    if (!hasNativeAudio()) return
    const token = ++primeGenRef.current
    const cur = currentRef.current
    const src = audioRef.current?.getAttribute('src') || ''
    if (!cur || !src) {
      primedNextRef.current = null
      primedPrevRef.current = null
      prepareRepeatOne(false)
      prepareUpcoming([], false)
      prepareNativeNext(null)
      prepareNativePrev(null)
      return
    }
    const mode = playModeRef.current
    const list = queueRef.current
    const history = playHistoryRef.current.slice()
    const fresh = () => token === primeGenRef.current && currentRef.current?.id === cur.id && playModeRef.current === mode
    const repeatOne = mode === 'single' || list.length <= 1
    prepareRepeatOne(repeatOne)
    const planned = planUpcoming({
      list,
      currentId: cur.id,
      mode,
      history,
      limit: mode === 'list' ? list.length : 24,
    })
    const steps = planned.steps.slice(0, 36)
    if (repeatOne || steps.length === 0) {
      primedNextRef.current = null
      prepareUpcoming([], false)
      prepareNativeNext(null)
    } else {
      const slots: ({ pending: true } | { pending: false; track: PrimedTrack | null })[] = steps.map(() => ({ pending: true }))
      const publish = () => {
        if (!fresh()) return
        const tracks: PrimedTrack[] = []
        for (const slot of slots) {
          if (slot.pending) break
          if (slot.track) tracks.push(slot.track)
        }
        const settled = slots.every((slot) => !slot.pending)
        tracks.forEach((track) => rememberNativeTrack(nativeTracksRef.current, track))
        primedNextRef.current = tracks[0] ?? null
        const loop = settled && planned.loop && steps.length === planned.steps.length && tracks.length === steps.length
        prepareUpcoming(tracks.map(nativeInfo), loop)
      }
      let cursor = 0
      const workers = Array.from({ length: Math.min(4, steps.length) }, async () => {
        while (cursor < steps.length) {
          const index = cursor
          cursor += 1
          const step = steps[index]
          let track: PrimedTrack | null = null
          try {
            track = await resolveNativeTrack(cur, src, { item: step.item, history: step.history, replay: false })
          } catch {
            track = null
          }
          if (!fresh()) return
          slots[index] = { pending: false, track }
          publish()
        }
      })
      await Promise.all(workers)
    }
    const prev = resolveAdvance({ list, currentId: cur.id, mode, direction: 'prev', history })
    try {
      const prevTrack = await resolveNativeTrack(cur, src, prev)
      if (!fresh()) return
      primedPrevRef.current = prevTrack
      rememberNativeTrack(nativeTracksRef.current, prevTrack)
      prepareNativePrev(prevTrack ? nativeInfo(prevTrack) : null)
    } catch {
      if (!fresh()) return
      primedPrevRef.current = null
      prepareNativePrev(null)
    }
  }, [])

  const ensurePlay = useCallback(async (music: MusicItem, br?: string) => {
    const audio = audioRef.current
    if (!audio) return
    if (mvActiveRef.current) return
    if (loadedIdRef.current === music.id && audio.getAttribute('src')) {
      playToken.current += 1
      playInFlightRef.current = false
      setCurrent(music)
      setDetail((d) => (d ? music : d))
      applyMediaLevel(audio, getLevels('song').volume)
      noteNativeSong(music.id)
      noteNativeTrack(music.title, music.artist, coverUrl(music.image, 300), isFavorite(music.id))
      if (audio.paused) await audio.play().catch(() => setPlaying(false))
      void primeNativeQueue()
      return
    }
    const token = ++playToken.current
    playInFlightRef.current = true
    setCurrent(music)
    currentRef.current = music
    heardTimeRef.current = 0
    noteNativeSong(music.id)
    noteNativeTrack(music.title, music.artist, coverUrl(music.image, 300), isFavorite(music.id))
    if (audio.getAttribute('src') && !audio.paused) {
      skipEndRef.current = true
      userPauseRef.current = true
      audio.pause()
    }
    addRecentPlay(music)
    setLibraryVersion((v) => v + 1)
    setDetail((d) => (d ? music : d))
    try {
      const quality = br || getSettings().quality
      const meta = await getPlayMeta(music.id, quality)
      if (token !== playToken.current || mvActiveRef.current) {
        if (token === playToken.current) {
          skipEndRef.current = false
          finishedSrcRef.current = ''
        }
        return
      }
      if (audio.getAttribute('src') !== meta.url) {
        audio.src = meta.url
      }
      loadedIdRef.current = music.id
      applyMediaLevel(audio, getLevels('song').volume)
      noteNativeTrack(music.title, music.artist, coverUrl(music.image, 300), isFavorite(music.id))
      await audio.play()
      void primeNativeQueue()
      if (mvActiveRef.current) holdSong()
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError'
      if (aborted && token === playToken.current && !mvActiveRef.current) {
        void primeNativeQueue()
        return
      }
      console.error(e)
      skipEndRef.current = false
      finishedSrcRef.current = ''
      setPlaying(false)
      if (token === playToken.current && !mvActiveRef.current) reportPlayError(e)
    } finally {
      if (token === playToken.current) playInFlightRef.current = false
    }
  }, [holdSong, primeNativeQueue, reportPlayError])

  const playRelative = useCallback(
    (delta: number) => {
      const cur = currentRef.current
      if (!cur) return
      const result = resolveAdvance({
        list: queueRef.current,
        currentId: cur.id,
        mode: playModeRef.current,
        direction: delta < 0 ? 'prev' : 'next',
        history: playHistoryRef.current,
      })
      playHistoryRef.current = result.history
      const audio = audioRef.current
      if (result.replay || !result.item || result.item.id === cur.id) {
        if (!audio || mvActiveRef.current) return
        audio.currentTime = 0
        void audio.play().catch(() => setPlaying(false))
        return
      }
      setDetail(result.item)
      void ensurePlay(result.item)
    },
    [ensurePlay],
  )

  const cyclePlayMode = useCallback(() => {
    setPlayMode((mode) => {
      const next = nextPlayMode(mode)
      savePlayMode(next)
      playModeRef.current = next
      if (next !== 'shuffle') playHistoryRef.current = []
      void primeNativeQueue()
      return next
    })
  }, [primeNativeQueue])

  const playFromList = useCallback(
    (item: MusicItem, nextQueue?: MusicItem[]) => {
      if (nextQueue) {
        setQueue(nextQueue)
        playHistoryRef.current = []
      } else if (
        playModeRef.current === 'shuffle' &&
        currentRef.current &&
        currentRef.current.id !== item.id
      ) {
        playHistoryRef.current = [...playHistoryRef.current, currentRef.current.id].slice(-50)
      }
      setQueueOpen(false)
      if (mvActiveRef.current) closeMv(false)
      if (currentRef.current?.id === item.id) {
        const audio = audioRef.current
        if (audio?.paused) void audio.play().catch(() => setPlaying(false))
        return
      }
      setDetail((d) => (d ? item : d))
      void ensurePlay(item)
    },
    [ensurePlay, closeMv],
  )

  const playMv = useCallback(async (music: MusicItem) => {
    if (music.hasMv === false) {
      notify('这首歌暂时没有 MV')
      return
    }
    saveScroll()
    const token = ++mvToken.current
    const audio = audioRef.current
    resumeAudioRef.current =
      Boolean(audio && audio.getAttribute('src') && !audio.paused) || playInFlightRef.current
    mvActiveRef.current = true
    holdSong()
    setMvMusic(music)
    setMvUrl('')
    setMvChoices(music.mvQualities ?? [])
    setMvLoading(true)
    const request = ++mvRequest.current
    try {
      const available = music.mvQualities ?? (await getAvailableMvQualities(music.id))
      if (!available.length) throw new Error('这首歌暂时没有可播放的 MV')
      if (token !== mvToken.current || request !== mvRequest.current) return
      setMvChoices(available)
      const quality = bestMvQuality(getSettings().mvQuality, available)
      setMvQuality(quality)
      const source = await getMvUrl(music.id, quality)
      if (token !== mvToken.current || request !== mvRequest.current) return
      holdSong()
      setMvUrl(source.url)
      setMvQuality(source.quality || quality)
    } catch (error) {
      if (token !== mvToken.current || request !== mvRequest.current) return
      mvActiveRef.current = false
      setMvMusic(null)
      setMvUrl('')
      const message = error instanceof Error ? error.message : 'MV 播放失败'
      notify(message.includes('没有') ? message : friendlyError(error, 'MV 暂时走神了，请稍后再试'))
      if (message.includes('没有')) {
        rememberMusicMv(music.id, false)
        const patch = (song: MusicItem) => (song.id === music.id ? { ...song, hasMv: false } : song)
        setQueue((list) => list.map(patch))
        setDetail((song) => (song && song.id === music.id ? patch(song) : song))
        setCurrent((song) => (song && song.id === music.id ? patch(song) : song))
        setNoMvStamp({ id: music.id, token: Date.now() })
        setMvVersion((version) => version + 1)
      }
      const shouldResume = resumeAudioRef.current
      resumeAudioRef.current = false
      releaseSong(shouldResume)
    } finally {
      if (token === mvToken.current && request === mvRequest.current) setMvLoading(false)
    }
  }, [holdSong, releaseSong, saveScroll, notify])

  const changeMvQuality = useCallback(async (quality: string) => {
    const music = mvMusicRef.current
    if (!music || (mvChoices.length > 0 && !mvChoices.includes(quality))) return
    saveSettings({ mvQuality: quality })
    setMvQuality(quality)
    setMvUrl('')
    const token = mvToken.current
    const request = ++mvRequest.current
    setMvLoading(true)
    try {
      const source = await getMvUrl(music.id, quality)
      if (token !== mvToken.current || request !== mvRequest.current) return
      setMvUrl(source.url)
      setMvQuality(source.quality || quality)
    } catch (error) {
      if (token !== mvToken.current || request !== mvRequest.current) return
      notify(error instanceof Error ? error.message : '切换画质失败')
    } finally {
      if (token === mvToken.current && request === mvRequest.current) setMvLoading(false)
    }
  }, [mvChoices, notify])

  useEffect(() => {
    const syncDownload = () => {
      setDlGuideHidden(false)
      setDlError('')
      setPendingDl(readPendingDownload())
    }
    syncDownload()
    window.addEventListener('hashchange', syncDownload)
    return () => window.removeEventListener('hashchange', syncDownload)
  }, [])

  useEffect(() => {
    const audio = createSongPlayer()
    audio.preload = 'metadata'
    audioRef.current = audio

    const onTime = () => {
      if (Number.isFinite(audio.currentTime)) heardTimeRef.current = audio.currentTime
      setCurrentTime(audio.currentTime)
    }
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration)
    }
    const onPlay = () => {
      if (mvActiveRef.current) {
        holdSong()
        return
      }
      setPlaying(true)
    }
    const onPlaying = () => {
      skipEndRef.current = false
      finishedSrcRef.current = ''
      if (mvActiveRef.current) holdSong()
    }
    const reachedEnd = () => {
      const duration = audio.duration
      if (!Number.isFinite(duration) || duration < 1) return false
      const time = Math.max(audio.currentTime || 0, heardTimeRef.current)
      return time >= duration - 1
    }
    const finishTrack = () => {
      if (hasNativeAudio() && !audio.ended) return
      if (skipEndRef.current || mvActiveRef.current || heldAudioRef.current) return
      const src = audio.getAttribute('src') || ''
      const cur = currentRef.current
      if (!cur || !src || src === finishedSrcRef.current) {
        if (!cur) setPlaying(false)
        return
      }
      skipEndRef.current = true
      finishedSrcRef.current = src
      const result = resolveAdvance({
        list: queueRef.current,
        currentId: cur.id,
        mode: playModeRef.current,
        direction: 'ended',
        history: playHistoryRef.current,
      })
      playHistoryRef.current = result.history
      if (result.replay || !result.item || result.item.id === cur.id) {
        audio.currentTime = 0
        void audio.play().catch(() => {
          skipEndRef.current = false
          finishedSrcRef.current = ''
          setPlaying(false)
        })
        return
      }
      setDetail((d) => (d ? result.item : d))
      void ensurePlay(result.item)
    }
    const onPause = () => {
      setPlaying(false)
      if (userPauseRef.current) {
        userPauseRef.current = false
        return
      }
      if (hasNativeAudio()) return
      if (skipEndRef.current || mvActiveRef.current || heldAudioRef.current || !audio.getAttribute('src')) return
      if (audio.ended || reachedEnd()) finishTrack()
    }
    const onError = () => {
      if (!audio.getAttribute('src') || mvActiveRef.current || heldAudioRef.current) return
      setPlaying(false)
      notify(navigator.onLine === false ? TEXT.network : TEXT.playFailed)
    }
    const onEnded = () => {
      if (mvActiveRef.current) {
        setPlaying(false)
        return
      }
      finishTrack()
    }
    let stamp = 0
    let stampAt = Date.now()
    const watchEnd = window.setInterval(() => {
      if (hasNativeAudio()) return
      const time = Number.isFinite(audio.currentTime) ? audio.currentTime : 0
      if (time > stamp + 0.25) {
        stamp = time
        stampAt = Date.now()
        return
      }
      if (audio.paused || skipEndRef.current || userPauseRef.current || mvActiveRef.current) return
      if (Date.now() - stampAt < 2000 || !reachedEnd()) return
      finishTrack()
    }, 1000)

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    const syncVolume = (event?: Event) => {
      const scope = event instanceof CustomEvent ? event.detail : undefined
      if (scope && scope !== 'song') return
      if (mvActiveRef.current) return
      applyMediaLevel(audio, getLevels('song').volume)
    }
    syncVolume()
    window.addEventListener(LEVELS_EVENT, syncVolume)

    return () => {
      window.clearInterval(watchEnd)
      userPauseRef.current = true
      window.removeEventListener(LEVELS_EVENT, syncVolume)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
      audioRef.current = null
    }
  }, [ensurePlay, holdSong, notify])

  useEffect(() => {
    const onAdvanced = (event: Event) => {
      if (mvActiveRef.current) return
      const url = event instanceof CustomEvent ? String(event.detail || '') : ''
      const primed =
        (url ? nativeTracksRef.current.get(url) : undefined) ??
        [primedNextRef.current, primedPrevRef.current].find((track) => track && url && track.url === url) ??
        null
      primedNextRef.current = null
      primedPrevRef.current = null
      heardTimeRef.current = 0
      skipEndRef.current = false
      finishedSrcRef.current = ''
      const cur = currentRef.current
      if (primed && cur && primed.item.id !== cur.id) {
        playHistoryRef.current = primed.history
        currentRef.current = primed.item
        loadedIdRef.current = primed.item.id
        setCurrent(primed.item)
        addRecentPlay(primed.item)
        setLibraryVersion((version) => version + 1)
        setDetail((song) => (song ? primed.item : song))
        noteNativeSong(primed.item.id)
        noteNativeTrack(primed.item.title, primed.item.artist, coverUrl(primed.item.image, 300), isFavorite(primed.item.id))
      }
      setCurrentTime(0)
      setDuration(0)
      setPlaying(true)
      void primeNativeQueue()
    }
    window.addEventListener('fmusic-native-advanced', onAdvanced)
    return () => window.removeEventListener('fmusic-native-advanced', onAdvanced)
  }, [primeNativeQueue])

  useEffect(() => {
    const syncVisible = () => {
      if (document.visibilityState !== 'visible' || mvActiveRef.current || !hasNativeAudio()) return
      const url = currentNativeUrl()
      const primed = url ? nativeTracksRef.current.get(url) : undefined
      if (!primed || currentRef.current?.id === primed.item.id) return
      playHistoryRef.current = primed.history
      currentRef.current = primed.item
      loadedIdRef.current = primed.item.id
      heardTimeRef.current = 0
      skipEndRef.current = false
      finishedSrcRef.current = ''
      setCurrent(primed.item)
      addRecentPlay(primed.item)
      setLibraryVersion((version) => version + 1)
      setDetail((song) => (song ? primed.item : song))
      noteNativeSong(primed.item.id)
      noteNativeTrack(primed.item.title, primed.item.artist, coverUrl(primed.item.image, 300), isFavorite(primed.item.id))
      setPlaying(true)
      void primeNativeQueue()
    }
    document.addEventListener('visibilitychange', syncVisible)
    return () => document.removeEventListener('visibilitychange', syncVisible)
  }, [primeNativeQueue])

  useEffect(() => {
    void (async () => {
      void postAccess()
      const u = await getUpdate()
      if (u && u.version && u.version !== '1.0.10') {
        setUpdate(u)
      }
    })()
  }, [])

  useEffect(() => {
    if (!mvMusic) return
    holdSong()
    const timer = window.setInterval(() => holdSong(), 400)
    return () => window.clearInterval(timer)
  }, [mvMusic, holdSong])

  useLayoutEffect(() => {
    const el = mainRef.current
    if (!el) return
    const previous = el.style.scrollBehavior
    el.style.scrollBehavior = 'auto'
    el.scrollTop = scrollMemo.current.get(screenKey) ?? 0
    el.style.scrollBehavior = previous
  }, [screenKey, mvMusic])

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current
    playToken.current += 1
    playInFlightRef.current = false
    if (audio) {
      if (!audio.paused) userPauseRef.current = true
      audio.pause()
      applyMediaLevel(audio, getLevels('song').volume)
      if (audio.getAttribute('src')) {
        audio.removeAttribute('src')
        audio.load()
      }
    }
    heldAudioRef.current = null
    primedNextRef.current = null
    primedPrevRef.current = null
    nativeTracksRef.current.clear()
    loadedIdRef.current = ''
    prepareNativeNext(null)
    prepareNativePrev(null)
    currentRef.current = null
    setPlaying(false)
    setCurrent(null)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !current || mvActiveRef.current) return
    if (audio.paused) {
      void audio.play().catch(() => {
        void ensurePlay(current)
      })
    } else {
      userPauseRef.current = true
      audio.pause()
    }
  }, [current, ensurePlay])

  const seek = useCallback((t: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = t
    setCurrentTime(t)
  }, [])

  useEffect(() => {
    const onCommand = (event: Event) => {
      const command = event instanceof CustomEvent ? String(event.detail || '') : ''
      if (command === 'next') playRelative(1)
      else if (command === 'prev') playRelative(-1)
      else if (command === 'toggle') togglePlay()
      else if (command === 'close') stopPlayback()
      else if (command === 'lyric') {
        const song = currentRef.current
        if (!song) return
        void getLyric(song.id)
          .then((lines) => {
            if (currentRef.current?.id === song.id) noteNativeLyrics(lines)
          })
          .catch(() => {
            if (currentRef.current?.id === song.id) noteNativeLyrics([])
          })
      } else if (command === 'favorite' || command.startsWith('favorite:')) {
        const song = currentRef.current
        if (!song) return
        const want = command === 'favorite' ? !isFavorite(song.id) : command.endsWith('1')
        if (isFavorite(song.id) === want) {
          noteNativeFavorite(want)
          return
        }
        toggleFavorite(song)
        bumpLibrary()
        notify(want ? TEXT.favorited : TEXT.unfavorited)
      }
    }
    window.addEventListener('fmusic-native-command', onCommand)
    return () => window.removeEventListener('fmusic-native-command', onCommand)
  }, [playRelative, togglePlay, stopPlayback, bumpLibrary, notify])

  useEffect(() => {
    if (!hasNativeAudio()) return
    const song = current
    if (!song) {
      noteNativeSong('')
      noteNativeLyrics([])
      return
    }
    noteNativeSong(song.id)
    let cancel = false
    void getLyric(song.id)
      .then((lines) => {
        if (!cancel && currentRef.current?.id === song.id) noteNativeLyrics(lines)
      })
      .catch(() => {
        if (!cancel && currentRef.current?.id === song.id) noteNativeLyrics([])
      })
    return () => {
      cancel = true
    }
  }, [current?.id])

  useEffect(() => {
    if (!currentRef.current) return
    void primeNativeQueue()
  }, [queue, primeNativeQueue])

  useEffect(() => {
    const song = currentRef.current
    if (!song) return
    noteNativeFavorite(isFavorite(song.id))
  }, [libraryVersion, current?.id])

  const openMusic = useCallback(
    (item: MusicItem, list?: MusicItem[]) => {
      saveScroll()
      const q = list && list.length ? list : [item]
      setQueue(q)
      playHistoryRef.current = []
      setDetail(item)
      if (mvActiveRef.current && mvMusicRef.current?.id !== item.id) closeMv(false)
      void ensurePlay(item)
    },
    [saveScroll, closeMv, ensurePlay],
  )

  const playList = useCallback(
    (list: MusicItem[], index = 0, label?: string) => {
      if (!list.length) return
      const start =
        playModeRef.current === 'shuffle' && index === 0 ? Math.floor(Math.random() * list.length) : index
      const item = list[Math.min(start, list.length - 1)]!
      setQueue(list)
      playHistoryRef.current = []
      setQueueOpen(false)
      if (mvActiveRef.current) closeMv(false)
      setDetail((d) => (d ? item : d))
      void ensurePlay(item)
      notify(label ? `开始播放「${label}」` : `开始播放「${item.title}」`)
    },
    [closeMv, ensurePlay, notify],
  )

  const openComments = useCallback(
    (item: MusicItem, list?: MusicItem[]) => {
      if (detailRef.current?.id === item.id) {
        setCommentsToken((t) => t + 1)
        return
      }
      if (currentRef.current?.id === item.id) {
        saveScroll()
        setDetail(currentRef.current)
        setCommentsToken((t) => t + 1)
        return
      }
      openMusic(item, list)
      setCommentsToken((t) => t + 1)
    },
    [openMusic, saveScroll],
  )

  const playNext = useCallback(
    (item: MusicItem) => {
      const cur = currentRef.current
      if (!cur) {
        playList([item])
        return
      }
      if (cur.id === item.id) {
        notify('正在播放这首歌')
        return
      }
      setQueue((list) => {
        const rest = list.filter((song) => song.id !== item.id)
        const at = rest.findIndex((song) => song.id === cur.id)
        rest.splice(at + 1, 0, item)
        return rest
      })
      notify('已安排在下一首播放')
    },
    [notify, playList],
  )

  const share = useCallback(
    (target: ShareTarget) => {
      void shareTarget(target).then((text) => {
        if (text) notify(text)
      })
    },
    [notify],
  )

  const addToPlaylist = useCallback((item: MusicItem) => setPicker(item), [])

  const openSongMenu = useCallback((item: MusicItem, list?: MusicItem[], extra?: SongMenuExtra[]) => {
    setMenu({ item, list, extra })
  }, [])

  const openQueue = useCallback(() => setQueueOpen(true), [])

  const pushView = useCallback(
    (view: View) => {
      saveScroll()
      const prev = stackRef.current
      let next: Entry[]
      const searchAt = view.kind === 'search' ? prev.findIndex((entry) => entry.view.kind === 'search') : -1
      if (searchAt >= 0) {
        prev.slice(searchAt + 1).forEach((entry) => scrollMemo.current.delete(`view:${entry.key}`))
        next = prev.slice(0, searchAt + 1)
      } else {
        const last = prev[prev.length - 1]
        if (last && viewKey(last.view) === viewKey(view) && !detailRef.current) return
        entrySeq.current += 1
        next = [...prev, { key: `${viewKey(view)}#${entrySeq.current}`, view }]
      }
      if (detailRef.current) {
        scrollMemo.current.delete('detail')
        setDetail(null)
      }
      setStack(next)
    },
    [saveScroll],
  )

  /** 退一层：先关播放页，再出栈。 */
  const popLevel = useCallback(() => {
    if (detailRef.current) {
      scrollMemo.current.delete('detail')
      setDetail(null)
      return true
    }
    const prev = stackRef.current
    const last = prev[prev.length - 1]
    if (!last) return false
    scrollMemo.current.delete(`view:${last.key}`)
    const next = prev.slice(0, -1)
    stackRef.current = next
    setStack(next)
    return true
  }, [])

  const goTab = useCallback(
    (next: TabId) => {
      if (!detailRef.current && !stackRef.current.length && tabRef.current === next) {
        mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      saveScroll()
      stackRef.current.forEach((entry) => scrollMemo.current.delete(`view:${entry.key}`))
      scrollMemo.current.delete('detail')
      setStack([])
      setDetail(null)
      setTab(next)
      setVisited((list) => (list.includes(next) ? list : [...list, next]))
    },
    [saveScroll],
  )

  // 页面层级和浏览器历史对齐：手机返回键、侧滑返回都回到上一层，而不是离开网站。
  const depth = stack.length + (detail ? 1 : 0)
  const pushedRef = useRef(0)
  const skipPops = useRef(0)
  const overlayOpen = !!mvMusic || queueOpen || !!menu || !!picker || !!creating
  const overlayRef = useRef(overlayOpen)
  overlayRef.current = overlayOpen

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  }, [])

  useEffect(() => {
    if (depth > pushedRef.current) {
      for (let level = pushedRef.current + 1; level <= depth; level += 1) {
        history.pushState({ depth: level } satisfies HistoryMark, '')
      }
      pushedRef.current = depth
    } else if (depth < pushedRef.current) {
      const steps = pushedRef.current - depth
      pushedRef.current = depth
      skipPops.current += 1
      history.go(-steps)
    }
  }, [depth])

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      if (location.hash.startsWith('#dl=')) return
      if (skipPops.current > 0) {
        skipPops.current -= 1
        return
      }
      const target = Number((event.state as HistoryMark | null)?.depth ?? 0)
      if (target >= pushedRef.current) return
      let steps = pushedRef.current - target
      pushedRef.current = target
      if (overlayRef.current) {
        if (mvActiveRef.current) closeMv()
        setQueueOpen(false)
        setMenu(null)
        setPicker(null)
        setCreating(null)
        steps -= 1
        if (steps <= 0) {
          pushedRef.current += 1
          history.pushState({ depth: pushedRef.current } satisfies HistoryMark, '')
          return
        }
      }
      while (steps > 0 && popLevel()) steps -= 1
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [closeMv, popLevel])

  useEffect(() => {
    const link = readSharedLink()
    if (!link) return
    clearSharedLink()
    if (link.kind === 'playlist') {
      pushView({ kind: 'playlist', id: link.id })
      return
    }
    openMusic(link.music, [link.music])
    void resolveMvInfo(link.music, true).then((info) => {
      if (!info) return
      const patch = (song: MusicItem) =>
        song.id === link.music.id ? { ...song, hasMv: info.hasMv, mvPic: info.mvPic || song.mvPic } : song
      setQueue((list) => list.map(patch))
      setDetail((song) => (song ? patch(song) : song))
      setCurrent((song) => (song ? patch(song) : song))
    })
    // 只在打开页面时读一次分享链接。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const actions = useMemo<AppActions>(
    () => ({
      open: pushView,
      back: popLevel,
      goTab,
      playList,
      openMusic,
      openComments,
      playNext,
      playMv: (item) => void playMv(item),
      notify,
      share,
      addToPlaylist,
      openSongMenu,
      openQueue,
      current,
      currentId: current?.id ?? null,
      playing,
      libraryVersion,
      bumpLibrary,
      mvVersion,
    }),
    [
      pushView,
      popLevel,
      goTab,
      playList,
      openMusic,
      openComments,
      playNext,
      playMv,
      notify,
      share,
      addToPlaylist,
      openSongMenu,
      openQueue,
      current,
      playing,
      libraryVersion,
      bumpLibrary,
      mvVersion,
    ],
  )

  const menuEntries = (target: NonNullable<typeof menu>): MenuEntry[] => {
    const { item, list, extra } = target
    const fav = isFavorite(item.id)
    const entries: MenuEntry[] = [
      { key: 'next', icon: <NextIcon />, label: '下一首播放', run: () => playNext(item) },
      {
        key: 'fav',
        icon: <HeartIcon filled={fav} />,
        label: fav ? '从音乐宇宙移出' : TEXT.favorite,
        run: () => {
          const on = toggleFavorite(item)
          notify(on ? TEXT.favorited : TEXT.unfavorited)
          bumpLibrary()
        },
      },
      { key: 'list', icon: <AddListIcon />, label: '收藏到歌单', run: () => addToPlaylist(item) },
      { key: 'comment', icon: <CommentIcon />, label: '查看评论', run: () => openComments(item, list) },
    ]
    if (item.hasMv) entries.push({ key: 'mv', icon: <MvIcon />, label: '播放MV', run: () => void playMv(item) })
    entries.push({ key: 'share', icon: <ShareIcon />, label: TEXT.share, run: () => share({ kind: 'song', music: item }) })
    extra?.forEach((entry, index) =>
      entries.push({ key: `extra-${index}`, icon: <TrashIcon />, label: entry.label, danger: entry.danger, run: entry.run }),
    )
    return entries
  }

  const showMini = !!current && !detail && !mvMusic
  const canSwitch = queue.length > 1
  const onTab = !detail && !top
  const backdrop = detail ? coverUrl(detail.image, 500) : ''

  const renderTab = (id: TabId, active: boolean) => {
    switch (id) {
      case 'home':
        return <HomePage active={active} />
      case 'discover':
        return <DiscoverPage active={active} />
      case 'charts':
        return <ChartsPage />
      case 'community':
        return <CommunityPage active={active} />
      case 'mine':
        return <MinePage />
    }
  }

  const renderView = (view: View, active: boolean) => {
    switch (view.kind) {
      case 'search':
        return null
      case 'chart':
        return <ChartView id={view.id} name={view.name} active={active} />
      case 'playlist':
        return <PlaylistView id={view.id} name={view.name} pic={view.pic} active={active} />
      case 'pick':
        return <PickView id={view.id} />
      case 'artist':
        return <ArtistView id={view.id} name={view.name} pic={view.pic} active={active} />
      case 'daily':
        return <DailyView />
      case 'private':
        return <PrivateView />
      case 'radio':
        return <RadioPage />
      case 'myPlaylist':
        return <MyPlaylistView id={view.id} />
      case 'favorite':
        return <FavoritePage />
      case 'recent':
        return <RecentView />
      case 'download':
        return <DownloadPage />
      case 'setting':
        return <SettingPage />
    }
  }

  return (
    <AppContext.Provider value={actions}>
      <div className={`app-shell${detail ? ' is-player' : ''}`}>
        {backdrop ? (
          <div className="player-backdrop" style={{ backgroundImage: `url(${JSON.stringify(backdrop)})` }} aria-hidden="true" />
        ) : null}
        {!detail ? (
          top ? (
            <SubHeader title={viewTitle(top.view)} onBack={popLevel} />
          ) : (
            <TopBar playing={playing} onSearch={() => pushView({ kind: 'search' })} />
          )
        ) : null}

        <main
          ref={mainRef}
          className={`app-main${detail ? ' detail-mode' : top ? ' view-mode' : ''}${showMini ? ' has-mini' : ''}`}
        >
          {visited.map((id) => {
            const shown = onTab && tab === id
            return (
              <div key={id} className={shown ? 'pane' : 'pane-hidden'}>
                {renderTab(id, shown && !mvMusic)}
              </div>
            )
          })}
          {stack.map((entry, index) => {
            if (entry.view.kind === 'search') return null
            const shown = !detail && index === stack.length - 1
            return (
              <div key={entry.key} className={shown ? 'pane' : 'pane-hidden'}>
                {renderView(entry.view, shown && !mvMusic)}
              </div>
            )
          })}
          <div className={!detail && top?.view.kind === 'search' ? 'pane' : 'pane-hidden'}>
            <SearchPage active={!detail && top?.view.kind === 'search'} noMvStamp={noMvStamp} />
          </div>
          {detail ? (
            <MusicDetailPage
              music={detail}
              playing={playing}
              currentTime={currentTime}
              duration={duration}
              canPrev={canSwitch}
              canNext={canSwitch}
              commentsToken={commentsToken}
              onBack={popLevel}
              onTogglePlay={togglePlay}
              onSeek={seek}
              onPrev={() => playRelative(-1)}
              onNext={() => playRelative(1)}
              onEnsurePlay={ensurePlay}
              playMode={playMode}
              onCycleMode={cyclePlayMode}
              onOpenQueue={() => setQueueOpen(true)}
              onPlayMv={(item) => void playMv(item)}
            />
          ) : null}
        </main>

        {showMini && current ? (
          <MiniPlayer
            music={current}
            playing={playing}
            progress={duration > 0 ? currentTime / duration : 0}
            low={!!top}
            onOpen={() => {
              saveScroll()
              setDetail(current)
            }}
            onToggle={togglePlay}
            onQueue={() => setQueueOpen(true)}
            onClose={stopPlayback}
          />
        ) : null}

        {onTab ? <BottomBar active={tab} onChange={goTab} /> : null}

        <Dialogs
          update={update}
          notification={null}
          onCloseUpdate={() => setUpdate(null)}
          onCloseNotification={() => {}}
        />
        <PlayQueueSheet
          open={queueOpen}
          queue={queue}
          recent={queueOpen ? getRecentPlays() : []}
          currentId={current?.id ?? null}
          onClose={() => setQueueOpen(false)}
          onPickQueue={(item) => playFromList(item)}
          onPickRecent={(item) => {
            const list = getRecentPlays()
            const next = list.some((x) => x.id === item.id) ? list : [item, ...list]
            playFromList(item, next)
          }}
          onPlayMv={(item) => {
            setQueueOpen(false)
            void playMv(item)
          }}
        />
        {menu ? <SongMenu item={menu.item} entries={menuEntries(menu)} onClose={() => setMenu(null)} /> : null}
        {picker ? (
          <PlaylistPicker
            item={picker}
            lists={getMyPlaylists()}
            onClose={() => setPicker(null)}
            onCreate={() => {
              setCreating(picker)
              setPicker(null)
            }}
            onPick={(list) => {
              const added = addToMyPlaylist(list.id, picker)
              notify(added ? `已收进「${list.name}」` : '这首歌已经在歌单里啦')
              setPicker(null)
              bumpLibrary()
            }}
          />
        ) : null}
        {creating ? (
          <PromptDialog
            title={TEXT.createPlaylist}
            placeholder="给歌单起个名字，比如：深夜循环"
            confirm="创建并收藏"
            onClose={() => setCreating(null)}
            onSubmit={(name) => {
              const list = createMyPlaylist(name)
              addToMyPlaylist(list.id, creating)
              notify(`已创建「${list.name}」并收进这首歌`)
              setCreating(null)
              bumpLibrary()
            }}
          />
        ) : null}
        {mvMusic ? (
          <MvPlayer
            music={mvMusic}
            url={mvUrl}
            quality={mvQuality}
            qualities={mvChoices}
            loading={mvLoading}
            onClose={() => closeMv()}
            onQuality={(quality) => void changeMvQuality(quality)}
          />
        ) : null}
        {toast ? (
          <div
            key={toast.id}
            className={`toast${showMini ? ' above-mini' : ''}${onTab ? ' above-nav' : ''}`}
            role="status"
            style={{ '--toast-life': '2.6s' } as CSSProperties}
          >
            {toast.text}
          </div>
        ) : null}
        <DownloadGuide
          pending={dlGuideHidden ? null : pendingDl}
          saving={dlSaving}
          error={dlError}
          onClose={() => {
            if (isWeChat()) {
              setDlGuideHidden(true)
              return
            }
            clearPendingDownload()
            setPendingDl(null)
          }}
          onSave={() => {
            if (!pendingDl || dlSaving) return
            setDlSaving(true)
            setDlError('')
            void saveTrackFile(pendingDl.url, pendingDl.filename)
              .then(() => {
                clearPendingDownload()
                setPendingDl(null)
              })
              .catch((e: unknown) => {
                setDlError(e instanceof Error ? e.message : '下载失败')
              })
              .finally(() => setDlSaving(false))
          }}
        />
      </div>
    </AppContext.Provider>
  )
}
