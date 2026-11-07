---
id: gui/browser
title: 浏览器面板（内嵌 Chromium）
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/browser
symbols:
  - BrowserPane
  - PaneEvent
  - PaneElement
  - PaneCloseReason
  - MAX_ICON_URL
  - createBrowserPane
  - createBrowserPage
  - createCdp
  - normalizeURL
  - fileURLWithin
  - RefsStore
  - History
  - remember
  - createModel
  - transition
  - createPaneState
  - selectInventory
  - MAX_RETAINED_REQUESTS
tests:
  - packages/gui-plugins/src/browser/policy.test.ts
  - packages/gui-plugins/src/browser/machine.test.ts
  - packages/gui-plugins/src/browser/pane-machine.test.ts
  - packages/gui-plugins/src/browser/page-machine.test.ts
  - packages/gui-plugins/src/browser/address.test.ts
depends_on:
  - core/plugin-system
related:
  - gui/file
  - gui/terminal
  - gui/review
keywords:
  - 浏览器
  - browser
  - Chromium
  - CDP
  - 面板
  - pane
  - tab
  - 元素选择
  - 网络诊断
source_hash: 2173341d30702f77fb0a5f1459861b35216d5882
---

## 职责

桌面窗口里的内嵌浏览器：session 侧栏一块面板，tab 清单由 server 的 browser 插件持有，页面本身是本机 Electron 的 `WebContents`。

- window 侧（`renderer.tsx` → `model.ts` → `panel.tsx`/`pane.ts`）：地址栏、tab strip、元素选择、覆盖层（网络/性能/对话框/站点数据）。
- main 侧（`main.ts` → `pane.ts` → `chromium.ts` + `cdp.ts`）：创建页面、注入检查脚本、执行 CDP。
- 两侧之间只有一个 Ipc：`browser.pane`（`ipc.ts`），以及一个只读契约 `Browser`（`@opencode/plugin/gui/browser`，供 `gui/file`、`gui/aux-panels` 使用）。

## 边界

做：
- 一个 session 一块 pane，pane 内多个 tab；pane 只归属一个 window（binding）。
- 页面动作：导航、reload、缩放、元素选择与高亮、站点 cookie 计数与清除、trace/CPU/heap 采集。
- 把 workspace 里的 HTML 文件当页面打开（`link.ts` 的 `workspaceFileURL`）。

不做：
- 不实现浏览器协议：tab 清单、`Browser.Action`、`Browser.Ref` 都来自 server 的 `@opencode/plugin-browser/rpc`，本插件只是 client。
- 不在 web 上运行：`renderer.tsx` 里 `ctx.app.platform !== "desktop"` 直接 return；main 只在 Electron 里存在。
- 不开放任意 URL（见"关键不变式"的 URL 策略）。

## 入口与调用链

window：

```
src/renderer.ts（compose，eager）
  → browser/renderer.tsx setup
      ctx.provide(Browser, { attached, canOpen, open, openFile })
      ctx.add(Command, open | reload | reloadPage | address | newTab | inspect | close)
      ctx.add(MenuItem, { menu: "session.panel" })
      ctx.add(LinkHandler, { priority: 10, match: origin === ctx.id })
      ctx.add(BuiltinPanel, { id: "main", region: "side" })
```

- 面板 chunk：`lazy(() => import("./panel"))` + `onIdle` 预加载（`SessionBrowserPane.preload()`）。
- 模型 chunk：`createKeyed(opened)` 派发 `load.requested` → `import("./model")`，受 `BROWSER_MODEL_LOAD_TIMEOUT_MS`（`model-machine.ts`，15s）约束；失败进 `failed`，面板显示错误 + 重试。
- window → main：`ctx.main(BrowserPane)`，方法 `register / load / command / inspect / highlight / zoom / site / clearSite / close`。
- main → window：`provider.emit("event", PaneEvent, window)`，事件类型 `focus / preview / state / embed / inspect / page / focused / shortcut`。

main：

```
main.ts setup → ctx.provide(BrowserPane, …)
  dispatch(load.requested) → import("./pane") → createBrowserPane({ windows, serverEndpoints, storage, refs, embeds, emit })
       → chromium.ts createBrowserPage / cdp.ts createCdp / machine 层 pane-machine.ts
```

## 数据与状态

- window 全局 store `history`（`history.ts` 的 `History`：`{ visits }`），在 `index.ts` 用 `Store.global` 声明；键在 `plugin.browser.*` 命名空间。用于新 tab 页与地址建议（`addressSuggestions`，上限 `ADDRESS_SUGGESTIONS = 5`）。
- main 全局 store `refs`（`refs.ts` 的 `RefsStore`，一个自增整数），`ctx.storage.store("refs", RefsStore)`，命名空间 `plugin.browser`。
- tab 恢复：`restore.ts` 的 `createBrowserRestoreStore(storage)` 存每 session 的 tab；`register` 的 `restore` 输入把 `Browser.State` 交回 main。
- 状态机：window `machine.ts`（绑定/地址/注册，`REGISTER_TIMEOUT_MS`、`RETRY_BASE_MS`、`RETRY_MAX_MS`）、`model-machine.ts`、`pane-machine.ts`；main `main-machine.ts`（懒加载 pane 的 attempt 机）。**没有模块级状态**，全部在 setup 里。
- 重启窗口后：stored tab id 由 `Panel.list` 的 `input.open` 给出，在首次 inventory 之前用 `BuiltinPanelTab.hidden` 保持选中位，避免 fallback 抢走。

## 关键不变式

- **`register` 是唯一不带 binding 的方法**；其它方法调用前必须先 register。`main.ts` 的 `pane()` 在没有 pending load 时 reject `browser.pane.unavailable`。
- **关闭原因是协议的一部分**（`PaneCloseReason`）：`unsupported` / `replaced` / `suspended` / `missing` / `registration.closed`。只有 `registration.closed` 表示 window 可以重新 register；`state` 事件里的其它 error（如 `page_crashed`、地址被拒）**不关闭 binding**。
- **binding 归属**：一个 window 只能操作自己的 binding（`pane-machine.ts` 的 `selectOwnedBinding`）；另一个 window attach 同一 session 会收到 `browser.pane.replaced`。
- **Ipc 消失是暂停，不是失败**（AGENTS.md "Failure is part of the contract"）：保留 tab 清单，用固定的 `RETRY_BASE_MS`/`RETRY_MAX_MS` 退避重试注册，不要自己加一次性重试定时器。
- **URL 策略集中在 `policy.ts`**（Electron-free，可在 Bun 下单测）：只允许 http/https、`about:blank`，以及 `fileURLWithin` 认定的 workspace 根内文件 URL；带用户名/密码的 URL 一律拒绝；带 hostname 的 `file:` URL（UNC）拒绝。
- **icon 与 zoom 有硬上限**：`MAX_ICON_URL = 24_576` 字节且必须以 `data:image/` 开头；zoom 在 `0.25–5`。
- **window `setup` 必须同步**：重型 chunk（panel/model/pane 的渲染）一律 `lazy()` + `onIdle` 预加载，`src/renderer.ts` 只 eager 入口文件。
- **main 不得知道插件内部**：host 只通过 SDK 通用字段发声（AGENTS.md "Host boundary"）。

## 扩展点

**新增一个 pane 动作**（四处在同一改动里）：
1. `ipc.ts`：在 `BrowserPane.methods` 加方法，写清 input/output schema 与超时语义。
2. `main.ts`：在 `ctx.provide(BrowserPane, …)` 里转发给 `(await pane()).<method>`。
3. `pane.ts`：实现，开头用 `selectOwnedBinding` 校验 binding 归属，产物以 `PaneEvent` 回发。
4. window `model.ts` / `panel.tsx`：调用并消费事件。

**新增一个快捷键级动作**：`renderer.tsx` 里 `ctx.add(Command, () => ({ id, scope: "#browser-panel", bind, enabled: pane.visible(), run }))`；函数形式贡献项，label 才会跟着语言变。

**新增一种页面信息**（如页面级权限）：走 `PageEvent` 扩展 `PaneEvent` 的 union 成员，而不是新开 Ipc；`page` 事件已承载 icon 与 zoom。

## 常见改法与坑

- 两处同名常量：`machine.ts` 的 `REGISTER_TIMEOUT_MS = 20_000`（window）与 `pane-machine.ts` 的 `REGISTER_TIMEOUT_MS = 15_000`（main）。改一处必须同时确认另一处。
- `mod+t` / `mod+w` / `mod+l` / `mod+shift+c` 在 pane 内属于 pane，在别处属于 app。靠 `scope: "#browser-panel"` 与 `BuiltinCommand.follows` 区分，别把 scope 去掉。
- 元素选择器的 `ref` **只在页面导航前有效**（`PaneElement.ref` 注释）；导航后旧 ref 不能复用。
- 页面把快捷键交回 window 走 `keys.ts`（`pageShortcut`/`pageReload`），空白页没有 focused native view，所以要自己声明 close。
- Chromium 在 media viewer 上会以 `ERR_FAILED (-2)` 结束导航但文档已 commit：用 `policy.ts` 的 `committedLoad` 判定，别当失败。
- 站点数据（`site` / `clearSite`）只统计/删除"这个桌面浏览器在该地址能读到的 cookie"，不是 server 侧数据。
- trace/CPU/heap 采集有独立超时（`TRACE_STOP_TIMEOUT_MS`、`CPU_MAX_DURATION_MS`、`CPU_STOP_TIMEOUT_MS`、`HEAP_CAPTURE_TIMEOUT_MS`）与保留上限（`MAX_RETAINED_REQUESTS`、`MAX_STASHED_CHAINS`、`MAX_WIRE_QUEUE`）；放宽上限先量内存。
- 从 `@opencode/plugin/gui/browser` 导出的 `Browser` 契约是别处（`gui/file` 的 HTML 链接、`gui/aux-panels` 的 sources）唯一允许的依赖面；不要让别人 import 本目录的实现文件。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `browser/index.ts` | `Plugin.define`：`history` store + `builtinCatalog` 懒加载语言包 |
| `browser/renderer.tsx` | window 入口：命令、菜单项、链接处理、`BuiltinPanel`、tab 对象缓存 |
| `browser/ipc.ts` | `BrowserPane` Ipc、`PaneEvent`、`PaneElement`、`PaneCloseReason` |
| `browser/main.ts` | main 入口：懒加载 `pane.ts`、Ipc 转发、cleanup |
| `browser/pane.ts` | main 侧 pane：binding、tab slot、页面生命周期 |
| `browser/chromium.ts` | `createBrowserPage`：Electron `WebContents`、注入脚本、检查覆盖层 |
| `browser/cdp.ts` | `createCdp`：DevTools 协议薄封装（含 `abortError`） |
| `browser/policy.ts` | URL 策略：`destinationOrigin` / `fileURLWithin` / `normalizeURL` / `refusal` |
| `browser/machine.ts` | window 侧绑定机：注册、重试、地址焦点、session 视图选择器 |
| `browser/pane-machine.ts` | main 侧 pane 机：binding 状态、控制帧解码、inventory |
| `browser/model.ts` | window 模型：`createModel(ctx)`，把 machine 接到 `ctx.main(BrowserPane)` |
| `browser/panel.tsx` | 面板 UI：strip、地址栏、覆盖层 |
| `browser/history.ts` | 访问历史 schema 与 `remember`/`suggest` |
| `browser/refs.ts` | `RefsStore`（main 自增计数，元素 ref 的来源） |
| `browser/restore.ts` | 恢复 store：session → tab 的持久化 |
