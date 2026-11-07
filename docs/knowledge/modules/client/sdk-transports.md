---
id: client/sdk-transports
title: 客户端三种形态与服务发现 / SDK 宿主
level: L1
layer: client
status: stable
paths:
  - packages/client/src/effect
  - packages/client/src/promise
  - packages/client/src/solid
  - packages/client/src/*.ts
  - packages/sdk/src
symbols:
  - OpenCode
  - make
  - Service
  - discover
  - incumbent
  - ensure
  - stop
  - Info
  - SharedEvents
  - createData
  - Data
  - createClientConnection
  - defaultIdleTimeout
  - createPersistentPtyClient
  - decodePersistentPtyMessage
  - createSessionRetention
  - lastAssistantWithUsage
  - EmbeddedHost
  - SdkInstances
  - WorkerdProfile
  - PromiseSdk
  - Interface
  - layer
  - create
tests:
  - packages/client/test/import-boundaries.test.ts
  - packages/client/test/contract-identity.test.ts
  - packages/client/test/service.test.ts
  - packages/client/test/service-decision.test.ts
  - packages/client/test/service-contender-pool.test.ts
  - packages/client/test/shared-events.test.ts
  - packages/client/test/solid-connection.test.ts
  - packages/client/test/solid-pty-protocol.test.ts
  - packages/sdk/test/import-boundaries.test.ts
  - packages/sdk/test/contract-identity.test.ts
  - packages/sdk/test/instances.test.ts
  - packages/sdk/test/transport.test.ts
depends_on:
  - contracts/httpapi-protocol
  - schema/core-model
  - runtime/process-lifecycle
related:
  - protocol/codegen
  - core/location-instance
keywords:
  - client
  - 客户端
  - Effect
  - Promise
  - Solid
  - sdk
  - 服务发现
  - service.incumbent
  - ensure
  - SSE
  - 嵌入式宿主
source_hash: e22470342ceaff152637c18b106e877310c8a070
---

## 职责

同一份协议（`ClientApi`）的三种消费形态，加上"怎么找到并连上服务"和"怎么把整台服务器塞进进程内"：

| 形态 | 入口 | 本质 |
| --- | --- | --- |
| Promise | `@opencode/client`（`"."` → `src/promise/index.ts`） | 零 Effect 的 fetch 客户端 + `SharedEvents` + `rpc` |
| Effect | `@opencode/client/effect`（`src/effect/index.ts`） | 生成客户端注入 `HttpClient`，事件走 `Stream`，RPC 走 `Effect` |
| Solid | `@opencode/client/solid`（`src/solid/index.ts`） | 在 Promise 客户端之上做事件驱动 store（`createData`）与连接管理（`createClientConnection`） |

再往上一层：

- `@opencode/sdk`（`packages/sdk/src`）：用 `createEmbeddedRoutes` 把 Server 的 HTTP 路由器跑在内存里，再让 Promise/Effect 客户端指向它，**不开监听端口**。
- `@opencode/client/effect/service` 与 `@opencode/client/service`：本地后台服务的 `discover` / `incumbent` / `ensure` / `stop`。

## 边界

- **client 不得依赖 Core/Server**：`src/effect/index.ts` 顶部注释写明 `/effect must never import Core or Server`；`packages/client/test/import-boundaries.test.ts` 用 bundler 输入集断言 —— 根入口连 `effect`/`schema`/`protocol` 都不该被打进来，`effect` 入口可以带 effect+schema+protocol，`client/service` 三样都不能有。
- **sdk 才是允许组合的一层**：`packages/sdk/package.json` 依赖 `client + core + server + schema + plugin + util`；`packages/sdk/test/import-boundaries.test.ts` 断言 `@opencode/sdk` 与 `@opencode/sdk/effect` 的 bundle 输入**同时**含 client、core、server。
- 客户端不实现业务：它只做传输、编解码、事件多路复用、缓存投影。会话/工具语义在 `core/session-execution`、`core/tool-registry`。
- 生成的 `promise/generated`、`effect/generated`、`effect/api` 不手改（见 `protocol/codegen`）。

## 入口与调用链

`````
Promise:  OpenCode.make(options)                       // promise/client.ts
           ├─ generated.make(options)                   // fetch + 解析 SSE
           ├─ SharedEvents.make((signal, onActivity) => raw.event.subscribe(undefined, { signal, onActivity }))
           └─ rpc = Object.assign(makeRpc(raw, events), raw.rpc)

Effect:   OpenCode.make({ baseUrl })                    // effect/client.ts
           ├─ HttpClient 注入 CurrentHeaders（RpcCallOptions.headers）
           ├─ SharedEvents.make(Stream.toAsyncIterableWith(native.event.subscribe(), context))
           ├─ event.subscribe —— Stream，保留原生 typed failure（EventFailure 包 Cause）
           └─ rpc = RpcClientRuntime.make(raw.rpc.call, subscribe)

Solid:    createData({ api, directory, event })         // solid/data.ts，事件 → Solid store 投影
          createClientConnection(api, { onEvent, reconnect, pageLifecycle, idleTimeout })

服务:     Service.discover() / Service.incumbent({url}) / Service.ensure() / Service.stop()

SDK:      EmbeddedHost.create(options)                  // sdk/src/internal/host.ts
           ├─ ManagedRuntime.make(createEmbeddedRoutes(...))
           ├─ SdkInstances.provide / node（可选，按 Session 选插件实例）
           ├─ HttpEffect.toWebHandlerWith(scope)(HttpRouter.asHttpEffect())
           └─ OwnedFetch.make(handler, runtime.dispose) → host.fetch / host.close
          OpenCode.make({ baseUrl: "http://opencode.local", fetch: host.fetch })
`````

- Promise 与 Effect 两个 service 实现共享 `../service-*` 的纯逻辑（`contenderPool` / `ensureTiming` / `matchesVersion` / `decide` / `probeResult` / `PtyHandoff`），差别只在 Effect vs Node API —— 读代码时先看 `packages/client/src/service-*.ts`。
- `sdk/src/promise.ts` 把 `session`/`event` 重命名为 `sessions`/`events`，并把 `plugin` 变成"注册函数 + 原 `plugin` 命名空间"的合体；`sdk/src/effect/opencode.ts` 另外直接暴露 `workspace.create/provision/destroy` 与 `host.sessions.create/get/move`（走进程内实例，而不是 HTTP）。

## 数据与状态

- **服务发现的全部契约就是一个注册文件**：`url` / `pid` / `version` / `password`（`Service.Info`）。客户端只读它 + 做健康探测 + 版本闸门；守护进程自己的端口/密码配置属于 CLI，客户端不读。
- `ensure` 的三条分支：**reuse**（健康且版本匹配，成功时还要 `PtyHandoff.complete`）/ **replace**（版本不匹配 → `stop({ pty: "handoff" })` 后重来）/ **spawn**（用 `options.command`，默认 `["opencode","serve","--service"]` 起"竞争者"，池化直到可发现）。
- 连续 3 次探测超时判定"无响应"：先清 PTY 交接（无法保活），再 `terminate` 并 `recruitNow`。`terminate` 只对"仍是同一个注册且同 pid"的实例发 `SIGTERM`，超时升级 `SIGKILL`，最后再确认一次注册仍属于它才删文件。
- **共享事件流**：`SharedEvents` 全进程只开一条连接，订阅者多路复用；每个订阅者队列上限 4096，超限以错误结束该订阅（不静默丢事件）；过滤订阅者**仍会**收到 `server.connected`，用于重连与复位；最新 `server.connected` 会缓存并补给后来的订阅者。
- **重连归 Solid 层**：`createClientConnection` 默认 `idleTimeout = defaultIdleTimeout（45s）`、前台静默阈值 `foregroundIdleThreshold（20s）`；`connectTimeout` 2s、`reconnectDelay` 1s、连接历史保留 50 条；`pageLifecycle` 时监听 `pagehide/pageshow/online/visibilitychange` 并在回到前台且静默过久时 `resync`。生成客户端自身不重连。
- **Solid store**（`solid/data.ts`）：把 API 读取与事件投影进一个 Solid store；失效读取串行重验（旧响应不能盖新的）；重连只做失效，由活跃 UI 决定重新同步什么。`Data` = `ReturnType<typeof createData>`。
- **SDK 实例**：`instances.key(session)` 必须同步且不初始化插件；key 与 `LocationServiceMap.canonical(session.location)` 一起决定实例；`configure` 只在 cache miss 跑，`idleTimeToLive: Duration.infinity`，实例活到 host 关闭；插件 setup 失败或 ID 与宿主插件冲突 → `Effect.die`（不回落到别的实例，下一次请求可重试）。
- Workerd：`WorkerdProfile.make` 把配置 JSON 化并取 `ServerWorkerd.serverOptions` / `replacements`，数据库落到注入的 Durable Object storage；两个入口（`@opencode/sdk/workerd`、`@opencode/sdk/workerd/effect`）都接受 `instances`。

## 关键不变式

- **同一协议**：`compile(Api)` 与 `compile(ClientApi)` 的 `emitPromise` 输出必须逐字节相等（`packages/sdk/test/contract-identity.test.ts`），且 `ClientApi.groups` 的 key 与 `Api.groups` 一致 —— 客户端与服务器看到的是同一份契约。
- **entrypoint 依赖隔离**是测试硬约束，不是风格建议：往根入口加 `export { Schema } from "@opencode/schema/..."` 会直接打红 `import-boundaries`。
- **一个进程一条事件流**：不要在业务里再 `event.subscribe` 开新连接，一律走 `SharedEvents`/`createData`；否则重连语义与队列背压全失效。
- `ensure` 是幂等的：并发调用应复用同一个服务；`incumbent` 返回 `undefined` 表示"可以继续启动"，与 server 侧的单例判断一一对应（见 `runtime/process-lifecycle`）。
- **SDK 关闭必须收干净**：`close`（= `OwnedFetch.close` → `runtime.dispose`）释放 router、Location 服务、fiber 与 scoped 插件注册；Windows 上资源不释放会让下一次 `create` 抢不到数据库/端口。
- **effect 的 typed failure 不能丢**：`EventFailure` 保留原生 `Cause`（异步迭代器会把 cause 压扁）；把它当普通错误重新包装会丢掉中断与缺陷。

## 扩展点

- **加一个客户端方法**：先改协议再生成（`protocol/codegen`）；只有在需要"协议之外的编排"时才在 `effect/client.ts` / `promise/client.ts` 里包一层（如 `rpc`、`event.subscribe` 的替身）。
- **加一个 Solid 能力**：新建 `solid/<name>.ts` 并在 `solid/index.ts` 里 `export *`；如果要读写 store，走 `createData` 暴露的 `session` 等分组，别自己再建缓存。
- **换传输**：`OpenCode.make` 接受 `baseUrl` + 注入的 `HttpClient`；SDK 就是这样把 `fetch` 换成的 `host.fetch`。嵌入式宿主还可用 `EmbedOptions.overrides`（`LayerNode.Replacements`）替换 Layer。
- **加一个运行时 profile**：照 `WorkerdProfile` 写一个"选项 → serverOptions + replacements"的适配层，入口只做组合。

## 常见改法与坑

- 在 `solid/data.ts` 里手改事件名的投影，却忘了 `SharedEvents` 只补发 `server.connected`：重连后 UI 会停在旧快照（正解是重连失效 + 主动重取）。
- 在客户端里直接 `new WebSocket` 而绕过 `createPersistentPtyClient`：ticket、`input_protocol`、`cursor`、`attachment_id` 这些参数就散了（`PersistentPtyMessage` 只声明客户端真正读的字段，服务端可自由增删其余字段）。
- 把 `instances.key` 写成异步或顺手初始化插件 → 违反 `Options.key` 契约，重启恢复期会拿不到实例。
- 在 `effect/service.ts` 里改 `terminate` 的"比对 `same(current, info)`"判断 → 会在注册文件被别的进程接管时误杀新服务。
- 把 SDK 当成"另一个 HTTP 服务器"：它不开端口，`baseUrl: "http://opencode.local"` 只是生成客户端的占位 host。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/client/src/promise/client.ts`、`effect/client.ts` | 两个 `OpenCode.make`：注入 headers、共享事件流、`rpc` |
| `packages/client/src/promise/index.ts`、`effect/index.ts` | 公共入口与 Schema 契约再导出 |
| `packages/client/src/shared-events.ts` | 单连接事件多路复用、4096 背压、`server.connected` 补发 |
| `packages/client/src/effect/service.ts`、`promise/service.ts` | `discover`/`incumbent`/`ensure`/`stop`/`Info` |
| `packages/client/src/service.ts`、`service-probe.ts`、`service-contender.ts`、`service-timing.ts`、`service-version.ts`、`pty-handoff.ts` | 两种 service 实现共享的纯逻辑 |
| `packages/client/src/solid/data.ts` | `createData`：事件投影 + 读取缓存 |
| `packages/client/src/solid/connection.ts` | `createClientConnection`：重连、看门狗、页面生命周期 |
| `packages/client/src/solid/pty.ts`、`retention.ts`、`usage.ts` | 持久 PTY 帧协议、会话保留/驱逐、上下文用量 |
| `packages/client/src/effect/api/api.ts`、`{promise,effect}/generated/*` | 生成物（勿手改） |
| `packages/sdk/src/promise.ts`、`src/effect/opencode.ts` | Promise / Effect 两个 SDK 入口 |
| `packages/sdk/src/internal/host.ts` | `EmbeddedHost`：嵌入式路由 + `OwnedFetch` |
| `packages/sdk/src/internal/instances.ts` | `SdkInstances`：按 Session 选实例、`LayerMap` 缓存 |
| `packages/sdk/src/internal/workerd.ts`、`src/workerd.ts`、`src/effect/workerd.ts` | Cloudflare Durable Object profile |
