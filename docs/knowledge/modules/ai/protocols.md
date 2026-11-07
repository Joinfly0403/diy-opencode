---
id: ai/protocols
title: 协议适配层（聊天/图像/语音/转写/视频/决策）
level: L2
layer: ai
status: stable
paths:
  - packages/ai/src/protocols
  - packages/ai/src/protocols.ts
  - packages/ai/src/route/protocol.ts
symbols:
  - OpenAIChat
  - AnthropicMessages
  - BedrockConverse
  - CohereChat
  - AlibabaChat
  - OpenResponses
  - Gemini
  - MistralChat
  - ProviderShared
  - Lifecycle
  - ToolStream
  - BedrockEventStream
depends_on:
  - ai/routing
related:
  - ai/providers
  - ai/generation-media
  - core/provider-models
keywords:
  - 协议
  - protocol
  - 流式
  - SSE
  - 事件映射
  - 终止事件
  - usage
  - tool-call
  - 错误形状
source_hash: 1b16b43d5a6018b03ec10488855e06401446fb31
---

## 职责

`Protocol`（接口定义在 `packages/ai/src/route/protocol.ts`）是「这套 API 长什么样」的语义契约，本目录是它的具体实现：

- **请求方向** `body`：`{ schema, from }` —— 把通用 `LLMRequest` 降级成 provider 原生 body，并给出该 body 的 Schema（route 层负责校验 + JSON 编码）。
- **响应方向** `stream`：`{ event, initial, step, terminal?, onHalt? }` —— `event` 把 wire frame 解成 provider 事件；`step` 是状态机，把事件序列翻成 `LLMEvent` 序列。
- 目录内 72 个 `.ts` 文件覆盖：聊天（`openai-chat`、`open-responses`、`openai-responses`、`anthropic-messages`、`bedrock-converse`、`gemini`、`mistral-chat`、`cohere-chat`、`meta-messages`、`zai-chat`、`venice-chat`、`system-one`）、图像（`openai-images`、`google-images`、`meta-images`、`xai-images`、`zai-images`、`minimax-images`、`alibaba-images`、`cloudflare-workers-ai-images`）、语音（`openai-speech`、`google-speech`、`cartesia-speech`、`deepgram-speech`、`elevenlabs-speech`）、转写（`openai-transcription`、`assemblyai-transcription`、`deepgram-transcription`、`elevenlabs-transcription`、`google-transcription`）、视频（`google-video`、`runway-video`、`xai-video`）、决策（`openai-decisions`、`cloudflare-run-decisions`），以及厂商薄包装（`alibaba-chat/messages/responses`、`meta-*`、`minimax-*`、`moonshot-*`、`zai-messages`、`openai-compatible-chat/responses`）。
- `shared.ts` + `utils/*`：所有协议共用的降级原语（工具扁平化、媒体引用、usage 归一、tool-call 累积、SSE/缓存/思考预算等）。

## 边界

- 不决定 URL、鉴权、流框架（`Endpoint`/`Auth`/`Framing` 属于 `ai/routing`），不加重试、不做超时。
- 不定义事件数据模型：`LLMEvent` 在 `packages/ai/src/schema/events.ts`，协议只能产出它，不能自造事件形状。
- 不做调用方入参校验：`ai.request`/`prepareRequest` 已经在边界把输入归一化并校验。
- 媒体协议的「路由」不在这里：`MediaProtocol` 的 inline/stream/queued 组合在 `route/media.ts`，本目录只写 body/事件/解码。

## 入口与调用链

请求方向：

```
ai.stream/generate → route/client.ts prepareRequest → route.body.from(request)
  → body.schema 校验 → transport 序列化（JSON / multipart / binary）
```

响应方向：

```
transport → framing（bytes → Frame）
  → protocol.stream.event（Frame → Event，Schema codec）
  → protocol.stream.step(state, event) → [state', LLMEvent[]]
  → terminal?(event) 命中即截断；onHalt?(state) 在帧流结束时补发
  → route/client.ts requireTerminalEvent：没有 finish 即 InvalidProviderOutputError
```

- 终止机制有三套并存：OpenAI Chat 靠 `[DONE]` 帧（`Framing.sseWithDone`）+ 流自然结束；Anthropic 在 `step` 里处理 `message_stop`；Cohere 用 `terminal: (event) => event.type === "message-end"`。Bedrock 没有天然终止事件，靠 `onHalt` 发 `finish`。
- 错误：provider 在流内报错时用 `classifyProviderFailure`（`provider-error.ts`）或 `ProviderShared.eventError`/`invalidRequest`/`unsupportedOperation` 产出 `AIError`；未知事件返回 `[state, []]` 静默忽略。

## 数据与状态

- 解析状态是 `protocol.stream.initial(request)` 产出的**不可变结构**，`step` 每步返回新 state。典型字段：`Lifecycle` 里未闭合的 text/reasoning 分片 id 集合、`ToolStream` 的工具调用累积器、usage、finishReason、`OpenResponses` 的 outputItems 映射、压缩 checkpoint 表。
- 状态不持久化，只活在一次 `stream` 内；snapshot/恢复不在本层。
- `includeRaw` 时每个 provider 帧会先发一条 `LLMEvent.raw`（`data` 为原始帧，`Framing.body/raw` 可改写回 wire 形态）。

## 关键不变式

- **每个流必须有终止事件**：没有 `finish` 结束时 route 层抛 `InvalidProviderOutputError`（`classification: "incomplete-stream"`）；`finish` 之后再出现非 raw 事件同样报错（`route/client.ts` `requireTerminalEvent`）。协议不能「静默结束」。
- **容忍未知**（packages/ai/AGENTS.md）：未知事件、未知状态、未知枚举值忽略或透传；只有「provider 文档形状里的错误、已知类型畸形、缺终止事件」才失败。`withUntypedFrames` 专门把网关的无 `type` keep-alive 帧变成 `ignored`。
- **分片必须配对**：文本/推理用 `Lifecycle.textStart/textDelta/textEnd`、`reasoningStart/reasoningDelta/reasoningEnd`（首次自动补 `step-start`，结束时 `closeOpenBlocks` 补 end 再发 `step-finish`+`finish`）；工具调用用 `ToolStream.append/appendOrStart/finish/finishAll`，最终输入用 `parseToolInput` 解析，空串按 `{}`。
- **Usage 语义**（`schema/events.ts` 长注释）：`inputTokens` 含缓存读写、`outputTokens` 含 reasoning；`nonCachedInputTokens + cacheReadInputTokens + cacheWriteInputTokens = inputTokens`，`reasoningTokens ≤ outputTokens`。OpenAI/Gemini 报 inclusive 需减出拆解，Anthropic/Bedrock 报非重叠需相加；减法一律 `Math.max(0, …)`。
- **包装别的协议时必须转发** `supportsEffortUpdates` 与 `sanitizer`（`route/protocol.ts` 注释：wrappers around another `body.from` must forward it）。
- **工具名扁平化只有一套**：无原生 namespace 的协议用 `ProviderShared.flattenTools`/`flattenToolRequest`（叶子名用 `_` 连接），不要各写一份。
- **SSE 框架会丢弃东西**：`Framing.sseEvents(known)` 只保留已知事件名，并丢弃空 data、`data: null` 代理心跳、`: keepalive`；`[DONE]` 默认丢、`sseWithDone` 保留。
- 协议里不做 I/O、不读环境变量、不加 `try/catch` 兜底之外的策略。

## 扩展点

- **加一个聊天协议**：新建 `protocols/<name>.ts`，`Protocol.make({ id, body: { schema, from }, stream: { event, initial, step, terminal?, onHalt? } })`，并（可选）导出 `route = Route.make({ protocol, endpoint, auth, framing })` 与 `framing`；在 `protocols/index.ts` 加 `export * as <Name>`；需要独立入口时在 `packages/ai/package.json` 加 `./protocols/<name>`。
- **给既有协议加厂商特例**：`Protocol.make({ ...Base.protocol, body: { ...Base.protocol.body, from: 包装 } })`（参考 `providers/google-vertex.ts`、`protocols/alibaba-chat.ts`），记得转发 `supportsEffortUpdates`/`sanitizer`。
- **加一种流框架**：改 `route/framing.ts`（SSE/AWS event-stream/lines/document 已有实现）。
- **加共享降级能力**：改 `protocols/shared.ts` 会影响全部协议；`protocols/utils/*` 是更安全的落点。
- **加媒体协议**：用 `MediaProtocol.inline/queued/stream`（见 `protocols/openai-images.ts`、`runway-video.ts`）。

## 常见改法与坑

- 只写 `step` 不写 `terminal`/`onHalt`：对没有自然结束信号的协议（Bedrock、部分兼容代理）会直接变成 `incomplete-stream`。
- Bedrock 的 `finish` 在 `onHalt` 里发；改 `step` 里 `finishReason` 的记录方式容易漏发 `finish`。
- 自己再发一次 `text-start`/`text-end`：`Lifecycle` 已按 id 去重，重复发会产生双份分片。
- `sseEvents(known)` 的已知集合写漏一个事件名 → 该事件被静默丢弃，表现为「某些字段永远不出现」。
- 改 `bedrock-event-stream` 的 frame 形状会同时影响 `Framing.body`（错误体回填）与 `Framing.raw`（raw 事件），两处要一起改。
- 在 `step` 里做 schema 校验失败即抛：`route` 会把帧体附到错误上（`frameError`），但只有在 `execution.body` 存在时才是 wire 原文。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/ai/src/route/protocol.ts` | `Protocol`/`ProtocolBody`/`ProtocolStream` 契约与 `make` |
| `packages/ai/src/protocols/index.ts` | 17 个协议命名空间总表 |
| `packages/ai/src/protocols/shared.ts` | 工具扁平化、媒体引用、usage 归一、eventError/invalidRequest |
| `packages/ai/src/protocols/utils/lifecycle.ts` | step/text/reasoning 分片配对与 finish |
| `packages/ai/src/protocols/utils/tool-stream.ts` | 流式 tool-call 累积与收尾 |
| `packages/ai/src/protocols/openai-chat.ts` | Chat Completions 协议 + reasoning_details 两种方言 |
| `packages/ai/src/protocols/anthropic-messages.ts` | Messages 协议、beta 头推导、thinking/effort |
| `packages/ai/src/protocols/open-responses.ts` | 中立 Responses 基线（`/responses` 的事件与 items） |
| `packages/ai/src/protocols/bedrock-converse.ts` | Converse + `onHalt` 收尾 + binary framing |
| `packages/ai/src/protocols/bedrock-event-stream.ts` | AWS event-stream 二进制帧解码 |
| `packages/ai/src/protocols/cohere-chat.ts` | `terminal` 式终止（`message-end`）范例 |
| `packages/ai/src/protocols/utils/responses-compaction.ts` | `/compact` 替换窗口的 `CompactOperation` |
| `packages/ai/src/protocols/utils/responses-checkpoint.ts` | 触发式压缩 checkpoint 的 `TriggerCompactOperation` |
