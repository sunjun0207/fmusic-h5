const KEY = 'fmusic-levels'
export const LEVELS_EVENT = 'fmusic-levels'

export type LevelScope = 'song' | 'mv'

export type PlaybackLevels = {
  volume: number
  brightness: number
}

type LevelStore = Record<LevelScope, PlaybackLevels>

const MAX_LEVELS: PlaybackLevels = { volume: 100, brightness: 100 }

function clamp(value: number) {
  if (!Number.isFinite(value)) return 100
  return Math.min(100, Math.max(0, Math.round(value)))
}

function normalize(raw: Partial<PlaybackLevels> | undefined): PlaybackLevels {
  return {
    volume: clamp(Number(raw?.volume ?? MAX_LEVELS.volume)),
    brightness: clamp(Number(raw?.brightness ?? MAX_LEVELS.brightness)),
  }
}

function readStore(): LevelStore {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '') as Partial<LevelStore>
    return {
      song: normalize(raw.song),
      mv: normalize(raw.mv),
    }
  } catch {
    return { song: { ...MAX_LEVELS }, mv: { ...MAX_LEVELS } }
  }
}

export function getLevels(scope: LevelScope): PlaybackLevels {
  return readStore()[scope]
}

export function saveLevels(scope: LevelScope, patch: Partial<PlaybackLevels>) {
  const current = readStore()
  const next: LevelStore = {
    ...current,
    [scope]: normalize({ ...current[scope], ...patch }),
  }
  localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(LEVELS_EVENT, { detail: scope }))
}

export function applyMediaLevel(media: HTMLMediaElement, volume: number) {
  const level = clamp(volume) / 100
  media.volume = level
  media.muted = level === 0
}
