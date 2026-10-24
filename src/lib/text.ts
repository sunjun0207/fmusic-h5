import type { MusicItem } from './types'

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  middot: '·',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
}

const NAMED_ENTITY = new RegExp(`&(${Object.keys(NAMED_ENTITIES).join('|')});?`, 'gi')

/** 酷我搜索和歌词里常留下 &apos;、&nbsp;、多反斜杠 \\uXXXX。 */
export function cleanText(input: string): string {
  let text = input
  for (let i = 0; i < 4; i += 1) {
    const next = text.replace(/\\+u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    if (next === text) break
    text = next
  }
  if (/%(?:u[0-9a-fA-F]{4}|[0-9a-fA-F]{2})/.test(text)) {
    try {
      text = decodeURIComponent(
        text.replace(/%u([0-9a-fA-F]{4})/g, (_, hex: string) => `%${hex.slice(0, 2)}%${hex.slice(2)}`),
      )
    } catch {
      /* keep the original text */
    }
  }
  text = text.replace(/<[^>]+>/g, '')
  const codePoint = (value: number) => {
    if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) return ''
    return String.fromCodePoint(value)
  }
  for (let i = 0; i < 4; i += 1) {
    NAMED_ENTITY.lastIndex = 0
    const next = text
      .replace(/&#(\d+);/g, (_, num: string) => codePoint(Number(num)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => codePoint(Number.parseInt(hex, 16)))
      .replace(NAMED_ENTITY, (all, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? all)
    if (next === text) break
    text = next
  }
  return text
    .replace(/\\+[nrt]/g, ' ')
    .replace(/\\+/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** 多位歌手用 & 或 \\u0026 分隔，R&B 这类写法保留。 */
export function cleanArtist(input: string): string {
  const text = cleanText(input).replace(/\s*&\s*/g, (sep, offset, source) => {
    const prev = source[offset - 1] ?? ''
    const next = source[offset + sep.length] ?? ''
    if (/[A-Za-z0-9]/.test(prev) && /[A-Za-z0-9]/.test(next) && !/\s/.test(sep)) return '&'
    return '、'
  })
  return text.replace(/、{2,}/g, '、').replace(/^、|、$/g, '').trim()
}

export function normalizeMusic(item: MusicItem): MusicItem {
  return {
    ...item,
    title: cleanText(item.title || '') || '未知歌曲',
    artist: cleanArtist(item.artist || '') || '未知歌手',
    album: cleanText(item.album || ''),
  }
}
