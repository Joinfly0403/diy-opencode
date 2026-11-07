---
id: server/http-handlers
title: HTTP handler 实现层
level: L1
layer: server
status: stable
paths:
  - packages/server/src/handlers
  - packages/server/src/handlers.ts
  - packages/server/src/api.ts
  - packages/server/src/location.ts
symbols:
  - handlers
  - FileSystemHandler
  - SessionHandler
  - EventHandler
  - ConfigHandler
  - PtyHandler
  - McpHandler
  - makeMediaGet
  - makeArtifact
  - makeSchedule
  - makeJob
  - runPtySocket
  - holdLocation
  - missingSession
  - failedSnapshot
  - response
  - locationErrors
  - sessionInfo
  - LocationMiddleware
entry_http:
  - GET /api/fs/read/*
  - POST /api/experimental/fs/write
  - GET /api/experimental/media/:hash
  - GET /api/pty/:ptyID/connect
  - GET /api/experimental/session/:sessionID/terminal/read
  - GET /api/event
depends_on:
  - contracts/httpapi-protocol
  - core/location-instance
  - core/permission-policy
related:
  - server/auth-pairing
  - server/event-feed
  - core/pty-shell-worktree
  - core/session-execution
  - core/mcp-integration
keywords:
  - handler
  - HttpApiBuilder
  - 端点
  - 请求校验
  - 错误映射
  - 文件下载
  - Range
  - websocket
  - ticket
  - 文件上传
source_hash: 5aa1be63ab879ef9281f112c79f19f7fa7108849
---

## 职责

把 `packages/protocol` 声明的每个端点绑定到具体实现：解析已校验的 `ctx.params/query/payload`，调用 Core 服务，把 Core 错误翻译成 protocol 错误，返回 JSON 或原始 HTTP 响应。

- `handlers/<group>.ts`：一个文件一个 `HttpApiBuilder.group(Api, "server.<group>")`，用 `.handle` / `.handleRaw` 逐端点绑定。
- `handlers.ts`：`handlers = Layer.mergeAll(...)` 汇总 32 个组实现（`EventHandler` 额外注入 `EventFeed.layer`）。
- `api.ts`：用 `makeDefaultApi` 注入 location / form-location / session-location 三个中间件键。
- `location.ts`：`LocationMiddleware`、`response()`、`locationErrors`、`sessionInfo`、`requestRef` —— 所有 handler 共用的 Location 作用域适配。
- 辅助模块：`media.ts`/`artifact.ts`/`job.ts`/`schedule.ts` 提供 `makeXxx` 实现片段，`session-error.ts` 提供错误翻译，`pty-socket.ts` 提供 WebSocket 管道。

## 边界

- **handler 是薄适配层**：不做业务决策，不直接读写数据库；会话/工具/权限/PTY 的实现分别在 core 的对应卡。
- **不定义契约**：路由、query/payload schema、错误类型、OpenAPI identifier 都在 `packages/protocol`（见 `contracts/httpapi-protocol`）。改路径要改协议并重新生成 client。
- **不做认证**：鉴权在 `server/auth-pairing` 的 authorization 中间件，handler 只处理 ticket/键值这类端点内的二次校验。
- 不自行决定 HTTP 状态码：错误到状态码由 `protocol/errors.ts` 的 `httpApiStatus` 决定。

## 入口与调用链

```
HTTP 请求
  → process.ts dispatch（鉴权、ready 判定、/api/info 特例）
  → HttpMiddleware: RequestSite → compression → cors → errorResponseLogger
  → Authorization 中间件 → SchemaErrorMiddleware → Location/Form/Session 中间件
  → HttpApi 路由 → effect/http-api 解码并校验 params/query/payload
  → handler（.handle 或 .handleRaw）
      → Core 服务
      → 错误：Effect.mapError / catchTag → protocol 错误（httpApiStatus → 状态码）
      → 成功：普通对象（自动 {location, data}）或 HttpServerResponse
```

组与文件的对应关系**基本一一对应**（32 处 `HttpApiBuilder.group`），唯一例外是 `server.experimental`：组在 `handlers/persistent-pty.ts` 里声明一次，端点实现分散在 `persistent-pty.ts` + `media.ts` + `artifact.ts` + `schedule.ts` + `job.ts`。

## 数据与状态

- handler 自身基本无状态：每个组是 `Effect.gen` 里 `yield*` 一次 Core 服务，然后 `return handlers...`。
- 跨请求状态只来自 Core 服务（Location 服务表、Session、Database、PTY registry、Ticket 服务、Job queue）。
- `response()` 给每个成功响应附上 `location: { directory, project }`；客户端据此判断结果属于哪个 Location。
- WebSocket 连接（PTY / 持久终端 / MCP client）是长生命周期：`holdLocation` 借住 Location（阻止 idle sweep 驱逐），连接断开后释放；服务端主动关闭用 `Socket.CloseEvent(1012)` 让客户端重连到新 Location。
- ticket（`PtyTicket`）是一次性凭据，由 `pty.connectToken` / `mcp.clientToken` 端点签发，`connect` 时消费；重启后内存 ticket 全失效。

## 关键不变式

- **一个组只能绑定一次**：`HttpApiBuilder.group(Api, "<group>")` 同一组出现两次会让 Layer 冲突；新增端点要加到既有组文件里，而不是新建同组文件。
- **`.handleRaw` 用于非 JSON**：流（SSE、文件）、二进制、`HttpServerResponse` 的直接返回、WebSocket upgrade。用它就自己负责状态码与响应头。
- **下载一律不可内联执行**：`ContentHeaders.download` 会把 html/js/xml（含 SVG）改成 `text/plain`，并统一加 `content-security-policy: ... sandbox`、`nosniff`、RFC 6266 的 `content-disposition`（见 `server/auth-pairing`）。
- **`fs.read` 的路径来自 URL，不来自 query**：`url.pathname.slice(13)` 去掉 `/api/fs/read/` 前缀再 `decodeURIComponent`，失败即 404；不要在中间再做一次 URL 解码。
- **文件读取要支持条件请求**：`fs.read` 生成弱 ETag（size+mtime）与 Last-Modified，支持 304、单区间 `Range` → 206、不可满足 → 416，并强制 `cache-control: no-cache, no-transform`（agent 改完文件客户端必须重新验证，压缩不能改 Content-Length）。
- **Location 只能由中间件提供**：`requestRef` 读 `location[directory]` query，其次 `x-opencode-directory` header，缺省 `process.cwd()`；handler 里不要自己造 Location。
- **`sessionID === "global"` 是临时哨兵**（`api.ts` 注释）：只给 MCP elicitation 表单用，且必须在拿到 session 行之前绕开；**不要**在普通 Session API 上复用它。
- **ticket 端点必须强制预检**：`pty.connectToken` 与 `mcp.clientToken` 要求自定义头 `PTY_CONNECT_TOKEN_HEADER`，注释说明目的就是让跨源页面无法在不过 CORS 的情况下铸 ticket；再叠加 `isAllowedRequestOrigin` 校验。
- **错误翻译集中且带 ref**：Session 缺失用 `missingSession`；无法由客户端修复的宿主错误（消息解码、快照）用 `failedMessageDecode`/`failedSnapshot` 生成 `err_xxxxxxxx` ref 并发 `UnknownError`，只把 ref 交给客户端，原因进日志。

## 扩展点

新增一个端点：

1. `packages/protocol/src/groups/<group>.ts` —— 声明 endpoint、schema、错误、OpenAPI identifier。
2. `packages/server/src/handlers/<group>.ts` —— 在既有组的 `handlers.handle("<name>", ...)` 里实现（或 `handleRaw`）。
3. 需要新的 Core 错误映射时，加在 `handlers/session-error.ts` 或该文件的 `mapError` 里，保持 `httpApiStatus` 语义。
4. 新增组：`handlers.ts` 的 `Layer.mergeAll` 加一行；`packages/client` 里跑 `bun run generate` 重新生成 SDK。
5. 二进制/流端点：复用 `ContentHeaders.download`、`serveFile` 的 ETag/Range 逻辑，或 `runPtySocket` 的单写队列。

## 常见改法与坑

- 在 handler 里 `new` protocol 错误却不填必填字段（如 `path`/`sessionID`）会导致响应编码失败 → `schemaErrorLayer` 兜成 500 并只给一个 ref，排查时先看服务端日志里的 `endpoint`/`route` 注解。
- `schemaErrorLayer` 对请求方向的校验失败返回 400 `InvalidRequestError`（reason 截到 1024 字符）；对**响应**编码失败直接返回 500 而不是声明错误，所以每个端点的错误契约不受影响。
- 改 `fs.read` 或 `fs.watch` 的路径处理是安全边界：注释写明 `fs.watch` 复用与 read 相同的"必须存在于 Location 内"约束，别只做存在性检查。
- `media.get` 只服务仍被消息/inbox 引用的 blob（`SessionBlob.read`），缓存是 immutable + ETag=hash；不要把它退化成通用静态文件服务。
- PTY/MCP 的 WebSocket 分支依赖 `runPtySocket` 的**单写者**队列保证 replay、实时输出、close 帧的顺序；直接 `socket.write` 会乱序。
- 429/409 之类的语义错误用 `ConflictError`/`SessionBusyError`/`ServiceUnavailableError`，不要塞进 `UnknownError`，客户端按 tag 分支处理。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/server/src/handlers.ts` | 32 个组实现的 `Layer.mergeAll` 汇总 |
| `packages/server/src/api.ts` | `makeDefaultApi` 注入 location/form/session 中间件 |
| `packages/server/src/location.ts` | `LocationMiddleware`、`response`、`locationErrors`、`requestRef` |
| `packages/server/src/handlers/session.ts` | 最大的一组：会话、消息、日志流、diff、指令条目 |
| `packages/server/src/handlers/fs.ts` | `fs.read` 的 ETag/Range/304/416 与 `fs.list/find/write/watch` |
| `packages/server/src/handlers/media.ts` | `media.get`：blob 读取、immutable 缓存、内联白名单 |
| `packages/server/src/handlers/artifact.ts` | `artifacts.*`（experimental）：Location 解析、view 下载 |
| `packages/server/src/handlers/pty.ts` | `pty.*`：ticket 签发与 WebSocket 连接 |
| `packages/server/src/handlers/persistent-pty.ts` | `server.experimental` 组声明 + 持久终端端点 |
| `packages/server/src/handlers/mcp.ts` | `mcp.*` 与 MCP client 的 WebSocket 桥 |
| `packages/server/src/handlers/pty-socket.ts` | `runPtySocket`（单写队列）、`holdLocation`（1012 关闭） |
| `packages/server/src/handlers/session-error.ts` | `missingSession`/`missingMessage`/带 ref 的 UnknownError |
| `packages/server/src/handlers/schedule.ts`、`job.ts` | experimental 的子实现片段 |
| `packages/server/src/handlers/event.ts` | SSE 端点（详见 `server/event-feed`） |
