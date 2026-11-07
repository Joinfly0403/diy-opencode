---
id: core/background-jobs
title: 后台任务与定时调度
level: L1
layer: core
status: stable
paths:
  - packages/core/src/job.ts
  - packages/core/src/job
  - packages/core/src/schedule.ts
  - packages/core/src/schedule
  - packages/schema/src/job.ts
  - packages/schema/src/schedule.ts
symbols:
  - Job
  - JobList
  - Schedule
  - ScheduleCheck
  - JobTable
  - ScheduleTable
  - RecoverySchema
  - StartInput
  - WaitInput
  - BlockInput
  - NotFoundError
  - InvalidError
  - DisabledError
  - TIMEOUT_MS
  - validate
  - describe
  - authorize
  - evaluate
config_keys:
  - experimental.schedules
tables:
  - job
  - schedule
depends_on:
  - core/session-execution
  - contracts/events-db
  - core/location-instance
related:
  - core/tool-registry
  - core/pty-shell-worktree
  - contracts/config-flag
keywords:
  - 后台任务
  - job
  - background
  - 定时
  - schedule
  - cron
  - leader
  - 恢复
tests:
  - packages/core/test/job.test.ts
  - packages/core/test/schedule.test.ts
  - packages/core/test/tool-schedule.test.ts
  - packages/core/test/tool-image-generate.test.ts
source_hash: aef2b5a3906dc2aa973038bfdca26b7f6dbd94fe
---

## 职责

两个全局服务，都在"进程活着时跑，数据留在 sqlite"这条线上：

1. **`Job.Service`**（`job.ts`）：进程内的后台工作注册表（`start/wait/block/background/backgroundAll/cancel/cancelSession`），配一张 durable `job` 表，只在任务被"后台化 + 有完成通知 ID"后落库，供重启恢复用。消费方是 shell 工具、子代理工具、image-generate 工具。
2. **`Schedule.Service`**（`schedule.ts`）：`schedule` 表上的定时器：`create/list/get/pause/resume/remove` + 一个全局 `run` 循环（`tick` 点火 + KV 租约选主）。点火方式不是直接跑模型，而是**向会话 inbox 投一条 steer 提示词**。

## 边界

- Job **不管业务语义**：它不知道 shell/子代理/图片的差别，只存 `type`、`metadata`、可选 `recovery`。会话关系的判定（`matchesSession`）只看 `metadata.sessionID`、`blockingSessions` 与 `recovery`。
- Job **不做执行隔离**：工作内容由调用方给一个 `Effect<string>`，取消靠关 fiber scope，没有独立进程。
- Schedule **不执行模型调用**，也不持有会话：它只改自己的行 + 调 `Session.prompt`（准入 inbox）+ `SessionExecution.wake`。
- Schedule 的"是否启用"来自会话所在 Location 的配置，不是本进程参数；未启用时 `create` 直接 `DisabledError`。
- 重启恢复的编排**不在本模块**：在 `packages/core/src/session/execution/restart.ts`（`resumeSuspendedSessions`），本模块只提供 `pendingBackground` / `runningBackground` / `completeBackground` 原语。

## 入口与调用链

**后台任务**

```
shell/image-generate 工具 → jobs.start({ id, type, recovery, notificationID?, run })
   → 成功/失败 → settle() → 写 Info(status) → Deferred(done) 兑现 → persistBackground()
工具选择后台化 → jobs.background(id)（分配 notificationID + 落库）→ 结束时投递完成通知
会话取消 → jobs.cancelSession(sessionID)；工具被中断 → jobs.cancel(id)
模型侧查看 → JobList.read(db, state)（durable 行 + 进程内 live 合并）
```

- `block(id, sessionID)` 是"等这个任务，直到它完成或被人后台化"：完成返回 `{type:"finished"}`，被后台化返回 `{type:"backgrounded"}`（`Effect.raceFirst` 两个 Deferred）。`blockingSessions` 是每会话计数，`backgroundAll({sessionID})` 批量把该会话阻塞中的任务后台化。

**定时调度**

```
Schedule.run → loop：KV 抢 leader（key "schedule:leader"）→ rewake（补 wake）→ tick
tick → 查 status='active' AND next_due_at<=now AND retry_at 已到 → step(row)
step → 再抢一次 leader → 读会话 → 检查该 Location 的 experimental.schedules
     → 有未消费的 last_message_id 就只补 wake → 否则 fire(row)
fire → ScheduleCheck.evaluate（可选）→ Session.prompt({id: msg_<scheduleID>_<run>, delivery:"steer", metadata.schedule})
     → 更新 run_count / next_due_at / last_outcome
```

## 数据与状态

- `job` 表：`notification_id`（主键）/ `id` / `session_id` / `child_session_id` / `kind` / `title` / `status` / `output` / `error` / `recovery(json)` + 三个索引（session、child session、id）。**只有后台化后的任务才有行**；行在完成通知被消费时删除。
- 进程内 `Active` 记录：`done`/`backgrounded` 两个 `Deferred`、`scope`、`blockingSessions`、`isBackgrounded`、`consumed`、`recovery`。已消费的完成记录最多保留 `COMPLETED_LIMIT = 25` 条（按首次消费顺序淘汰）。
- `Recovery`（`job/recovery.ts`）三种：`shell{sessionID,shellID,command}`、`subagent{parentSessionID,childSessionID,agent,description}`、`image{sessionID,path,model}`。**它就是"重启后怎么把这事说清楚"的全部信息。**
- `schedule` 表：`session_id`（`ON DELETE CASCADE`）/ `action(json)` / `check(json)` / `when(json)` / `tz` / `status` / `next_due_at` / `ends_at` / `remaining_runs` / `run_count` / `checks` / `failures` / `last_fired_at` / `last_message_id` / `last_outcome` / `retry_at` / `state(json)` + 部分索引 `schedule_due_idx`（只索引 active 且有 next_due_at 的行）。
- `state(json)` 是跨次检查的条件状态（例如 shell `changes` 的上一次 stdout）。
- 重启后如何恢复：`job` 行 → `pendingBackground` → `restart.ts` 把结果补投成会话消息（`resume: false`，避免吵醒空闲会话），running 的 subagent 行会被 `jobs.start` 重新拉起；`schedule` 行不需要恢复动作，`run` 循环读表即接着跑（过期未点火的槽位会被跳过而不是补发成串）。

## 关键不变式

- **同 id 重复 `start` 不重启**：若已有 running，直接返回它的快照；`settle` 还会核对 `job.scope === scope`，防止旧 generation 的退出覆盖新一代任务。
- **status 判定**：`Exit` 成功 → `completed`；只有中断（`Cause.hasInterruptsOnly`）→ `cancelled`；其余 → `error`。`cancelled` **不写入** durable 行（`settle` 里 `if (status !== "cancelled") persistBackground(...)`）。
- **落库前提**：`persistBackground` 需要 `recovery` 与 `notificationID` 同时存在；没有 `recovery` 的任务是"纯进程内"的，重启即失联。
- **通知 ID 是幂等键**：表以 `notification_id` 为主键，重复写走 `onConflictDoUpdate` 只更新 status/output/error/recovery；`completeBackground` 按它删行。
- **定时提示词 ID 由 `run_count` 派生**（`msg_<scheduleID>_<run>`）：崩溃重试会与已准入的 inbox 行对账，不会重复点火。已准入但未消费时只补 `SessionExecution.wake`（"wake 丢了再 wake 一次是无害的"）。
- **单 leader**：`kv` 表 `schedule:leader` 一行租约，`LEADER_TTL = 2 × MAX_SLEEP`，心跳 `TTL/3`；非 leader 进程不会点火，所以共用同一数据目录的辅助进程（`opencode acp` / `--standalone`）不会与管理服务双发。循环每 `MAX_SLEEP = 30s` 至少回读一次表，防时钟跳变与漏门铃。
- **时间语义**：`every` 最小 1 分钟（带 check 时 15s）；`cron` 必须"每分钟最多一次"；`every` 会保持相位、跳过错过的槽位而不是补发一串；`until` 默认 `every 30 seconds`、默认 `ends.after = 24h`；点火晚于 due 超过 `LATE_AFTER = 60s` 记为 `late`。
- **检查失败的退避**：check 失败重试 `1 分钟`，连续 `3` 次（`MAX_CHECK_FAILURES`）后把日程 `paused` 并投递一条带原因的提示；prompt 整体失败退避 `5 分钟`；Location 未启用则 `retry_at = now + 1h` 且保留 due 时间。会话目录消失（`FileSystem.DirectoryNotFoundError`）直接 pause，避免每 5 分钟重试。
- **检查在无人值守下跑**：`ScheduleCheck.evaluate` 用狭窄权限 + 30s 墙钟（`TIMEOUT_MS`）+ `MAX_OUTPUT_BYTES` 输出上限，codemode 检查限制 20 次工具调用并禁用一组工具（`FORBIDDEN_CODE_TOOLS`：schedule_* / session_move / session_rename / worktree_*）。创建时 `authorize` 才向用户申请权限（一次，不保存）。
- **删除级联**：会话删除会连带删掉它的 schedule 行（外键 cascade）；`cancelSession` 会同时删掉 session/child session 的 job 行。

## 扩展点

- **加一种后台任务**：调用方给 `jobs.start({ id, type, recovery, notificationID?, run })` 并提供对应 `Recovery` 变体 → 在 `job/recovery.ts` 加 schema → 在 `job/list.ts` 的 `toItem` 与 `session/execution/restart.ts` 的补投分支加 case → 补通知文本（如 `ShellResult.notification`、`ImageNotice.text`）。
- **加一种定时动作**：`packages/schema/src/schedule.ts` 的 `Action` union → `schedule.ts` 的 `fire` 里替换 `action.prompt` 的分支 → `toInfo` 投影 → 工具侧入参校验。
- **加一种检查条件**：`schema/schedule.ts` 的 `Condition` → `schedule/check.ts` 的 `validate`（同步语法校验）+ `authorize`（申请权限）+ `evaluate`（执行）+ `describe`（给人看的描述）。
- **改触发节奏**：`MAX_SLEEP` / `LEADER_TTL` / `MIN_INTERVAL` / `FAILED_RETRY` 都集中在 `schedule.ts` 顶部常量区，改任一个都要重新核 `nextWake` 与心跳的关系。
- **对外暴露状态**：Job 侧走 `JobList.Item`（`packages/schema/src/job.ts`），Schedule 侧走 `Schedule.Info`；UI 只读这两个契约。

## 常见改法与坑

- 以为 `job` 表就是"所有后台任务"：没有 `recovery` 或从未 `background()` 的任务压根没有行，重启后既没有完成通知也没有恢复。
- 在 `run` 里捕获中断：`cancelled` 与 `error` 的分野靠 `Cause.hasInterruptsOnly`，用 `catchAll` 吞掉中断会把"用户取消"记成失败（或反之）。
- 给 `block` 用完不给 `background`/`backgroundAll`：`blockingSessions` 计数会一直挂着，会话取消路径就找不到它。
- 改 `msg_<scheduleID>_<run>` 的 ID 规则：会让崩溃重试无法与已准入的 inbox 行对账，出现重复点火。
- 在 tick 里做长耗时工作：`TICK_CONCURRENCY = 4`，且循环按 `nextWake` 睡；一个慢检查会推迟同一批其他日程。
- 把 `experimental.schedules` 当全局开关：它按会话所在 Location 的配置求值，`enabled()` 与 `create()` 都会读那个 Location。
- 删 `schedule` 行而不是走 `remove`：`remove` 先 `find` 再删（缺失即 `NotFoundError`），直接删不会重置 leader/doorbell 状态。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/job.ts` | 后台任务注册表：start/settle/wait/block/background/cancel、落库、恢复原语 |
| `packages/core/src/job/sql.ts` | `job` 表与三个索引 |
| `packages/core/src/job/recovery.ts` | `Recovery` 三态 schema（重启后补什么信息） |
| `packages/core/src/job/list.ts` | `JobList.read`：durable 行 + 进程内 live 的合并投影 |
| `packages/core/src/schedule.ts` | 定时器服务：leader 租赁、tick/fire、检查退避、create/pause/resume |
| `packages/core/src/schedule/sql.ts` | `schedule` 表与 `schedule_due_idx` 部分索引 |
| `packages/core/src/schedule/check.ts` | 条件校验/授权/在无人值守下求值（shell 与 codemode） |
| `packages/schema/src/job.ts` | `Job.Info`/`Kind`/`Status` 对外契约 |
| `packages/schema/src/schedule.ts` | `When`/`Action`/`Condition`/`Info` 契约与时长解析 |
| `packages/core/src/tool/plugin/shell.ts` | 后台 shell 的 `jobs.start/background` 与完成通知消费 |
| `packages/core/src/tool/plugin/image-generate.ts` | 后台图片任务的 job 用法 |
| `packages/core/src/session/execution/restart.ts` | 重启恢复：消费 `pendingBackground`、重拉 subagent、`resume: false` 补投 |
| `packages/core/src/session/background.ts` | 会话视角的 outstanding/list（含后代会话） |
