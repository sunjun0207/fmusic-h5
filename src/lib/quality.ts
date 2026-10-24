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

/** 下拉里只出现这三档。旧的流畅归到标清，蓝光归到超清。 */
export function visibleMvQuality(id: string): (typeof MV_QUALITIES)[number]['id'] {
  if (id === 'MP4L' || id === 'MP4') return 'MP4'
  if (id === 'MP4HV') return 'MP4HV'
  return 'MP4UL'
}

/** 先要所选画质，拿不到再往下退，不往上加码。 */
export function mvFallback(id: string): MvQualityId[] {
  const picked = visibleMvQuality(id)
  const index = MV_LADDER.indexOf(picked)
  const start = index < 0 ? MV_LADDER.indexOf('MP4UL') : index
  return MV_LADDER.slice(0, start + 1).reverse()
}
