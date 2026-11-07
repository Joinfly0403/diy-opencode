---
id: app/workspaces-servers
title: 多工作区与多服务器（Location 上下文、server 注册表、连接态）
level: L1
layer: app
status: stable
paths:
  - packages/app/src/workspaces
  - packages/app/src/servers
symbols:
  - LOCATION_SYNC_RETRIES
  - LOCATION_SYNC_RETRY_DELAY
  - LOCATION_SYNC_TIMEOUT
  - createLocationSyncState
  - transitionLocationSync
  - workspaceDirectories
  - workspaceSelectionDirectories
  - managedWorkspaceDirectories
  - workspaceInventory
  - sessionsForWorkspace
  - createWorktreeInventory
  - withWorktreeInventory
  - worktreeInventoryKey
  - worktreeInventoryViewKey
  - sortServerConnections
  - useServerActionsController
  - replaceServerConnection
  - SERVER_CONNECT_TIMEOUT_MS
  - startServerConnect
  - transitionServerConnect
  - directoryPickerKind
depends_on:
  - app/runtime
  - core/location-instance
related:
  - app/session-chat
  - app/settings
  - app/composer
keywords:
  - 工作区
  - workspace
  - worktree
  - 项目
  - Location
  - 多服务器
  - server 注册表
  - 连接态
  - 配对
  - 目录选择
source_hash: 4b929d1198222b44d77b67123da6216d00472c54
---

## 职责

- 把 server 的“项目 / 工作区（worktree、sandbox）/ 会话”三套清单收成一套可选目录模型，并把它变成 `WorkspaceLocation` Solid 上下文（`directory` + `workspaceID`）。
- server 侧：注册表（增删改、隐藏、排序、显示名）、连接建立（URL/密码/配对链接/二维码）、连接态如何影响页面。
- 工作区侧：`workspaces/paths.ts` 的纯选择器、`inventory.ts` 的 worktree 清单缓存、`selection/` 的目录树选择与策略、`files/` 的工作区文件树与内容缓存。

## 边界

做什么：目录模型、Location 同步与缺失判定、worktree inventory、server 列表与连接 UI、目录/文件选择器。

明确不做：

- 不实现 Location 的服务端解析（`core/location-instance`）与 HTTP 协议。
- 不建立 SSE/API 传输（`app/runtime` 的 `ServerSDK`）。
- 不决定会话页如何展示（`app/session-chat`）；这里只提供目录与连接态。

## 入口与调用链

```
LocationProvider(workspaces/location.tsx)
  ├─ ref = { directory, workspaceID }          // createMemo + sameLocationRef
  ├─ data.location.info(ref)                   // 缺失判定来源
  └─ transitionLocationSync(location-machine)  // idle → syncing → synced / missing / failed
       效果: sync / retry(LOCATION_SYNC_RETRY_DELAY) / timer.clear

server 列表：runtime/server/registry.tsx（持久化）← sortServerConnections/useServerActionsController(servers/registry)
新增 server：servers/connect/dialog.tsx → servers/connect/machine.ts → 校验 → 写进注册表
工作区清单：workspaces/inventory.ts（react-query，staleTime Infinity）← `worktree.updated` 与重连失效
```

- 连接态如何影响会话：`app/session-chat` 的 `sessionRouteView` 把 `server.health` 折进视图，未连接/未授权时显示 `ServerUnavailablePanel` / `ServerSignedOutPanel` 而不是空时间线。
- 目录选择：`directoryPickerKind(platform, server, ownUrl)` —— 桌面 + 本地 server 用原生选择器，其它走 server 端目录树。
- 移除 server：`replaceServerConnection` 先移除该 server 的 tabs，再加新连接，最后删旧 key（顺序不能反）。

## 数据与状态

- `WorkspaceLocation`：`ref`（`directory` + 可选 `workspaceID`）、`current`（`LocationGetOutput`）、`missing`（只有 server 明确报告该目录不存在时才设置）。
- Location 同步预算：重试 `LOCATION_SYNC_RETRIES` 次、间隔 `LOCATION_SYNC_RETRY_DELAY`、单次超时 `LOCATION_SYNC_TIMEOUT`；`missing` 在复查期间保持不变，避免视图闪回加载态。
- worktree inventory 按 `worktreeInventoryKey(scope, projectID)` 缓存，`staleTime: Infinity` + `gcTime: Infinity`：只由事件与重连失效驱动，不靠时间过期。
- 目录清单是三层合并：server 列的 worktree、项目缓存里的 worktrees、项目 sandboxes；去重按 `sameDirectory`。
- server 连接：`SERVER_CONNECT_TIMEOUT_MS`（75s）是兜底；相机探测另有时限，非安全上下文直接显示不可用。

## 关键不变式

- **项目/工作区身份必须带 server scope**：同一 projectID 在不同 server 上不唯一；缓存键与设置键都要 `scope + projectID`。
- **worktree inventory 不由时间过期**：`staleTime: Infinity` 是有意的，刷新靠 `worktree.updated` 与重连失效；加 `refetchInterval` 会造成大仓库周期性全量列目录。
- **`missing` 只信 server 的明确回答**：网络错误是 `failed`（可重试），不是 `missing`（提示目录不存在）。
- **替换 server 要先撤 tabs**：`replaceServerConnection` 的顺序（removeTabs → add → remove）保证不会出现“tab 指向已删 server”。
- 目录比较统一用 `@opencode/util/path` 的 `sameDirectory` / `containsDirectory`，不要自己 `startsWith`（大小写、分隔符、尾斜杠都会错）。

## 扩展点

- **加一种工作区来源**：`paths.ts` 加选择器 → `managedWorkspaceDirectories`/`workspaceInventory` 纳入 → 选择器弹层（`selection/dialog.tsx`）读它。
- **加 worktree 操作**：`inventory.ts` 的 `createWorktreeInventory` 加方法 → `settings/workspaces` 与 `new-session/workspace` 复用。
- **加 server 连接方式**：`servers/connect/method.tsx` 加选项 → `machine.ts` 的 `ServerConnectDraft` 加字段 → `pairing.ts` 解析。
- **加 server 行操作**：`servers/registry/row-menu.tsx` + `controller.ts` 的 action 对象。
- **加文件树能力**：`workspaces/files/tree-store.ts` / `content-cache.ts`，注意缓存记账（`content-cache-accounting`）。

## 常见改法与坑

- 用 `directory `+` "/" ` 拼路径做包含判断：Windows 反斜杠与大小写会漏匹配，用 `containsDirectory`。
- Location 未同步完就挂载会话页：会读到上一目录的 `data.location.info`；用 `syncState` 的状态判断而不是“有没有值”。
- 目录选择器在桌面 + 远程 server 时不能用原生选择器（`directoryPickerKind` 已固化这条），否则选的是本机路径。
- `withWorktreeInventory` 会重算 `sandboxes`；直接改 `project.worktrees` 而不走它会与路径选择器不一致。
- server 的 `hidden` 只影响是否出现在切换器里，不影响其连接与后台同步。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/app/src/workspaces/location.tsx` | `WorkspaceLocation` 上下文、Location 同步驱动 |
| `packages/app/src/workspaces/location-machine.ts` | Location 同步状态机与预算常量 |
| `packages/app/src/workspaces/paths.ts` | 目录/工作区/会话选择器（纯函数） |
| `packages/app/src/workspaces/inventory.ts` | worktree inventory 缓存与视图键 |
| `packages/app/src/workspaces/create.ts` | 创建 worktree 并预热 location 缓存 |
| `packages/app/src/workspaces/selection/dialog.tsx` | 目录/文件选择弹层 |
| `packages/app/src/workspaces/selection/policy.ts` | 原生 vs server 选择器判定 |
| `packages/app/src/workspaces/files/model.tsx` | 工作区文件树与内容视图模型 |
| `packages/app/src/servers/connect/machine.ts` | 连接表单状态机、超时与相机探测 |
| `packages/app/src/servers/connect/pairing.ts` | 配对链接解析与地址规范化 |
| `packages/app/src/servers/registry/controller.ts` | server 排序、隐藏、移除动作 |
| `packages/app/src/servers/registry/management.ts` | `replaceServerConnection` 顺序语义 |
| `packages/app/src/servers/registry/row-menu.tsx` | server 行菜单 |
| `packages/app/src/servers/connect/scanner.tsx` | 二维码扫描入口与降级 |
