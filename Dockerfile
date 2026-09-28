# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# fmusic-h5 两阶段构建(写法参考 xuandou-server/Dockerfile)
#
#   builder:node + pnpm,按 BUILD_MODE(local | dev | pro)执行 `pnpm run build:<mode>`,
#           对应读取 .env.local / .env.dev / .env.pro(变量会编译进产物,故 env 文件必须进构建上下文)
#   runner :nginx,托管 dist/,并把 /proxy/* 反向代理到酷我 / 自有 API(生产环境替代 vite server.proxy),
#           可选终结 TLS:SSL_ENABLED=true + 挂载 /etc/nginx/ssl/{fullchain,privkey}.pem
#
# 基础镜像固定 minor,可通过 build-arg 覆盖为自有 ACR(国内构建机直连 Docker Hub 常超时):
#   --build-arg NODE_IMAGE=xxx.cr.aliyuncs.com/prod/node:20-alpine3.20
#   --build-arg NGINX_IMAGE=xxx.cr.aliyuncs.com/prod/nginx:1.27-alpine
# ---------------------------------------------------------------------------
ARG NODE_IMAGE=node:20-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine

# ============================== builder ==============================
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PNPM_VERSION=10
RUN set -eux; \
    npm config set registry "${NPM_REGISTRY}"; \
    npm install -g "pnpm@${PNPM_VERSION}"; \
    pnpm config set registry "${NPM_REGISTRY}"; \
    pnpm --version

# 先拷贝清单,利用层缓存;lockfile 有变才重新安装
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 其余源码(含 .env.local / .env.dev / .env.pro,见 .dockerignore)
COPY . .

# local | dev | pro,由 docker-compose.<env>.yml 的 build.args 传入
ARG BUILD_MODE=pro
RUN set -eux; \
    echo "BUILD_MODE=${BUILD_MODE}"; \
    pnpm run "build:${BUILD_MODE}"

# ============================== runner ===============================
FROM ${NGINX_IMAGE} AS runner

# 与 xuandou-server 一致:apk 默认走国内镜像,海外构建可传 --build-arg ALPINE_APK_REPO_MIRROR=
ARG ALPINE_APK_REPO_MIRROR=https://mirrors.aliyun.com
RUN set -eux; \
  if [ -n "${ALPINE_APK_REPO_MIRROR}" ]; then \
    sed -i "s#https://dl-cdn.alpinelinux.org#${ALPINE_APK_REPO_MIRROR}#g" /etc/apk/repositories; \
  fi; \
  apk update --no-cache \
  || ( sed -i 's|https://|http://|g' /etc/apk/repositories && apk update --no-cache ); \
  apk add --no-cache ca-certificates tzdata
ENV TZ=Asia/Shanghai

# 运行时默认值,compose 中按环境覆盖:
#   SERVER_NAME  nginx server_name,"_" 匹配任意 Host
#   SSL_ENABLED  true 时启用 443 + 80→443 跳转,并要求 /etc/nginx/ssl/{fullchain,privkey}.pem 存在
#   HTTPS_REDIRECT_PORT  80→443 跳转时附加的端口,默认空;本地 443 映射到 8443 时设为 ":8443"
#   HSTS_HEADER  Strict-Transport-Security 的值,置空则不输出该头(本地自签环境必须置空)
ENV SERVER_NAME=_ \
    SSL_ENABLED=false \
    HTTPS_REDIRECT_PORT= \
    HSTS_HEADER=max-age=31536000

# 官方镜像自带的 default.conf 也监听 80,必须删掉,否则与模板渲染出的 server 冲突
RUN rm -f /etc/nginx/conf.d/default.conf \
 && mkdir -p /etc/nginx/ssl /etc/nginx/snippets /etc/nginx/templates /var/www/certbot

COPY docker/nginx/conf.d/ /etc/nginx/conf.d/
COPY docker/nginx/snippets/proxy-common.conf /etc/nginx/snippets/proxy-common.conf
COPY docker/nginx/templates-available/ /etc/nginx/templates-available/
# 在官方 20-envsubst-on-templates.sh 之前运行:渲染反代 snippet、按 SSL_ENABLED 选择 server 模板
COPY docker/nginx/10-fmusic-select-templates.sh /docker-entrypoint.d/10-fmusic-select-templates.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/10-fmusic-select-templates.sh \
 && chmod +x /docker-entrypoint.d/10-fmusic-select-templates.sh

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
