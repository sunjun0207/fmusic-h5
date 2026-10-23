import { getMvUrl } from '../lib/api'
import type { MusicItem } from '../lib/types'

function formatDuration(sec: number) {
  if (!sec || sec <= 0) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

type Props = {
  item: MusicItem
  onClick: () => void
  onPlayMv?: (item: MusicItem) => void
  index?: number
  active?: boolean
}

export function SongRow({ item, onClick, onPlayMv, index = 0, active = false }: Props) {
  const dur = formatDuration(item.duration)
  return (
    <div
      role="button"
      tabIndex={0}
      className={`song-row song-row--name${active ? ' is-playing' : ''}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}
    >
      <div className="song-main">
        <div className="song-title">
          {active ? <span className="playing-dot" aria-hidden /> : null}
          <span className="song-name">{item.title}</span>
        </div>
        {item.artist ? <div className="song-sub">{item.artist}</div> : null}
      </div>
      {item.hasMv ? (
        onPlayMv ? (
          <button
            type="button"
            className="mv-play"
            aria-label={`播放 ${item.title} 的 MV`}
            onPointerDown={() => {
              void getMvUrl(item.id).catch(() => undefined)
            }}
            onClick={(event) => {
              event.stopPropagation()
              onPlayMv(item)
            }}
          >
            播放MV
          </button>
        ) : (
          <span className="mv-flag">播放MV</span>
        )
      ) : item.hasMv === false ? (
        <span className="mv-none">暂无MV</span>
      ) : null}
      {dur ? <span className="song-duration">{dur}</span> : null}
    </div>
  )
}
