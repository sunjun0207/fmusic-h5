import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { coverUrl, getComments, getLyric, getMvUrl, getPlayMeta, postDownload, posterList, smallerImageUrl, toProxyAudioUrl } from '../lib/api'
import { formatBytes, requestDownload, trackExt, trackFilename } from '../lib/download'
import { PLAY_MODE_LABEL } from '../lib/playback'
import { getSettings, getShowLyric, isFavorite, saveShowLyric, toggleFavorite, upsertDownload } from '../lib/storage'
import type { DownloadTask, LyricLine, MusicItem, PlayMode, QualityOption, SongComment } from '../lib/types'
import { CommentList } from '../components/CommentList'
import { DanmakuLayer } from '../components/DanmakuLayer'
import { DanmakuSwitch, useDanmakuSetting } from '../components/DanmakuSwitch'
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

function formatCount(count: number) {
  if (!Number.isFinite(count) || count <= 0) return '0'
  if (count < 10000) return String(count)
  const wan = count / 10000
  const text = wan >= 10 ? String(Math.round(wan)) : wan.toFixed(1).replace(/\.0$/, '')
  return `${text}万`
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
  const [posterIndex, setPosterIndex] = useState(0)
  const [posterClock, setPosterClock] = useState(0)
  const [brokenPosters, setBrokenPosters] = useState<string[]>([])
  const [posterSrc, setPosterSrc] = useState<Record<string, string>>({})
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [comments, setComments] = useState<SongComment[]>([])
  const [commentTotal, setCommentTotal] = useState(0)
  const [commentPage, setCommentPage] = useState(1)
  const [commentStatus, setCommentStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [commentMore, setCommentMore] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [danmakuOn] = useDanmakuSetting()
  const commentPanelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ x: 0, y: 0, dx: 0, active: false })
  const swipedRef = useRef(false)
  const draggingRef = useRef(false)
  const posterSrcRef = useRef(posterSrc)
  posterSrcRef.current = posterSrc
  const settings = getSettings()
  const posters = posterList(music, settings.posterSize).filter((src) => !brokenPosters.includes(src))

  useEffect(() => {
    let cancel = false
    setComments([])
    setCommentPage(1)
    setCommentTotal(0)
    setCommentStatus('loading')
    getComments(music.id, 'song')
      .then((data) => {
        if (cancel) return
        setComments(data.list)
        setCommentTotal(data.total)
        setCommentStatus(data.list.length ? 'ready' : 'empty')
      })
      .catch(() => {
        if (!cancel) setCommentStatus('error')
      })
    return () => {
      cancel = true
    }
  }, [music.id])

  useEffect(() => {
    setCommentsOpen(false)
  }, [music.id])

  useEffect(() => {
    if (!commentsOpen) return
    commentPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [commentsOpen])

  const loadMoreComments = async () => {
    if (commentMore || comments.length >= commentTotal) return
    const next = commentPage + 1
    setCommentMore(true)
    try {
      const data = await getComments(music.id, 'song', next)
      setComments((list) => {
        const seen = new Set(list.map((item) => item.id))
        return [...list, ...data.list.filter((item) => !seen.has(item.id))]
      })
      setCommentTotal(data.total)
      setCommentPage(next)
    } catch {
      setCommentStatus('error')
    } finally {
      setCommentMore(false)
    }
  }

  useEffect(() => {
    setFav(isFavorite(music.id))
    setPosterIndex(0)
    setPosterClock(0)
    setBrokenPosters([])
    setPosterSrc({})
    setDragX(0)
    setDragging(false)
  }, [music.id])

  useEffect(() => {
    if (posters.length < 2) return
    const timer = window.setInterval(() => {
      if (draggingRef.current) return
      setPosterIndex((index) => (index + 1) % posters.length)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [music.id, posters.length, posterClock])

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

  const stepPoster = (direction: number) => {
    if (posters.length < 2) return
    setPosterIndex((index) => (index + direction + posters.length) % posters.length)
    setPosterClock((clock) => clock + 1)
  }

  const onPosterPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (posters.length < 2) return
    dragRef.current = { x: event.clientX, y: event.clientY, dx: 0, active: true }
  }

  const onPosterPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const dx = event.clientX - dragRef.current.x
    const dy = event.clientY - dragRef.current.y
    if (!draggingRef.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      if (Math.abs(dy) > Math.abs(dx)) {
        dragRef.current.active = false
        return
      }
    }
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    dragRef.current.dx = dx
    draggingRef.current = true
    setDragging(true)
    setDragX(dx)
  }

  const finishPosterDrag = () => {
    if (!dragRef.current.active && !draggingRef.current) return
    const dx = dragRef.current.dx
    dragRef.current.active = false
    dragRef.current.dx = 0
    draggingRef.current = false
    setDragging(false)
    setDragX(0)
    if (Math.abs(dx) > 36) {
      swipedRef.current = true
      stepPoster(dx < 0 ? 1 : -1)
      window.setTimeout(() => {
        swipedRef.current = false
      }, 0)
    }
  }

  const onPosterError = (poster: string) => {
    const current = posterSrcRef.current[poster] || poster
    const next = smallerImageUrl(current)
    if (next !== current) {
      setPosterSrc((map) => ({ ...map, [poster]: next }))
      return
    }
    setBrokenPosters((list) => (list.includes(poster) ? list : [...list, poster]))
  }

  const openLyricFromPoster = () => {
    if (swipedRef.current) {
      swipedRef.current = false
      return
    }
    toggleLyric()
  }

  const toggleLyric = () => {
    setLyricOpen((open) => {
      const next = !open
      saveShowLyric(next)
      if (next) setCommentsOpen(false)
      return next
    })
  }

  const toggleComments = () => {
    setCommentsOpen((open) => {
      const next = !open
      if (next) {
        setLyricOpen(false)
        saveShowLyric(false)
      }
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

  const activePoster = posterIndex % Math.max(posters.length, 1)
  const src = posters[0] || coverUrl(music.image, settings.posterSize)

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
            <DanmakuSwitch light />
          </header>
          <div className="lyric-poster">
            {src ? <img src={src} alt="" /> : <span />}
          </div>
          <DanmakuLayer comments={comments} enabled={danmakuOn} />
          <div className="lyric-body">
            <LyricView lines={lyrics} status={lyricStatus} current={currentTime} onSeek={playAt} />
          </div>
        </section>
      ) : (
        <>
          <div
            className="detail-cover-wrap"
            role="button"
            tabIndex={0}
            aria-label="显示歌词"
            onClick={openLyricFromPoster}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                toggleLyric()
              }
            }}
          >
            {posters.length > 1 ? (
              <div
                className="poster-viewport"
                onPointerDown={onPosterPointerDown}
                onPointerMove={onPosterPointerMove}
                onPointerUp={finishPosterDrag}
                onPointerCancel={finishPosterDrag}
              >
                <div
                  className={`poster-track${dragging ? ' is-dragging' : ''}`}
                  style={{ transform: `translateX(calc(${-activePoster * 100}% + ${dragX}px))` }}
                >
                  {posters.map((poster) => (
                    <img
                      key={poster}
                      className="detail-cover poster-slide"
                      src={posterSrc[poster] || poster}
                      alt=""
                      draggable={false}
                      onError={() => onPosterError(poster)}
                    />
                  ))}
                </div>
                <div className="poster-dots" aria-hidden="true">
                  {posters.map((poster, index) => (
                    <i key={poster} className={index === activePoster ? 'is-on' : ''} />
                  ))}
                </div>
              </div>
            ) : posters[0] ? (
              <img
                className="detail-cover"
                src={posterSrc[posters[0]] || posters[0]}
                alt=""
                onError={() => onPosterError(posters[0]!)}
              />
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
        <button
          type="button"
          className={`action-chip comment${commentsOpen ? ' on' : ''}`}
          aria-pressed={commentsOpen}
          aria-label={
            commentStatus === 'loading'
              ? '查看评论'
              : `${commentsOpen ? '收起评论' : '查看评论'}，共 ${formatCount(commentTotal)} 条`
          }
          onClick={toggleComments}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7.2 17.2 4.6 20v-3.2A7.6 7.6 0 1 1 12 19.2a7.5 7.5 0 0 1-4.8-2Z" strokeLinejoin="round" />
          </svg>
          <span className="chip-copy">
            <span>{commentsOpen ? '收起' : '评论'}</span>
            {commentStatus !== 'loading' ? <i className="chip-count">{formatCount(commentTotal)}</i> : null}
          </span>
        </button>
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

      {commentsOpen && !lyricOpen ? (
        <div ref={commentPanelRef}>
          <CommentList
            comments={comments}
            total={commentTotal}
            status={commentStatus}
            loadingMore={commentMore}
            onMore={() => void loadMoreComments()}
          />
        </div>
      ) : null}

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
