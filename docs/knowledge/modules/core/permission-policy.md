---
id: core/permission-policy
title: 权限与策略
level: L1
layer: core
status: stable
paths:
  - packages/core/src/permission.ts
  - packages/core/src/permission
  - packages/core/src/managed-policy.ts
symbols:
  - evaluate
  - merge
  - invocation
  - Unattended
  - DeclinedError
  - CorrectedError
  - BlockedError
config_keys:
  - permissions
events:
  - permission.asked
depends_on:
  - contracts/config-flag
  - core/session-execution
  - core/tool-registry
related:
  - core/plugin-system
keywords:
  - 权限
  - permission
  - 审批
  - ruleset
  - allow
  - deny
  - ask
  - 无人值守
source_hash: 39a74c98c83c14afe6fe2ebf0165243da20ac519
---

## 职责

把"某个 agent 要对某个资源做某个动作"求值成 allow / deny / ask，并把 ask 变成一个可等待、可回复、可保存的请求。

- 规则模型：`Permission.Rule = { action, resource, effect }`，`Ruleset = Rule[]`，资源支持通配（`Wildcard`）。
- 求值：`evaluate(action, resource, ...rulesets)`（后者优先级更高）与 `merge(...rulesets)`。
- 请求生命周期：`assert(AssertInput)` → 事件 → 前端/桌面回复 `Reply` → 结果三类：通过、`DeclinedError`（拒绝）、`CorrectedError`（拒绝并带反馈，模型可改）。
- 持久化：`permission/saved.ts`（保存的规则）、`permission/sql.ts`（表）。

## 边界

- 不做工具实现、不决定 UI 呈现；TUI/desktop 只是回复端。
- 不做"仓库是否可信"的判定：托管策略只提供收紧规则（`managed-policy.ts` + config 的 `policy`）。

## 入口与调用链

```
叶子工具 → Permission.assert({ action, resources, save, ...Permission.invocation(context) })
        → 判定：agent 的 ruleset + 保存规则 + 托管策略 + Unattended
        → allow：直接返回
        → ask：发事件，等待 Reply（超时/无人值守按 Unattended 规则处理）
        → deny / 带反馈拒绝 → DeclinedError / CorrectedError
```

- `invocation(context)` 是**唯一**的请求者字段来源（sessionID/agent/source），不要手写。

## 数据与状态

- agent 缺省权限 = `[{ action: "*", resource: "*", effect: "deny" }]`：**没有显式授权就是拒绝**（这是本仓的默认姿态，和 OpenCode 旧版 "默认 allow" 不同）。
- `Unattended` 是 Context.Reference：无人值守场景下用显式 ruleset 取代交互式 ask（对应"不可信仓库 + 无人值守"的产品前提）。
- 保存的规则按 agent/session 落在 sqlite，参与后续求值。

## 关键不变式

- `ask` 在无人值守下必须降级为 deny（或进入等待队列并超时），不能阻塞。
- 拒绝与"带反馈拒绝"必须区分：前者终止，后者让模型据此改写参数继续。
- 拒绝必须作为**缺陷**穿出叶子工具（不要被 `catchCause` 吞掉），由 session 层统一转成类型化失败。
- 托管策略只能收紧：用户/项目配置不能放宽团队策略。
- 每次权限请求必须是可审计的（事件 + 保存规则），不要静默放行。

## 扩展点

- **加一个动作**：在 schema `permission` 的动作枚举里加 → 工具叶子用新 action → 默认规则里给 deny。
- **加一种资源类型**：`resources` 的构造（路径/命令/域名）与 `Wildcard` 匹配要对齐。
- **改无人值守行为**：改 `Unattended` 的注入点（CLI serve/后台服务），别在求值函数里加模式分支。

## 常见改法与坑

- 用 `save: ["*"]` 一次放行会让后续调用不再询问，安全评审时重点看这里。
- 在工具里自己判断路径是否越界，而不走 `assert`——绕过策略与审计。
- `managed-policy.ts` 与 `config/policy` 是同一策略的两端，改一边忘了另一边会出现"配置写了但不生效"。
- 权限与 `--dangerously-skip` 一类开关的交互在 CLI 侧，排障时同时看 `cli/commands`。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/permission.ts` | 求值、assert、错误类型、invocation |
| `packages/core/src/permission/saved.ts` | 保存规则 |
| `packages/core/src/permission/sql.ts` | 权限表 |
| `packages/core/src/managed-policy.ts` | 托管策略收紧 |
| `packages/schema/src/config/policy.ts` | 策略配置结构 |
