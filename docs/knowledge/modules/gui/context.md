---
id: gui/context
title: 会话上下文用量
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/context
symbols:
  - syncCatalog
  - catalogModel
  - createSessionContextFormatter
  - sessionExportFilename
  - EXPORT_REQUEST_TIMEOUT_MS
  - CATALOG_LOAD_TIMEOUT_MS
  - createSessionExportState
  - transitionSessionExport
  - selectSessionExporting
  - createContextScrollState
  - transitionContextScroll
  - createCatalogState
  - transitionCatalog
  - SessionExportData
tests:
  - packages/gui-plugins/src/context/machine.test.ts
  - packages/gui-plugins/src/context/catalog-machine.test.ts
  - packages/gui-plugins/src/context/export.test.ts
depends_on:
  - core/plugin-system
related:
  - gui/details
  - gui/review
  - core/provider-models
  - core/session-execution
keywords:
  - 上下文
  - context
  - token
  - 用量
  - usage
  - 费用
  - cost
  - 导出
  - export
  - compaction
source_hash: 6a3c6c542728fd5873970fe711a399f0e5c165d2
---

## 职责

一个 session 的模型上下文用量与统计：`session.header` 上的小指示器，加上侧栏一个 "Context" tab（16 项统计、system prompt、原始消息列表、导出会话 JSON）。

- `indicator.tsx`：`SessionContextUsage`，header 与 tab 标签共用（variant `indicator`、placement `bottom`）。
- `tab.tsx`：侧栏内容，自己维护导出与滚动两个状态机。
- `catalog.ts`（`syncCatalog`/`catalogModel`）：从 provider/model 目录取 limit 与显示名。
- `export.ts`：`fetchSessionExport` 与 `sessionExportFilename`；`format.ts`：按 locale 的数字/时间/百分比格式化。

## 边界

做：
- 展示：provider/model、context limit、input/output/reasoning/cache tokens、总用量百分比、会话费用（含 subagent）、消息计数、创建/最后活动时间、system prompt、原始消息 JSON、导出。
- 只读。唯一副作用是"导出会话 JSON 到用户选择的位置"（`ctx.system.save`）。

不做：
- 不计算 token：数值来自最后一条 assistant 消息的 `tokens`（`lastAssistantWithUsage`）。
- 不做 compaction：只是按与 TUI 相同的边界挑"最后一条有用消息"。
- 不拥有模型目录：目录在 `core/provider-models` 侧，本插件只读。
- 不写会话数据：导出是序列化 + 保存文件。

## 入口与调用链

```
src/renderer.ts → context/renderer.tsx setup
  ctx.add(Slot, { at: "session.header", order: 10 })           → <SessionContextUsage …/>
  ctx.add(BuiltinPanel, { id: "main", region: "side",
                          legacy: { context: "main" },
                          mobile: { order: 40, kind: "menu", icon: "status" } })
      list: input.open.includes("main") ? [tab] : []
      render: 窄屏 mobile 分支 / 宽屏带 padding 分支，都包 Suspense
```

- tab 对象是模块级常量 `tab`（一个对象给所有 session），`title` 是 getter，`label(state)` 从 `state.session` 读当前路由的 session。
- `context/tab.tsx` 的 render 里调用 `syncCatalog(() => props.session)` 订阅目录（`catalog-machine.ts`，15s 预算）。
- 导出：`exportSession()` → `dispatchExport(export.requested)` → `export.fetch`（`fetchSessionExport`，60s）→ `export.save`（`ctx.system.save`）→ `toast.exported`。

## 数据与状态

- **没有持久化 store**。本插件不声明 `stores`，所以没有 `plugin.context.*` 键要迁移。
- 滚动位置存 host 的布局：`layout.scroll.get(session, "context")` / `layout.scroll.set(session, "context", {x,y})`。
- 内存状态：`SessionExportState`（按 `session.key` 记"正在导出"，attempt 号配对）与 `ContextScrollState`（`target.synced` / `scrolled` / `save.flushed` / `restore.applied` / `frame.cancel`）。
- 重启后：数值全部从 server 的消息与会话信息重算；滚动位置由 layout 恢复；没有缓存需要失效。

## 关键不变式

- **"最后一条有用消息"的边界与 TUI 一致**：`lastAssistantWithUsage(messages(), info()?.revert?.messageID)`——最后一次完成的 compaction 之后、undo 边界之前。改这里会让桌面与 TUI 显示不同的用量。
- **总量公式固定**：`total = tokens.input + tokens.output + tokens.reasoning + cache.read + cache.write`；`usage = round(total / model.limit.context * 100)`，没有 limit 时是 `null`（显示 "—"）。
- **根会话费用含 subagent**：`data().session.cost(session.id)`（与 TUI 一致），不要自己累加消息费用。
- **导出必须用点击那一刻的会话**：`fetchSessionExport` 在点击的调用栈里取 `props.session.server.client`；延迟到 await 之后再取会拿到别的 session 的 server。
- **滚动恢复让位于用户输入**：wheel/pointerdown/touchstart/keydown 任一发生就 `interacted`，此后不再恢复；`content.changed`（新消息）允许把被内容截短的恢复重试一次。
- **`catalog` 的加载是异步且可失败的**：`CATALOG_LOAD_TIMEOUT_MS = 15_000`，失败时显示回退到 `message.model.providerID`/`id`，不能空白。
- **tab 必须用 `first: true` + `fallback: true`**：Context 是侧栏的默认 tab，删掉这两个字段会让新 session 打开一个空侧区。

## 扩展点

**新增一项统计**：`tab.tsx` 的 `stats` 数组（`{ label, value }`）+ `i18n/*` 的 `stats.*` 键。数值必须在 `createMemo` 里派生，不要新建 signal 去同步。

**新增一种导出格式**：`export.ts`（`SessionExportData` / `sessionExportFilename`）+ `machine.ts` 的效果（`export.fetch`/`export.save`）+ `tab.tsx` 的按钮；超时值加在 `EXPORT_REQUEST_TIMEOUT_MS` 旁边。

**改 header 指示器的外观**：`indicator.tsx` 的 `variant`/`placement`/`compact` 三种入参已覆盖 header、tab 标签与窄屏；不要为一个新位置再复制一份组件。

**新增一个格式化需求**：`format.ts` 的 `createSessionContextFormatter(locale)` 是唯一入口（数字、时间、百分比），不要在组件里手写 `Intl`。

## 常见改法与坑

- `messages` 的 `createMemo` 带 `equals: same`（数组逐项比较），否则每次 render 都会被认为变了并触发滚动重算。
- `syncCatalog` 必须在 `usePlugin()` 的上下文里调用（它是通过插件 ctx 拿数据的），不能提到模块顶层——本目录也禁止模块级状态。
- 导出的文件名来自 `sessionExportFilename`（title/slug/id），改格式会让用户已有的脚本失效。
- 窄屏与宽屏是 `usePanel().placement()` 的两个分支，布局差异（padding、`pt-2`）是刻意的；别合并成一套 class。
- `exporting()` 期间按钮要 disable 且换成 `Loader`，但**不能**把整个面板包进 Suspense（首次加载后禁止再 suspend）。
- 原始消息用 `<File mode="text">` 渲染 JSON，`onRendered` 会再派发一次 `content.changed`；大 session 下这是有意为之的滚动修正，不要去掉。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `context/index.ts` | `Plugin.define`：只有多语言目录（无 store） |
| `context/renderer.tsx` | window 入口：`session.header` slot 与 `BuiltinPanel` |
| `context/indicator.tsx` | `SessionContextUsage`：header/tab/窄屏三种形态 |
| `context/tab.tsx` | 侧栏内容：统计、system prompt、原始消息、导出、滚动 |
| `context/catalog.ts` | `syncCatalog` / `catalogModel`：provider/model 目录订阅 |
| `context/catalog-machine.ts` | 目录加载状态机（`CATALOG_LOAD_TIMEOUT_MS`） |
| `context/machine.ts` | 导出与滚动两个状态机及其选择器 |
| `context/export.ts` | `fetchSessionExport`、`sessionExportFilename`、`SessionExportData` |
| `context/format.ts` | 按 locale 的数字/时间/百分比格式化 |
