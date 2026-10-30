import { coverUrl } from '../lib/api'
import { useApp } from '../lib/appContext'
import { formatCount } from '../lib/format'
import type { PlaylistCard } from '../lib/types'
import { HeadphoneIcon } from './Icons'
import { Img } from './Img'

export function PlaylistTile({ card, index = 0 }: { card: PlaylistCard; index?: number }) {
  const app = useApp()
  return (
    <button
      type="button"
      className="tile"
      style={{ animationDelay: `${Math.min(index, 9) * 0.04}s` }}
      onClick={() => app.open({ kind: 'playlist', id: card.id, name: card.name, pic: card.pic })}
    >
      <span className="tile-cover">
        <Img src={coverUrl(card.pic)} label={card.name} />
        {card.playCount > 0 ? (
          <span className="tile-count">
            <HeadphoneIcon size={11} />
            {formatCount(card.playCount)}
          </span>
        ) : null}
      </span>
      <span className="tile-name">{card.name}</span>
    </button>
  )
}
