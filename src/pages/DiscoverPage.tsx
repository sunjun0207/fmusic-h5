import { useState } from 'react'
import { Img } from '../components/Img'
import { LoadMore } from '../components/LoadMore'
import { PlaylistTile } from '../components/PlaylistTile'
import { PageHero, Retry, SectionHead, SkeletonTiles } from '../components/UI'
import { coverUrl } from '../lib/api'
import { useApp } from '../lib/appContext'
import { PAGE, PLAYLIST_CATEGORIES, SECTION } from '../lib/brand'
import { getHotArtists, getRecommendPlaylists, PLAYLIST_PAGE, searchPlaylists } from '../lib/discover'
import { formatCount } from '../lib/format'
import type { PlaylistCard } from '../lib/types'
import { usePaged } from '../lib/usePaged'
import { useRemote } from '../lib/useRemote'

function Artists() {
  const app = useApp()
  const { data } = useRemote('hot-artists', getHotArtists)
  if (!data?.length) return null
  return (
    <section className="home-sec">
      <SectionHead {...SECTION.artists} />
      <div className="artist-scroller">
        {data.map((artist) => (
          <button
            key={artist.id}
            type="button"
            className="artist-chip"
            onClick={() => app.open({ kind: 'artist', id: artist.id, name: artist.name, pic: artist.pic })}
          >
            <Img className="artist-avatar" src={coverUrl(artist.pic)} label={artist.name} />
            <strong>{artist.name}</strong>
            <em>{formatCount(artist.fans)} 粉丝</em>
          </button>
        ))}
      </div>
    </section>
  )
}

export function DiscoverPage({ active }: { active: boolean }) {
  const [category, setCategory] = useState(PLAYLIST_CATEGORIES[0]!.id)
  const isRcm = category === 'rcm'
  const paged = usePaged<PlaylistCard>(
    `discover:${category}`,
    async (page) => {
      const items = isRcm ? await getRecommendPlaylists(page) : await searchPlaylists(category, page)
      return { items, done: isRcm ? items.length < PLAYLIST_PAGE : items.length === 0 }
    },
    { first: isRcm ? 1 : 0, idOf: (card) => card.id },
  )

  return (
    <div className="discover">
      <PageHero {...PAGE.discover} />
      {isRcm ? <Artists /> : null}
      <div className="category-bar" role="tablist" aria-label="歌单分类">
        {PLAYLIST_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === category}
            className={`chip${item.id === category ? ' is-on' : ''}`}
            onClick={() => setCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {paged.error && !paged.list.length ? <Retry text={paged.error} onRetry={paged.reload} /> : null}
      {!paged.loaded && !paged.error ? <SkeletonTiles count={9} /> : null}
      {paged.list.length ? (
        <div className="tile-grid">
          {paged.list.map((card, index) => (
            <PlaylistTile key={card.id} card={card} index={index % PLAYLIST_PAGE} />
          ))}
        </div>
      ) : null}
      {paged.loaded ? (
        <LoadMore
          loading={paged.loading}
          done={paged.done}
          error={paged.list.length ? paged.error : ''}
          onMore={() => void paged.more()}
          active={active}
        />
      ) : null}
    </div>
  )
}
