import { useEffect, useMemo, useRef, useState } from 'react'
import { coverUrl, getLyric, getPlayMeta, postDownload } from '../lib/api'
import { addRecentPlay, getSettings, isFavorite, toggleFavorite, upsertDownload } from '../lib/storage'
import type { DownloadTask, LyricLine, MusicItem, QualityOption } from '../lib/types'
import { DownloadSheet } from '../components/DownloadSheet'
import { TopBar } from '../components/TopBar'

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
  onBack: () => void
  onTogglePlay: () => void
  onSeek: (t: number) => void
  onPrev: () => void
  onNext: () => void
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
}: Props) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dlLoading, setDlLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [fav, setFav] = useState(() => isFavorite(music.id))
  const lyricRef = useRef<HTMLDivElement>(null)
  const settings = getSettings()

  useEffect(() => {
    setFav(isFavorite(music.id))
  }, [music.id])

  useEffect(() => {
    addRecentPlay(music)
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
    if (activeIndex < 0 || !lyricRef.current) return
    const el = lyricRef.current.querySelector(`[data-i="${activeIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex])

  const onPickQuality = async (option: QualityOption) => {
    setDlLoading(true)
    setMsg('')
    try {
      const meta = await getPlayMeta(music.id, option.br)
      const task: DownloadTask = {
        id: `${music.id}-${option.id}-${Date.now()}`,
        mid: music.id,
        title: music.title,
        artist: music.artist,
        quality: option.id,
        url: meta.url,
        status: 'ready',
        createdAt: Date.now(),
        image: music.image,
      }
      upsertDownload(task)
      void postDownload(task)
      window.open(meta.url, '_blank', 'noopener,noreferrer')
      setMsg('已加入下载列表并打开链接')
      setSheetOpen(false)
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

      <div className="player-controls">
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

      {msg ? <div className="empty" style={{ padding: 8 }}>{msg}</div> : null}

      <div className="lyric-panel" ref={lyricRef}>
        {lyrics.length === 0 ? (
          <div className="empty">暂无歌词</div>
        ) : (
          lyrics.map((line, i) => (
            <div
              key={`${line.time}-${i}`}
              data-i={i}
              className={`lyric-line${i === activeIndex ? ' active' : ''}`}
            >
              {line.lineLyric}
            </div>
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
