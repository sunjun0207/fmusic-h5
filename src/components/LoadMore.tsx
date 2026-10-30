import { useEffect, useRef } from 'react'
import { TEXT } from '../lib/brand'
import { Pending } from './Pending'

type Props = {
  loading: boolean
  done: boolean
  error?: string
  onMore: () => void
  /** 隐藏的页面不要自动翻页。 */
  active?: boolean
  doneText?: string
}

/** 滚到底自动加载下一页；出错时换成「再试一次」。 */
export function LoadMore({ loading, done, error, onMore, active = true, doneText = '已经到底啦，换个分类逛逛吧' }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const moreRef = useRef(onMore)
  moreRef.current = onMore

  useEffect(() => {
    const el = ref.current
    if (!el || done || error || !active) return
    const root = el.closest('.app-main')
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) moreRef.current()
      },
      { root, rootMargin: '240px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [done, error, active, loading])

  return (
    <div ref={ref} className="list-sentinel">
      {error ? (
        <button type="button" className="pill-btn ghost" onClick={onMore}>
          {error} · {TEXT.retry}
        </button>
      ) : loading ? (
        <Pending text={TEXT.loading} layout="inline" />
      ) : done ? (
        doneText
      ) : (
        '上拉加载更多'
      )}
    </div>
  )
}
