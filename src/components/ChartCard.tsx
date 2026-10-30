import { coverUrl } from '../lib/api'
import { useApp } from '../lib/appContext'
import { getChartSongs } from '../lib/discover'
import type { ChartInfo } from '../lib/types'
import { useRemote } from '../lib/useRemote'
import { Img } from './Img'
import { Skeleton } from './UI'

/** 榜单卡片：封面 + 前三名。首页横滑和排行榜页共用。 */
export function ChartCard({ info, wide = false }: { info: ChartInfo; wide?: boolean }) {
  const app = useApp()
  const { data } = useRemote(`chart:${info.id}:1`, () => getChartSongs(info.id))
  const top3 = data?.list.slice(0, 3) ?? []
  return (
    <button
      type="button"
      className={`chart-card${wide ? ' is-wide' : ''}`}
      onClick={() => app.open({ kind: 'chart', id: info.id, name: info.name, pic: info.pic })}
    >
      <span className="chart-card-cover">
        <Img src={coverUrl(info.pic)} label={info.name} />
        {info.pub ? <em>{info.pub}</em> : null}
      </span>
      <span className="chart-card-body">
        <strong>{info.name}</strong>
        {top3.length ? (
          <ol>
            {top3.map((song, index) => (
              <li key={song.id}>
                <b>{index + 1}</b>
                <span>
                  {song.title}
                  <em> - {song.artist}</em>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <span className="chart-card-sk">
            <Skeleton className="sk-line" />
            <Skeleton className="sk-line" />
            <Skeleton className="sk-line short" />
          </span>
        )}
      </span>
    </button>
  )
}
