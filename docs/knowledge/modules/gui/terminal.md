---
id: gui/terminal
title: 终端面板（服务端 PTY）
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/terminal
symbols:
  - terminalToggleCommand
  - createTerminalModel
  - TerminalModel
  - TerminalSession
  - initialState
  - transition
  - serverAvailable
  - sessionView
  - tabHidden
  - tabTargetable
  - createConnectionState
  - transitionConnection
  - canAcceptOutput
  - transitionPane
  - paneRevealed
  - createPaneDispatch
  - createDispatch
  - terminalTabLabel
  - defaultTitle
  - titleNumber
  - terminalWriter
  - createQuoteState
  - transitionQuote
  - createQuoteDispatch
  - transitionRename
  - initialSurfaceState
  - terminalKeyInput
  - TERMINAL_REQUEST_TIMEOUT_MS
  - GHOSTTY_LOAD_TIMEOUT_MS
  - TERMINAL_CONNECT_TIMEOUT_MS
  - TERMINAL_SIZE_DEBOUNCE_MS
tests:
  - packages/gui-plugins/src/terminal/machine.test.ts
  - packages/gui-plugins/src/terminal/model.test.ts
  - packages/gui-plugins/src/terminal/connection-machine.test.ts
  - packages/gui-plugins/src/terminal/pane-machine.test.ts
  - packages/gui-plugins/src/terminal/quote-machine.test.ts
  - packages/gui-plugins/src/terminal/writer.test.ts
depends_on:
  - core/plugin-system
related:
  - gui/ssh
  - gui/wsl
  - gui/file
  - core/pty-shell-worktree
keywords:
  - 终端
  - terminal
  - PTY
  - ghostty
  - tab
  - 会话
  - 引用
  - quote
source_hash: 4c50c8a339ca1269b88d67a9a08025ada8cb4072
---

## 职责

给每个 session 一块侧栏终端：tab 是服务端 PTY 的一个附着（attach），window 侧只做渲染、输入、tab 管理与快捷键。

- window 模型（`model.ts` 的 `createTerminalModel`）：列表/新建/选择/关闭/重命名/焦点请求，全部经 server 的 terminal API。
- 状态机：`machine.ts`（列表与 tab 视图）、`connection-machine.ts`（一次附着的状态与角色）、`pane-machine.ts`（`ghostty-web` chunk 与连接）、`surface-machine.ts`、`quote-machine.ts`、`rename-machine.ts`、`focus-machine.ts`。
- 渲染：`panel.tsx` → `terminal.tsx`（ghostty 实例）→ `writer.ts`（分块写入）；`label.tsx`/`quote.tsx` 是 tab 标签与引用浮层。

## 边界

做：
- 一个 session 多个终端 tab；tab 名跟随 PTY 标题（`title.ts` 的 `terminalTabLabel`/`defaultTitle`/`titleNumber`）。
- 键盘事件转换（`terminal-key-event.ts`）、引用选中文本到 composer（`quote-machine.ts`+`quote.tsx`）。
- 在 location 的 branch 菜单里加"打开终端"一项。

不做：
- 不实现 PTY：进程、大小、退出都在 server 侧（见 `core/pty-shell-worktree`）。
- 不实现终端仿真：用 `ghostty-web`，本目录只做适配（`runtime-adapters.ts`）。
- server 没有持久终端能力时**不注册任何终端命令**：`enabled()` 由 `model.available(session.server)` 决定，行为与 TUI 一致。
- 不碰远程链路：SSH/WSL 只是另一种 server（见 `gui/ssh`、`gui/wsl`）。

## 入口与调用链

```
src/renderer.ts → terminal/renderer.tsx setup
  createTerminalModel({ storage, layout, toast, t, tab: key })
  ctx.workspaces.on("remove", model.remove)
  ctx.add(BuiltinSlot, { at: "session.location.branch.menu" })
  ctx.add(Command, terminalToggleCommand → id "toggle", bind "ctrl+`", slash "terminal")
  ctx.add(Command, { id: "new", bind: "ctrl+alt+t" })
  ctx.add(BuiltinCommand, { id: "close", bind "mod+w", follows "tab.close", scope '[data-component="terminal"]' })
  ctx.add(MenuItem, { menu: "session.panel", order: 20 })
  ctx.add(Panel, { id: "main", region: "side", transient: true })
```

- 打开：`show(session, terminal, id)` → `terminal.select(id)` + `terminal.requestFocus(id)` + `layout.open(key(id), session, narrow ? undefined : { tab: "select" })`。
- 新建：`create()` → `terminal.new()` → 如果用户已经移走就 `terminal.cancelFocus()`。
- 附着：`panel.tsx` → `pane-machine.ts` 派发 `create-terminal`/`connect` 效果 → `connection.ts` 的 `terminalConnection` → `connection-machine.ts` 的 `transitionConnection`。
- 写入：`writer.ts` 的 `terminalWriter(write)` 负责分块与 `done` 回调。

## 数据与状态

- tab 选择与滚动等布局状态存 `layout`（`layout.open`/`layout.state`/`layout.stored`/`layout.hide`）；tab id 形如 `terminal:<id>`（`renderer.tsx` 的 `key(id)`）。
- tab 对象缓存：`tabs: Map<sessionKey, Map<terminalID, PanelTab>>`，在 shell tab 关闭时按 session 列表清理（`createKeyed` 对比 `sessions.list()`）。缓存是为了 strip 更新与会话切换"不重建触发器"。
- 附着 id 由 server 给；`connection-machine.ts` 里区分 `controller` 与 `observer` 角色，observer 不收输入。
- 重启后：`Panel.list` 用 `model.load(session).tabs(input.open)`，在 server 列表回来之前 `hidden`（`tabHidden`）保住恢复的选择。

## 关键不变式

- **`transient: true`**：server 不再列出的 tab 会离开 strip（在这里或别处关闭、或进程退出）。别改成非 transient，否则会留下打不开的死 tab。
- **`hidden` 只在"还没有东西可显示"时为真**：加载中，或者失败要显示原因。内容一旦确定就要放出来，否则 fallback 永远不跑。
- **焦点是请求，不是状态**：`focus-machine.ts` 用 token（`focusRequestToken`/`isFocusRequested`）；`Panel.focus` 只在 `!input.restored` 时 `requestFocus`（`restored` 表示这是侧区挂载时的恢复选择，不该当成用户意图）。
- **`terminalToggleCommand` 是对外契约**：注释写明它"Published as `terminal.toggle`; the desktop menu names it"。改 id 或 bind 要同步 desktop 菜单与 keybind rename map。
- **生命周期跟随 owner**：`ctx.workspaces.on("remove", model.remove)` 与 `onCleanup(model.dispose)` 由 host 随插件撤回；自己起的定时器（尺寸防抖 100ms、加载预算）必须能被打断。
- **三档超时不能合并**：`GHOSTTY_LOAD_TIMEOUT_MS = 30_000`（chunk 编译）、`TERMINAL_CONNECT_TIMEOUT_MS = 15_000`（附着）、`TERMINAL_REQUEST_TIMEOUT_MS = 15_000`（列表/新建等 RPC）。
- **重活不进启动路径**：`panel` 用 `lazy()`，并且 `onIdle` 预加载；如果 strip 里已经有存下来的 terminal tab，则改为在 setup 里立刻预加载（否则首帧空白）。

## 扩展点

**新增一个终端命令**（例如清屏）：`renderer.tsx` 里 `ctx.add(Command, () => ({ id, group: ctx.t("command.category"), bind?, section: "terminal", enabled: enabled(), run }))`；需要 pane 内生效就加 `scope: '[data-component="terminal"]'`。

**给 tab 加一种状态**（例如"已退出"）：`machine.ts` 的 `View`/`List` + `transition` → `tabHidden`/`tabTargetable` → `label.tsx` 的显示 → `i18n/en.ts` 文案。

**接入一个新的终端渲染器**：`runtime-adapters.ts`（`disposeIfDisposable`/`setOptionIfSupported`/`getHoveredLinkText`）+ `pane-machine.ts` 的 chunk 加载 + `terminal.tsx`。不要绕过 `writer.ts` 直接写。

**新增引用动作**：`quote-machine.ts` 的状态/事件 + `quote.tsx` 的 UI + `TERMINAL_QUOTE_MAX_LENGTH` 之类的上限。

## 常见改法与坑

- `mod+w` 在终端里必须由插件抢：`BuiltinCommand.follows: "tab.close"` 让它共享快捷键但在 `[data-component="terminal"]` 作用域内执行；去掉 scope 会把窗口的关 tab 弄坏。
- 空白终端还没有 focused native view 时的关闭路径与 `gui/browser` 相同思路（在那里是 `browser` 的 `close` 命令）。
- 尺寸变化要防抖（`TERMINAL_SIZE_DEBOUNCE_MS = 100`），否则拖动窗口会给 PTY 灌一串 resize。
- `term.onData` 的写入必须串行走 `writer.ts`；直接 `term.write` 并发会乱序。
- `terminalKeyInput` 只把浏览器 `KeyboardEvent` 转成终端字节，别在里面加业务判断。
- 引用文本上限 20 000 字符（`TERMINAL_QUOTE_MAX_LENGTH`），粘贴大段日志会先被截断。
- 终端渲染用的字体是 `ctx.appearance.font("mono")`（AGENTS.md Fonts）；不要写死字体族或打包字体文件。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `terminal/index.ts` | `Plugin.define` 与 `terminalToggleCommand`（对外契约） |
| `terminal/renderer.tsx` | window 入口：命令、菜单项、`Panel`、tab 缓存与恢复 |
| `terminal/model.ts` | `createTerminalModel`：server RPC、tab 生命周期、焦点请求 |
| `terminal/machine.ts` | 列表/视图状态机（`transition`、`tabHidden`、`tabTargetable`） |
| `terminal/connection.ts`、`connection-machine.ts` | 一次附着：连接、角色、输出准入 |
| `terminal/pane-machine.ts` | chunk 加载与连接预算（`GHOSTTY_LOAD_TIMEOUT_MS` 等） |
| `terminal/panel.tsx` | 面板容器：Suspense、尺寸、tab 切换 |
| `terminal/terminal.tsx` | ghostty 实例挂载与输入输出接线 |
| `terminal/writer.ts` | 串行写入器 |
| `terminal/quote-machine.ts`、`quote.tsx` | 选中文本引用到 composer |
| `terminal/rename-machine.ts`、`inline-rename.ts` | tab 重命名 |
| `terminal/focus-machine.ts`、`focus.ts` | 焦点请求 token |
| `terminal/title.ts`、`label.tsx` | tab 标题推导与标签渲染 |
| `terminal/terminal-key-event.ts` | 键盘事件 → 终端输入 |
| `terminal/dispatch.ts` | `createDispatch`：把状态机的效果接到驱动 |
