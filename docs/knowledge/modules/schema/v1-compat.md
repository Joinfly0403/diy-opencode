---
id: schema/v1-compat
title: V1 兼容层与旧数据迁移
level: L2
layer: schema
status: transitional
paths:
  - packages/schema/src/v1
  - packages/schema/src/session-v1.ts
  - packages/schema/src/permission-v1.ts
  - packages/schema/src/filesystem-v1.ts
  - packages/schema/src/legacy-event.ts
  - packages/core/src/v1
  - packages/core/src/database/v1-migration.ts
  - packages/core/src/database/v1-migration.bun.ts
  - packages/core/src/database/v1-migration.noop.ts
symbols:
  - SessionV1
  - PermissionV1
  - FileSystemV1
  - LegacyEventV1
  - ConfigAgentV1
  - ConfigCommandV1
  - ConfigMCPV1
  - ConfigPermissionV1
  - ConfigPluginV1
  - ConfigProviderV1
  - ConfigMigrateV1
  - normalizeAction
  - migrateAgent
  - V1Migration
  - transformSession
  - SourceMessage
  - Status
  - Warning
tests:
  - packages/schema/test/v1-isolation.test.ts
  - packages/schema/test/legacy-event.test.ts
  - packages/core/test/v1-migration.test.ts
  - packages/schema/test/session-legacy.test.ts
  - packages/schema/test/credential-legacy.test.ts
depends_on:
  - schema/core-model
  - contracts/events-db
related:
  - contracts/config-flag
keywords:
  - V1
  - 兼容层
  - 迁移
  - migration
  - legacy
  - 旧库
  - 删除时机
source_hash: d45d82bf1fd31925dbe7ac8a602f00ba47fdfa9e
---

## 职责

两件事，常被混为一谈，这里分开说：

1. **V1 契约**（`packages/schema/src/v1/`）：上一个架构的 session / message / part / permission / filesystem 事件的 schema，只用于**读旧数据**与**迁移**，标识符统一带 `V1`（`SessionV1.MessageID`、`PermissionV1.Request`、`FileSystemV1.Event`、`LegacyEventV1.CommandExecuted`）。
2. **旧数据迁移**：把旧库里 `session`/`message`/`part` 行折叠成当前 `SessionMessage`（`packages/core/src/database/v1-migration*.ts`），以及把旧配置文档升级成当前 `Config`（`packages/core/src/v1/config/migrate.ts`）。

## 边界

- **当前源码不得直接 import `src/v1/`**：`packages/schema/test/v1-isolation.test.ts` 扫描 `src/*.ts`，只允许 4 个桥接文件例外（`session-v1.ts` / `permission-v1.ts` / `filesystem-v1.ts` / `legacy-event.ts`，各自一行 `export * from "./v1/....js"`）。
- 桥接文件必须保持**同一个值身份**（同测试断言 `SessionV1` 等在桥与子树里 `toBe` 相等）——不要再包一层或复制定义。
- V1 事件不进当前 Protocol/SDK 的事件面；`message.updated`、`message.part.*` 一类只在兼容面存在。
- `packages/core/src/v1/` 目前只有配置迁移（agent / command / mcp / permission / plugin / provider / provider-options / migrate），只被 `core/src/config/normalize.ts` 与 `core/src/config/plugin/agent.ts` 使用。
- **别把"pre-v2.1 的当前架构遗留"当成 V1**：`packages/schema/src/session-legacy.ts`、`credential-legacy.ts` 是当前架构的旧字段名/旧默认值的升级器（文件头注释明确写 "not V1 contracts"），它们不在 `src/v1/`，也不该被搬进去。

## 入口与调用链

```
旧数据来源（两条，都要处理）：
  A. Global.data/opencode-next.db —— 只读打开，isNextDatabase() 校验不通过就跳过；OPENCODE_DB=:memory: 时整条跳过
  B. 本库里仍留着的旧 session 表行
      │  core/src/database/v1-migration.bun.ts
      │    status() / run() / transformSession()
      ▼
当前架构表：session_v2（SessionTable 的真实表名）+ 折叠后的 message/part（SessionMessage）；project 行按需补建

迁移服务装配：packages/server/src/routes.ts
      Api 层与 V1Migration.layer merge（services 一并 provide）
HTTP 暴露：packages/server/src/handlers/migration.ts → "migration.v1.status"

配置侧：core/src/config/normalize.ts → ConfigMigrateV1.migrateAgent / migrateCommand / ...
        （旧 permission 键 → 新 action：write|patch|apply_patch→edit、task→subagent、bash→shell）
```

## 数据与状态

- `V1Migration.status()` 返回 `"required" | "completed" | "running"(带 progress) | "error"(带 message)`；状态来源有两个：库里的持久状态 + 进程内的 `RuntimeState`（运行中/失败优先返回）。
- 持久状态写在 KV 表（key = `migration.v1-v2`）：`{ phase: "sessions", cursor }` → `{ phase: "completed" }`。`cursor` 就是断点，重跑从该 id 继续。
- `layer` 用 `Effect.effectDiscard` + `Effect.forkScoped({ startImmediately: true })` 启动迁移，**迁移失败只写日志、不阻塞服务器启动**。
- 幂等标记是 `session_v2`：源行若已在当前表存在同 id（`EXISTS (SELECT 1 FROM session_v2 WHERE session_v2.id = session.id)`）就不再重复折叠。
- 目录归属批量解析一次：V1 行若没有 project/workspace 且目录是相对路径，就改用项目 worktree 或 `Project.ID.global`；任一目录解析超时立即停止解析，其余全留 global（宁可少认领也不阻塞）。
- 迁移前会按 `EVENT_DELETE_BATCH_SIZE = 1000` 分批清空 `event` 表（旧事件与新投影不兼容），这一步与写入 KV 状态在同一个事务里，只在该 key 不存在时执行一次。
- 运行时开关在 `packages/core/package.json` 的 `imports`：`#v1-migration` 在 `bun` 下指向 `.bun.ts`，在 `node`/`workerd` 下指向 `.noop.ts`（noop 直接返回 `completed`）。`v1-migration.ts` 只是 `#v1-migration` 的再导出别名，所以 **非 bun 运行时没有迁移能力**。
- 需要 `Database`、`Global`、`Project`、`FSUtil` 四个服务；`run()` 由进程内的 `Semaphore.makeUnsafe(1)` 串行化（**不是跨进程锁**，多个 opencode 进程不会互斥）。

## 关键不变式

- **可重入**：任何时刻中断都能靠 `cursor` 续跑；`run()` 自己判断 `phase === "completed"` 与"库里还有没有旧 session"，二者任一成立就返回 completed。
- **一次性清理不可重复**：清 `event` 表只在 `state === undefined` 时执行一次，靠 KV 状态位保护。
- **不要收紧旧 ID 校验**：`PermissionV1.ID`/旧 message id 的宽松校验是兼容性的一部分（AGENTS.md：收紧需要单独的兼容与迁移决策）。
- **转换要有告警而不是抛错**：无法识别的旧 part/message 收进 `Warning[]`（`reason`/`sessionID`/`messageID`/`partID`/`observedType`），继续迁移其余数据。
- **桥接身份不变**：`packages/schema/src/session-v1.ts` 等 4 个文件必须继续 `export *`，一旦改成自定义包装就破坏 `v1-isolation.test.ts` 的 `toBe` 断言。

## 扩展点

- **新增要迁移的旧结构**：在 `packages/schema/src/v1/` 加 V1 schema（名字带 `V1`）→ 在 `transformSession`/`config/migrate.ts` 里做升级 → 补 `packages/core/test/v1-migration.test.ts` 或 `packages/schema/test/` 的行为测试。
- **新增旧配置键映射**：`core/src/v1/config/migrate.ts` 的 `normalizeAction` 与各 `migrate*` 函数；注意 `decodeOptions` 用了 `onExcessProperty: "ignore"`，未知键静默丢弃。
- **新增一个兼容 HTTP 端点**：现有 `migration.v1.status` 属于 group `server.migration`，加方法要同时改 protocol group 与 handler（见 `contracts/httpapi-protocol`）。

## 什么时候可以删

删除 `src/v1/` 子树的条件是三条同时成立（AGENTS.md：V1 coexistence is temporary）：

1. 不再有需要迁移的旧库（`hasLegacySessions` 恒为 false，或迁移版本下限已抬过）；
2. 旧协议/旧事件没有外部调用方（兼容面 App/TUI/CLI 都不再需要）；
3. 4 个桥接入口没有 import（`grep "session-v1\|permission-v1\|filesystem-v1\|legacy-event"` 只剩测试）。

届时一并删除：`src/v1/`、4 个桥接文件、`core/src/v1/`、`#v1-migration` 的 imports 映射、`v1-migration.{ts,bun.ts,noop.ts}`、`handlers/migration.ts` 与 protocol 的 `server.migration` group、`routes.ts` 里的 `V1Migration.layer`。

## 常见改法与坑

- 在 `packages/core` 里直接 `import { SessionV1 } from "@opencode/schema/session-v1"` 之外再引 `@opencode/schema/v1/session`：会绕过桥接、破坏隔离测试。
- 把 pre-v2.1 的字段升级（`session-legacy.ts`）当作 V1 迁移去改 → 两条路径混在一起，重放历史事件时会二次改写。
- 在 node/workerd 下期待迁移生效：那是 `.noop.ts`，永远返回 completed。
- 迁移里抛异常想"阻止服务启动"——`layer` 只记录错误，服务照常起来，只是 `status()` 变 `error`。
- 忘记 `event` 表清理只做一次，重复执行会把已投影的新事件也删掉。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/schema/src/v1/session.ts` | 旧 session/message/part 契约（`SessionV1.MessageID` 等） |
| `packages/schema/src/v1/permission.ts` | `PermissionV1.Request`/`Rule`/`Ruleset` 与两个事件 |
| `packages/schema/src/v1/filesystem.ts`、`v1/legacy-event.ts` | 旧 `file.edited` / `command.executed` 事件 |
| `packages/schema/src/session-v1.ts` 等 4 个 `*-v1.ts` / `legacy-event.ts` | 唯一允许的桥接入口（身份不变） |
| `packages/core/src/v1/config/migrate.ts` | 旧配置 → 当前 `Config`（含 `normalizeAction` 动作改名） |
| `packages/core/src/database/v1-migration.ts` | 别名：`export * from "#v1-migration"` |
| `packages/core/src/database/v1-migration.bun.ts` | 真实现：`status`/`run`/`transformSession`/`layer` |
| `packages/core/src/database/v1-migration.noop.ts` | node/workerd 的恒 completed 桩 |
| `packages/server/src/handlers/migration.ts` | `migration.v1.status` 薄适配 |
