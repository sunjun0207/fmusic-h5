import { coverUrl } from '../lib/api'
import type { MusicItem } from '../lib/types'
import { CloseIcon, PauseIcon, PlayIcon, QueueIcon } from './Icons'
import { Img } from './Img'

type Props = {
  music: MusicItem
  playing: boolean
  progress: number
  low: boolean
  onOpen: () => void
  onToggle: () => void
  onQueue: () => void
  onClose: () => void
}

const RING = 2 * Math.PI * 17

export function MiniPlayer({ music, playing, progress, low, onOpen, onToggle, onQueue, onClose }: Props) {
  const ratio = Math.min(1, Math.max(0, progress))
  return (
    <div
      className={`mini-player${low ? ' is-low' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`打开播放页：${music.title}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter') onOpen()
      }}
    >
      <span className={`mini-disc${playing ? ' is-spinning' : ''}`}>
        <Img src={coverUrl(music.image, 120)} label={music.title} />
      </span>
      <div className="mini-meta">
        <strong>{music.title}</strong>
        <span>{music.artist}</span>
      </div>
      <button
        type="button"
        className="mini-btn mini-toggle"
        aria-label={playing ? '暂停' : '继续播放'}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        <svg className="mini-ring" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="17" />
          <circle cx="20" cy="20" r="17" strokeDasharray={RING} strokeDashoffset={RING * (1 - ratio)} />
        </svg>
        {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
      </button>
      <button
        type="button"
        className="mini-btn"
        aria-label="播放列表"
        onClick={(e) => {
          e.stopPropagation()
          onQueue()
        }}
      >
        <QueueIcon size={19} />
      </button>
      <button
        type="button"
        className="mini-btn"
        aria-label="关闭当前播放"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      >
        <CloseIcon />
      </button>
    </div>
  )
}
