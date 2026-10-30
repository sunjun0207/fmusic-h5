import { useMemo, useState } from 'react'
import { EditIcon, HeartIcon, ShareIcon, TrashIcon } from '../components/Icons'
import { LoadMore } from '../components/LoadMore'
import { WaveMark } from '../components/Logo'
import { ConfirmDialog, PromptDialog } from '../components/Sheets'
import { firstCover, ListHero, PlayAllButton, TrackList } from '../components/TrackList'
import { Empty, Retry, SkeletonRows } from '../components/UI'
import { coverUrl } from '../lib/api'
import { useApp } from '../lib/appContext'
import { momentLabel, momentStation, PAGE, PICKS, SECTION, TEXT } from '../lib/brand'
import {
  CHART_PAGE,
  getArtistSongs,
  getChartSongs,
  getDailyMix,
  getPlaylistDetail,
  getPrivateMix,
  PLAYLIST_SONG_PAGE,
  searchPlaylists,
  shuffleOfDay,
  today,
} from '../lib/discover'
import { dateParts, formatCount } from '../lib/format'
import {
  clearRecentPlays,
  deleteMyPlaylist,
  getMyPlaylist,
  getRecentPlays,
  isSavedPlaylist,
  removeFromMyPlaylist,
  renameMyPlaylist,
  toggleSavedPlaylist,
} from '../lib/storage'
import type { MusicItem, PlaylistCard, Trend } from '../lib/types'
import { usePaged } from '../lib/usePaged'
import { useRemote } from '../lib/useRemote'

type Ranked = { song: MusicItem; trend?: Trend }

export function ChartView({ id, name, pic, active }: { id: string; name: string; pic?: string; active: boolean }) {
  const head = useRemote(`chart:${id}:1`, () => getChartSongs(id))
  const paged = usePaged<Ranked>(
    `chart-view:${id}`,
    async (page) => {
      const data = await getChartSongs(id, page)
      return {
        items: data.list.map((song) => ({ song, trend: data.trends[song.id] })),
        done: data.list.length < CHART_PAGE || page * CHART_PAGE >= data.total,
      }
    },
    { first: 1, idOf: (item) => item.song.id },
  )
  const list = useMemo(() => paged.list.map((item) => item.song), [paged.list])
  const trends = useMemo(
    () => Object.fromEntries(paged.list.filter((item) => item.trend).map((item) => [item.song.id, item.trend!])),
    [paged.list],
  )

  return (
    <div>
      <ListHero
        title={name}
        cover={pic ? coverUrl(pic) : firstCover(list)}
        eyebrow="TOP CHARTS"
        meta={head.data?.pub ? `${head.data.pub} 更新 · 共 ${head.data.total} 首` : PAGE.charts.headline}
        desc={PAGE.charts.desc}
      >
        <PlayAllButton list={list} label={name} />
      </ListHero>
      {paged.error && !list.length ? <Retry text={paged.error} onRetry={paged.reload} /> : null}
      {!paged.loaded && !paged.error ? <SkeletonRows count={8} /> : null}
      <TrackList list={list} ranked trends={trends} />
      {paged.loaded ? (
        <LoadMore
          loading={paged.loading}
          done={paged.done}
          error={list.length ? paged.error : ''}
          onMore={() => void paged.more()}
          active={active}
          doneText="榜单到底啦，去别的榜单看看吧"
        />
      ) : null}
    </div>
  )
}

function cardOf(detail: PlaylistCard): PlaylistCard {
  const { id, name, pic, playCount, total, creator } = detail
  return { id, name, pic, playCount, total, creator }
}

export function PlaylistView({ id, name, pic, active }: { id: string; name?: string; pic?: string; active: boolean }) {
  const app = useApp()
  const head = useRemote(`playlist:${id}:0`, () => getPlaylistDetail(id, 0))
  const paged = usePaged<MusicItem>(
    `playlist-view:${id}`,
    async (page) => {
      const detail = await getPlaylistDetail(id, page)
      return {
        items: detail.songs,
        done: detail.songs.length === 0 || (page + 1) * PLAYLIST_SONG_PAGE >= detail.total,
      }
    },
    { idOf: (song) => song.id },
  )
  const [saved, setSaved] = useState(() => isSavedPlaylist(id))
  const detail = head.data
  const title = detail?.name || name || '歌单'

  return (
    <div>
      <ListHero
        title={title}
        cover={coverUrl(detail?.pic || pic)}
        eyebrow="PLAYLIST"
        meta={
          detail
            ? `${formatCount(detail.playCount)} 次播放 · ${detail.total} 首${detail.creator ? ` · ${detail.creator}` : ''}`
            : TEXT.loading
        }
        desc={detail?.info}
        tags={detail?.tags}
      >
        <PlayAllButton list={paged.list} label={title} />
        <button
          type="button"
          className={`pill-btn ghost${saved ? ' is-on' : ''}`}
          disabled={!detail}
          onClick={() => {
            if (!detail) return
            const on = toggleSavedPlaylist(cardOf(detail))
            setSaved(on)
            app.bumpLibrary()
            app.notify(on ? '已收藏歌单，在「我的」里随时找到它' : '已取消收藏歌单')
          }}
        >
          <HeartIcon size={15} filled={saved} />
          {saved ? '已收藏' : '收藏歌单'}
        </button>
        <button
          type="button"
          className="round-btn"
          aria-label={TEXT.share}
          onClick={() => app.share({ kind: 'playlist', id, name: title })}
        >
          <ShareIcon size={16} />
        </button>
      </ListHero>
      {paged.error && !paged.list.length ? <Retry text={paged.error} onRetry={paged.reload} /> : null}
      {!paged.loaded && !paged.error ? <SkeletonRows count={8} /> : null}
      <TrackList list={paged.list} />
      {paged.loaded ? (
        <LoadMore
          loading={paged.loading}
          done={paged.done}
          error={paged.list.length ? paged.error : ''}
          onMore={() => void paged.more()}
          active={active}
          doneText="歌单听完啦，收藏起来下次再听"
        />
      ) : null}
    </div>
  )
}

export function PickView({ id }: { id: string }) {
  const app = useApp()
  const pick = PICKS.find((item) => item.id === id) ?? PICKS[0]!
  const { data, error, reload } = useRemote(`pick:${pick.id}:${today()}`, async () => {
    if (pick.source.kind === 'chart') {
      const chart = await getChartSongs(pick.source.id)
      return { list: chart.list, playlist: null as PlaylistCard | null }
    }
    const cards = (await searchPlaylists(pick.source.keyword)).slice(0, 3)
    const playlist = shuffleOfDay(cards, `pick:${pick.id}`)[0]
    if (!playlist) throw new Error('精选暂时空空的')
    const detail = await getPlaylistDetail(playlist.id)
    return { list: detail.songs, playlist }
  })
  const list = data?.list ?? []

  return (
    <div>
      <ListHero
        title={pick.title}
        cover={firstCover(list)}
        eyebrow={`EDITOR PICKS · ${pick.en}`}
        meta={pick.desc}
        desc={data?.playlist ? `今日选自歌单《${data.playlist.name}》` : undefined}
        tone={pick.tone}
      >
        <PlayAllButton list={list} label={pick.title} />
        {data?.playlist ? (
          <button
            type="button"
            className="pill-btn ghost"
            onClick={() => {
              const card = data.playlist!
              app.open({ kind: 'playlist', id: card.id, name: card.name, pic: card.pic })
            }}
          >
            查看原歌单
          </button>
        ) : null}
      </ListHero>
      {error && !list.length ? <Retry text={error} onRetry={reload} /> : null}
      {!data && !error ? <SkeletonRows count={8} /> : null}
      <TrackList list={list} />
    </div>
  )
}

export function ArtistView({ id, name, pic, active }: { id: string; name: string; pic?: string; active: boolean }) {
  const head = useRemote(`artist:${id}:1`, () => getArtistSongs(id))
  const paged = usePaged<MusicItem>(
    `artist-view:${id}`,
    async (page) => {
      const data = await getArtistSongs(id, page)
      return { items: data.list, done: data.list.length < CHART_PAGE || page * CHART_PAGE >= data.total }
    },
    { first: 1, idOf: (song) => song.id },
  )

  return (
    <div>
      <ListHero
        title={name}
        cover={pic ? coverUrl(pic) : firstCover(paged.list)}
        round
        eyebrow="ARTIST"
        meta={head.data ? `${head.data.total} 首歌曲` : TEXT.loading}
        desc="让好音乐，找到懂它的人。"
      >
        <PlayAllButton list={paged.list} label={name} />
      </ListHero>
      {paged.error && !paged.list.length ? <Retry text={paged.error} onRetry={paged.reload} /> : null}
      {!paged.loaded && !paged.error ? <SkeletonRows count={8} /> : null}
      <TrackList list={paged.list} />
      {paged.loaded ? (
        <LoadMore
          loading={paged.loading}
          done={paged.done}
          error={paged.list.length ? paged.error : ''}
          onMore={() => void paged.more()}
          active={active}
          doneText="TA 的歌都在这里啦"
        />
      ) : null}
    </div>
  )
}

export function DailyView() {
  const { data, error, reload } = useRemote(`daily-mix:${today()}`, getDailyMix)
  const { day, month, week } = dateParts()
  const list = data?.list ?? []
  const note = data
    ? data.basedOn.length
      ? `根据你常听的 ${data.basedOn.join('、')} 推荐`
      : '多听几首、收藏喜欢的歌，推荐会越来越懂你'
    : TEXT.loading

  return (
    <div>
      <ListHero
        title={PAGE.daily.title}
        cover={firstCover(list)}
        art={
          <span className="date-art">
            <b>{day}</b>
            <em>{month}</em>
          </span>
        }
        eyebrow={`${PAGE.daily.en} · ${week}`}
        meta={PAGE.daily.headline}
        desc={`${PAGE.daily.desc} ${note}`}
      >
        <PlayAllButton list={list} label={PAGE.daily.title} />
      </ListHero>
      {error && !list.length ? <Retry text={error} onRetry={reload} /> : null}
      {!data && !error ? <SkeletonRows count={8} /> : null}
      <TrackList list={list} />
    </div>
  )
}

export function PrivateView() {
  const station = momentStation()
  const { data, error, reload } = useRemote(`private-mix:${today()}:${station.id}`, getPrivateMix)
  const list = data?.list ?? []

  return (
    <div>
      <ListHero
        title={SECTION.private.title}
        cover={firstCover(list)}
        art={<WaveMark playing className="hero-wave" />}
        eyebrow={SECTION.private.en}
        meta={`此刻 · ${momentLabel()} · ${station.title}`}
        desc={`${SECTION.private.desc} ${station.desc}`}
        tone="violet"
      >
        <PlayAllButton list={list} label={SECTION.private.title} />
      </ListHero>
      {error && !list.length ? <Retry text={error} onRetry={reload} /> : null}
      {!data && !error ? <SkeletonRows count={8} /> : null}
      <TrackList list={list} />
    </div>
  )
}

export function MyPlaylistView({ id }: { id: string }) {
  const app = useApp()
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const list = useMemo(
    () => getMyPlaylist(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, app.libraryVersion, app.mvVersion],
  )

  if (!list) return <Empty text="这张歌单已经不在了" action="返回" onAction={app.back} />

  const created = new Date(list.createdAt)
  return (
    <div>
      <ListHero
        title={list.name}
        cover={firstCover(list.songs)}
        eyebrow="MY PLAYLIST"
        meta={`${list.songs.length} 首 · 创建于 ${created.getFullYear()}.${created.getMonth() + 1}.${created.getDate()}`}
        desc="把喜欢的歌，装进属于你的心情里。"
      >
        <PlayAllButton list={list.songs} label={list.name} />
        <button type="button" className="round-btn" aria-label="重命名歌单" onClick={() => setRenaming(true)}>
          <EditIcon size={16} />
        </button>
        <button type="button" className="round-btn" aria-label="删除歌单" onClick={() => setDeleting(true)}>
          <TrashIcon size={16} />
        </button>
      </ListHero>
      {list.songs.length ? (
        <TrackList
          list={list.songs}
          extra={(song) => [
            {
              label: '从歌单中移除',
              danger: true,
              run: () => {
                removeFromMyPlaylist(id, song.id)
                app.bumpLibrary()
                app.notify('已从歌单移除')
              },
            },
          ]}
        />
      ) : (
        <Empty text={TEXT.emptyList} action="去发现好歌" onAction={() => app.goTab('discover')} />
      )}
      {renaming ? (
        <PromptDialog
          title="重命名歌单"
          initial={list.name}
          confirm="保存"
          onClose={() => setRenaming(false)}
          onSubmit={(name) => {
            renameMyPlaylist(id, name)
            setRenaming(false)
            app.bumpLibrary()
            app.notify('歌单名已更新')
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="删除歌单"
          text={`「${list.name}」里的歌不会从收藏里消失，只是这张歌单不在了。`}
          confirm="删除"
          onClose={() => setDeleting(false)}
          onConfirm={() => {
            deleteMyPlaylist(id)
            app.back()
            app.bumpLibrary()
            app.notify('歌单已删除')
          }}
        />
      ) : null}
    </div>
  )
}

export function RecentView() {
  const app = useApp()
  const [clearing, setClearing] = useState(false)
  const list = useMemo(
    () => getRecentPlays(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.libraryVersion, app.mvVersion],
  )

  return (
    <div>
      <ListHero
        title="最近播放"
        cover={firstCover(list)}
        eyebrow="RECENTLY PLAYED"
        meta={`${list.length} 首`}
        desc="听过的每一首，都替你记着。"
      >
        <PlayAllButton list={list} label="最近播放" />
        {list.length ? (
          <button type="button" className="round-btn" aria-label="清空最近播放" onClick={() => setClearing(true)}>
            <TrashIcon size={16} />
          </button>
        ) : null}
      </ListHero>
      {list.length ? (
        <TrackList list={list} />
      ) : (
        <Empty text="还没有听过的歌，先去发现一首吧" action="去首页逛逛" onAction={() => app.goTab('home')} />
      )}
      {clearing ? (
        <ConfirmDialog
          title="清空最近播放"
          text="清空后，每日推荐会暂时少一些参考。"
          confirm="清空"
          onClose={() => setClearing(false)}
          onConfirm={() => {
            clearRecentPlays()
            app.bumpLibrary()
            app.notify('最近播放已清空')
          }}
        />
      ) : null}
    </div>
  )
}
