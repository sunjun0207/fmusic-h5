import { useCallback, useEffect, useRef, useState } from 'react'
import { BottomBar } from './components/BottomBar'
import { Dialogs } from './components/Dialogs'
import { TopBar } from './components/TopBar'
import { coverUrl, getNotification, getPlayMeta, getUpdate, postAccess } from './lib/api'
import {
  getDismissedNotification,
  getSettings,
  setDismissedNotification,
} from './lib/storage'
import type { MusicItem, NotificationInfo, TabId, UpdateInfo } from './lib/types'
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
  const [notification, setNotification] = useState<NotificationInfo | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [current, setCurrent] = useState<MusicItem | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const playToken = useRef(0)
  const queueRef = useRef<MusicItem[]>([])
  const currentRef = useRef<MusicItem | null>(null)

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    currentRef.current = current
  }, [current])

  const ensurePlay = useCallback(async (music: MusicItem, br?: string) => {
    const audio = audioRef.current
    if (!audio) return
    const token = ++playToken.current
    setCurrent(music)
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
      const list = queueRef.current
      const cur = currentRef.current
      if (!list.length || !cur) return
      const idx = list.findIndex((x) => x.id === cur.id)
      if (idx < 0) return
      const next = list[(idx + delta + list.length) % list.length]
      if (!next) return
      setDetail(next)
      void ensurePlay(next)
    },
    [ensurePlay],
  )

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audioRef.current = audio

    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => setDuration(audio.duration || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      const list = queueRef.current
      const cur = currentRef.current
      if (list.length > 1 && cur) {
        const idx = list.findIndex((x) => x.id === cur.id)
        const next = list[(idx + 1) % list.length]
        if (next) {
          setDetail(next)
          void ensurePlay(next)
          return
        }
      }
      setPlaying(false)
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
      const [u, n] = await Promise.all([getUpdate(), getNotification()])
      if (u && u.version && u.version !== '1.0.10') {
        setUpdate(u)
      }
      const settings = getSettings()
      if (n && settings.showNotification) {
        const key = `${n.title}|${n.create_time}`
        if (getDismissedNotification() !== key) setNotification(n)
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
              ? '听喜欢的歌'
              : tab === 'search'
                ? '酷我直连搜索'
                : tab === 'favorite'
                  ? '我的收藏'
                  : tab === 'download'
                    ? '本地下载记录'
                    : '偏好与关于'
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
          />
        ) : (
          <>
            {tab === 'home' && (
              <HomePage onOpenSearch={() => setTab('search')} onOpenMusic={openMusic} />
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
        notification={notification}
        onCloseUpdate={() => setUpdate(null)}
        onCloseNotification={(forever) => {
          if (forever && notification) {
            setDismissedNotification(`${notification.title}|${notification.create_time}`)
          }
          setNotification(null)
        }}
      />
    </div>
  )
}
