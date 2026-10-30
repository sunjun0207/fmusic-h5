import { useCallback, useEffect, useRef, useState } from 'react'
import { friendlyError } from './brand'
import { forget, peek, remember } from './discover'

type State<T> = { key: string | null; data?: T; error?: string }

/** 加前缀，和 discover 里各接口自己的缓存键分开，避免同一个键等待自己。 */
const slot = (key: string) => `ui:${key}`

/**
 * 读 discover 的缓存：有缓存先同步画出来，返回页面时内容和滚动位置都还在；
 * key 为 null 时不请求。
 */
export function useRemote<T>(key: string | null, load: () => Promise<T>) {
  const loadRef = useRef(load)
  loadRef.current = load
  const [state, setState] = useState<State<T>>(() => ({ key, data: key ? peek<T>(slot(key)) : undefined }))
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!key) return
    let alive = true
    setState((prev) =>
      prev.key === key && prev.data !== undefined ? { key, data: prev.data } : { key, data: peek<T>(slot(key)) },
    )
    remember(slot(key), () => loadRef.current())
      .then((data) => {
        if (alive) setState({ key, data })
      })
      .catch((error: unknown) => {
        if (alive) {
          setState((prev) => ({ key, data: prev.key === key ? prev.data : undefined, error: friendlyError(error) }))
        }
      })
    return () => {
      alive = false
    }
  }, [key, tick])

  const reload = useCallback(() => {
    if (key) forget(slot(key))
    setTick((value) => value + 1)
  }, [key])

  const same = state.key === key
  const data = same ? state.data : key ? peek<T>(slot(key)) : undefined
  const error = same ? state.error : undefined
  return { data, error, loading: data === undefined && !error, reload }
}
