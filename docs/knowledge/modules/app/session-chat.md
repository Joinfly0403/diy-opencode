---
id: app/session-chat
title: 会话视图（时间线、虚拟化、请求 dock）
level: L1
layer: app
status: stable
paths:
  - packages/app/src/session
symbols:
  - useSessionModel
  - selectSessionUserMessages
  - selectVisibleSessionUserMessages
  - MessageTimeline
  - createTimelineModel
  - createTimelineController
  - createTimelineCache
  - createTimelineVirtualizer
  - createSessionScreenLayout
  - createSessionResolution
  - sessionRouteView
  - viewedSessionID
  - createSessionQueue
  - createFollowState
  - transitionFollow
  - END_EPSILON
depends_on:
  - app/runtime
  - app/composer
  - app/workspaces-servers
related:
  - session-ui/timeline-message
  - session-ui/tool-renderers
  - core/session-execution
  - core/permission-policy
keywords:
  - 会话
  - session
  - 时间线
  - 虚拟化
  - 滚动
  - 流式
  - 权限
  - 提问
  - steer
  - 队列
  - 路由
  - 反转
source_hash: 0a3aca13cb34537ed4823b3d0e4c48923a572c86
---

## 职责

- 会话页的**应用层**：路由与解析、会话模型（info/messages/status）、时间线控制器、虚拟化滚动、请求 dock（权限/提问/websearch/elicitation）、会话命令（fork、revert、export、delete、handoff）。
- 把 `@opencode/client` 的数据与 `@opencode/session-ui` 的纯渲染组件缝在一起：本目录产出数据、视图状态与滚动行为，渲染约定在 `session-ui/timeline-message`。
- `composer/`（会话内输入区）与 `timeline/`（消息列表）之间的耦合点只有一个：`ComposerQueue` 契约（`app/composer/adapter.ts`）。

## 边界

做什么：路由解析、会话/消息读取与同步、时间线的行投影与虚拟化、滚动跟随策略、请求 dock、会话级命令、面板宽度与布局。

明确不做：

- 不实现 markdown / diff / 工具行渲染（`packages/session-ui`）。
- 不实现输入框、附件、@ 引用（`app/composer`）。
- 不发 prompt：提交走 `app/composer` 的 submit 机，这里只提供 `ComposerSession`/`ComposerQueue` 适配。

## 入口与调用链

```
/session/:serverKey/:id 路由 → TargetSessionRouteContent(route.tsx)
  → createSessionResolution(params.id, data.session, { connected, pending })
  → sessionRouteView(resolution, health) → ready / preparing / missing / error
  → SessionScreenView(screen.tsx)
       ├─ createMountedSession(view)         // 插件/宿主投影
       ├─ createTimelineCache(session, …)    // 按 sessionKey 缓存整棵树
       ├─ createTimelineModel({ identity, history })  // session.message.sync / pending.sync
       ├─ MessageTimeline → createTimelineController → Timeline(projection) → createTimelineVirtualizer
       └─ ActiveSessionComposerRegion(composer/region.tsx) → createSessionQueue(composer/queue.ts)
```

- 视图状态机：`session-resolution.ts` + `resolution-machine.ts` 决定 ready/preparing/not-found/error；`screen-layout.ts` 决定分栏。
- 时间线数据：`timeline/model.ts` 用 `sync-machine.ts` 做 `message.sync` + `pending.sync`，超时/失败/暂停都有显式状态；缺失父会话时会加载父轮次。
- 滚动：`timeline/machine.ts` 的 `transitionFollow` 是唯一滚动真相（following / returning / detached / anchored）；`timeline/virtualizer.tsx` 负责测量、冷挂载与锚定。

## 数据与状态

- 会话数据不在本地持久化：`useData()`（`@opencode/client/solid` 的 `Data`）是唯一来源，`message.list`/`pending.list` 订阅。
- `createTimelineCache` 用 `createScopedCache` 按 `sessionKey` 为每个会话保一棵组件树，切走时保留滚动位置与展开状态；会话换目录会得到新 key，旧树先保存再释放。
- `timeline/cache-machine.ts`：缓存条目有挂载/存活/驱逐状态；`timeline/controller-projection.ts` 做行的稳定复用。
- 乐观消息：`composer/handoff`（`session/handoff.ts`）把已发出的用户消息先放进时间线，收到 server 回显后 settle/clear。
- 待办队列：`composer/queue.ts` 读 `data.session.pending.list(sessionID)` 里 `delivery === "queue"` 的项，编辑即改队列项。

## 关键不变式

- **滚动状态只有一个真相**（`timeline/machine.ts`）：`END_EPSILON`（0.5px）是“算在末尾”的阈值，故意很紧；`ZOOM_SLACK`（4px）吸收页面缩放下的取整误差。不要在组件里另存 `follow` 布尔。
- 用户**向上**滚动且内容确实溢出时才脱离跟随；程序滚动（路由跳转、composer 变高）用 `follow`/`return.start` 显式驱动，并带 attempt id 拒绝过期帧。
- 触摸手势要区分 `touch` / `nested-touch` / `momentum`：嵌套滚动容器先自己滚，链到时间线才算时间线的手势。
- 改会话或时间线代码前**必须**用 strobe 对 `origin/dev` 跑基准（`packages/app/AGENTS.md` Priorities）：`strobe bench packages/app/perf/<area>.bench.ts --base origin/dev --head .`。
- 每个异步路径都要落到一个状态：`sync-machine.ts` 里失败/超时/取消都是转移，不是日志。
- 不要把渲染逻辑写进本目录：渲染约定与 i18n 在 `session-ui`，这里只传数据。

## 扩展点

- **加一种时间线行类型**：`projection.ts` 的 `TimelineRow`（`session-ui`）加变体 → `session-timeline-row.tsx` 加分支 → 本目录 `timeline/controller-projection.ts` 补复用规则。
- **加一个会话命令**：`commands/machine.ts` 加状态 → `commands/use-session-commands.tsx` 注册 → `shell/commands` 里挂 keybind。
- **加一个请求 dock**：`requests/` 加 controller + `*-machine.ts` → `composer/region.tsx` 里挂载。
- **改布局/分栏**：`screen-layout.ts` 与 `session-panel-width.ts`；面板尺寸持久化在 settings。
- **加一种 composer 行为**：改 `composer/adapter.ts` 的 `ComposerSession`/`ComposerQueue` 契约，再实现到具体 adapter。

## 常见改法与坑

- 在组件里直接调 `api.session.message.list` 而不走 `useData()`：会绕开缓存与事件同步，出现“发送后不刷新”。
- 改 `END_EPSILON`/`ZOOM_SLACK` 会让虚拟化的测量修正被当作用户滚动，表现为流式输出时“自动跳到底”或“卡住不回底”。
- 时间线的 `<For>`/`<Index>` 选择与行 key 由 `projection.ts` 决定，就地改 key 会导致整块重挂（闪烁 + 滚动重置）。
- `createTimelineCache` 的缓存条目按 `sessionKey`（含 server scope）区分；只按 sessionID 缓存会在多 server 下串数据。
- 队列/steer 变体只在 `ComposerQueue.delivery` 里切换；在时间线里另做“是否可发送”的判断会和 composer 的提交机冲突。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/app/src/session/route.tsx` | 路由解析、视图切换、provider 挂载 |
| `packages/app/src/session/screen.tsx` | 会话页布局、时间线 + composer + 面板 |
| `packages/app/src/session/model.ts` | `useSessionModel`：info/messages/status/parent |
| `packages/app/src/session/session-resolution.ts` | ready/preparing/missing/error 判定 |
| `packages/app/src/session/timeline/model.ts` | 时间线同步（message.sync / pending.sync） |
| `packages/app/src/session/timeline/machine.ts` | `transitionFollow` 滚动状态机 |
| `packages/app/src/session/timeline/virtualizer.tsx` | 虚拟化、测量、冷挂载、锚定 |
| `packages/app/src/session/timeline/cache.ts` | 按 sessionKey 的视图缓存 |
| `packages/app/src/session/timeline/controller.tsx` | 行投影与控制器 |
| `packages/app/src/session/composer/queue.ts` | 会话内待办队列（queue/steer） |
| `packages/app/src/session/requests/` | 权限、提问、websearch、elicitation dock |
| `packages/app/src/session/commands/` | fork/revert/export/delete 等会话命令 |
| `packages/app/src/session/session-domain.ts` | 用户消息选择器（含 revert 过滤） |
