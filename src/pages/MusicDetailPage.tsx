import { useEffect, useState } from 'react'
import { coverUrl, getLyric, getMvUrl, getPlayMeta, postDownload, toProxyAudioUrl } from '../lib/api'
import { formatBytes, requestDownload, trackExt, trackFilename } from '../lib/download'
import { PLAY_MODE_LABEL } from '../lib/playback'
import { getSettings, getShowLyric, isFavorite, saveShowLyric, toggleFavorite, upsertDownload } from '../lib/storage'
import type { DownloadTask, LyricLine, MusicItem, PlayMode, QualityOption } from '../lib/types'
import { DownloadSheet } from '../components/DownloadSheet'
import { LyricView } from '../components/LyricView'
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
  onPlayMv: (music: MusicItem) => void
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
  onPlayMv,
}: Props) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [lyricStatus, setLyricStatus] = useState<'loading' | 'ready' | 'empty'>('empty')
  const [lyricOpen, setLyricOpen] = useState(() => getShowLyric())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dlLoading, setDlLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [fav, setFav] = useState(() => isFavorite(music.id))
  const settings = getSettings()

  useEffect(() => {
    setFav(isFavorite(music.id))
  }, [music.id])

  useEffect(() => {
    let cancelled = false
    setLyrics([])
    setLyricStatus('loading')
    getLyric(music.id)
      .then((lines) => {
        if (cancelled) return
        setLyrics(lines)
        setLyricStatus(lines.length ? 'ready' : 'empty')
      })
      .catch(() => {
        if (cancelled) return
        setLyrics([])
        setLyricStatus('empty')
      })
    void onEnsurePlay(music, settings.quality)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music.id])

  const toggleLyric = () => {
    setLyricOpen((open) => {
      const next = !open
      saveShowLyric(next)
      return next
    })
  }

  const playAt = (time: number) => {
    onSeek(Math.max(0, time))
    if (!playing) onTogglePlay()
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
      setMsg(mode.mode === 'started' ? `已开始下载 ${filename}（${formatBytes(mode.bytes)}）` : '')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '获取下载地址失败')
    } finally {
      setDlLoading(false)
    }
  }

  const src = coverUrl(music.image)

  return (
    <div className={`detail-page${lyricOpen ? ' is-lyric' : ''}`}>
      <TopBar showBack onBack={onBack} plain />

      {lyricOpen ? (
        <section className="lyric-screen" aria-label={`${music.title} 歌词`}>
          {src ? (
            <div className="lyric-bg" style={{ backgroundImage: `url(${JSON.stringify(src)})` }} />
          ) : (
            <div className="lyric-bg lyric-bg-empty" />
          )}
          <div className="lyric-bg-mask" />
          <header className="lyric-screen-bar">
            <div className="lyric-heading">
              <strong>{music.title}</strong>
              <span>{music.artist}</span>
            </div>
          </header>
          <div className="lyric-body">
            <LyricView lines={lyrics} status={lyricStatus} current={currentTime} onSeek={playAt} />
          </div>
        </section>
      ) : (
        <>
          <button type="button" className="detail-cover-wrap" onClick={toggleLyric} aria-label="显示歌词">
            {src ? <img className="detail-cover" src={src} alt="" /> : <div className="detail-cover" />}
          </button>
          <div className="detail-info">
            <h2>{music.title}</h2>
            <p>
              {music.artist}
              {music.album ? ` · ${music.album}` : ''}
              {music.duration > 0 ? ` · ${fmt(music.duration)}` : ''}
            </p>
          </div>
        </>
      )}

      <div className="detail-actions">
        <button
          type="button"
          className={`action-chip${fav ? ' on' : ''}`}
          onClick={() => setFav(toggleFavorite(music))}
          aria-label={fav ? '取消收藏' : '收藏'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
            <path
              d="M12 20.2s-6.6-4.2-6.6-9C5.4 8.4 7.3 6.6 9.7 6.6c1.3 0 2.5.6 3.3 1.7.8-1.1 2-1.7 3.3-1.7 2.4 0 4.3 1.8 4.3 4.6 0 4.8-6.6 9-6.6 9z"
              strokeLinejoin="round"
            />
          </svg>
          <span>{fav ? '已收藏' : '收藏'}</span>
        </button>
        <button
          type="button"
          className={`action-chip lyric${lyricOpen ? ' on' : ''}`}
          aria-pressed={lyricOpen}
          onClick={toggleLyric}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 6h14M5 12h10M5 18h14" strokeLinecap="round" />
          </svg>
          <span>{lyricOpen ? '收起' : '歌词'}</span>
        </button>
        {music.hasMv ? (
          <button
            type="button"
            className="action-chip mv"
            onPointerDown={() => {
              void getMvUrl(music.id).catch(() => undefined)
            }}
            onClick={() => onPlayMv(music)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="6" width="13" height="12" rx="2" />
              <path d="m16 10 5-2v8l-5-2v-4Z" strokeLinejoin="round" />
            </svg>
            <span>播放MV</span>
          </button>
        ) : music.hasMv === false ? (
          <span className="action-chip is-static">暂无MV</span>
        ) : null}
        <button type="button" className="action-chip download" onClick={() => setSheetOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 4v11" strokeLinecap="round" />
            <path d="m7.5 11.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 19h14" strokeLinecap="round" />
          </svg>
          <span>下载</span>
        </button>
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
        <div className="player-utils">
          <button
            type="button"
            className="util-btn"
            onClick={onCycleMode}
            aria-label={`循环模式：${PLAY_MODE_LABEL[playMode]}，点击切换`}
          >
            <PlayModeIcon mode={playMode} />
            <span>{PLAY_MODE_LABEL[playMode]}</span>
          </button>
          <button type="button" className="util-btn" onClick={onOpenQueue}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 7h11M9 12h11M9 17h11" strokeLinecap="round" />
              <path d="M4 7h.01M4 12h.01M4 17h.01" strokeLinecap="round" />
            </svg>
            <span>播放列表</span>
          </button>
        </div>
        <div className="player-main">
          <button type="button" className="transport" onClick={onPrev} disabled={!canPrev}>
            <span className="ctrl-face">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6V6Zm3.5 6 8.5 6V6l-8.5 6Z" />
              </svg>
            </span>
            <span className="ctrl-label">上一首</span>
          </button>
          <button type="button" className="transport transport-play" onClick={onTogglePlay}>
            <span className="ctrl-face">
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
            </span>
            <span className="ctrl-label">{playing ? '暂停' : '播放'}</span>
          </button>
          <button type="button" className="transport" onClick={onNext} disabled={!canNext}>
            <span className="ctrl-face">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 6h2v12h-2V6ZM6 18l8.5-6L6 6v12Z" />
              </svg>
            </span>
            <span className="ctrl-label">下一首</span>
          </button>
        </div>
      </div>

      {msg ? <div className="empty" style={{ padding: 8 }}>{msg}</div> : null}

      <DownloadSheet
        open={sheetOpen}
        defaultQuality={settings.quality}
        fileInfo={music.fileInfo}
        loading={dlLoading}
        onClose={() => setSheetOpen(false)}
        onPick={(q) => void onPickQuality(q)}
      />
    </div>
  )
}
