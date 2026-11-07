---
id: gui/debug
title: 调试栏与内存诊断
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/debug
symbols:
  - HeapSnapshots
  - MemoryDiagnostics
  - createHeapCaptureState
  - transitionHeapCapture
  - createHeapCommandState
  - transitionHeapCommand
  - isHeapCommandEnabled
  - createMemoryDiagnosticsState
  - transitionMemoryDiagnostics
  - isMemoryDiagnosticsOn
  - isRendererProbing
  - debugBarView
  - DebugBarVisibility
  - memoryLogFile
  - traceConfig
  - summarize
  - RendererMemory
  - memoryRecord
  - debugBuild
  - memoryLogInterval
  - createMotionState
  - transitionMotion
  - selectMotionWide
  - MOTION_WIDE_AT
  - initialFocusToggleState
  - transitionFocusToggle
  - snapshotDirectory
  - signalIncludesServer
  - ServerSnapshot
tests:
  - packages/gui-plugins/src/debug/heap-machine.test.ts
  - packages/gui-plugins/src/debug/memory-machine.test.ts
  - packages/gui-plugins/src/debug/memory-infra.test.ts
  - packages/gui-plugins/src/debug/motion-machine.test.ts
  - packages/gui-plugins/src/debug/server-heap.test.ts
  - packages/gui-plugins/src/debug/options.test.ts
depends_on:
  - core/plugin-system
  - runtime/process-lifecycle
related:
  - gui/updater
  - gui/details
keywords:
  - 调试
  - debug
  - 内存
  - memory
  - heap
  - 快照
  - snapshot
  - 诊断
  - devtools
  - motion
source_hash: 89ae8eae60dd85ba14f0ac2fc53748b41b293a12
---

## 职责

桌面 app 的开发者诊断面：一个可开关的调试栏（`window.bottom`）、内存诊断的开关与 JSONL 日志、`SIGUSR2` 与命令触发的堆快照、以及只在 dev/beta 存在的 Motion 调参面板。

- window（`renderer.tsx` → `bar.tsx` / `motion.tsx`）：命令 `toggle` 与 `heap`、`window.bottom` slot、诊断开关的 UI。
- main（`main.ts`）：`HeapSnapshots.write` 与 `MemoryDiagnostics` 两个 Ipc；快照写 `manifest.json` + 每个进程一份。
- 状态机：`heap-machine.ts`（命令与捕获两个状态）、`memory-machine.ts`（诊断与栏可见性）、`focus-machine.ts`、`motion-machine.ts`。

## 边界

做：
- 打开/关闭调试栏（记忆在 store 里），在栏里开关内存诊断。
- 写堆快照：desktop 自己的 server、每个 app 窗口、main 进程，放进一个新目录，`manifest.json` 最后写。
- 环境触发的诊断：`OPENCODE_DESKTOP_HEAP_DIRECTORY`（绝对路径）时 `SIGUSR2` 打快照；`OPENCODE_DESKTOP_MEMORY_LOG=<seconds>` 打开内存日志。
- Motion 调参（`knobs`），只在 dev server 与 beta 构建里 import。

不做：
- 不实现性能观测后端：日志写桌面日志文件，快照写磁盘。
- 不在 release 构建里提供：main 只在 `debugBuild({ packaged, channel })` 为真时 `ctx.provide`；window 侧 `motionTools` 由 `import.meta.env.DEV || VITE_OPENCODE_CHANNEL === "beta"` 决定，其它构建**连 import 都不会发生**。
- 不做通用面板：调试栏不是给用户的功能，不进 Extensions 之外的产品流程。

## 入口与调用链

```
src/renderer.ts → debug/renderer.tsx setup
  const motionTools = import.meta.env.DEV || import.meta.env.VITE_OPENCODE_CHANNEL === "beta"
  ctx.stores.bar                                      // { visible, motion }
  ctx.add(Command, { id: "toggle", enabled: barView().togglable })
  ctx.use(MemoryDiagnostics)                          // Live；inactive 时不显示开关
  if (ctx.desktop) createKeyed(ctx.use(HeapSnapshots), heap => { … ctx.add(Command, { id: "heap" }) })
  ctx.add(Slot, { at: "window.bottom", render: <DebugBar/> + <Motion/> })
```

- 快照：`dispatch(run)` → `heap.write({ signal })`（`AbortSignal.any([ctx.signal, controller.signal])`）→ toast（成功 / 部分成功 / 失败），成功时提供"在文件管理器里显示"（`desktop.reveal(directory)`）。
- main：`main.ts` 用 `createHeapCaptureState` / `transitionHeapCapture` 保证"一次只跑一个捕获"，并发的 `write` 拿同一次的结果。

## 数据与状态

- window store `bar`（`Store.global`，`{ visible: false, motion: false }`）：跨 reload、重启、更新保留。键在 `plugin.debug.*`。
- main 侧无 store；诊断开关的状态由 `MemoryDiagnostics` 的 state 承载（`{ on, env }`），持久化由 main 自己负责（实现见 `main.ts`，键名待确认）。
- 内存日志文件：`memory-log.ts` 的 `memoryLogFile()`（写桌面 logs 目录，JSONL）；采样结构 `RendererMemory` / `ProcessMemory`，组装在 `memory-record.ts` 的 `memoryRecord`。
- 快照目录：`signal.ts` 的 `snapshotDirectory(env)`（环境变量给的绝对目录）与 `signalIncludesServer(env)`（是否把 server 也拍进去）。
- 重启后：栏的可见性恢复；诊断状态恢复（除非是环境变量打开的，那种只持续这次启动）。

## 关键不变式

- **环境打开的诊断不能被 UI 关掉**：`memoryControl().toggle` 在 `state.env` 为真时是空操作（源码注释："The environment's choice lasts for the launch"）。UI 必须显示这是环境设定。
- **诊断运行时栏不能关**："Running diagnostics keep the bar open"——`barView().togglable` 由 `debugBarView` 统一裁决，不要用 `bar.visible` 直接判断。
- **一次只跑一个快照捕获**：`HeapSnapshots.write` 的 TSDoc 明写"One capture runs at a time; a call while one runs gets that capture's result"。单个快照失败只记进 manifest，其它照写；`complete: false` 表示有失败项。
- **`manifest.json` 最后写**：这是"目录里的东西齐了没有"的判据；改写入顺序会破坏它。
- **动作只在能作答时提供**：`heap` 命令注册在 `createKeyed(ctx.use(HeapSnapshots))` 里，Ipc 一 inactive 命令就消失（AGENTS.md "Failure is part of the contract"）。
- **Motion 代码不能进 release 包**：`motionTools ? lazy(() => import("./motion")) : undefined`；改成静态 import 会把 knobs 带进生产构建。
- **单例捕获的取消语义**：window 侧的 `controller.abort()` 只结束它自己那次等待；toast 必须在这个 attempt 结算时被 dismiss（否则会留下 permanent toast）。

## 扩展点

**新增一个诊断项**（例如 renderer 的 GPU 信息）：`memory-record.ts` 的 schema → `memory-log.ts` 的采样 → `main.ts` 的采集 → `bar.tsx` 的展示。诊断项必须能在"关"的状态下零成本。

**新增一个堆快照来源**：`main.ts` 的 manifest 收集 + `server-heap.ts`（`captureServer`）式的实现；注意 `SNAPSHOT_TIMEOUT_MS`（5 分钟）与失败也要记 manifest。

**新增一个调试栏单元**：`bar.tsx` + `memory-machine.ts` 的 `debugBarView`（可见性/可关闭性的唯一裁决）+ `i18n/en.ts`。

**新增一个 Ipc**：`contract.ts` 里 `Ipc.define`（id 必须是 `debug.<name>`）→ `main.ts` 的 `ctx.provide` → window 侧 `ctx.use`。注意 contract 里每个方法都要写清失败语义。

## 常见改法与坑

- `OPENCODE_DESKTOP_HEAP_DIRECTORY` 必须是**绝对路径**，否则视为未设置；相对路径不报错、只是不生效，排查时容易误判。
- `OPENCODE_DESKTOP_MEMORY_LOG=<seconds>` 的单位是秒（`memoryLogInterval` 解析），不是毫秒。
- `SIGUSR2` 在 Windows 上不存在；那条路径只在支持的平台上生效（待确认具体平台差异）。
- 快照会让 app 卡顿数秒到数十秒：不要在用户操作路径上自动触发，`persistent: true` 的 toast 是刻意的。
- `traceConfig` 是 `contentTracing` 的配置；改它要同时看 `startWebUpdater` 之外的 trace 消费者（待确认）。
- `MOTION_WIDE_AT = 560`、`MOTION_FOCUS_MS = 1_600` 是调参面板自己的常量；它们只影响调试栏里的演示，不要拿去当产品布局断点。
- `debug/index.ts` 的 store 是 `Store.global(Schema.Struct(...))`（不是 `BuiltinStore`），没有旧键迁移；如果以后要迁移必须补 `from`。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `debug/index.ts` | `Plugin.define`：`bar` store（visible/motion）+ 多语言 |
| `debug/contract.ts` | `HeapSnapshots`（`write`）与 `MemoryDiagnostics`（state + `set`）两个 Ipc |
| `debug/renderer.tsx` | window 入口：`toggle`/`heap` 命令、`window.bottom` slot、诊断开关 |
| `debug/main.ts` | main 入口：快照捕获、内存日志、诊断状态、`ctx.provide` |
| `debug/bar.tsx` | 调试栏 UI（内存、进程、renderer 指标、按钮） |
| `debug/motion.tsx`、`motion-machine.ts` | 仅 dev/beta 的 Motion 调参面板与状态 |
| `debug/heap-machine.ts` | 快照命令与捕获两个状态机 |
| `debug/memory-machine.ts` | 诊断状态机与 `debugBarView`（栏可见性裁决） |
| `debug/memory-log.ts` | `memoryLogFile` 与采样（JSONL） |
| `debug/memory-record.ts` | `RendererMemory` schema 与 `memoryRecord` 组装 |
| `debug/memory-infra.ts` | `traceConfig`、`summarize`（`ProcessMemory`） |
| `debug/server-heap.ts` | desktop 自身 server 的快照（`ServerSnapshot`） |
| `debug/signal.ts` | `snapshotDirectory` / `signalIncludesServer`（环境变量解析） |
| `debug/options.ts` | `debugBuild` / `memoryLogInterval`（构建与环境判定） |
| `debug/focus-machine.ts` | 焦点开关状态（devtools 相关，`initialFocusToggleState`） |
