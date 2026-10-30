# ===== 生产环境(mode: pro)=====
# 使用方式:npm run build(默认)或 npm run build:pro

VITE_APP_ENV=pro
VITE_APP_TITLE=聆听jun.sun

VITE_BASE=/
# 生产不输出 sourcemap
VITE_SOURCEMAP=false
VITE_DEV_PORT=5173

# false：搜索、歌词、封面、评论、榜单、歌单直连曲库。true：这些也走本站 /api-fmusic-pomelo7-server。
# 播放地址查询和自有接口始终走本站：浏览器直连拿不到完整歌曲，自有接口也没有跨域头。
# 歌曲和 MV 播放直连曲库。保存下载走本站 /kw-audio，才能使用「歌名-歌手-音质」文件名。
VITE_USE_PROXY=true

# *_TARGET 同时用于 vite 开发代理与 Docker nginx 反代(见 .env.local 注释)
VITE_API_TARGET=https://music.4848948.xyz

VITE_KW_SEARCH_TARGET=http://search.kuwo.cn
VITE_KW_OPENAPI_TARGET=https://kuwo.cn
VITE_KW_NMOBI_TARGET=https://nmobi.kuwo.cn
VITE_KW_IMG_TARGET=https://img1.kuwo.cn
VITE_KW_CDN_TARGET=http://kw-er.kuwo.cn
VITE_KW_COMMENT_TARGET=https://ncomment.kuwo.cn
VITE_KW_WAPI_TARGET=https://wapi.kuwo.cn
VITE_KW_NPL_TARGET=https://nplserver.kuwo.cn
