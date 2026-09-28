import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

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
  })

  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
    server: {
      host: true,
      port: Number(env.VITE_DEV_PORT) || 5173,
      proxy: {
        '/proxy/api': proxyRule('/proxy/api', env.VITE_API_TARGET, '/api'),
        '/proxy/kw-search': proxyRule('/proxy/kw-search', env.VITE_KW_SEARCH_TARGET),
        '/proxy/kw-openapi': proxyRule('/proxy/kw-openapi', env.VITE_KW_OPENAPI_TARGET),
        '/proxy/kw-nmobi': proxyRule('/proxy/kw-nmobi', env.VITE_KW_NMOBI_TARGET, '', {
          'User-Agent': 'okhttp/3.10.0',
        }),
        '/proxy/kw-img': proxyRule('/proxy/kw-img', env.VITE_KW_IMG_TARGET),
        '/proxy/kw-cdn': proxyRule('/proxy/kw-cdn', env.VITE_KW_CDN_TARGET),
      },
    },
    build: {
      sourcemap: env.VITE_SOURCEMAP === 'true',
    },
  }
})
