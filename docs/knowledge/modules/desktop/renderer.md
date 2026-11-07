---
id: desktop/renderer
title: 桌面渲染进程、preload 与共享 IPC 契约
level: L1
layer: desktop
status: beta
paths:
  - packages/desktop/src/renderer
  - packages/desktop/src/preload
  - packages/desktop/src/shared
symbols:
  - api
  - DesktopApp
  - ElectronAPI
  - ElectronNative
  - createDesktopPlatform
  - startDesktopMenu
  - bindDesktopMenu
  - startDeepLinks
  - requireRendererRoot
  - desktopVersion
  - DesktopMemoryRouter
  - getLastActiveUrl
  - setLastActiveUrl
  - createDesktopFiles
  - createDesktopNotify
  - createDesktopStorage
  - createPluginBridge
  - createIpcClientState
  - transitionIpcClient
  - invoke
  - listen
  - send
  - DesktopRpcs
  - DesktopRpcClient
  - AppRpcs
  - StorageRpcs
  - PluginRpcs
  - WindowRpcs
  - DesktopEvents
  - DesktopEvent
  - SidecarChanged
  - StorageChanged
  - DeepLinksOpened
  - MenuCommandTriggered
  - IpcTransportPort
  - WindowSnapshotChannel
  - DragCancelEvent
  - omitUndefined
  - storageSnapshotNames
  - windowDataFile
  - WindowBootstrap
  - windowBootstrapArgument
  - windowBootstrapFromArguments
events:
  - SidecarChanged
  - StorageChanged
  - MenuCommandTriggered
  - DeepLinksOpened
  - WindowFullscreenChanged
  - WindowZoomChanged
  - WindowPinchZoomChanged
  - PluginsChanged
config_keys:
  - opencode.global.dat
  - default.dat
  - opencode.window.<id>.dat
depends_on:
  - contracts/httpapi-protocol
  - contracts/events-db
related:
  - desktop/main
  - app/runtime
  - gui/browser
keywords:
  - 渲染进程
  - preload
  - contextBridge
  - contextIsolation
  - MessagePort
  - RPC
  - IPC 契约
  - 启动状态机
  - 多窗口
  - 深链
source_hash: bb2af281e8b46e6a32de8d267553e6feee688ebb
---

## 职责

桌面应用的**渲染侧**（Solid 外壳）、**唯一的原生桥**（preload）与**两侧共享的 IPC 契约**。

| 目录 | 内容 |
| --- | --- |
| `renderer/index.tsx`、`desktop-app.tsx` | 挂载 `@opencode/app` 的 desktop 变体、启动状态机、路由 |
| `renderer/api.ts`、`api-types.ts` | `ElectronAPI` 门面：把 `window.electron` 与 RPC 方法收敛成一个接口 |
| `renderer/ipc-client.ts`、`ipc-client-machine.ts` | 直接说 Effect RpcServer 线格式的客户端 + 端口握手状态机 |
| `renderer/platform/*` | files / storage / notifications / menu 四个平台能力（各一个 machine） |
| `renderer/startup/*` | splash、sidecar 解析、语言、深链、Sentry、启动状态机 |
| `renderer/window/*` | MemoryRouter、路由持久化、缩放、全屏 |
| `preload/index.ts`、`types.ts` | `contextBridge` 暴露面与端口转发 |
| `shared/ipc-rpc/*` | 7 组 RPC 定义（app/storage/files/window/menu/events/plugins）与事件 Schema |
| `shared/ipc-transport.ts`、`window-bootstrap.ts` | 传输常量/快照类型、argv bootstrap 编解码 |

## 边界

- 渲染进程**只能**通过 `window.electron`（preload 暴露）与 MessagePort RPC 到达主进程（`packages/desktop/AGENTS.md` 的硬规则）；不得引入 `electron` 运行时、Node API 或 `ipcRenderer`。
- **不重复实现 app 的业务**：UI 与状态来自 `@opencode/app`（`AppBaseProviders`、`AppInterface`、`PlatformProvider` 等）；这里只提供桌面 `Platform` 实现与外壳。
- `shared/` 同时被 main 与 renderer 引用，因此只能有 type-only 的 Electron 依赖；它是**两侧唯一的契约来源**，改名必须两边同步。
- preload 不是权限边界内的"通用桥"：它只暴露 bootstrap、首屏快照与 `webUtils.getPathForFile`，其余能力都必须经 RPC。

## 入口与调用链

1. `preload/index.ts` 在页面脚本之前运行：`ipcRenderer.on(IpcTransportPort)` 把主进程 postMessage 来的 `MessagePort` 转成 `window.postMessage`；`ipcRenderer.on(DragCancelEvent)` 转成 DOM 事件；从 `process.argv` 解 `--opencode-window=<encoded>`；`invoke(WindowSnapshotChannel)` 预取首屏 store 快照；最后 `contextBridge.exposeInMainWorld("electron", { windowID, bootstrap, storageSnapshot, plugins, getPathForFile })`。
2. `index.html` 先加载 `oc-theme-preload.js`（避免闪白），再以 module 方式加载 `index.tsx`；`index.tsx` 起菜单/深链桥，`render(<DesktopApp/>)`。
3. `desktop-app.tsx`：`createDesktopPlatform(api, { id, version })` → 启动状态机（splash 绘制 → hydrate → sidecar → reveal，见 `startup/machine.ts`）→ `DesktopMemoryRouter`（按 windowID 持久化最后路由）→ 首次启动 onboarding → 挂 `AppInterface`。
4. `api.ts` 的 `invoke/send/listen/cancellable` 落到 `ipc-client.ts`：它自己实现握手、请求 id、事件流与 pagehide 关闭，**不引入 Effect 运行时**（注释说明这省掉约三分之一的启动脚本）。
5. 事件：只开一条 `DesktopEvents` 流，按 `_tag` 分发到 `listeners`（`SidecarChanged`、`StorageChanged`、`MenuCommandTriggered`、`DeepLinksOpened`、插件与窗口事件）。

## 数据与状态

- **首屏快照**：preload 提前 `invoke(WindowSnapshotChannel, storageSnapshotNames(windowID))`，返回需要立刻渲染的命名空间 `opencode.global.dat`、`default.dat`、`opencode.window.<id>.dat` 与插件启停（`plugins`）。缺插件信息表示"未知"，不是"全启用"。
- **bootstrap**（argv 传参，渲染进程可在 IPC 端口存在前读）：`id`、`firstLaunchPending?`、`packaged?`；字段 undefined 的语义是"稍后走 IPC 问"。
- **store**：命名空间里的写入经 `StorageUpdate` 提交，主进程广播 `StorageChanged` 给**其它**窗口（不回给自己）；`pagehide` 时先 flush 再关端口。
- **payload 约定**：所有 RPC 参数/返回值是 JSON-native 或 `Uint8Array`；structured clone 会保留 `undefined` 键而 JSON codec 不认，所以发送前统一 `omitUndefined`。
- **窗口/路由**：`route-storage.ts` 按 windowID 记录最后 URL（`acceptedLastActiveUrl` 做白名单）。

## 关键不变式

- **安全边界**：`contextIsolation: true` + `sandbox: true` + `nodeIntegration: false`（设置在 `main/windows/appearance.ts`）；preload 只暴露固定字段；渲染进程只能加载 `oc://renderer` 或 dev server origin（`isRendererUrl`），越界导航/新窗口一律交给系统浏览器。
- **凭据不在渲染进程**：sidecar 的 Basic 密码由主进程按请求注入；渲染进程只从 `SidecarChanged` 拿到 origin，`sidecarHttp` 必须使用该 origin。
- **端口握手**：有 `PORT_HANDSHAKE_TIMEOUT_MS`；超时只关请求通道，事件流仍存活，只有 `pagehide` 才真正 `disposed`。
- **一个窗口一个 client**：新 document 取代旧 client；旧 client 的事件队列不再投递。
- **状态机规范**：一个 union + 纯 `transition` + 边缘 driver，组件里只读 selector（`packages/desktop/AGENTS.md`，先例 `ipc-client-machine.ts`、`startup/machine.ts`）。
- **Suspense 规则**：渲染里读资源必须带 `state` guard，否则首屏闪（同上 AGENTS 引用 `packages/app/AGENTS.md`）。

## 扩展点

- **加一个 RPC 调用**：`shared/ipc-rpc/<domain>.ts` 加定义 → 主进程 handler → `renderer/api.ts` 加转发 + `api-types.ts` 的 `ElectronAPI` 补签名。
- **加一个事件**：`shared/ipc-rpc/events.ts` 加 Schema 类 → 主进程 `emitIpcEvent` → 渲染 `listen(tag, …)`。
- **加一个平台能力**：`renderer/platform/<capability>.ts`（一个 `create*` + 一个 machine），由 `createDesktopPlatform` 组装进 `Platform`。
- **改启动顺序**：`renderer/startup/machine.ts` + `desktop-app.tsx` 的 driver；splash 视觉在 `startup/splash.tsx`/`splash.css`。

## 常见改法与坑

- 在渲染进程直接 `fetch` sidecar 会缺 `Authorization`（凭据只在主进程，且 CORS 预检也由主进程补头）；必须用 `sidecarHttp`/`createSidecarResolver`。
- 改 `shared/ipc-transport.ts` 的 `IpcTransportPort`/`WindowSnapshotChannel` 常量会让 preload 与主进程静默失配（表现为端口超时，不报错）。
- 不要把 `ipcRenderer` 整体暴露到 `window`——这等于绕过 `shared/ipc-rpc` 的校验与安全策略。
- `desktop-app.tsx` 首行的 `/// <reference path="./env.d.ts" />` 不能删，它先加载 preload 契约再加载 app 的可选浏览器桥声明。
- 二进制载荷要显式转 `ArrayBuffer`/`Uint8Array`（`api.ts` 里的 `toArrayBuffer`/`mutable` 就是为了绕开只读类型），否则会被类型挡住或复制出错。
- `plugins.ts` 的桥在宿主未加载时返回"不可用"而不是抛错；改这里别把冷启动路径变成失败。
- 路由持久化只接受白名单 URL，新增内部路由要同步 `route-storage.ts`。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/desktop/src/preload/index.ts` | `contextBridge` 暴露面、端口转发、首屏快照预取 |
| `packages/desktop/src/preload/types.ts` | `ElectronNative` 形状 |
| `packages/desktop/src/renderer/index.tsx` | 渲染入口（菜单/深链桥 + 挂载） |
| `packages/desktop/src/renderer/desktop-app.tsx` | 外壳、启动状态机 driver、路由、onboarding |
| `packages/desktop/src/renderer/api.ts`、`api-types.ts` | RPC 门面与 `ElectronAPI` |
| `packages/desktop/src/renderer/ipc-client.ts`、`ipc-client-machine.ts` | 线格式客户端、握手/请求/事件状态机 |
| `packages/desktop/src/renderer/startup/machine.ts` | 启动/揭示状态机 |
| `packages/desktop/src/renderer/startup/initialization.ts` | sidecar 解析与 `sidecarHttp` |
| `packages/desktop/src/renderer/startup/deep-links.ts` | 渲染侧深链投递与 ack |
| `packages/desktop/src/renderer/platform/index.ts` | `createDesktopPlatform` 组装 |
| `packages/desktop/src/renderer/platform/storage.ts` | `platform.storage` 实现（快照 + 增量同步） |
| `packages/desktop/src/renderer/platform/menu.ts` | 菜单命令路由 |
| `packages/desktop/src/renderer/window/router.tsx`、`route-storage.ts` | MemoryRouter 与按窗口持久化路由 |
| `packages/desktop/src/shared/ipc-rpc.ts`、`ipc-rpc/*.ts` | `DesktopRpcs` 契约与事件 |
| `packages/desktop/src/shared/ipc-transport.ts` | 传输常量、快照类型、`omitUndefined` |
| `packages/desktop/src/shared/window-bootstrap.ts` | argv bootstrap 编解码 |
