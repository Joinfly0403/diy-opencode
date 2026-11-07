---
id: desktop/main
title: 桌面主进程（Electron main）
level: L1
layer: desktop
status: beta
paths:
  - packages/desktop/src/main
  - packages/desktop/electron.vite.config.ts
  - packages/desktop/electron-builder.config.ts
  - packages/desktop/package.json
symbols:
  - Ipc
  - IpcPortHandoff
  - emitIpcEvent
  - setIpcEventSink
  - DesktopStorage
  - ApplicationLifecycle
  - BackgroundService
  - DesktopCli
  - SidecarCredentials
  - Plugins
  - DeepLinks
  - Shutdown
  - mainWindows
  - getMainWindows
  - getWindowID
  - registerRendererScheme
  - isRendererUrl
  - windowAppearance
  - wireNavigationPolicy
  - wireRendererHeaders
  - createWindowRegistry
  - startSidecarProbe
  - cleanStages
  - serviceVersion
  - getStore
  - openDatabase
  - configureApplication
  - acquireApplicationLock
  - createMenu
  - setMenubarProvider
  - runDesktopMenuAction
  - windowBootstrap
  - marks
  - CHANNEL
  - DesktopPaths
  - nativeT
  - createHost
  - createEmbeds
  - preventsQuit
  - restoresWindows
events:
  - SidecarChanged
  - StorageChanged
  - MenuCommandTriggered
  - DeepLinksOpened
  - WindowZoomChanged
  - WindowFullscreenChanged
  - PluginsChanged
config_keys:
  - opencode.settings
  - firstLaunchOnboardingComplete
  - windowIds
  - zoomLevel
  - backgroundColor
  - bundledCliVersion
tables:
  - document
  - blob
  - state
  - plugin
tests:
  - packages/desktop/src/main/ipc-transport.test.ts
  - packages/desktop/src/main/ipc-machine.test.ts
  - packages/desktop/src/main/windows/security.test.ts
  - packages/desktop/src/main/lifecycle/machine.test.ts
  - packages/desktop/src/main/service/cli-stages.test.ts
  - packages/desktop/src/main/service/sidecar-credentials.test.ts
depends_on:
  - runtime/process-lifecycle
  - contracts/httpapi-protocol
  - contracts/events-db
  - core/plugin-system
related:
  - desktop/renderer
  - core/pty-shell-worktree
  - gui/browser
keywords:
  - Electron
  - 主进程
  - 窗口
  - IPC
  - MessagePort
  - 侧车
  - --service
  - 深链
  - 原生菜单
  - 单实例锁
  - sqlite
source_hash: 8659328c6e44315e062c88afbf776dd131c90b96
---

## 职责

Electron 主进程：**窗口、菜单、IPC 传输、后台服务托管、深链、GUI 插件宿主、桌面持久化**。

| 目录 | 内容 |
| --- | --- |
| `index.ts` / `desktop.ts` | 两段式启动：先首窗，再评估主 bundle 与 Layer |
| `windows/` | 首窗（early）、协议（`oc://renderer`）、安全策略、窗口状态、恢复、reveal 机器 |
| `ipc*.ts` / `ipc-handlers/` | Effect RpcServer over MessageChannelMain + 7 组 handler |
| `service/` | CLI 解析/暂存（`DesktopCli`）、侧车探测与拉起（`BackgroundService`）、凭据（`SidecarCredentials`） |
| `lifecycle/` | 应用状态机、退出/重启 handoff、onboarding、`configureApplication` |
| `native/` | 原生菜单（i18n 化）、菜单动作、日志/crash reporter、spellcheck、CLI 安装 |
| `plugin/` | 内置 GUI 插件宿主（`@opencode/gui-plugins`）、存储、embeds（WebContentsView） |
| `storage/` | drizzle + node:sqlite（`drafts.sqlite`）、write-behind、草稿 GC、窗口快照 |
| `files/`、`deep-links/` | 文件选择器/外链、`opencode://` 投递状态机 |

## 边界

- **不实现产品 UI**：渲染进程渲染 `@opencode/app`；本模块只提供窗口、能力与事件。
- **不实现 agent/core 逻辑**：所有会话/工具/模型能力来自被托管的 `opencode serve --service` 子进程。
- **自动更新不在 main**：`electron-updater` 的驱动在 `packages/gui-plugins/src/updater`（打包后才加载的内置 GUI 插件）；main 只通过 `Plugins` 宿主挂载，并在 `electron-builder.config.ts` 里写死 feed（`https://opencode.ai/update/api/latest/desktop/opencode/`）。属于内置 GUI 插件的代码也不在这里测（`packages/desktop/AGENTS.md`）。
- 菜单/对话框/错误文案一律走 `nativeT` + 翻译 bundle，禁止硬编码英文。
- 持久化优先 sqlite；除 `opencode.settings`（主进程同步设置）外不要再加 JSON 文件。

## 入口与调用链

1. **ready 之前**（`index.ts` 顶层，必须同步）：`configureApplication()` — `chdir(homedir())`、`OPENCODE_DISABLE_EMBEDDED_WEB_UI=true`、`app.setName/setAppUserModelId`（按 channel）、`proxy-bypass-list=<-loopback>`、`enable-features=DocumentPolicyIncludeJSCallStacksInCrashReports`、Linux `disable-smooth-scrolling`、诊断用 `remote-debugging-port`（仅 debug 构建/显式环境变量）；`acquireApplicationLock()`（单实例锁按 userData 作用域）；`registerRendererScheme()`（`oc://` 特权只能 ready 前注册）。
2. **ready 后立刻出首窗**：`marks.ready` → `registerStorageSnapshotHandler` → `createEarlyWindow()` → `startSidecarProbe()`（打包构建里提前 discover 已运行的服务）→ 等首窗渲染进程的资源请求突发结束（quiet 40ms / cap 400ms）→ 才 `import("./desktop")`。首窗若已关闭则直接返回（不加载 Layer）。
3. `desktop.ts`：`marks.bundle` → 组装 Layer（`Ipc`/`BackgroundService`/`DesktopCli`/`DesktopInitialization`/`ApplicationLifecycle` + Node 文件系统/路径）→ `Ipc.registerIpcHandlers` → `fork(plugins.start)`（主 GUI 插件与窗口同步启动）→ 有可恢复窗口则 `installMenu()` → 500ms 后起 crash reporter 与右键菜单 → 挂 `will-quit`。
4. **IPC 接线**：`ipc.ts` 每个窗口在 `did-finish-load` 用 `MessageChannelMain` 交一个端口（`IpcTransportPort`）；`did-navigate` 命中 renderer URL 时先 `handoff.prepare`（旧 document 只排空 RPC，不再收事件）。`ipc-transport.ts` + `ipc-machine.ts` 维护 sender/port/队列（未绑定前最多缓冲 1024 条），业务事件经 `ipc-events.ts` 的 sink 发出。
5. **服务托管**：`BackgroundService.ensure` 调 `@opencode/client/service` 的 `Service.ensure`，命令行是 `[...cli.command, "serve", "--service"]`（隔离模式再加 `--hostname 0.0.0.0 --port 0x0c0c`）；`DesktopCli` 负责定位/暂存 CLI 二进制；返回的 endpoint + Basic 密码存进 `SidecarCredentials`，并通过 `SidecarChanged` 让所有窗口换 origin。
6. **深链**：`second-instance` 的 argv（`opencode://`）与 macOS `open-url` → `ApplicationLifecycle.deepLinks.receive` → `DeepLinks` 状态机选窗口并 focus → `DeepLinksOpened` 投递 → 渲染进程 `AppAcknowledgeDeepLinks` 确认。

## 数据与状态

- **SQLite** `userData/drafts.sqlite`（`node:sqlite` DatabaseSync + drizzle，`journal_mode=WAL`、`synchronous=NORMAL`）：`document`（草稿，key 为 `${storage}:${key}`）、`blob`（内容寻址二进制 + `touched_at` 供 GC）、`state`（渲染进程 `platform.storage(name)` 的命名空间，PK `(name,key)` + `updated_at`）、`plugin`（GUI 插件启停）。关闭前 flush（`before-quit`、窗口 `session-end`）。
- **`opencode.settings`**（单文件 JSON，`getStore()`，同步读写）：`firstLaunchOnboardingComplete`、`windowIds`、`zoomLevel`、`pinchZoomEnabled`、`spellcheckEnabled`、`spellcheckLanguages`、`backgroundColor`、`bundledCliVersion`。它必须在 `app.setPath("userData")` 之后才实例化（模块加载期会落到错误目录，见 `store.ts` 注释）。
- **窗口状态**：每窗 `windowStateFile(id)`（位置/尺寸）+ `windowIds` 列表；关掉最后一个窗口按"退出"处理并保留 id，下次启动恢复；窗口数据命名空间 `opencode.window.<id>.dat` 在窗口丢弃时清空。
- **CLI 暂存**：`userData/cli/<version>-<arch>/`，`cleanStages` 只保留当前打包版本与仍在运行的服务版本（Windows 删不掉就记日志，下次再清）。
- **启动打点** `marks`：entry/ready/window/served/bundle/onboarding/logging/crash/storage/init/layers，把启动切成 Electron 自身、entry、主 bundle、各层四段（`perf/startup.bench.ts` 消费）。

## 关键不变式

- **首窗优先**：`index.ts` 必须保持极小；重模块只能在 `app.whenReady()` 之后动态 import，且渲染进程资源突发没答完前不评估主 bundle（否则 ready 与首绘一起变慢）。
- **ready 前只能做**：command-line switch、单实例锁、scheme 特权注册、`app.setName/setAppUserModelId`。
- **窗口安全基线**（`windowAppearance`）：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`；导航只允许 `isRendererUrl`（`oc://renderer` 或 `ELECTRON_RENDERER_URL` origin），其它一律 `openExternalURL`；权限只给 `clipboard-sanitized-write`/`notifications` 与麦克风，且要求主框架 + renderer origin + 已登记窗口。
- **凭据只在主进程**：渲染进程只拿到 sidecar 的 origin（`SidecarCredentials.ready`）；`wireRendererHeaders` 只给 renderer 顶层框架到 sidecar origin 的请求补 `Authorization`，其它内容（webview/嵌入页/无 frame 的服务 worker 请求）不得继承。
- **端口交接**：一个窗口同一时刻只有一个有效 client；提交新 document 后旧 client 只排空在途 RPC（pagehide 存储 flush），不再收事件。
- **退出/重启**：`before-quit` 由 `preventsQuit(state)` 决定是否 `preventDefault`；`Shutdown` 参与者并行 `stop`（10s 超时只记日志），handoff 失败则 `resume` 重新拉起；`exit` 用 `setImmediate` 再 `app.quit()`（同步退出会被 Electron 覆盖成"取消退出"）。
- **单例与端口**：`Service.ensure` 用固定端口让第二个竞争者绑定失败并退避；改成端口 0 会出现两个服务写同一个数据库。

## 扩展点

- **加一个 IPC 方法**：`src/shared/ipc-rpc/<domain>.ts` 定义 → `src/main/ipc-handlers/<domain>.ts` 实现 → 在 `ipc.ts` 的 `handlers` Layer 合并 → 渲染侧 `renderer/api.ts` 转发（目录约定写在 `packages/desktop/AGENTS.md`）。
- **加一个窗口**：`windows/index.ts` 的 `mainWindows.create()`（新 id + 状态文件）；冷启动首窗走 `windows/early.ts`。
- **加一类退出期资源**：`Shutdown.Service.add({ stop, resume })`，与 Layer 的 finalizer 一起保证可重启。
- **加菜单项**：`@opencode/app/desktop-menu` 的描述 + `native/menu-actions.ts` 的动作；插件贡献走 `setMenubarProvider`。
- **加内置 GUI 插件**：放 `packages/gui-plugins/src/<id>/`（`builtins` 由 `@opencode/gui-plugins/main` 导出），不要在 main 里写插件逻辑。

## 常见改法与坑

- 在 `index.ts` 里静态 import 任何重模块会让首窗推迟一个模块图评估的时间（注释已明确）。
- 想改"自动更新"时先看 `packages/gui-plugins/src/updater`；在 main 里加 autoUpdater 会与内置插件的 quit/relaunch 流程冲突。
- `sidecar-probe` 只在打包构建里跑；未打包时探测被跳过，别据此判断"探测坏了"。
- `cli-version.ts`：`serviceVersion` 在 reconnect 模式返回 `undefined`、beta 频道也返回 `undefined`（只校验"能起来"）；`shouldRetryEnsure` 只在版本未知且是启动失败/超时时重试一次。
- `cleanStages` 在 Windows 上会因可执行文件未退出而删除失败，只记日志——不要把它当"清理保证"。
- 窗口恢复依赖 `windowIds`：手工清 `opencode.settings` 会让用户丢窗口布局；清 `opencode.settings` 也会重置 onboarding。
- 关闭窗口时 `session-end`（Windows 关机/注销）与 `before-quit` 不同，只监听后者会漏 flush。
- 测 IPC 要用渲染进程真实发出的消息格式，不要 mock 客户端（package AGENTS.md）。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/desktop/src/main/index.ts` | ready 前配置、单实例锁、首窗、bundle 延迟加载 |
| `packages/desktop/src/main/desktop.ts` | 主 bundle：Layer 装配、IPC 注册、插件启动、crash reporter |
| `packages/desktop/src/main/lifecycle/configure.ts` | `configureApplication`、单实例锁 |
| `packages/desktop/src/main/lifecycle/index.ts` | 应用状态机驱动器、退出/重启、深链接线、系统事件 |
| `packages/desktop/src/main/lifecycle/shutdown.ts` | `Shutdown` 参与者 stop/resume |
| `packages/desktop/src/main/windows/early.ts`、`index.ts` | 首窗与窗口创建/恢复/注册表 |
| `packages/desktop/src/main/windows/appearance.ts` | `webPreferences`（安全开关）、标题栏、缩放 |
| `packages/desktop/src/main/windows/security.ts` | 权限、导航策略、CORS 与 `Authorization` 注入 |
| `packages/desktop/src/main/windows/protocol.ts`、`scheme.ts` | `oc://renderer` 协议处理与资源突发节流 |
| `packages/desktop/src/main/ipc.ts` | RpcServer 组装、端口交接、菜单安装 |
| `packages/desktop/src/main/ipc-transport.ts`、`ipc-machine.ts` | 端口/事件缓冲状态机 |
| `packages/desktop/src/main/ipc-handlers/*.ts` | app/storage/files/window/menu/events/plugins 七组 handler |
| `packages/desktop/src/main/service/desktop-cli.ts` | CLI 解析、版本缓存、暂存安装 |
| `packages/desktop/src/main/service/background-service.ts` | `Service.ensure` 拉起 `serve --service`、adopt、清理 |
| `packages/desktop/src/main/service/sidecar-credentials.ts` | endpoint/密码与 Basic 头 |
| `packages/desktop/src/main/native/menu.ts`、`menu-actions.ts` | 原生菜单与动作映射 |
| `packages/desktop/src/main/plugin/host.ts`、`index.ts` | GUI 插件宿主与 `Plugins` 服务 |
| `packages/desktop/src/main/storage/index.ts`、`schema.ts`、`store.ts` | sqlite 存储层、表定义、设置文件 |
| `packages/desktop/src/main/deep-links/index.ts`、`machine.ts` | 深链投递状态机 |
| `packages/desktop/electron.vite.config.ts`、`electron-builder.config.ts` | 三段构建产物、打包/publish feed |
