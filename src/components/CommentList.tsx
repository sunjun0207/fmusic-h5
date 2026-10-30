import { useState } from 'react'
import { Pending } from './Pending'
import type { SongComment } from '../lib/types'

type Props = {
  comments: SongComment[]
  total: number
  status: 'loading' | 'ready' | 'empty' | 'error'
  loadingMore: boolean
  onMore: () => void
}

function HeartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 19.2s-6.2-3.9-6.2-8.4C5.8 8.2 7.6 6.6 9.8 6.6c1.2 0 2.3.6 3.2 1.6.9-1 2-1.6 3.2-1.6 2.2 0 4 1.6 4 4.2 0 4.5-6.2 8.4-6.2 8.4Z" strokeLinejoin="round" />
    </svg>
  )
}

function ReplyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 16.2 4.6 19v-3.1A6.8 6.8 0 1 1 12 18.2 6.7 6.7 0 0 1 7 16.2Z" strokeLinejoin="round" />
    </svg>
  )
}

function CommentThread({ comment, depth = 0 }: { comment: SongComment; depth?: number }) {
  const [expanded, setExpanded] = useState(false)
  const replies = comment.replies
  // 一级下面的二级评论直接展示。再往下的回复收起，点「展开xxx条评论」才打开。
  const showReplies = depth === 0 || expanded
  return (
    <div className="comment-thread">
      <div className="comment-meta">
        <strong>{comment.name}</strong>
        <span>{comment.time.slice(0, 16)}</span>
      </div>
      <p>{comment.text}</p>
      <div className="comment-stats">
        <span className="comment-stat">
          <HeartIcon />
          {comment.likes}
        </span>
        <span className="comment-stat">
          <ReplyIcon />
          {comment.replyCount}
        </span>
      </div>
      {replies.length && showReplies ? (
        <div className="comment-replies">
          {replies.map((reply) => (
            <CommentThread key={reply.id} comment={reply} depth={depth + 1} />
          ))}
        </div>
      ) : null}
      {replies.length && !showReplies ? (
        <button type="button" className="comment-expand" onClick={() => setExpanded(true)}>
          展开{comment.replyCount}条评论
        </button>
      ) : null}
    </div>
  )
}

export function CommentList({ comments, total, status, loadingMore, onMore }: Props) {
  return (
    <section className="comment-panel" aria-label="歌曲评论">
      <div className="comment-head">
        <div>
          <strong>评论</strong>
          {total > 0 ? <span>{total}</span> : null}
        </div>
      </div>
      {status === 'loading' ? <Pending text="评论加载中…" layout="inline" /> : null}
      {status === 'error' ? <p className="comment-note">评论暂时没有加载出来</p> : null}
      {status === 'empty' ? <p className="comment-note">暂无评论</p> : null}
      <ul className="comment-list">
        {comments.map((comment) => (
          <li key={comment.id}>
            {comment.avatar ? <img src={comment.avatar} alt="" /> : <span className="comment-avatar" />}
            <CommentThread comment={comment} />
          </li>
        ))}
      </ul>
      {status === 'ready' && comments.length < total ? (
        <button type="button" className="comment-more" onClick={onMore} disabled={loadingMore}>
          {loadingMore ? (
            <>
              <span className="pending-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              加载中…
            </>
          ) : (
            '更多评论'
          )}
        </button>
      ) : null}
    </section>
  )
}
