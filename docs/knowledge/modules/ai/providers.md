---
id: ai/providers
title: Provider 实现与模型工厂
level: L2
layer: ai
status: stable
paths:
  - packages/ai/src/providers
  - packages/ai/src/providers.ts
  - packages/ai/src/provider-package.ts
  - packages/ai/src/schema/options.ts
  - packages/ai/src/schema/ids.ts
symbols:
  - ProviderPackage
  - LanguageModel
  - LanguageModelCompatibility
  - Capabilities
  - ProviderOptions
  - mergeProviderOptions
  - bearerRouteDefaults
  - toConfig
  - OpenAIOptionsInput
  - ProviderID
  - DeepSeek
  - Anthropic
depends_on:
  - core/provider-models
related:
  - ai/protocols
  - ai/routing
  - core/plugin-system
keywords:
  - provider
  - 厂商
  - 模型工厂
  - 鉴权
  - baseURL
  - 能力
  - 兼容性
  - models.dev
  - 透传
source_hash: 7ff49d795b0b4bae60800204f62b27823510c6b6
---

## 职责

每个「provider 文件」是一个厂商的**部署组合**，不是协议实现：把已有 Protocol 用 `Route.make(...)` 绑到自己的 endpoint/baseURL、给它一个 auth 定义、再把 (modelID, settings) 变成 `LanguageModel`。

- `providers/index.ts`：44 个 `export * as <Vendor>`；目录内共 112 个 `.ts` 文件，其余是 `providers/<vendor>/<modality>.ts` 子入口别名。
- `providers/settings.ts`：`toConfig` 把扁平 settings 拆成连接键（apiKey/baseURL/headers/body）与 providerOptions；`bearerRouteDefaults` 生成 endpoint + Bearer auth。
- `provider-package.ts`：`ProviderPackage.Model<Settings, Options>` / `Settings`，是各包 `model(modelID, settings)` 的统一签名。
- `schema/options.ts`：`LanguageModel`（id/provider/route/options/capabilities/compatibility）、`Capabilities`、`LanguageModelCompatibility`、`ProviderOptions`/`ProviderMetadata`。

## 边界

- **不做模型目录**：哪个模型存在、上下文多大、支持什么能力，来自 models.dev，由 Core（`core/provider-models`）解析后塞进 `LanguageModel.capabilities/compatibility`；本包只消费。
- **不做鉴权来源**：provider 只声明「从哪个 env var 取、用 Bearer 还是自定义头」，密钥解析/权限/OAuth 都在 Core（packages/ai/AGENTS.md：Auth、permissions、plugins、orchestration 属于 Core）。
- **不实现协议**：body 构造与流式事件映射在 `ai/protocols`；provider 重新实现协议即为违规（AGENTS.md「Reuse protocols」）。
- 不做重试/超时策略：那是 `ai/routing` 与 Core 的事。

## 入口与调用链

```
Core 解析出 provider+model（models.dev + 用户配置）
  → providers/<vendor>.ts: configure(settings).model(modelID)
  → route.with({ endpoint: { baseURL }, auth, ...RequestOptions })
  → Route.model({ id, capabilities, compatibility })         // route/client.ts makeRouteLanguageModel
  → LanguageModel.make({ id, provider, route, options, capabilities, compatibility })
  → 交给 ai/routing 的 LLMClient.stream/generate
```

- 典型最小形态见 `providers/deepseek.ts`：`Route.make({ protocol: OpenAIChat.protocol, endpoint: Endpoint.path("/chat/completions", { baseURL }), framing })` → `configure` 里 `route.with(bearerRouteDefaults(input, "DEEPSEEK_API_KEY", baseURL))` → `model()`。
- 需要多形态的 provider 会暴露多个选择器（`providers/openai.ts`：responses / chat / image / speech / transcription / decision），它们共享同一份 auth 与 baseURL，但可各自加默认 providerOptions（`providers/openai-options.ts`）。
- 兼容基座：`providers/anthropic-compatible.ts`、`providers/openai-compatible.ts` 被官方 provider 与第三方复用；改它们等于改一批厂商。
- 子入口 `providers/<vendor>/<modality>.ts` 只做 re-export（如 `export { chatModel as model } from "../openai.js"`），`package.json` 的 `exports` 为每个子路径建了一行。

## 数据与状态

无持久化。关键对象都是不可变值：

- `Route`：`route.with(patch)` 返回**新** route（`route/client.ts` 的 `build`），`options` 用 `mergeRequestOptions` 逐层合并。
- `LanguageModel`：`LanguageModel.make` 时把 `route.options` 作为预设合并到 `model.options` 之下（route 选项在下，model 选项在上）。
- `ProviderID`/`ModelID`/`RouteID`/`ProtocolID`：品牌化字符串（`schema/ids.ts`），构造一次、到处比较。
- 因此「模型」可以安全缓存复用，重启不需要恢复任何状态；恢复只涉及配置与密钥重新解析。

## 关键不变式

- **前向兼容/未知值透传**（packages/ai/AGENTS.md）：字符串枚举一律 `OpenString<Known> = Known | (string & {})`（`ProviderShared.knownString` 同义），provider options 用 `ProviderOptions = Record<string, unknown>` + `Schema.StructWithRest`；只有 OpenCode 真正按值分支的字段才用闭合 literal。未知 provider 事件/状态/枚举值必须忽略或透传，不得让请求失败。
- **一个规范数据模型**（AGENTS.md）：`schema/options.ts` 的 Schema class 就是模型数据模型，不允许加平行结构或第二条构造路径。
- **复用协议**（AGENTS.md）：新 provider 只能 `Route.make({ protocol: Existing.protocol, ... })`，不许复制协议。
- `apiKey: false` 语义：`AuthOptions.apiKey` 直接返回 `Auth.none`，既不查 env 也不发鉴权头（`route/auth-options.ts`）。
- `Route.model()` 要求 route 有 `endpoint.baseURL`，否则抛 `ProviderConfigurationError`；每个 provider 必须给默认 baseURL 或要求调用方传。
- `providerMetadataKey`（如 `deepseek`/`vertex`/`anthropic`）决定响应 `providerMetadata` 的命名空间；`Route.with({ provider })` 未显式给 key 时会自动改用新 provider 名。

## 扩展点

- **加一个 provider**：`providers/<vendor>.ts` 导出 `id`（`ProviderID.make`）、可选 `routes`、`configure(input)`、`model`（`ProviderPackage.Model`）→ `providers/index.ts` 加 `export * as <Vendor>` → `packages/ai/package.json` 的 `exports` 加 `./providers/<vendor>` → 需要模型元数据再去 Core 侧注册。
- **加一个形态入口**：`providers/<vendor>/<modality>.ts` 一个 re-export 行 + 一行 exports。
- **加共享连接约定**：改 `providers/settings.ts`（`toConfig`/`bearerRouteDefaults`）会同时影响所有使用者，属于破坏面较大的改动。
- **加能力字段**：改 `schema/options.ts` 的 `Capabilities`/`LanguageModelCompatibility`，并同步读它的协议（`ai/protocols`）与 Core 的 models.dev 映射。

## 常见改法与坑

- 在 provider 文件里写密钥解析或权限判断 → 绕过 Core 的集中管理；只该用 `AuthOptions.*`/`Auth.*` 声明。
- env var 名写在两处会漂移：`bearerRouteDefaults(input, "DEEPSEEK_API_KEY", baseURL)` 的第二个参数是唯一来源。
- 在 facade 里硬编码能力（「这个模型支持 tools」）→ 会被 models.dev 覆盖或与真实能力漂移；能力走 `capabilities` 入参。
- `anthropic.ts` 走的是 `anthropic-compatible.ts` 基座：改基座会连带影响 Vertex Messages / 其它 Anthropic 兼容部署。
- `openai-compatible.ts` 的 `baseURL` 是必填，`provider` 默认 `openai-compatible`，但 `id` 会跟着 `provider` 变——按 `id` 做分支会踩空。
- `google-vertex.ts` 用 `Endpoint.path(({ request }) => ...)` 把 model id 拼进 URL，并在 `headers` 里读 `providerOptions.serviceTier`；这类「请求相关 header」不要挪到静态 headers。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/ai/src/providers/index.ts` | 44 个 provider 命名空间总表 |
| `packages/ai/src/providers/settings.ts` | `toConfig` 拆连接键、`bearerRouteDefaults` 生成 endpoint+auth |
| `packages/ai/src/providers/deepseek.ts` | 最小 facade 范例：Route.make + configure + model |
| `packages/ai/src/providers/openai.ts` | 多选择器（responses/chat/image/speech/transcription/decision）+ hosted tool |
| `packages/ai/src/providers/anthropic-compatible.ts` | Messages 协议的兼容部署基座 |
| `packages/ai/src/providers/openai-compatible.ts` | baseURL 必填的通用兼容 provider |
| `packages/ai/src/providers/openai-options.ts` | providerOptions 白名单 + GPT-5 默认值 |
| `packages/ai/src/providers/google-vertex.ts` | URL 拼 model id、按请求注入 header、包一层 body.from |
| `packages/ai/src/providers/settings.ts` | 连接键与 providerOptions 的唯一拆分点 |
| `packages/ai/src/provider-package.ts` | `ProviderPackage.Model`/`Settings` 签名 |
| `packages/ai/src/schema/options.ts` | LanguageModel/Capabilities/Compatibility/ProviderOptions |
| `packages/ai/src/schema/ids.ts` | ProviderID/ModelID/RouteID/ProtocolID 品牌类型 |
| `packages/ai/src/providers/<vendor>/<modality>.ts` | 子入口别名（只 re-export） |
