import { createContext, useContext } from 'react'
import type { ShareTarget } from './share'
import type { MusicItem, TabId, View } from './types'

export type SongMenuExtra = { label: string; danger?: boolean; run: () => void }

export type AppActions = {
  open: (view: View) => void
  back: () => void
  goTab: (tab: TabId) => void
  /** 播放整张列表但不打开播放页，底部出现迷你播放器。 */
  playList: (list: MusicItem[], index?: number, label?: string) => void
  /** 点歌：替换播放队列并打开播放页。 */
  openMusic: (item: MusicItem, list?: MusicItem[]) => void
  openComments: (item: MusicItem, list?: MusicItem[]) => void
  playNext: (item: MusicItem) => void
  playMv: (item: MusicItem) => void
  notify: (text: string) => void
  share: (target: ShareTarget) => void
  addToPlaylist: (item: MusicItem) => void
  openSongMenu: (item: MusicItem, list?: MusicItem[], extra?: SongMenuExtra[]) => void
  openQueue: () => void
  current: MusicItem | null
  currentId: string | null
  playing: boolean
  /** 收藏、歌单、最近播放变化时加一，页面据此重新读本地数据。 */
  libraryVersion: number
  bumpLibrary: () => void
  /** MV 标记被核实后加一。 */
  mvVersion: number
}

export const AppContext = createContext<AppActions | null>(null)

export function useApp(): AppActions {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp 必须在 AppContext 里使用')
  return value
}
