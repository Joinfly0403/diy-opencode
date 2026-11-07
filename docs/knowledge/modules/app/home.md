---
id: app/home
title: 首页（工作区选择、最近会话、新建会话与空态）
level: L1
layer: app
status: stable
paths:
  - packages/app/src/home
symbols:
  - Home
  - createHomeController
  - HomeController
  - transitionHomeSelection
  - selectHomeSelection
  - sameHomeSelection
  - createHomeProjectsController
  - createProjectActions
  - addProjects
  - transitionProjectImport
  - useRevealProject
  - createHomeSessionsController
  - createHomeSessionSearchController
  - transitionHomeSessionsLoad
  - selectHomeSessionsListView
  - homeSessionsQuery
  - loadHomeSessionIndex
  - parseHomeSessionIndex
  - mergeHomeSessionIndex
  - retainHomeSessions
  - buildHomeSessionRecords
  - homeProjectForSession
  - homeSessionLocation
  - HOME_SESSION_LIMIT
  - HOME_SESSION_PAGE_LIMIT
  - HOME_SESSION_INDEX_LIMIT
  - transitionHomeSessionRow
  - transitionHomeSessionSearch
  - createAltHold
  - archiveHomeSession
  - shouldOpenSessionInBackground
  - createHomeScrollController
  - HomeCommandPalette
  - HomeProjectsView
  - HomeSessionsView
  - HomeSessionRecord
  - fileManagerApp
tests:
  - packages/app/src/home/machine.test.ts
  - packages/app/src/home/sessions/index.test.ts
  - packages/app/src/home/sessions/records.test.ts
  - packages/app/src/home/sessions/row-machine.test.ts
  - packages/app/src/home/sessions/search-machine.test.ts
  - packages/app/src/home/sessions/load-machine.test.ts
  - packages/app/src/home/sessions/open.test.ts
  - packages/app/src/home/sessions/archive.test.ts
  - packages/app/src/home/projects/import-machine.test.ts
  - packages/app/e2e/home.spec.ts
depends_on:
  - app/shell
  - app/runtime
  - app/workspaces-servers
related:
  - app/composer
  - app/session-chat
  - app/providers-usage
  - session-ui/timeline-message
keywords:
  - 首页
  - home
  - 工作区
  - 项目选择
  - 最近会话
  - recent sessions
  - 新建会话
  - 空态
  - 会话搜索
  - 分组
  - today
  - 长按
  - 重命名
  - 归档
  - ScrollView
  - 命令面板
source_hash: 34832eed2cbeb40db43e11c33d6c9e9bb8922d7f
---

## 职责

路由 `/` 的首页：左侧工作区（项目）选择，右侧最近会话列表，外加新建会话入口、会话搜索与空态。

- `route.tsx`：页面组装。`data-slot="home-panel"` 的外观容器 + `ScrollView`（外部拇指轨道 `thumbContainer`）、移动端（`max-width: 767px`）项目下拉、`lg` 才出现的 280px + 720px 双栏。
- `model.ts`：`createHomeController`。读 `useLayout().home.selection`、`servers.visible`、插件服务器、当前 server 的 used projects，跑 `transitionHomeSelection` 并把选择写回 layout；对外的 `project` 表面含 `list/selected/newSession/select/add/openNewSession/openProjectSession`。
- `machine.ts`：`HomeSelectionState`（`hydrating` / `verifying` / `ready` / `disposed`）与 `HomeEnvSnapshot`、`HomeWorktreeSync`。纯函数 + effects（`selection.persist`/`worktrees.refresh`/`worktrees.list`/`project.add`）。
- `projects/`：项目区（`region.tsx` 容器、`view.tsx` 视图与 `HomeUtilityNav`）、`controller.tsx`（折叠状态 `home.servers`、目录选择、设置/帮助入口）、`actions.tsx`、`add.ts`（`addProjects`）、`import-machine.ts`（旧版本目录迁移的状态机）、`menu.tsx`、`reveal.ts`（在文件管理器中显示）、`file-manager.ts`、图标与 `view.css`。
- `sessions/`：最近会话。`controller.tsx`（分组、选中、打开、创建、删除对话框、按键命令）、`index.ts`（分页索引的读取与本地合并/裁剪）、`queries.ts`（`homeSessionsQuery`）、`records.ts`（`HomeSessionRecord` 投影）、`load-machine.ts`（加载/占位/揭示的完整生命周期）、`row-machine.ts`（行手势/菜单/重命名编辑器）、`search-machine.ts` + `search.ts`、`alt-hold.ts`、`archive.ts`、`open.ts`（`shouldOpenSessionInBackground`）、`view.tsx` / `region.tsx` / `view.css`。
- `scroll.ts`：分组标题的 sticky 与渐隐控制器（`createHomeScrollController`）。
- `start/command-palette.tsx`：`HomeCommandPalette`——外壳的 `command.palette` 命令在首页打开它（命令 + 设置 + 服务器会话条目）。

## 边界

- **不拥有选择状态**：`layout.home.selection`（`{ server?, directory? }`）存在 `app/shell` 的 `LayoutProvider` 里，本目录只经 machine 读写；不要另建一份 selection 存储。
- **不拥有标签与导航**：`openNewSession` / `openProjectSession` 直接调 `app/shell` 的 `createProjectSessionActions`（`tabs.newDraft` / `tabs.addSessionTab`）；首页不自己 `navigate`。
- **不拥有会话数据**：列表来自 server 的 `session.list`（`ctx.sdk.api.session.list`），首页只维护「一页 + 本地合并」的视图。
- **不渲染时间线**：点开会话后进入 `app/session-chat` 的会话视图。
- **不定义输入区与新建会话流程**：`/new-session` 的表单在 `app/composer`；首页只负责「带着哪个 server+directory 去开」。
- **不拥有空态以外的工作区管理**：完整的工作区/服务器管理在 `app/workspaces-servers` 与 `app/settings`。

## 入口与调用链

```
AppRoutes "/" → <Home/>（home/route.tsx）
  ├ createHomeController()            → layout.home.selection + servers + 插件服务器 + used projects
  │    └ dispatch(HomeSelectionEvent) → transitionHomeSelection → effects:
  │         selection.persist → layout.home.setSelection(...)
  │         worktrees.refresh / worktrees.list → ctx.sync.worktrees.*
  │         project.add → addProjects(ctx, directories) → project.added
  ├ createHomeProjectsController(home) → 目录选择器 / 折叠态 / reveal / 设置入口
  ├ createHomeSessionsController(home) → homeSessionsQuery → loadHomeSessionIndex → 分组
  ├ createHomeSessionSearchController(home, sessions)
  └ createHomeScrollController(sessions.data.groups)

新建会话：sessions/view.tsx 的 [data-action="home-new-session"]
  → sessions.session.create = home.project.openNewSession()
  → newSessionProject = 选中项目 ?? ctx.projects.last() ?? projects[0]
  → createProjectSessionActions().openProjectNewSession(conn, worktree)
  → ctx.projects.touch(directory) + tabs.newDraft({ server, directory })

打开会话：openProjectSession(conn, directory, session, { preview })
  → ctx.data.session.message.sync + ctx.projects.touch
  → preview ? tabs.previewSession(...) : tabs.select(tabs.addSessionTab(...))

命令面板：shell 的 command.palette → (动态 import) HomeCommandPalette
  → commandPaletteOptions(command.options) + 设置条目 + createServerSessionEntries（server 端搜索）
```

## 数据与状态

- **分页与上限**：`HOME_SESSION_PAGE_LIMIT = 500`（一次拉取）、`HOME_SESSION_LIMIT = 64`（首页展示）、`HOME_SESSION_INDEX_LIMIT = HOME_SESSION_LIMIT + SESSION_RECENT_LIMIT`（每个目录保留的行数）。`retainHomeSessions` 按 `pathKey(directory)` 分组、按 `time.updated ?? time.created` 排序后裁剪。
- **查询缓存**：`homeSessionsQuery` 的 `staleTime: 30_000`、`gcTime: Infinity`、`refetchOnMount/refetchOnReconnect: true`，`select` 返回不透明数组（避免 Solid Query 递归展开每个 session）。
- **加载生命周期**：`load-machine.ts` 的 `HOME_SESSIONS_STALE_MS`/`FETCH_TIMEOUT`/`CONNECT_TIMEOUT`/`PLACEHOLDER_DELAY_MS`/`REVEAL_MS`，视图由 `selectHomeSessionsListView` 派生（占位、加载、失败、超时都有状态）。
- **选择 machine**：`hydrating`（layout/服务器未就绪时只显示，不落盘）、`verifying`（当前 server 的项目未到，先挂起 directory 的判断）、`ready`、`disposed`；用户中途的选择记为 `override` 并优先。
- **项目折叠状态**：`Persist.global("home.servers")` 的 `{ collapsed: Record<string, boolean> }`。
- **行手势**：`HOME_SESSION_LONG_PRESS_MS`、`HOME_SESSION_LONG_PRESS_SLOP_PX`、`HOME_SESSION_RENAME_TIMEOUT_MS`；菜单/编辑器视图由 `selectRowMenu`/`selectRowEditor` 派生。
- **滚动**：sticky 标题常量 `HOME_SESSION_HEADER_STICKY_TOP = 12`、文本高 16、渐隐距离 16；用 `ResizeObserver` 重算偏移。

## 关键不变式

- **首页不写盘直到 hydrated**：`hydrating` 阶段只显示（存过的 server 若在列表里就显示它，否则第一个），避免用默认值覆盖用户选择。
- **selection 的相等性用 `sameHomeSelection`**：`selectHomeSelection` 的 memo `equals` 就靠它，否则每次 env 刷新都会触发重渲染。
- **`newSessionProject` 有明确回退链**：选中项目 → 该 server 最近使用 → 第一个项目；三者皆无则 `openNewSession` 直接返回（按钮由 `canCreate()` 关掉）。
- **分页索引的本地合并必须等价于全量合并**：`mergeHomeSessionIndex`/`parseHomeSessionIndex` 过滤掉子会话（`parentID`）与已归档会话，注释写明「在保留子集上合入本地会话与待删除项，结果与合入全量索引一致」。
- **后台打开由修饰键决定**：`shouldOpenSessionInBackground`——中键、Mac 的 Cmd、其他平台的 Ctrl 为后台；Shift/Alt 一律否。
- **删除会话要广播**：`archive.ts` 调 `notifySessionTabsRemoved`（`opencode:session-tabs-removed`），否则 `app/shell` 的标签条会留下死标签。
- **空态与失败态分开**：`home.sessions.empty`/`.empty.description`（真的没有会话）vs `home.sessions.load.failed`/`.timeout`（加载失败），不要用一句文案兜两件事。
- **项目列表来源是「本客户端用过的项目」**：`ctx.projects.used()`，不是 server 的全部项目；`projects.touch` 是让它记住的唯一入口。
- **工作区目录迁移只做一次**：`projects/import-machine.ts` 消费 `servers.projects.forServer(key).legacy()`，`projectsReady` 里包含「legacy 已清空」。

## 扩展点

- **加一种会话分组**：`sessions/controller.tsx` 的分组构造 + `home.sessions.group.*` i18n key；视图在 `view.tsx`，sticky 由 `scroll.ts` 处理。
- **加一种行的操作**：`row-machine.ts` 的事件/状态 + `view.tsx` 的菜单项 + `sessions/controller.tsx` 的命令注册。
- **加一个搜索来源**：`createHomeSessionSearchController`（`search.ts`）+ `search-machine.ts` 的 `HOME_SESSION_LOOKUP_TIMEOUT_MS`。
- **加一个项目操作**：`projects/actions.tsx` 的 `createProjectActions`、`menu.tsx` 的条目、`projects/view.tsx` 的按钮。
- **改空态/欢迎文案**：`home.sessions.empty*` 与 `home.project.missing.*`（项目目录已不存在时的提示）。
- **加首页可用的命令**：命令注册本身在 `shell/commands`，首页只需要出现入口（`HomeUtilityNav` 或 `HomeCommandPalette` 的条目来源）。

## 常见改法与坑

- **不要把 `home.selection` 写进本目录自己的 store**：它必须经过 `layout.home.setSelection`，否则刷新/多窗口会不一致。
- **不要在首页卸载时继续 dispatch**：`createHomeController` 的 `onCleanup` 会发 `disposed`，新增 effect 必须能被 `disposed` 收敛，否则迟到的结果会写回已消失的页面。
- **别对 `resource()` 直接读**：`packages/app/AGENTS.md` 的 Suspense 段要求先用 `resource.state` 守门，`projects/controller.tsx` 就是先等 `ready.promise` 再取 `_state`。
- **`createResource`/`createMemo` 的键要带目标身份**：切 server/目录后，旧 server 的列表不能继续显示（`load-machine` 的 `target` 与 attempt）。
- **长按与点击冲突**：行点击要检查 `selectRowSuppressClick`，否则长按打开菜单后还会误开会话。
- **滚动位置恢复要在 `onMount` 之后**（ref 早于挂载，见 `packages/app/AGENTS.md` 的 Scrolling 段）。
- **不要给 Home 换 `ScrollView` 之外的滚动实现**：外部拇指轨道（`thumbContainer`/`hoverTarget`）是 Home 与时间线专用的两种场景之一。
- **`command.palette` 在首页才弹 `HomeCommandPalette`**：其他路由的 palette 由各自 `command.register("palette")` 覆盖，别把首页的版本注册成全局。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/app/src/home/route.tsx` | `Home` 页面组装：移动端下拉、ScrollView、双栏布局 |
| `packages/app/src/home/model.ts` | `createHomeController`：选择、项目、新建会话、effect 执行 |
| `packages/app/src/home/machine.ts` | `HomeSelectionState` 状态机与 `selectHomeSelection`/`sameHomeSelection` |
| `packages/app/src/home/projects/controller.tsx` | 项目区控制器：折叠状态、目录选择、设置入口 |
| `packages/app/src/home/projects/view.tsx` | `HomeProjectsView`/`HomeUtilityNav` 与 `home-project-new-session` 按钮 |
| `packages/app/src/home/projects/import-machine.ts` | 旧目录迁移（只跑一次） |
| `packages/app/src/home/sessions/controller.tsx` | 分组、选中、打开、创建、删除与命令注册 |
| `packages/app/src/home/sessions/index.ts` | 分页索引的解析/合并/裁剪与三个上限常量 |
| `packages/app/src/home/sessions/load-machine.ts` | 加载/占位/揭示生命周期与超时常量 |
| `packages/app/src/home/sessions/row-machine.ts` | 行手势、菜单、重命名编辑器 |
| `packages/app/src/home/sessions/view.tsx` | 列表视图、分组标题、空态与 `home-new-session` |
| `packages/app/src/home/sessions/queries.ts` | `homeSessionsQuery` 的缓存策略 |
| `packages/app/src/home/sessions/records.ts` | `HomeSessionRecord` 投影与项目归属推断 |
| `packages/app/src/home/scroll.ts` | sticky 分组标题与渐隐滚动控制器 |
| `packages/app/src/home/start/command-palette.tsx` | `HomeCommandPalette`：命令 + 设置 + 服务器会话搜索 |
