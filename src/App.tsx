import { useCallback, useEffect, useRef, useState } from 'react'
import { BottomBar } from './components/BottomBar'
import { Dialogs } from './components/Dialogs'
import { DownloadGuide } from './components/DownloadGuide'
import { PlayQueueSheet } from './components/PlayQueueSheet'
import { TopBar } from './components/TopBar'
import {
  clearPendingDownload,
  isWeChat,
  readPendingDownload,
  saveTrackFile,
  type PendingDownload,
} from './lib/download'
import { coverUrl, getPlayMeta, getUpdate, postAccess } from './lib/api'
import { nextPlayMode, resolveAdvance } from './lib/playback'
import {
  addRecentPlay,
  getPlayMode,
  getRecentPlays,
  getSettings,
  savePlayMode,
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

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    currentRef.current = current
  }, [current])

  useEffect(() => {
    playModeRef.current = playMode
  }, [playMode])

  const ensurePlay = useCallback(async (music: MusicItem, br?: string) => {
    const audio = audioRef.current
    if (!audio) return
    const token = ++playToken.current
    setCurrent(music)
    addRecentPlay(music)
    setRecentVersion((v) => v + 1)
    setDetail((d) => (d ? music : d))
    try {
      const quality = br || getSettings().quality
      const meta = await getPlayMeta(music.id, quality)
      if (token !== playToken.current) return
      if (audio.getAttribute('src') !== meta.url) {
        audio.src = meta.url
      }
      await audio.play()
    } catch (e) {
      console.error(e)
      setPlaying(false)
    }
  }, [])

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
        if (!audio) return
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
      if (currentRef.current?.id === item.id) {
        const audio = audioRef.current
        if (audio?.paused) void audio.play().catch(() => setPlaying(false))
        return
      }
      setDetail((d) => (d ? item : d))
      void ensurePlay(item)
    },
    [ensurePlay],
  )

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
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
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
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audioRef.current = null
    }
  }, [ensurePlay])

  useEffect(() => {
    void (async () => {
      void postAccess()
      const u = await getUpdate()
      if (u && u.version && u.version !== '1.0.10') {
        setUpdate(u)
      }
    })()
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!current) return
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
    const q = list && list.length ? list : [item]
    setQueue(q)
    playHistoryRef.current = []
    setDetail(item)
    void ensurePlay(item)
  }

  const showMini = !!current && !detail && playing
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

      <main className={`app-main${detail ? ' detail-mode' : ''}`}>
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
          />
        ) : (
          <>
            {tab === 'home' && (
              <HomePage
                onOpenSearch={() => setTab('search')}
                onOpenMusic={openMusic}
                onOpenQueue={() => setQueueOpen(true)}
                queue={queue}
                current={current}
                recentVersion={recentVersion}
              />
            )}
            {tab === 'search' && <SearchPage onOpenMusic={openMusic} />}
            {tab === 'favorite' && <FavoritePage onOpenMusic={openMusic} />}
            {tab === 'download' && <DownloadPage />}
            {tab === 'setting' && <SettingPage />}
          </>
        )}
      </main>

      {showMini && current ? (
        <div
          className="mini-player"
          role="button"
          tabIndex={0}
          onClick={() => setDetail(current)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setDetail(current)
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
            aria-label="播放列表"
            onClick={(e) => {
              e.stopPropagation()
              setQueueOpen(true)
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 7h11M9 12h11M9 17h11" strokeLinecap="round" />
              <path d="M4 7h.01M4 12h.01M4 17h.01" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none' }}
            onClick={(e) => {
              e.stopPropagation()
              togglePlay()
            }}
          >
            {playing ? '❚❚' : '▶'}
          </button>
        </div>
      ) : null}

      {!detail ? <BottomBar active={tab} onChange={setTab} /> : null}

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
      />
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
