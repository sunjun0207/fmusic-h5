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
        <p>有些歌，只适合在夜色安静下来的时候遇见。来这里寻一首，让歌词跟着旋律慢慢走近，把零碎的光阴，听成一段温柔而从容的停留。</p>
        <button type="button" className="hero-search" onClick={onOpenSearch}>
          <span className="hero-search-icon" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </span>
          <span>
            <strong>搜索歌曲</strong>
            <em>输入歌名或歌手</em>
          </span>
        </button>
      </section>

      {queue.length > 0 ? (
        <button type="button" className="queue-entry" onClick={onOpenQueue}>
          <span>
            <strong>当前播放</strong>
            {current ? (
              <em>
                {current.title}
                {current.artist ? ` · ${current.artist}` : ''}
              </em>
            ) : null}
          </span>
          <span>{queue.length} 首</span>
        </button>
      ) : null}

      <div className="section-title">
        最近播放
        <span>{recent.length ? `${recent.length} 首` : '还没有记录'}</span>
      </div>
      {recent.length === 0 ? (
        <div className="empty">还没有听过的歌。先搜索一首，让旋律慢慢到来。</div>
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
