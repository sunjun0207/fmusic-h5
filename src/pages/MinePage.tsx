import { useMemo, useState, type ReactNode } from 'react'
import { ChevronIcon, ClockIcon, DownloadIcon, GearIcon, HeartIcon, PlusIcon } from '../components/Icons'
import { Img } from '../components/Img'
import { WaveMark } from '../components/Logo'
import { PromptDialog } from '../components/Sheets'
import { Empty, SectionHead } from '../components/UI'
import { coverUrl } from '../lib/api'
import { useApp } from '../lib/appContext'
import { PAGE, TEXT } from '../lib/brand'
import {
  createMyPlaylist,
  getDownloads,
  getFavorites,
  getMyPlaylists,
  getRecentPlays,
  getSavedPlaylists,
} from '../lib/storage'
import type { View } from '../lib/types'

type Row = { key: string; cover?: string; title: string; sub: string; view: View }

function ListRows({ rows }: { rows: Row[] }) {
  const app = useApp()
  return (
    <div className="mine-rows">
      {rows.map((row) => (
        <button key={row.key} type="button" className="mine-row" onClick={() => app.open(row.view)}>
          <Img className="mine-row-cover" src={row.cover} label={row.title} />
          <span>
            <strong>{row.title}</strong>
            <em>{row.sub}</em>
          </span>
          <ChevronIcon />
        </button>
      ))}
    </div>
  )
}

export function MinePage() {
  const app = useApp()
  const [creating, setCreating] = useState(false)
  const library = useMemo(
    () => ({
      favorites: getFavorites(),
      recent: getRecentPlays(),
      downloads: getDownloads(),
      mine: getMyPlaylists(),
      saved: getSavedPlaylists(),
    }),
    // libraryVersion 变化说明本地数据改了，重新读一遍。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.libraryVersion],
  )
  const entries: { id: string; label: string; count: number; icon: ReactNode; view: View }[] = [
    { id: 'favorite', label: '我的收藏', count: library.favorites.length, icon: <HeartIcon size={22} />, view: { kind: 'favorite' } },
    { id: 'recent', label: '最近播放', count: library.recent.length, icon: <ClockIcon size={22} />, view: { kind: 'recent' } },
    { id: 'download', label: '下载管理', count: library.downloads.length, icon: <DownloadIcon size={22} />, view: { kind: 'download' } },
    { id: 'setting', label: '设置', count: -1, icon: <GearIcon size={22} />, view: { kind: 'setting' } },
  ]

  return (
    <div className="mine">
      <section className="profile-card">
        <div className="profile-glow" aria-hidden="true" />
        <span className="profile-avatar" aria-hidden="true">
          <WaveMark playing={app.playing} />
        </span>
        <div className="profile-copy">
          <strong>聆听者</strong>
          <p>{PAGE.mine.headline}</p>
        </div>
        <dl className="profile-stats">
          <div>
            <dt>收藏</dt>
            <dd>{library.favorites.length}</dd>
          </div>
          <div>
            <dt>歌单</dt>
            <dd>{library.mine.length + library.saved.length}</dd>
          </div>
          <div>
            <dt>最近</dt>
            <dd>{library.recent.length}</dd>
          </div>
        </dl>
      </section>

      <nav className="mine-entries" aria-label="我的音乐">
        {entries.map((entry) => (
          <button key={entry.id} type="button" className={`mine-entry is-${entry.id}`} onClick={() => app.open(entry.view)}>
            <span className="mine-entry-icon">{entry.icon}</span>
            <strong>{entry.label}</strong>
            {entry.count >= 0 ? <em>{entry.count}</em> : null}
          </button>
        ))}
      </nav>

      <section className="home-sec">
        <SectionHead title="我的歌单" en="MY PLAYLISTS" desc="把喜欢的歌，装进属于你的心情里。" />
        <button type="button" className="create-row" onClick={() => setCreating(true)}>
          <span className="create-icon">
            <PlusIcon />
          </span>
          <span>
            <strong>{TEXT.createPlaylist}</strong>
            <em>深夜循环、通勤必备、雨天限定……随你命名</em>
          </span>
        </button>
        <ListRows
          rows={library.mine.map((list) => {
            const cover = list.songs.find((song) => song.image)?.image
            return {
              key: list.id,
              cover: cover ? coverUrl(cover, 120) : undefined,
              title: list.name,
              sub: `${list.songs.length} 首`,
              view: { kind: 'myPlaylist', id: list.id },
            }
          })}
        />
      </section>

      <section className="home-sec">
        <SectionHead title="收藏的歌单" en="SAVED" desc="总有一些好音乐，值得被更多人听见。" />
        {library.saved.length ? (
          <ListRows
            rows={library.saved.map((card) => ({
              key: card.id,
              cover: coverUrl(card.pic),
              title: card.name,
              sub: `${card.total} 首${card.creator ? ` · ${card.creator}` : ''}`,
              view: { kind: 'playlist', id: card.id, name: card.name, pic: card.pic },
            }))}
          />
        ) : (
          <Empty text="还没有收藏歌单，去歌单广场逛逛吧" action="去发现" onAction={() => app.goTab('discover')} />
        )}
      </section>

      {creating ? (
        <PromptDialog
          title={TEXT.createPlaylist}
          placeholder="给歌单起个名字，比如：深夜循环"
          confirm="创建"
          onClose={() => setCreating(false)}
          onSubmit={(name) => {
            const list = createMyPlaylist(name)
            setCreating(false)
            app.bumpLibrary()
            app.notify(`已创建「${list.name}」`)
            app.open({ kind: 'myPlaylist', id: list.id })
          }}
        />
      ) : null}
    </div>
  )
}
