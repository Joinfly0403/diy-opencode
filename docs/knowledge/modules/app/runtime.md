---
id: app/runtime
title: 前端运行时（server 连接、持久化、插件宿主）
level: L1
layer: app
status: stable
paths:
  - packages/app/src/runtime/server
  - packages/app/src/runtime/persistence
  - packages/app/src/runtime/platform
  - packages/app/src/runtime/plugin
  - packages/app/src/runtime/i18n
  - packages/app/src/runtime/presence.ts
  - packages/app/src/runtime/presence-machine.ts
  - packages/app/src/runtime/animated-presence.ts
  - packages/app/src/runtime/array-move.ts
  - packages/app/src/runtime/polyfills.ts
symbols:
  - createOpenCodeEventSource
  - createApiForServer
  - fileStreamUrl
  - createServerTransport
  - createServerSdkContext
  - createServerControllersState
  - transitionServerControllers
  - createServerHealthState
  - transitionServerHealth
  - transitionConnectionSync
  - createMediaCache
  - createRequestQueue
  - normalizeServerUrl
  - ServerScope
  - persisted
  - Persistence
  - flushPersisted
depends_on:
  - contracts/httpapi-protocol
  - core/plugin-system
related:
  - app/session-chat
  - app/settings
  - app/workspaces-servers
keywords:
  - 运行时
  - server 连接
  - 重连
  - 事件订阅
  - SSE
  - 持久化
  - localStorage
  - 状态机
  - GUI 插件
  - 请求队列
source_hash: 057130db86994333cfb54359b3c32142b7fcb7ef
---

## 职责

- Web/桌面渲染进程的运行时底座：把一个 `ServerConnection` 变成 Solid 上下文（`ServerSDK` → `ServerCtx`），向下提供 API 客户端、事件流、媒体缓存、请求队列、健康探测与连接状态机。
- `server/` 管连接、事件分发、同步与 server 级持久化 schema；`persistence/` 是 localStorage / 桌面 namespace 的持久化边界；`platform/` 是 web 与 desktop 的能力适配层；`plugin/` 是 GUI 插件宿主；`i18n/` 是字典与语言状态机；`presence.ts` / `animated-presence.ts` 是全局动效原语。
- 与 `@opencode/client` 是**消费**关系而非替代：连接状态与重连来自 `createClientConnection`（`@opencode/client/solid`），数据缓存来自 `createData`；`server/client.tsx` 只负责把 SDK + 传输 + 媒体缓存绑成一个 per-server 上下文。

## 边界

做什么：连接生命周期、事件分发、请求节流与超时、持久化读写、平台能力、GUI 插件宿主、i18n 资源。

明确不做：

- 不做页面渲染与路由（`app/src/shell`、`app/src/session`）。
- 不实现 HTTP 协议与路由（`packages/protocol`、`packages/server`）。
- 不持有会话、工具、模型状态机（`core/session-execution`、`app/session-chat`）。
- `i18n/` 只提供字典与语言状态，文案语义属于各 feature。

## 入口与调用链

```
entry.tsx → createWebPlatform() → PlatformProvider → app.tsx(AppBaseProviders)
          → ServersProvider(runtime/server/registry.tsx)
          → GlobalProvider(runtime/server/runtime.tsx)          // useGlobal()
               ├─ transitionServerControllers: servers.synced / health.reported
               │    → effect "create" → controller.created → ServerCtx
               ├─ createServerSdkContext(conn, scope)            // server/client.tsx
               │    = createApiForServer + createServerTransport + createMediaCache
               └─ createServerSyncContext(sdk, data)             // server/sync.tsx
                    = bootstrap 查询 + global store + queryClient
ServerProvider(server/current.tsx) → useServer() / useData() → 业务层
```

- 事件：服务端 SSE → `createServerTransport` → `createOpenCodeEventSource().publish` → `event.on(type)` / `event.location(dir).on(type)`。
- 连接状态：`connection.status()` / `attempt()` / `error()` 由 client 包的连接机驱动；`server-sync/machine.ts` 再叠加 `server.connected` 握手，只有二者都到才 `live`。
- 请求：`createRequestQueue` 包住 fetch，限制并发、限制排队数、给响应头加超时并检测 stall。

## 数据与状态

- `persisted(target, schema, initial)`（`persistence/persist.ts`）返回 Solid store：setter 只标脏，100ms 保存窗口 + 页面 hide + owner 清理时序列化一次，序列化结果未变则跳过写。需要“已落盘”语义时调 `flushPersisted()`。
- localStorage 写失败（配额）按“最大优先”驱逐其它 `opencode.*` 键，驱逐失败走 5s 起、翻倍到 60s 的退避；首次失败每页只提示一次 toast。
- 桌面：`platform.storage(name)` 返回 `NamespaceStorage`，内存是真相，写按 100ms 窗口批量上行；每个写带序号，host 回传单调 revision，过期 change 事件被丢弃。
- `server/persistence.ts` 的 `ServerState`：`list` / `hidden` / `lastProjectID` / `usedProjectIDs` / `hostnames` / `projects`（`projects` 是旧版目录列表，迁移成 projectID 后删除）；另有 `ModelState`、`VcsState`。
- `server/global-sync` 按目录缓存 store：`DIR_IDLE_TTL_MS` 空闲驱逐、`MAX_DIR_STORES` 上限、读侧 `pins` 保护，LRU 淘汰。
- 重启恢复：靠持久化 schema 默认值 + `initial` 回填；server 列表与上次项目从 storage 恢复，会话内容永远以 server 为准。

## 关键不变式

- **不要直接调 `crypto.randomUUID()`**：HTTP LAN 起源下 `isSecureContext === false` 会抛 `TypeError`，用 `uuid()`（`@opencode/util/uuid`）。其它 SecureContext-only API（`crypto.subtle`、`navigator.clipboard`、`navigator.serviceWorker`）必须有不安全上下文回退（`packages/app/AGENTS.md`）。
- **生命周期一律状态机**：一个可辨识 union + 纯 `transition(state, event)`，旁边不放布尔、in-flight 字段或世代计数器；effect 只在驱动层执行（AGENTS.md “State Machines”）。
- **不要重启 app 或 server 进程**（AGENTS.md “Debugging”）。
- **同步查询 gate 在连接态**：`sync.tsx` 里 `connected()` 才 enable 查询；断线不要直接重发。
- 一个 server 有两个身份：`url`（逻辑/持久化）与 `http`（当前 API 实际用的连接，managed server 重连会替换）。插件 server 未就绪时传输指向 `http://127.0.0.1:0`，永不响应。
- scope 归并：`ServerScope.fromServerKey` 把 `sidecar` 与规范本地 server 都映射到 `"local"`，按 scope 缓存的键在本地 server 之间共享。
- 请求队列的超时以“响应头到达”为准（普通请求分钟级以下、worktree setup 十分钟量级），响应体可以继续流。

## 扩展点

- **加一个持久化 store**：`persistence/schema.ts` 的 `Persistence.struct/array/record` 定义 → `persisted(Persist.global("<name>"), schema, initial)` → 读返回的 store 与 `ready`。
- **加一个 server 级数据源**：`server/global-sync/bootstrap.ts` 加 query → `server/sync.tsx` 里挂到 global store / queryClient。
- **加平台能力**：`platform/platform.tsx` 的 `Platform` 接口 + `platform/web.ts` 与 desktop 侧两处实现。
- **加 GUI 插件宿主能力**：`plugin/host-apis.tsx` 的 `createHostApis` / `HostApiFactories`，并在 `plugin/module.ts` 的共享模块表里加白名单。
- **加语言**：`runtime/i18n/<locale>.ts` 导出 `dict` → `i18n/language.tsx` 的 `loadLocaleDict` 映射。

## 常见改法与坑

- 改 `normalizeServerUrl`（补协议、去尾斜杠）会改变持久化 key 的匹配；新旧值不一致会导致 server 重复或丢失。
- 组件里不要直接 `OpenCode.make(...)` 造客户端：会丢掉 Basic 认证头与请求队列。用 `useServer().ctx.sdk.api`。
- SSE 空闲约 45s 判定死连接（服务端每 15s 写 keepalive），改 `idleTimeout` 会破坏这条。
- `persisted` 的 setter 是异步落盘；测试里断言存储前先 `flushPersisted()`。
- `plugin/module.ts` 的模块表是插件 bundle 能 `require` 的全部白名单，漏加会以 “requires a module the app does not share” 失败。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/app/src/runtime/server/runtime.tsx` | `GlobalProvider` / `useGlobal`，per-server controller 的创建与销毁 |
| `packages/app/src/runtime/server/client.tsx` | `ServerSDK` 组装、`createServerTransport`、事件源 |
| `packages/app/src/runtime/server/registry.tsx` | server 列表持久化、URL 归一化、显示名 |
| `packages/app/src/runtime/server/api.ts` | API 客户端与 Basic 认证、`fileStreamUrl` |
| `packages/app/src/runtime/server/machine.ts` | controller 状态机（absent/starting/live/unauthorized） |
| `packages/app/src/runtime/server/health.ts` | 健康探测、探测缓存与超时 |
| `packages/app/src/runtime/server/sync.tsx` | bootstrap 查询、global store、queryClient |
| `packages/app/src/runtime/server/server-sync/machine.ts` | 连接状态 × 握手 → live/invalidate |
| `packages/app/src/runtime/server/global-sync/machine.ts` | 目录 store 缓存、pin 与 LRU |
| `packages/app/src/runtime/server/request-queue.ts` | 并发/排队限制、响应头超时、stall 检测 |
| `packages/app/src/runtime/persistence/persist.ts` | `persisted` 保存窗口、`flushPersisted` |
| `packages/app/src/runtime/persistence/schema.ts` | `Persistence` codec 组合器 |
| `packages/app/src/runtime/persistence/namespace.ts` | 桌面 namespace 缓存与批量上行 |
| `packages/app/src/runtime/platform/platform.tsx` | 平台能力接口与 provider |
| `packages/app/src/runtime/plugin/module.ts` | 插件 bundle 的模块白名单 |
