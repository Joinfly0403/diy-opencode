---
id: session-ui/timeline-message
title: 消息时间线与 markdown/diff 渲染管线
level: L1
layer: session-ui
status: stable
paths:
  - packages/session-ui/src/timeline
  - packages/session-ui/src/message
  - packages/session-ui/src/pierre
  - packages/session-ui/src/components/markdown*
  - packages/session-ui/src/components/session-diff.ts
  - packages/session-ui/src/components/session-review.tsx
  - packages/session-ui/src/components/file.tsx
  - packages/session-ui/src/components/file-media.tsx
  - packages/session-ui/src/components/line-comment.tsx
symbols:
  - Timeline
  - TimelineRow
  - createTimelineProjection
  - createReactiveTimelineProjection
  - timelineCategories
  - timelineCategory
  - timelinePresets
  - transitionTurnPhase
  - viewTurnPhase
  - IDLE_TURN_PHASE
  - transitionSteerArrival
  - SessionUserMessage
  - SessionAssistantContent
  - AssistantTextContent
  - CurrentUserMessageDisplay
  - relativeTime
  - transitionPacedText
  - TEXT_RENDER_PACE_MS
  - Markdown
  - parseMarkdownNodes
  - createMarkdownRenderer
  - projectMarkdown
  - createMarkdownWorkerClient
  - renderCachedMarkdown
  - resolveFileDiff
  - SessionReview
  - DiffProps
  - highlightOptions
  - createFileFind
  - acquireVirtualizer
  - mediaKindFromPath
  - transitionViewerRender
depends_on:
  - contracts/httpapi-protocol
related:
  - app/session-chat
  - session-ui/tool-renderers
  - core/session-execution
keywords:
  - 时间线
  - timeline
  - 消息
  - message
  - markdown
  - 流式
  - 代码高亮
  - diff
  - pierre
  - 虚拟化
  - 行评论
  - 投影
source_hash: e607eb2c116ae94560d028511f430764408f5114
---

## 职责

- 纯渲染层的三块：
  1. **timeline**：把 `SessionMessageInfo[]` 折成有序行（`TimelineRow`）——assistant part、通知、idle/diff 行、turn phase、steer 到达动画。
  2. **message**：单条消息的呈现——用户消息（文本/评论/引用/附件/语音标记）、assistant 文本与 reasoning、compaction 提示、相对时间、流式文本节奏。
  3. **pierre**：diff/file 视图底座——主题注册、渲染机、选择、行评论锚点、查找、虚拟化、媒体判定。
- 外加 markdown 管线（`components/markdown*`）：worker 解析 → 投影成分块 → 增量渲染 + 代码高亮 + 本地图片/链接改写。

## 边界

做什么：投影、行组件、文本节奏、markdown 解析/高亮/缓存、diff 解析与渲染、行选择与行评论锚点、文件与媒体视图。

明确不做：

- 不取数据、不发请求：所有组件从 `useData()` / props 读，数据来源在 `app/session-chat`。
- 不实现具体工具的渲染（`session-ui/tool-renderers` 的 `ToolRegistry`）。
- 不实现时间线虚拟化与滚动跟随（`app/session-chat` 的 `timeline/virtualizer.tsx`、`transitionFollow`）。

## 入口与调用链

```
SessionMessageInfo[] → createTimelineProjection / createReactiveTimelineProjection(projection.ts)
   → TimelineRow[]（含 turn phase、分组、notice 放置）
   → session-timeline-row.tsx（行组件，按 detail 预设决定分组/展开）
       ├─ SessionUserMessage / SessionAssistantContent（message/current-message.tsx）
       │     └─ AssistantTextContent → Markdown(markdown.tsx)
       └─ ToolDisplay（tools/tool-renderer.tsx，另一张卡）

Markdown 管线：
text → projectMarkdown(markdown-worker.ts) → Block[]（markdown-stream.ts）
     → markdown.tsx 逐块渲染：pending 块复用 → 代码块 worker 高亮 → 图片/链接改写 → 缓存
```

- 流式文本：`paced-text-machine.ts` 控制“每次渲染多少字符”（`TEXT_RENDER_PACE_MS` / `TEXT_RENDER_IMMEDIATE`），避免高帧率重排。
- 行评论：`components/line-comment*.ts(x)` + `pierre/comment-hover.ts` + `pierre/commented-lines.ts`。
- diff 走 `@pierre/diffs`：`pierre/index.ts` 先 `registerCustomTheme`，再交给 `file.tsx` 的 `ViewDiff` 渲染。

## 数据与状态

- `TimelineRow` 是持久化的行标识（part ref / group），`app` 侧据此做稳定复用；改 key 语义会让整块重挂。
- `timelinePresets`（`detail.ts`）是用户可见的“详细程度”：每个类别（shell/edit/thinking/subagents/notices/tools/commentary）的 `placement`（separate/grouped/hidden）与 `details` 展开。持久化在 settings。
- markdown 缓存：`markdown-cache.tsx`（`getCachedMarkdown`/`renderCachedMarkdown`）+ `markdown-cache-machine.ts`；worker 缺席时降级到主线程。
- diff 解析缓存：`session-diff.ts` 的 `fileDiffCache` 上限 16 条。
- pierre 渲染池：`pierre/worker.ts` 的 `getWorkerPool`；实例渲染状态由 `render-machine.ts` 管理（`POOL_INIT_TIMEOUT_MS`、`ROWS_READY_TIMEOUT_MS`）。
- 无可恢复的服务端状态：全部由消息内容推导，刷新后重建。

## 关键不变式

- **i18n 硬约束**（`packages/session-ui/AGENTS.md`）：禁止硬编码用户可见英文；计数文案只走 `i18n.plural(baseKey, count, params)`，绝不自己选 `.one`/`.other`；迁移文案时英文必须逐字节不变。
- **排版硬约束**：13px 文本用 `--line-height-compact`（16px），正文用 `--line-height-base`（20px）；禁止 `leading-none`；`TextShimmer` 继承字体度量，覆盖要写在父元素；禁止写字面 font-family。
- **渲染不得进入 Suspense**：读异步资源前先看 `resource.state`，否则会出现闪烁/滚动重置（`packages/app/AGENTS.md` Suspense）。
- **pierre 主题必须先注册**：`registerCustomTheme` 在模块加载时执行，晚于任何 viewer 渲染就会退回默认主题。viewer 与 worker pool 的高亮选项必须一致，pool 的选项胜出。
- **markdown 投影要释放**：`disposeMarkdownProjection` / `disposeStreamingCode` 必须随组件销毁调用，否则 worker 里会堆积。
- 生命周期动效一律纯状态机（precedent `src/message/action-machine.ts`），不在组件里塞布尔。

## 扩展点

- **加一种时间线行**：`timeline-row.ts` 的 `TimelineRow` union 加变体 → `projection.ts` 产出它 → `session-timeline-row.tsx` 加分支。
- **加一个 detail 类别**：`detail.ts` 的 `timelineCategories` + `TimelineDetail` + 每个 preset 补齐 → UI 选择器。
- **改 markdown 渲染**：`markdown.tsx`（块渲染）+ `markdown.worker.ts`（解析/高亮）；两侧协议在 `markdown-worker-protocol.ts`。
- **改 diff 外观/行为**：`pierre/index.ts` 的 `highlightOptions` / CSS 变量，以及 `components/file.tsx` 的 `VirtualizedFileDiff` 选项。
- **加行评论能力**：`components/line-comment-annotations.tsx` + `pierre/comment-hover.ts`。

## 常见改法与坑

- 在 `projection.ts` 里 new 对象而不是复用：会让每帧都换行 key，虚拟化疯狂重挂（这是性能热点）。
- 渲染期直接 `resource()`：会 suspend 整个时间线，表现为“新消息到来时滚动回顶”。
- 在 `markdown.tsx` 里同步 `parseMarkdown`（主线程）：大消息会卡住输入；应该走 `projectMarkdown`。
- 用 `i18n.t` 传复数变体 key（`.one`/`.other`）：AGENTS.md 明确禁止，要用 `i18n.plural`。
- `fileDiffCache` 只是 LRU-16 的解析缓存，不是正确性依赖；改大它只增加内存。
- `mediaKindFromPath`/`isBinaryContent` 决定用 media 还是文本视图，按 MIME 猜而不是按扩展名会误判。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/session-ui/src/timeline/projection.ts` | 消息 → 行的投影、`Timeline` namespace |
| `packages/session-ui/src/timeline/timeline-row.ts` | `TimelineRow` 行类型定义 |
| `packages/session-ui/src/timeline/detail.ts` | detail 类别与 preset（placement/expansion） |
| `packages/session-ui/src/timeline/session-timeline-row.tsx` | 行组件与 turn 呈现 |
| `packages/session-ui/src/timeline/turn-phase-machine.ts` | turn 阶段（running/完成/中断） |
| `packages/session-ui/src/timeline/steer-arrival-machine.ts` | steer 到达动画与用户消息增长 |
| `packages/session-ui/src/message/current-message.tsx` | 用户/assistant 消息入口组件 |
| `packages/session-ui/src/message/message-content.tsx` | 文本、reasoning、compaction、附件卡片 |
| `packages/session-ui/src/message/paced-text-machine.ts` | 流式文本渲染节奏 |
| `packages/session-ui/src/components/markdown.tsx` | markdown 块渲染、代码块、链接/图片改写 |
| `packages/session-ui/src/components/markdown-worker.ts` | worker 客户端：解析、投影、流式高亮 |
| `packages/session-ui/src/components/markdown-stream.ts` | 投影 Block 结构与 `@opencode/patchmark` 流 |
| `packages/session-ui/src/components/session-diff.ts` | patch/内容 → `FileDiffMetadata`（带 LRU） |
| `packages/session-ui/src/pierre/index.ts` | 主题注册、`DiffProps`、高亮选项 |
| `packages/session-ui/src/pierre/render-machine.ts` | viewer 实例渲染状态机与超时 |
