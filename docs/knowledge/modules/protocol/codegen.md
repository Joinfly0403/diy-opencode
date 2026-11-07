---
id: protocol/codegen
title: HttpApi 代码生成（client / SDK / OpenAPI）
level: L1
layer: protocol
status: stable
paths:
  - packages/httpapi-codegen/src
  - packages/httpapi-codegen/test
  - packages/client/script
  - packages/protocol/script
  - packages/protocol/openapi.json
symbols:
  - compile
  - emitEffect
  - emitEffectImported
  - emitEffectShape
  - emitPromise
  - write
  - generate
  - GenerationError
  - Contract
  - Output
  - Alias
  - stabilizeOpenApi
tests:
  - packages/httpapi-codegen/test/generate.test.ts
  - packages/httpapi-codegen/test/write.test.ts
  - packages/protocol/test/openapi-stabilize.test.ts
  - packages/protocol/test/openapi-patterns.test.ts
  - packages/protocol/test/experimental-identifiers.test.ts
depends_on:
  - contracts/httpapi-protocol
  - schema/core-model
related:
  - client/sdk-transports
keywords:
  - codegen
  - 代码生成
  - HttpApi
  - OpenAPI
  - 生成物
  - generate
  - 提交约定
  - prettier
source_hash: 0545a3fcea7c1f4d8d297e43efa348209b223102
---

## 职责

把一份权威 `HttpApi` 反射成共享 `Contract`，再分别发射三种客户端产物；同时从同一份协议导出 OpenAPI 文档。

- `packages/httpapi-codegen/src/index.ts`（唯一源文件，private 包）：`compile` / `emitEffect` / `emitEffectImported` / `emitEffectShape` / `emitPromise` / `write` / `generate` / `GenerationError`。
- `packages/client/script/generate.ts`：本仓唯一调用点。跑两次 `compile`（promise / effect 各一套 omit 列表），再写三个目录。
- `packages/protocol/script/generate-openapi.ts`：`OpenApi.fromApi(ClientApi)` → `stabilizeOpenApi` → prettier → `packages/protocol/openapi.json`。
- `packages/client/script/build.ts`、`pack.ts`：生成之后才谈构建与打包（build 先 `rm -rf dist`，再 `bun tsc` + `Bun.build` 全量入口、`packages` external + splitting）。

## 边界

- 生成器**不得依赖 Core/Server**，测试只能用合成 `HttpApi` fixture（`httpapi-codegen/README.md` 的明确要求）。
- 不做端点筛选策略：哪些端点进哪个客户端，由调用方的 `omitEndpoints` 决定（`packages/protocol/src/client.ts` 的 `promiseOmitEndpoints` / `effectOmitEndpoints`）。
- 不做隐式命名映射：group 名只来自 `groupNames`，命名空间只来自 `namespace`，其余按协议原样投影（README：no other implicit product-specific naming）。
- 生成物一律不手改：`packages/client/src/{promise,effect}/generated`、`packages/client/src/effect/api`、`packages/protocol/openapi.json`。

## 入口与调用链

```
packages/protocol/src/client.ts   ClientApi = makeDefaultApi({ locationMiddleware, formLocationMiddleware, sessionLocationMiddleware })
        │
        ├── packages/client/script/generate.ts
        │     compile(ClientApi, { groupNames, omitEndpoints: promiseOmitEndpoints, namespace: clientNamespace, aliases: true })
        │     compile(ClientApi, { groupNames, omitEndpoints: effectOmitEndpoints,  namespace: clientNamespace, aliases: true })
        │     write(emitPromise(...),         ../src/promise/generated)  // types.ts / client.ts / client-error.ts / index.ts
        │     write(emitEffectImported(...),  ../src/effect/generated)   // module=../../contract, api=ClientApi, shapeModule=../api/api.js
        │     write(emitEffectShape(...),     ../src/effect/api)         // api.ts（纯类型 + typeReferences）
        │
        └── packages/protocol/script/generate-openapi.ts
              OpenApi.fromApi(ClientApi) → stabilizeOpenApi → prettier(printWidth 120) → packages/protocol/openapi.json
```

- 三次 `write` 用 `Effect.all(..., { concurrency: 3 })` 并行，跑在 `NodeFileSystem.layer` 上。
- `effectTypeReferences`（`namespaceTypes("Session", "@opencode/schema/session", Session)` 等）决定 `api.ts` 里**引用** Schema 命名空间而不是展开结构；这份清单也是"哪些 Schema 已进入公开 HTTP 契约"的反向索引。
- `emitEffect`（自带 schema 的独立客户端）在本仓只被测试和 `generate()` 用；Client 走的是 `emitEffectImported`。

## 数据与状态

生成物位置与清单（全部提交进仓库）：

| 目录 | 产物 | 清单文件 |
| --- | --- | --- |
| `packages/client/src/promise/generated` | `types.ts`、`client.ts`、`client-error.ts`、`index.ts` | `.httpapi-codegen.json` |
| `packages/client/src/effect/generated` | `client.ts`、`client-error.ts`、`index.ts` | `.httpapi-codegen.json` |
| `packages/client/src/effect/api` | `api.ts`（类型形状） | `.httpapi-codegen.json` |
| `packages/protocol` | `openapi.json` | 无（`--check` 字节比对） |

- `.httpapi-codegen.json` 记录"上次生成拥有哪些文件"；`write` 只删除**清单里有、这次没有**的文件，手写文件不会被误删。
- 所有产物与 manifest 都过 prettier（`semi: false`、`printWidth: 120`）；manifest 也格式化，避免 generate bot 统一格式后 `check:generated` 变脏。
- `aliases: true` 生成 `@deprecated` 别名：端点迁进 namespace 后，旧客户端路径与旧类型名由 codegen 产出（不是手写），保留到下一个 minor。
- `openapi.json` 在 `.gitattributes` 标 `linguist-generated`；`stabilizeOpenApi` 把 Effect 的匿名组件（`Union_3`、`Event.VersionEncoded_37`）改成"名字 + 内容 sha256 前 12 位"，并排序组件，让无关新增保持局部 diff。

## 关键不变式

- **一个端点一个成功 schema、一个 payload**：多个直接 `GenerationError`（Multiple success schemas / Multiple payload schemas）。
- **输入扁平化**：params/query/headers/payload 合并成一个输入对象，跨通道重名报 `Input field collision`；非 struct payload（union / array / primitive / 带索引签名的 record）收成单个必填 `payload` 字段，若与其它通道重名报 `Opaque payload field collision`。零字段 → 无参数；全可选 → 可选对象；有必填 → 必填对象。
- **返回形状**：只解包精确的 `{ data: A }` 信封；no-content → `void`；流式成功 → `Stream`（不是 `Effect<Stream>`）。Promise 流是惰性 `AsyncIterable`，两侧都**不自动重连**。
- **可移植性**：Effect 输出要求每个 Schema 都能"权威导入"（`assertPortable`），做不到就整体失败而不是降级。
- **路径安全**：输出路径必须扁平（不含分隔符）、大小写不敏感唯一、非绝对、不是 manifest 名；目标已存在时不允许是符号链接。
- **必须重新生成的情形**：改 `packages/protocol/src/**`（group / 端点 / payload / schema）、改 `packages/protocol/src/client.ts` 的 `groupNames`/`namespace`/omit 列表、改 `packages/schema` 里被 `effectTypeReferences` 引用的契约、改 `packages/httpapi-codegen` 本体。任一命中，两个包的生成物都要重跑。
- **CI 门禁**（`.github/workflows/check-test.yml`）：`packages/client` 跑 `check:generated`（`bun run generate && git diff --exit-code -- src/promise/generated src/effect/generated src/effect/api`）；`packages/protocol` 跑 `check:generated`（`generate-openapi.ts --check`，不一致时报 "Generated OpenAPI document is stale"）。注意这是**两条独立命令**，不是一个根脚本。

## 扩展点

- **加一种客户端形态**：加 `emitX(contract)` → 在 `generate.ts` 里多一次 `write` → 给它独立目录与 manifest。
- **改命名空间规则**：`packages/protocol/src/client.ts` 的 `clientNamespace`——按 URL 前缀 `/api/experimental` 判定（不是看 OpenAPI id），实验端点因此落在 `client.experimental.<group>.<method>`。
- **改 OpenAPI 稳定性**：`packages/protocol/script/openapi-stabilize.ts`（匿名组件内容寻址、等价副本折叠、key 排序）。
- **加 group 名映射**：`groupNames`；不映射时客户端名会带 `server.` 前缀。
- **自定义某端点输出类型名**：`emitEffectShape({ outputTypes: { "event.subscribe": ... } })`（例：`OpenCodeEvent`）。

## 常见改法与坑

- **只跑一个包的 generate**：只跑 `packages/client` 会漏 `openapi.json`；只跑 `packages/protocol` 会让客户端类型和运行时字段脱节。两个都要跑。
- 手改生成物：下次生成覆盖，且 `check:generated` 立刻红。
- 在 `generate.ts` 加 `outputTypes` 覆盖时撞名 → `Generated Effect type collides with imported type`（外部名集合含 `AppApi`/`Effect`/`Stream` 与所有 typeReference 首段）。
- 新增匿名 Schema 后 `openapi.json` diff 爆炸：通常没走 `stabilizeOpenApi`，或组件名与已有内容 hash 撞车（`Content-addressed OpenAPI component collision`）。
- 让生成器依赖 Core 来"少写类型"——违反包独立性与 fixture 测试约定。
- 删端点时忘了 alias 冲突：`Client alias collision` 会在 `compile` 阶段拦住。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/httpapi-codegen/src/index.ts` | `compile` / `emit*` / `write` / `generate` 全部实现（单文件） |
| `packages/httpapi-codegen/README.md` | 生成器契约与已定规则（扁平化、信封解包、拒绝不可移植 schema） |
| `packages/httpapi-codegen/test/generated/*` | 测试夹具产物（`.gitattributes` 固定 LF） |
| `packages/client/script/generate.ts` | 本仓调用点、`effectTypeReferences` 清单、三个输出目录 |
| `packages/client/script/build.ts`、`pack.ts` | 生成后构建 / 打包 |
| `packages/protocol/script/generate-openapi.ts` | `openapi.json` 生成与 `--check` |
| `packages/protocol/script/openapi-stabilize.ts` | 匿名组件内容寻址、副本折叠、排序 |
| `packages/protocol/openapi.json` | 提交的 OpenAPI 文档（`linguist-generated`） |
