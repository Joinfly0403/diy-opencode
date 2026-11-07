---
id: ai/generation-media
title: 生成句柄与媒体（图像/媒体资产）入口
level: L2
layer: ai
status: stable
paths:
  - packages/ai/src/generation.ts
  - packages/ai/src/image.ts
  - packages/ai/src/image-client.ts
  - packages/ai/src/media.ts
  - packages/ai/src/media-client.ts
  - packages/ai/src/media-model.ts
  - packages/ai/src/index.ts
  - packages/ai/src/effect.ts
symbols:
  - Generation
  - resultEvents
  - isTerminal
  - ImageModel
  - ImageEvent
  - ImageResponse
  - ImageClient
  - Asset
  - AssetSchema
  - Media
  - GenerationHandle
  - MediaModel
  - MediaClient
depends_on:
  - ai/routing
related:
  - ai/providers
  - ai/protocols
keywords:
  - 生成
  - generation
  - 轮询
  - 图像
  - 媒体
  - asset
  - 流式
  - promise
  - effect
  - 一致性
source_hash: b277780549eec5eebbbeb0968f9a6e4eb7bb5238
---

## 职责

媒体模态（图像为已完成样板，语音/转写/视频在 `experimental`）的公共骨架，以及「两套运行时、一套 API」的边界：

- `generation.ts`：`Generation<Response>` —— 一次可轮询的生成句柄（`id/status/progress/position/token`、`refresh/result/await/events/cancel`），状态机 `queued|running|completed|failed|cancelled|expired`，`isTerminal`、`resultEvents`。
- `image.ts`：`Image` 命名空间（`request/generate/stream/start/resume`）、`ImageModel`、`ImageRequest`/`ImageResponse`、事件 union `ImageEvent`。
- `image-client.ts`/`media-client.ts`：按路由 `kind` 分派的 Service（`generate/stream/start/resume`），一个 `MediaClient.make` 供所有模态复用。
- `media-model.ts`：`MediaModel` 基类 + `composeRoute` + `tryRequest`。
- `media.ts`：`Media.Asset` 值对象（四种 source）、media type 嗅探、data URL 解析、读写。
- `index.ts`（Promise 入口）与 `effect.ts`（Effect 入口）：同一批操作的两套签名。

## 边界

- 不实现协议与 HTTP：图像协议在 `protocols/*-images.ts`，路由组装在 `route/media.ts`。
- 不定义 usage 单位：`MediaUsage`（tokens/seconds/characters/credits/compute）在 `schema/events.ts`。
- 不决定模型能力/价格（models.dev / Core）。
- `Media.file`/`ai.file` 才碰文件系统；本层其它地方不读盘（`index.ts` 里 `node:fs/promises` 是**动态** import）。

## 入口与调用链

```
ai.image.generate / ai.image.stream / ai.image.start / ai.image.resume（Promise 或 Effect）
  → Image.request（归一化）→ tryRequest（Schema 校验，失败变 InvalidRequest）
  → ImageClient.<op>
       route.kind === "inline"  → route.generate
       route.kind === "stream"  → route.stream（generate 用 collect 汇成响应）
       route.kind === "queued"  → route.start → Generation.await / resultEvents
  → MediaRoute（route/media.ts）发请求、解码、产出事件/响应
```

- `Generation` 的轮询：`await()` 默认 5s 间隔、10min 超时，`events()` 是同一收线逻辑的流版本，最后一条是 `generation-finished`。
- Promise 入口 `make()` 用一个 `ManagedRuntime` 承载全部 client；每个方法把对应 Effect 跑起来并原样重抛 `AIError`；`Generation` 被包成 `GenerationHandle`（快照 + `await/events/result/refresh/cancel`）。
- Effect 入口 `effect.ts` 直接聚合 `LLM/Image/Decision/Speech/Transcription/Video`，不碰运行时。

## 数据与状态

- `Media.Asset`：`source` 四态（`bytes|base64|url|ref`，品牌化 `Media.Source` union）；`mediaType` 派生顺序 = 声明值 → 魔数嗅探（`detectMediaType`）→ `application/octet-stream`；`kind` 由 mediaType 前缀推出。
- 实例级派生缓存：`#bytes`/`#base64` 惰性缓存（check-then-set，并发首读 `url` 源可能下载两次；缓存不体现在 `source` 上，`Media.from(asset.source)` 仍无损）。
- `url` 源可带 `expiresAt`（epoch ms）与瞬时下载 `headers`；`ref` 源是 provider 侧句柄（file_id / gs:// / 生成 id），只能被同一 provider 使用。
- `Generation.token` 是**可序列化 JSON**，用于跨进程 `resume`；路由在边界解码一次并闭包持有，`Generation` 不感知 token 形状。
- 无持久化：句柄本身不落库，恢复靠调用方保存 `token`（图像 `ai.image.resume(model, token)`）。

## 关键不变式

- **一套 API、两套运行时**（packages/ai/AGENTS.md）：`ai`（`@opencode/ai`）与 `ai`（`@opencode/ai/effect`）命名空间/操作/重载/入参必须一致，只允许三处差异——`signal` 选项、`Promise`/`AsyncIterable`、`GenerationHandle`。由 `test/promise-parity.types.ts` 类型测试强制。
- **只有 `src/index.ts` 可以用 Promise**（AGENTS.md）；其它文件必须留在 Effect/Stream 里。
- **图像流必须恰好一个 `finish`**：`collectResponse` 找不到 finish 直接 `Effect.die`（注释：每个图像协议要么发终止事件要么失败）。
- **`start`/`resume` 只对 queued 路由可用**，其它 kind 抛 `UnsupportedOperationError`（operation `image.start` / `image.resume` 等，见 `media-client.ts` `notQueued`）。
- **媒体请求不吃 `timeout`**：`TransportOptions.timeout` 注释明确「Applied to text requests; media requests do not apply it yet」。
- **`events()` 不用 `Stream.interruptWhen`**：文件注释说明它在 `TestClock` 下会死锁，改用显式 deadline（`within`），每次轮询和每次 sleep 都受剩余时间约束。
- **轮询失败重试有界**：状态/结果读走 `READ_RETRY`（1s 起指数、jitter、每次 ≤30s、最多 8 次），`start`/`cancel` 永不重试（`route/media.ts`）。

## 扩展点

- **加一种媒体模态**（例如新的 speech 供应商）：仿 `image.ts` 写 Schema 类 + 事件 union + `collectResponse` → 用 `MediaClient.make` 造 `<Modality>Client`（`image-client.ts` 是范本）→ 在 `effect.ts` 与 `index.ts` 暴露（新模态通常先放 `experimental`）。
- **加一条图像协议**：`protocols/<name>-images.ts` 用 `MediaProtocol.inline/stream/queued`，再在 provider facade 里用 `ImageModel.fromRoute` 或 `MediaRoute.deployment` 组装（参考 `providers/openai.ts` 的 `image`）。
- **改轮询默认**：`generation.ts` 的 `DEFAULT_POLL_INTERVAL`/`DEFAULT_POLL_TIMEOUT` 影响所有 queued 媒体，属于全局行为改动。
- **加 asset 来源**：改 `media.ts` 的 `Source` union + `Asset` 派生逻辑；所有协议都会受影响。

## 常见改法与坑

- 在 Effect 文件里加 Promise 或 `async` → 违反 AGENTS.md，也会破坏 `promise-parity` 的可推导性。
- 给 Promise 侧加只有它有、Effect 侧没有的方法 → `test/promise-parity.types.ts` 直接挂（Helpers 白名单只有 `run/bytes/base64/materialize/file/write`）。
- 把 `Generation` 直接暴露给 Promise 调用方：`GenerationHandle` 的字段是创建时快照，`refresh()` 返回**新**句柄而不是就 self 更新（`index.ts` 注释）。
- 事件里的 usage 是 `MediaUsage`，不是文本 `Usage`；混用会得到不出错的错误数字。
- `Media.file` 依赖 `FileSystem.FileSystem`，在 Effect 里要提供 FileSystem；Promise 侧 `ai.file` 走 `node:fs/promises`（首次调用才 import）。
- 超时语义两套：`Generation.await({ poll: { timeout } })` 是轮询预算，和 HTTP `request.timeout` 无关。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/ai/src/generation.ts` | `Generation` 句柄、状态机、`events`/`await`/`result`、`resultEvents` |
| `packages/ai/src/image.ts` | Image 请求/响应/事件、`ImageModel.fromRoute`、collectResponse |
| `packages/ai/src/image-client.ts` | 图像 Service + `MediaClient.make` 实例 |
| `packages/ai/src/media-client.ts` | 按 `route.kind` 分派 generate/stream/start/resume |
| `packages/ai/src/media-model.ts` | `MediaModel` 基类、`composeRoute`、`tryRequest` |
| `packages/ai/src/media.ts` | `Media.Asset`、Source union、派生 mediaType、读写/data URL |
| `packages/ai/src/index.ts` | Promise 入口：ManagedRuntime、`GenerationHandle`、helper、`abortEffect` |
| `packages/ai/src/effect.ts` | Effect 入口：`ai` 聚合对象（两套 API 的另一半） |
| `packages/ai/src/route/media.ts` | 媒体路由组装与轮询重试（被本卡消费） |
| `packages/ai/test/promise-parity.types.ts` | 两套入口一致性的类型断言 |
