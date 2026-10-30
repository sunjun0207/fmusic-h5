import { useCallback, useEffect, useRef, useState } from 'react'
import { FireIcon, SearchIcon } from '../components/Icons'
import { Pending } from '../components/Pending'
import { SongRow } from '../components/SongRow'
import { postSearch, searchKey, searchMusic } from '../lib/api'
import { useApp } from '../lib/appContext'
import { friendlyError, TEXT } from '../lib/brand'
import { getChartSongs } from '../lib/discover'
import {
  addSearchHistory,
  clearSearchHistory,
  getSearchHistory,
  removeSearchHistory,
} from '../lib/storage'
import type { MusicItem } from '../lib/types'
import { useRemote } from '../lib/useRemote'

type Props = {
  active: boolean
  noMvStamp?: { id: string; token: number } | null
}

const PAGE_SIZE = 20

/** 热搜：取飙升榜前十，点一下按歌名搜。 */
function HotSearch({ onPick }: { onPick: (keyword: string) => void }) {
  const { data } = useRemote('chart:93:1', () => getChartSongs('93'))
  const list = data?.list.slice(0, 10) ?? []
  if (!list.length) return null
  return (
    <section className="hot-search">
      <div className="section-title">
        热搜榜
        <span>大家都在搜</span>
      </div>
      <ol className="hot-search-list">
        {list.map((song, index) => (
          <li key={song.id}>
            <button type="button" onClick={() => onPick(song.title)}>
              <b className={index < 3 ? 'is-top' : undefined}>{index + 1}</b>
              <span>
                <strong>{song.title}</strong>
                <em>{song.artist}</em>
              </span>
              {index < 3 ? (
                <i className="hot-tag">
                  <FireIcon size={11} />热
                </i>
              ) : null}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function SearchPage({ active, noMvStamp }: Props) {
  const app = useApp()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [keyword, setKeyword] = useState('')
  const [history, setHistory] = useState<string[]>(() => getSearchHistory())
  const [suggests, setSuggests] = useState<string[]>([])
  const [results, setResults] = useState<MusicItem[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState('')
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)
  const suggestSeq = useRef(0)

  const draft = keyword.trim()
  const drafting = draft.length > 0 && draft !== query
  const hasMore =
    !drafting &&
    results.length > 0 &&
    (total > results.length || (total <= 0 && results.length % PAGE_SIZE === 0))

  useEffect(() => {
    if (!noMvStamp) return
    setResults((list) => list.map((item) => (item.id === noMvStamp.id ? { ...item, hasMv: false } : item)))
  }, [noMvStamp])

  useEffect(() => {
    if (!active || query) return
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 120)
    return () => window.clearTimeout(timer)
  }, [active, query])

  useEffect(() => {
    const q = keyword.trim()
    if (q.length < 1 || q === query) {
      suggestSeq.current += 1
      setSuggests([])
      setSuggesting(false)
      return
    }
    const seq = ++suggestSeq.current
    const timer = window.setTimeout(() => {
      setSuggesting(true)
      searchKey(q)
        .then((list) => {
          if (seq !== suggestSeq.current) return
          setSuggests(list)
        })
        .catch(() => {
          if (seq !== suggestSeq.current) return
          setSuggests([])
        })
        .finally(() => {
          if (seq === suggestSeq.current) setSuggesting(false)
        })
    }, 160)
    return () => window.clearTimeout(timer)
  }, [keyword, query])

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
      if (!list.length) setError(TEXT.searchEmpty)
    } catch (e) {
      setError(friendlyError(e))
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
    if (!el || !hasMore || !active) return
    const root = el.closest('.app-main') ?? null
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore()
      },
      { root, rootMargin: '160px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loadMore, results.length, active])

  return (
    <div>
      <form
        className="search-box"
        onSubmit={(e) => {
          e.preventDefault()
          void runSearch(keyword)
        }}
      >
        <SearchIcon />
        <input
          ref={inputRef}
          value={keyword}
          onChange={(e) => {
            const next = e.target.value
            setKeyword(next)
            if (!next.trim()) {
              suggestSeq.current += 1
              setSuggests([])
              setResults([])
              setQuery('')
              setTotal(0)
              setError('')
            }
          }}
          placeholder={TEXT.searchPlaceholder}
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
          aria-autocomplete="list"
          aria-expanded={drafting && suggests.length > 0}
        />
        {keyword ? (
          <button
            type="button"
            onClick={() => {
              suggestSeq.current += 1
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

      {drafting && suggests.length > 0 ? (
        <div className="suggest-list" role="listbox">
          {suggests.map((s) => (
            <button key={s} type="button" className="suggest-item" role="option" onClick={() => void runSearch(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
      {drafting && suggesting ? <Pending text="正在联想…" layout="inline" className="suggest-pending" /> : null}

      {!drafting && error && !loading ? <div className="empty">{error}</div> : null}

      {!drafting && !results.length && !loading ? (
        <>
          {history.length ? (
            <>
              <div className="section-title">
                搜索历史
                <button
                  type="button"
                  onClick={() => {
                    clearSearchHistory()
                    setHistory([])
                  }}
                >
                  <span>清空</span>
                </button>
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
          <HotSearch onPick={(word) => void runSearch(word)} />
        </>
      ) : null}

      {!drafting && loading ? <Pending text={TEXT.loading} /> : null}

      {!drafting
        ? results.map((item, i) => (
            <SongRow
              key={`${item.id}-${i}`}
              item={item}
              index={i}
              showCover
              active={item.id === app.currentId}
              onClick={() => app.openMusic(item, results)}
              onPlayMv={app.playMv}
              onMore={(song) => app.openSongMenu(song, results)}
            />
          ))
        : null}

      {!drafting && results.length > 0 ? (
        <div ref={sentinelRef} className="list-sentinel">
          {loadingMore ? <Pending text={TEXT.loading} layout="inline" /> : hasMore ? '上拉加载更多' : '没有更多了'}
        </div>
      ) : null}
    </div>
  )
}
