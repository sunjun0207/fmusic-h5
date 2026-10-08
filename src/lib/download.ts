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

/** 曲库 MINFO 里的 size 是 MiB，保留两位，例如 10.29Mb。 */
export function catalogSize(fileInfo: string | undefined, qualityId: string): string {
  if (!fileInfo) return ''
  const wantFormat = qualityId === 'flac' ? 'flac' : 'mp3'
  const wantBitrate = qualityId === '128kmp3' ? '128' : qualityId === '320kmp3' ? '320' : ''
  for (const part of fileInfo.split(';')) {
    const format = part.match(/(?:^|,)format:([^,]+)/)?.[1] ?? ''
    const bitrate = part.match(/(?:^|,)bitrate:([^,]+)/)?.[1] ?? ''
    const size = part.match(/(?:^|,)size:([^,]+)/)?.[1] ?? ''
    if (format !== wantFormat || !size || size === 'zpMb') continue
    if (wantBitrate && bitrate !== wantBitrate) continue
    return size.replace(/mb$/i, ' MB')
  }
  return ''
}

export function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
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

function isAudioPayload(bytes: Uint8Array, contentType: string): boolean {
  const ct = contentType.toLowerCase()
  if (ct.includes('text/html') || ct.includes('application/json') || ct.includes('text/plain')) return false
  if (bytes.length < 4) return false
  const mark = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)
  if (mark.startsWith('ID3') || mark === 'fLaC' || mark === 'OggS' || mark === 'RIFF') return true
  // MP3 帧同步
  if (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) return true
  return ct.startsWith('audio/')
}

export async function saveTrackFile(url: string, filename: string): Promise<number> {
  if (!url.startsWith('/proxy/')) throw new Error('下载地址无效')
  const res = await fetch(url)
  if (!res.ok) throw new Error('下载失败')
  const bytes = new Uint8Array(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') ?? ''
  if (!isAudioPayload(bytes, contentType)) {
    throw new Error('下载到的不是音频（多半是网页），没有保存。请确认反代正常后重试')
  }
  const declared = Number(res.headers.get('content-length'))
  if (!res.headers.get('content-encoding') && Number.isFinite(declared) && declared > 0 && bytes.byteLength !== declared) {
    throw new Error(`文件不完整：收到 ${formatBytes(bytes.byteLength)}，服务器声明 ${formatBytes(declared)}`)
  }
  const blob = new Blob([bytes], { type: contentType || 'application/octet-stream' })
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000)
  return bytes.byteLength
}

/**
 * 普通浏览器直接保存为「歌名-歌手.mp3」。
 * 微信内置浏览器会拦截下载并提示去系统浏览器，这里不触发下载，只把歌曲记在地址里。
 */
export async function requestDownload(
  url: string,
  filename: string,
): Promise<{ mode: 'wechat' } | { mode: 'started'; bytes: number }> {
  if (!url) throw new Error('没有下载地址')
  if (isWeChat()) {
    const next = `${HASH_PREFIX}${encodePayload({ url, filename })}`
    if (location.hash === next) {
      window.dispatchEvent(new Event('hashchange'))
    } else {
      location.hash = next.slice(1)
    }
    return { mode: 'wechat' }
  }
  const bytes = await saveTrackFile(url, filename)
  return { mode: 'started', bytes }
}
