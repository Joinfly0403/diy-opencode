---
id: schema/core-model
title: 共享数据模型（Schema 顶层契约）
level: L0
layer: schema
status: stable
paths:
  - packages/schema/src/*.ts
symbols:
  - Identifier
  - ascending
  - descending
  - SessionID
  - ProjectID
  - WorkspaceID
  - AbsolutePath
  - RelativePath
  - optional
  - statics
  - withStatics
  - DateTimeUtcFromMillis
  - Event
  - durable
  - ephemeral
  - inventory
  - latest
  - versionedType
  - durableMap
  - Location
  - Permission
  - Tool
  - Session
  - SessionMessage
  - Prompt
  - PromptInput
tests:
  - packages/schema/test/contract-hygiene.test.ts
  - packages/schema/test/event.test.ts
  - packages/schema/test/event-manifest.test.ts
  - packages/schema/test/session-cursor.test.ts
  - packages/schema/test/compatibility.test.ts
depends_on:
related:
  - contracts/httpapi-protocol
  - contracts/events-db
  - schema/v1-compat
keywords:
  - schema
  - 数据模型
  - 契约
  - Schema.Class
  - identifier
  - brand
  - 事件定义
  - 依赖方向
source_hash: a8a3bd8728531f4f7328349cd81a94261c22563c
---

## 职责

全仓唯一的 wire / storage 契约层：只描述形状与校验，不含运行时行为。protocol、server、core、client、sdk 全部从 `@opencode/schema/<domain>` 直接导入同一份值（不是复制一份），因此它是依赖图的最底层。

- **ID 与品牌**（`identifier.ts`、`session-id.ts`、`project-id.ts`、`workspace-id.ts`、`integration-id.ts`）：`Identifier.ascending/descending` 是 26 字符 ID 生成器（6 字节毫秒时间前缀 + 计数器 + 随机），各域用 `Schema.String.check(Schema.isStartingWith(prefix)).pipe(Schema.brand(...), statics(...))` 加前缀与 `create()`。
- **基础原语**（`schema.ts`）：`AbsolutePath`/`RelativePath`、`optional(...)`、`statics(...)`、`withStatics(...)`、`DateTimeUtcFromMillis`、`PositiveInt`/`NonNegativeInt`。
- **事件定义**（`event.ts`）：`durable`/`ephemeral` 建事件 schema，`inventory` 冻结定义清单，`latest`/`durableMap`/`versionedType` 做按 type(+version) 的索引。
- **域契约**：session / session-message / session-inbox / session-error / session-revert / session-stats / session-transfer、permission / permission-saved、tool、location、project、workspace / worktree、model / provider / llm / model-compatibility / models-dev、mcp、pty / persistent-pty / pty-ticket、file-diff、filesystem、form、question、schedule、skill、shell、snapshot、money、token-usage、usage-limits、credential、artifact、generate、goal、job、vcs、websearch、prompt / prompt-input、rpc、connection、event-log、event-manifest、durable-event-manifest、各 `*-event.ts`。
- `index.ts` 是**当前**契约的 barrel；manifest、基础设施模块与 V1 走直接入口，不进 barrel。

## 边界

- 不写服务层、副作用、运行时注册表；域包（`@opencode/core/<domain>`）可以包一层 facade，但必须**再导出完全相同的 schema 值**，不允许出现第二份 schema 身份（`packages/schema/AGENTS.md`）。
- 依赖方向只有 `schema ← protocol ← server`；core 同样只依赖 schema。schema 不 import 任何 OpenCode 包。
- browser-safe：这里只能是可序列化的契约定义，不能带上 host-local 实现细节。
- 当前契约与 V1 分离：V1 在 `src/v1/`，当前源码不得直接 import 它（见 `schema/v1-compat`）。
- 只放"为了 SDK 生成必须公开的最小 wire 契约"（例：`plugin.updated` 的事件 payload 在 schema，插件运行时不在）。

## 入口与调用链

所有消费者都直接进子路径，没有中间层：

```
@opencode/protocol/src/groups/*  → 用 Schema 类型描述端点 payload
@opencode/server/src/handlers/*  → 用同一 Schema 校验/编码
@opencode/core/src/<domain>      → 运行时模型 + 同名 facade（再导出同一值）
@opencode/client · @opencode/sdk → 导入类型；sdk/src/contracts.ts、client/src/effect/index.ts 做公共再导出
packages/client/script/generate.ts → namespaceTypes(...) 列出"会出现在 HTTP 契约里的 Schema 命名空间"
```

`generate.ts` 里那份 `effectTypeReferences` 清单是反向线索：某个 Schema 命名空间出现在里面，说明它的类型已经进入公开 HTTP 契约，改名/改形状就是破坏性变更。

## 数据与状态

- **ID**：`Session.ID` = `"ses_" + descending()`，`Event.ID` = `"evt_" + ascending()`，`Permission.ID` = `"per_" + ascending()`，`Project.ID.global` = `"global"`，`Workspace.ID` 前缀 `wrk_`。生成器里 `descending` 对时间戳取反，因此新 ID 排序靠前（会话列表天然倒序）。
- **事件信封**：durable 事件带 `durable: { aggregateID, seq, version }`，ephemeral 没有；`Event.Seq` 非负、`Event.Version` ≥ 1，两者都是 brand。
- **时间**：`DateTimeUtcFromMillis` 在编解码边界做 `number ↔ DateTime.Utc` 转换（存储/传输用毫秒数，域内用 DateTime）。
- **可选字段**：`optional(...)` = `optionalKey` + 编码时过滤 `undefined`，让"未设置"不落成 `"key": null` 或 `"key": undefined`。裸 `Schema.optional` 只在需要保留 `undefined` 编码时用（`session.ts` 的 list 查询参数就是特例，为了不动 OpenAPI 参数形状）。
- **分页游标**：`Session.ListCursor` 是品牌化字符串，内部是 Base64Url 编码的 JSON（过滤条件 + `ListAnchor`），`make`/`parse` 挂在 statics 上。

## 关键不变式

- **一个契约一个导出值**：禁止 `PluginID`/`PtyEvent` 这类桥接别名；用命名空间成员（`Plugin.ID`、`Question.Info`）。
- **Schema.Class 只给需要构造语义的域值**（如 `Location.Info`、`Tool.Error` 这类 TaggedError）：它给你 `new`/`make` 与原型方法。普通公共记录用 `Schema.Struct` + 同名 `interface`（`export interface Info extends Schema.Schema.Type<typeof Info> {}`），这样类型是结构化的、可自由构造（`client/test/contract-identity.test.ts` 断言 DTO 原型是 `Object.prototype`）。
- **ID 校验必须精确匹配自己发出的前缀**（含下划线）；但不需要为了"更严"去收紧既有宽松校验（AGENTS.md 明确禁止无迁移决策的收紧）。
- **公共 schema 要有唯一稳定 identifier**（`Session.Info`、`Model.Ref`、`Tool.Content`…）；一次性内嵌结构可以匿名。identifier 泄漏到 OpenAPI 组件名，改动等于改公开 API。
- **编码形状即 wire 形状**：`Schema.toEncoded` 是 HTTP body 与 DB 列的真身；改 encode 侧等于改协议。
- **默认只读**：公共契约不加 `Schema.mutable`；需要可变的运行时在边界用 `Types.DeepMutable` 之类的显式转换。
- **未知值克制**：用 `Schema.Json`/`Schema.Unknown`，不要 `Schema.Any`（`contract-hygiene.test.ts` 会查当前契约）。
- **当前 barrel 不导出 V1**；`index.ts` 只列当前域（特殊模块走直接入口）。

## 扩展点

- **加一个域契约**：`packages/schema/src/<domain>.ts`，首行 `export * as Domain from "./<domain>.js"` → 加进 `index.ts` → 需要出现在 HTTP 契约里就在 `packages/client/script/generate.ts` 的 `effectTypeReferences` 里加 `namespaceTypes` → 在 client/protocol 侧跑生成 → 需要公共再导出就加到 `sdk/src/contracts.ts` 与 `client/src/effect/index.ts`。
- **加一个 durable 事件**：`durable({ type, identifier?, durable: { version, aggregate }, schema })` → 注册进对应的 `inventory(...)` → 再看 `event-manifest` / `durable-event-manifest` 是否需要登记 → 投影侧见 `contracts/events-db`。
- **加一个 ID 类型**：优先内联进所属契约模块；只有为了打断真实循环/重依赖时才单独建 `<name>-id.ts`（AGENTS.md）。
- **改可选语义**：只动 `schema.ts` 的 `optional`/`DateTimeUtcFromMillis` 会波及全仓，属于高爆炸半径改动。

## 常见改法与坑

- 在 schema 里写运行时逻辑（缓存、IO、服务层）→ 立刻污染所有下游包的可测试性与 browser 打包。
- 复制 schema 到 core 建"第二份真相"（`SessionSchema`、`AgentSchema` 这类别名）→ AGENTS.md 明确禁止，必须再导出同一值。
- 改了 `Schema.toEncoded` 的形状却没跑 client/protocol 生成 → 类型能过、运行时字段对不上。
- 给既有字段改名或改 identifier → OpenAPI 组件名与生成客户端类型一起变，属于破坏性变更（发版规则见 `contracts/httpapi-protocol`）。
- 用 `Schema.optional` 替代 `optional(...)`，会让 `undefined` 进入编码结果，前端 JSON 出现 `null`/`undefined` 键。
- 把 V1 事件（`message.updated`、`message.part.*`）塞进当前 manifest → 违反 `packages/schema/AGENTS.md` 的事件分类规则。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/schema/src/index.ts` | 当前契约 barrel（不含 V1 / manifest / 基础设施） |
| `packages/schema/src/schema.ts` | `AbsolutePath`/`RelativePath`、`optional`、`statics`、`DateTimeUtcFromMillis` |
| `packages/schema/src/identifier.ts` | 26 字符 ID 生成（ascending/descending） |
| `packages/schema/src/session-id.ts`、`project-id.ts`、`workspace-id.ts` | 品牌化 ID 与其 `create()` |
| `packages/schema/src/event.ts` | `durable`/`ephemeral`/`inventory`/`latest`/`durableMap` |
| `packages/schema/src/event-manifest.ts`、`durable-event-manifest.ts` | 事件清单（走直接入口） |
| `packages/schema/src/session.ts` | `Session.Info`、`ListFilter`、`ListCursor` |
| `packages/schema/src/session-message.ts` | 消息联合（assistant/tool/compaction…） |
| `packages/schema/src/tool.ts` | `Tool.Info`/`Content`/`Error`/`CallID` |
| `packages/schema/src/permission.ts` | `Request`/`Rule`/`Ruleset` 与两个事件 |
| `packages/schema/src/location.ts` | `Ref`/`PublicRef`/`Info`/`response()` 信封 |
| `packages/schema/src/v1/` | V1 契约（见 `schema/v1-compat`） |
