---
id: app/shell
title: 应用外壳（布局、标签页、命令面板与通知）
level: L1
layer: app
status: stable
paths:
  - packages/app/src/shell
  - packages/app/src/app.tsx
  - packages/app/src/entry.tsx
  - packages/app/src/desktop.ts
symbols:
  - AppBaseProviders
  - AppInterface
  - preloadRoute
  - currentRoute
  - useCurrentRoute
  - layoutSchema
  - layoutPersistence
  - initialLayout
  - tabKey
  - tabHref
  - draftHref
  - sessionHref
  - createLayoutIntentState
  - transitionLayoutIntent
  - createSidebarPeek
  - transitionSidebarPeek
  - createPanelMotion
  - panelsMoving
  - SESSION_PANES
  - placeSessionTabs
  - openSessionTab
  - closeSessionTab
  - sessionTabPane
  - notifySessionTabsRemoved
  - SESSION_TABS_REMOVED_EVENT
  - createNotificationCoordinator
  - showToast
  - ToastRegion
  - playSoundById
  - createTitlebarHistory
  - transitionRouteTab
  - createRouteTabSync
  - transitionTabsHydration
  - transitionTabPromotion
  - pushClosedTab
  - takeClosedTab
  - transitionScrollPersistence
  - createScrollPersistence
  - ensureSessionKey
  - pruneSessionKeys
  - transitionScopedSession
  - canPruneSessions
  - transitionFocusLock
  - COMMAND_SEARCH_ID
  - DEFAULT_PALETTE_KEYBIND
  - matchKeybind
  - formatKeybind
  - desktopZoomLevels
  - DESKTOP_MENU
  - transitionErrorPage
  - errorDescriptionKey
  - ErrorPage
  - getRelativeTime
  - compareSessionTime
  - createTabMemory
events:
  - opencode:session-tabs-removed
tests:
  - packages/app/src/shell/state/layout.test.ts
  - packages/app/src/shell/state/session-tabs.test.ts
  - packages/app/src/shell/tabs/tabs.test.ts
  - packages/app/src/shell/titlebar/route-machine.test.ts
  - packages/app/src/shell/commands/command.test.ts
  - packages/app/src/shell/panel-motion.test.ts
  - packages/app/src/shell/sidebar-peek-machine.test.ts
  - packages/app/src/shell/notifications/machine.test.ts
  - packages/app/e2e/shell-panel-spacing.spec.ts
  - packages/app/e2e/command-palette.spec.ts
depends_on:
  - app/runtime
  - app/settings
  - app/workspaces-servers
related:
  - app/home
  - app/providers-usage
  - app/composer
  - app/session-chat
  - desktop/renderer
  - ui/primitives
keywords:
  - 外壳
  - shell
  - 布局
  - titlebar
  - 标签页
  - tabs
  - 命令面板
  - palette
  - keybind
  - 通知
  - toast
  - inbox
  - 侧栏
  - sidebar
  - 面板动效
  - 错误页
  - 路由
source_hash: c286e1818f30d6c65c2f5eb46029b4090d41c321
---

## 职责

Web/桌面应用的外壳层：把「窗口骨架 + 导航 + 标签页 + 全局命令 + 全局反馈」拼起来，再把路由内容放进中栏。

- `app.tsx`：`AppBaseProviders`（meta / Font / ThemeProvider / LanguageProvider / UiI18nBridge / ErrorBoundary / QueryClient / DialogProvider / PluginRoot / FileComponentProvider）与 `AppInterface`（ServersProvider → SettingsProvider → Router(root=Root) → `AppRoutes`）。`Root` 是路由 root 组件，注释写明它「跨路由保持挂载」。
- `entry.tsx`：Web 入口。`#root` 的一次性挂载栅栏（`dataset.opencodeMounted`）、PWA standalone 路由恢复、`?auth_token` 转 `ServerConnection.Http`（`authFromToken` 后立刻从 URL 清掉）、Sentry 初始化、`serviceWorker` 注册。
- `desktop.ts`：给桌面渲染进程的公共出口（`AppBaseProviders`、`AppInterface`、`useCommand`、`useTabs`、`ServerConnection`、`createNamespaceStorage`、`usePluginServers` 等）。它只是 re-export，不含逻辑。
- `shell/shell.tsx`：默认导出外壳组件（`Layout`），渲染 `Titlebar` → 纵向标签侧栏（`#vertical-tabs-sidebar`）→ `<main>`（`PluginServerCover` + `Suspense` + 路由内容）→ 折叠态侧栏开关 → composer 触摸条挂载点 `[data-slot="composer-touch-bar-mount"]` → `PluginSlot at="window.bottom"` → `ToastRegion` / `UploadToastHost`。
- `shell/routes/`：`AppRoutes` 定义五条路由（`/`、`/settings`、`/server/:serverKey/session/:id`、`/new-session`、DEV/beta 才有的 `/components`）；`AppLayout` 决定「先连服务器还是先给外壳」（没有服务器、或唯一服务器 401 时给 `ConnectServerScreen`）。
- `shell/state/`：`layout.tsx`（`LayoutProvider`、`layoutSchema`、`currentRoute`、`useCurrentRoute`）、`session-tabs.ts`（pane 放置纯函数）、`intent-machine.ts`、`scoped-machine.ts`、`scroll.ts`/`scroll-machine.ts`、`helpers.ts`。
- `shell/tabs/`：`TabsProvider`（`tabs.tsx`）、标签存储 schema（`schema.ts`）、预览（`preview.ts`）、关闭历史（`closed.ts`）、tab memory、hydration/promotion 状态机、`project-sessions.ts`。
- `shell/titlebar/`：标题栏本体、标签条/竖排标签、inbox 侧栏、最近关闭菜单、Windows 菜单、前进/后退历史、路由-标签同步、标签重命名/预览/加载状态机。
- `shell/commands/`：命令注册表（`register`/options/执行）、命令面板与命令搜索、session 搜索、桌面菜单描述表、keybind 解析与匹配。
- `shell/notifications/`：toast 区域、`createNotificationCoordinator`（`navigator.locks` 跨窗口去重与焦点锁）、声音、系统通知、inbox 未读/旧数据迁移状态机。
- `shell/errors/`：`ErrorPage` 与错误页状态机（上报/导出/检查更新按钮的可用性）。
- `shell/layout/`、`shell/panel-motion.ts`、`shell/sidebar-peek.ts`、`shell/sidebar-toggle.tsx`、`shell/mobile-drawer.tsx`、`shell/mobile-panel-drawer.tsx`、`shell/time.ts`：外壳内的可复用零件。

## 边界

- **不做业务数据**：外壳不直接拉 session/message/model；数据来自 `app/runtime` 的 server ctx 与 `data.location.*`，外壳只读投影。
- **不做会话视图**：时间线、请求 dock、虚拟化在 `app/session-chat`；外壳只提供 `<main>` 与 `SessionRouteFrame` 的落位。
- **不做输入区**：composer 在 `app/composer`；外壳只留触摸条挂载点与 `window.bottom` 插件槽。
- **不做设置内容**：设置在 `app/settings`；外壳只提供 `SettingsSurfaceProvider` 与导航。
- **不做插件宿主**：插件挂载/桥接在 `app/runtime/plugin`；外壳只提供 `PluginServerCover`、`PluginSlot`、`[data-slot="composer-touch-bar-mount"]` 等挂载点，并通过 `TitlebarItems` 渲染插件声明的标题栏项。
- **不拥有连接与持久化底座**：`ServersProvider`、`persisted`、SSE 在 `app/runtime`。

## 入口与调用链

```
entry.tsx（web）                          desktop.ts（桌面渲染进程的 re-export）
  → AppBaseProviders                       → packages/desktop/src/renderer 的入口
  → PlatformProvider
  → AppInterface
      → ServersProvider → SettingsProvider
      → Router(root = Root)               ← 外壳跨路由保活的唯一所有者
          Root: TabsProvider → GlobalProvider → ProjectIconsProvider
                → BodyTypography → CommandProvider → DesktopCommands
                → VoiceProvider → [children, routes] → VoiceOverlay
      → AppRoutes
          AppLayout: 无服务器 / 唯一服务器 401 → ConnectServerScreen
                     否则 LayoutProvider → SettingsSurfaceProvider → PluginAttachment → <Shell>
          "/"                          → home/route Home
          "/settings"                  → settings/shell SettingsScreen
          "/server/:k/session/:id"     → SessionRouteFrame → TargetServerRoute → ServerProvider → session 路由
          "/new-session"               → new-session/route DraftRoute
          "/components"                → components-lab/lab（仅 DEV/beta 打包）

命令：任意组件 command.register("组", () => CommandOption[]) → CommandProvider 汇总
     → 命令面板/keybind → onSelect() → dialog.show(...) 或 tabs.select(...) / navigate(...)
标签：tabs.addSessionTab({server, sessionId}) → tabHref(tab) → navigate
      → route-machine/route-sync 把 URL 与标签条对齐
```

外壳自身注册三条命令：`sidebar`（`sidebar.toggle`，`mod+shift+b`，仅纵向标签时可用）、`palette`（`command.palette`，hidden，动态 import `HomeCommandPalette`）、`commands`（`commands.search` → `DialogCommandSearch`）。

## 数据与状态

- **layout 持久化**：`persisted({ ...Persist.global("layout"), previousKey: "layout.v6" }, layoutPersistence, initialLayout(...))`。schema 覆盖 `sidebar`（含 `workspaces` 记录与 `workspacesDefault`）、`terminal`、`review`、`fileTree`、`session.width`、`panelWidths`、`mobileSidebar`、`sessionTabs`、`sessionView`、`home.selection`。`sessionTabs`/`sessionView` 以 `SessionStateKey` 为键，迁移时过滤非法键并去重。
- **tabs 持久化**：`TabStorage`（`schema.ts`）的 `Session`/`Draft`/`Tabs`/`Info`/`Regions`/`Closed`；`LayoutRoute` 之外还有 `TabRegions`（side/bottom 开关与 sessionWidth/bottomHeight/splitRatio）。内存态另有 `createTabMemory` 与 `createSessionPreview`。
- **外壳尺寸**：侧栏宽默认 `DEFAULT_SIDEBAR_WIDTH = 344`（`state/layout.tsx`），拖拽手柄 `min 136 / max 640`（`shell.tsx`）；`--shell-inline-inset` 桌面 8px、移动 1px；`--shell-top-inset` / `--shell-bottom-inset` 会随标题栏位置、Windows 原生边框、安全区变化。
- **动效**：左栏与侧面板共用一条 spring（`panel-motion.ts`，0.3s，按移动距离平方根缩放 0.15–0.3s），peek 用更快的 0.18s（`sidebar-peek.ts`）；都乘 `motionTimeScale()`，并受 `prefersReducedMotion` 影响（改为淡入）。
- **通知**：`navigator.locks` 两把锁 `opencode:notification-focus` / `opencode:notification-delivery`，`MAX_CLAIMED = 500`；toast 走 `showToast` + `ToastRegion`。
- **滚动**：`createScrollPersistence` + `scroll-machine.ts` 保存每会话滚动位置（进 `sessionView.scroll`）。
- **跨窗口事件**：会话被删除时 `notifySessionTabsRemoved` 派发 `window` 上的 `opencode:session-tabs-removed`（detail 严格校验：`server`/`directory`/`sessionIDs` 缺一即忽略）。

## 关键不变式

- **外壳只有一个、且不随路由重挂**：`app.tsx` 的视觉布局在 router root 上，draft/session 路由只在其下覆盖 server 绑定的 provider。
- **`Root` 的顺序有意义**：`TabsProvider` 必须在最外（route-sync 依赖它），`VoiceOverlay` 在最后（覆盖层）。
- **侧栏与 peek 是同一个侧栏**：`sidebarHidden() = peek === undefined ? closed : min(closed, 1 - peek)`，视觉上「谁更靠里就显示谁」。reduced motion 下用 opacity 代替 translate。
- **关闭侧栏不卸载内容**：用 `[content-visibility:hidden]`，注释明确「不重排、重新打开复用布局」。
- **pane 放置由纯函数裁决**：`placeSessionTabs(previous, next, target)`——已存在标签保持原 pane，新标签按 target → 被替换位置 → 同插件上一个标签 → side 顺序落位；被选中的 pane 若其标签离开则选最近邻。
- **命令 id 谁最后注册谁生效**：`command.register("palette", ...)` 在多处注册（外壳与路由各自），"最新的赢"。
- **面板在飞或拖拽时隐藏 native view**：`panelsMoving() = flights > 0 || resizing`，`setPanelResizing` 必须接到 resize handle 的 `onDraggingChange`。
- **会话删除是广播而非内部状态**：任何模块（如 `home/sessions/archive.ts`）都要走 `notifySessionTabsRemoved`，否则标签条残留死标签。
- **错误页是兜底层**：`AppBaseProviders` 的 `ErrorBoundary` 直接渲染 `ErrorPage`，行为由 `transitionErrorPage` 决定，不要在路由层另造一套。
- **标题栏历史与路由标签同步是两条独立机器**：`createTitlebarHistory`（前进/后退）与 `createRouteTabSync`（URL ↔ 标签）不要合并成一条。

## 扩展点

- **加一条路由**：`shell/routes/routes.tsx` 的 `AppRoutes` 加 `<Route>`，并在 `preloadRoute` 里登记可预加载路径（`layout.tsx` 的 `currentRoute` 也要认识它，否则抛出 "Unrecognised route!"）。
- **加一条外壳命令**：在组件里 `command.register("<组>", () => [{ id, title: language.t(...), category, onSelect }])`，用 `command.keybindParts(id)` 显示键位；默认键位写进 settings 的 keybind 迁移表。
- **加一个标题栏项**：走 `runtime/plugin/titlebar-items` 的插件 API，外壳只渲染 `TitlebarItems`（不要直接改 `titlebar.tsx` 的私有区域）。
- **加一个通知来源**：`notifications/` 里加一条状态机事件 + `showToast`；跨窗口去重走 `createNotificationCoordinator` 的锁。
- **改侧栏动效/宽度**：宽度常量在 `state/layout.tsx` 与 `shell.tsx` 的 `ResizeHandle`，spring 在 `panel-motion.ts`，peek 常量在 `sidebar-peek-machine.ts`；三处要一起看。
- **加一个 pane 行为**：`state/session-tabs.ts` 的纯函数 + `layout.tsx` 里 `writeTabs` 的落位调用；`SESSION_PANES` 是单一事实来源。
- **加一个移动端抽屉**：复用 `mobile-drawer.tsx` / `mobile-panel-drawer.tsx`，内容与触发器由调用方给（见 `titlebar.tsx` 的用法）。

## 常见改法与坑

- **改 `layoutSchema` 要三处同步**：`layoutSchema` + `layoutPersistence` 的 `Persistence.legacy` 迁移 + `initialLayout()`。现有先例：`fileTree.tab` 新增时把旧布局的 `opened` 设为 true、宽度 260 → 200；`sidebar.workspaces` 从 boolean 迁成 record。
- **不要在外壳里发请求**：用 `global.serverCtx(key)` 暴露的 ctx；外壳拿不到就说明该 server 未就绪，应该显示空态而不是自己 fetch。
- `--shell-*` CSS 变量是与 session 头、Home、设置页共享的间距契约，改一处会连带这些表面（`shell.tsx` 里每个变量的注释都写了理由）。
- 移动断点是 `(max-width: 767px)`（`createMediaQuery`）：移动端不渲染纵向侧栏、标题栏可下置（`general.mobileTitlebarPosition`）。
- **store 写入必须整体替换对象**：`tabs.tsx` / `layout.tsx` 大量使用 `produce`；直接把模块级常量对象塞进 store 会被 Solid 合并（见 `packages/app/AGENTS.md` 的 state machine 段）。
- **不要在 shell 里保存「已关闭标签」的临时 UI 状态**：关闭历史有 `closed.ts`（`pushClosedTab`/`takeClosedTab`/`nextTabAfterClose`），别处另存会导致"最近关闭"对不上。
- **不要绕过 `ServerConnection.Key`**：`requireServerKey` 是 URL ↔ key 的唯一解码点，手写字符串比较会在 workspace 服务器上失配。
- **动效不要在组件里自己 `setInterval`**：用 `panelSpring`/共享时钟，否则 `renderer.idle()` 与快照测试会被永久动画挡住。
- **`entry.tsx` 的挂载栅栏不能删**：懒加载 chunk 会以另一个 URL 重新 import 入口，`dataset.opencodeMounted` 防止二次 `render`。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/app/src/app.tsx` | `AppBaseProviders` / `AppInterface`、路由 root 的 provider 顺序、ErrorBoundary |
| `packages/app/src/entry.tsx` | Web 入口：挂载栅栏、PWA、`auth_token` → ServerConnection、Sentry |
| `packages/app/src/desktop.ts` | 桌面渲染进程的公共出口（纯 re-export） |
| `packages/app/src/shell/shell.tsx` | 外壳骨架、侧栏/peek/paint、`--shell-*` 变量、三条自带命令 |
| `packages/app/src/shell/routes/routes.tsx` | `AppRoutes`、`AppLayout`（服务器门槛）、`ComponentsLab` 条件加载 |
| `packages/app/src/shell/state/layout.tsx` | `LayoutProvider`、`layoutSchema`/`layoutPersistence`、`currentRoute`、`writeTabs` |
| `packages/app/src/shell/tabs/tabs.tsx` | `TabsProvider`：标签条、预览、关闭历史、per-tab region 与 memory |
| `packages/app/src/shell/state/session-tabs.ts` | `SESSION_PANES`、`placeSessionTabs` 等 pane 纯函数 |
| `packages/app/src/shell/titlebar/titlebar.tsx` | 标题栏：横向标签条 / 竖排侧栏、inbox、移动端抽屉、标题栏项 |
| `packages/app/src/shell/commands/command.tsx` | 命令注册表、keybind 解析/匹配、palette 选项汇总 |
| `packages/app/src/shell/notifications/coordinator.ts` | `navigator.locks` 跨窗口通知协调 |
| `packages/app/src/shell/panel-motion.ts` | 面板 spring、`panelsMoving`、`guardClosingFocus` |
| `packages/app/src/shell/sidebar-peek.ts` | 侧栏 peek 的驱动与采样（`sidebarUnread` 也从这里出） |
| `packages/app/src/shell/errors/error.tsx` | `ErrorPage`（错误边界兜底屏） |
| `packages/app/src/shell/time.ts` | `getRelativeTime`（标签/列表的相对时间） |
