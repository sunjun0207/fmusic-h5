# ===== 生产环境(mode: pro)=====
# 使用方式:npm run build(默认)或 npm run build:pro

VITE_APP_ENV=pro
VITE_APP_TITLE=聆听jun.sun

VITE_BASE=/
# 生产不输出 sourcemap
VITE_SOURCEMAP=false
VITE_DEV_PORT=5173

# *_TARGET 同时用于 vite 开发代理与 Docker nginx 反代(见 .env.local 注释)
VITE_API_TARGET=https://music.4848948.xyz

VITE_KW_SEARCH_TARGET=http://search.kuwo.cn
VITE_KW_OPENAPI_TARGET=https://kuwo.cn
VITE_KW_NMOBI_TARGET=https://nmobi.kuwo.cn
VITE_KW_IMG_TARGET=https://img1.kuwo.cn
VITE_KW_CDN_TARGET=http://kw-er.kuwo.cn
