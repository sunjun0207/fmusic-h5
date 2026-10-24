import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BottomBar } from './components/BottomBar'
import { Dialogs } from './components/Dialogs'
import { DownloadGuide } from './components/DownloadGuide'
import { MvPlayer } from './components/MvPlayer'
import { PlayQueueSheet } from './components/PlayQueueSheet'
import { TopBar } from './components/TopBar'
import {
  clearPendingDownload,
  isWeChat,
  readPendingDownload,
  saveTrackFile,
  type PendingDownload,
} from './lib/download'
import { coverUrl, getAvailableMvQualities, getMvUrl, getPlayMeta, getUpdate, postAccess, resolveMvInfo } from './lib/api'
import { nextPlayMode, resolveAdvance } from './lib/playback'
import { bestMvQuality } from './lib/quality'
import {
  addRecentPlay,
  getFavorites,
  getPlayMode,
  getRecentPlays,
  getSettings,
  rememberMusicMv,
  savePlayMode,
  saveSettings,
} from './lib/storage'
import type { MusicItem, PlayMode, TabId, UpdateInfo } from './lib/types'
import { DownloadPage } from './pages/DownloadPage'
import { FavoritePage } from './pages/FavoritePage'
import { HomePage } from './pages/HomePage'
import { MusicDetailPage } from './pages/MusicDetailPage'
import { SearchPage } from './pages/SearchPage'
import { SettingPage } from './pages/SettingPage'

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [detail, setDetail] = useState<MusicItem | null>(null)
  const [queue, setQueue] = useState<MusicItem[]>([])
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [pendingDl, setPendingDl] = useState<PendingDownload | null>(null)
  const [dlGuideHidden, setDlGuideHidden] = useState(false)
  const [dlSaving, setDlSaving] = useState(false)
  const [dlError, setDlError] = useState('')
  const [playMode, setPlayMode] = useState<PlayMode>(() => getPlayMode())
  const [queueOpen, setQueueOpen] = useState(false)
  const [recentVersion, setRecentVersion] = useState(0)
  const [mvVersion, setMvVersion] = useState(0)
  const [mvMusic, setMvMusic] = useState<MusicItem | null>(null)
  const [mvUrl, setMvUrl] = useState('')
  const [mvQuality, setMvQuality] = useState(() => getSettings().mvQuality)
  const [mvChoices, setMvChoices] = useState<string[]>([])
  const [mvLoading, setMvLoading] = useState(false)
  const [mvError, setMvError] = useState('')
  const [noMvStamp, setNoMvStamp] = useState<{ id: string; token: number } | null>(null)

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
  const mainRef = useRef<HTMLElement | null>(null)
  const searchScrollRef = useRef(0)
  const tabRef = useRef(tab)
  const detailRef = useRef(detail)
  tabRef.current = tab
  detailRef.current = detail

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    currentRef.current = current
  }, [current])

  useEffect(() => {
    playModeRef.current = playMode
  }, [playMode])

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

  useEffect(() => {
    if (!mvError) return
    const timer = window.setTimeout(() => setMvError(''), 2800)
    return () => window.clearTimeout(timer)
  }, [mvError])

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
    audio.muted = false
    audio.volume = 1
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
    if (resume) void audio.play().catch(() => setPlaying(false))
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
    releaseSong(shouldResume)
  }, [releaseSong])

  const rememberSearchScroll = useCallback(() => {
    if (tabRef.current !== 'search' || detailRef.current) return
    const el = mainRef.current
    if (el) searchScrollRef.current = el.scrollTop
  }, [])

  const ensurePlay = useCallback(async (music: MusicItem, br?: string) => {
    const audio = audioRef.current
    if (!audio) return
    if (mvActiveRef.current) return
    if (currentRef.current?.id === music.id && audio.getAttribute('src')) {
      playToken.current += 1
      playInFlightRef.current = false
      setCurrent(music)
      setDetail((d) => (d ? music : d))
      audio.muted = false
      audio.volume = 1
      if (audio.paused) await audio.play().catch(() => setPlaying(false))
      return
    }
    const token = ++playToken.current
    playInFlightRef.current = true
    setCurrent(music)
    addRecentPlay(music)
    setRecentVersion((v) => v + 1)
    setDetail((d) => (d ? music : d))
    try {
      const quality = br || getSettings().quality
      const meta = await getPlayMeta(music.id, quality)
      if (token !== playToken.current || mvActiveRef.current) return
      if (audio.getAttribute('src') !== meta.url) {
        audio.src = meta.url
      }
      audio.muted = false
      audio.volume = 1
      await audio.play()
      if (mvActiveRef.current) holdSong()
    } catch (e) {
      console.error(e)
      setPlaying(false)
    } finally {
      if (token === playToken.current) playInFlightRef.current = false
    }
  }, [holdSong])

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
      if (next !== 'shuffle') playHistoryRef.current = []
      return next
    })
  }, [])

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
      setMvError('这首歌暂时没有 MV')
      return
    }
    rememberSearchScroll()
    const token = ++mvToken.current
    const audio = audioRef.current
    resumeAudioRef.current =
      Boolean(audio && audio.getAttribute('src') && !audio.paused) || playInFlightRef.current
    mvActiveRef.current = true
    holdSong()
    setMvError('')
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
      setMvError(message)
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
  }, [holdSong, releaseSong, rememberSearchScroll])

  const changeMvQuality = useCallback(async (quality: string) => {
    const music = mvMusicRef.current
    if (!music || (mvChoices.length > 0 && !mvChoices.includes(quality))) return
    saveSettings({ mvQuality: quality })
    setMvError('')
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
      setMvError(error instanceof Error ? error.message : '切换画质失败')
    } finally {
      if (token === mvToken.current && request === mvRequest.current) setMvLoading(false)
    }
  }, [mvChoices])

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
    const audio = new Audio()
    audio.preload = 'metadata'
    audioRef.current = audio

    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => setDuration(audio.duration || 0)
    const onPlay = () => {
      if (mvActiveRef.current) {
        holdSong()
        return
      }
      setPlaying(true)
    }
    const onPlaying = () => {
      if (mvActiveRef.current) holdSong()
    }
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      if (mvActiveRef.current) {
        setPlaying(false)
        return
      }
      const cur = currentRef.current
      if (!cur) {
        setPlaying(false)
        return
      }
      const result = resolveAdvance({
        list: queueRef.current,
        currentId: cur.id,
        mode: playModeRef.current,
        direction: 'ended',
        history: playHistoryRef.current,
      })
      playHistoryRef.current = result.history
      if (result.replay || !result.item || result.item.id === cur.id) {
        if (mvActiveRef.current) return
        audio.currentTime = 0
        void audio.play().catch(() => setPlaying(false))
        return
      }
      setDetail((d) => (d ? result.item : d))
      void ensurePlay(result.item)
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audioRef.current = null
    }
  }, [ensurePlay, holdSong])

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
    if (detail || tab !== 'search') return
    const el = mainRef.current
    if (!el) return
    const previous = el.style.scrollBehavior
    el.style.scrollBehavior = 'auto'
    el.scrollTop = searchScrollRef.current
    el.style.scrollBehavior = previous
  }, [detail, tab, mvMusic])

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current
    playToken.current += 1
    playInFlightRef.current = false
    if (audio) {
      audio.pause()
      audio.muted = false
      audio.volume = 1
      if (audio.getAttribute('src')) {
        audio.removeAttribute('src')
        audio.load()
      }
    }
    heldAudioRef.current = null
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
      audio.pause()
    }
  }, [current, ensurePlay])

  const seek = useCallback((t: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = t
    setCurrentTime(t)
  }, [])

  const openMusic = (item: MusicItem, list?: MusicItem[]) => {
    rememberSearchScroll()
    const q = list && list.length ? list : [item]
    setQueue(q)
    playHistoryRef.current = []
    setDetail(item)
    if (mvActiveRef.current && mvMusicRef.current?.id !== item.id) closeMv(false)
    void ensurePlay(item)
  }

  const showMini = !!current && !detail && !mvMusic
  const canSwitch = queue.length > 1

  return (
    <div className="app-shell">
      {!detail ? (
        <TopBar
          subtitle={
            tab === 'home'
              ? '把喜欢的歌，慢慢听完'
              : tab === 'search'
                ? '寻一句词，或一个名字'
                : tab === 'favorite'
                  ? '收在心里的歌'
                  : tab === 'download'
                    ? '留在身边的旋律'
                    : '一点偏好，与关于'
          }
        />
      ) : null}

      <main ref={mainRef} className={`app-main${detail ? ' detail-mode' : ''}`}>
        <div className={tab === 'search' && !detail ? undefined : 'pane-hidden'}>
          <SearchPage
            onOpenMusic={openMusic}
            onPlayMv={(item) => void playMv(item)}
            noMvStamp={noMvStamp}
          />
        </div>
        {detail ? (
          <MusicDetailPage
            music={detail}
            playing={playing}
            currentTime={currentTime}
            duration={duration}
            canPrev={canSwitch}
            canNext={canSwitch}
            onBack={() => setDetail(null)}
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
        ) : tab === 'home' ? (
          <HomePage
            onOpenSearch={() => setTab('search')}
            onOpenMusic={openMusic}
            onPlayMv={(item) => void playMv(item)}
            onOpenQueue={() => setQueueOpen(true)}
            queue={queue}
            current={current}
            recentVersion={recentVersion}
            mvVersion={mvVersion}
          />
        ) : tab === 'favorite' ? (
          <FavoritePage onOpenMusic={openMusic} onPlayMv={(item) => void playMv(item)} mvVersion={mvVersion} />
        ) : tab === 'download' ? (
          <DownloadPage />
        ) : tab === 'setting' ? (
          <SettingPage />
        ) : null}
      </main>

      {showMini && current ? (
        <div
          className="mini-player"
          role="button"
          tabIndex={0}
          onClick={() => {
            rememberSearchScroll()
            setDetail(current)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              rememberSearchScroll()
              setDetail(current)
            }
          }}
        >
          {coverUrl(current.image) ? (
            <img src={coverUrl(current.image)} alt="" />
          ) : (
            <div className="mini-cover" />
          )}
          <div className="mini-meta">
            <strong>{current.title}</strong>
            <span>{current.artist}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none' }}
            aria-label="关闭当前播放"
            onClick={(e) => {
              e.stopPropagation()
              stopPlayback()
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none' }}
            aria-label={playing ? '暂停' : '继续播放'}
            onClick={(e) => {
              e.stopPropagation()
              togglePlay()
            }}
          >
            {playing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5-11-6.5Z" />
              </svg>
            )}
          </button>
        </div>
      ) : null}

      {!detail ? (
        <BottomBar
          active={tab}
          onChange={(next) => {
            if (tab === 'search' && next !== 'search') rememberSearchScroll()
            setTab(next)
          }}
        />
      ) : null}

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
      {mvError ? <div className="mv-toast">{mvError}</div> : null}
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
  )
}
