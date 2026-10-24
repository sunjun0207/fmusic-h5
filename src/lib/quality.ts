export const POSTER_OPTIONS = [
  { size: 300, label: '标清' },
  { size: 500, label: '高清' },
  { size: 1000, label: '超清' },
] as const

export const MV_QUALITIES = [
  { id: 'MP4', label: '标清' },
  { id: 'MP4HV', label: '高清' },
  { id: 'MP4UL', label: '超清' },
] as const

const MV_LADDER = ['MP4L', 'MP4', 'MP4HV', 'MP4UL'] as const

export type MvQualityId = (typeof MV_LADDER)[number]

export function isPosterSize(size: number): boolean {
  return POSTER_OPTIONS.some((item) => item.size === size)
}

export function isMvQuality(id: string): id is MvQualityId {
  return MV_LADDER.some((item) => item === id)
}

/** 下拉里只出现这三档。流畅归到标清，MP4H 归到高清，蓝光归到超清。 */
export function visibleMvQuality(id: string): (typeof MV_QUALITIES)[number]['id'] {
  const key = id.trim().toUpperCase()
  if (key === 'MP4L' || key === 'MP4') return 'MP4'
  if (key === 'MP4HV' || key === 'MP4H') return 'MP4HV'
  return 'MP4UL'
}

const MV_FORMAT_ALIAS: Record<string, (typeof MV_QUALITIES)[number]['id']> = {
  MP4: 'MP4',
  EXMP4: 'MP4',
  MP4L: 'MP4',
  EXMP4L: 'MP4',
  MP4H: 'MP4HV',
  EXMP4H: 'MP4HV',
  MP4HV: 'MP4HV',
  EXMP4HV: 'MP4HV',
  MP4UL: 'MP4UL',
  EXMP4UL: 'MP4UL',
}

/** 搜索 FORMATS 里标出的档位。认不出时返回 undefined，交给播放前再探测。 */
export function mvQualitiesFromFormats(formats: string | undefined): string[] | undefined {
  if (!formats?.trim()) return undefined
  const found = new Set<string>()
  for (const token of formats.split('|')) {
    const visible = MV_FORMAT_ALIAS[token.trim().toUpperCase()]
    if (visible) found.add(visible)
  }
  if (!found.size) return undefined
  return MV_QUALITIES.map((item) => item.id).filter((id) => found.has(id))
}

/** 首选档没有时，取这首歌有的下一档，不往上加。 */
export function bestMvQuality(preferred: string, available: readonly string[]): string {
  const order = ['MP4UL', 'MP4HV', 'MP4']
  const start = order.indexOf(visibleMvQuality(preferred))
  for (let index = start < 0 ? 0 : start; index < order.length; index += 1) {
    const id = order[index]
    if (id && available.includes(id)) return id
  }
  return available[0] || 'MP4'
}

export function mvLabel(id: string): string {
  const visible = visibleMvQuality(id)
  return MV_QUALITIES.find((item) => item.id === visible)?.label ?? '超清'
}

/** 先要所选画质。高清没有 MP4HV 时再试 MP4H，标清没有 MP4 时再试 MP4L，然后才往下降。 */
export function mvFallback(id: string): string[] {
  const picked = visibleMvQuality(id)
  if (picked === 'MP4') return ['MP4', 'MP4L']
  if (picked === 'MP4HV') return ['MP4HV', 'MP4H', 'MP4', 'MP4L']
  return ['MP4UL', 'MP4HV', 'MP4H', 'MP4', 'MP4L']
}
