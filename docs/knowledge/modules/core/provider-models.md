---
id: core/provider-models
title: 模型与 Provider 适配
level: L1
layer: core
status: stable
paths:
  - packages/core/src/provider.ts
  - packages/core/src/model.ts
  - packages/core/src/model-resolver.ts
  - packages/core/src/model-retry.ts
  - packages/core/src/aisdk.ts
  - packages/core/src/aisdk-native.ts
  - packages/core/src/usage-limits.ts
  - packages/core/src/models-dev
  - packages/ai/src
symbols:
  - Provider
  - Model
  - AISDK
  - ModelResolver
  - UsageLimits
  - mergeCapabilities
config_keys:
  - providers
  - model
depends_on:
  - contracts/config-flag
  - core/location-instance
related:
  - core/session-execution
  - core/credential-oauth
keywords:
  - 模型
  - provider
  - ai sdk
  - 路由
  - 重试
  - 推理
  - models.dev
source_hash: 1506fa26d2c05ceed317f19445cacb487da805cc
---

## 职责

两层职责：**core 层**负责"这个会话该用哪个 provider/model、怎么拿到它的客户端、怎么重试、怎么读限额"；**`packages/ai`** 负责"一次模型调用的完整协议适配"（provider 组合 protocol、流式事件、图像/语音、压缩检查点）。

## 边界

- `packages/ai` 与 Session 无关：鉴权、权限、插件、编排都在 core。`ai.stream`/`ai.generate` **只跑一次模型调用**。
- 不在这里做上下文压缩（`session/compaction`）与工具循环（`session/runner`）。
- 配置读取走 `Config.latest`，不要自己解 `providers` 树。

## 入口与调用链

```
SessionRunner → ModelResolver（agent/model 配置 + 变体）→ Provider 取客户端
            → AISDK / AISDKNative（aisdk:<包名> 前缀）→ packages/ai 的 route/executor
            → llm.stream（单次调用）→ 事件流回 session
```

- `Provider.AISDK_PREFIX = "aisdk:"`：provider id 带此前缀表示"用 AI SDK 官方包"，`packageName()` 解析出包名，运行时 `importModule` 动态加载。
- `models-dev/` 提供 `models.dev` 的快照数据（模型能力、上下文长度、价格），`usage-limits.ts` 处理限额。

## 数据与状态

- `Model.Family / VariantID / ReasoningField / Capabilities / Compatibility` 都是 schema 层类型；`mergeCapabilities` 把配置上的部分能力叠加到基线模型上（未设置项取默认）。
- provider 列表是 Location 作用域的 `State`（由配置 + 集成连接 + credential 组成），改动后通过 Bus 通知，`freeze` 防止下游误改。
- `packages/ai` 的规范数据模型在 `ai/src/schema/`：**只有一套 canonical model**，不要新增并行形状或第二条构造路径。

## 关键不变式

- **向前兼容**：未知 provider 事件/状态/枚举值不能导致请求失败，只能忽略或透传；只对文档化形状里的错误、已知类型的畸形值、缺失终止事件报错。
- **复用协议**：新 provider 用 `Route.make(...)` 组合已有 protocol，不要复制一份。
- **一套 API 两个运行时**：`@opencode/ai`（Promise）与 `@opencode/ai/effect` 的命名/签名/选项必须一致（除 Promise 侧多 `signal`），`test/promise-parity.types.ts` 守着这条。
- **代码风格**：用 `HttpClient`/`Stream`/Schema 编解码，不用裸 `fetch`、async generator、`JSON.parse` 直读；`return yield* new MyError(...)` 而非 `Effect.fail`。
- provider cassette 测试默认回放，不需要 API key；录制会带易变 ID，只重录改动的那个。

## 扩展点

- **加一个 provider**：`ai/src/providers/<name>.ts`（用已有 protocol 组合）→ 在 provider 注册/目录里登记 → 补 cassette 测试 → 需要鉴权时挂 `Integration`/`Credential`。
- **加一个 protocol**：`ai/src/protocols/<name>.ts`，同时考虑 stream 事件映射与错误形状。
- **加模型能力**：schema `model` 的 `Capabilities` 加字段 → `mergeCapabilities` 默认值 → 使用点（工具/推理/图像）读取。

## 常见改法与坑

- 在 `packages/ai` 里 import core 的任何东西 → 违反依赖方向（ai 必须与 session 解耦）。
- 只加 Promise 侧实现忘了 effect 侧，parity 测试会挂。
- 模型能力用 enum 硬编码而非 `Known | (string & {})`，上游新增值会导致请求失败。
- 改 `usage-limits` 会同时影响 provider 选择与 UI 的限额提示。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/provider.ts` | provider 状态、aisdk 前缀解析、动态加载 |
| `packages/core/src/model.ts` | 模型能力合并、变体、家族 |
| `packages/core/src/model-resolver.ts` | 会话/agent → 具体模型 |
| `packages/core/src/model-retry.ts` | 重试策略 |
| `packages/core/src/usage-limits.ts` | 限额读取 |
| `packages/ai/src/index.ts` | 对外 API（Promise 入口） |
| `packages/ai/src/route/` | 路由与执行器、压缩请求 |
| `packages/ai/src/providers/`、`protocols/` | 提供方与协议适配 |
| `packages/ai/src/schema/` | canonical 数据模型 |
