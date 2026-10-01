const HASH_PREFIX = '#dl='

export type PendingDownload = {
  url: string
  filename: string
}

export function isWeChat(): boolean {
  return /MicroMessenger/i.test(navigator.userAgent)
}

export function trackExt(quality: string, format?: string): string {
  const hint = `${format || ''} ${quality}`.toLowerCase()
  if (hint.includes('flac')) return 'flac'
  return 'mp3'
}

function cleanPart(raw: string): string {
  return raw
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 60)
}

export function trackFilename(title: string, artist: string, ext: string): string {
  const name = cleanPart(title) || '未知歌曲'
  const singer = cleanPart(artist) || '未知歌手'
  const suffix = ext.replace(/^\./, '').toLowerCase() || 'mp3'
  return `${name}-${singer}.${suffix}`
}

function encodePayload(data: PendingDownload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodePayload(raw: string): PendingDownload | null {
  try {
    let b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4
    if (pad) b64 += '='.repeat(4 - pad)
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const data = JSON.parse(new TextDecoder().decode(bytes)) as PendingDownload
    if (!data?.url || !data?.filename) return null
    if (!data.url.startsWith('/proxy/')) return null
    return { url: data.url, filename: data.filename }
  } catch {
    return null
  }
}

export function readPendingDownload(): PendingDownload | null {
  const hash = location.hash
  if (!hash.startsWith(HASH_PREFIX)) return null
  return decodePayload(decodeURIComponent(hash.slice(HASH_PREFIX.length)))
}

export function clearPendingDownload() {
  if (!location.hash.startsWith(HASH_PREFIX)) return
  history.replaceState(null, '', `${location.pathname}${location.search}`)
}

export async function saveTrackFile(url: string, filename: string): Promise<void> {
  if (!url.startsWith('/proxy/')) throw new Error('下载地址无效')
  const res = await fetch(url)
  if (!res.ok) throw new Error('下载失败')
  const blob = await res.blob()
  const file = new File([blob], filename, { type: 'application/octet-stream' })
  const objectUrl = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

/**
 * 普通浏览器直接保存为「歌名-歌手.mp3」。
 * 微信内置浏览器会拦截下载并提示去系统浏览器，这里不触发下载，只把歌曲记在地址里。
 */
export async function requestDownload(url: string, filename: string): Promise<'wechat' | 'started'> {
  if (!url) throw new Error('没有下载地址')
  if (isWeChat()) {
    const next = `${HASH_PREFIX}${encodePayload({ url, filename })}`
    if (location.hash === next) {
      window.dispatchEvent(new Event('hashchange'))
    } else {
      location.hash = next.slice(1)
    }
    return 'wechat'
  }
  await saveTrackFile(url, filename)
  return 'started'
}
