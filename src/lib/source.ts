/** false：浏览器直连曲库。true：接口、封面和下载走本站 /api-fmusic-pomelo7-server。 */
const env = import.meta.env ?? {}
export const useProxy = env.VITE_USE_PROXY === 'true'

export const API_PREFIX = '/api-fmusic-pomelo7-server'

const KUWO_HOST = /(^|\.)kuwo\.cn$/i
const KUWO_AUDIO_HOST = /^kw-[a-z0-9-]+\.kuwo\.cn$/i

type Channel = 'api' | 'search' | 'openapi' | 'nmobi' | 'img' | 'comment'

function directBase(raw: string | undefined, fallback: string): string {
  const base = (raw || fallback).replace(/\/$/, '')
  if (typeof location !== 'undefined' && location.protocol === 'https:' && base.startsWith('http://')) {
    return `https://${base.slice('http://'.length)}`
  }
  return base
}

const DIRECT: Record<Channel, string> = {
  api: `${directBase(env.VITE_API_TARGET, 'https://music.4848948.xyz')}/api`,
  search: directBase(env.VITE_KW_SEARCH_TARGET, 'https://search.kuwo.cn'),
  openapi: directBase(env.VITE_KW_OPENAPI_TARGET, 'https://kuwo.cn'),
  nmobi: directBase(env.VITE_KW_NMOBI_TARGET, 'https://nmobi.kuwo.cn'),
  img: directBase(env.VITE_KW_IMG_TARGET, 'https://img1.kuwo.cn'),
  comment: directBase(env.VITE_KW_COMMENT_TARGET, 'https://ncomment.kuwo.cn'),
}

const PROXY: Record<Channel, string> = {
  api: `${API_PREFIX}/api`,
  search: `${API_PREFIX}/kw-search`,
  openapi: `${API_PREFIX}/kw-openapi`,
  nmobi: `${API_PREFIX}/kw-nmobi`,
  img: `${API_PREFIX}/kw-img`,
  comment: `${API_PREFIX}/kw-comment`,
}

/** 直连歌词。openapi 不回跨域头，这个地址会。 */
export const DIRECT_LYRIC = 'https://m.kuwo.cn/newh5/singles/songinfoandlrc'

export function endpoint(channel: Channel, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  // 自有接口没有跨域头，浏览器直连会被拦。
  // 播放地址接口认浏览器 UA，直连只会给大约 16KB 的试听。本站反代会换成 okhttp，再把曲库文件地址交回页面直连播放。
  if (channel === 'api' || channel === 'nmobi') return `${PROXY[channel]}${normalized}`
  return `${(useProxy ? PROXY : DIRECT)[channel]}${normalized}`
}

/**
 * 歌曲和 MV 文件保持曲库原地址。只把 http 换成 https，不改查询串，也不改走本站代理。
 */
export function playbackUrl(url: string): string {
  if (!/^http:\/\//i.test(url)) return url
  try {
    if (!KUWO_HOST.test(new URL(url).hostname)) return url
  } catch {
    return url
  }
  return `https://${url.slice('http://'.length)}`
}

/** 只有开启代理时，下载记录里的地址才改写成本站 /kw-audio。 */
export function downloadUrl(url: string): string {
  if (!useProxy) return playbackUrl(url)
  return proxyDownloadUrl(url)
}

/**
 * 保存文件时一律改走本站。
 * 曲库响应自带 Content-Disposition，跨域下载会用 M800….mp3 这类原始名，浏览器会丢掉页面指定的「歌名-歌手」。
 */
export function proxyDownloadUrl(url: string): string {
  if (url.startsWith(`${API_PREFIX}/`)) return url
  const direct = playbackUrl(url)
  try {
    const parsed = new URL(direct)
    if (!KUWO_AUDIO_HOST.test(parsed.hostname)) return direct
    return `${API_PREFIX}/kw-audio/${parsed.hostname}${parsed.pathname}${parsed.search}`
  } catch {
    return direct
  }
}

/** 图片直连失败时，改走本站再保存，才能使用「歌名-歌手-封面」。 */
export function imageProxyUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || !KUWO_HOST.test(parsed.hostname)) return null
    return `${API_PREFIX}/kw-img${parsed.pathname}${parsed.search}`
  } catch {
    return null
  }
}

export function isKuwoMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && KUWO_HOST.test(parsed.hostname)
  } catch {
    return false
  }
}

/** 直连曲库时不带 Cookie，避免对方 Access-Control-Allow-Origin: * 配不上凭证。 */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.delete('cache-control')
  headers.delete('pragma')
  return fetch(input, {
    ...init,
    headers,
    credentials: 'omit',
  })
}

let jsonpSeq = 0

/** 搜索接口没有跨域头，但支持 callback。名字会被服务端转成小写。 */
export function jsonp<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const name = `fmusicjsonp${Date.now().toString(36)}${jsonpSeq++}`
    const script = document.createElement('script')
    let settled = false
    const timer = window.setTimeout(() => finish(new Error('搜索请求超时')), 15000)
    const finish = (error?: Error, data?: T) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      delete (window as unknown as Record<string, unknown>)[name]
      script.remove()
      if (error) reject(error)
      else resolve(data as T)
    }
    ;(window as unknown as Record<string, (data: T) => void>)[name] = (data) => finish(undefined, data)
    const joiner = url.includes('?') ? '&' : '?'
    script.src = `${url}${joiner}callback=${name}`
    script.async = true
    script.onerror = () => finish(new Error('搜索请求失败'))
    document.head.appendChild(script)
  })
}
