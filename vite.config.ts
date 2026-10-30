import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

const KUWO_AUDIO_HOST = /^kw-[a-z0-9-]+\.kuwo\.cn$/i

function kuwoAudioProxy(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const raw = req.url || ''
  const matched = raw.match(/^\/api-fmusic-pomelo7-server\/kw-audio\/(kw-[a-z0-9-]+\.kuwo\.cn)(\/.*)$/i)
  if (!matched || !KUWO_AUDIO_HOST.test(matched[1])) {
    next()
    return
  }
  const host = matched[1]
  const headers: http.OutgoingHttpHeaders = { ...req.headers, host }
  delete headers.cookie
  delete headers.origin
  delete headers.referer
  const upstream = http.request(
    {
      hostname: host,
      port: 80,
      method: req.method,
      path: matched[2],
      headers,
    },
    (incoming) => {
      res.writeHead(incoming.statusCode || 502, incoming.headers)
      incoming.pipe(res)
    },
  )
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502)
    res.end()
  })
  req.pipe(upstream)
}

function kuwoAudioProxyPlugin(): Plugin {
  return {
    name: 'kuwo-audio-proxy',
    configureServer(server) {
      server.middlewares.use(kuwoAudioProxy)
    },
    configurePreviewServer(server) {
      server.middlewares.use(kuwoAudioProxy)
    },
  }
}

/**
 * 按 --mode 读取 .env.local / .env.dev / .env.pro:
 *   npm run dev        -> 默认 mode,仅加载 .env.local(Vite 禁止 --mode local)
 *   npm run build:dev  -> mode=dev,.env.local + .env.dev 覆盖
 *   npm run build      -> mode=pro,.env.local + .env.pro 覆盖
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  const proxyRule = (
    prefix: string,
    target: string,
    replaceWith = '',
    headers?: Record<string, string>,
  ): ProxyOptions => ({
    target,
    changeOrigin: true,
    rewrite: (p) => p.replace(new RegExp(`^${prefix}`), replaceWith),
    ...(headers ? { headers } : {}),
    configure: (proxy) => {
      proxy.on('proxyRes', (proxyRes) => {
        proxyRes.headers['access-control-allow-origin'] = '*'
        proxyRes.headers['access-control-allow-methods'] = 'GET, HEAD, POST, OPTIONS'
        proxyRes.headers['access-control-allow-headers'] = 'Origin, Accept, Content-Type, Range, Cache-Control, Pragma'
      })
    },
  })

  return {
    base: env.VITE_BASE || '/',
    plugins: [react(), kuwoAudioProxyPlugin()],
    server: {
      host: true,
      port: Number(env.VITE_DEV_PORT) || 5173,
      proxy: {
        '/api-fmusic-pomelo7-server/api': proxyRule('/api-fmusic-pomelo7-server/api', env.VITE_API_TARGET, '/api'),
        '/api-fmusic-pomelo7-server/kw-search': proxyRule('/api-fmusic-pomelo7-server/kw-search', env.VITE_KW_SEARCH_TARGET),
        '/api-fmusic-pomelo7-server/kw-openapi': proxyRule('/api-fmusic-pomelo7-server/kw-openapi', env.VITE_KW_OPENAPI_TARGET),
        '/api-fmusic-pomelo7-server/kw-nmobi': proxyRule('/api-fmusic-pomelo7-server/kw-nmobi', env.VITE_KW_NMOBI_TARGET, '', {
          'User-Agent': 'okhttp/3.10.0',
        }),
        '/api-fmusic-pomelo7-server/kw-img': proxyRule('/api-fmusic-pomelo7-server/kw-img', env.VITE_KW_IMG_TARGET),
        '/api-fmusic-pomelo7-server/kw-cdn': proxyRule('/api-fmusic-pomelo7-server/kw-cdn', env.VITE_KW_CDN_TARGET),
        '/api-fmusic-pomelo7-server/kw-comment': proxyRule(
          '/api-fmusic-pomelo7-server/kw-comment',
          env.VITE_KW_COMMENT_TARGET,
          '',
          {
            Referer: 'https://www.kuwo.cn/',
            'User-Agent': 'Mozilla/5.0',
          },
        ),
        '/api-fmusic-pomelo7-server/kw-wapi': proxyRule(
          '/api-fmusic-pomelo7-server/kw-wapi',
          env.VITE_KW_WAPI_TARGET || 'https://wapi.kuwo.cn',
        ),
        '/api-fmusic-pomelo7-server/kw-npl': proxyRule(
          '/api-fmusic-pomelo7-server/kw-npl',
          env.VITE_KW_NPL_TARGET || 'https://nplserver.kuwo.cn',
        ),
      },
    },
    build: {
      sourcemap: env.VITE_SOURCEMAP === 'true',
    },
  }
})
