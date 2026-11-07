---
id: gui/file
title: 文件面板与文件链接
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/file
symbols:
  - OpenAppPreferences
  - OpenApp
  - FileContext
  - FileShared
  - useShared
  - createArtifactViewerState
  - transitionArtifactViewer
  - selectArtifactMode
  - selectArtifactPreviewable
  - transitionImageStageGesture
  - transitionVideoOverlay
  - createLinkExistsState
  - transitionLinkExists
  - linkExistsAnswer
  - createLinkOpenState
  - transitionLinkOpen
  - createOpenInAppState
  - transitionOpenInApp
  - createPickerState
  - transitionPicker
  - pickerFilterText
  - createPierreTreeState
  - transitionPierreTree
  - buildLiveTreeInput
  - buildAllowedTreeInput
  - FILE_TREE_ROW_HEIGHT
  - normalizeFileTreeV2Path
  - fileTabId
  - fileTabPath
  - isFileTab
  - pathToFileUrl
  - workspaceFileUrl
  - resolveOpenInAppPath
  - parseFileLink
  - resolveArtifactPath
  - parseDelimited
  - splitFrontmatter
  - startFileDrag
  - FILE_SEARCH_TIMEOUT_MS
  - LINK_EXISTS_TIMEOUT_MS
tests:
  - packages/gui-plugins/src/file/path.test.ts
  - packages/gui-plugins/src/file/resolve-link.test.ts
  - packages/gui-plugins/src/file/tree-model.test.ts
  - packages/gui-plugins/src/file/link-exists-machine.test.ts
  - packages/gui-plugins/src/file/link-open-machine.test.ts
  - packages/gui-plugins/src/file/artifact.test.ts
depends_on:
  - core/plugin-system
related:
  - gui/review
  - gui/browser
  - gui/microsoft-office
  - gui/terminal
  - core/tool-registry
keywords:
  - 文件
  - file
  - 树
  - tree
  - 预览
  - artifact
  - 链接
  - link
  - 打开方式
  - open in app
source_hash: 8f0ded610196486c0a479e6cc71573de0200e62f
---

## 职责

session 侧栏的文件浏览器：一棵工作区文件树 + 每个被打开文件的 tab（源码/预览）、消息里路径链接的判定与打开、以及"用外部 app 打开"。

- window 入口 `renderer.tsx`：`BuiltinPanel`（id `main`）、`LinkHandler`（`match: () => true` + `exists`）、`Command`、`BuiltinSlot`、两个对外契约。
- 子面板：`browser.tsx`（文件浏览器+树）、`pierre-tree.tsx`（`@pierre/trees` 适配）、`list.tsx`（扁平列表）、`mobile.tsx`（窄屏）、`artifact-view.tsx`（图片/视频/CSV/Markdown/代码预览）、`open-in-app.tsx`。
- 逻辑机：`link-open-machine.ts`、`link-exists-machine.ts`、`picker-machine.ts`、`pierre-tree-machine.ts`、`artifact-view-machine.ts`、`scroll-machine.ts`、`search-machine.ts`、`open-in-app-machine.ts`。

## 边界

做：
- tab 的 id/路径编解码（`path.ts`）、打开与去重、缺失文件标记、滚动位置。
- 把消息里的路径变成链接：存在性检查（带 TTL 缓存）、相对/绝对解析、命中多个时退化成 picker。
- 把 workspace 里的 HTML 交给浏览器面板（`gui/browser` 的 `Browser` 契约），不可用时回退成 tab。
- 通过 `FileTree` 契约把树/列表借给 `gui/review` 渲染（review 的面板在本插件下渲染）。

不做：
- 不读文件内容：一切内容来自 `SessionScreen` 的 `file` 模型（`screen.file.sync/get/root/exists/missing/watch/unwatch`）。
- 不实现 diff：改动状态经 `Changes` 契约（`@opencode/plugin/gui/review`）读取。
- 不实现富文档渲染：Office 由 `gui/microsoft-office` 的 `FileViewer` 承担。
- web 上没有"用外部 app 打开"：`desktop` 缺失时 `OpenInApp` 契约什么都不渲染。

## 入口与调用链

```
src/renderer.ts → file/renderer.tsx setup
  storage.memory("handoff")            // 每 session 的选中行范围
  ctx.stores.app                       // 只有 desktop 读 open-in-app 选择
  ctx.use(Changes) / ctx.use(Browser)  // 两个外部契约（Live）
  ctx.add(Style, tabStyles)
  ctx.add(BuiltinPanel, { id: "main", region: "side", legacy: { "open-file": "open" }, normalize })
  ctx.add(Command, { id: "browse", bind mac ? "ctrl+meta+p" : "ctrl+alt+p" })
  ctx.add(MenuItem, { menu: "session.panel", order: 30 })            // 总是再开一个 launcher
  ctx.add(BuiltinSlot, { at: "session.location.path.menu" })          // desktop 才有
  ctx.add(LinkHandler, { match: () => true, exists: linkExists, open })
  ctx.provide(OpenInApp, { Button }), ctx.provide(FileTree, { Tree, List })
```

- 打开一个文件：`open(session, path, options)` → `layout.open(key(screen.file, path), …)` → `dispatchPicker(file.opened)` → `screen.file.sync(path)`。
- 点链接：`LinkHandler.open` → `dispatchLink(link.clicked|link.exact)` → `resolveLink()`（`findFileLink` / `parseFileLink`）→ 效果 `open-exact` / `open-picker` / `open-browser` / `sync`。
- 打开方式：`open-in-app-machine.ts` → `desktop.installed(openWith)` / `desktop.launch` / `desktop.reveal`，各有自己的超时。

## 数据与状态

- store `app`（`apps.ts` 的 `OpenAppPreferences`），`Store.global(…, { app: "finder" }, "open.app")`——旧的 `open.app` 键一次性导入；键最终在 `plugin.file.*`。
- memory storage `handoff`：`{ sessions: { [sessionKey]: { [path]: LineRange | null } } }`，最多保留 `HANDOFF_SESSIONS = 40` 个 session（写时裁剪）。
- tab id：`fileTabId(files, path)` = `//<encodeFilePath(resolve(path))>`；`isFileTab` 判 `//` 前缀；launcher id 是 `open` / `open:<uuid>`。
- 链接存在性缓存：`linkChecks` 是 `WeakMap<SessionScreen, WeakMap<ServerRef["client"], LinkChecks>>`——screen 生命周期 + 连接实例双键，server 重连换 client 后旧结果自动不可达。条目上限 `LINK_EXISTS_MAX_ENTRIES = 512`，正向 TTL 60s、负向 5s。
- 树的状态与滚动：`pierre-tree-machine.ts` + `layout.scroll.get/set`；每个文件 tab 的滚动由 `scroll-machine.ts` 管（含"用户已交互"标记）。

## 关键不变式

- **一个文件 = 一个 tab**：`normalize` 钩子把旧版本存的绝对路径 tab 规范化为 `//<encoded>`，且只解析一次再编码，避免 `a%23b.txt` 这类名字被二次解码。
- **launcher 是 transient**：`transient: true`，下一个预览会替换它；窄屏既不存储也不选中它。
- **`open()` 不能进 `batch`**：源码注释写明 mobile tab strip 必须在新 tab 注册之后才离开浏览器，否则 Kobalte 会回退到第一个 tab 并重新选中。
- **链接解析优先级**：绝对路径 / 相对文档的链接 / agent 预览（`link.background`）→ 直接开那一个文件；普通相对链接 → 先 `findFileLink` 搜索，命中多个 → picker，无命中 → 仍开字面路径（覆盖被索引跳过的文件，例如 `.env`）。
- **取消/失败不算缓存否定**：`linkExists` 里 aborted、failed、已不 current 的检查都走 `check.dropped`，不写负缓存。
- **HTML 去浏览器，其余进 tab**：`fileOrPage` 只在 `artifactKind(path) === "html"` **且** `Browser` 契约 active 且 `canOpen` 时才交出去。
- **`FileTree`/`OpenInApp` 的组件必须 `bindPlugin`**：绑定后在 provider（本插件）的上下文里 `usePlugin`，否则消费方（review）会读到自己的上下文（AGENTS.md 明确要求，并要标注 props 类型）。
- **禁止模块级状态**：所有 cache 都在 `setup` 内（`tabs`、`focused`、`linkChecks`、`revealListeners` …）。

## 扩展点

**新增一种可预览的 artifact 类型**：`artifact.ts`（`artifactKind` 之外的解析/切片帮手）+ `artifact-view-machine.ts`（`ArtifactMode` 与 `selectArtifactStageKind`）+ `artifact-view.tsx` 的渲染分支。若要独立成"看图"类面板，参考 `gui/microsoft-office` 的 `FileViewer` 注册方式，不要塞进本目录。

**新增一个"打开方式"**：`apps.ts` 的 `OPEN_APPS` + `OpenAppPreferences` → `open-in-app-machine.ts` 的超时/结果 → `open-in-app.tsx` 的菜单 → `i18n/en.ts`。

**新增一个文件来源**（例如虚拟文档）：`context.ts` 的 `FileShared` 接口是这个插件的内部契约，加能力要同时改 `FileProvider` 的 provider 与所有 `useShared()` 消费者。

**新增一个 link handler**：不要在本插件再加一个 `match`；链接优先级由 `priority` 排（本插件不设 priority，review 是 1、browser 是 10），冲突时改对方的 priority。

## 常见改法与坑

- `fileTabId`/`fileTabPath`/`isFileTab` 是 tab id 的唯一出入口，任何地方自己拼 `//...` 都会在带 `#`/`?`/`%` 的路径上出错。
- `resolve(files, value, base)` 同时处理 `skill://`、Windows 盘符、以 `/` 开头的绝对路径、workspace 相对路径，以及"爬出 workspace 根"的相对链接（`../../shared/x.pdf` 仍可打开）。改它要连带看 `resolve-link.ts`。
- 打开不在工作区的文件会拿到绝对路径；`builtinPanel.normalize` 与 `fileTabPath` 都假定 `screen.file.ready()`，`ready()` 为假时不要规范化。
- 搜索有独立预算（`FILE_SEARCH_TIMEOUT_MS = 10_000`），超时表现为 `{ type: "timeout" }`，UI 必须给出可重试的状态而不是空列表。
- 拖拽（`startFileDrag`）依赖桌面端的文件拖出能力；web 上没有，别把逻辑放进共享路径。
- `desktop` 只在 Electron 里存在：`ctx.desktop` 为 undefined 时所有 `launch/reveal/installed` 调用要走失败分支（`runOpenInApp` 里显式抛 `common.requestFailed`）。
- 树的行高是常量 `FILE_TREE_ROW_HEIGHT = 28`，改它要同时看虚拟化与拖拽命中。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `file/index.ts` | `Plugin.define`：`app` store + 多语言目录 |
| `file/renderer.tsx` | window 入口：面板、链接处理、picker、契约提供 |
| `file/browser.tsx` | 文件浏览器主体（树 + 空白态 + 搜索） |
| `file/pierre-tree.tsx`、`pierre-tree-machine.ts` | `@pierre/trees` 适配与状态机 |
| `file/artifact-view.tsx`、`artifact-view-machine.ts` | 预览（图片/视频/CSV/Markdown/源码）与手势 |
| `file/artifact.ts` | 内容 → 字节/blob、frontmatter、CSV 解析、路径解析 |
| `file/path.ts` | `fileTabId`/`fileTabPath`/`isFileTab`/URL 转换 |
| `file/resolve-link.ts` | `parseFileLink`、`findFileLink`、存在性检查 |
| `file/link-open-machine.ts`、`link-exists-machine.ts` | 链接打开与存在性缓存 |
| `file/context.ts` | `FileShared`/`FileContext`：插件内部共享面 |
| `file/open-in-app.tsx`、`open-in-app-machine.ts`、`apps.ts` | 外部 app 打开 |
| `file/picker-machine.ts` | launcher 的过滤/焦点/浏览状态 |
| `file/scroll-machine.ts` | 每个文件 tab 的滚动保存与恢复 |
| `file/tree-model.ts` | 树输入构建、git 状态层、行高常量 |
| `file/styles.ts` | `?inline` CSS 汇总（通过 `ctx.add(Style, …)` 提交） |
