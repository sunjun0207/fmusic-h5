import { useCallback, useRef, useState } from 'react'
import { useApp } from './appContext'
import { friendlyError, type Station } from './brand'
import { getPrivateMix, getStationMix } from './discover'

/** 电台、私人专属要先拉歌单再播，按钮上显示加载中，重复点击忽略。 */
export function useMixPlayer() {
  const app = useApp()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const busy = useRef(false)

  const run = useCallback(
    async (id: string, label: string, load: () => Promise<{ list: Parameters<typeof app.playList>[0] }>, fallback: string) => {
      if (busy.current) return
      busy.current = true
      setLoadingId(id)
      try {
        const mix = await load()
        app.playList(mix.list, 0, label)
      } catch (error) {
        app.notify(friendlyError(error, fallback))
      } finally {
        busy.current = false
        setLoadingId(null)
      }
    },
    [app],
  )

  const playStation = useCallback(
    (station: Station) => run(`station:${station.id}`, station.title, () => getStationMix(station), '电台暂时没有信号，换一个试试'),
    [run],
  )

  const playPrivate = useCallback(
    () => run('private', '私人专属', () => getPrivateMix(), '私人专属还没准备好，稍后再来'),
    [run],
  )

  return { loadingId, playStation, playPrivate }
}
