import { useEffect, useMemo, useRef, useState } from 'react'
import { coverUrl, getLyric, getPlayMeta, postDownload, toProxyAudioUrl } from '../lib/api'
import { requestDownload, trackExt, trackFilename } from '../lib/download'
import { PLAY_MODE_LABEL } from '../lib/playback'
import { getSettings, isFavorite, toggleFavorite, upsertDownload } from '../lib/storage'
import type { DownloadTask, LyricLine, MusicItem, PlayMode, QualityOption } from '../lib/types'
import { DownloadSheet } from '../components/DownloadSheet'
import { TopBar } from '../components/TopBar'

function PlayModeIcon({ mode }: { mode: PlayMode }) {
  if (mode === 'single') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 21l-3-3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 6H9a5 5 0 0 0-5 5v1" strokeLinecap="round" />
        <path d="M4 18h11a5 5 0 0 0 5-5v-1" strokeLinecap="round" />
        <path d="M11.2 9.2h1.2V15" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (mode === 'shuffle') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 7h2.8c2.2 0 3.3 1.1 4.7 2.8" strokeLinecap="round" />
        <path d="M4 17h2.8c2.2 0 3.3-1.1 4.7-2.8" strokeLinecap="round" />
        <path d="M14 10.2c1.2-1.5 2.2-2.2 3.8-2.2H20" strokeLinecap="round" />
        <path d="M14 13.8c1.2 1.5 2.2 2.2 3.8 2.2H20" strokeLinecap="round" />
        <path d="M16.5 5.5 20 8l-3.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 13.5 20 16l-3.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 3l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 21l-3-3 3-3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 6H8a4 4 0 0 0-4 4v1" strokeLinecap="round" />
      <path d="M4 18h12a4 4 0 0 0 4-4v-1" strokeLinecap="round" />
    </svg>
  )
}

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

type Props = {
  music: MusicItem
  playing: boolean
  currentTime: number
  duration: number
  canPrev: boolean
  canNext: boolean
  playMode: PlayMode
  onBack: () => void
  onTogglePlay: () => void
  onSeek: (t: number) => void
  onPrev: () => void
  onNext: () => void
  onCycleMode: () => void
  onOpenQueue: () => void
  onEnsurePlay: (music: MusicItem, br?: string) => Promise<void>
}

export function MusicDetailPage({
  music,
  playing,
  currentTime,
  duration,
  canPrev,
  canNext,
  onBack,
  onTogglePlay,
  onSeek,
  onPrev,
  onNext,
  onEnsurePlay,
  playMode,
  onCycleMode,
  onOpenQueue,
}: Props) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dlLoading, setDlLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [fav, setFav] = useState(() => isFavorite(music.id))
  const lyricRef = useRef<HTMLDivElement>(null)
  const userSeekingRef = useRef(false)
  const programmaticRef = useRef(false)
  const scrollTimerRef = useRef(0)
  const settings = getSettings()

  useEffect(() => {
    setFav(isFavorite(music.id))
  }, [music.id])

  useEffect(() => {
    let cancelled = false
    setLyrics([])
    getLyric(music.id)
      .then((lines) => {
        if (!cancelled) setLyrics(lines)
      })
      .catch(() => {
        if (!cancelled) setLyrics([])
      })
    void onEnsurePlay(music, settings.quality)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music.id])

  const activeIndex = useMemo(() => {
    if (!lyrics.length) return -1
    let idx = 0
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i]!.time <= currentTime) idx = i
      else break
    }
    return idx
  }, [lyrics, currentTime])

  useEffect(() => {
    return () => window.clearTimeout(scrollTimerRef.current)
  }, [])

  useEffect(() => {
    if (userSeekingRef.current || activeIndex < 0 || !lyricRef.current) return
    const el = lyricRef.current.querySelector(`[data-i="${activeIndex}"]`) as HTMLElement | null
    if (!el) return
    programmaticRef.current = true
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const timer = window.setTimeout(() => {
      programmaticRef.current = false
    }, 700)
    return () => {
      window.clearTimeout(timer)
      programmaticRef.current = false
    }
  }, [activeIndex])

  const playAt = (time: number) => {
    onSeek(Math.max(0, time))
    if (!playing) onTogglePlay()
  }

  const onLyricScroll = () => {
    if (programmaticRef.current || lyrics.length === 0) return
    userSeekingRef.current = true
    window.clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = window.setTimeout(() => {
      const root = lyricRef.current
      if (!root) {
        userSeekingRef.current = false
        return
      }
      const mid = root.getBoundingClientRect().top + root.clientHeight / 2
      let best = -1
      let bestDist = Number.POSITIVE_INFINITY
      root.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => {
        const rect = el.getBoundingClientRect()
        const dist = Math.abs(rect.top + rect.height / 2 - mid)
        if (dist < bestDist) {
          bestDist = dist
          best = Number(el.dataset.i)
        }
      })
      const line = best >= 0 ? lyrics[best] : undefined
      if (line && Math.abs(line.time - currentTime) >= 0.35) {
        playAt(line.time)
        window.setTimeout(() => {
          userSeekingRef.current = false
        }, 450)
        return
      }
      userSeekingRef.current = false
    }, 160)
  }

  const onPickQuality = async (option: QualityOption) => {
    setDlLoading(true)
    setMsg('')
    try {
      const meta = await getPlayMeta(music.id, option.br)
      const fileUrl = toProxyAudioUrl(meta.url)
      const task: DownloadTask = {
        id: `${music.id}-${option.id}-${Date.now()}`,
        mid: music.id,
        title: music.title,
        artist: music.artist,
        quality: option.id,
        url: fileUrl,
        status: 'ready',
        createdAt: Date.now(),
        image: music.image,
      }
      upsertDownload(task)
      void postDownload(task)
      const filename = trackFilename(music.title, music.artist, trackExt(option.id, meta.format))
      setSheetOpen(false)
      setMsg('正在准备下载…')
      const mode = await requestDownload(fileUrl, filename)
      setMsg(mode === 'started' ? `已开始下载 ${filename}` : '')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '获取下载地址失败')
    } finally {
      setDlLoading(false)
    }
  }

  const src = coverUrl(music.image)

  return (
    <div className="detail-page">
      <TopBar
        title={music.title}
        subtitle={music.artist}
        showBack
        onBack={onBack}
        right={
          <div className="detail-actions">
            <button
              type="button"
              className={`icon-btn fav-btn${fav ? ' on' : ''}`}
              onClick={() => setFav(toggleFavorite(music))}
              aria-label={fav ? '取消收藏' : '收藏'}
            >
              {fav ? '♥' : '♡'}
            </button>
            <button type="button" className="icon-btn" onClick={() => setSheetOpen(true)} aria-label="下载">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 4v11" strokeLinecap="round" />
                <path d="m7.5 11.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 19h14" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        }
      />

      <div className="detail-cover-wrap">
        {src ? (
          <img className="detail-cover" src={src} alt="" />
        ) : (
          <div className="detail-cover" />
        )}
      </div>

      <div className="detail-info">
        <h2>{music.title}</h2>
        <p>
          {music.artist}
          {music.album ? ` · ${music.album}` : ''}
          {music.duration > 0 ? ` · ${fmt(music.duration)}` : ''}
        </p>
      </div>

      <div>
        <input
          className="seek"
          type="range"
          min={0}
          max={duration || music.duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || music.duration || 0)}
          onChange={(e) => onSeek(Number(e.target.value))}
        />
        <div className="time-row">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration || music.duration)}</span>
        </div>
      </div>

      <div className="player-block">
        <p className="play-mode-label" aria-live="polite">
          {PLAY_MODE_LABEL[playMode]}
        </p>
        <div className="player-controls">
          <button
            type="button"
            className="ctrl-btn ctrl-side"
            onClick={onCycleMode}
            aria-label={`${PLAY_MODE_LABEL[playMode]}，点击切换`}
          >
            <PlayModeIcon mode={playMode} />
          </button>
          <div className="player-main">
            <button
              type="button"
              className="ctrl-btn"
              onClick={onPrev}
              disabled={!canPrev}
              aria-label="上一首"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6V6Zm3.5 6 8.5 6V6l-8.5 6Z" />
              </svg>
            </button>
            <button type="button" className="play-btn" onClick={onTogglePlay} aria-label={playing ? '暂停' : '播放'}>
              {playing ? (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="ctrl-btn"
              onClick={onNext}
              disabled={!canNext}
              aria-label="下一首"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 6h2v12h-2V6ZM6 18l8.5-6L6 6v12Z" />
              </svg>
            </button>
          </div>
          <button type="button" className="ctrl-btn ctrl-side" onClick={onOpenQueue} aria-label="播放列表">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 7h11M9 12h11M9 17h11" strokeLinecap="round" />
              <path d="M4 7h.01M4 12h.01M4 17h.01" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {msg ? <div className="empty" style={{ padding: 8 }}>{msg}</div> : null}

      <div className="lyric-panel" ref={lyricRef} onScroll={onLyricScroll}>
        {lyrics.length === 0 ? (
          <div className="empty">暂无歌词</div>
        ) : (
          lyrics.map((line, i) => (
            <button
              key={`${line.time}-${i}`}
              type="button"
              data-i={i}
              className={`lyric-line${i === activeIndex ? ' active' : ''}`}
              onClick={() => playAt(line.time)}
            >
              {line.lineLyric}
            </button>
          ))
        )}
      </div>

      <DownloadSheet
        open={sheetOpen}
        defaultQuality={settings.quality}
        loading={dlLoading}
        onClose={() => setSheetOpen(false)}
        onPick={(q) => void onPickQuality(q)}
      />
    </div>
  )
}
