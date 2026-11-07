---
id: util-runtime/misc
title: util 基础运行时与辅助包（identity / function / http-recorder）
level: L2
layer: util-runtime
status: stable
paths:
  - packages/util/src
  - packages/identity
  - packages/function/src
  - packages/http-recorder/src
symbols:
  - Teardown
  - Observability
  - HttpRecorder
  - encode
  - pending
depends_on:
  - core/platform-foundations
related:
  - runtime/process-lifecycle
  - ai/protocols
keywords:
  - util
  - LayerNode
  - app-node
  - Global
  - Teardown
  - 观测
  - flock
  - http-recorder
  - cassette
source_hash: 254d2d060db7229621110ff686d6360272f3fc09
---

## 职责

全仓共享的**基础设施包**，不含业务：

| 包 | 内容 |
| --- | --- |
| `packages/util/src` | Effect 集成层（`layer-node`、`app-node`、`app-node-platform`）、`Global`（全局路径/配置根）、`Teardown`（关闭台账）、`Observability`（OTLP 导出）、`runtime-import`（bun/node/workerd 条件加载）、文件与进程工具（`fs-util`、`path`、`glob`、`process-signal`、`cross-spawn-spawner`、`flock`、`effect-flock`）、`retry`、`hash`、`base64`、`qr`、`heap-snapshot`、`npm`/`npm-config`、会话文本工具（`session-title-fallback`、`session-mention`、`session-turn`） |
| `packages/identity` | 纯静态资产（id/identity 数据），没有运行时代码 |
| `packages/function` | 小的 Worker 侧 API（share/github 端点），供部署时使用 |
| `packages/http-recorder` | HTTP cassette 录制/回放（redaction、匹配、diff），AI provider 测试的回放基础 |

## 边界

- 这里只放**与产品语义无关**的工具；任何依赖 session/tool/permission 的东西都在 `packages/core`。
- `packages/util` 被几乎所有包依赖，改它的公开 API 等于全仓改。
- `http-recorder` 只服务测试，不进生产路径。

## 入口与调用链

- `LayerNode`/`app-node` 是"服务图层"的构造原语：`LayerNode.group(...)` + `makeLocationNode` / `makeGlobalNode`（见 `core/location-instance`）。
- `Global` 提供配置根/缓存根（`Global.Service`、`Global.layerWith({ config })`），CLI 启动时按 `OPENCODE_CONFIG_DIR` 替换。
- `Teardown.track/pending` 被 `ShutdownDeadline` 读取：关闭超时会打印 pending 台账（见 `runtime/process-lifecycle`）。
- `Observability.layer({ endpoint, headers, client, version, channel })` 在 CLI 入口装配 OTLP 导出。

## 数据与状态

- `Global` 的路径由环境变量与平台决定（Linux 下 `~/.config`/`~/.cache`）。
- `flock`/`effect-flock` 提供跨进程互斥（自更新、服务注册都用它）。
- `http-recorder` 的 cassette 是 JSON 文件，存在测试 fixtures 下。

## 关键不变式

- `runtime-import` 是 bun/node 条件加载的**唯一**入口，不要在业务代码里写 `process.versions.bun` 分支。
- `Teardown.track` 必须在资源获取成功后立刻登记，否则关闭超时报告里看不到它。
- `layer-node` 的顺序语义由调用方（`Instance.graph`）决定，工具层不排序。
- 改 `Global` 的路径派生会同时影响配置、缓存、数据库文件位置。

## 扩展点

- **加一个通用工具**：`packages/util/src/xxx.ts`，被多包使用时才提取。
- **加一个外部 HTTP 录制场景**：`packages/http-recorder/src` 的 matching/redaction，配套 provider 测试。
- **加观测后端**：`util/src/otlp.ts`。

## 常见改法与坑

- `packages/util` 里的模块大多被 `packages/core` 直接 import，循环依赖很容易在这里产生。
- `qr`/`hash`/`base64` 这类小工具在多处重复实现过，改之前先搜一遍。
- `http-recorder` 的 redaction 一旦泄漏真实 token，测试夹具会带进仓库。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/util/src/layer-node.ts`、`app-node.ts` | 服务图层构造原语 |
| `packages/util/src/global.ts` | 配置根/缓存根 |
| `packages/util/src/teardown.ts` | 关闭台账 |
| `packages/util/src/observability.ts`、`otlp.ts` | OTLP 导出 |
| `packages/util/src/runtime-import.ts` + `import.{bun,node,workerd}.ts` | 条件加载 |
| `packages/util/src/fs-util.ts`、`path.ts`、`glob.ts` | 文件工具 |
| `packages/util/src/flock.ts`、`effect-flock.ts` | 跨进程互斥 |
| `packages/util/src/retry.ts`、`hash.ts`、`base64.ts`、`qr.ts` | 杂项工具 |
| `packages/util/src/heap-snapshot.ts`、`process-signal.ts` | 进程诊断 |
| `packages/http-recorder/src/cassette/*`、`replay/*` | cassette 录制/回放 |
| `packages/function/src/*` | Worker 侧小 API |
