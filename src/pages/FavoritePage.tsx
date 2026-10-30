import { useMemo, useState } from 'react'
import { TrashIcon } from '../components/Icons'
import { ConfirmDialog } from '../components/Sheets'
import { firstCover, ListHero, PlayAllButton, TrackList } from '../components/TrackList'
import { Empty } from '../components/UI'
import { useApp } from '../lib/appContext'
import { TEXT } from '../lib/brand'
import { clearFavorites, getFavorites, removeFavorite } from '../lib/storage'

export function FavoritePage() {
  const app = useApp()
  const [clearing, setClearing] = useState(false)
  const list = useMemo(
    () => getFavorites(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.libraryVersion, app.mvVersion],
  )

  return (
    <div>
      <ListHero
        title="我的收藏"
        cover={firstCover(list)}
        eyebrow="MY UNIVERSE"
        meta={`${list.length} 首`}
        desc="收进音乐宇宙的每一首，都是一段心情。"
      >
        <PlayAllButton list={list} label="我的收藏" />
        {list.length ? (
          <button type="button" className="round-btn" aria-label="清空收藏" onClick={() => setClearing(true)}>
            <TrashIcon size={16} />
          </button>
        ) : null}
      </ListHero>
      {list.length ? (
        <TrackList
          list={list}
          extra={(song) => [
            {
              label: '从我的收藏移除',
              danger: true,
              run: () => {
                removeFavorite(song.id)
                app.bumpLibrary()
                app.notify(TEXT.unfavorited)
              },
            },
          ]}
        />
      ) : (
        <Empty text={TEXT.emptyList} action="去发现好歌" onAction={() => app.goTab('discover')} />
      )}
      {clearing ? (
        <ConfirmDialog
          title="清空全部收藏"
          text="清空后，收藏过的歌会从音乐宇宙里消失。"
          confirm="清空"
          onClose={() => setClearing(false)}
          onConfirm={() => {
            clearFavorites()
            app.bumpLibrary()
            app.notify('收藏已清空')
          }}
        />
      ) : null}
    </div>
  )
}
