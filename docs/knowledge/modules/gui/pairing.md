---
id: gui/pairing
title: 设备配对与远程访问
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/pairing
symbols:
  - Pairing
  - createPairingState
  - transitionPairing
  - pairingEffectFailed
  - viewPairingPage
  - viewDialog
  - dialogUrl
  - remainingSeconds
  - createDispatch
  - createCopyState
  - transitionCopy
  - copyEffectFailed
  - viewCopy
  - COPY_FEEDBACK_MS
  - COPY_TIMEOUT_MS
  - createPairingMainState
  - transitionPairingMain
  - selectBlocker
  - pairingMainEffectFailed
  - SERVICE_READ_TIMEOUT_MS
  - SERVICE_SET_TIMEOUT_MS
  - SERVICE_START_TIMEOUT_MS
  - remoteAddress
  - REMOTE_READ_TIMEOUT_MS
  - REMOTE_READ_RETRIES
  - REMOTE_CHANGE_TIMEOUT_MS
  - TUNNEL_RETRIES
  - TUNNEL_RETRY_DELAY_MS
  - TUNNEL_TIMEOUT_MS
  - CODE_TIMEOUT_MS
  - SCREEN_TIMEOUT_MS
tests:
  - packages/gui-plugins/src/pairing/machine.test.ts
  - packages/gui-plugins/src/pairing/main-machine.test.ts
  - packages/gui-plugins/src/pairing/copy-machine.test.ts
  - packages/gui-plugins/src/pairing/dispatch.test.ts
  - packages/gui-plugins/src/pairing/remote.test.ts
depends_on:
  - core/plugin-system
  - runtime/process-lifecycle
related:
  - gui/ssh
  - gui/updater
  - contracts/httpapi-protocol
keywords:
  - 配对
  - pairing
  - 二维码
  - QR
  - 远程访问
  - remote
  - OpenTunnel
  - 隧道
  - 保持唤醒
  - 设置页
source_hash: 1a2b4ad749d4a642d46ae9166618537037884977
---

## 职责

把另一台设备接到本机 server：设置页里显示配对码/链接，可开关"远程访问"（让后台服务挂 OpenTunnel 地址），并可在另一台设备使用时阻止显示器休眠。

- window（`renderer.tsx` → `page.tsx`）：一个 `SettingsPage` + 一个 `Command`；配对码来自 `ctx.servers` 里本机 server 的 `ServerRef`（已认证），不经 main。
- main（`main.ts` → `main-machine.ts`）：`Pairing` Ipc；用 `ctx.cli` 跑 `opencode service …` 改远程访问，用 Electron `powerSaveBlocker` 保活显示器。
- 状态机：`machine.ts`（窗口侧：`createPairingState`/`transitionPairing`）、`main-machine.ts`（主进程侧：`createPairingMainState`/`transitionPairingMain`）、`copy-machine.ts`（复制反馈）。
- 通用驱动：`dispatch.ts` 的 `createDispatch`（`read`/`write`/`transition`/`run`/`failed`），把状态机的效果接到副作用。

## 边界

做：
- 展示配对码与链接（含倒计时 `remainingSeconds`）、复制链接（带 2s 反馈）。
- 远程访问开关：读 `service status`、改设置、必要时重启后台服务。
- 显示器保活开关，并把选择持久化。

不做：
- 不实现隧道：OpenTunnel 是后台服务/CLI 的行为；本插件只是改它的设置。
- 不传输凭据：配对码与地址来自 window 里已认证的 `ServerRef`（"its credentials never leave main" 的反面：这里连 main 都不需要）。
- 不在 web 上提供远程/保活：`renderer.tsx` 里 `if (!ctx.desktop) return`；设置页里只有 Ipc active 时才列出这两行。

## 入口与调用链

window：

```
src/renderer.ts → pairing/renderer.tsx setup
  if (!ctx.desktop) return
  const local = () => servers.list().map(get).find(server => server?.builtin)   // 本机 server
  ctx.add(SettingsPage, { id: "pairing", icon: "outline-pair",
      entries: [pairing, settings-remote-access?, settings-keep-screen-active?],
      render: <Page server={local} pairing={ctx.use(Pairing)} /> })
  ctx.add(Command, { id: "open", run: () => layout.settings("pairing") })
```

main：

```
pairing/main.ts setup
  builtinMainContext(ctx).storage.store("keepScreenActive", { from: { state: ["opencode.settings", "keepScreenActive"] } })
  createDispatch({ read, write, transition: transitionPairingMain, run, failed })
  ctx.provide(Pairing, { remote, setRemote, screenActive, setScreenActive })
  ctx.onCleanup(() => dispatch({ type: "disposed" }))
```

- 远程访问：`run(effect)` 里 `execFile(cli.command[0], [...cli.command.slice(1), "service", ...effect.args], { signal, timeout })`——每个命令有超时，"a hung command ends at its timeout, so the next one always runs"。
- 保活：`powerSaveBlocker.start("prevent-display-sleep")`；`screenActive()` 每次都重新问 `powerSaveBlocker.isStarted(id)`，因为操作系统可能自己收回。

## 数据与状态

- main store `keepScreenActive`（`Schema.Boolean`，初始 false），旧的家是 `{ state: ["opencode.settings", "keepScreenActive"] }`（另一命名空间的键），通过 `builtinMainContext(ctx).storage` 导入。
- window 侧无 store：配对码/地址从 `ServerRef` 现取；复制反馈是内存状态（`COPY_FEEDBACK_MS = 2_000`）。
- 主进程内的表：`commands: Map<attempt, AbortController>`、`waiters: Map<waiter, {resolve, reject}>`——一个排队中的命令与它的调用方。
- 重启后：保活状态从 main store 恢复（`if (stored.value) dispatch({ type: "screen.set", enabled: true, started: false })`）；远程访问是服务端的设置，重新读。

## 关键不变式

- **读请求可以被取消，写请求不可以**：`service(request, signal)` 的注释——"A read stops when its caller goes away; a change goes on"。改这段会让"点了开关但窗口关了"变成半完成的设置。
- **一个命令一条队列，且每个命令有超时**：`SERVICE_READ_TIMEOUT_MS = 20_000`、`SERVICE_START_TIMEOUT_MS = 60_000`、`SERVICE_SET_TIMEOUT_MS = 180_000`。首次开远程访问要建隧道，可能到分钟级。
- **保活状态必须实时问操作系统**：`screenActive()` 用 `selectBlocker(state)` + `powerSaveBlocker.isStarted(id)`，不能只信自己记的布尔值。
- **释放由 cleanup 负责**：`ctx.onCleanup(() => dispatch({ type: "disposed" }))` 必须释放 blocker，否则退出后系统仍不休眠。
- **远程地址是"HTTPS 那一条"**：`remoteAddress(urls)` 注释——server 本身监听明文 HTTP，所以 URL 列表里的 `https:` 那一个才是远程隧道。
- **Ipc 不可用时设置页不列该行**：`entries` 在 `pairing().status !== "active"` 时只返回本机配对行；不要留一个按不动的开关。
- **没有 `builtinCatalog`**：`index.ts` 只有 `i18n: { en }`（单语），加语言时要改成懒加载目录。

## 扩展点

**新增一个远程/保活之外的 main 能力**（例如"开机自启"）：`contract.ts` 的 `Pairing.methods` 加方法 → `main.ts` 的 `ctx.provide` 实现 → `main-machine.ts` 的事件/效果/超时 → `machine.ts` 的窗口侧视图状态 → `page.tsx` 的行。

**新增一种设置行**：`renderer.tsx` 的 `entries`（只在能力可用时列出）+ `page.tsx` 的区块；行 id 也是搜索锚点（`settings-remote-access` 这类命名沿用）。

**新增一个带超时的请求**：`machine.ts` 或 `main-machine.ts` 的效果 + 常量 + `pairingEffectFailed`/`pairingMainEffectFailed` 的失败映射；两份 `*EffectFailed` 是"效果失败 → 事件"的唯一入口。

**复用驱动**：`dispatch.ts` 的 `createDispatch` 是一个很小的通用循环（`read`/`write`/`transition`/`run`/`failed`），新机器可以直接用；不要为它再写一份。

## 常见改法与坑

- `REMOTE_CHANGE_TIMEOUT_MS = 180_000` 与 `TUNNEL_RETRIES = 180`、`TUNNEL_RETRY_DELAY_MS = 1_000`、`TUNNEL_TIMEOUT_MS = 10_000` 是一组：首次建隧道最多可能等三分钟，别在 UI 上显示"失败"太早。
- 倒计时用 `remainingSeconds(dialog, now)`，不要在组件里自己算——机器里已经剪掉了过期态。
- 复制链接走 `copy-machine.ts` 的 `viewCopy`（`COPY_TIMEOUT_MS = 5_000`），失败要能重试；`copyEffectFailed` 是失败到事件的唯一映射。
- `layout.settings("pairing")` 会直接跳到设置页的该 tab；改页 id 要同步命令。
- main 侧的命令用 `cli.command` 而不是硬编码 `opencode`：`cli.command[0] ?? "opencode"`，改 CLI 入口时这里是常见遗漏点。
- 这个插件是最小的"双进程内置插件"样板（README 的 "Build your first plugin" 就是它）；新增插件时照它抄结构最安全。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `pairing/index.ts` | `Plugin.define({ i18n: { en } })`（无 store、单语） |
| `pairing/contract.ts` | `Pairing` Ipc：`remote`/`setRemote`/`screenActive`/`setScreenActive` |
| `pairing/main.ts` | main 入口：保活 store、`createDispatch`、`execFile` 跑 `service`、`ctx.provide` |
| `pairing/main-machine.ts` | 主进程状态机：命令队列、blocker、三档服务超时 |
| `pairing/renderer.tsx` | window 入口：设置页（`entries` 随 Ipc 可用性变化）+ 打开命令 |
| `pairing/page.tsx` | 设置页主体：配对码/链接、远程访问、保活 |
| `pairing/machine.ts` | 窗口状态机：远程读取重试、隧道、码、屏幕、对话框视图 |
| `pairing/copy-machine.ts` | 复制链接的反馈与超时 |
| `pairing/dispatch.ts` | `createDispatch`：状态机效果的通用驱动 |
| `pairing/remote.ts` | `remoteAddress`：从 URL 列表里取 HTTPS 那一条 |
| `pairing/dialog.stories.tsx` | 配对对话框的 story（组件测试用） |
| `pairing/page.stories.tsx` | 设置页的 story |
