import { coverUrl, getMvUrl } from '../lib/api'
import { formatDuration } from '../lib/format'
import type { MusicItem, Trend } from '../lib/types'
import { MoreIcon, TrendIcon } from './Icons'
import { Img } from './Img'

type Props = {
  item: MusicItem
  onClick: () => void
  onPlayMv?: (item: MusicItem) => void
  index?: number
  active?: boolean
  /** 榜单名次，从 1 开始；前三名高亮。 */
  rank?: number
  trend?: Trend
  showCover?: boolean
  onMore?: (item: MusicItem) => void
}

function TrendMark({ trend }: { trend: Trend }) {
  if (trend.dir === 'new') return <span className="trend is-new">NEW</span>
  if (trend.dir === 'same') return <span className="trend is-same">-</span>
  return (
    <span className={`trend is-${trend.dir}`}>
      <TrendIcon dir={trend.dir} />
      {trend.change}
    </span>
  )
}

export function SongRow({ item, onClick, onPlayMv, index = 0, active = false, rank, trend, showCover = false, onMore }: Props) {
  const dur = formatDuration(item.duration)
  return (
    <div
      role="button"
      tabIndex={0}
      className={`song-row song-row--name${active ? ' is-playing' : ''}${showCover ? ' has-cover' : ''}`}
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
      {rank ? (
        <span className={`song-rank${rank <= 3 ? ' is-top' : ''}`}>
          <b>{rank}</b>
          {trend ? <TrendMark trend={trend} /> : null}
        </span>
      ) : null}
      {showCover ? <Img className="song-thumb" src={coverUrl(item.image, 120)} label={item.title} /> : null}
      <div className="song-main">
        <div className="song-title">
          {active ? (
            <span className="playing-bars" aria-label="正在播放">
              <i />
              <i />
              <i />
            </span>
          ) : null}
          <span className="song-name">{item.title}</span>
        </div>
        {item.artist ? (
          <div className="song-sub">
            {item.artist}
            {item.album ? ` · ${item.album}` : ''}
          </div>
        ) : null}
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
      {dur && !onMore ? <span className="song-duration">{dur}</span> : null}
      {onMore ? (
        <button
          type="button"
          className="song-more"
          aria-label={`${item.title} 的更多操作`}
          onClick={(event) => {
            event.stopPropagation()
            onMore(item)
          }}
        >
          <MoreIcon />
        </button>
      ) : null}
    </div>
  )
}
