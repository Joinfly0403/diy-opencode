---
id: gui/details
title: 会话详情（服务/位置/MCP）
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/details
symbols:
  - serviceConfigFile
  - globalConfigDirectory
  - workspaceDirectories
  - WorkspaceProject
  - transitionMcp
  - mcpRowView
  - mcpDialogView
  - MCP_TOGGLE_TIMEOUT_MS
  - McpServerStatus
  - transitionFlyout
  - flyoutActive
  - flyoutPane
  - flyoutAnchor
  - createFlyoutMotion
  - transitionConfigAction
  - configActionView
  - CONFIG_ACTION_TIMEOUT_MS
  - transitionDetailsPopover
  - detailsPopoverOpen
  - detailsPopoverFocusesContent
  - transitionServiceLoad
  - serviceLoadView
  - SERVICE_LOAD_TIMEOUT_MS
  - createWorkspaceMoveState
  - transitionWorkspaceMove
  - workspaceMenuView
  - workspaceDialogView
  - WORKSPACE_MOVE_TIMEOUT_MS
  - WORKSPACE_CREATE_TIMEOUT_MS
tests:
  - packages/gui-plugins/src/details/mcp-machine.test.ts
  - packages/gui-plugins/src/details/flyout-machine.test.ts
  - packages/gui-plugins/src/details/workspace-move-machine.test.ts
  - packages/gui-plugins/src/details/service-load-machine.test.ts
  - packages/gui-plugins/src/details/config-file.test.ts
  - packages/gui-plugins/src/details/config-action-machine.test.ts
depends_on:
  - core/plugin-system
  - core/mcp-integration
related:
  - gui/review
  - gui/context
  - gui/file
  - core/location-instance
keywords:
  - 详情
  - details
  - MCP
  - 插件
  - skills
  - 配置
  - config
  - 工作区
  - workspace
  - 位置
source_hash: 0039c33c129ea233b5ceea60d11c23337cd79b48
---

## 职责

session 的"详情"面：header 上的详情按钮与其 popover（宽屏）、窄屏的 drawer（`region: "side"` 的 mobile drawer），内容是本机 server 的项目、位置、以及 MCP / plugins / skills 三个服务列表和它们的操作。

- `server-panel.tsx` 是主体（约 1670 行）：服务的加载、行摘要、flyout、开关、错误对话框。
- `popover.tsx`（`DetailsHeader`）、`panel.tsx`（薄包装）、`location-menu.tsx` / `workspace-menu.tsx` / `location-workspace.tsx`：位置与工作区。
- 状态机：`popover-machine.ts`、`flyout-machine.ts`、`mcp-machine.ts`、`service-load-machine.ts`、`config-action-machine.ts`、`workspace-move-machine.ts`。

## 边界

做：
- 列出并操作 MCP server（连接/断开/登录、错误详情），列出 plugins 与 skills（只读列表 + 打开配置）。
- 打开配置文件（`serviceConfigFile` 推断该服务由哪个文件承载；`globalConfigDirectory` 推断全局配置目录）。
- 工作区：列出项目的其它 worktree/sandbox，创建、移动会话、删除 worktree（`workspace-move-machine.ts`）。

不做：
- 不实现 MCP 协议或插件加载：全部经客户端 API（`@opencode/client`），状态由 server 给。
- 不拥有配置编辑 UI：只负责"打开某个配置文件"。
- 不渲染 diff：changes 行读 `gui/review` 的 `ReviewDetails` 契约。
- 窄屏不开 tab：`list: () => []`，只有 mobile drawer。

## 入口与调用链

```
src/renderer.ts → details/renderer.tsx setup
  const menus: DetailsMenus = new Set()      // popover 的注册表
  const mcp: McpControllers = new Map()      // 跨 popover/drawer 存活的 MCP 控制器
  const moves: WorkspaceMoveControllers = new Map()
  ctx.add(Slot, { at: "session.header", order: 20 })        → <DetailsHeader …/>
  ctx.add(Slot, { at: "session.location.menu" })            → <LocationMenu …/>
  ctx.add(BuiltinSlot, { at: "session.location.workspace" }) → <LocationWorkspace …/>
  ctx.add(Panel, () => session?.project ? { id: "main", region: "side",
                mobile: { order: 50, kind: "drawer", icon: "info" }, list: () => [] } : undefined)
```

- 详情内容：`panel.tsx` → `server-panel.tsx` 的 `SessionServerPanel`；三个服务来自常量 `services`（`mcp` / `plugins` / `skills`）。
- 服务加载：`service-load-machine.ts`（`SERVICE_LOAD_TIMEOUT_MS = 15_000`），每个服务一个 `ServiceSource`（`view` / `count` / `failed` / `refresh` / `retry` / `Body` / `Footer`）。
- MCP 操作：`mcp-machine.ts` 的 toggle → 客户端 connect/disconnect/sign-in → `MCP_TOGGLE_TIMEOUT_MS = 60_000`；失败进 `McpErrorDialog`。
- 工作区：`workspace-move-machine.ts` 的 `WORKSPACE_LIST_TIMEOUT_MS`/`CREATE`/`MOVE`/`REMOVE` 四档超时 + 恢复对话框。

## 数据与状态

- **没有持久化 store**，本插件不声明 `stores`。
- 插件实例级的内存 Map（在 setup 里）：`menus`、`mcp`、`moves`。它们故意比 popover/drawer 活得久——源码注释写明"MCP toggles and error dialogs outlive the popover or drawer that started them"、"Moves and their recovery dialogs outlive the location menu"。
- 服务列表内容来自 server（`ConfigEntry` 等），每次打开时 `refresh()`，并会 join 正在跑的加载。
- 重启后：全部重新从 server 载入；没有本地状态需要恢复（工作区的移动已经落盘）。

## 关键不变式

- **控制器不能挂在组件里**：`mcp`/`moves` 必须是插件实例级，否则 popover 关闭时进行中的 toggle 或恢复对话框会丢。它们由 `renderer.tsx` 创建并作为 props 传下去。
- **配置文件推断规则**：`serviceConfigFile` = 最后一个列出该服务的文档 → 最后一个设置该服务但列表为空的文档 → 第一个文档（源码注释：项目文件里的空 `"mcp": {}` 不会隐藏全局文件里的 server）。
- **全局配置目录规则**：`globalConfigDirectory` 取第一个 `directory` 条目，且它不能以 `.opencode` 结尾（那说明全局配置被关掉，返回当前 directory）。祖先目录里的项目配置不能被误认成全局。
- **flyout 的 aim 窗口是 100ms**（`AIM_TIMEOUT_MS`）：鼠标从行移到浮层时的过渡容差，别改成 0（会随机关闭）。
- **popover 的焦点语义**：`detailsPopoverFocusesContent(state)` 决定打开后焦点是否进内容（pointer vs keyboard 两种 `via`）。
- **`onClose` 只在动作打开了别的东西后调用**：动作打开新对话框前先关 popover，否则两个浮层叠在一起。
- **worktree 列表要排除项目根**：`workspaceDirectories` 用 `sameDirectory` 去重并排除 `project.worktree`。

## 扩展点

**新增一个服务（第四个列表）**：`server-panel.tsx` 的 `services` 常量 + `Service` 类型（`flyout-machine.ts`）+ `ServiceSource` 的实现 + `ServiceProps` 的取数 + `i18n/en.ts`。这条链路最长，注意 `flyout-machine.ts` 里的 `Service` 是字面量 union。

**新增一个 MCP 动作**：`mcp-machine.ts` 的事件/效果 → `server-panel.tsx` 的行操作 → `McpControllers` 里的 attempt 记录。不要在组件里直接调 client。

**新增一个工作区操作**：`workspace-move-machine.ts`（事件、效果、超时、恢复对话框）+ `workspace-menu.tsx` 的菜单项；失败路径必须有"重试/关闭"的恢复对话框。

**新增一个 slot 消费点**：位置菜单用的是 `session.location.menu` / `session.location.workspace`，加东西前先看这两个 slot 的输入里的 `screen`（`MountedSession` 没有跟随路由的动作）。

## 常见改法与坑

- `server-panel.tsx` 非常大：改它之前先定位属于哪个机器（mcp / service-load / flyout / config-action），别把逻辑写进组件。
- 一个 server 换掉（`props.session.server.id`）时要整体重建列表与 flyout：`<Show when={…} keyed>` 有两层，删掉任何一层都会串数据。
- 配置文件名推断对 `.json` / `.jsonc` 敏感（`configDocuments` 的正则），加新格式要一起改。
- `SERVICE_LOAD_TIMEOUT_MS`、`MCP_TOGGLE_TIMEOUT_MS`、`CONFIG_ACTION_TIMEOUT_MS`（15s/60s/15s）语义不同，不要统一成一个值。
- 复制配置路径的反馈是 2s（`CONFIG_COPIED_MS`）；把 `configActionView` 的状态当唯一真相，别在组件里再存一份"已复制"。
- `kind: "drawer"` 的 mobile 面板只在 `props.session.project` 存在时渲染；非项目会话没有详情入口，这是有意的。
- 详情按钮在 `session.header`（`order: 20`），与 `gui/context` 的 `order: 10` 相邻；调整顺序会改 header 的视觉分组。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `details/index.ts` | `Plugin.define`：只有多语言目录 |
| `details/renderer.tsx` | window 入口：header slot、位置 slot、mobile drawer、控制器 Map |
| `details/popover.tsx` | `DetailsHeader`：header 按钮与 popover 容器 |
| `details/panel.tsx` | 面板薄包装（宽屏 popover 与窄屏 drawer 共用） |
| `details/server-panel.tsx` | 主体：服务列表、MCP 行、flyout、配置入口、changes 行 |
| `details/location-menu.tsx`、`location-workspace.tsx`、`workspace-menu.tsx` | 位置与工作区 UI |
| `details/mcp-machine.ts` | MCP 状态机（toggle、登录、错误对话框） |
| `details/service-load-machine.ts` | 服务列表的加载/失败/重试视图 |
| `details/flyout-machine.ts` | flyout 的状态与 aim 判定 |
| `details/popover-machine.ts` | popover 打开/关闭与焦点 |
| `details/config-action-machine.ts` | "打开/复制配置路径"的 15s/2s 时序 |
| `details/config-file.ts` | `serviceConfigFile` / `globalConfigDirectory` |
| `details/workspace-move-machine.ts` | 工作区创建/移动/删除与恢复 |
| `details/paths.ts` | `workspaceDirectories`：项目的其它 worktree |
| `details/details.css` | 面板样式（`?inline`，经 `ctx.add(Style, …)` 提交） |
