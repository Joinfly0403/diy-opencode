---
id: core/pty-shell-worktree
title: PTY / Shell / Worktree
level: L1
layer: core
status: stable
paths:
  - packages/core/src/pty.ts
  - packages/core/src/persistent-pty.ts
  - packages/core/src/persistent-pty
  - packages/core/src/shell.ts
  - packages/core/src/shell
  - packages/core/src/worktree.ts
  - packages/core/src/worktree
  - packages/core/src/vcs.ts
  - packages/core/src/git.ts
symbols:
  - Pty
  - Shell
  - Worktree
  - Vcs
  - WorktreeStrategies
  - PersistentPty
depends_on:
  - core/location-instance
related:
  - gui/terminal
  - cli/commands
keywords:
  - pty
  - 终端
  - shell
  - worktree
  - git
  - vcs
  - 持久终端
source_hash: d29759a49b583358181c5ece3939d771a93df381
---

## 职责

三类"进程/目录"能力，都是 Location 作用域：

- `Pty`：伪终端会话（创建、输入、resize、输出流、结束）。
- `PersistentPty`：可跨进程重启保留的终端（服务重启时用 handoff 交接，见 `OPENCODE_PTY_HANDOFF`）。
- `Shell`：命令执行与输出落盘（`shell` 目录、保留期 7 天、`cleanup`）。
- `Worktree`：git worktree 的创建/删除与策略（`worktree/strategies.ts`），`Vcs`/`git.ts` 是底层探测。

## 边界

- 不做 shell 选择策略的用户交互（`shell/select.ts` 是选择逻辑，UI 在 TUI/app）。
- 不负责"是否允许执行"（`Permission.assert` 在工具叶子里做）。
- worktree 不负责 Location 注册：新目录要由调用方构造 `Location.Ref` 后走 `LocationServiceMap`。

## 入口与调用链

```
tool/plugin/shell.ts → Shell.execute → 输出落盘 + 返回截断尾部
tool/plugin/*（交互式）→ Pty.create/update → 前端渲染（gui/terminal、tui）
服务重启 → PersistentPty handoff（schema/persistent-pty.Handoff）→ 新进程接管
需隔离改动 → Worktree.create(strategy) → 新目录 → Location.Ref
```

## 数据与状态

- PTY 会话表与内存流并存：进程内的 output 流 + 持久层的会话元数据；`Pty.Info` 是 schema 类型。
- 持久终端的 handoff 是序列化快照（`schema/persistent-pty`），CLI 在 `server-process` 里解码，非法 handoff 只告警并重建（不要失败启动）。
- Shell 输出按 `DIRECTORY = "shell"` 落盘，`RETENTION = 7 天`，`cleanup` 是幂等的清理入口。
- worktree 元数据（路径、分支、策略）要能重建，删除失败要可重试。

## 关键不变式

- PTY 输出必须走流式，不能整体缓冲；截断由 `tool-output` 统一处理，Shell 保留"全量文件路径 + 尾部"。
- 持久终端 handoff 失败 = 丢终端状态，只能降级重建，**不能阻塞启动**。
- worktree 的创建/删除必须幂等；删除前要确认目录确实是本仓生成的 worktree（误删用户目录是最高危操作）。
- 命令执行的工作目录、环境变量受 Location 与 `ShellSelect` 决定，不要在工具里另算一套。

## 扩展点

- **加一个 worktree 策略**：`worktree/strategies.ts` 注册策略 id → `Worktree.create` 接受该 id → 配置 `worktree` 域暴露。
- **加一种 shell 选择**：`shell/select.ts` + 配置 `shell`。
- **改终端持久化**：`persistent-pty/` + `schema/persistent-pty` + CLI 的 handoff 解码三处同时改。

## 常见改法与坑

- Windows 上 PTY 依赖 `node-pty`（`postinstall: fix-node-pty`），跨平台代码里别假设 POSIX 路径。
- Shell 保留期与清理会影响磁盘占用；测试里别留下大文件。
- worktree 与 VCS 探测的顺序：先 `Vcs` 判定是不是 git 仓库，再谈 worktree。
- 持久终端在服务模式与 stdio 模式下行为不同（stdio 模式删了密码环境变量），排障先看进程形态。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/pty.ts` | PTY 服务与输入输出 |
| `packages/core/src/persistent-pty.ts`、`persistent-pty/` | 跨重启终端 |
| `packages/core/src/shell.ts` | 命令执行、输出落盘、保留期 |
| `packages/core/src/shell/select.ts` | shell 选择 |
| `packages/core/src/worktree.ts`、`worktree/` | worktree 生命周期与策略 |
| `packages/core/src/vcs.ts`、`git.ts` | VCS 探测与 git 调用 |
| `packages/schema/src/persistent-pty.ts` | handoff 序列化结构 |
