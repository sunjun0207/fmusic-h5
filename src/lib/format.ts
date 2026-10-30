export function formatCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '0'
  if (count < 10000) return String(Math.round(count))
  if (count < 100000000) {
    const wan = count / 10000
    return `${wan >= 100 ? Math.round(wan) : wan.toFixed(1).replace(/\.0$/, '')}万`
  }
  return `${(count / 100000000).toFixed(1).replace(/\.0$/, '')}亿`
}

export function formatDuration(sec: number): string {
  if (!sec || sec <= 0) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function dateParts(date = new Date()) {
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: `${date.getMonth() + 1}月`,
    week: WEEK[date.getDay()]!,
  }
}
