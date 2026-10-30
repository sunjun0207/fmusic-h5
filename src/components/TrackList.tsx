import type { ReactNode } from 'react'
import { coverUrl } from '../lib/api'
import { useApp, type SongMenuExtra } from '../lib/appContext'
import { TEXT } from '../lib/brand'
import { formatCount } from '../lib/format'
import type { MusicItem, Trend } from '../lib/types'
import { PlayIcon } from './Icons'
import { Img } from './Img'
import { SongRow } from './SongRow'

type ListProps = {
  list: MusicItem[]
  /** 点歌时放进播放队列的完整列表，默认就是 list。 */
  queue?: MusicItem[]
  ranked?: boolean
  trends?: Record<string, Trend>
  covers?: boolean
  /** 每首歌的额外菜单项，比如「从歌单移除」。 */
  extra?: (item: MusicItem) => SongMenuExtra[]
}

export function TrackList({ list, queue = list, ranked = false, trends, covers = true, extra }: ListProps) {
  const app = useApp()
  return (
    <div className="track-list">
      {list.map((item, index) => (
        <SongRow
          key={item.id}
          item={item}
          index={index}
          rank={ranked ? index + 1 : undefined}
          trend={trends?.[item.id]}
          showCover={covers}
          active={item.id === app.currentId}
          onClick={() => app.openMusic(item, queue)}
          onPlayMv={app.playMv}
          onMore={(song) => app.openSongMenu(song, queue, extra?.(song))}
        />
      ))}
    </div>
  )
}

type HeroProps = {
  title: string
  cover?: string
  /** 没有封面时放在封面位置的内容，比如日期。 */
  art?: ReactNode
  /** 歌手头像用圆形。 */
  round?: boolean
  eyebrow?: ReactNode
  meta?: ReactNode
  desc?: string
  tags?: string[]
  tone?: string
  children?: ReactNode
}

/** 歌单、榜单、歌手页的头部：模糊封面背景 + 封面 + 标题 + 操作。 */
export function ListHero({ title, cover, art, round = false, eyebrow, meta, desc, tags, tone, children }: HeroProps) {
  return (
    <section className={`list-hero${tone ? ` tone-${tone}` : ''}`}>
      {cover ? <div className="list-hero-bg" style={{ backgroundImage: `url(${JSON.stringify(cover)})` }} aria-hidden="true" /> : null}
      <div className="list-hero-mask" aria-hidden="true" />
      <div className="list-hero-body">
        {art ? (
          <span className="list-hero-cover is-art">{art}</span>
        ) : (
          <Img className={`list-hero-cover${round ? ' is-round' : ''}`} src={cover} label={title} />
        )}
        <div className="list-hero-copy">
          {eyebrow ? <p className="list-hero-eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {meta ? <p className="list-hero-meta">{meta}</p> : null}
          {desc ? <p className="list-hero-desc">{desc}</p> : null}
          {tags?.length ? (
            <div className="list-hero-tags">
              {tags.slice(0, 4).map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {children ? <div className="list-hero-actions">{children}</div> : null}
    </section>
  )
}

export function PlayAllButton({ list, label, count }: { list: MusicItem[]; label: string; count?: number }) {
  const app = useApp()
  return (
    <button type="button" className="pill-btn play-all" disabled={!list.length} onClick={() => app.playList(list, 0, label)}>
      <PlayIcon size={16} />
      {TEXT.playAll}
      <em>{formatCount(count ?? list.length)}</em>
    </button>
  )
}

/** 歌单封面：取第一首歌的专辑图。 */
export function firstCover(list: MusicItem[]): string | undefined {
  const song = list.find((item) => item.image)
  return song ? coverUrl(song.image, 300) : undefined
}
