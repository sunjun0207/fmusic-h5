/** false：浏览器直连曲库。true：接口、封面和下载走本站 /api-fmusic-pomelo7-server。 */
const env = import.meta.env ?? {}
export const useProxy = env.VITE_USE_PROXY === 'true'

const RELATIVE_PREFIX = '/api-fmusic-pomelo7-server'

type CapacitorBridge = {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

/** 安装包里的页面跑在 WebView，要等 Capacitor 注入后再判断。 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor
  if (typeof cap?.isNativePlatform === 'function') return cap.isNativePlatform()
  const platform = cap?.getPlatform?.()
  return platform === 'android' || platform === 'ios'
}

/** 线上站点。安装包里的 WebView 把相对路径的接口转发到这里。 */
export function serverOrigin(): string {
  return String(env.VITE_API_TARGET || 'https://music.4848948.xyz').replace(/\/$/, '')
}

/** 页面始终请求相对路径。浏览器打到当前站点，安装包由 Android 转发到线上反代。 */
export function apiPrefix(): string {
  return RELATIVE_PREFIX
}

const KUWO_HOST = /(^|\.)kuwo\.cn$/i
const KUWO_AUDIO_HOST = /^kw-[a-z0-9-]+\.kuwo\.cn$/i

type Channel = 'api' | 'search' | 'openapi' | 'nmobi' | 'img' | 'comment' | 'wapi' | 'npl'

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
  wapi: directBase(env.VITE_KW_WAPI_TARGET, 'https://wapi.kuwo.cn'),
  npl: directBase(env.VITE_KW_NPL_TARGET, 'https://nplserver.kuwo.cn'),
}

function proxyPath(channel: Channel): string {
  const prefix = apiPrefix()
  switch (channel) {
    case 'api':
      return `${prefix}/api`
    case 'search':
      return `${prefix}/kw-search`
    case 'openapi':
      return `${prefix}/kw-openapi`
    case 'nmobi':
      return `${prefix}/kw-nmobi`
    case 'img':
      return `${prefix}/kw-img`
    case 'comment':
      return `${prefix}/kw-comment`
    case 'wapi':
      return `${prefix}/kw-wapi`
    case 'npl':
      return `${prefix}/kw-npl`
  }
}

/** 直连歌词。openapi 不回跨域头，这个地址会。 */
export const DIRECT_LYRIC = 'https://m.kuwo.cn/newh5/singles/songinfoandlrc'

export function endpoint(channel: Channel, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  // 安装包不走 music.4848948.xyz。该域名现在对所有路径都返回 {"hello":"world"}，不是曲库反代。
  // 原生请求没有跨域限制，直接访问曲库。播放地址的 okhttp UA 在 FMusicNet 里补上。
  if (hasNativeNet()) return `${DIRECT[channel]}${normalized}`
  // 自有接口没有跨域头，浏览器直连会被拦。
  // 播放地址接口认浏览器 UA，直连只会给大约 16KB 的试听。本站反代会换成 okhttp，再把曲库文件地址交回页面直连播放。
  if (channel === 'api' || channel === 'nmobi') return `${proxyPath(channel)}${normalized}`
  return `${(useProxy ? proxyPath(channel) : DIRECT[channel])}${normalized}`
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
  if (!useProxy || hasNativeNet()) return playbackUrl(url)
  return proxyDownloadUrl(url)
}

/**
 * 保存文件时一律改走本站。
 * 曲库响应自带 Content-Disposition，跨域下载会用 M800….mp3 这类原始名，浏览器会丢掉页面指定的「歌名-歌手」。
 */
export function proxyDownloadUrl(url: string): string {
  const prefix = apiPrefix()
  if (url.startsWith(`${prefix}/`)) return url
  if (url.startsWith(`${RELATIVE_PREFIX}/`)) {
    return prefix === RELATIVE_PREFIX ? url : `${prefix}${url.slice(RELATIVE_PREFIX.length)}`
  }
  const direct = playbackUrl(url)
  try {
    const parsed = new URL(direct)
    if (!KUWO_AUDIO_HOST.test(parsed.hostname)) return direct
    return `${prefix}/kw-audio/${parsed.hostname}${parsed.pathname}${parsed.search}`
  } catch {
    return direct
  }
}

/** 图片直连失败时，改走本站再保存，才能使用「歌名-歌手-封面」。 */
export function imageProxyUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || !KUWO_HOST.test(parsed.hostname)) return null
    return `${apiPrefix()}/kw-img${parsed.pathname}${parsed.search}`
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

type NativeRequester = {
  request: (id: string, url: string, method: string, headersJson: string, body: string) => void
}

type PendingNet = {
  resolve: (response: Response) => void
  reject: (error: Error) => void
}

/** 安装包注入了 FMusicNet 时，接口不走 WebView，避免本地页面请求打不到线上。 */
export function hasNativeNet(): boolean {
  return nativeRequester() !== null
}

function nativeRequester(): NativeRequester | null {
  if (typeof window === 'undefined') return null
  const bridge = (window as Window & { FMusicNet?: NativeRequester }).FMusicNet
  if (!bridge || typeof bridge.request !== 'function') return null
  return bridge
}

function absoluteApiUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input
  if (input.startsWith('/')) return `${serverOrigin()}${input}`
  return input
}

let netSeq = 0

function installNativeNet() {
  const w = window as Window & {
    __fmusicNetDone?: (id: string, status: number, contentType: string, base64: string, error: string) => void
    __fmusicPending?: Map<string, PendingNet>
  }
  if (w.__fmusicNetDone) return
  const pending = new Map<string, PendingNet>()
  w.__fmusicPending = pending
  w.__fmusicNetDone = (id, status, contentType, base64, error) => {
    const job = pending.get(id)
    pending.delete(id)
    if (!job) return
    if (error) {
      job.reject(new Error(error))
      return
    }
    const binary = atob(base64 || '')
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    job.resolve(
      new Response(bytes, {
        status: status > 0 ? status : 502,
        headers: contentType ? { 'content-type': contentType } : undefined,
      }),
    )
  }
}

/** 直连曲库时不带 Cookie，避免对方 Access-Control-Allow-Origin: * 配不上凭证。 */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.delete('cache-control')
  headers.delete('pragma')
  const bridge = nativeRequester()
  if (!bridge) {
    return fetch(input, {
      ...init,
      headers,
      credentials: 'omit',
    })
  }
  installNativeNet()
  const id = `n${Date.now().toString(36)}${(netSeq += 1)}`
  const method = (init.method || 'GET').toUpperCase()
  const headerMap: Record<string, string> = {}
  headers.forEach((value, key) => {
    headerMap[key] = value
  })
  const body = typeof init.body === 'string' ? init.body : ''
    const pending = (window as Window & { __fmusicPending?: Map<string, PendingNet> }).__fmusicPending
    return new Promise((resolve, reject) => {
      if (init.signal?.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'))
        return
      }
      let settled = false
      const timer = window.setTimeout(() => finish(new Error('接口超时')), 40000)
      const finish = (error?: Error, response?: Response) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        pending?.delete(id)
        init.signal?.removeEventListener('abort', onAbort)
        if (error) reject(error)
        else if (response) resolve(response)
      }
      const onAbort = () => finish(new DOMException('The operation was aborted.', 'AbortError'))
      init.signal?.addEventListener('abort', onAbort, { once: true })
      pending?.set(id, {
        resolve: (response) => finish(undefined, response),
        reject: (error) => finish(error),
      })
    try {
      bridge.request(id, absoluteApiUrl(input), method, JSON.stringify(headerMap), body)
    } catch (error) {
      finish(error instanceof Error ? error : new Error('接口调用失败'))
    }
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
