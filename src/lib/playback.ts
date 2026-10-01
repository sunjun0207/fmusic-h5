import type { PlayMode } from './types'

export const PLAY_MODE_ORDER: PlayMode[] = ['list', 'single', 'shuffle']

export const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  list: '列表循环',
  single: '单曲循环',
  shuffle: '随机播放',
}

export function nextPlayMode(mode: PlayMode): PlayMode {
  const index = PLAY_MODE_ORDER.indexOf(mode)
  return PLAY_MODE_ORDER[(index + 1) % PLAY_MODE_ORDER.length] ?? 'list'
}

type TrackRef = { id: string }

export type AdvanceDirection = 'next' | 'prev' | 'ended'

export type AdvanceResult<T> = {
  item: T | null
  history: string[]
  replay: boolean
}

function wrapIndex(length: number, index: number, delta: number) {
  return (index + delta + length) % length
}

/**
 * 列表循环：按队列顺序切歌，到头回到第一首。
 * 单曲循环：播完重播当前曲；手动上一首/下一首仍按队列切换。
 * 随机播放：下一首在其余歌曲里随机；上一首回到刚才播过的歌。
 */
export function resolveAdvance<T extends TrackRef>(args: {
  list: T[]
  currentId: string
  mode: PlayMode
  direction: AdvanceDirection
  history: string[]
}): AdvanceResult<T> {
  const { list, currentId, mode, direction } = args
  const history = args.history.slice()
  const pool = list
  const index = pool.findIndex((track) => track.id === currentId)

  if (direction === 'ended' && (mode === 'single' || pool.length <= 1)) {
    return { item: null, history, replay: true }
  }

  if (pool.length === 0) {
    return { item: null, history, replay: true }
  }

  if (mode === 'shuffle' && direction === 'prev') {
    while (history.length) {
      const prevId = history.pop()
      const prev = prevId ? pool.find((track) => track.id === prevId) : undefined
      if (prev && prev.id !== currentId) {
        return { item: prev, history, replay: false }
      }
    }
  }

  if (mode === 'shuffle' && (direction === 'next' || direction === 'ended')) {
    if (pool.length === 1) {
      return { item: pool[0] ?? null, history, replay: true }
    }
    if (history[history.length - 1] !== currentId) history.push(currentId)
    if (history.length > 50) history.shift()
    const others = pool.filter((track) => track.id !== currentId)
    const pick = others[Math.floor(Math.random() * others.length)] ?? pool[0] ?? null
    return { item: pick, history, replay: false }
  }

  if (pool.length === 1) {
    return { item: pool[0] ?? null, history, replay: true }
  }

  const base = index < 0 ? (direction === 'prev' ? 0 : -1) : index
  const delta = direction === 'prev' ? -1 : 1
  const item = pool[wrapIndex(pool.length, base, delta)] ?? null
  return { item, history, replay: item?.id === currentId }
}
