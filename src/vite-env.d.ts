/// <reference types="vite/client" />

declare module '*.css' {
  const css: string
  export default css
}

interface ImportMetaEnv {
  /** 环境标识:local | dev | pro */
  readonly VITE_APP_ENV: 'local' | 'dev' | 'pro'
  readonly VITE_APP_TITLE: string
  readonly VITE_BASE: string
  readonly VITE_SOURCEMAP: string
  readonly VITE_DEV_PORT: string
  readonly VITE_API_TARGET: string
  readonly VITE_KW_SEARCH_TARGET: string
  readonly VITE_KW_OPENAPI_TARGET: string
  readonly VITE_KW_NMOBI_TARGET: string
  readonly VITE_KW_IMG_TARGET: string
  readonly VITE_KW_CDN_TARGET: string
}
