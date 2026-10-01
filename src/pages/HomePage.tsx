import { useState } from 'react'
import type { MusicItem } from '../lib/types'
import { SongRow } from '../components/SongRow'
import { getRecentPlays } from '../lib/storage'

type Props = {
  onOpenSearch: () => void
  onOpenMusic: (item: MusicItem, queue?: MusicItem[]) => void
}

export function HomePage({ onOpenSearch, onOpenMusic }: Props) {
  const [recent] = useState(() => getRecentPlays())

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

      <div className="section-title">
        最近播放
        <span>{recent.length ? `${recent.length} 首` : '还没有记录'}</span>
      </div>
      {recent.length === 0 ? (
        <div className="empty">从搜索开始，点开歌曲即可播放</div>
      ) : (
        recent.slice(0, 20).map((item, i) => (
          <SongRow
            key={item.id}
            item={item}
            index={i}
            onClick={() => onOpenMusic(item, recent.slice(0, 20))}
          />
        ))
      )}
    </div>
  )
}
