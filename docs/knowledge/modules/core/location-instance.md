---
id: core/location-instance
title: Location / Instance 作用域
level: L0
layer: core
status: stable
paths:
  - packages/core/src/location.ts
  - packages/core/src/location-lifecycle.ts
  - packages/core/src/location-service-map.ts
  - packages/core/src/location-services.ts
  - packages/core/src/location-activity.ts
  - packages/core/src/instance.ts
  - packages/core/src/instance
  - packages/core/src/project.ts
  - packages/core/src/workspace.ts
  - packages/core/src/worktree.ts
symbols:
  - Location
  - LocationLifecycle
  - LocationServiceMap
  - Instance
  - Project
  - Workspace
  - Worktree
depends_on:
  - contracts/events-db
related:
  - runtime/process-lifecycle
  - core/session-execution
keywords:
  - Location
  - Instance
  - 作用域
  - workspace
  - project
  - 多目录
  - 服务图
source_hash: 3739672d5ac18244a512bd94cb7a93cd02b7278a
---

## 职责

定义"同一个进程里，哪一份服务实例属于哪个目录"。核心抽象是 `Location.Ref = { directory: AbsolutePath, workspaceID?: ID }`：仓库里几乎每个有状态服务（会话、工具、权限、文件系统、LSP、PTY……）都是 **Location 作用域**的，而不是进程全局的。

- `Location`：把一个 `Ref` 解析成真实信息（`directory`、`project`、`vcs`），必要时创建 Project 行。
- `LocationServiceMap`：`LayerMap<Location.Ref, Instance.Services>`，按 ref 缓存整套服务图层；`reload()` 让所有 ref 的图层失效并重新预热。
- `Instance`：`graph` 里声明该作用域需要哪些 node（是 `LayerNode.group` 的唯一权威清单）。

## 边界

- 不负责"目录是否可信"、"是否要切换目录"——那是 CLI/TUI 的交互逻辑。
- 不持有跨 Location 的全局状态；全局单例走 `Node.tags.values.global`（见 `app-node`），例如 `Bus`、`Database`、`Global`。

## 入口与调用链

```
Session.prompt → LocationServiceMap.get(ref) → LayerMap 取/建 Instance.Services
                                          → Location.node 解析 Ref（Project.resolve）
                                          → Instance.graph 里的 node 依次建好
```

- `SessionExecution` 只认 Session ID，真正开始 drain 时才 `SessionStore` 查 location、再 `LocationServiceMap.get(session.location)`（AGENTS.md 的硬约束：**没有任何 layer 直接接收 Session ID**）。
- `reload()`：取 `RcMap.keys` → 逐个 `invalidate` → 并发预热全部新图层 → 任一失败即整体失败（用于配置热重载、插件重载）。

## 数据与状态

- `canonical(ref)` 在变成 RcMap key 之前归一化：Windows 主机上 `/xxx` 形式仍按 posix 处理；去掉尾部 `/`（但不越过盘符根）。**key 不归一化会导致同一目录被当成两个 Location，服务实例翻倍。**
- `Location` 构造时只在 `workspaceID !== undefined` 或目录确实存在时才 `Project.resolve(..., { persist })`，避免为无效路径建 Project 行（见 location.ts 注释）。
- `Workspace`（`workspace.ts`）承载显式的 workspace 身份；`workspaceID` 缺省 = 隐式本地放置，显式值保留给未来的多机/远程放置。

## 关键不变式

- 一个目录 = 一个 Location = 一套服务实例；同一目录不同 `workspaceID` 是不同 Location。
- `Instance.graph` 的顺序有意义：`LocationWatcher.node` 故意放在最后（"启动仓库监听必须晚于 boot 关键的文件系统与 Git 操作"）。
- 新增一个 Location 作用域服务，必须同时挂进 `Instance.graph`，否则运行期找不到服务（会表现为 Layer 缺失而不是类型错误）。
- 需要跨 Location 共享的东西不要放进 Location 图层。

## 扩展点

- **加一个 Location 作用域服务**：`xxx.ts` 用 `makeLocationNode` 建 node → `instance.ts` 的 `nodes` 数组里加一行 → 若依赖其他 location 服务，在 node 的 `deps` 里声明。
- **加一种放置语义（远程/多机）**：改 `Location.Ref` 与 `canonical`，并同步 `LocationServiceMap` 的 key 语义；这一步会波及所有 `session.*` 的 location 字段。
- **热重载**：调 `LocationServiceMap.reload()`，不要自己 invalidate 单个 node。

## 常见改法与坑

- `location-services.ts` / `location-lifecycle.ts` / `location-activity.ts` 是同一件事的三块（服务获取、生命周期、活动打点），改名时一起改。
- `Project.resolve` 的 `persist` 语义容易误用：读路径信息时不要顺手落库。
- `worktree.ts` 的创建/删除是"另一个目录"的来源，生成 worktree 后必须用新目录构造 `Location.Ref`。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/location.ts` | `Ref` 解析、`boundNode(ref)` |
| `packages/core/src/location-service-map.ts` | LayerMap、`get`、`reload`、`canonical` |
| `packages/core/src/instance.ts` | `Instance.graph`（服务清单与顺序） |
| `packages/core/src/project.ts` | Project 行、canonical 路径、VCS 探测 |
| `packages/core/src/workspace.ts` | 显式 workspace 身份 |
| `packages/core/src/worktree.ts` + `worktree/` | worktree 创建/删除/策略 |
