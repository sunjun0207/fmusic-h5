import { useEffect, useState } from 'react'
import type { MusicItem } from '../lib/types'
import { SongRow } from './SongRow'

type Tab = 'queue' | 'recent'

type Props = {
  open: boolean
  queue: MusicItem[]
  recent: MusicItem[]
  currentId: string | null
  onClose: () => void
  onPickQueue: (item: MusicItem) => void
  onPickRecent: (item: MusicItem) => void
}

export function PlayQueueSheet({
  open,
  queue,
  recent,
  currentId,
  onClose,
  onPickQueue,
  onPickRecent,
}: Props) {
  const [tab, setTab] = useState<Tab>('queue')

  useEffect(() => {
    if (open) setTab('queue')
  }, [open])

  if (!open) return null

  const items = tab === 'queue' ? queue : recent
  const emptyText = tab === 'queue' ? '还没有正在播放的歌曲' : '还没有最近播放'

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet queue-sheet"
        role="dialog"
        aria-label="播放列表"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="queue-head">
          <h3>播放列表</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="queue-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'queue'}
            className={`queue-tab${tab === 'queue' ? ' on' : ''}`}
            onClick={() => setTab('queue')}
          >
            当前播放
            <span>{queue.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'recent'}
            className={`queue-tab${tab === 'recent' ? ' on' : ''}`}
            onClick={() => setTab('recent')}
          >
            最近播放
            <span>{recent.length}</span>
          </button>
        </div>
        <div className="queue-list">
          {items.length === 0 ? (
            <div className="empty">{emptyText}</div>
          ) : (
            items.map((item, i) => (
              <SongRow
                key={`${tab}-${item.id}`}
                item={item}
                index={i}
                active={item.id === currentId}
                onClick={() => (tab === 'queue' ? onPickQueue(item) : onPickRecent(item))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
