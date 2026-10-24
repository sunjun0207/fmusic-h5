import { useEffect, useRef, useState } from 'react'
import { coverUrl, postDownload, toProxyAudioUrl } from '../lib/api'
import { formatBytes, requestDownload, trackFilename } from '../lib/download'
import { MV_QUALITIES, visibleMvQuality } from '../lib/quality'
import { upsertDownload } from '../lib/storage'
import type { DownloadTask, MusicItem } from '../lib/types'

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

type Props = {
  music: MusicItem
  url: string
  quality: string
  loading: boolean
  onClose: () => void
  onQuality: (quality: string) => void
}

type IOSVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
  webkitDisplayingFullscreen?: boolean
}

export function MvPlayer({ music, url, quality, loading, onClose, onQuality }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const resumeAt = useRef(0)
  const [paused, setPaused] = useState(true)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [chrome, setChrome] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.fullscreenElement) return
      onClose()
    }
    const sync = () => setFullscreen(Boolean(document.fullscreenElement))
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', sync)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', sync)
    }
  }, [onClose])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !url) return
    const start = resumeAt.current
    resumeAt.current = 0
    setPaused(true)
    setCurrent(start)
    if (start <= 0) setDuration(0)
    const seek = () => {
      if (start > 0.3 && Number.isFinite(video.duration) && start < video.duration - 0.3) {
        video.currentTime = start
        setCurrent(start)
      }
    }
    if (video.readyState >= 1) seek()
    else video.addEventListener('loadedmetadata', seek)
    void video.play().catch(() => setPaused(true))
    const onBegin = () => setFullscreen(true)
    const onEnd = () => setFullscreen(false)
    video.addEventListener('webkitbeginfullscreen', onBegin)
    video.addEventListener('webkitendfullscreen', onEnd)
    return () => {
      video.removeEventListener('loadedmetadata', seek)
      video.removeEventListener('webkitbeginfullscreen', onBegin)
      video.removeEventListener('webkitendfullscreen', onEnd)
    }
  }, [url])

  const toggleFullscreen = async () => {
    const layer = layerRef.current
    const video = videoRef.current as IOSVideo | null
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined)
      return
    }
    if (video?.webkitDisplayingFullscreen) {
      video.webkitExitFullscreen?.()
      return
    }
    if (layer?.requestFullscreen) {
      try {
        await layer.requestFullscreen()
        return
      } catch {
        /* iPhone 只能让 video 自己进入全屏 */
      }
    }
    video?.webkitEnterFullscreen?.()
  }

  const toggle = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play().catch(() => setPaused(true))
    else video.pause()
  }

  const download = async () => {
    if (!url || saving) return
    setSaving(true)
    setMessage('')
    try {
      const fileUrl = toProxyAudioUrl(url)
      const filename = trackFilename(music.title, music.artist, 'mp4')
      const task: DownloadTask = {
        id: `${music.id}-mv-${Date.now()}`,
        mid: music.id,
        title: music.title,
        artist: music.artist,
        quality: 'MV',
        url: fileUrl,
        status: 'ready',
        createdAt: Date.now(),
        image: music.mvPic || music.image,
      }
      upsertDownload(task)
      void postDownload(task)
      const mode = await requestDownload(fileUrl, filename)
      setMessage(mode.mode === 'started' ? `已开始下载 ${filename}（${formatBytes(mode.bytes)}）` : '请用浏览器打开后保存')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '下载失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={layerRef}
      className={`mv-layer${chrome ? '' : ' is-clean'}${fullscreen ? ' is-fullscreen' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${music.title} MV`}
    >
      <header className="mv-chrome mv-head">
        <button type="button" className="mv-pill" onClick={onClose} aria-label="关闭">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
          <span>关闭</span>
        </button>
        <div className="mv-heading">
          <strong>{music.title}</strong>
          <span>{music.artist} · MV</span>
        </div>
        <button type="button" className="mv-pill" onClick={() => void download()} disabled={!url || saving || loading} aria-label="下载">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 4v11" strokeLinecap="round" />
            <path d="m7.5 11.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 20h14" strokeLinecap="round" />
          </svg>
          <span>{saving ? '下载中' : '下载'}</span>
        </button>
      </header>

      <div className="mv-stage" onClick={() => setChrome((open) => !open)}>
        {url ? (
          <video
            ref={videoRef}
            src={url}
            poster={coverUrl(music.mvPic) || coverUrl(music.image) || undefined}
            playsInline
            preload="auto"
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            onTimeUpdate={() => setCurrent(videoRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
            onEnded={() => setPaused(true)}
          />
        ) : (
          <div className="mv-loading">{loading ? '正在获取 MV…' : 'MV 准备中'}</div>
        )}
      </div>

      <div className="mv-chrome mv-bar">
        <div className="mv-progress">
        <button type="button" className="mv-toggle" onClick={toggle} disabled={!url} aria-label={paused ? '播放' : '暂停'}>
          {paused ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5-11-6.5Z" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          )}
        </button>
        <input
          className="seek"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          aria-label="MV 进度"
          disabled={!url}
          onChange={(event) => {
            const next = Number(event.target.value)
            const video = videoRef.current
            if (video) video.currentTime = next
            setCurrent(next)
          }}
        />
        <span className="mv-time">
          {fmt(current)} / {fmt(duration)}
        </span>
        </div>
        <div className="mv-actions">
        <label className="mv-pill mv-quality">
          <span>清晰度</span>
          <select
            aria-label="清晰度"
            value={visibleMvQuality(quality)}
            disabled={loading}
            onChange={(event) => {
              const next = event.target.value
              if (next === quality) return
              resumeAt.current = videoRef.current?.currentTime || 0
              onQuality(next)
            }}
          >
            {MV_QUALITIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`mv-round mv-full${fullscreen ? ' is-on' : ''}`}
          onClick={() => void toggleFullscreen()}
          disabled={!url}
          aria-label={fullscreen ? '退出全屏' : '全屏'}
        >
          {fullscreen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M9 4v4a1 1 0 0 1-1 1H4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 4v4a1 1 0 0 0 1 1h4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 20v-4a1 1 0 0 0-1-1H4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 20v-4a1 1 0 0 1 1-1h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M8 4H5a1 1 0 0 0-1 1v3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 4h3a1 1 0 0 1 1 1v3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 16v3a1 1 0 0 1-1 1h-3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v3a1 1 0 0 0 1 1h3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        </div>
      </div>
      {message ? <p className="mv-chrome mv-message">{message}</p> : null}
    </div>
  )
}
