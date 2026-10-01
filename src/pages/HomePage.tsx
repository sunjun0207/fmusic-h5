import { useEffect, useState } from 'react'
import type { MusicItem } from '../lib/types'
import { SongRow } from '../components/SongRow'
import { getRecentPlays } from '../lib/storage'

type Props = {
  onOpenSearch: () => void
  onOpenMusic: (item: MusicItem, queue?: MusicItem[]) => void
  onOpenQueue: () => void
  queue: MusicItem[]
  current: MusicItem | null
  recentVersion: number
}

export function HomePage({ onOpenSearch, onOpenMusic, onOpenQueue, queue, current, recentVersion }: Props) {
  const [recent, setRecent] = useState(() => getRecentPlays())

  useEffect(() => {
    setRecent(getRecentPlays())
  }, [recentVersion])

  return (
    <div>
      <section className="hero-card">
        <h1>聆听jun.sun</h1>
        <p>搜歌、听歌、记下载。轻量网页听歌。</p>
        <button
          type="button"
          className="btn primary"
          style={{ marginTop: 18, position: 'relative', zIndex: 1 }}
          onClick={onOpenSearch}
        >
          去搜一首
        </button>
      </section>

      {queue.length > 0 ? (
        <button type="button" className="queue-entry" onClick={onOpenQueue}>
          <span>
            <strong>当前播放</strong>
            {current ? <em>{current.title}</em> : null}
          </span>
          <span>{queue.length} 首</span>
        </button>
      ) : null}

      <div className="section-title">
        最近播放
        <span>{recent.length ? `${recent.length} 首` : '还没有记录'}</span>
      </div>
      {recent.length === 0 ? (
        <div className="empty">从搜索开始，点开歌曲即可播放</div>
      ) : (
        recent.map((item, i) => (
          <SongRow
            key={item.id}
            item={item}
            index={i}
            active={item.id === current?.id}
            onClick={() => onOpenMusic(item, recent)}
          />
        ))
      )}
    </div>
  )
}
