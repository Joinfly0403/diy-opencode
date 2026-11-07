---
id: core/session-execution
title: 会话执行
level: L1
layer: core
status: stable
paths:
  - packages/core/src/session
  - packages/core/src/session.ts
symbols:
  - Session
  - Service
  - terminal
  - serialized
  - find
events:
  - session.inbox.enqueued
  - session.inbox.delivered
tables:
  - session_inbox
  - message
depends_on:
  - core/location-instance
  - contracts/events-db
  - core/provider-models
related:
  - core/tool-registry
  - core/permission-policy
keywords:
  - 会话
  - session
  - inbox
  - 执行
  - 步骤
  - steer
  - compaction
  - 中断
source_hash: b94e6705ae45af378e97da07f5764b5860c0c0a0
---

## 职责

一次用户请求从"进队列"到"模型产出"的全过程：入队（inbox）、执行调度（execution / run-coordinator）、单步 LLM 调用（runner/llm）、工具调用编排、上下文压缩、标题生成、子代理。

一句话：**`Session.prompt` 只负责准入，`SessionExecution` 负责跑，二者只通过 durable 事件与 inbox 行衔接。**

## 边界

- 不做权限判定（`core/permission-policy`）、不做工具实现（`core/tool-registry`）、不直接调模型 SDK（`core/provider-models`）。
- 不持有跨会话的内存循环；"一个 step = 一次 `llm.stream`"，从重载后的历史继续。

## 入口与调用链

```
Session.prompt(...)
  → 发布 session.inbox.enqueued
  → 投影：插入一行 durable session_inbox（未消费工作只放这里）
  → SessionExecution.wake(sessionID)（resume:false 时只准入不唤醒）
  → drain：SessionRunCoordinator 取/建本次运行
  → SessionRunner：每步一次 llm.stream，工具调用回到本步继续
  → 投递：发布 session.inbox.delivered
  → 投影：同一事务内消费 inbox 行 + 插入可见 message
```

## 数据与状态

- `session_inbox`：只存**未消费**的工作；已投递内容从投影的消息行还原。
- 执行 claim：写前日志式（write-ahead）的执行声明标记"本进程正在忙这段会话"，供重启恢复；进程死亡时保留，正常终止/失败/用户中断时释放。
- 状态推导：事件 + 投影器（`projector.ts`）折叠出读模型；不要在别处另存一份状态。

## 关键不变式（改动前必读）

- **准入与执行分离**：`Session.prompt` 先发事件、再调度，两者不能合成一步。
- **durable 事件最小**：只记不可再生的新事实，可折叠的状态不进事件。
- **投递事务性**：消费 inbox 行与插入可见消息必须在同一事务。
- **ID 复用语义**：复用 Session ID = 采纳已有会话；复用 inbox item ID 在"同 Session + 同类型"下幂等（首次为准，重试的 payload/元数据/投递模式被忽略）；跨 Session 或跨类型复用直接失败；control 类型 item 保持各自冲突语义。
- **单步即单次 LLM 调用**：durable 记录只覆盖模型可见跨度；不要加内存里的工具循环。术语上"turn"保留给"从 prompt 提升到会话空闲"的更大单位，不要用 turn 指单次调用。
- **`SessionExecution` 是进程全局 + 按 Session ID**：本地实现拥有进程内协调器，只有开始 drain 时才用 `SessionStore` + `LocationServiceMap.get(session.location)` 找放置；**没有任何 layer 接收 Session ID**。中断只针对本进程活跃的持有链；已知但空闲/非本进程持有的会话是 no-op，未知会话由公开 API 拒绝。
- **并发语义**：`SessionRunCoordinator` 合并同一会话的显式 resume、合并唤醒，不同会话可并发；在集群实现之前保持进程内。
- **投递词汇明确**：默认 steer；在安全步骤边界，"steered compaction"优先直到第一个 steered move 控制项；空闲边界下 steer 优先，否则只投递一条队列项再重评继续；新用户输入提升会重置所选 agent 的步数预算（一批 steer 只重置一次）。
- **会话核心状态**（runner、模型解析、工具注册表、权限、文件系统）都是 Location 作用域；`workspaceID` 缺省 = 隐式本地。

## 扩展点

- **加一种 inbox item 类型**：`session/inbox.ts` 的类型与 `projectAdmitted/projectDelivered/projectCancelled` 一起扩展，并补幂等/冲突测试。
- **改执行步骤**：`session/runner/step.ts`、`llm.ts`；注意"一步一次 `llm.stream`"的约束。
- **加压缩策略**：`session/compaction.ts` + `schema/config/compaction`。
- **子代理**：`session/subagent-job.ts`、`subagent-completion.ts`，与 `tool/plugin/subagent.ts` 联动。

## 常见改法与坑

- 在 `Session.prompt` 里直接跑模型 → 破坏准入/执行分离，重启恢复与并发都会错。
- 把"已投递"信息再存一份到 inbox → 与投影副本冲突，重放不一致。
- 中断语义改动会波及 CLI/TUI 的"停止"按钮与重启恢复（claim 不是锁，别当排他所有权用）。
- 修改 `session/sql.ts` 后要重新生成 schema/迁移（见 `contracts/events-db`）。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/session/session.ts` | `Session` 服务、prompt 准入 |
| `packages/core/src/session/execution.ts` | `SessionExecution`、claim、terminal |
| `packages/core/src/session/inbox.ts` | inbox 行、投影、幂等 |
| `packages/core/src/session/run-coordinator.ts` | 同会话合并、跨会话并发 |
| `packages/core/src/session/runner/llm.ts` | 单步 `llm.stream` 与工具回环 |
| `packages/core/src/session/runner/step.ts` | 步进与预算（`max-steps`） |
| `packages/core/src/session/compaction.ts` | 上下文压缩 |
| `packages/core/src/session/projector.ts` | 事件 → 读模型 |
| `packages/core/src/session/restart.ts` | 重启恢复 |
