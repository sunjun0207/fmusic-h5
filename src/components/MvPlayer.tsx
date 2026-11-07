import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { coverUrl, getComments, postDownload, toProxyAudioUrl } from '../lib/api'
import { Pending } from './Pending'
import { DanmakuLayer } from './DanmakuLayer'
import { DanmakuSwitch, useDanmakuSetting } from './DanmakuSwitch'
import { PlaybackLevels, usePlaybackLevels } from './LevelSlider'
import { applyMediaLevel, getLevels } from '../lib/levels'
import { yieldNativeAudio } from '../lib/nativeAudio'
import { formatBytes, requestDownload, trackFilename } from '../lib/download'
import { MV_QUALITIES, mvLabel, visibleMvQuality } from '../lib/quality'
import { upsertDownload } from '../lib/storage'
import type { DownloadTask, MusicItem, SongComment } from '../lib/types'

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
  qualities: string[]
  loading: boolean
  onClose: () => void
  onQuality: (quality: string) => void
}

type IOSVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
  webkitDisplayingFullscreen?: boolean
}

type ScreenBridge = {
  landscape: () => void
  portrait: () => void
  begin?: () => void
  end?: () => void
}

function nativeScreen(): ScreenBridge | null {
  const bridge = (window as Window & { FMusicScreen?: ScreenBridge }).FMusicScreen
  if (typeof bridge?.landscape !== 'function' || typeof bridge?.portrait !== 'function') return null
  return bridge
}

function setNativeLandscape(on: boolean) {
  const bridge = nativeScreen()
  if (!bridge) return
  document.documentElement.classList.toggle('mv-native-full', on)
  if (on) bridge.landscape()
  else bridge.portrait()
}

export function MvPlayer({ music, url, quality, qualities, loading, onClose, onQuality }: Props) {
  const layerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const resumeAt = useRef(0)
  const [paused, setPaused] = useState(true)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [chrome, setChrome] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [comments, setComments] = useState<SongComment[]>([])
  const [danmakuOn] = useDanmakuSetting()
  const { volume, brightness } = usePlaybackLevels('mv')
  const [danmakuBox, setDanmakuBox] = useState({ top: 12, left: 8, right: 8 })
  const [qualityOpen, setQualityOpen] = useState(false)
  const [level, setLevel] = useState<'volume' | 'brightness' | null>(null)
  const [loop, setLoop] = useState(false)
  const loopRef = useRef(false)
  const replayingRef = useRef(false)
  const wantPlayRef = useRef(false)
  const playTries = useRef(0)
  const hideTimer = useRef(0)
  loopRef.current = loop

  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      setQualityOpen(false)
      setLevel(null)
      setChrome(false)
    }, 3000)
  }, [])

  const keepChrome = (event: ReactPointerEvent) => {
    if (!chrome || qualityOpen || level) return
    const stage = stageRef.current
    if (stage && event.target instanceof Node && stage.contains(event.target)) return
    scheduleHide()
  }

  useEffect(() => {
    if (!qualityOpen) return
    const close = (event: PointerEvent) => {
      const target = event.target
      const menu = layerRef.current?.querySelector('.mv-quality')
      if (target instanceof Node && menu?.contains(target)) return
      setQualityOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [qualityOpen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.fullscreenElement) return
      onClose()
    }
    const sync = () => {
      if (nativeScreen()) return
      setFullscreen(Boolean(document.fullscreenElement))
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', sync)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', sync)
    }
  }, [onClose])

  useEffect(() => {
    document.documentElement.classList.add('mv-open')
    nativeScreen()?.begin?.()
    return () => {
      document.documentElement.classList.remove('mv-open')
      document.documentElement.classList.remove('mv-native-full')
      const bridge = nativeScreen()
      if (bridge?.end) bridge.end()
      else setNativeLandscape(false)
    }
  }, [])

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
    video.addEventListener('loadedmetadata', seek)
    applyMediaLevel(video, getLevels('mv').volume)
    video.src = url
    video.load()
    yieldNativeAudio()
    wantPlayRef.current = true
    playTries.current = 0
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

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    applyMediaLevel(video, volume)
  }, [volume, url])

  useEffect(() => {
    let cancel = false
    setComments([])
    getComments(music.id, 'mv')
      .then(async (data) => {
        const list = data.list.length ? data.list : (await getComments(music.id, 'song')).list
        if (!cancel) setComments(list)
      })
      .catch(() => {
        if (!cancel) setComments([])
      })
    return () => {
      cancel = true
    }
  }, [music.id])

  useEffect(() => {
    const stage = stageRef.current
    const video = videoRef.current
    if (!stage) return
    const place = () => {
      const sw = stage.clientWidth
      const sh = stage.clientHeight
      const vw = video?.videoWidth || 0
      const vh = video?.videoHeight || 0
      if (!video || !sw || !sh || !vw || !vh) {
        setDanmakuBox({ top: 12, left: 8, right: 8 })
        return
      }
      const scale = Math.min(sw / vw, sh / vh)
      const pictureWidth = Math.round(vw * scale)
      const pictureHeight = Math.round(vh * scale)
      video.style.width = `${pictureWidth}px`
      video.style.height = `${pictureHeight}px`
      video.style.objectFit = 'contain'
      const pictureTop = Math.max(0, (sh - pictureHeight) / 2)
      const pictureLeft = Math.max(0, (sw - pictureWidth) / 2)
      let top = pictureTop + 8
      if (fullscreen && chrome) {
        const head = stage.parentElement?.querySelector('.mv-head')
        if (head instanceof HTMLElement) {
          const headBottom = head.getBoundingClientRect().bottom - stage.getBoundingClientRect().top
          if (headBottom > top) top = headBottom + 4
        }
      }
      setDanmakuBox({
        top: Math.round(top),
        left: Math.round(pictureLeft + 8),
        right: Math.round(pictureLeft + 8),
      })
    }
    place()
    const frame = window.requestAnimationFrame(place)
    const observer = new ResizeObserver(place)
    observer.observe(stage)
    video?.addEventListener('loadedmetadata', place)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      video?.removeEventListener('loadedmetadata', place)
    }
  }, [url, chrome, fullscreen])

  useEffect(() => {
    if (!chrome || qualityOpen || level) {
      window.clearTimeout(hideTimer.current)
      return
    }
    scheduleHide()
    return () => window.clearTimeout(hideTimer.current)
  }, [chrome, qualityOpen, level, url, scheduleHide])

  const toggleFullscreen = async () => {
    const layer = layerRef.current
    const video = videoRef.current as IOSVideo | null
    if (nativeScreen()) {
      const next = !fullscreen
      setFullscreen(next)
      setNativeLandscape(next)
      return
    }
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

  const replay = useCallback(() => {
    const video = videoRef.current
    if (!video || !loopRef.current || replayingRef.current) return
    replayingRef.current = true
    let started = false
    const begin = () => {
      if (started) return
      started = true
      video.removeEventListener('seeked', begin)
      void video.play().then(() => {
        replayingRef.current = false
        setPaused(false)
        setCurrent(video.currentTime || 0)
      }).catch(() => {
        replayingRef.current = false
        setPaused(true)
      })
    }
    video.addEventListener('seeked', begin)
    try {
      video.currentTime = 0
    } catch {
      video.removeEventListener('seeked', begin)
      replayingRef.current = false
      setPaused(true)
      return
    }
    window.setTimeout(begin, 400)
  }, [])

  const atEnd = (video: HTMLVideoElement) => {
    const duration = video.duration
    return video.ended || (Number.isFinite(duration) && duration > 1 && video.currentTime >= duration - 0.35)
  }

  const toggleLoop = () => {
    const next = !loopRef.current
    loopRef.current = next
    setLoop(next)
    const video = videoRef.current
    if (next && video && atEnd(video)) replay()
  }

  const toggle = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      wantPlayRef.current = true
      playTries.current = 0
      yieldNativeAudio()
      void video.play().catch(() => {
        wantPlayRef.current = false
        setPaused(true)
      })
    } else {
      wantPlayRef.current = false
      video.pause()
    }
  }

  const download = async () => {
    if (!url || saving) return
    setSaving(true)
    setMessage('')
    try {
      const fileUrl = toProxyAudioUrl(url)
      const label = mvLabel(quality)
      const filename = trackFilename(music.title, music.artist, 'mp4', label)
      const task: DownloadTask = {
        id: `${music.id}-mv-${visibleMvQuality(quality)}`,
        mid: music.id,
        title: music.title,
        artist: music.artist,
        quality: `MV-${label}`,
        url: fileUrl,
        status: 'ready',
        createdAt: Date.now(),
        image: music.mvPic || music.image,
      }
      upsertDownload(task)
      void postDownload(task)
      const mode = await requestDownload(fileUrl, filename)
      setMessage(
        mode.mode === 'started'
          ? mode.bytes > 0
            ? `已开始下载 ${filename}（${formatBytes(mode.bytes)}）`
            : `已开始下载 ${filename}`
          : '请用浏览器打开后保存',
      )
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
      onPointerDown={keepChrome}
      onPointerMove={keepChrome}
      role="dialog"
      aria-modal="true"
      aria-label={`${music.title} MV`}
    >
      <header className="mv-chrome mv-head">
        <button
          type="button"
          className="mv-icon"
          onClick={() => {
            const video = videoRef.current
            if (video) {
              video.pause()
              video.removeAttribute('src')
              video.load()
            }
            onClose()
          }}
          aria-label="关闭"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
        <div className="mv-heading">
          <strong>{music.title}</strong>
          <span>{music.artist} · MV</span>
        </div>
        <button type="button" className="mv-icon" onClick={() => void download()} disabled={!url || saving || loading} aria-label={saving ? '下载中' : '下载'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 4v11" strokeLinecap="round" />
            <path d="m7.5 11.5 4.5 4.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 20h14" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div
        ref={stageRef}
        className="mv-stage"
        onClick={() => {
          setLevel(null)
          setQualityOpen(false)
          setChrome((open) => !open)
        }}
      >
        {url ? (
          <video
            key={url}
            ref={videoRef}
            src={url}
            poster={coverUrl(music.mvPic) || coverUrl(music.image) || undefined}
            playsInline
            preload="auto"
            onPlay={() => {
              yieldNativeAudio()
              setPaused(false)
            }}
            onPause={() => {
              const video = videoRef.current
              if (replayingRef.current) return
              if (video && loopRef.current && atEnd(video)) {
                replay()
                return
              }
              if (wantPlayRef.current && video && !video.ended && playTries.current < 2) {
                playTries.current += 1
                window.setTimeout(() => {
                  if (!wantPlayRef.current || !video.paused) return
                  yieldNativeAudio()
                  void video.play().catch(() => {
                    wantPlayRef.current = false
                    setPaused(true)
                  })
                }, 120)
                return
              }
              wantPlayRef.current = false
              setPaused(true)
            }}
            onTimeUpdate={() => {
              const video = videoRef.current
              const time = video?.currentTime || 0
              if (time < 1) replayingRef.current = false
              setCurrent(time)
              if (video && loopRef.current && atEnd(video)) replay()
            }}
            onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
            onEnded={() => {
              if (loopRef.current) replay()
              else setPaused(true)
            }}
          />
        ) : (
          <div className="mv-loading">
            <Pending text={loading ? '正在获取 MV…' : 'MV 准备中'} tone="dark" />
          </div>
        )}
        <div className="mv-dim" style={{ opacity: (100 - brightness) / 100 }} />
        <DanmakuLayer comments={comments} enabled={danmakuOn} style={danmakuBox} />
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
          style={{ '--p': `${duration > 0 ? (Math.min(current, duration) / duration) * 100 : 0}%` } as CSSProperties}
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
        {level ? <PlaybackLevels scope="mv" tone="dark" only={level} /> : null}
        {message ? <p className="mv-message">{message}</p> : null}
        <div className="mv-tools">
        <button
          type="button"
          className={`mv-icon${level === 'volume' ? ' is-on' : ''}`}
          aria-pressed={level === 'volume'}
          aria-label="音量"
          onClick={() => {
            setQualityOpen(false)
            setLevel((current) => (current === 'volume' ? null : 'volume'))
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4.5 10v4h3.1L12 18.2V5.8L7.6 10H4.5Z" strokeLinejoin="round" />
            {volume === 0 ? <path d="M16 10.2 20 14.2M20 10.2 16 14.2" strokeLinecap="round" /> : null}
            {volume > 0 ? <path d="M15.4 9.3a3.4 3.4 0 0 1 0 5.4" strokeLinecap="round" /> : null}
            {volume > 45 ? <path d="M17.7 7.2a6.2 6.2 0 0 1 0 9.6" strokeLinecap="round" /> : null}
          </svg>
        </button>
        <button
          type="button"
          className={`mv-icon${level === 'brightness' ? ' is-on' : ''}`}
          aria-pressed={level === 'brightness'}
          aria-label="亮度"
          onClick={() => {
            setQualityOpen(false)
            setLevel((current) => (current === 'brightness' ? null : 'brightness'))
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="3.1" />
            <path d="M12 3.6v2.1M12 18.3v2.1M3.6 12h2.1M18.3 12h2.1M6.1 6.1l1.5 1.5M16.4 16.4l1.5 1.5M17.9 6.1l-1.5 1.5M7.6 16.4l-1.5 1.5" strokeLinecap="round" />
          </svg>
        </button>
        <div className={`mv-quality${qualityOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="mv-pill"
            aria-haspopup="listbox"
            aria-expanded={qualityOpen}
            aria-label={`清晰度 ${mvLabel(quality)}`}
            disabled={loading}
            onClick={() => {
              setLevel(null)
              setQualityOpen((open) => !open)
            }}
          >
            {mvLabel(quality)}
          </button>
          {qualityOpen ? (
            <div className="mv-quality-menu" role="listbox" aria-label="清晰度">
              {MV_QUALITIES.map((item) => {
                const missing = !qualities.includes(item.id)
                const current = item.id === visibleMvQuality(quality)
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={current}
                    aria-disabled={missing}
                    disabled={missing}
                    className={current ? 'is-on' : ''}
                    onClick={() => {
                      if (missing || current) {
                        setQualityOpen(false)
                        return
                      }
                      resumeAt.current = videoRef.current?.currentTime || 0
                      setQualityOpen(false)
                      onQuality(item.id)
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
        <div className="mv-action-end">
        <button
          type="button"
          className={`danmaku-switch is-light is-compact${loop ? ' is-on' : ''}`}
          role="switch"
          aria-checked={loop}
          aria-label={loop ? '关闭循环播放' : '打开循环播放'}
          onClick={(event) => {
            event.stopPropagation()
            toggleLoop()
          }}
        >
          <span>循环</span>
          <span className="danmaku-switch-track" aria-hidden="true">
            <span className="danmaku-switch-thumb" />
          </span>
        </button>
        <DanmakuSwitch light compact />
        <button
          type="button"
          className={`mv-icon mv-full${fullscreen ? ' is-on' : ''}`}
          onClick={() => void toggleFullscreen()}
          disabled={!url}
          aria-label={fullscreen ? '退出全屏' : '全屏'}
        >
          {fullscreen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M9 4v4a1 1 0 0 1-1 1H4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 4v4a1 1 0 0 0 1 1h4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 20v-4a1 1 0 0 0-1-1H4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 20v-4a1 1 0 0 1 1-1h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M8 4H5a1 1 0 0 0-1 1v3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 4h3a1 1 0 0 1 1 1v3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 16v3a1 1 0 0 1-1 1h-3" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v3a1 1 0 0 0 1 1h3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        </div>
        </div>
      </div>
    </div>
  )
}
