---
id: tui/mini
title: 精简 TUI（mini）
level: L2
layer: tui
status: stable
paths:
  - packages/tui/src/mini
  - packages/cli/src/mini.ts
  - packages/cli/src/mini-host.ts
symbols:
  - MiniFrontendInput
  - runMini
  - MiniCommandInput
  - createMiniHost
  - usingInteractiveStdin
  - INTERACTIVE_INPUT_ERROR
  - RunDeferredInput
  - RunRuntimeDeps
  - RunInput
  - RunPrompt
  - RunDelivery
  - RunSession
  - MiniHost
  - MiniSettings
  - MiniVerbosity
  - RunTuiConfig
  - FooterApi
  - FooterEvent
  - FooterPatch
  - FooterView
  - FooterState
  - FooterPromptRoute
  - FooterQueuedPrompt
  - StreamCommit
  - LocalReplayRow
  - RunFooter
  - RunFooterView
  - RunScrollbackStream
  - RunEntryBody
  - RunTheme
  - RUN_THEME_FALLBACK
  - RunEntryTheme
  - RunFooterTheme
  - RunBlockTheme
  - Lifecycle
  - LifecycleInput
  - QueueInput
  - SessionTransport
  - createSession
  - sessionHistory
  - sessionVariant
  - messagePrompt
  - resolveMiniSettings
  - resolveModelInfo
  - resolveModelInfoStrict
  - resolveSessionInfo
  - resolveRunTuiConfig
  - verbosityPreset
  - verbosityChange
  - applyMiniSettingChange
  - cycleMiniVerbosity
  - matchMiniVerbosity
  - createPromptState
  - createPromptHistory
  - movePromptHistory
  - promptAppend
  - promptCopy
  - createPermissionBodyState
  - createFormBodyState
  - formReply
  - entrySplash
  - exitSplash
  - splashMeta
  - monoSnapshot
  - monoMarkdownRenderable
  - entryBody
  - entryWriter
  - writeSessionOutput
  - createFragmentReconciler
  - createSubagentTracker
  - toolCommit
  - turnSummaryCommit
  - createRunDemo
  - demo
  - footerMenuText
  - footerPromptLayout
  - footerStatuslinePolicy
  - footerPanelLayout
  - toolView
  - normalizeTool
depends_on:
  - runtime/process-lifecycle
  - core/session-execution
related:
  - tui/routes-shell
  - tui/prompt-editor
  - tui/theme-keybinds
  - tui/components
entry_cli:
  - mini
keywords:
  - mini
  - 精简
  - 手机
  - 嵌入式
  - 分屏页脚
  - split-footer
  - scrollback
  - 传输
  - SSE
  - 队列
  - demo
source_hash: d2f594b65914d6a1fce8f47100b1c51728b35b60
---

## 职责

`opencode mini` 的精简终端前端：单会话、分屏页脚（split-footer）、行式滚动背（scrollback）+ 可变页脚两通道模型，面向手机/嵌入式与"只想看一个会话"的场景。

- `runtime.ts` 是编排器：boot（config/model/session 并行解析）→ 建 split-footer 生命周期 → 起事件流传输 → 跑 prompt 队列直到页脚关闭。
- `runtime.lifecycle.ts` 建 OpenTUI `CliRenderer`（split-footer 模式）、写入口 splash、建 `RunFooter`，并按 `footer.close → footer.destroy → renderer shutdown` 顺序收尾。
- `footer*.ts(x)` 是页脚：`footer.ts` 是 `RunFooter`（滚动背提交队列 + 页脚状态机），`footer.view.tsx` 是 Solid 视图，`footer.prompt/permission/form/menu/command/subagent` 是各视图体。
- `stream-v2.*` + `stream.ts` 把 SDK 事件变成 `StreamCommit[]` 与页脚 patch；`scrollback.*` 把提交写进不可变滚动背。
- `*.shared.ts` 是纯状态机（prompt 历史环、permission、form、variant、session 载入），无副作用、可单测。

## 边界

做什么：一个会话的渲染、输入、权限/表单应答、模型与 variant 切换、verbosity 预设、重连、退出。

不做什么：
- 不做多标签页、会话侧边栏、插件 slot/route、命令面板、对话框栈（这些只在主 TUI，见 `tui/routes-shell`/`tui/feature-plugins`）。
- 不重新实现会话协议：与主 TUI 一样经 `@opencode/client` 与 HTTP/事件流；投递语义在 `core/session-execution`。
- 不复用主 TUI 的 provider 树与 `context/*`（除 `context/keymap` 与 `config` 的少量纯数据）。

## 入口与调用链

```
opencode mini  (cli)
  → packages/cli/src/mini.ts runMini(input)
      validate → usingInteractiveStdin（TTY / stdin 读取）
      → import("@opencode/tui/mini")（动态，重模块惰性加载）
      → runMiniFrontend({ sdk, host, model, agent, … })
          → mini/runtime.ts runInteractiveDeferredMode
              boot: resolveMiniSettings + resolveModelInfo + resolveSessionInfo（并行）
              → createRuntimeLifecycle（renderer + splash + RunFooter）
              → SessionTransport（stream-v2.transport：订阅事件、重放历史、重连）
              → 队列循环（runtime.queue）：prompt → footer 状态 → 下一次输入
```

- 事件到画面：SDK 事件（`@opencode/schema/event`）→ `stream-v2.transport` 归约成 `StreamCommit`（滚动背行）和 `FooterEvent/FooterPatch`（页脚）→ `stream.ts` 的 `writeSessionOutput` → `RunFooter.append()/event()` → 微任务队列合并 → `RunScrollbackStream` 写入或页脚信号重绘。
- 设备/host 能力经 `MiniHost` 注入（`createMiniHost` 在 CLI 侧），不是全局单例。

## 数据与状态

- 两通道模型（`types.ts` 头注释）：滚动背**追加后不可变**（提交即固化，含图片等待加载后快照），页脚是唯一可重绘区域。
- `StreamCommit`/`RunEntryBody`/`EntryKind` 是滚动背的数据模型；`FooterState`/`FooterView`/`FooterQueuedPrompt` 是页脚状态。
- `RunFooter` 生命周期：`append()` 入队、`flush()` 排空、`event()` 改页脚状态、`present()` 换视图并改页脚高度、`close()` 排空并通知（prompt 队列据此停止）、`destroy()` 额外拆监听并清状态；renderer 的 `DESTROY` 事件也会触发 `destroy()`。
- 单例状态（`RunFooter` 常量）：页脚高度 `FOOTER_HEIGHT`、各面板行数（`RUN_COMMAND_PANEL_ROWS`/`RUN_SUBAGENT_PANEL_ROWS`/`SUBAGENT_INSPECTOR_ROWS`）、提示最大行数 `PROMPT_MAX_ROWS`/`TEXTAREA_MIN_ROWS`、compact 宽度 `FOOTER_COMPACT_WIDTH`。
- verbosity 三档 `quiet | default | everything`，控制 `thinking / tools / shell_output / turn_summary / footer` 五个旋钮的 show/hide；`verbosityPreset` + `applyMiniSettingChange` 是纯函数。
- 重启后不恢复任何界面状态：会话靠 `--session`/`--continue` 重新载入（`resolveCurrentSession` 拉最近 `LIMIT = 200` 条消息重建 prompt 历史）。
- 主题走 `@opencode/theme/tui` + `../theme`，与主 TUI 同源；`mini/theme.ts` 另给出 `RunEntryTheme`/`RunFooterTheme`/`RunSplashTheme` 的语义映射与 `RUN_THEME_MONO` 等回退常量。

## 关键不变式

- **滚动背不可重排**：提交进 `ScrollbackSurface` 的内容（markdown/code/图片）不再重绘，所以流式内容要在提交前补齐（`scrollback.surface.ts` 的 retained surface 会等图片加载后再快照）。
- **提交要合并但保序**：`RunFooter.append()` 在微任务队列里合并提交，"不重建会话模型也要保持顺序"（注释原文）。
- **页脚关闭顺序固定**：`close → destroy → renderer shutdown`（`runtime.lifecycle.ts` 注释），顺序错会让页脚比 renderer 活得久。
- **Ctrl-c 三级语义**：先清空未提交草稿，再走"两按确认"（第一按给提示，5 秒内第二按才真正 interrupt/exit）。
- **不能在 mini 里用 live 节点/常驻定时器**：mini 与 CLI 都 await `renderer.idle()` 来 flush 并接收输入；`OneCellSpinner` 的"留 idle 间隙"和 `SpinnerRenderable` 的非 live 设计就是为这条服务。
- **`*.shared.ts` 必须保持纯**：状态机函数只接收 state 返回新 state，副作用留在 `footer.*` 与 `runtime.*`。
- **split-footer 模式下只有页脚能重绘**：任何需要"回改历史行"的需求都得改成新的 `StreamCommit`，不能 patch 已提交行。

## 扩展点

- **加一种滚动背条目类型**：`types.ts` 的 `RunEntryBody`/`EntryKind` 加分支 → `entry.body.ts`（`entryBody`/`entryCanStream`/`entryDone`）→ `scrollback.writer.tsx` 或 `scrollback.surface.ts` 渲染 → `theme.ts` 的 `RunEntryTheme` 给颜色。
- **加一个页脚视图**：`types.ts` 的 `FooterView` 加值 → `footer.view.tsx` 分发 → 建 `footer.<name>.tsx` 视图体（状态机放 `<name>.shared.ts`）→ `footer.ts` 的 `present()` 处理高度。
- **加一个页脚命令/斜杠**：`footer.command.tsx` 的菜单体 + `prompt.shared.ts` 的 `isCompactCommand`/`isNewCommand` 之类判定。
- **加一个 verbosity 旋钮**：`verbosity.ts` 的 `knobs` 与 `presets` + `types.ts` 的 `MiniSettings`；传输侧读设置决定是否提交该类内容。
- **加一种 demo 场景**：`demo.ts` 的斜杠命令分支（`/permission`、`/form`、`/fmt <kind>`），复用真实 `toolCommit`/`writeSessionOutput` 以保证与线上一致。

## 常见改法与坑

- 在 `mini/` 里 `import "../../context/…"` 拉进主 TUI 的 provider 会引入整套 Dialog/Plugin 依赖，破坏"精简"体积与启动目标；跨用只允许纯逻辑模块（`prompt/display`、`prompt/parse`、`config`、`theme`、`util/*`）。
- 直接在页脚视图里改 scrollback 状态：会被下一次 `flush()` 覆盖，状态必须走 `FooterState`。
- 忘记处理 renderer `DESTROY`：进程被外部杀掉时 `RunFooter` 会残留监听。
- 退出码/退出路径走 `RunFooter.requestExit()` 与 `renderer.destroy()`；不要自己 `process.exit`，会跳过 splash 与 terminal 恢复。
- `readStdin()`（非 TTY 管道输入）会与 `prompt` 参数合并（`mergeInput`），测试时两者同时给会看到拼接后的初始输入。
- 重连由 `SessionTransport` 负责（`reconnect(signal)` 注入），页脚不要自己重建 client。
- `--demo` 分支会拦截提交并本地应答权限/表单，排查"真实链路坏了但 demo 正常"时就该看传输层而不是页脚。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/tui/src/mini/runtime.ts` | 编排：boot → lifecycle → transport → 队列循环 |
| `packages/tui/src/mini/runtime.lifecycle.ts` | split-footer renderer、splash、`RunFooter`、SIGINT |
| `packages/tui/src/mini/runtime.boot.ts` | 启动期并行解析（配置/模型/会话历史） |
| `packages/tui/src/mini/runtime.queue.ts` | prompt 队列与输入循环 |
| `packages/tui/src/mini/footer.ts` | `RunFooter`：提交队列、页脚状态、present/close/destroy |
| `packages/tui/src/mini/footer.view.tsx` | 页脚 Solid 视图分发 |
| `packages/tui/src/mini/scrollback.surface.ts` | 保留式流式提交（markdown/code/图片） |
| `packages/tui/src/mini/scrollback.writer.tsx` | 静态条目/分隔/turn summary 写入 |
| `packages/tui/src/mini/stream-v2.transport.ts` | 事件订阅、历史重放、重连、工具/子代理归约 |
| `packages/tui/src/mini/stream.ts` | 传输结果 → footer API 的薄桥 |
| `packages/tui/src/mini/types.ts` | 两通道模型与全部共享类型 |
| `packages/tui/src/mini/verbosity.ts` | 三档预设与旋钮应用 |
| `packages/tui/src/mini/theme.ts` | mini 主题映射与回退常量 |
| `packages/tui/src/mini/demo.ts` | `--demo` 场景驱动（权限/表单/工具类型） |
| `packages/cli/src/mini.ts` | CLI 侧 `runMini`：校验、stdin、动态导入前端 |
