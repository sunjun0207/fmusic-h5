import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChartCard } from '../components/ChartCard'
import {
  CalendarIcon,
  ChartIcon,
  ChatIcon,
  DiscIcon,
  HeartIcon,
  PlayIcon,
  RadioIcon,
  SparkIcon,
} from '../components/Icons'
import { Img } from '../components/Img'
import { WaveMark } from '../components/Logo'
import { PlaylistTile } from '../components/PlaylistTile'
import { TrackList } from '../components/TrackList'
import { Retry, SectionHead, Skeleton, SkeletonRows, SkeletonTiles } from '../components/UI'
import { coverUrl } from '../lib/api'
import { useApp } from '../lib/appContext'
import {
  BRAND,
  HERO,
  momentLabel,
  momentStation,
  PICKS,
  SECTION,
  SLOGANS,
  STATIONS,
  STORY,
} from '../lib/brand'
import {
  getChartMenu,
  getChartSongs,
  getDailyMix,
  getHotCommentFeed,
  getRecommendPlaylists,
  today,
} from '../lib/discover'
import { dateParts, formatCount } from '../lib/format'
import type { ChartInfo, MusicItem } from '../lib/types'
import { useMixPlayer } from '../lib/usePlayers'
import { useRemote } from '../lib/useRemote'

type Slide = {
  id: string
  tag: string
  title: string
  text: string
  image?: string
  cta: string
  run: () => void
}

function Banner({ active, slides, onPlay, onExplore }: { active: boolean; slides: Slide[]; onPlay: () => void; onExplore: () => void }) {
  const [index, setIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef({ x: 0, y: 0, dx: 0, on: false, moved: false })
  const count = slides.length + 1
  const at = index % count

  useEffect(() => {
    if (!active || count < 2) return
    const timer = window.setInterval(() => {
      if (!drag.current.on) setIndex((value) => (value + 1) % count)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [active, count, index])

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, y: event.clientY, dx: 0, on: true, moved: false }
  }
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state.on) return
    const dx = event.clientX - state.x
    const dy = event.clientY - state.y
    if (!state.moved) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      if (Math.abs(dy) > Math.abs(dx)) {
        state.on = false
        return
      }
      state.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
      setDragging(true)
    }
    state.dx = dx
    setDragX(dx)
  }
  const onUp = () => {
    const state = drag.current
    if (state.moved && Math.abs(state.dx) > 40) {
      setIndex((value) => (value + (state.dx < 0 ? 1 : -1) + count) % count)
    }
    state.on = false
    setDragging(false)
    setDragX(0)
  }

  return (
    <section className="banner" aria-roledescription="carousel" aria-label="精选推荐">
      <div
        className="banner-viewport"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClickCapture={(event) => {
          if (drag.current.moved) {
            event.stopPropagation()
            event.preventDefault()
            drag.current.moved = false
          }
        }}
      >
        <div
          className={`banner-track${dragging ? ' is-dragging' : ''}`}
          style={{ transform: `translateX(calc(${-at * 100}% + ${dragX}px))` }}
        >
          <div className="banner-slide is-brand" aria-hidden={at !== 0}>
            <div className="banner-aurora" aria-hidden="true" />
            <div className="banner-wave" aria-hidden="true">
              {Array.from({ length: 28 }, (_, bar) => (
                <i key={bar} style={{ animationDelay: `${(bar % 7) * -0.18}s` }} />
              ))}
            </div>
            <p className="banner-tag">
              {BRAND.name} {BRAND.en}
            </p>
            <h1>{HERO.title}</h1>
            <p className="banner-text">{HERO.text}</p>
            <div className="banner-actions">
              <button type="button" className="pill-btn" onClick={onPlay} tabIndex={at === 0 ? 0 : -1}>
                <PlayIcon size={14} />
                {HERO.play}
              </button>
              <button type="button" className="pill-btn ghost" onClick={onExplore} tabIndex={at === 0 ? 0 : -1}>
                {HERO.explore}
              </button>
            </div>
          </div>
          {slides.map((slide, slideIndex) => (
            <div
              key={slide.id}
              className="banner-slide is-art"
              aria-hidden={at !== slideIndex + 1}
              role="button"
              tabIndex={at === slideIndex + 1 ? 0 : -1}
              onClick={slide.run}
              onKeyDown={(event) => {
                if (event.key === 'Enter') slide.run()
              }}
            >
              {slide.image ? (
                <div className="banner-art-bg" style={{ backgroundImage: `url(${JSON.stringify(slide.image)})` }} />
              ) : null}
              <div className="banner-art-mask" />
              <div className="banner-art-copy">
                <p className="banner-tag">{slide.tag}</p>
                <h2>{slide.title}</h2>
                <p className="banner-text">{slide.text}</p>
                <span className="pill-btn small">
                  <PlayIcon size={12} />
                  {slide.cta}
                </span>
              </div>
              <Img className="banner-art-cover" src={slide.image} label={slide.title} />
            </div>
          ))}
        </div>
      </div>
      <div className="banner-dots" role="tablist" aria-label="切换横幅">
        {Array.from({ length: count }, (_, dot) => (
          <button
            key={dot}
            type="button"
            role="tab"
            aria-selected={dot === at}
            aria-label={`第 ${dot + 1} 张`}
            className={dot === at ? 'is-on' : undefined}
            onClick={() => setIndex(dot)}
          />
        ))}
      </div>
    </section>
  )
}

function QuickEntries() {
  const app = useApp()
  const { day } = dateParts()
  const entries = [
    { id: 'daily', label: '每日推荐', icon: <CalendarIcon size={22} />, badge: day, run: () => app.open({ kind: 'daily' }) },
    { id: 'private', label: '私人专属', icon: <SparkIcon size={22} />, run: () => app.open({ kind: 'private' }) },
    { id: 'playlist', label: '歌单广场', icon: <DiscIcon size={22} />, run: () => app.goTab('discover') },
    { id: 'charts', label: '排行榜', icon: <ChartIcon size={22} />, run: () => app.goTab('charts') },
    { id: 'radio', label: '音乐电台', icon: <RadioIcon size={22} />, run: () => app.open({ kind: 'radio' }) },
    { id: 'community', label: '音乐社区', icon: <ChatIcon size={22} />, run: () => app.goTab('community') },
  ]
  return (
    <nav className="quick-entries" aria-label="快捷入口">
      {entries.map((entry) => (
        <button key={entry.id} type="button" className={`quick-entry is-${entry.id}`} onClick={entry.run}>
          <span className="quick-icon">
            {entry.icon}
            {entry.badge ? <b>{entry.badge}</b> : null}
          </span>
          <span>{entry.label}</span>
        </button>
      ))}
    </nav>
  )
}

function ForYou({ daily }: { daily: { list: MusicItem[]; basedOn: string[] } | undefined }) {
  const app = useApp()
  const mix = useMixPlayer()
  const { day, month, week } = dateParts()
  const station = momentStation()
  const covers = (daily?.list ?? []).filter((song) => song.image).slice(0, 3)
  return (
    <section className="home-sec">
      <SectionHead {...SECTION.forYou} />
      <div className="for-you">
        <div
          className="for-card is-daily"
          role="button"
          tabIndex={0}
          onClick={() => app.open({ kind: 'daily' })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') app.open({ kind: 'daily' })
          }}
        >
          <span className="for-date">
            <b>{day}</b>
            <em>
              {month} · {week}
            </em>
          </span>
          <strong>每日推荐</strong>
          <p>{daily?.basedOn.length ? `根据你常听的 ${daily.basedOn.slice(0, 2).join('、')}` : '今天的心情，交给音乐来安排。'}</p>
          <span className="for-covers" aria-hidden="true">
            {covers.map((song) => (
              <Img key={song.id} src={coverUrl(song.image, 120)} label={song.title} />
            ))}
          </span>
          <button
            type="button"
            className="for-play"
            aria-label="播放每日推荐"
            disabled={!daily?.list.length}
            onClick={(event) => {
              event.stopPropagation()
              if (daily?.list.length) app.playList(daily.list, 0, '每日推荐')
            }}
          >
            <PlayIcon size={16} />
          </button>
        </div>
        <div
          className="for-card is-private"
          role="button"
          tabIndex={0}
          onClick={() => app.open({ kind: 'private' })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') app.open({ kind: 'private' })
          }}
        >
          <span className="for-moment">
            此刻 · {momentLabel()}
          </span>
          <strong>{SECTION.private.title}</strong>
          <p>{SECTION.private.desc}</p>
          <span className="for-station">
            <WaveMark playing={mix.loadingId === 'private'} />
            {station.title}
          </span>
          <button
            type="button"
            className="for-play"
            aria-label="播放私人专属"
            onClick={(event) => {
              event.stopPropagation()
              void mix.playPrivate()
            }}
          >
            {mix.loadingId === 'private' ? <span className="spinner" /> : <PlayIcon size={16} />}
          </button>
        </div>
      </div>
    </section>
  )
}

function FreshSongs() {
  const app = useApp()
  const { data, error, reload } = useRemote('chart:17:1', () => getChartSongs('17'))
  const list = data?.list ?? []
  const columns: MusicItem[][] = []
  list.slice(0, 12).forEach((song, index) => {
    const column = Math.floor(index / 3)
    ;(columns[column] ??= []).push(song)
  })
  return (
    <section className="home-sec">
      <SectionHead {...SECTION.fresh} more="全部新歌" onMore={() => app.open({ kind: 'chart', id: '17', name: '新歌首发' })} />
      {error && !list.length ? <Retry text={error} onRetry={reload} /> : null}
      {!data && !error ? <SkeletonRows count={3} /> : null}
      {columns.length ? (
        <div className="fresh-scroller">
          {columns.map((column, columnIndex) => (
            <div key={columnIndex} className="fresh-column">
              {column.map((song) => (
                <button key={song.id} type="button" className="fresh-row" onClick={() => app.openMusic(song, list)}>
                  <Img className="fresh-cover" src={coverUrl(song.image, 120)} label={song.title} />
                  <span className="fresh-copy">
                    <strong>{song.title}</strong>
                    <em>{song.artist}</em>
                  </span>
                  <span className={`fresh-play${song.id === app.currentId ? ' is-on' : ''}`} aria-hidden="true">
                    <PlayIcon size={12} />
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function Picks() {
  const app = useApp()
  return (
    <section className="home-sec">
      <SectionHead {...SECTION.picks} />
      <div className="pick-scroller">
        {PICKS.map((pick) => (
          <button key={pick.id} type="button" className={`pick-card tone-${pick.tone}`} onClick={() => app.open({ kind: 'pick', id: pick.id })}>
            <em>{pick.en}</em>
            <strong>{pick.title}</strong>
            <p>{pick.desc}</p>
            <span className="pick-play" aria-hidden="true">
              <PlayIcon size={12} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function HotSongs() {
  const app = useApp()
  const { data, error, reload } = useRemote('chart:16:1', () => getChartSongs('16'))
  const list = data?.list ?? []
  return (
    <section className="home-sec">
      <SectionHead {...SECTION.hot} more="完整榜单" onMore={() => app.open({ kind: 'chart', id: '16', name: '全网热歌' })} />
      {error && !list.length ? <Retry text={error} onRetry={reload} /> : null}
      {!data && !error ? <SkeletonRows count={5} /> : null}
      {list.length ? <TrackList list={list.slice(0, 5)} queue={list} ranked trends={data?.trends} /> : null}
    </section>
  )
}

const HOME_CHARTS = ['93', '17', '158', '284', '104', '26']

function ChartRow() {
  const app = useApp()
  const { data, error, reload } = useRemote('chart-menu', getChartMenu)
  const all = (data ?? []).flatMap((group) => group.list)
  const charts = HOME_CHARTS.map((id) => all.find((chart) => chart.id === id)).filter((chart): chart is ChartInfo => !!chart)
  return (
    <section className="home-sec">
      <SectionHead {...SECTION.charts} more="全部榜单" onMore={() => app.goTab('charts')} />
      {error && !charts.length ? <Retry text={error} onRetry={reload} /> : null}
      <div className="chart-scroller">
        {charts.length
          ? charts.map((chart) => <ChartCard key={chart.id} info={chart} />)
          : !error
            ? Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="sk-chart" />)
            : null}
      </div>
    </section>
  )
}

function Stations() {
  const app = useApp()
  const mix = useMixPlayer()
  const now = momentStation()
  return (
    <section className="home-sec">
      <SectionHead {...SECTION.radio} more="全部电台" onMore={() => app.open({ kind: 'radio' })} />
      <div className="station-scroller">
        {STATIONS.map((station) => (
          <button
            key={station.id}
            type="button"
            className={`station-chip tone-${station.tone}${station.id === now.id ? ' is-now' : ''}`}
            onClick={() => void mix.playStation(station)}
          >
            {station.id === now.id ? <i className="now-badge">此刻</i> : null}
            <em>{station.en}</em>
            <strong>{station.title}</strong>
            <span>{station.desc}</span>
            <span className="station-play" aria-hidden="true">
              {mix.loadingId === `station:${station.id}` ? <span className="spinner" /> : <PlayIcon size={12} />}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function CommunityPreview() {
  const app = useApp()
  const { data, error, reload } = useRemote('hot-feed-preview', () => getHotCommentFeed(0, 3))
  const items = (data ?? []).slice(0, 2)
  return (
    <section className="home-sec">
      <SectionHead {...SECTION.community} more="进入社区" onMore={() => app.goTab('community')} />
      {error && !items.length ? <Retry text={error} onRetry={reload} /> : null}
      {!data && !error ? <SkeletonRows count={2} /> : null}
      <div className="echo-list">
        {items.map(({ song, comments }) => {
          const comment = comments[0]!
          return (
            <button key={song.id} type="button" className="echo-card" onClick={() => app.openComments(song, items.map((item) => item.song))}>
              <span className="echo-quote">“{comment.text}”</span>
              <span className="echo-meta">
                <Img className="echo-avatar" src={comment.avatar} label={comment.name} />
                <span>{comment.name}</span>
                <span className="echo-likes">
                  <HeartIcon size={12} />
                  {formatCount(comment.likes)}
                </span>
              </span>
              <span className="echo-song">
                <Img className="echo-cover" src={coverUrl(song.image, 120)} label={song.title} />
                <span>
                  {song.title} · {song.artist}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function StoryFooter() {
  return (
    <footer className="story">
      <div className="slogan-marquee" aria-hidden="true">
        <div>
          {[...SLOGANS, ...SLOGANS].map((slogan, index) => (
            <span key={index}>{slogan}</span>
          ))}
        </div>
      </div>
      <div className="lockup">
        <p className="lockup-en">{BRAND.en}</p>
        <p className="lockup-cn">音 浪</p>
        <p className="lockup-title">{HERO.title}</p>
        <p className="lockup-pillars">{BRAND.pillars}</p>
        <p className="lockup-promise">{BRAND.promise}</p>
      </div>
      <h3>{STORY.title}</h3>
      {STORY.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <p className="story-sign">{STORY.sign}</p>
    </footer>
  )
}

export function HomePage({ active }: { active: boolean }) {
  const app = useApp()
  const soar = useRemote('chart:93:1', () => getChartSongs('93'))
  const fresh = useRemote('chart:17:1', () => getChartSongs('17'))
  const hot = useRemote('chart:16:1', () => getChartSongs('16'))
  const playlists = useRemote('rcm-playlists:1', () => getRecommendPlaylists(1))
  const daily = useRemote(`daily-mix:${today()}`, getDailyMix)

  const slides: Slide[] = []
  const soarTop = soar.data?.list[0]
  if (soarTop) {
    slides.push({
      id: 'soar',
      tag: '今日飙升 No.1',
      title: soarTop.title,
      text: `${soarTop.artist} · 大家都在循环的那一首`,
      image: coverUrl(soarTop.image, 500),
      cta: '播放这首歌',
      run: () => app.openMusic(soarTop, soar.data?.list),
    })
  }
  const freshTop = fresh.data?.list[0]
  if (freshTop) {
    slides.push({
      id: 'fresh',
      tag: '新歌首发',
      title: freshTop.title,
      text: `${freshTop.artist} · 新鲜音乐准时上架`,
      image: coverUrl(freshTop.image, 500),
      cta: '抢先听',
      run: () => app.openMusic(freshTop, fresh.data?.list),
    })
  }
  const topList = playlists.data?.[0]
  if (topList) {
    slides.push({
      id: 'playlist',
      tag: '宝藏歌单',
      title: topList.name,
      text: `${formatCount(topList.playCount)} 次播放${topList.creator ? ` · ${topList.creator}` : ''}`,
      image: coverUrl(topList.pic),
      cta: '打开歌单',
      run: () => app.open({ kind: 'playlist', id: topList.id, name: topList.name, pic: topList.pic }),
    })
  }

  const playNow = () => {
    const list = daily.data?.list.length ? daily.data.list : hot.data?.list
    if (list?.length) app.openMusic(list[0]!, list)
    else app.open({ kind: 'daily' })
  }

  return (
    <div className="home">
      <Banner active={active} slides={slides} onPlay={playNow} onExplore={() => app.goTab('discover')} />
      <QuickEntries />
      <ForYou daily={daily.data} />

      <section className="home-sec">
        <SectionHead {...SECTION.playlists} more="歌单广场" onMore={() => app.goTab('discover')} />
        {playlists.error && !playlists.data ? <Retry text={playlists.error} onRetry={playlists.reload} /> : null}
        {!playlists.data && !playlists.error ? <SkeletonTiles count={6} /> : null}
        {playlists.data ? (
          <div className="tile-grid">
            {playlists.data.slice(0, 6).map((card, index) => (
              <PlaylistTile key={card.id} card={card} index={index} />
            ))}
          </div>
        ) : null}
      </section>

      <FreshSongs />
      <Picks />
      <HotSongs />
      <ChartRow />
      <Stations />
      <CommunityPreview />
      <StoryFooter />
    </div>
  )
}
