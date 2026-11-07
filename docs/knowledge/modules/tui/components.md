---
id: tui/components
title: TUI 组件层与 OpenTUI 渲染约束
level: L1
layer: tui
status: stable
paths:
  - packages/tui/src/component
  - packages/tui/src/ui
  - packages/tui/src/context/theme.tsx
  - packages/tui/src/context/panel.tsx
  - packages/tui/src/component/prompt/index.tsx
symbols:
  - Dialog
  - DialogHeader
  - DialogFooter
  - DialogLayout
  - DialogBleed
  - DialogSelect
  - DialogSelectProps
  - DialogAlert
  - DialogConfirm
  - DialogPrompt
  - DialogHelp
  - DialogExportOptions
  - DialogExportResult
  - DIALOG_INSET
  - DIALOG_LIST_INSET
  - dialogWidth
  - FilePath
  - truncateFilePath
  - Link
  - clickedLink
  - PaneResizeHandle
  - createPaneResize
  - moveSelection
  - reconcileSelection
  - octantGlyph
  - oneCellFrame
  - spring
  - tween
  - createAnimatable
  - SESSION_SIDEBAR_WIDTH
  - SESSION_SIDEBAR_MAX_WIDTH
  - clampSessionTabsWidth
  - sessionTabsFitVertically
  - SESSION_PANEL_SPLIT_MIN_WIDTH
  - SplitBorder
  - EmptyBorder
  - Toast
  - ToastProvider
  - Spinner
  - SpinnerRenderable
  - SPINNER_FRAMES
  - OneCellSpinner
  - SessionTabs
  - SessionFrame
  - PanelHost
  - TerminalPane
  - TabPulse
  - RetryProvider
  - PatchDiff
  - CommandPaletteDialog
  - DialogConfig
  - DialogExperiments
  - experiments
  - ErrorComponent
  - FadeInText
  - Logo
  - MigrationOverlay
  - PluginRouteMissing
  - Reconnecting
  - StartupLoading
  - TodoItem
  - DialogThemeList
  - DialogSessionList
  - DialogModel
  - DialogMcp
  - DialogStatus
  - ThemeErrorToast
  - DialogDebug
  - Prompt
depends_on:
  - tui/routes-shell
  - tui/theme-keybinds
related:
  - tui/prompt-editor
  - tui/feature-plugins
  - tui/mini
keywords:
  - 组件
  - OpenTUI
  - 渲染器
  - Renderable
  - 对话框
  - toast
  - spinner
  - 主题 token
  - 动画
  - 布局
  - 实验开关
source_hash: b3ff0b4556b75a1eec3379143e8216f2a626c873
---

## 职责

主 TUI 的两个组件层次：

- `component/` —— 与业务耦合的具体组件：会话外壳与标签页（`session-frame`、`session-tabs`、`terminal-pane`）、约 30 个对话框（model/agent/mcp/config/session-list/theme-list/integration…）、命令面板、spinner、补丁 diff、错误屏、启动/重连/迁移覆盖层，以及 `component/prompt/`（输入框渲染层）。
- `ui/` —— 可复用的原语：对话框骨架（`Dialog`/`DialogHeader`/`DialogFooter`/`DialogLayout`/`DialogBleed`）、`DialogSelect` 与选择控制器、`Toast`、布局常量与 pane 尺寸计算、边框、链接、文件路径截断、动画（`spring`/`tween`/`createAnimatable`）、单格动画帧、octant 字形、拖拽手柄。

两者共同约定：颜色只从 `useTheme()` 的语义 token 取，尺寸只从 `ui/layout.ts` 取，动画只走 `ui/animation.ts` 的共享计时器。

## 边界

做什么：屏幕上的像素与交互（布局、焦点、鼠标命中、滚动框、动画帧、对话框栈的呈现）。

不做什么：
- 不做路由与命令注册（页面在 `routes/`，命令在 `context/keymap` 与 `app.tsx`）。
- 不做数据获取：组件从 `context/data`、`context/local` 读已投影的 store。
- 不定义主题 token 的取值（token 语义在 `packages/theme/src/tui`，见 `tui/theme-keybinds`）。
- 不实现插件插槽的解析策略（`Slot` 只渲染，策略在 `plugin/structure.ts`）。

## 入口与调用链

```
routes/*  → <DialogSelect/> / <Toast/> / <Dialog*/> / <Spinner/>          （页面内直接使用）
         → dialog.replace(() => <DialogX/>)                              （context/route 之外的 ui/dialog 栈）
ui/dialog.tsx  DialogProvider 维护 stack，key 去重、size 决定宽度
component/dialog-*.tsx  → 读 data/local/config → 调 client.api.* → toast 反馈
useTheme() → ResolvedTheme（含 surface("dialog")/"dialog.footer"）→ fg/background/border
```

- `DialogProvider`（`ui/dialog.tsx`）用 `zIndex 3000` 的绝对定位遮罩 + `RGBA(0,0,0,150)` 背景；点击遮罩关闭，但拖动产生的选区释放不会关闭（`renderer.getSelection()` 判断）。
- `DialogSelect` 自带 fuzzysort 过滤、分组、滚动框与 `select-controller` 的选中收敛；过滤框在 `setTimeout(…, 1)` 后聚焦。
- `Toast` 是绝对定位覆盖层（top 1 / right 2），`ToastOptions` 含 `variant: info|success|warning|error`、`duration`、可选 `action`。
- `SessionFrame` 组合 `Session`（routes）、`Sidebar`、`TerminalPane`、`PanelHost`，pane 宽度经 `createPaneResize` + `clampSessionPaneWidth` 持久化到 storage 的 `layout` 键。

## 数据与状态

- 组件本地状态一律 Solid `createStore`/`createSignal`；跨会话、跨重启的状态走 `useStorage()`（`context/storage.tsx`：JSON 文件 + flock + 原子写）或 `useLocal()`（模型/agent 选择、`model-preference`）。
- 对话框栈是内存态（`DialogProvider`），退出即失；对话框自己负责关闭（`dialog.clear()`）。
- 面板（`context/panel.tsx`）只有 `current`/`requested`/`width` 三个信号：宽度不足 `SESSION_PANEL_SPLIT_MIN_WIDTH` 时强制 `fullscreen`。
- 动画值是 renderer 时钟驱动的本地值，不写回 store；`ui/animation.ts` 用一个进程内的 `setInterval` 任务集合统一推进。
- spinner 帧数据是常量（`spinner-frames.ts`、`ui/one-cell-motion.ts`），无持久化。

## 关键不变式

- **主题 token 按语义角色选，不按当前颜色选**（根 AGENTS.md「TUI Theme Tokens」）：不许直接用 `theme.hue` 的原始值，也不许借一个不相关的语义 token 凑外观；`text.feedback`/`background.feedback` 只用于结果与状态反馈（error/warning/success/info）；表单控件文本、序号、选中标记用 `formfield`，动作态用 `action`；缺角色就先扩主题 schema + defaults + resolution + types，再在组件里用。
- 改公开主题 token 面时，必须同时验证内置亮/暗默认值与自定义主题回退路径，而不只是改到的那一个组件。
- **spinner 不能是 live 节点**（`spinner-renderable.ts` 注释）：live 节点让 renderer 永不走空，`renderer.idle()` 永不 resolve，而 mini 与 CLI 都在等它；改为由共享动画时钟在绘制时推进。
- **`OneCellSpinner` 必须留 idle 间隙**（`one-cell-spinner.tsx` 注释）：定时器持续跑会挡住 `renderer.idle()`，导致 mini 无法 flush 与接收输入。
- **transcript 行不要自己调 `useTerminalDimensions()`**：会为每个挂载组件注册一个 renderer resize 监听；用 `routes/session/render-context` 共享的尺寸。
- **样式常量集中**：对话框内边距 `DIALOG_INSET = 3`、列表行额外 1 格给 `▌`/`●` 标记（`DIALOG_LIST_INSET`）、宽度 `medium 60 / large 88 / xlarge 116`；会话 pane 宽度常量与上下界都在 `ui/layout.ts`。
- **实验必须走注册表**（`packages/tui/AGENTS.md`）：临时实验写进 `component/dialog-experiments.tsx` 的 `experiments` 注册表，并用对应 `config.experimental` 键门控；Experiments 框架是**永久基础设施**，注册表为空也不能删；毕业只删注册项与门控，放弃要删注册项、门控和行为。
- **字体与排版**（`packages/ui/AGENTS.md` 的排版段，TUI 侧沿用同一套度量）：`--line-height-tight 12px`、`compact 16px`、`base 20px`；13px 文本至少 16px 行高，否则 `g j p q y` 会被裁；`line-height: 1` 只留给非文本字形。
- **启动门控**：`App()` 在 `plugins.ready()` 之前不渲染页面主体，只在最后画 `StartupLoading`；组件若依赖插件注册的 slot，必须容忍"暂空"。

## 扩展点

- **加一个对话框**：`component/dialog-<name>.tsx` 用 `ui/dialog.tsx` 的 `Dialog`/header/footer 拼装 → 在 `app.tsx` 的 `appCommands()` 加命令并 `dialog.replace` → 若需要单例 key，用 `dialog.replace(fn, undefined, { key: "…", size })`。
- **加一个可复用原语**：放 `ui/`，从 `ui/` 里已有的布局常量/animation/theme token 取值；业务语义留在 `component/`。
- **加一种 spinner 形态**：帧序列加到 `ui/one-cell-motion.ts` 或 `component/spinner-frames.ts`，渲染走 `OneCellSpinner`；要新 Renderable 就照 `spinner-renderable.ts` 用 `extend()` 注册，并保持非 live。
- **加一个实验开关**：`component/dialog-experiments.tsx` 的 `experiments` 数组加 `{ id, title, description }` → 行为处读 `config.experimental[id]`（用 `useNewDesigns` 之类的 accessor 模式）→ 写测试覆盖开/关两条路径。
- **改布局常量**：只改 `ui/layout.ts`，并检查 `sessionTabsFitVertically`/`clampSessionTabsWidth`/`clampSessionPaneWidth` 三处消费者；面板分屏阈值会连带影响 `PanelHost` 的 fullscreen 判定。

## 常见改法与坑

- 在组件里 `RGBA.fromInts(...)`/`fromHex(...)` 写死颜色会绕过主题与亮暗切换；除遮罩透明度这类结构性颜色外不要这么做。
- `DialogSelect` 的过滤框聚焦是定时器，测试或脚本在挂载瞬间发键会丢键（先等 `InputRenderable` 成为焦点）。
- `renderer.useMouse` 由 `config.mouse` 驱动，组件里再设一次会与全局 effect 打架。
- 第二次点击同一 renderable（500ms 内、1 格内）会被当成选词/选行，点击关闭类交互要先 `clearSelection()` 或隔开 ≥2 格。
- `<text>` 外直接放字符串在插件 slot 里会抛错（`plugin/render.tsx` 的 `PluginOutput`），组件边界内也要遵守同样的结构约束。
- 大量列表用 `For` 而不是 `Index`，行身份变化时才会复用；反过来 `Index` 在项目插入/删除时保留 DOM 位置。
- 动画默认受 `config.animations` 约束（`app.toggle.animations` 命令会改它），新增动效要读这个开关而不是自己发明配置。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/tui/src/ui/dialog.tsx` | 对话框骨架、stack/provider、尺寸与内边距常量 |
| `packages/tui/src/ui/dialog-select.tsx` | 通用选择器：过滤、分组、滚动、选中收敛 |
| `packages/tui/src/ui/select-controller.ts` | 选择索引的移动/收敛纯函数 |
| `packages/tui/src/ui/toast.tsx` | toast 覆盖层与队列 |
| `packages/tui/src/ui/layout.ts` | 侧边栏/标签条/pane 宽度常量与 clamp |
| `packages/tui/src/ui/animation.ts` | spring/tween 与共享动画任务循环 |
| `packages/tui/src/ui/one-cell-motion.ts` | 单格动画帧与种子/工作态常量 |
| `packages/tui/src/component/spinner-renderable.ts` | 自定义 `SpinnerRenderable`（非 live） |
| `packages/tui/src/component/session-frame.tsx` | 会话页外壳与 pane 拖拽 |
| `packages/tui/src/component/session-tabs.tsx` | 标签条渲染、跑马灯、未读脉冲 |
| `packages/tui/src/component/panel-host.tsx` | 插件面板/全屏宿主与 slot 挂载点 |
| `packages/tui/src/component/dialog-experiments.tsx` | 实验注册表与开关持久化 |
| `packages/tui/src/context/theme.tsx` | 组件侧主题上下文、surface 切换、主题错误上报 |
| `packages/tui/src/context/panel.tsx` | 面板状态与分屏/全屏判定 |
