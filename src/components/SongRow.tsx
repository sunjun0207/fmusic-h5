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
  index?: number
  active?: boolean
}

export function SongRow({ item, onClick, index = 0, active = false }: Props) {
  const dur = formatDuration(item.duration)
  return (
    <button
      type="button"
      className={`song-row song-row--name${active ? ' is-playing' : ''}`}
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}
    >
      <div className="song-main">
        <div className="song-title">
          {active ? <span className="playing-dot" aria-hidden /> : null}
          {item.title}
        </div>
        {item.artist ? <div className="song-sub">{item.artist}</div> : null}
      </div>
      {dur ? <span className="song-duration">{dur}</span> : null}
    </button>
  )
}
