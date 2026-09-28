# 聆听xuejun.yan（fmusic-h5）

Vite + React + TypeScript 网页听歌：搜歌 / 播放 / 歌词 / 下载记录，酷我直连 + 自有 API。

## 快速开始

需要 **Node.js ≥ 18**（推荐 20 LTS）。

```bash
npm install
npm run dev
```

浏览器打开终端提示的地址（默认 `http://localhost:5173`）。

生产构建：

```bash
npm run build      # 等价于 npm run build:pro
npm run preview
```

## 多环境配置

项目通过 Vite 的 `--mode` 区分三套环境，配置文件位于项目根目录：

| 文件 | mode | 用途 | 对应命令 |
|------|------|------|----------|
| `.env.local` | 默认（不传 `--mode`） | 本地开发 | `npm run dev` / `npm run build:local` |
| `.env.dev` | `dev` | 测试 / 开发服务器 | `npm run dev:dev` / `npm run build:dev` |
| `.env.pro` | `pro` | 生产 | `npm run dev:pro` / `npm run build` (`build:pro`) |

### 可用脚本

```bash
# 本地联调（按 mode 加载对应 .env 文件并启动开发服务器）
npm run dev          # 默认 mode,仅读取 .env.local
npm run dev:dev      # dev
npm run dev:pro      # pro

# 打包（先 tsc 类型检查，再 vite build）
npm run build:local  # 产物 dist/，使用 .env.local
npm run build:dev    # 产物 dist/，使用 .env.dev
npm run build:pro    # 产物 dist/，使用 .env.pro
npm run build        # 同 build:pro

# 预览 dist/（使用 .env.pro 的代理配置）
npm run preview
```

> 无论哪个 mode，`vite build` 都会以 `NODE_ENV=production` 进行压缩优化；`build:dev` 与 `build:pro` 的区别仅在于读取的环境变量不同。

### 环境变量说明

所有变量均以 `VITE_` 开头，客户端代码可通过 `import.meta.env.VITE_XXX` 读取（类型声明见 `src/vite-env.d.ts`）。

| 变量 | 说明 | 使用位置 |
|------|------|----------|
| `VITE_APP_ENV` | 环境标识：`local` / `dev` / `pro` | 业务代码按需读取 |
| `VITE_APP_TITLE` | 页面标题 | `index.html` 中的 `%VITE_APP_TITLE%` |
| `VITE_BASE` | 部署基础路径，如 `/` 或 `/fmusic/` | `vite.config.ts` → `base` |
| `VITE_SOURCEMAP` | 是否生成 sourcemap（`true` / `false`） | `vite.config.ts` → `build.sourcemap` |
| `VITE_DEV_PORT` | 开发服务器端口 | `vite.config.ts` → `server.port` |
| `VITE_API_TARGET` | 自有 API 后端源，`/proxy/api/*` 的代理目标 | `vite.config.ts` → `server.proxy` |
| `VITE_KW_SEARCH_TARGET` | 酷我搜索服务 | 同上 |
| `VITE_KW_OPENAPI_TARGET` | 酷我 openapi（联想词 / 歌词） | 同上 |
| `VITE_KW_NMOBI_TARGET` | 酷我播放地址服务 | 同上 |
| `VITE_KW_IMG_TARGET` | 酷我封面图 | 同上 |
| `VITE_KW_CDN_TARGET` | 酷我音频 CDN | 同上 |

### 加载规则与注意事项

- Vite 的加载顺序为：`.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local`，后者覆盖前者。
  因此 **`.env.local` 会在所有 mode 下被加载作为基础值**，`.env.dev` / `.env.pro` 只需覆盖有差异的变量；为避免遗漏，目前三个文件保持相同的变量集合。
- **Vite 禁止使用 `local` 作为 mode 名称**（`vite --mode local` 会直接报错 `"local" cannot be used as a mode name`），所以本地环境不传 `--mode`，使用默认 mode 时恰好只加载 `.env.local`。
- `.env.local`、`.env.dev`、`.env.pro` 不含敏感信息，**需要提交到仓库**；如需个人临时覆盖，新建 `.env.dev.local` / `.env.pro.local` 等文件（已在 `.gitignore` 中忽略）。
- 修改 `.env*` 文件后需重启 `npm run dev` 才会生效。
- `VITE_*_TARGET` 系列在两处生效：Vite 开发服务器 / preview 的代理，以及 Docker 镜像内 Nginx 的反代（见下方「Docker 部署」）。前端请求始终发到同源的 `/proxy/*` 路径，不受影响。

## Docker 部署

写法参考 `xuandou-server`：两阶段 Dockerfile + 每个环境一份 `docker-compose.<env>.yml`，运行时配置走 `env_file`，证书从 `docker/<env>/ssl/` 挂载。

### 镜像结构

```
builder  node:20-alpine + pnpm  →  pnpm run build:<BUILD_MODE>   (读取 .env.local / .env.dev / .env.pro)
runner   nginx:1.27-alpine      →  托管 dist/ + /proxy/* 反代 + 可选 TLS 终结
```

Nginx 反代规则由 `docker/nginx/templates-available/app-locations.conf.template` 在容器启动时用 `envsubst` 渲染，目标地址来自 compose `env_file` 注入的 `VITE_*_TARGET`，与 `vite.config.ts` 完全一致，开发 / 生产只需维护一份地址。

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 两阶段构建；`BUILD_MODE`、`NODE_IMAGE`、`NGINX_IMAGE`、`NPM_REGISTRY`、`ALPINE_APK_REPO_MIRROR` 可通过 build-arg 覆盖 |
| `.dockerignore` | 排除 `node_modules`、`dist`、证书、`.env.*.local`；**保留 `.env.local/.env.dev/.env.pro`**（构建时需要） |
| `docker-compose.local.yml` | 本地联调：HTTP，默认 `8080` |
| `docker-compose.local-https.yml` | 本地联调：HTTPS（自签证书），默认 `8081` → `8443`，内置 `gen-cert` 生成证书 |
| `docker-compose.dev.yml` | 测试服务器：HTTPS，证书 `docker/dev/ssl/` |
| `docker-compose.pro.yml` | 生产：HTTPS，证书 `docker/pro/ssl/` |
| `docker/nginx/conf.d/gzip.conf` | gzip、`server_tokens off` 等 http 级配置 |
| `docker/nginx/snippets/proxy-common.conf` | 每个 `/proxy/*` 共用的反代头、SNI、超时 |
| `docker/nginx/templates-available/*.template` | `http`（纯 HTTP）、`http-redirect`（80→443 + ACME）、`https`（443）三个 server 模板 |
| `docker/nginx/10-fmusic-select-templates.sh` | 入口脚本：校验 `VITE_*_TARGET`、渲染反代 snippet、按 `SSL_ENABLED` 选择模板 |

### 常用命令

```bash
# 本地验证生产形态（HTTP，http://localhost:8080）
pnpm run docker:local:build
pnpm run docker:local:up
pnpm run docker:local:logs
pnpm run docker:local:down

# 本地验证 HTTPS 形态（自签证书，https://localhost:8443；http://localhost:8081 会跳转）
pnpm run docker:local:https:cert    # 只需一次，生成 docker/local/ssl/{fullchain,privkey}.pem
pnpm run docker:local:https:build
pnpm run docker:local:https:up
pnpm run docker:local:https:down

# 测试服务器 / 生产（HTTPS）
pnpm run docker:dev:build   && pnpm run docker:dev:up
pnpm run docker:pro:build   && pnpm run docker:pro:up
```

各 compose 文件使用独立的 project name（`fmusic-h5-local` / `-local-https` / `-dev` / `-pro`），互相 `up` / `down` 不会干扰；`local` 与 `local-https` 端口不同可同时运行。dev 与 pro 默认都占 80/443，同一台机器只跑一套，或用端口变量错开。

### 运行时变量

通过 shell 环境或项目根目录 `.env`（已 `.gitignore`，仅供 compose 插值）传入：

| 变量 | 默认 | 说明 |
|------|------|------|
| `SERVER_NAME` | `_` | Nginx `server_name`，生产填域名，如 `music.example.com` |
| `HTTP_PORT` | local `8080`，dev/pro `80` | 宿主机映射到容器 80 |
| `HTTPS_PORT` | `443` | 宿主机映射到容器 443（仅 dev/pro） |
| `SSL_ENABLED` | local `false`，local-https/dev/pro `true` | 写在 compose 内；为 `true` 时必须存在证书 |
| `HTTPS_REDIRECT_PORT` | 空（即 443） | 80→443 跳转附加的端口；容器 443 映射到非 443 宿主端口时设为 `:8443` 这样的值，local-https 已自动跟随 `HTTPS_PORT` |
| `HSTS_HEADER` | `max-age=31536000` | `Strict-Transport-Security` 的值，置空则不输出。local-https 已置空：自签证书一旦被信任，Chrome 会对 `localhost` **所有端口**强制 https，vite `:5173`、docker `:8080` 都会打不开 |

```bash
SERVER_NAME=music.example.com pnpm run docker:pro:up
```

### SSL 证书

1. 将证书放到对应目录（已 `.gitignore`，仅 `.gitkeep` 入库）：

   ```
   docker/pro/ssl/fullchain.pem   # 服务器证书 + 中间证书（完整链）
   docker/pro/ssl/privkey.pem     # 私钥
   ```

   文件名与 certbot 默认一致。若拿到的是 `cert.pem` + `chain.pem`：`cat cert.pem chain.pem > fullchain.pem`；阿里云 / 腾讯云下载的 Nginx 版证书通常是 `xxx.pem` + `xxx.key`，直接改名即可。

2. 确认 DNS A 记录指向服务器，安全组放行 TCP 80/443。

3. `SERVER_NAME=<域名> pnpm run docker:pro:up`。容器启动时会校验两个 PEM 是否存在，缺失则报错退出（`docker logs` 可见），不会带病运行。

4. 证书续期：替换 PEM 后 `docker compose -f docker-compose.pro.yml restart`。用 certbot webroot 自动续期时，把 compose 中 `certbot-www` 卷注释打开，certbot 使用 `-w ./docker/pro/certbot-www`，80 端口的 `/.well-known/acme-challenge/` 已预留。

没有证书时可先把 compose 中 `SSL_ENABLED` 改为 `'false'` 并注释 443 端口与 ssl 卷，走纯 HTTP（或前置已有网关终结 TLS）。

#### 本地自签证书

`pnpm run docker:local:https:cert` 通过 `alpine/openssl` 容器生成 `CN=localhost`、SAN 含 `localhost` / `127.0.0.1` 的一年期自签证书到 `docker/local/ssl/`（已 `.gitignore`）。

地址栏请输入完整的 **`https://localhost:8443`**。只输 `localhost:8443` 时 Chrome 会补成 `http://`，nginx 收到明文请求后会 301 跳到 https（已处理 nginx 497），但显式写 `https://` 最直接。

浏览器首次访问会提示证书不受信任，点「高级 → 继续访问」即可；想去掉提示可把证书加入本机受信任根：

```powershell
# Windows（当前用户）
certutil -addstore -user Root docker\local\ssl\fullchain.pem
```

```bash
# macOS
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain docker/local/ssl/fullchain.pem
```

自签证书只用于本地，dev / pro 必须使用正规 CA 签发的证书。

### 基础镜像 / 国内镜像源

默认 `node:20-alpine`、`nginx:1.27-alpine`，npm 走 npmmirror，apk 走 aliyun。构建机拉 Docker Hub 慢时可指向自有 ACR：

```bash
docker compose -f docker-compose.pro.yml build \
  --build-arg NODE_IMAGE=xxx.cr.aliyuncs.com/prod/node:20-alpine3.20 \
  --build-arg NGINX_IMAGE=xxx.cr.aliyuncs.com/prod/nginx:1.27-alpine
```

### 注意事项

- 修改 `src/`、`.env.*` 后需重新 `docker:<env>:build`，静态产物在构建期生成。
- `docker/nginx/*.sh`、`*.template`、`*.conf` 必须为 LF 换行，已通过 `.gitattributes` 强制，Dockerfile 也会再做一次 `\r` 清理。
- 本机 Docker Desktop 若配置了系统代理（Settings → Resources → Proxies），容器出网会经过该代理；部分代理规则会拒绝酷我域名（表现为 `/proxy/kw-*` 502、日志 `peer closed connection in SSL handshake`），把 `*.kuwo.cn` 加入代理绕过列表或关闭代理即可，服务器部署不受影响。

## 架构说明

| 模块 | 说明 |
|------|------|
| `src/lib/kuwoDes.ts` | 浏览器版 KuwoDES（密钥 `ylzsxkwm`），生成 nmobi `q=` |
| `src/lib/api.ts` | 搜索 / 联想 / 歌词 / 播放元数据 / 版本公告 / 行为上报 |
| `src/lib/storage.ts` | localStorage：uid、搜索历史、下载、设置、最近播放 |
| `src/pages/*` | 首页、搜索、下载、设置、歌曲详情 |
| `vite.config.ts` | 按 mode 读取 `.env.*`，配置开发代理（绕过浏览器跨域）、`base`、sourcemap |
| `.env.local` / `.env.dev` / `.env.pro` | 本地 / 测试 / 生产 三套环境变量，见「多环境配置」 |
| `Dockerfile` / `docker-compose.*.yml` / `docker/` | 容器化构建与部署（Nginx 托管 + 反代 + TLS），见「Docker 部署」 |

### 代理路由

开发时由 Vite 代理，Docker 部署时由镜像内 Nginx 代理，规则一致。目标地址来自对应 `.env.*` 文件，默认值如下：

- `/proxy/api/*` → `${VITE_API_TARGET}/api/*`，默认 `https://music.4848948.xyz/api/*`（更新、公告、access/search/download 上报）
- `/proxy/kw-search/*` → `${VITE_KW_SEARCH_TARGET}/*`，默认 `http://search.kuwo.cn/*`
- `/proxy/kw-openapi/*` → `${VITE_KW_OPENAPI_TARGET}/*`，默认 `https://kuwo.cn/*`
- `/proxy/kw-nmobi/*` → `${VITE_KW_NMOBI_TARGET}/*`，默认 `https://nmobi.kuwo.cn/*`（播放地址，需带 `User-Agent: okhttp/3.10.0`）
- `/proxy/kw-img/*` → `${VITE_KW_IMG_TARGET}/*`，默认 `https://img1.kuwo.cn/*`
- `/proxy/kw-cdn/*` → `${VITE_KW_CDN_TARGET}/*`，默认 `http://kw-er.kuwo.cn/*`（音频流）

### 播放地址

明文模板（jiakong）：

```
user=0&corp=kuwo&source=kwplayer_ar_5.1.0.0_B_jiakong_vh.apk&p2p=1&type=convert_url2&sig=0&format={format}&rid={rid}&br={br}
```

加密后请求：`/proxy/kw-nmobi/mobi.s?f=kuwo&q=...`，解析返回的 `url=` 行；若为 `http://kw-er.kuwo.cn/...` 会改写到 `/proxy/kw-cdn/...` 以便本地代理播放。

### H5 与 App 差异

- 下载无法直接写系统文件，下载页记录 URL，可「打开」或标记已下载。
- 版本号展示为 `1.0.10 H5`，联系邮箱 `111977746@qq.com`。

## 技术栈

React 19 · Vite 6 · TypeScript · 纯 CSS（Syne + Noto Sans SC）
