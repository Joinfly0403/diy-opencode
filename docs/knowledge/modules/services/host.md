---
id: services/host
title: 独立部署服务（公开文件 files / 更新清单 update）
level: L2
layer: services
status: stable
paths:
  - services/files/src
  - services/files/wrangler.jsonc
  - services/files/package.json
  - services/files/README.md
  - services/update/src
  - services/update/migrations
  - services/update/wrangler.jsonc
  - services/update/package.json
  - services/update/README.md
  - .github/workflows/deploy-files.yml
  - .github/workflows/deploy-update.yml
  - sst.config.ts
symbols:
  - validGitHubClaims
  - allowedChannels
  - resolveChannel
entry_http:
  - GET /files/<key>
  - GET /api/latest
  - GET /api/<channel>/<name>/<distribution>
  - GET /api/<channel>/desktop/<distribution>/latest.yml
  - POST /api/publish
  - GET /api/<channel>/<name>/<distribution>/<filename>
  - GET /admin
  - POST /admin/activate
  - POST /admin/minimum
  - POST /admin/rollout
tables:
  - artifact
  - channel_rollout
depends_on:
  - contracts/config-flag
related:
  - infra/misc-packages
  - desktop/main
  - services/docs-site
  - runtime/process-lifecycle
keywords:
  - Cloudflare Worker
  - R2
  - D1
  - wrangler
  - 发布服务
  - 更新清单
  - 灰度
  - 最低版本
  - OIDC
  - Range
source_hash: 491de10f1913948fa728dccf1fbd014da8b3002d
---

## 职责

两个**独立部署**的边缘服务，都不在 `sst.config.ts` 的部署图里：

| 服务 | 包 | 职责 |
| --- | --- | --- |
| 公开文件服务 | `services/files`（`@opencode/files`） | `/files/*` 反代 R2 bucket：只读 GET/HEAD/OPTIONS，ETag/Last-Modified 条件请求、单区间 Range、Workers Cache API、CORS |
| 更新清单服务 | `services/update`（`@opencode/update`） | D1 里的产物清单（channel × name × distribution × version）：灰度比例、最低版本、GitHub OIDC 发布、Electron 更新 manifest、请求事件投递 |

`services/files` 同时承担发布产物的 CDN：`https://opencode.ai/files/bin/<version>/<file>`（CLI/桌面安装包），`services/update` 的 `metadata.files`/`manifests` 直接指向这些 URL，二者在发布流水线里成对更新。

## 边界

- **没有核心仓运行时依赖**：两包只依赖 `wrangler`、`@cloudflare/workers-types`，update 另加 `jose`/`semver`/`yaml`；不 import `packages/*`。
- **files 不写**：只读；上传走 R2 控制台/S3 兼容 API（bucket-scoped 凭据）或 release 工作流。没有列举、没有目录索引。
- **update 不做客户端逻辑**：CLI 侧与桌面侧的自动更新分别在 `packages/cli/src/services/` 和 `packages/gui-plugins/src/updater`；这里只裁决"该给客户端哪个产物"以及提供静态 manifest。
- **部署不要找 `infra/`**：根 `sst.config.ts` 只 `import` `./infra/{stage,app,stats,console,share,webapp}`，与这两个 Worker 无关；它们的部署单元是各自目录的 `wrangler.jsonc`。
- `services/site`（官网/文档站）是另一张卡（`services/docs-site`）；本卡不覆盖。

## 入口与调用链

- **files**（`src/index.ts` 的默认 `fetch`）：`/files/` 前缀校验 → `OPTIONS` 204（`Access-Control-Max-Age: 86400`）→ 非 GET/HEAD 405 → URL 解码得到 R2 key（解码失败 400、空 key 404）→ 条件绕过判断（`no-store`/`no-cache`/`max-age=0` 或 `If-Match`/`If-Unmodified-Since`/`If-Range`）→ `caches.default.match` → `env.FILES.head(key)` → 条件请求（If-Match → 412、If-None-Match/If-Modified-Since → 304）→ Range 解析 → `env.FILES.get(key, { range, onlyIf: { etagMatches } })` → 200/206 响应，完整响应（≤512MiB）`ctx.waitUntil(caches.default.put(...))`。
- **update**（`src/index.ts` 的默认 `fetch`）：挂载前缀归一（`update.opencode.ai` vs `opencode.ai/update`，后者剥掉 `/update`）→ `ctx.waitUntil(env.EVENTS.send([...]))` 记一条请求事件 → 路由分发：`/`、`/admin`、`/admin/{activate,minimum,rollout}`、`/api/publish`（POST）→ 其余 GET 走 `/api/...`（1–4 段）→ `lookup` 解析 caller 版本与灰度 → `channel`/`artifactName`/`artifactDistribution` 三种查询形状。
- **desktop manifest**：`/api/<channel>/desktop/<distribution>/latest.yml|latest-mac.yml|latest-linux.yml|latest-linux-arm64.yml` 从 `metadata.manifests.desktop*.yml` 取内容并用 `yaml.stringify` 补上 `version`；其余 `filename` 走 302 跳到 `metadata.files[filename].url`。
- **部署链**：`deploy-files.yml`（push `dev`/`production` → `bun run deploy --env dev|production`）与 `deploy-update.yml`（push `production` → `bun run deploy`，需先 `db:migrate`）。两者都在 `working-directory` 里先跑 `typecheck:tsc`。

## 数据与状态

- **update D1**（`DB`，库 `opencode-update`，`migrations/` 0001–0005）：
  - `artifact(channel, name, distribution, version, metadata, active, minimum, time_created, time_updated)`，PK 四元组，`WITHOUT ROWID`；
  - 部分唯一索引 `artifact_active`（每 (channel,name,distribution) 只有一个 active）、`artifact_minimum`（只有一个 minimum）；
  - `channel_rollout(channel PRIMARY KEY, duration_hours REAL ≥ 0)`；
  - 索引 `artifact_rollout(channel, name, distribution, time_created DESC, version DESC)` 供灰度回溯。
- **files R2**：`opencode-dev-files` / `opencode-production-files`（`FILES` 绑定）；key 是 URL 去掉 `/files/` 后的解码路径；对象 HTTP metadata（`Content-Type`/`Content-Disposition`/`Cache-Control`）原样回传给客户端，缺失时默认 `application/octet-stream` / `public, max-age=3600`。
- **update 事件**：Pipelines 绑定 `EVENTS`（共享 lake stream，id 写在 `wrangler.jsonc`），每条请求一条 `{ source: "update", type: "request", timestamp, payload: { method, path, useragent, ip, cf_country, cf_colo } }`；路径已去掉 `/update` 前缀以便两种挂载共用分析路径；**不含** query/body/cookie/authorization，也不含状态码与耗时。
- **路由**：files `dev.opencode.ai/files/*` 与 `opencode.ai/files/*`；update 用 `custom_domain update.opencode.ai` 加 `opencode.ai/update`(+ `/*`) 三条 route；两者都关闭 `workers_dev` 与 `preview_urls`。

## 关键不变式

- **files 方法面**：`/files/` 之外 404；只允许 GET/HEAD/OPTIONS（否则 405 + `Allow`）；Range 只认单区间 `bytes=a-b`，多区间/非法格式回落成完整 200；越界返回 416 + `Content-Range: bytes */<size>`。
- **files 一致性**：`head` 与 `get` 之间对象被替换/删除时用 `onlyIf.etagMatches` 兜底，不匹配返回 503 + `Retry-After: 1`（"元数据与字节不许混搭"）。
- **files 缓存**：只缓存完整响应（无 Range、非 no-store、≤512MiB、非 private/no-store/no-cache）；缓存 key 保留 query string 但不影响 R2 key；换 key 而不 purge 不会失效（用版本化 key）。
- **update 发布鉴权**：只接受 GitHub Actions OIDC（`jose` 验 JWKS，audience `https://update.opencode.ai`）；`validGitHubClaims` 硬校验 `repository=anomalyco/opencode`、`repository_id=975734319`、`repository_owner_id=66570915`、`workflow_ref=.github/workflows/release.yml@<ref>`、`environment=release`；`allowedChannels`：`refs/heads/dev` 只能发 `dev`（`workflow_dispatch` 例外可发 `latest`），`refs/heads/beta` 只能发 `beta`。
- **update 唯一性**：发布时先 `deactivateStatement` 把同 (channel,name,distribution) 的旧 active 置 0 再 upsert；`minimum` 只允许 `latest` 且版本必须能被 semver 解析；`next` 不是可发布 channel，只在读取时作为 `beta` 的别名（`resolveChannel`）。
- **update 灰度**：资格由 `time_created` 与原样 SHA-256(`<channel>:<CF-Connecting-IP>`) 决定 `cutoff`；缺 IP 视为要等满时长；未到期的 active 回落到"该名字/分发下最新的合格历史产物"；最小版本优先级高于灰度（低于 floor 的客户端拿到 minimum）。
- **update 响应不缓存**：所有 JSON/YAML 与 404 都是 `Cache-Control: no-store`（内容依赖 UA/IP）。
- **admin 保护**：两个挂载（`update.opencode.ai/admin*`、`opencode.ai/update/admin*`）必须由同一个 Cloudflare Access 应用保护；表单 POST 校验 `Origin`（不一致 403），`/api/publish` 只认 Bearer OIDC。

## 扩展点

- **新 channel / 新 distribution**：无需改代码，`identifier` 正则（`^[a-zA-Z0-9._-]{1,64}$`）即校验；只需要发布端按约定写 `channel`/`distribution`。
- **新文件类型/新目录**：只改上传端的 HTTP metadata（`Content-Type`/`Content-Disposition`/`Cache-Control`），files Worker 不需要动。
- **新 update 端点**：先加迁移（表/索引）→ `src/index.ts` 的路由分支 → 更新 README 的 `curl` 示例；灰度与最小版本的选择逻辑集中在 `selectArtifacts`/`candidates`，尽量复用。
- **改灰度模型**：`channel_rollout.duration_hours` + `lookup` 里的哈希/cutoff 计算；README 明确"时长改动对已有 release 立即生效"。

## 常见改法与坑

- D1 过载会返回 1101 异常页；`lookup` 已被 `.catch` 包成 503 + `Retry-After: 60`，但 `/admin` 与 `/api/publish` 不在保护范围内。
- 迁移顺序有语义：`0004_channel_rollout.sql` 未应用就部署会读不到 `channel_rollout`；`0003` 之前 `minimum` 列不存在。
- `wrangler.jsonc` 里改 route 要同时保留 `custom_domain` 与 `opencode.ai/update` 两条，否则老客户端（`update.opencode.ai`）失联。
- files 的 cache 不参与 Tiered Cache；删/换对象不会 purge 已缓存的响应——依赖 TTL 或版本化 key，或从 Cloudflare 侧 purge。
- `artifact.metadata` 里 `files`/`manifests` 的结构必须与 electron-builder 的 publish 目标一致（桌面端 feed 是 `https://opencode.ai/update/api/latest/desktop/opencode/`，见 `packages/desktop/electron-builder.config.ts`）。
- update 的请求日志是"尽力而为"：`waitUntil` 投递失败只打日志，不重试、不影响响应，不能当审计日志用。
- 已存在的 `infra/misc-packages` 卡把 update 描述为 `artifacts` 表；实际表名是单数 `artifact`（以 `migrations/0001_artifact.sql` 为准）。
- 本地调试用 `wrangler dev --env dev`（files）/ `wrangler dev`（update）；`workers_dev` 关闭，别指望 workers.dev 预览地址。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `services/files/src/index.ts` | 文件 Worker：CORS、条件请求、Range、缓存 |
| `services/files/wrangler.jsonc` | `FILES` R2 绑定、dev/production 环境与路由 |
| `services/files/README.md` | 上传约定、缓存语义、发布产物路径 |
| `services/update/src/index.ts` | 更新 Worker：路由、lookup/灰度/最小版本、发布鉴权、admin 页面 |
| `services/update/migrations/*.sql` | `artifact`/`channel_rollout` 表与索引 |
| `services/update/wrangler.jsonc` | `DB` D1、`EVENTS` Pipelines、三条 route |
| `services/update/README.md` | 端点、灰度/最小版本语义、Access 与发布约束 |
| `services/update/test/index.test.ts` | Worker 行为测试 |
| `.github/workflows/deploy-files.yml`、`deploy-update.yml` | 部署流水线（typecheck + deploy） |
| `sst.config.ts` | 反证：SST 部署图不含这两个服务 |
