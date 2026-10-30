import { PlayIcon } from '../components/Icons'
import { WaveMark } from '../components/Logo'
import { PageHero } from '../components/UI'
import { momentLabel, momentStation, PAGE, STATIONS } from '../lib/brand'
import { useMixPlayer } from '../lib/usePlayers'

export function RadioPage() {
  const mix = useMixPlayer()
  const now = momentStation()
  const loadingNow = mix.loadingId === `station:${now.id}`

  return (
    <div className="radio">
      <PageHero {...PAGE.radio} />
      <button type="button" className={`radio-now tone-${now.tone}`} onClick={() => void mix.playStation(now)}>
        <span className="radio-now-copy">
          <em>此刻 · {momentLabel()}</em>
          <strong>为你调频「{now.title}」</strong>
          <span>{now.desc}</span>
        </span>
        <span className="radio-now-play">{loadingNow ? <span className="spinner" /> : <PlayIcon size={20} />}</span>
        <WaveMark playing className="radio-now-wave" />
      </button>
      <div className="station-grid">
        {STATIONS.map((station) => (
          <button
            key={station.id}
            type="button"
            className={`station-card tone-${station.tone}${station.id === now.id ? ' is-now' : ''}`}
            onClick={() => void mix.playStation(station)}
          >
            {station.id === now.id ? <i className="now-badge">此刻</i> : null}
            <em>{station.en}</em>
            <strong>{station.title}</strong>
            <span>{station.desc}</span>
            <span className="station-play" aria-hidden="true">
              {mix.loadingId === `station:${station.id}` ? <span className="spinner" /> : <PlayIcon size={14} />}
            </span>
          </button>
        ))}
      </div>
      <p className="feed-note">每个电台每天从曲库里挑一张高人气歌单，打乱顺序连续播放。</p>
    </div>
  )
}
