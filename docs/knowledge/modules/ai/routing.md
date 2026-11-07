---
id: ai/routing
title: 请求路由（Route/LLMClient/HttpClient）
level: L1
layer: ai
status: stable
paths:
  - packages/ai/src/route
  - packages/ai/src/route.ts
  - packages/ai/src/llm.ts
  - packages/ai/src/loop.ts
symbols:
  - Route
  - LLMClient
  - RequestExecutor
  - Auth
  - Endpoint
  - Framing
  - HttpTransport
  - Protocol
  - StreamOptions
  - CompactionOperations
  - canCompact
  - compileRequest
depends_on:
  - ai/protocols
related:
  - ai/providers
  - ai/generation-media
  - core/provider-models
keywords:
  - 路由
  - route
  - 请求
  - HttpClient
  - 重试
  - 压缩
  - compact
  - 中间件
  - 超时
source_hash: c3655873076a2696a7dfafc563d12dec3e4a78bf
---

## 职责

一次模型请求的「编译 + 发送」通道：

- `route/client.ts`：`Route`（懒构造器，组合 protocol/endpoint/auth/framing/transport/headers/options/compact）与 `LLMClient`（`stream`/`generate`/`compact` 的 Service + Layer），以及请求编译管线 `prepareRequest` → `body.from` → `prepareTransport` → `streamPrepared`。
- `route/executor.ts` + `executor-service.ts`：`RequestExecutor` —— 对 `effect/http` 的 `HttpClient` 做「一次执行 + 状态分类 + 错误归一」，并暴露 `middleware` 钩子。
- `route/transport/http.ts`、`websocket*.ts`：把 prepared 请求真正发出去，切帧交给 `Framing`。
- `route/auth.ts`、`auth-options.ts`、`endpoint.ts`、`framing.ts`：四个正交轴。
- `llm.ts`：`ai.request`/`generate`/`stream`/`loop`/`compact` 的实现；`loop.ts` 是循环步进原语（`nextRequest`/`pendingCalls`/`addUsage`/`collect`）。

## 边界

- **不选模型**：本包不解析「用哪个 provider/模型」。调用方（Core 的 `core/provider-models`）把已构造好的 `LanguageModel` 传进来，`ai.request` 只做输入归一化；「路由」在 `model.route` 里，是既成事实。
- **不做重试策略**：`RequestExecutor.execute` 是单次执行；是否重试由调用方看 `AIError.isRetryable`/`isRetryable` 决定（唯一内建重试是媒体路由的轮询，在 `route/media.ts`）。
- 不实现协议（`ai/protocols`）、不做权限/插件/会话（Core）。
- `ai.stream`/`ai.generate` 只跑**一次**模型调用；多步工具循环是 `ai.loop`，每次循环都重新发一次请求。

## 入口与调用链

```
ai.generate/stream/loop/compact（src/index.ts 或 src/effect.ts）
  → LLM.generate/stream/loop/compact（llm.ts）
  → LLMClient.Service（route/client.ts layer）
  → streamRequestWith → compile:
        resolveRequestOptions（request 覆盖 model.options 覆盖 route.options）
        → normalizeToolHistory / sanitizeSurrogates / restoreClasses
        → applyEffortUpdates → ToolSchemaProjection.tools（去重 key: type:name）
        → applyCachePolicy → route.headers()
        → route.body.from(request)（协议降级）
        → route.prepareTransport（endpoint 渲染 + auth + JSON 编码 + 超时/压缩）
  → route.streamPrepared（transport.execute → framing → protocol.stream.step）
```

- 本地文件引用（`file:`）在 `compile` 阶段被拒绝，提示先用 `Media.file(path)` 读成 asset。
- `generate` = `generateWith(stream)`：边跑边用 `ResponseFold` 折叠，失败时把已产出的部分响应挂到 `AIError.partial`。
- 压缩两条路：`compact.endpoint`（`/compact` 返回替换窗口 `CompactionResponse`）与 `compact.trigger`（在正常响应里取 checkpoint，返回 `CompactionCheckpointResponse`），由 `canCompact` 做类型/能力判定，`compactRequest` 选机制。

## 数据与状态

- 无持久化。一次流的可变状态只存在于 `streamPrepared` 的闭包里（`protocol.stream.initial` 起的 state，逐步替换），以及 `streamPrepared` 里 `ResponseFold` 的组装状态（`schema/events.ts`，不对外导出）。
- `Route` 是不可变值：`route.with(patch)` 每次重建；`options` 用 `mergeRequestOptions` 合并，`endpoint` 用 `Endpoint.merge`，`headers`/auth 直接替换。
- 错误上带 HTTP 证据：`AIError.reason.http`（`HttpContext`：url/status/headers）与 `HttpRateLimitDetails`（retry-after 与 x-ratelimit-*/anthropic-ratelimit-* 解析），由 `executor.ts` 的 `httpFailure` 统一构造。
- 超时配置来自 `request.timeout`（`TransportOptions`）：`headers` 默认 `DEFAULT_HTTP_TIMEOUT_MS`（300_000），`chunk` 默认 `DEFAULT_CHUNK_TIMEOUT_MS`（900_000），`total` 无默认。

## 关键不变式

- **一次 step = 一次 `llm.stream` 调用**，接续由调用方重载的历史；不要改成内存工具循环（AI 包 AGENTS：`ai.stream`/`ai.generate` 只跑一次模型调用；会话核心 AGENTS：每个 step 显式一次调用）。
- **终止事件必需**：`streamPrepared` 用 `requireTerminalEvent` 包裹，缺 `finish` 抛 `InvalidProviderOutputError`（`incomplete-stream`），`finish` 后的非 raw 事件也报错。
- **只用 HttpClient/Stream/Schema codec**，不用 `fetch`/async generator/`JSON.parse`（AI 包 AGENTS）；需要裸 fetch 时只能通过 `request.fetch`（`withFetch` 会把它变成一次性的 HttpClient）。
- **只有 `src/index.ts`（Promise 入口）可以用 Promise**。
- **`prepareRequest` 之后协议必须看到规范类实例**：`sanitizeSurrogates` 会把 class 复制成普通对象，`restoreClasses` 随后重建 `Message`/`ToolEntry`/`ToolChoice`；在这之后加的新字段如果依赖原型会被抹掉。
- **工具去重按 `${type}:${name}`**（tool 与 namespace 可同名），且下发前过 `ToolSchemaProjection.tools`。
- **compact 是协议能力不是模型资格**：`CompactionOperations` 只描述 route 支不支持；模型能不能用由 `canCompact` 在运行时判定，不支持时抛 `UnsupportedOperationError`（operation 为 `compact` / `compact.trigger`）。
- `compileRequest` 仅供 `@opencode/ai/testing` 使用，不要当生产入口。
- `route.with({ compact })` 的语义：不传 `compact` 保留旧值，显式 `{ compact: undefined }` 才清除（`"compact" in patch` 判断）。

## 扩展点

- **加一种传输**（WebSocket / 自定义）：实现 `Transport` 接口（`route/transport/index.ts`）并让 `Route.make` 走 `MakeTransportInput` 分支（传 `transport` 而不是 `framing`）。
- **加请求级 header / 部署级 quirks**：`Route.make({ headers: ({ request }) => ... })`；请求自身的 `headers` 覆盖 route headers。
- **换 HTTP 执行器/录制**：`make({ layer: RequestExecutor.middleware(fn) })` 或注入自定义 `Layer<RequestExecutor.Service>`。
- **加压缩机制**：在 `Route.make({ compact: { endpoint?, trigger? } })` 挂 `CompactOperation`/`TriggerCompactOperation`（参考 `protocols/utils/responses-compaction.ts`、`responses-checkpoint.ts`）。
- **改合并优先级**：`resolveRequestOptions` 与 `prepareRequest` 是唯一入口，改这里影响所有协议。

## 常见改法与坑

- 在 route 层加重试 → 和 Core 的重试叠加，一次用户请求会变成 N×M 次。`RequestExecutor` 只执行一次，这是有意为之。
- `request.http.body` 只能覆盖 JSON object body（`transport/http.ts` `bodyWithOverlay`），对其它 body 直接 `invalidRequest`。
- 改 `Route.with({ provider })` 时会顺手改 `providerMetadataKey`（除非显式给），响应命名空间会变。
- `normalizeToolHistory` 可能替换 `messages` 数组，别在调用方保留旧引用做缓存。
- `generateWith` 的 partial 只在失败时挂；成功路径不要读 `AIError.partial`。
- `DEFAULT_CHUNK_TIMEOUT_MS` 是 15 分钟（DeepSeek 等会长时间不吐字），改小会误杀推理模型。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/ai/src/route/client.ts` | `Route`/`make`/`with`、`LLMClient`、prepareRequest、streamPrepared、canCompact |
| `packages/ai/src/route/protocol.ts` | `Protocol` 契约（routing 与 protocols 的接缝） |
| `packages/ai/src/route/executor.ts` | `RequestExecutor`：HttpClient 单次执行、状态分类、错误归一 |
| `packages/ai/src/route/executor-service.ts` | `Service`/`HttpMiddleware`/header 细节 |
| `packages/ai/src/route/transport/http.ts` | endpoint 渲染、auth 应用、JSON/压缩 body、三档超时 |
| `packages/ai/src/route/transport/websocket*.ts` | WebSocket 通道传输 |
| `packages/ai/src/route/auth.ts` | `Auth` 定义与 credential 组合 |
| `packages/ai/src/route/auth-options.ts` | `apiKey` 解析（option > env）、`apiKey: false` |
| `packages/ai/src/route/endpoint.ts` | `Endpoint.path/merge/render` |
| `packages/ai/src/route/framing.ts` | SSE / AWS event-stream / lines / document 切帧 |
| `packages/ai/src/route/media.ts` | 媒体路由（inline/stream/queued）+ 轮询重试 |
| `packages/ai/src/llm.ts` | request/generate/stream/loop/compact 与 schema 强制工具 |
| `packages/ai/src/loop.ts` | 循环步进：nextRequest/pendingCalls/addUsage/collect |
