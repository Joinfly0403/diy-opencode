---
id: contracts/httpapi-protocol
title: 协议与 HttpApi
level: L0
layer: contracts
status: stable
paths:
  - packages/protocol/src
  - packages/protocol/openapi.json
  - packages/server/src/api.ts
  - packages/server/src/routes.ts
  - packages/server/src/handlers.ts
  - packages/server/src/handlers
  - packages/httpapi-codegen/src
  - packages/client/script
symbols:
  - Api
  - createRoutes
  - createEmbeddedRoutes
  - handlers
depends_on:
  - core/location-instance
  - contracts/config-flag
related:
  - cli/commands
  - client/sdk-transports
keywords:
  - HttpApi
  - protocol
  - openapi
  - 端点
  - handler
  - sdk 生成
  - experimental
source_hash: 5dedac8ca62eccc7d4b91c575dc382edb8c4753d
---

## 职责

HTTP 契约的单一来源：`packages/protocol/src/groups/*`（37 个组）用 Effect HttpApi 描述端点，`server` 侧只做实现绑定与路由装配，`client`/`sdk` 侧由 codegen 从同一份定义生成。

## 边界

- `protocol` 不得依赖 `core`/`server`（依赖方向硬约束：`schema → core|protocol → server`）。
- 业务逻辑不在 handler 里展开——handler 是薄适配层，真正的实现在 `packages/core`，按能力找对应卡。
- 生成的客户端代码（`packages/client/src/effect/generated` 等）**不要手改**。

## 入口与调用链

1. `packages/server/src/api.ts`：`Api = makeDefaultApi({...})` 汇总所有 protocol group。
2. `packages/server/src/handlers.ts`：`handlers = Layer.mergeAll(...)`，把每个 `*Handlers` 实现层合并。
3. `packages/server/src/routes.ts`：`createRoutes` / `createEmbeddedRoutes` 把 HttpApi 转成实际路由（embedded 用于桌面内嵌）。
4. `packages/server/src/handlers/*.ts`（38 个）与 `protocol/src/groups/*.ts`（37 个）**一一对应**；新增端点两边都要动，名字要对齐。
5. 生成链是**两条独立命令**（仓库没有根级 generate 脚本）：client/sdk 侧在 `packages/client` 跑 `bun run generate`（产物 `src/{promise,effect}/generated`、`src/effect/api`，`--check` 校验）；`openapi.json` 由 `packages/protocol/script/generate-openapi.ts` 从 `ClientApi` 生成，`--check` 做字节比对。

## 数据与状态

- `packages/protocol/openapi.json` 是生成物（`.gitattributes` 标记 `linguist-generated`），随协议变更提交。
- experimental 端点的命名规则：路径 `/api/experimental/<group>/<method>`，identifier `experimental.<group>.<method>`，SDK 命名空间 `client.experimental.<group>.<method>`，描述必须含 "Experimental: may change without compatibility guarantees."；`packages/protocol/test/experimental-identifiers.test.ts` 双向校验路径与 identifier 一致。

## 关键不变式

- 改协议必须重新生成**两处**：client/sdk（`packages/client` 的 `generate`）与 `openapi.json`（protocol 的 `generate-openapi.ts`）。少跑一个，类型可能仍通过而产物已与协议不一致。
- 稳定端点上的新字段放 `experimental` 键下；新端点/新默认行为一律先 experimental。
- 破坏性移动已发布的 SDK/插件 API 时保留旧路径的 `@deprecated` 别名直到下一个 minor，别手写，靠 codegen 的 `aliases` 选项。
- `packages/protocol/test/*` 有契约测试，改 group 先跑它。

## 扩展点

- **加一个端点**：`protocol/src/groups/<domain>.ts` 加定义 → `server/src/handlers/<domain>.ts` 实现 → 需要时更新 `server/src/routes.ts` → `packages/client` 跑 `bun run generate`，同时跑 `packages/protocol/script/generate-openapi.ts` → 提交 `openapi.json` 与生成物。
- **加一个 group**：同时加 protocol group + server handler + 在 `api.ts`/`handlers.ts` 注册。
- **嵌入式宿主**：走 `createEmbeddedRoutes`，桌面端不要把 `createRoutes` 复制一份。

## 常见改法与坑

- handler 名与 group 名不一致时编译期发现不了，只有运行时 404；改名前先 grep 两边。
- `packages/httpapi-codegen` 是生成器本体，改它要跑全部生成物并检查 diff。
- 事件流端点（`server/src/event-feed.ts`）不是普通 group，见 `server/event-feed` 卡。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/protocol/src/groups/*.ts` | 37 个端点组定义 |
| `packages/protocol/openapi.json` | 生成出的 OpenAPI |
| `packages/server/src/api.ts` | `Api` 汇总 |
| `packages/server/src/handlers.ts` | handler 层合并 |
| `packages/server/src/routes.ts` | 路由装配（含 embedded） |
| `packages/httpapi-codegen/src` | 客户端/SDK 代码生成器 |
