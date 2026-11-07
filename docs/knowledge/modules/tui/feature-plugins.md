---
id: tui/feature-plugins
title: TUI 插件体系与内置功能插件
level: L2
layer: tui
status: stable
paths:
  - packages/tui/src/plugin
  - packages/tui/src/feature-plugins
  - packages/plugin/src/tui
symbols:
  - Plugin
  - PluginContextProvider
  - usePlugin
  - define
  - Definition
  - Cleanup
  - Context
  - SlotMap
  - SlotPath
  - SlotClaim
  - Keymap
  - KeymapLayer
  - KeymapCommand
  - UI
  - Storage
  - Data
  - Route
  - Page
  - Dialog
  - Toast
  - Attention
  - PanelPresentation
  - PluginProvider
  - PackageSource
  - PluginBoundary
  - PluginRoute
  - Slot
  - builtins
  - resolveSlots
  - contains
  - emptySlotted
  - PlacementKind
  - Placement
  - Claim
  - Slotted
  - Suppressed
  - Degraded
  - createPluginContext
  - createDialogApi
  - usePluginHost
  - Registry
  - SlotRender
  - RegisteredSlot
  - Dispose
  - createSourceWatcher
  - createMarkdownRenderer
  - discoverPluginTargets
  - localPluginDirectories
  - mergePluginTargets
  - Story
  - StoryFooter
  - StoryFooterControl
  - sessionTabsStory
  - oneCellSpinnerStory
  - todoStory
  - linkClicksStory
  - highlightsStory
  - mermanLayoutsStory
  - sessionLocationMissingStory
  - ONE_CELL_SPINNERS
  - SUBCELL_SPINNERS
  - PromptFooter
  - SidebarTodo
  - SidebarContext
  - SidebarOnboarding
  - SidebarLimit
  - SidebarMcp
  - Answer
  - GoalStatus
  - createGoal
  - PluginsDialog
  - StatsPoster
  - DiffFile
  - DiffViewerContent
  - DiffViewerFileTree
  - DiffViewerImage
  - homeFooterVisibility
depends_on:
  - core/plugin-system
  - tui/routes-shell
  - tui/components
related:
  - tui/prompt-editor
  - tui/theme-keybinds
  - tui/mini
config_keys:
  - plugins
  - experimental
keywords:
  - 插件
  - plugin
  - slot
  - 插槽
  - 路由
  - 热重载
  - storybook
  - 内置插件
  - 贡献点
source_hash: b86a06c85a886b165735c4affec19251d919bb6c
---

## 职责

TUI 侧的插件运行时 + 用同一套 API 写的"内置功能插件"：

- `packages/plugin/src/tui` 是公开 SDK：`Plugin.define({ id, setup })`、`PluginContextProvider`/`usePlugin`，以及 `Context` 契约（`data`/`client`/`theme`/`keymap`/`storage`/`markdown`/`ui`）。
- `packages/tui/src/plugin` 是宿主实现：provider（发现/激活/停用/热重载）、slot 解析策略、slot/route 渲染与崩溃边界、插件 markdown 代码块渲染器、源码监听。
- `packages/tui/src/feature-plugins` 是内置插件本身：home/prompt/sidebar 页脚与侧栏块、diff 查看器、通知、插件管理对话框、统计海报、以及 `system/storybook`（开发用故事集）。

## 边界

做什么：插件生命周期与贡献点（slot / route / palette 命令 / keymap 层 / markdown 渲染器 / storage），以及内置插件的内容。

不做什么：
- 不做服务端插件（`@opencode/plugin` 的 Effect/Promise 版本在别处；`src/gui/` 是 GUI SDK，`packages/plugin/AGENTS.md` 明确 GUI SDK 不进 server 也不进 TUI）。
- 不做插槽放置策略以外的布局：slot 只在宿主放好 `<Slot>` 的位置渲染。
- 不加载插件依赖图之外的代码（`#runtime-plugin-support` 是运行时支撑入口）。

## 入口与调用链

```
app.tsx → <PluginProvider packages={input.packages} directories={localPluginDirectories(...)}>
  → 内置 builtins（plugin/builtins.ts）+ 外部包/目录（discoverPluginTargets）
  → PackageSource.prepare(spec) 安装/解析 → 动态 import → plugin.setup(context)
  → 贡献登记到 Registry（routes / slots / markdown）与 keymap 层
App() → <Slot path="app"/> 、routes/* → <Slot path="session.composer.top"/> 等
       → plugins.slots.resolved() = resolveSlots({ paths, claims }) → 各 path 的 before/prepend/append/after/replace
route.data.type === "plugin" → <PluginRoute/> → plugins.route(id, name) → <PluginBoundary><Page/></PluginBoundary>
```

- 插件自带命令：`context.keymap.layer(() => ({ mode?, enabled?, target?, priority?, commands, bindings }))`，与宿主用同一张 keymap（见 `tui/routes-shell`）。
- 面板：`context.ui.panel.open(name, { presentation })` 打开当前会话的 `session.panel` 插槽；宽度不足 `SESSION_PANEL_SPLIT_MIN_WIDTH` 时强制全屏。
- 源码变化：`createSourceWatcher` 监听插件源码（按父目录监听 + basename 过滤 + 跟随符号链接目标），触发重新解析/激活。

## 数据与状态

- 插件状态三态：`active | inactive | failed`（`PluginProvider` 的 `State`），`failed` 存错误文本；另有 `unsupported`（缺 runtime 支持）。
- `Registration` 保存 `{ plugin, source, target, version, options, active, routes, slots, markdown, cleanups }`；禁用即跑 `cleanups`，再启用重建 —— 热重载走"新一代 desired 集合与当前集合求差"。
- slot 注册是**引用计数**的：`plugin.slots.register(path)` 返回注销函数，同一 path 可以多处挂载（每个会话 tab 一个 composer floor）。
- `resolveSlots({ paths, claims })` 返回 `{ slotted, suppressed, degraded }`：`slotted` 是每个挂载 path 的放置桶，`suppressed`/`degraded` 是诊断（被吞掉的 claim、降级到哪个祖先）。
- 插件 `storage.store(key, { initial })` 是 TUI 的 durable JSON store（热重载与重启后保留，多实例间同步）；`storage.memory(key)` 是进程内、跨插件代际存活、退出即失。
- 内置插件顺序即 `builtins` 数组顺序（影响同 anchor 下的共存顺序）；只有 `OPENCODE_STORY` 设置时才注册 storybook。

## 关键不变式

- **插槽路径是公开 API**（`@opencode/plugin/tui/context` 注释原文：`Paths and their inputs are documented API: coarse, few, and kept stable across host refactors`）：当前固定 10 个 —— `app`、`home.footer`、`home.footer.status`、`prompt.footer`、`prompt.footer.status`、`prompt.footer.file`、`session.composer.top`、`session.panel`、`sidebar.content`、`sidebar.footer`。加路径是破窗，先确认没有别的办法。
- **一个 claim 只能有一个放置键**：`SlotClaim` 用 `prepend/append/before/after/replace` 的 `?: never` 互斥，"两个放置键"是类型错误，不是静默优先级。
- **放置策略**：同 target 的 `replace` 后启用者胜；**祖先 replace 无视启用顺序吞掉后代**（hierarchy beats timeline）；被 replace 边界覆盖的 prepend/append 计入其内容而被抑制；target 不存在时，additive claim **降级**到最近存活祖先的 append（`degraded` 记录），replace 则被抑制（`suppressed`，缺失不降级）。
- **路径包含规则只有一条**：`contains(ancestor, path) = path.startsWith(ancestor + ".")`；`<Slot>` 挂载时若父插槽不包含它会**当场抛错**（宿主代码才会踩到，插件不能挂 slot）。
- **崩溃隔离**：每个 slot 与每个 plugin route 都包 `PluginBoundary`（`ErrorBoundary` + 一次 error toast），route 的 boundary 是 keyed 的，否则一次崩溃会锁死后续路由。
- **slot 里禁止裸文本**：`PluginOutput` 检测到 `string | number` 直接抛 `rendered bare text; wrap it in <text>`。
- **降级必须 append**：父 slot 先于子 slot 注册、`<Slot>` 把 append 渲染在后面，这个顺序保证嵌套挂载期间的临时降级不会实例化任何东西（`structure.ts` 注释）。
- **storybook（根 AGENTS.md「TUI Stories」）**：story 一律放 `packages/tui/src/feature-plugins/system/storybook` 并在 `index.tsx` 注册；**渲染真实生产组件**而不是视觉复制；提交等副作用限制在 story 内以便反复探索；有意义的状态维度要暴露成 story 快捷键并**列在 `StoryFooter` 里**，组合会让人困惑时提供 reset 命令；用 `OPENCODE_STORY=<story-id> bun run dev:live` 跑单个 story；布局相关时要在窄/宽终端各验证一次。
- **实验注册表**（`packages/tui/AGENTS.md`）：临时 UI 实验进 `component/dialog-experiments.tsx` 的 `experiments` 注册表并用对应 `config.experimental` 键门控；框架永久，不得因注册表为空而删除。

## 扩展点

- **加一个内置功能插件**：`packages/tui/src/feature-plugins/<area>/<name>.tsx`，`export default Plugin.define({ id, setup(context){ context.ui.slot({ append: "sidebar.content", render }) } })` → 加进 `packages/tui/src/plugin/builtins.ts` 的数组（位置决定同 anchor 顺序）。
- **加一个第三方插件（本地开发）**：放到配置目录或项目 `.opencode/plugins/<name>/`（`discoverPluginTargets` 只收目录/符号链接），导出 `Plugin.define`；热重载由 `createSourceWatcher` 自动触发。
- **加一个新 slot 路径**：`packages/plugin/src/tui/context.ts` 的 `SlotMap` 加 path 与 input 类型 → 宿主处放 `<Slot path input/>` → 文档化（这是公开 API）。
- **加一个插件 markdown 渲染器**：`context.markdown.registerCodeBlockRenderer(language, render)`。
- **加一个 story**：见上面硬约束；story 内部用 `props.context.keymap.layer` 绑状态维度，`StoryFooter` 列控制项。

## 常见改法与坑

- 在 `<Slot>` 内 `<text>` 外直接拼接字符串 → 运行时抛错（插件作者最常见的坑）。
- 在同一 target 同时写两个放置键 → 类型层报错；动态构造 claim 时要确保只有一个键为真。
- `replace` 了某个 slot 却期望"原内容仍在"：replace 会吞掉边界内所有 claim，只保留 `before`/`after` 兄弟。
- 依赖插件"一定能挂上"某个 path：宿主可能不再发布它，additive claim 会静默降级到祖先（`degraded` 里能查到），要断言就用 `degraded`。
- 在插件里缓存 `data.list()` 的数组引用：data 层是响应式 store 投影，跨事件会 reconcile。
- 停用插件时忘记清 keymap 层：`keymap.layer()` 的清理在插件停用或创建它的 owner 销毁时执行，手动 create 的层要自己接 `Dispose`。
- `package.json` 的 `./gui/*` 导出为 `null`：插件不能 require GUI 模块；TUI 与 GUI SDK 的边界不能混。
- storybook 只在 `OPENCODE_STORY` 设置时注册；正常启动下命令面板里看不到它，不要以为坏了。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/plugin/src/tui/plugin.ts` | `Definition`/`define`：插件唯一入口形状 |
| `packages/plugin/src/tui/context.ts` | `Context` 契约、`SlotMap`、`SlotClaim`、`UI`/`Storage`/`Data` 接口 |
| `packages/plugin/src/tui/solid.ts` | `PluginContextProvider`/`usePlugin` |
| `packages/tui/src/plugin/context.tsx` | provider：发现、激活/停用、热重载、registry、markdown |
| `packages/tui/src/plugin/api.tsx` | 把宿主服务适配成 `Plugin.Context`（dialog/toast/panel/tabs/model/slot） |
| `packages/tui/src/plugin/structure.ts` | `resolveSlots`：放置桶、抑制、降级（纯函数） |
| `packages/tui/src/plugin/render.tsx` | `Slot` 挂载断言、`PluginRoute`、`PluginBoundary` |
| `packages/tui/src/plugin/builtins.ts` | 内置插件清单与 storybook 门控 |
| `packages/tui/src/plugin/discovery.ts` | 插件目录发现与 target 归一 |
| `packages/tui/src/plugin/watch.ts` | 源码监听（热重载） |
| `packages/tui/src/feature-plugins/system/storybook/index.tsx` | story 注册表、索引页、palette 命令 |
| `packages/tui/src/feature-plugins/system/storybook/footer.tsx` | `StoryFooter`（控制项展示） |
| `packages/tui/src/feature-plugins/system/plugins.tsx` | 插件管理对话框（激活/停用/更新） |
| `packages/tui/src/feature-plugins/system/diff-viewer.tsx` | diff 查看器插件（最大的内置插件） |
| `packages/tui/src/feature-plugins/sidebar/todo.tsx` | 最小的内置插件范例（slot + storage） |
