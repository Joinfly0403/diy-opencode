---
id: contracts/events-db
title: 事件总线与持久化
level: L0
layer: contracts
status: stable
paths:
  - packages/core/src/bus.ts
  - packages/core/src/event
  - packages/core/src/database
  - packages/core/src/event-logger.ts
  - packages/schema/src/event
  - packages/schema/src/event-log.ts
symbols:
  - Bus
  - Database
  - latestSequence
  - reserveSequence
  - Service
events:
  - session.inbox.enqueued
  - session.inbox.delivered
tables:
  - event
  - event_sequence
depends_on:
  - contracts/config-flag
related:
  - core/session-execution
  - server/event-feed
keywords:
  - 事件
  - bus
  - 持久化
  - sqlite
  - drizzle
  - 投影
  - 迁移
  - sequence
source_hash: 69eb7e51ad5184690a87311a155dd4e5134af1ac
---

## 职责

两件基础设施：

1. **事件总线**（`bus.ts`）：durable 事件按聚合（aggregate）保序写入 `event` 表，并广播给订阅者（内存 `PubSub` + 跨进程的 event feed）。序号由 `event_sequence` 表按 aggregate 预留，保证"同一聚合内严格递增、不重号"。
2. **数据库**（`database/`）：sqlite（bun / node / workerd 三个驱动）+ drizzle schema + 迁移。

## 边界

- 总线不解释语义：它只保证顺序与投递；"这个事件意味着什么"由投影（projector）与读模型决定。
- 事件不是日志文本：durable 事件的 payload 走 schema 校验（`schema/durable-event-manifest`），非法 payload 会 `InvalidDurableEventError`。

## 入口与调用链

```
业务代码 → Bus.publish(type, data) → reserveSequence(aggregate) → insert event 行 → 内存 PubSub 广播
                                                    ↓
                                    projector 折叠 → 读模型表（如 session_inbox、message）
```

- `latestSequence(db, aggregateID)` / `reserveSequence(db, aggregateID, seq)` 是对外暴露的顺序原语；`onConflictDoUpdate` 里用 `max(seq)` 防回退。
- `event-logger.ts` 把事件写进结构化日志（与 `event` 表是两条路，别混）。
- 订阅侧：`Subscribe`/`Unsubscribe` 类型见 `bus.ts`；HTTP 侧的事件流在 `packages/server/src/event-feed.ts`。

## 数据与状态

- `event` 表存序列化事件（`id / type / seq / aggregate_id / data / created`），`event_sequence` 表存每个聚合的最新序号。
- `database/database.ts`：`Database.Service` + `layer(options)` + `configured()`；`sqlite.bun.ts`/`sqlite.node.ts`/`sqlite.workerd.ts` 是平台实现，`drizzle.ts` 是 ORM 绑定。
- `migration.gen.ts`、`schema.gen.ts` 由脚本生成，不要手改；`v1-migration.ts` 处理旧库（`auth.json` 等）导入。

## 关键不变式

- **durable 事件必须最小**：只记录不可再生的新事实，可折叠推导的状态不要写事件（AGENTS.md 会话核心约束）。
- 同一事务里"消费 inbox 行 + 插入可见消息"，否则重放会看到半成品。
- 聚合内序号由 `event_sequence` 决定，**不要用时间戳或自增 ID 排序**。
- 迁移必须可重入；新表要同时更新 `schema.sql.ts` 与生成物。

## 扩展点

- **加一个 durable 事件**：`schema` 里加事件定义（含 manifest 注册）→ 发布点 `Bus.publish` → 写 projector 与读模型 → 加测试（重放一致性）。
- **加一张表**：`core/src/*/sql.ts` 定义 → `bun run generate` 生成 `schema.gen.ts`/迁移 → 写投影。
- **加一个驱动**：实现 `sqlite.*.ts` 的接口并在 `database.ts` 里选择。

## 常见改法与坑

- 把推导状态也写事件，会让重放和读模型不一致（这是本仓明确禁止的）。
- `reserveSequence` 与 insert 不在同一事务时，崩溃会留空洞——空洞本身不可怕，乱序才可怕。
- `packages/server/src/event-feed.ts` 的 `/api/event` SSE 是 **volatile 契约**：慢消费者会溢出并断流（`SubscriberCapacity = 4096`），断连期间的事件直接丢失，没有 seq / Last-Event-ID 续传。带序号可续读的是 `session.log`（`?after=<exclusive Event.Seq>` + `follow`，首帧 `log.synced`）——改 `seq` 语义影响的是它，不是 SSE。
- `migration.gen.ts` 是生成物，手改会在下次生成时丢失。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/bus.ts` | 事件发布、序号预留、订阅 |
| `packages/core/src/event/sql.ts` | `event`/`event_sequence` 表定义 |
| `packages/core/src/database/database.ts` | Database 服务与驱动选择 |
| `packages/core/src/database/migration.ts` | 迁移执行 |
| `packages/core/src/database/v1-migration.ts` | 旧版数据导入 |
| `packages/schema/src/durable-event-manifest.ts` | durable 事件清单与校验 |
