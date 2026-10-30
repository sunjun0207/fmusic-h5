import { ChartCard } from '../components/ChartCard'
import { Img } from '../components/Img'
import { PageHero, Retry, Skeleton } from '../components/UI'
import { coverUrl } from '../lib/api'
import { useApp } from '../lib/appContext'
import { PAGE } from '../lib/brand'
import { getChartMenu, getChartSongs } from '../lib/discover'
import type { ChartInfo } from '../lib/types'
import { useRemote } from '../lib/useRemote'

function ChartTile({ chart }: { chart: ChartInfo }) {
  const app = useApp()
  const { data } = useRemote(`chart:${chart.id}:1`, () => getChartSongs(chart.id))
  const cover = data?.list.find((song) => song.image)?.image
  return (
    <button
      type="button"
      className="tile"
      onClick={() => app.open({ kind: 'chart', id: chart.id, name: chart.name })}
    >
      <span className="tile-cover">
        <Img src={cover ? coverUrl(cover, 300) : undefined} label={chart.name} />
        {chart.pub ? <span className="tile-count">{chart.pub}</span> : null}
      </span>
      <span className="tile-name">{chart.name}</span>
    </button>
  )
}

export function ChartsPage() {
  const { data, error, reload } = useRemote('chart-menu', getChartMenu)
  const [official, ...rest] = data ?? []

  return (
    <div className="charts">
      <PageHero {...PAGE.charts} />
      {error && !data ? <Retry text={error} onRetry={reload} /> : null}
      {!data && !error ? (
        <div className="chart-stack">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="sk-chart wide" />
          ))}
        </div>
      ) : null}
      {official ? (
        <section className="home-sec">
          <div className="group-title">
            {official.name}
            <em>OFFICIAL</em>
          </div>
          <div className="chart-stack">
            {official.list.map((chart) => (
              <ChartCard key={chart.id} info={chart} wide />
            ))}
          </div>
        </section>
      ) : null}
      {rest.map((group) => (
        <section key={group.name} className="home-sec">
          <div className="group-title">{group.name}</div>
          <div className="tile-grid">
            {group.list.map((chart) => (
              <ChartTile key={chart.id} chart={chart} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
