---
id: server/auth-pairing
title: 认证、配对与安全头
level: L1
layer: server
status: stable
paths:
  - packages/server/src/auth.ts
  - packages/server/src/pairing.ts
  - packages/server/src/content-headers.ts
  - packages/server/src/cors.ts
  - packages/server/src/request-site.ts
  - packages/server/src/process.ts
  - packages/server/src/middleware/authorization.ts
  - packages/server/src/middleware/schema-error.ts
  - packages/server/src/middleware/session-location.ts
  - packages/server/src/middleware/form-location.ts
symbols:
  - ServerAuth
  - ServerPairing
  - ContentHeaders
  - CONTENT_SECURITY_POLICY
  - disposition
  - CorsConfig
  - isAllowedCorsOrigin
  - isAllowedRequestOrigin
  - RequestSite
  - rejected
  - authorizationLayer
  - authorizedRequest
  - unauthorizedResponse
  - schemaErrorLayer
  - SessionLocationMiddleware
  - FormLocationMiddleware
  - sessionLocationLayer
  - formLocationLayer
  - SESSION_TTL_SECONDS
  - issueSession
  - verifySession
  - sessionCookieName
  - authorized
  - required
  - ServerProcess
entry_http:
  - POST /api/pair
  - GET /auth/connect/:code
  - GET /api/info
config_keys:
  - password
  - cors
  - OPENCODE_PASSWORD
  - OPENCODE_SERVER_PASSWORD
tests:
  - packages/server/test/auth.test.ts
  - packages/server/test/cors.test.ts
  - packages/server/test/request-site.test.ts
  - packages/server/test/schema-error.test.ts
  - packages/server/test/sse-failure.test.ts
depends_on:
  - contracts/httpapi-protocol
  - core/location-instance
related:
  - server/http-handlers
  - runtime/process-lifecycle
  - core/permission-policy
keywords:
  - 认证
  - 密码
  - basic auth
  - 会话 cookie
  - 配对
  - pairing
  - CORS
  - 安全头
  - CSP
  - 401
source_hash: a783349b84a2e98e79eb9604dea9271d74537351
---

## 职责

本地服务器的访问控制与"如何把浏览器/手机接进来"：

- `auth.ts`：`ServerAuth.Config`（一个可选密码）、`required()` 判定是否需要认证、Basic 凭据比对、签名会话 token 的签发与校验。
- `pairing.ts`：一次性配对码服务（5 分钟 TTL、常量内存缓存、原子消费）。
- `middleware/authorization.ts`：Effect HttpApi 的 `Authorization` 中间件实现 —— 从 query / Basic 头 / cookie 取凭据，未通过就抛 `UnauthorizedError`。
- `cors.ts` + `request-site.ts`：CORS 允许列表与"跨站 API 请求"拦截。
- `content-headers.ts`：下载响应的 CSP / nosniff / `content-disposition`。
- `process.ts`：HTTP 服务启动、就绪状态、以及**进入 HttpApi 之前**的兜底鉴权。
- `middleware/schema-error.ts` / `session-location.ts` / `form-location.ts`：同目录的另三个中间件（错误映射与 Location 作用域），不与认证耦合但要一起改同一层。

## 边界

- **不做用户系统**：只有一个本地密码（或 stdio 租约密码），没有账号、角色、RBAC；`username` 恒为 `"opencode"`。
- **不做权限决策**：允许某个工具/路径做某事的判断在 `core/permission-policy`；这里只回答"这个请求有没有凭据"。
- **不加密传输**：TLS 由远程隧道/反向代理负责；远程访问见 `runtime/process-lifecycle` 的 remote 配置。
- 配对码不是权限授予：换到会话 token 后与密码等价，能力相同。

## 入口与调用链

```
HTTP 请求（除 /api/info 未就绪态）
  → process.ts dispatch
      · isPairingConnectURL(url)               → 放行（/auth/connect/:code 自己校验码）
      · has{Pty,PersistentPty,McpClient}TicketURL(url) → 放行（handler 消费 ticket）
      · 其它一律 authorizedRequest(request, auth) 失败 → unauthorizedResponse(401)
  → middleware/authorization.authorizationLayer（ServerAuth.required 为假时直通）
      → credentialFromRequest: ?auth_token= 优先，其次 Authorization: Basic，最后空凭据
      → authorizedRequest → authorizedSessionCookie（同名 host + 同源才认 cookie）
      → 失败：401 + （非浏览器 fetch 才加 www-authenticate）

配对：opencode pair → POST /api/pair → GET /auth/connect/:code
      → ServerPairing.consume(code) 成功 → ServerAuth.issueSession(config)
      → 浏览器：Set-Cookie + 302 "/"；API 客户端：{ token }
```

## 数据与状态

- `ServerAuth.Info = { password: Option<string>, username: "opencode" }`；`createRoutes` 有密码时用 `configLayer`，没有时用默认（`password: none` → 认证整体关闭）。
- 会话 token = `"<expires>.<hmac>"`：`expires` 是秒级时间戳 + `SESSION_TTL_SECONDS`（30 天）；HMAC key 由**服务器密码**派生（`HMAC-SHA256(password)` 先摘要 `"opencode-session-v1"`，再签 payload）。
- cookie 名带端口：`opencode_session_<port>`，因为浏览器在同一 host 的不同端口间共享 cookie（源码注释）。
- 配对码：`randomBytes(16)` → base64url；存进 `Cache`（capacity 1000，TTL 5 分钟）；`consume` 用 `Cache.invalidateWhen` 原子取走；cache 的 `lookup` 永远 `Effect.die`（只允许 set/invalidate，防止误用 get 读到未命中）。
- 进程内状态，重启即清空：配对码与 cookie 里没有服务端会话表，验证是纯密码学校验（所以重启后旧 cookie 仍有效，换密码即全部失效）。

## 关键不变式

- **换密码 = 吊销所有会话**：token 的签名 key 从密码派生，这是刻意设计（`auth.ts` 注释），不要改成独立随机 key，否则"改密码"不再能踢掉已配对设备。
- **比对必须恒时**：`verifySession` 用 `timingSafeEqual` 且先比长度；`expires` 必须是安全整数且未过期。
- **cookie 只允许同源使用**：`authorizedSessionCookie` 在 `origin.host !== host` 时直接拒绝（同站其它端口也会带这个 cookie）；放宽它会变成 CSRF 面。
- **不要给浏览器发 Basic challenge**：`challengeRequest` 只在 `sec-fetch-mode` 缺失或为 `navigate` 时加 `www-authenticate`，否则浏览器原生弹窗会卡死 web app 自己的登录界面。
- **配对码一次性且原子**：只走 `Cache.set` / `invalidateWhen`，任何"先 get 再删"的写法都会破坏单次使用。
- **预认证放行路径必须成对维护**：`middleware/authorization.ts` 的路由白名单与 `process.ts` 的 `has*TicketURL` 判定是同一份语义的两处实现，漏一处就会出现"要么被 401、要么完全没有校验"。
- **`/api/info` 未就绪时仍需凭据**：`dispatch` 在应用层建好之前单独处理它，且带 `retry-after: 1`（starting/stopping 时）。
- **无密码部署意味着无认证**：`createEmbeddedRoutes` / `ServerFetch.make` 不传 password 时认证关闭，源码注释要求嵌入方自己在前置做访问控制。
- **下载响应不可当页面执行**：`CONTENT_SECURITY_POLICY` 带 `sandbox`，html/js/xml 一律降级成 `text/plain`，并强制 `x-content-type-options: nosniff`。

## 扩展点

- **新增一条免凭据路径**（如新的 ticket 通道）：`protocol` 里加路径常量与 `hasXxxTicketURL` → `process.ts` dispatch 放行 → `middleware/authorization.ts` 的放行条件加同一分支 → handler 内自己消费/校验 ticket。
- **加一个允许的 CORS 源**：运行时用 `serve --cors <origin>`（`ServerOptions.cors`），落在 `isAllowedCorsOrigin` 的 `opts.cors` 分支；内置允许列表在 `cors.ts` 顶部（localhost/127.0.0.1/oc://renderer/tauri/*.opencode.ai）。
- **加一个安全响应头**：`content-headers.ts` 是下载响应的唯一出口，改这里即覆盖 fs/media/artifact。
- **改会话有效期**：`SESSION_TTL_SECONDS` 同时决定 token 过期与 cookie `maxAge`（`handlers/server.ts` 的 `server.connect`），不要只改一处。
- **新配对消费方式**：`ServerPairing.Service` 只有 `issue`/`consume`，扩接口要同步 `cache` 语义与 `node` provider。

## 常见改法与坑

- 调试"401 但没有提示"：先看 `sec-fetch-mode`（浏览器 fetch 不会拿到 `www-authenticate`），再看是否命中 ticket/配对放行分支。
- `?auth_token=` 与 `Authorization: Basic` 是等价的两条凭据通道；把 token 放 query 会进日志/历史，给 CLI/SDK 用可以，别在前端主路径用。
- 跨站请求 403 来自 `RequestSite.rejected`（`sec-fetch-site` 为 `cross-site`/`same-site` 且命中 `/api/*`，navigate 直接拦），例外只有 artifact view 路径；这不是认证失败，改这里不要动 auth。
- 403/401 的响应体形状不同：认证失败是 `{_tag:"UnauthorizedError"}`，跨站拦截是 `{_tag:"ForbiddenError"}`，客户端按 tag 分支。
- `options.password` 是启动前提：`ServerProcess.start` 拿不到密码直接 `Missing server password`；stdio/standalone 模式的密码由父进程通过 `OPENCODE_PASSWORD` 注入，并在 `server-process.ts` 里从环境删除以免被工具子进程继承。
- `schema-error` 中间件与认证同层：它把请求校验失败变成 401/400/500 之外的 `InvalidRequestError`；改中间件顺序会改变"先 401 还是先 400"。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/server/src/auth.ts` | 密码/用户名、`required`、`authorized`、会话 token 签发校验、cookie 名 |
| `packages/server/src/pairing.ts` | 配对码 `issue`/`consume`、5 分钟 TTL、原子失效 |
| `packages/server/src/middleware/authorization.ts` | `authorizationLayer`、凭据来源、免检路径、401 响应与 challenge |
| `packages/server/src/process.ts` | HTTP 启动、`dispatch` 兜底鉴权、`/api/info`、就绪 503 |
| `packages/server/src/cors.ts` | `CorsConfig`、`isAllowedCorsOrigin`/`isAllowedRequestOrigin` |
| `packages/server/src/request-site.ts` | 跨站 API 请求拦截（403）与 artifact view 例外 |
| `packages/server/src/content-headers.ts` | `CONTENT_SECURITY_POLICY`、`download`、RFC 6266 `disposition` |
| `packages/server/src/middleware/schema-error.ts` | 请求/响应 schema 错误映射（400 / 500 + ref） |
| `packages/server/src/middleware/session-location.ts` | 按 `sessionID` 提供 Location 作用域 |
| `packages/server/src/middleware/form-location.ts` | 表单用 Location 中间件（含 `global` 哨兵） |
| `packages/server/src/handlers/server.ts` | `server.pair` / `server.connect`：cookie 与 token 两种交付 |
| `packages/cli/src/commands/handlers/pair.ts` | CLI 侧配对链接、QR、远程访问同意 |
