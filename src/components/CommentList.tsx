import { DanmakuSwitch } from './DanmakuSwitch'
import type { SongComment } from '../lib/types'

type Props = {
  comments: SongComment[]
  total: number
  status: 'loading' | 'ready' | 'empty' | 'error'
  loadingMore: boolean
  onMore: () => void
}

export function CommentList({ comments, total, status, loadingMore, onMore }: Props) {
  return (
    <section className="comment-panel" aria-label="歌曲评论">
      <div className="comment-head">
        <div>
          <strong>评论</strong>
          {total > 0 ? <span>{total}</span> : null}
        </div>
        <DanmakuSwitch />
      </div>
      {status === 'loading' ? <p className="comment-note">评论加载中…</p> : null}
      {status === 'error' ? <p className="comment-note">评论暂时没有加载出来</p> : null}
      {status === 'empty' ? <p className="comment-note">还没有评论</p> : null}
      <ul className="comment-list">
        {comments.map((comment) => (
          <li key={comment.id}>
            {comment.avatar ? <img src={comment.avatar} alt="" /> : <span className="comment-avatar" />}
            <div>
              <div className="comment-meta">
                <strong>{comment.name}</strong>
                <span>{comment.time.slice(0, 16)}</span>
              </div>
              <p>{comment.text}</p>
              {comment.likes > 0 ? <span className="comment-like">{comment.likes} 赞</span> : null}
            </div>
          </li>
        ))}
      </ul>
      {status === 'ready' && comments.length < total ? (
        <button type="button" className="comment-more" onClick={onMore} disabled={loadingMore}>
          {loadingMore ? '加载中…' : '更多评论'}
        </button>
      ) : null}
    </section>
  )
}
