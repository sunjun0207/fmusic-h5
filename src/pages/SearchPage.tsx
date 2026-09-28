import { useCallback, useEffect, useRef, useState } from 'react'
import { SongRow } from '../components/SongRow'
import { postSearch, searchKey, searchMusic } from '../lib/api'
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  removeSearchHistory,
} from '../lib/storage'
import type { MusicItem } from '../lib/types'

type Props = {
  onOpenMusic: (item: MusicItem, queue?: MusicItem[]) => void
}

const PAGE_SIZE = 20

export function SearchPage({ onOpenMusic }: Props) {
  const [keyword, setKeyword] = useState('')
  const [history, setHistory] = useState<string[]>(() => getSearchHistory())
  const [suggests, setSuggests] = useState<string[]>([])
  const [results, setResults] = useState<MusicItem[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)

  const hasMore =
    results.length > 0 &&
    (total > results.length || (total <= 0 && results.length % PAGE_SIZE === 0))

  useEffect(() => {
    const q = keyword.trim()
    if (q.length < 1) {
      setSuggests([])
      return
    }
    const t = window.setTimeout(() => {
      searchKey(q)
        .then(setSuggests)
        .catch(() => setSuggests([]))
    }, 280)
    return () => window.clearTimeout(t)
  }, [keyword])

  const runSearch = async (raw: string) => {
    const q = raw.trim()
    if (!q) return
    setKeyword(q)
    setQuery(q)
    setLoading(true)
    setError('')
    setSuggests([])
    setPage(0)
    setTotal(0)
    try {
      addSearchHistory(q)
      setHistory(getSearchHistory())
      void postSearch(q)
      const { list, total: t } = await searchMusic(q, 0, PAGE_SIZE)
      setResults(list)
      setTotal(t > 0 ? t : list.length < PAGE_SIZE ? list.length : 0)
      setPage(0)
      if (!list.length) setError('没有找到相关歌曲')
    } catch (e) {
      setError(e instanceof Error ? e.message : '搜索失败')
      setResults([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = useCallback(async () => {
    if (!query || loadingMoreRef.current || loading) return
    if (total > 0 && results.length >= total) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    const next = page + 1
    try {
      const { list, total: t } = await searchMusic(query, next, PAGE_SIZE)
      if (t > 0) setTotal(t)
      if (!list.length) {
        setTotal((prev) => (prev > 0 ? Math.min(prev, results.length) : results.length))
        return
      }
      setResults((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        const merged = [...prev]
        for (const item of list) {
          if (!seen.has(item.id)) {
            seen.add(item.id)
            merged.push(item)
          }
        }
        if (list.length < PAGE_SIZE) setTotal(merged.length)
        return merged
      })
      setPage(next)
    } catch {
      /* keep current list */
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [query, page, total, results.length, loading])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const root = el.closest('.app-main') ?? null
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore()
      },
      { root, rootMargin: '160px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loadMore, results.length])

  return (
    <div>
      <form
        className="search-box"
        onSubmit={(e) => {
          e.preventDefault()
          void runSearch(keyword)
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" strokeLinecap="round" />
        </svg>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索歌曲 / 歌手"
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
        />
        {keyword ? (
          <button
            type="button"
            onClick={() => {
              setKeyword('')
              setSuggests([])
              setResults([])
              setQuery('')
              setTotal(0)
              setError('')
            }}
          >
            清除
          </button>
        ) : null}
      </form>

      {suggests.length > 0 && !loading && results.length === 0 ? (
        <div className="suggest-list">
          {suggests.slice(0, 10).map((s) => (
            <button key={s} type="button" className="suggest-item" onClick={() => void runSearch(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {!results.length && !loading ? (
        <>
          <div className="section-title">
            搜索历史
            {history.length ? (
              <button
                type="button"
                onClick={() => {
                  clearSearchHistory()
                  setHistory([])
                }}
              >
                <span>清空</span>
              </button>
            ) : (
              <span>暂无</span>
            )}
          </div>
          <div className="chip-wrap">
            {history.map((h) => (
              <button
                key={h}
                type="button"
                className="chip"
                onClick={() => void runSearch(h)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  removeSearchHistory(h)
                  setHistory(getSearchHistory())
                }}
              >
                {h}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {loading ? <div className="loading">搜索中…</div> : null}
      {error && !loading ? <div className="empty">{error}</div> : null}

      {results.map((item, i) => (
        <SongRow
          key={`${item.id}-${i}`}
          item={item}
          index={i}
          onClick={() => onOpenMusic(item, results)}
        />
      ))}

      {results.length > 0 ? (
        <div ref={sentinelRef} className="list-sentinel">
          {loadingMore ? '加载更多…' : hasMore ? '上拉加载更多' : '没有更多了'}
        </div>
      ) : null}
    </div>
  )
}
