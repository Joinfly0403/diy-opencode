---
id: server/event-feed
title: 事件流（SSE）、请求追踪与服务状态
level: L1
layer: server
status: stable
paths:
  - packages/server/src/event-feed.ts
  - packages/server/src/request-tracing.ts
  - packages/server/src/service-status.ts
  - packages/server/src/server-info.ts
  - packages/server/src/handlers/event.ts
  - packages/protocol/src/groups/event.ts
symbols:
  - EventFeed
  - SubscriberCapacity
  - SubscriberOverflowError
  - EncodingError
  - frame
  - make
  - Service
  - layer
  - withoutParentSpan
  - Status
  - ServerInfo
  - connectionURLs
  - EventGroup
  - isOpenCodeEvent
  - OpenCodeEvent
entry_http:
  - GET /api/event
  - GET /api/info
events:
  - server.connected
config_keys:
  - events.persist
tests:
  - packages/server/test/event-feed.test.ts
  - packages/server/test/request-tracing.test.ts
  - packages/server/test/service-status.test.ts
  - packages/server/test/sse-failure.test.ts
depends_on:
  - contracts/events-db
  - contracts/httpapi-protocol
related:
  - cli/commands
  - server/http-handlers
  - core/session-execution
keywords:
  - sse
  - event feed
  - 事件流
  - 断线重连
  - 服务状态
  - 就绪
  - trace
  - server info
  - 端口
source_hash: f60ff8e56e7bd8a1e3b166df6ecdb47ecea1b6fe
---

## 职责

四块与"服务器对外可见性"相关的基础设施：

1. **事件流**（`event-feed.ts`）：把 `Bus` 上的 durable/ephemeral 事件编码成 SSE 帧，按订阅者的 `types` 过滤，多订阅者共享一次编码。
2. **SSE 端点**（`handlers/event.ts` + `protocol/groups/event.ts`）：`GET /api/event`，首帧 `server.connected`，之后持续推送，15 秒一次心跳注释。
3. **请求追踪**（`request-tracing.ts`）：`withoutParentSpan` 去掉 `Tracer.ParentSpan`，让每个请求/每个后台 fiber 各自成 trace，而不是挂在启动 span 下。
4. **服务状态与自述**（`service-status.ts`、`server-info.ts`）：`starting/ready/stopping/failed` 状态机、监听地址展开（回环 + 非内部网卡）、`ServerInfo` 服务供 `GET /api/info` 与 `server.info` 使用。

## 边界

- **事件流不是日志**：没有历史回放、没有游标；需要可续读的序列请用 `session.log`（`?after=<Event.Seq>` + `follow`），那是会话日志流，不是这条 feed。
- **不做状态同步**：feed 只广播事件，客户端重建状态要靠各自的查询端点（会话、消息、模型列表）。
- **不拥有事件定义**：事件类型在 `packages/schema` 的 event manifest，总线与持久化在 `contracts/events-db`。
- **服务状态不是健康检查**：`service-status` 只反映本进程启动/停止阶段，不含依赖（数据库、模型）健康度。

## 入口与调用链

```
Bus.publish(...)
  → EventFeed.make(bus.listen) 的 publish(event)
      → isOpenCodeEvent 过滤（server.* / rpc.*）
      → render(event) 一次（默认 frame: data: <json> + 空行）
      → 逐订阅者：types 过滤 → Queue.offerUnsafe（dropping，容量 4096）
          · 队列满 → 踢掉该订阅者并 failCause(SubscriberOverflowError)
          · 编码抛错 → 记日志 + fail 所有订阅者（EncodingError）

GET /api/event?types=...
  → EventHandler.handleRaw("event.subscribe")
  → 先发 server.connected 帧，再 concat feed.subscribe(ctx.query.types)
  → 与 Stream.tick("15 seconds") 的心跳注释合并（haltStrategy left）
  → text/event-stream + Cache-Control no-cache,no-transform + X-Accel-Buffering no + nosniff
```

## 数据与状态

- 订阅者表是 `Map<Queue, ReadonlySet<type> | undefined>`，纯内存、随连接生命周期 `acquireRelease`：连接断开即 `Queue.shutdown` 并移出表。
- 容量常量 `SubscriberCapacity = 4096`；队列策略是 **dropping**，慢消费者不会拖慢发布者，但会溢出并被断流。
- 事件本身是否持久化取决于 `Bus` 配置（`ServerOptions.events.persist`）；feed 不存任何东西，重启后订阅者与未读事件都消失。
- `ServiceStatus` 是 `Ref<State>`：`starting` →（`ready` | `failed`）→ `stopping`；`beginStopping` 幂等，`ready`/`fail` 只在 `starting` 生效（不会把 stopping 改回 ready）。
- `ServerInfo.Service` 持有 `urls()`、`app`（name/version/channel）、`paths.tmp`；`connectionURLs` 把 `0.0.0.0`/`::` 展开成 `127.0.0.1`/`[::1]` 加全部非内部同族网卡地址。

## 关键不变式

- **SSE 是 volatile 契约，没有 seq / Last-Event-ID**：协议注释写明"a slow consumer overflows and fails the stream, and events during disconnection are missed"。**不要**给它加"从某个 seq 续传"的语义——重连后由客户端重新拉状态；`server.connected` 就是"现在可以 resync"的信号（客户端 subscribe 侧注释：过滤订阅也总会收到它）。
  - 真正带序号可续读的是 `session.log`：`?after=<exclusive Event.Seq>` + `follow=true`，首帧 `log.synced`。
- **编码一次，广播多次**：同一次 publish 只 `render` 一次，所有订阅者共享同一字符串；不要在订阅者循环里重新序列化。
- **首帧固定 `server.connected`**：ACP 与 catalog 两处都依赖它作为"事件流已接上"的栅栏（见 `cli/acp-bridge`）；改首帧会破坏这些时序。
- **心跳必须存在**：客户端把长时间没有字节的流视为坏流（默认 idle timeout 45 秒，见 `packages/client/src/solid/connection.ts`），删掉心跳会让安静但健康的连接被反复重连。
- **不要给 SSE 加压缩/缓冲**：`no-transform`、`X-Accel-Buffering: no` 是为了不被中间层压住；`process.ts` 的整站 compression 与这里并不冲突（响应头已声明）。
- **请求不能继承启动 span**：`process.ts` 的 `serve(...)` 和 `boot` 都包了 `withoutParentSpan`；handler 与后台 fiber 会捕获该 context，否则整个进程的所有请求都会挂在同一个 trace 下。
- **就绪判定是状态机 + 应用层就绪两个条件**：`dispatch` 里 `ready = state.type === "ready" && application 有值`；未就绪返回 503 + `retry-after: 1`，`failed` 返回 `service_failed` 与修复建议。
- **监听地址要展开**：只绑 `0.0.0.0` 时对外公布的 URL 必须包含可用的局域网地址，`connectionURLs` 是唯一实现，改端口/主机逻辑别绕过它。

## 扩展点

- **加一个新的对外事件**：`packages/schema` 定义事件（manifest 注册）→ 发布点 `Bus.publish` → 若属于 server 组，`isOpenCodeEvent` 与 `OpenCodeEvent` 联合类型自动覆盖（`EventManifest.ServerDefinitions`）→ 客户端 `types` 过滤无需改动。
- **改心跳间隔**：`handlers/event.ts` 的 `Stream.tick("15 seconds")` 必须与客户端 idle timeout 保持数量级关系。
- **加一个新的状态**：`service-status.ts` 的 `State` 联合 + `process.ts` 的 `unavailable()` 文案 + `GET /api/info` 的状态码映射，三处同步。
- **改服务自述字段**：`protocol/groups/server.ts` 的 `ServerInfo` schema（客户端解码）、`server-info.ts` 的 `Service`、`handlers/server.ts` 的 `server.info` 组装。
- **改 trace 边界**：`request-tracing.ts` 只有 `withoutParentSpan`，`fetch.ts`（嵌入形态）与 `process.ts` 都用它，改行为会同时影响两种宿主。

## 常见改法与坑

- 在 feed 上加"补发断线期间事件"会与 `contracts/events-db` 的序号语义打架，也会让缓慢客户端吃到 O(n) 内存；正确做法是客户端重连后重查。
- 过滤参数是 query 的 `types`（数组或单值，`Schema.ArrayEnsure`），且**总是**附带 `server.connected`；不要让它被过滤掉。
- 承载 RPC 事件：`event.type.startsWith("rpc.")` 也算公开事件，插件相关的事件走同一条流。
- 溢出是**连接级失败**而非静默丢帧：客户端应把它当作断流并重连，排障时先看服务端有没有 `EventFeed.SubscriberOverflow`。
- `SubscriberOverflowError` / `EncodingError` 是 stream 的失败原因，会以 Effect 的 SSE failure 事件出现在客户端（`sse-failure.test.ts` 覆盖）；给流加新失败类型要保持可编码。
- 就绪前访问 `/api/info` 也要凭据（见 `server/auth-pairing`），别为了"方便探活"把它变成匿名端点。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/server/src/event-feed.ts` | `EventFeed.make`、帧编码、订阅者表、溢出/编码错误 |
| `packages/server/src/handlers/event.ts` | `GET /api/event`：首帧、心跳、SSE 响应头 |
| `packages/protocol/src/groups/event.ts` | 事件流契约、`isOpenCodeEvent`、volatile 说明 |
| `packages/server/src/request-tracing.ts` | `withoutParentSpan`：切断父 span |
| `packages/server/src/service-status.ts` | `starting/ready/stopping/failed` 状态机 |
| `packages/server/src/server-info.ts` | `ServerInfo.Service`、`connectionURLs` 地址展开 |
| `packages/server/src/process.ts` | `serve` 管线、`dispatch` 就绪判定、`/api/info`、退出收敛 |
| `packages/server/src/fetch.ts` | 嵌入形态（workerd/Deno）的同构入口，同样 `withoutParentSpan` |
| `packages/server/src/routes.ts` | `Bus.configured({ persist })`、`ServerInfo.layer` 装配 |
| `packages/client/src/solid/connection.ts` | 客户端重连/心跳超时对端（1s 重试、45s idle） |
