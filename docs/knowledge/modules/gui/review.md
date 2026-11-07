---
id: gui/review
title: 变更审阅（diff 面板）
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/review
symbols:
  - ReviewDetails
  - ReviewDetailsView
  - ReviewDetailsFailure
  - createReviewModel
  - ChangeMode
  - Demand
  - ReviewModel
  - transitionReviewDiff
  - reviewDiffView
  - reviewDiffReady
  - transitionReviewFolders
  - reviewExpandedDiffs
  - reviewFolderCandidates
  - transitionReviewDetail
  - reviewDetailView
  - transitionReviewScreen
  - reviewScreenModel
  - reviewScreenDemand
  - transitionReviewScroll
  - transitionReviewRender
  - reviewPanelReady
  - createReviewInitGitState
  - transitionReviewInitGit
  - normalizePath
  - filterRenderableDiff
  - reviewDiffNeedsLoad
  - reviewDiffKinds
  - expandReviewFolders
  - filterReviewFiles
  - REVIEW_DIFF_TIMEOUT_MS
  - REVIEW_SCROLL_MAX_FRAMES
tests:
  - packages/gui-plugins/src/review/machine.test.ts
  - packages/gui-plugins/src/review/screen-machine.test.ts
  - packages/gui-plugins/src/review/folder-machine.test.ts
  - packages/gui-plugins/src/review/detail-machine.test.ts
  - packages/gui-plugins/src/review/scroll-machine.test.ts
  - packages/gui-plugins/src/review/kinds.test.ts
depends_on:
  - core/plugin-system
related:
  - gui/file
  - gui/details
  - gui/context
  - contracts/httpapi-protocol
keywords:
  - 审阅
  - review
  - diff
  - 变更
  - changes
  - git
  - branch
  - turn
  - 面板
source_hash: 851f0668cc63a5fe8ff02f0eb822a2b3f96313d4
---

## 职责

session 侧栏的"变更"面板：当前目录未提交改动（git / branch / turn 三种模式）的文件树、逐文件 diff、按目录折叠、以及把改动借给别的插件读。

- 对外两个契约：`Changes`（`@opencode/plugin/gui/review`，`gui/file`/`gui/details` 等消费）与 `ReviewDetails`（`contract.ts`，session 详情的 changes 行专用）。
- 模型：`model.ts` 的 `createReviewModel`，按 `Demand{tree,files,panel,details}` 决定加载什么。
- 状态机：`screen-machine.ts`（每个 session screen 一个 model）、`machine.ts`（diff）、`folder-machine.ts`、`detail-machine.ts`、`init-git-machine.ts`、`scroll-machine.ts`、`render-machine.ts`。

## 边界

做：
- 列改动文件（`FileDiffInfo`）、按目录折叠/展开、过滤、键盘导航（`kinds.ts` 的 `applyFileListKeyDown`）。
- diff 展示样式（unified/split）与展开模式（expand/collapse），两者都是持久化的 store。
- 没有 git 的目录给出"初始化 git"路径（`init-git-machine.ts`）。

不做：
- 不实现 diff 计算：行数据来自 server 的会话/文件 diff API（`@opencode/client/promise` 的 `FileDiffInfo`）。
- 不写文件、不提交：本面板只读；编辑与提交在别处。
- 不渲染文件树本身：用 `gui/file` 提供的 `FileTree` 契约（`Tree`/`List` 组件，`bindPlugin` 绑定到 file 的上下文）。
- 窄屏不显示面板 tab，改走 mobile view（`layout.narrow()` 时 `list` 返回空）。

## 入口与调用链

```
src/renderer.ts → review/renderer.tsx setup
  ctx.add(BuiltinPanel, { id: "main", region: "side", legacy: { review: "changes" }, wide: diffStyle === "split" })
  ctx.add(Command, { id: "open", bind mac ? "ctrl+meta+r" : "ctrl+alt+r" })
  ctx.add(MenuItem, { menu: "session.panel", order: 10 })
  ctx.add(LinkHandler, { priority: 1, match: origin === "review" })   // composer 里的 review 注释
  ctx.add(SettingsPage, { id: "mobile-diff", page: "general", section: "general" })
  ctx.provide(Changes, { diffs, ready, kinds, active, details, focus, open, watch })
  ctx.provide(ReviewDetails, { view, retry })
```

- 生命周期：`createKeyed(route)` 派发 `route.entered` / `route.left`；每个 model 建在 `createRoot` 里，`screen-machine` 用 `model.dispose` 效果回收。
- 面板渲染：`render` 里先 `dispatchScreen(panel.mounted)`（保证路由发布前就有 model），再 `createKeyed(frame.visible, () => onCleanup(watch(screen, "panel")))` 租约。
- 详情行：session 详情面板调 `ReviewDetails.view(session)`；`open(session)` 在 `Changes` 里同时服务宽窄屏。

## 数据与状态

4 个 store，全部在 `index.ts` 声明并带旧的键迁移：

| store | schema | 旧键（`from`） |
| --- | --- | --- |
| `diff` | `{ diffStyle: "unified" \| "split" }`（默认 `split`） | `layout` 的 `review.diffStyle` |
| `panel` | `{ expandMode: "expand" \| "collapse" }`（默认 `collapse`） | `review-panel-v2` 的 `expandMode` |
| `mobileDiff` | `{ wrap: boolean }`（默认 `true`） | `settings.v3` 的 `general.mobileDiffWrap` |
| `session` | `{ mode?, file?, open: string[] }` | `layout` 的 `sessionView`（按 session 切片） |

- `session` 是 `BuiltinStore.session` + `pick`：只含 scroll 等其它字段的条目返回 `undefined`，不会把别人的键吃掉。
- 每个 screen 的 model 状态在内存：`runtimes: Map<screenID, { attempt, model, dispose }>`，screen 用 `WeakMap<SessionScreen, number>` 编号。
- 重启后：tab 选择在 `layout`（`review:changes` 键），mode/file/open 在 `session` store；model 会重建并从 `Demand` 重新加载。

## 关键不变式

- **`Demand` 是加载的开关**：`{ tree, files, panel, details }` 四个计数，只有被 `watch` 租到的消费者才让 model 去加载。加一个新的消费方必须走 `Changes.watch(screen, source)`，别直接调 `model`。
- **一个 session screen 一个 model**：`screen-machine.ts` 用 screenID 而不是 session 键；同一 screen 切 session 时 model 通过 `view` 跟随，**不重建**（`equals: (a,b) => a.screen === b.screen`）。按 session 键缓存会每次切换都重建。
- **`ReviewDetails.view` 的 `error` 绝不显示成"没有改动"**：`contract.ts` 注释明确 "Never shown as a clean working tree"；`Changes.details` 在 error 时返回空数组，详情行要读 `ReviewDetails` 才能区分。
- **`wide` 跟随 split 模式**：`get wide() { return diff.value.diffStyle === "split" }`，因为并排 diff 需要更宽的 session 最小宽度。改布局前先看这里。
- **tab 对象必须稳定**：`tab` 是常量对象 + getter（`get title()`），而不是每次 render 新建；否则 strip 会重挂触发器。
- **`Panel.focus({ restored })`**：只有 `restored === false` 才表达"用户意图"的副作用；恢复选择时不要抢焦点或切 tab。
- **`legacy` 迁移不能丢**：`BuiltinPanel.legacy = { review: "changes" }` 把旧面板键映射到新 id；删掉会让老用户的选择丢失。

## 扩展点

**新增一种模式（例如"暂存区"）**：`model.ts` 的 `ChangeMode` → `machine.ts` 的 `ReviewDiffTarget`/加载 → `panel.tsx` 的模式切换 → `index.ts` 的 `SessionState.mode` 字面量（还有 `i18n/en.ts`）。

**新增一个给别处用的读接口**：在 `Changes` 契约（`packages/plugin/src/gui/review.ts`）加字段 → `renderer.tsx` 的 `ctx.provide(Changes, …)` 实现 → 消费方 `ctx.use(Changes)`。不要在本目录导出实现给别的插件 import。

**新增一个设置项**：本插件的设置走 `SettingsPage`（`page: "general"` / `section`），值放本插件的 store；不要让 host 提供偏好开关。

**改 diff 的渲染**：`panel.tsx` / `parts.tsx` / `mobile.tsx`；行数据与折叠逻辑在 `kinds.ts`，别再抄一遍。

## 常见改法与坑

- `reviewDiffNeedsLoad` / `filterRenderableDiff` 决定了"哪些 diff 需要额外加载"和"哪些行可以渲染"；在 UI 里加分支前先看这两个，容易漏掉 binary/过大文件。
- 目录折叠的路径规范化在 `kinds.ts` 的 `normalizePath`/`reviewRootDirectory`/`reviewDiffDirectory`；Windows 反斜杠与大小写敏感差异都在这里收口。
- `init-git-machine.ts` 有 30s 超时（`REVIEW_INIT_GIT_TIMEOUT_MS`）；初始化失败要让用户能重试，不要吞掉。
- `scroll-machine.ts` 有帧预算 `REVIEW_SCROLL_MAX_FRAMES = 60`；"用户已交互"之后不再恢复滚动，别在 effect 里重置。
- 窄屏 wrap 的开关放在 host 的 General 区（`SettingsPage` 的 `page`/`section`），文案仍是本插件的 `i18n`。
- 面板 `render` 里 `<Show when={model()} keyed>` 的 keyed 是必要的：model 换了必须重挂子树，否则闭包会抓住旧 model。
- `LinkHandler` 的 `priority: 1` 比 `gui/browser`（10）低；调整优先级会改变 composer 里链接的归属。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `review/index.ts` | `Plugin.define`：4 个 store（含旧键迁移与 `pick`）+ 多语言 |
| `review/contract.ts` | `ReviewDetails` 契约与 `ReviewDetailsView`/`ReviewDetailsFailure` |
| `review/renderer.tsx` | window 入口：面板、命令、菜单、链接、`Changes`/`ReviewDetails` 提供 |
| `review/model.ts` | `createReviewModel`：`ChangeMode`、`Demand`、diff/详情/折叠的装配 |
| `review/screen-machine.ts` | 每个 session screen 的 model 生命周期与租约 |
| `review/machine.ts` | diff 加载状态机（`REVIEW_DIFF_TIMEOUT_MS`） |
| `review/folder-machine.ts` | 目录折叠/展开 |
| `review/detail-machine.ts` | 单文件 diff 的两阶段加载（`scoped` / `bounded`） |
| `review/init-git-machine.ts` | 无 git 时的初始化流程 |
| `review/scroll-machine.ts` | 滚动保存/恢复与帧预算 |
| `review/render-machine.ts` | 面板与窄屏视图的就绪门 |
| `review/kinds.ts` | 路径规范化、可渲染过滤、键导航 |
| `review/panel.tsx` | 宽屏面板 UI |
| `review/mobile.tsx` | 窄屏视图 |
| `review/settings.tsx` | General 区的"窄屏 wrap"设置行 |
