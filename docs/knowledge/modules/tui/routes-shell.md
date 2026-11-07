---
id: tui/routes-shell
title: TUI 路由与外壳
level: L1
layer: tui
status: stable
paths:
  - packages/tui/src/app.tsx
  - packages/tui/src/index.tsx
  - packages/tui/src/routes
  - packages/tui/src/context/route.tsx
  - packages/tui/src/context/keymap.tsx
  - packages/tui/src/context/session-tabs.tsx
  - packages/tui/src/context/session-tabs-model.ts
  - packages/tui/src/plugin/render.tsx
  - packages/tui/src/component/session-frame.tsx
symbols:
  - Home
  - Session
  - useRouteData
  - Route
  - HomeRoute
  - SessionRoute
  - PluginRoute
  - Keymap
  - COMMAND_PALETTE_COMMAND
  - Slot
  - SessionFrame
  - Sidebar
  - Composer
  - SessionGroupView
  - PermissionPrompt
  - FormPrompt
  - createSessionRows
  - sessionRowID
  - createTimelineAnchors
  - rowWeight
  - rowsBefore
  - rowsAfter
  - createHistoryPrepend
  - findMessageBoundary
  - generateThinkingSyntax
  - activitySummary
  - openSessionTab
  - closeSessionTab
  - reopenSessionTab
  - adaptiveSessionTabLayout
  - SESSION_TAB_MAX_WIDTH
depends_on:
  - runtime/process-lifecycle
  - core/location-instance
  - core/session-execution
related:
  - tui/components
  - tui/prompt-editor
  - tui/feature-plugins
  - contracts/events-db
keywords:
  - TUI
  - 路由
  - 页面栈
  - 会话
  - 快捷键
  - keymap
  - 标签页
  - 滚动
  - 虚拟化
  - 挂载预算
source_hash: 2a6f4a828c3fca3368f4057276853afbea32fc90
---

## 职责

主 TUI 的外壳与路由：把 OpenTUI 渲染器、约 30 层 Solid Provider、命令路由和页面栈组装成一个应用。

- `app.tsx` 的 `run(input)` 是唯一入口（Effect 函数，名 `Tui.run`）：算 renderer 配置、建 API 客户端、解析 Location、装配 Provider 树、渲染 `<App/>`，并在退出时写 epilogue。
- `App()` 的渲染输出只有三层：按 `route.data.type` 三选一渲染页面（home / session / plugin）的 `<Switch>`；`Slot path="app"` 给插件；全局覆盖层（SessionTabs、DevToolsBar、StartupLoading、Reconnecting、MigrationOverlay、Toast）。命令表、layer 注册与事件桥也在 `App()` 里，但不在渲染树中。
- `routes/` 是页面实现：`home.tsx` 是首页 prompt + logo + 全局表单；`session/` 是会话转录（3834 行主文件 + 行模型/分组/锚点/预算/对话框）。
- 快捷键路由在 `context/keymap.tsx`：命令即路由（palette 命令、slash 命令、inline 绑定都进同一张 keymap），会话内外的快捷键切换靠 layer 的 `enabled` 表达式，不靠 if。

## 边界

做什么：进程内的页面栈、命令注册与分发、标签页窗口、转录行的挂载与滚动锚点、跨标签页共享的终端/面板宿主。

不做什么：
- 不建 HTTP 服务、不管进程生命周期（见 `runtime/process-lifecycle`）。
- 不实现会话协议语义（提交/steer/排队在 server 与 `core/session-execution`；TUI 只发请求）。
- 不含输入框内部编辑模型（见 `tui/prompt-editor`）、不含对话框骨架与可复用组件（见 `tui/components`）。
- 不直接渲染插件内容：`plugin/render.tsx` 的 `Slot` / `PluginRoute` 只负责边界与崩溃隔离。

## 入口与调用链

```
packages/tui/src/index.tsx  export { run }
  → app.tsx run()
      createCliRenderer(targetFps 60, exitOnCtrlC false, useMouse=config.mouse, useKittyKeyboard)
      → Provider 树：Log → Exit → Epilogue → TuiApp → ErrorBoundary → TuiPaths → Storage →
        TuiLifecycle → TuiTerminalEnvironment → TuiStartup → Clipboard → Args → Config →
        Keymap.Provider → Toast → Route → Client → Permission → Data → Location →
        SessionTabs → SessionTerminals → Theme → ClientMcp → Local → PromptStash → Dialog →
        Frecency → PromptHistory → PromptRef → Editor → Attention → UpdateNotification →
        Panel → Plugin → <App/>
  → App() Switch:
      home    → <Home/>            (routes/home.tsx)
      session → <SessionFrame sessionID/> → Session + Sidebar + TerminalPane + PanelHost
      plugin  → <PluginRoute fallback={PluginRouteMissing}/>
```

- 初始路由：`args.continue` 先给一个占位 session 路由，再由 effect 查最近会话改写；`OPENCODE_ROUTE`（JSON）与 `OPENCODE_STORY`（→ plugin 路由 `opencode.storybook`）优先级更高。
- 命令分发：`TuiApp` 的 `event.on("tui.command.execute")` → `keymap.dispatch(id)`；`tui.toast.show` → toast；`tui.session.select` → `route.navigate`；`session.deleted` → 回 home 并提示。
- layer：`App()` 依次注册 `appCommands()`（id + palette + slash）、`appBindingCommands`、`appGlobalBindingCommands`、tabs 开启时的 `sessionTabBindingCommands`、tabs 关闭时的 `pinnedSessionBindingCommands`，以及"prompt 为空才可退出"的 `app.exit` 层。

## 数据与状态

- 路由状态是 Solid store（`context/route.tsx`）：`navigate(route)` 用 `reconcile` **整体替换**，因此页面切换会销毁并重建整棵子树；session 页按 `route.data.sessionID` keyed，换会话等于换组件实例。
- 标签页模型在 `context/session-tabs-model.ts`（纯函数）：开/关/移动/cycle、关闭栈（`recordClosedSessionTab`/`reopenSessionTab`）、有界导航历史、宽度计算（`SESSION_TAB_MIN_WIDTH`/`MAX_WIDTH`、`adaptiveSessionTabLayout`、`sessionTabOverflowWidth`）。内存态，退出即失。
- 转录行模型在 `routes/session/rows.ts`（`createSessionRows`/`reduceSessionRows`/`resolvePart`/`messageBoundaryIDs`），分组投影在 `grouping/session.ts`、`grouping/tree.ts`。
- 滚动锚点：`anchors.ts`（`createTimelineAnchors`、`anchorKey`、`EntryAnchor`）与 `anchor-view.tsx`；几何仍在 OpenTUI，TUI 只记身份。
- 跨重启保留的东西都在 Provider 层的 storage / local / prompt 历史里，路由本身不持久化；回到"上一页"只能靠 `--session`/`--continue`（调试用的 `OPENCODE_ROUTE`/`OPENCODE_STORY` 直接指定初始路由）。

## 关键不变式

- **帧预算不是时间**：转录挂载按"渲染条目数"预算（`mount-budget.ts` 注释）；折叠的分组无论多少 parts 都只算 1。不要用行数或时间估算。
- **transcript 行禁止自己 `useTerminalDimensions()`**（`render-context.tsx` 注释）：每挂一个组件就注册一个 renderer resize 监听，会随转录长度增长；必须读 context 里共享的 `terminal`。
- **行必须带稳定 key**：`rows.ts` 注释说明 Solid 默认按 `id` reconcile，行没有 `id` 会按位置匹配，前插历史时整屏重挂。
- **首屏尾部挂载**：只有最新几行挂载，向上滚动才加载更老的行；读者停在底部时隐藏区间跟随 append，离开底部则钉住视口。
- **锚点身份不跟随 store reconcile**（`anchors.ts` 注释）：`Solid` 原地 reconcile 会换对象身份，锚点只对已挂载的 part 与真实分组头登记。
- **命令形状是硬校验**：`groupCommands` 里 palette/slash 命令必须有 `id`，inline 命令必须有非空 `bind`，空 id/空绑定直接抛错。
- **命令对象要稳定**：`createLayer` 用 `stable` Map 复用命令对象，只替换函数字段；每次 render 新建对象会让 keymap 重建整层。
- **模式是栈不是布尔**：`createMode` 用 `opencode.mode` 数据键，`push(mode)` 返回 cleanup；禁用的 scope 保留在栈里而不是被移除。
- **选择键优先级最高**：selection 的 `keymap.intercept("key", …, { priority: 101 })` 必须早于 app 绑定与终端面板的原始按键转发。
- **插件崩溃不得带崩外壳**：slot / route 各有一层 `PluginBoundary`，keyed 以在导航或热重载时重建，否则一次崩溃会把后续路由全锁进 fallback。

## 扩展点

- **加一个页面类型**：`context/route.tsx` 的 `Route` union 加分支 → `app.tsx` 的 `<Switch>` 加 `<Match>` → 在 `routes/` 建组件 → 处理 `initialRoute` 校验函数与终端标题分支。
- **加一条命令**：`config/keybind.ts` 的 `Definitions` 加默认绑定与描述（否则用户配置不认这个名字）→ `app.tsx` 的 `appCommands()` 加 `{ name, title, category, run }`（要进命令面板就 `palette: true`，要进 slash 就 `slash`）→ 需要绑定时把 id 加进 `appBindingCommands`/`appGlobalBindingCommands`。
- **加一个对话框**：命令的 `run` 里 `dialog.replace(() => <DialogX/>)`；需要单例 key（如 `DialogOpenKey`）就用 `dialog.replace(..., undefined, { key, size })`。
- **加一个插件插槽位置**：先在 `plugin/render.tsx` 的宿主处放 `<Slot path="…"/>`，路径与输入要发布到 `@opencode/plugin/tui/context` 的 `SlotMap`（见 `tui/feature-plugins`）。
- **加一个标签页维度**（未读、状态）**：改 `session-tabs-model.ts` 的纯函数 + `session-tabs.tsx` 渲染 + `sessionTabDetail`，不要在组件里就地算。

## 常见改法与坑

- 改 `route.navigate` 的调用点会连带重置 prompt 草稿与滚动锚点——`stash`/history 就是为这类切换存在的。
- 在 session 页里直接 `useTerminalDimensions()` 会随消息数线性增加监听器（这是 `render-context` 明写的坑）。
- 在 `<Match when={route.data.type === "session"}>` 外读取 `route.data.sessionID` 会拿不到类型收窄；`SessionFrame` 用 `<Show keyed>` 包一层就是为了按 id 重建。
- 历史前插时若某页只加上分组头会产出临时 groupID：`rows.ts` 里"最老的 row 还是分组就继续加载更老分页"的循环带最小推进保护，改动时不要引入"加了 0 行"的分支。
- `permission`/`form` 是会话内的阻塞交互，不要挪到全局覆盖层：它们要通过 `render-context` 的 `mutatePending` 与会话行对齐。
- `OPENCODE_DRIVE`（模拟驱动器）与 `OPENCODE_STORY` 都会替换 renderer 或初始路由，写死路由的代码在这两个环境下会表现异常。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/tui/src/index.tsx` | 包出口：`run` 与 Log 相关导出 |
| `packages/tui/src/app.tsx` | renderer 配置、Provider 树、App 壳、命令表、layer 注册、事件桥 |
| `packages/tui/src/context/route.tsx` | Route union、`navigate`（reconcile 替换）、初始路由校验 |
| `packages/tui/src/context/keymap.tsx` | keymap 适配、mode 栈、`createLayer`、命令形状校验、shortcuts |
| `packages/tui/src/routes/home.tsx` | 首页 prompt、logo、全局表单与位置回填 |
| `packages/tui/src/routes/session/index.tsx` | 会话转录主体：挂载、滚动、权限/表单、导出 |
| `packages/tui/src/routes/session/rows.ts` | 行模型、reconcile key、边界与缓存复用 |
| `packages/tui/src/routes/session/mount-budget.ts` | 按渲染条目计的挂载预算上下界 |
| `packages/tui/src/routes/session/anchors.ts` | 时间线锚点身份与分组 ID |
| `packages/tui/src/routes/session/grouping/session.ts` | 条目投影、verbosity 默认、分组引用 |
| `packages/tui/src/context/session-tabs-model.ts` | 标签页窗口、关闭栈、有界导航历史 |
| `packages/tui/src/component/session-frame.tsx` | session 页外壳：pane 尺寸、侧边栏、终端、面板宿主 |
| `packages/tui/src/plugin/render.tsx` | `Slot` 挂载断言、`PluginRoute`、崩溃边界 |
