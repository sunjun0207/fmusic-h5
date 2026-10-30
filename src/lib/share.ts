import { BRAND } from './brand'
import { cleanArtist, cleanText } from './text'
import type { MusicItem } from './types'

export type ShareTarget =
  | { kind: 'song'; music: MusicItem }
  | { kind: 'playlist'; id: string; name: string }

export type SharedLink =
  | { kind: 'song'; music: MusicItem }
  | { kind: 'playlist'; id: string }

const SONG = '#song='
const PLAYLIST = '#playlist='

function toBase64Url(raw: string): string {
  const bytes = new TextEncoder().encode(raw)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(raw: string): string {
  let b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  if (pad) b64 += '='.repeat(4 - pad)
  const bin = atob(b64)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

function baseUrl(): string {
  return `${location.origin}${location.pathname}${location.search}`
}

export function shareUrl(target: ShareTarget): string {
  if (target.kind === 'playlist') return `${baseUrl()}${PLAYLIST}${encodeURIComponent(target.id)}`
  const { id, title, artist, album, image, duration } = target.music
  return `${baseUrl()}${SONG}${toBase64Url(JSON.stringify({ id, title, artist, album, image, duration }))}`
}

export function readSharedLink(): SharedLink | null {
  const hash = location.hash
  try {
    if (hash.startsWith(PLAYLIST)) {
      const id = decodeURIComponent(hash.slice(PLAYLIST.length))
      return /^\d+$/.test(id) ? { kind: 'playlist', id } : null
    }
    if (!hash.startsWith(SONG)) return null
    const data = JSON.parse(fromBase64Url(decodeURIComponent(hash.slice(SONG.length)))) as Partial<MusicItem>
    const id = String(data.id ?? '')
    if (!/^\d+$/.test(id)) return null
    return {
      kind: 'song',
      music: {
        id,
        title: cleanText(String(data.title ?? '')) || '未知歌曲',
        artist: cleanArtist(String(data.artist ?? '')) || '未知歌手',
        album: cleanText(String(data.album ?? '')),
        image: typeof data.image === 'string' ? data.image : undefined,
        duration: Number(data.duration) || 0,
      },
    }
  } catch {
    return null
  }
}

export function clearSharedLink() {
  if (!location.hash.startsWith(SONG) && !location.hash.startsWith(PLAYLIST)) return
  history.replaceState(null, '', baseUrl())
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = value
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    area.remove()
    return ok
  }
}

/** 先用系统分享面板，不支持或被取消时复制链接。返回给用户看的提示，用户主动取消返回空串。 */
export async function shareTarget(target: ShareTarget): Promise<string> {
  const url = shareUrl(target)
  const title =
    target.kind === 'song'
      ? `${target.music.title} - ${target.music.artist}`
      : `歌单「${target.name}」`
  const text = `我在${BRAND.name} ${BRAND.en} 听到了${title}，${BRAND.motto}`
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `${title} | ${BRAND.name}`, text, url })
      return '已分享，愿你遇见同频的人'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return ''
    }
  }
  return (await copyText(`${text} ${url}`)) ? '链接已复制，快去分享这份喜欢吧' : '复制失败，请稍后再试'
}
