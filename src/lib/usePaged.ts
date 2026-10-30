import { useCallback, useEffect, useRef, useState } from 'react'
import { friendlyError } from './brand'

export type PageResult<T> = { items: T[]; done: boolean }

type Paged<T> = { list: T[]; next: number; done: boolean }

/** 已加载的页按 key 留在内存里，切走再回来不用重新翻。 */
const store = new Map<string, Paged<unknown>>()
const jobs = new Map<string, Promise<Paged<unknown>>>()

export function usePaged<T>(
  key: string | null,
  load: (page: number) => Promise<PageResult<T>>,
  options: { first?: number; idOf?: (item: T) => string } = {},
) {
  const { first = 0 } = options
  const loadRef = useRef(load)
  loadRef.current = load
  const idRef = useRef(options.idOf)
  idRef.current = options.idOf
  const keyRef = useRef(key)
  const [state, setState] = useState<Paged<T> | undefined>(() => (key ? (store.get(key) as Paged<T>) : undefined))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchNext = useCallback(async () => {
    const k = keyRef.current
    if (!k) return
    let job = jobs.get(k) as Promise<Paged<T>> | undefined
    if (!job) {
      const prev = store.get(k) as Paged<T> | undefined
      if (prev?.done) return
      job = (async () => {
        const page = prev?.next ?? first
        const result = await loadRef.current(page)
        const idOf = idRef.current
        const seen = new Set(idOf ? (prev?.list ?? []).map(idOf) : [])
        const fresh = idOf
          ? result.items.filter((item) => {
              const id = idOf(item)
              if (seen.has(id)) return false
              seen.add(id)
              return true
            })
          : result.items
        const next: Paged<T> = {
          list: [...(prev?.list ?? []), ...fresh],
          next: page + 1,
          done: result.done || result.items.length === 0,
        }
        store.set(k, next as Paged<unknown>)
        return next
      })()
      jobs.set(k, job as Promise<Paged<unknown>>)
      const clear = () => {
        if (jobs.get(k) === (job as Promise<Paged<unknown>>)) jobs.delete(k)
      }
      job.then(clear, clear)
    }
    setLoading(true)
    setError('')
    try {
      const next = await job
      if (keyRef.current === k) setState(next)
    } catch (e) {
      if (keyRef.current === k) setError(friendlyError(e))
    } finally {
      if (keyRef.current === k) setLoading(false)
    }
  }, [first])

  useEffect(() => {
    keyRef.current = key
    setError('')
    setLoading(false)
    const cached = key ? (store.get(key) as Paged<T> | undefined) : undefined
    setState(cached)
    if (key && !cached) void fetchNext()
  }, [key, fetchNext])

  const reload = useCallback(() => {
    const k = keyRef.current
    if (!k) return
    store.delete(k)
    setState(undefined)
    void fetchNext()
  }, [fetchNext])

  return {
    list: state?.list ?? [],
    loaded: !!state,
    done: state?.done ?? false,
    loading,
    error,
    more: fetchNext,
    reload,
  }
}
