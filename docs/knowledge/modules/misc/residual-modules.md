---
id: misc/residual-modules
title: server 启动层与 TUI 挂载点
level: L2
layer: misc
status: stable
paths:
  - packages/server/src/fetch.ts
  - packages/server/src/options.ts
  - packages/server/src/media-uri.ts
  - packages/tui/src/runtime.tsx
symbols:
  - ServerOptions
  - ServerFetch
  - wantsMediaRefs
  - abbreviateHome
related:
  - server/http-handlers
  - contracts/httpapi-protocol
  - tui/routes-shell
keywords:
  - server 启动
  - ServerOptions
  - media refs
  - TUI 挂载
source_hash: 0f11e422e97d0d96e627602a2472cf7769c7d47e
---

## 职责

两块"装配点"，本身不含业务：

| 位置 | 作用 |
| --- | --- |
| `packages/server/src/fetch.ts` | `ServerFetch.make(options, boot)`：把 HttpApi 与路由装成一个 fetch handler（含 boot 阶段注入）；`server/process.ts` 是另一条入口 |
| `packages/server/src/options.ts` | `ServerOptions` schema：hostname/port/cors/事件持久化等启动参数 |
| `packages/server/src/media-uri.ts` | `wantsMediaRefs(request)`：决定响应是内联字节还是引用 URL（影响缓存与请求头） |
| `packages/tui/src/runtime.tsx` | TUI 挂载点（渲染器启动/关闭），并 re-export `abbreviateHome` |

## 边界

- 不做端点实现（在 `server/http-handlers`），不做路由定义（在 `contracts/httpapi-protocol`）。

## 数据与状态

- `ServerOptions` 是纯 schema，默认值由调用方（CLI 的 serve/service 分支）给出。
- 媒体引用判定无状态，只看请求头与路径。

## 关键不变式

- `wantsMediaRefs` 与媒体 URL 生成必须成对改动，否则出现"返回引用头但内容是内联"的错配。
- `ServerFetch.make` 的 `boot` 参数决定启动阶段注入的服务，改动同时影响 serve 与 service 两种形态。
- `runtime.tsx` 改的是 TUI 启动顺序，不是组件库。

## 扩展点

- **加一个启动选项**：`options.ts` 加字段 → CLI 的 serve/service 分支透传 → `server/process.ts` 使用。
- **换渲染器入口**：`tui/src/runtime.tsx`（配合 `tui/routes-shell`）。

## 常见改法与坑

- `fetch.ts` 与 `process.ts` 是两条启动路径，只改一条会让 serve 与 service 行为不一致。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/server/src/fetch.ts` | fetch handler 装配 |
| `packages/server/src/options.ts` | `ServerOptions` |
| `packages/server/src/media-uri.ts` | `wantsMediaRefs` |
| `packages/tui/src/runtime.tsx` | TUI 挂载点 |
