import { ChartCard } from '../components/ChartCard'
import { Img } from '../components/Img'
import { PageHero, Retry, Skeleton } from '../components/UI'
import { coverUrl } from '../lib/api'
import { useApp } from '../lib/appContext'
import { PAGE } from '../lib/brand'
import { getChartMenu } from '../lib/discover'
import { useRemote } from '../lib/useRemote'

export function ChartsPage() {
  const app = useApp()
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
              <button
                key={chart.id}
                type="button"
                className="tile"
                onClick={() => app.open({ kind: 'chart', id: chart.id, name: chart.name, pic: chart.pic })}
              >
                <span className="tile-cover">
                  <Img src={coverUrl(chart.pic)} label={chart.name} />
                  {chart.pub ? <span className="tile-count">{chart.pub}</span> : null}
                </span>
                <span className="tile-name">{chart.name}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
