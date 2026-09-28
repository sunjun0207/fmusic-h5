import { useState } from 'react'
import { SongRow } from '../components/SongRow'
import { clearFavorites, getFavorites, removeFavorite } from '../lib/storage'
import type { MusicItem } from '../lib/types'

type Props = {
  onOpenMusic: (item: MusicItem, queue?: MusicItem[]) => void
}

export function FavoritePage({ onOpenMusic }: Props) {
  const [list, setList] = useState(() => getFavorites())

  const refresh = () => setList(getFavorites())

  return (
    <div>
      <div className="section-title">
        我的收藏
        {list.length ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('清空全部收藏？')) {
                clearFavorites()
                refresh()
              }
            }}
          >
            <span>清空</span>
          </button>
        ) : (
          <span>0 首</span>
        )}
      </div>

      {list.length === 0 ? (
        <div className="empty">还没有收藏，播放页点 ♥ 即可加入</div>
      ) : (
        list.map((item, i) => (
          <div key={item.id} className="fav-row">
            <SongRow
              item={item}
              index={i}
              onClick={() => onOpenMusic(item, list)}
            />
            <button
              type="button"
              className="fav-remove"
              aria-label="取消收藏"
              onClick={() => {
                removeFavorite(item.id)
                refresh()
              }}
            >
              ♥
            </button>
          </div>
        ))
      )}
    </div>
  )
}
