import { CommentIcon, HeartIcon, PlayIcon, ShareIcon } from '../components/Icons'
import { Img } from '../components/Img'
import { LoadMore } from '../components/LoadMore'
import { PageHero, Retry, SkeletonRows } from '../components/UI'
import { coverUrl } from '../lib/api'
import { useApp } from '../lib/appContext'
import { PAGE, TEXT } from '../lib/brand'
import { getHotCommentFeed } from '../lib/discover'
import { formatCount } from '../lib/format'
import type { HotComment } from '../lib/types'
import { usePaged } from '../lib/usePaged'

const TOPICS = ['#治愈系BGM', '#深夜emo时刻', '#通勤歌单', '#青春回忆杀', '#单曲循环', '#宝藏小众']

export function CommunityPage({ active }: { active: boolean }) {
  const app = useApp()
  const feed = usePaged<HotComment>('community-feed', async (page) => {
    const items = await getHotCommentFeed(page)
    return { items, done: page >= 40 }
  }, { idOf: (item) => item.song.id })
  const songs = feed.list.map((item) => item.song)

  return (
    <div className="community">
      <PageHero {...PAGE.community}>
        <button
          type="button"
          className="story-cta"
          onClick={() => {
            if (app.current) app.share({ kind: 'song', music: app.current })
            else app.open({ kind: 'search' })
          }}
        >
          <span>
            <strong>分享你的音乐故事</strong>
            <em>{app.current ? `把正在听的「${app.current.title}」分享给同频的人` : '先找一首懂你的歌，再把它分享出去'}</em>
          </span>
          <ShareIcon size={18} />
        </button>
      </PageHero>
      <div className="topic-row" aria-label="热门话题">
        {TOPICS.map((topic) => (
          <span key={topic} className="topic">
            {topic}
          </span>
        ))}
      </div>
      <p className="feed-note">热评来自曲库里的真实听众，每一条都是一段故事。</p>

      {feed.error && !feed.list.length ? <Retry text={feed.error} onRetry={feed.reload} /> : null}
      {!feed.loaded && !feed.error ? <SkeletonRows count={4} /> : null}

      <div className="feed">
        {feed.list.map(({ song, comments }, index) => (
          <article key={song.id} className="feed-card" style={{ animationDelay: `${Math.min(index % 6, 5) * 0.05}s` }}>
            <header className="feed-song">
              <Img className="feed-cover" src={coverUrl(song.image, 120)} label={song.title} />
              <span>
                <strong>{song.title}</strong>
                <em>{song.artist}</em>
              </span>
              <button
                type="button"
                className={`round-btn grad${song.id === app.currentId && app.playing ? ' is-on' : ''}`}
                aria-label={`${TEXT.play}：${song.title}`}
                onClick={() => app.openMusic(song, songs)}
              >
                <PlayIcon size={14} />
              </button>
            </header>
            {comments.map((comment) => (
              <div key={comment.id} className="feed-comment">
                <Img className="feed-avatar" src={comment.avatar} label={comment.name} />
                <div>
                  <p className="feed-name">
                    {comment.name}
                    <span>{comment.time.slice(0, 10)}</span>
                  </p>
                  <p className="feed-text">{comment.text}</p>
                </div>
              </div>
            ))}
            <footer className="feed-actions">
              <span className="feed-stat">
                <HeartIcon size={15} />
                {formatCount(comments.reduce((sum, comment) => sum + comment.likes, 0))}
              </span>
              <button type="button" onClick={() => app.openComments(song, songs)}>
                <CommentIcon size={15} />
                进入评论区
              </button>
              <button type="button" onClick={() => app.share({ kind: 'song', music: song })}>
                <ShareIcon size={15} />
                分享
              </button>
            </footer>
          </article>
        ))}
      </div>
      {feed.loaded ? (
        <LoadMore
          loading={feed.loading}
          done={feed.done}
          error={feed.list.length ? feed.error : ''}
          onMore={() => void feed.more()}
          active={active}
          doneText="热评已经刷完啦，去听听新歌吧"
        />
      ) : null}
    </div>
  )
}
