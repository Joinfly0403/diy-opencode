---
id: session-ui/tool-renderers
title: 工具调用渲染约定与来源卡片
level: L1
layer: session-ui
status: stable
paths:
  - packages/session-ui/src/tools
  - packages/session-ui/src/components
  - packages/session-ui/src/sources
  - packages/session-ui/src/v2
symbols:
  - ToolRegistry
  - ToolProps
  - ToolDisplay
  - ContextGroupPart
  - CurrentContextToolGroup
  - CurrentReadToolGroup
  - CurrentFileToolGroup
  - SessionShellMessage
  - taskAgentName
  - BasicTool
  - GenericTool
  - ToolErrorCard
  - ToolStatusTitle
  - transitionDisclosure
  - createDisclosure
  - createCopyFeedback
  - stripAnsi
  - createShellFollower
  - shellRunProps
  - subagentRunProps
  - transitionShellRun
  - transitionShellFollower
  - ApplyPatchFile
  - SourcesChip
  - SourcesPanel
  - SourcesTitle
  - turnSources
  - SessionReviewV2
  - SessionFilePanelV2
  - SessionProgressIndicatorV2
  - FileMedia
keywords:
  - 工具调用
  - tool renderer
  - ToolRegistry
  - BasicTool
  - 分组
  - 错误卡
  - shell 输出
  - subagent
  - 来源
  - sources
  - v2
  - 新增工具
source_hash: f4fd3f6d709b4faa3de673dc5d615cd582e9da24
---

## 职责

- 每个工具调用的前端渲染约定：`ToolDisplay` 按 `tool` 名从 `ToolRegistry` 取渲染器，缺省落到 `GenericTool`；错误走 `ToolErrorCard`。新增工具**必须**在这里注册，否则只有通用折叠行。
- 分组：`CurrentContextToolGroup`（上下文类、reasoning、shell 的混合分组）、`CurrentReadToolGroup`（read 合并成一行文件名列表）、`CurrentFileToolGroup`（edit/write/patch 合并成 patch 视图）。
- shell/subagent 行的运行态：`run-machine.ts`（`shellRunProps`/`subagentRunProps`）与 `shell-output.ts` 的尾部跟随；ANSI 用 `stripAnsi` 清洗。
- 来源卡片：`sources/` 把一轮里的 websearch/webfetch 折成 `TurnSources`，渲染 chip、面板、标题。
- `v2/`：新版组件面（review 侧栏、文件预览、进度指示器）。

## 边界

做什么：工具行的触发器/内容/状态/错误呈现、分组与折叠、shell 输出跟随、来源卡片、v2 组件。

明确不做：

- 不定义工具、不解析工具输入语义（`core/tool-registry`）；这里只做展示。
- 不取数据：工具 part 由 props 传入，会话数据来自 `useData()`。
- 不实现 markdown/diff 底座（`session-ui/timeline-message`），只调用 `Markdown` 与 `File`。

## 入口与调用链

```
session-timeline-row → SessionAssistantContent/CurrentContextToolGroup
   → ToolDisplay({ tool, input, metadata, output, status, error })
        ├─ status === "error" → ToolErrorCard（subtitle 与触发器保持一致）
        └─ ToolRegistry.render(tool) ?? GenericTool
              └─ BasicTool({ trigger, hasContent, ... })  // 统一折叠/标题/状态图标

新增一个工具：
ToolRegistry.register({ name, render(props) { return <BasicTool .../> } })
```

- 工具名映射到标题：`toolTitle()` 的 switch；`toolErrorSubtitle()` 必须与触发器的 subtitle 表达式一致（注释里明确要求）。
- shell 输出：`createShellFollower` 轮询尾部字节（`SHELL_TAIL_BYTES` 级上限），退出后有限次重试。
- 来源：`turnSources(messages)` → `SourceStep[]` + 去重后的 `sources`；`SourcesChip` 触发 `SourcesPanel`。

## 数据与状态

- `ToolProps`：`tool` / `input` / `metadata` / `output` / `status` / `error` / `open` / `onOpenChange` / `fileOpen` / `filePath` 类开关。`input` 与 `metadata` 是**开放记录**：每个渲染器用 `toolInput`/`toolMetadata`（逐字段 `optional` + catchDecoding）解码自己读的字段，坏字段只丢该字段。
- 折叠状态：`createDisclosure` + `disclosure-machine.ts`（mounted/deferred），`onSizeChange` 通知外层重新测量。
- 复制反馈：`createCopyFeedback`（`COPY_FEEDBACK_MS`），只关心一次性 UI 状态。
- 分组不持久化：展开与否随视图存在，随 timeline 缓存（`app/session-chat` 的 `createTimelineCache`）存活。
- 来源是推导值：不持久化，重新渲染由消息内容重建。

## 关键不变式

- **新增工具必须注册**：`ToolRegistry.register` 是唯一入口；未注册就只有 `GenericTool` 的原始 key-value 视图。
- **错误行的 subtitle 必须与正常行一致**：`toolErrorSubtitle` 的分支要和该工具触发器的 subtitle 表达式逐项对齐（源码注释明确要求），否则失败时信息形态突变。
- **i18n 硬约束**（`packages/session-ui/AGENTS.md`）：用户可见英文一律走 i18n key；计数用 `i18n.plural`；不能硬编码，也不能为翻译改已有英文。
- **排版硬约束**：工具/notice/截断文本用 `--line-height-compact`（16px）；字号 13px 时不许 `leading-none`；命令与路径用 code font，禁止字面 family。
- **不改共享指示器外观**：`Spinner` 只表示 AI 在干活（runner/tool 运行中）；其它加载用 `Loader`；不要把 `Loader` 改成 `Spinner` 的样子（AGENTS.md Loading Indicators）。
- **滚动容器要标 `data-scrollable`**，嵌套滚动才让内层先滚（AGENTS.md Scrolling）。

## 扩展点

新增一个工具渲染的标准动作（按顺序）：

1. `tools/tool-renderer.tsx` 里 `ToolRegistry.register({ name, render })`。
2. `toolTitle()` 加 `case "<name>"`，补 i18n key（`ui.tool.<name>`）。
3. 若读新字段，在 `toolInput` / `toolMetadata` 的 Schema 里加 `optional(...)` 字段。
4. 分组：如果是文件改动类，接 `isFileChangeTool` / `CurrentFileToolGroup`；如果可合并，改 `CurrentContextToolGroup` 的 `items()` 合并规则。
5. `toolErrorSubtitle()` 补该工具的错误副标题分支。
6. 触发器用 `BasicTool` 的 `trigger.title/subtitle/args` 或自定义 trigger；内容用 `hasContent` + `defer` 控制懒渲染。
7. 补 stories（`tools/*.stories.tsx`）与 component-tests；不要为测试加生产 seam。

其它扩展点：

- **加来源类型**：`sources/sources.ts` 的 `SourceStep` 加变体 + `turnSources` 提取 + `SourcesPanel` 渲染。
- **加 v2 组件**：`v2/components/*.tsx`，通过 `@opencode/session-ui/v2/*` 导出。
- **改 shell 尾部跟随**：`tools/shell-output-machine.ts` 的常量与状态。

## 常见改法与坑

- 在渲染器里直接 `props.input.path as string`：工具输入是未校验记录，插件工具更是任意形状；必须用 `toolInput()` 解码。
- 在 `CurrentContextToolGroup` 的 `items()` 里加合并规则却不同步 `patchKeys`：多文件 patch 分组会串组。
- 折叠时先 `onOpenChange` 再滚动：内容变短会先夹住滚动位置，导致折叠后视口跳到别处（源码里先 `scrollBy` 再回调）。
- `BasicTool` 的 `allowOpenWhilePending` 用于运行中也能展开（上下文组在用）；漏设会让推理/工具在跑时无法查看。
- 直接改 `ToolErrorCard` 的标题而不改 `toolErrorSubtitle`：错误行与正常行文案不一致。
- `v2/` 组件不参与旧布局的样式变量（`--v2-*` 与 `--*` 两套 token），混用会掉色。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/session-ui/src/tools/tool-renderer.tsx` | `ToolRegistry`、`ToolDisplay`、所有工具的渲染注册与分组 |
| `packages/session-ui/src/tools/ansi.ts` | ANSI 清理 |
| `packages/session-ui/src/tools/run-machine.ts` | shell/subagent 行运行态与视图属性 |
| `packages/session-ui/src/tools/shell-output.ts` | shell 输出尾部跟随 |
| `packages/session-ui/src/tools/shell-output-machine.ts` | 轮询/退避/重试常量与状态 |
| `packages/session-ui/src/components/basic-tool.tsx` | `BasicTool` 触发器与折叠骨架、`GenericTool` |
| `packages/session-ui/src/components/tool-error-card.tsx` | 具名错误卡 |
| `packages/session-ui/src/components/tool-status-title.tsx` | 状态标题动效 |
| `packages/session-ui/src/components/disclosure-machine.ts` | 折叠/延迟挂载状态机 |
| `packages/session-ui/src/components/apply-patch-file.ts` | 多文件 patch 分组与差异来源 |
| `packages/session-ui/src/components/message-part.tsx` | 消息 part 的对外聚合导出 |
| `packages/session-ui/src/sources/sources.ts` | 一轮内的搜索/抓取步骤与去重来源 |
| `packages/session-ui/src/sources/sources-panel.tsx` | 来源面板 |
| `packages/session-ui/src/v2/components/session-review-v2.tsx` | 新版 review 侧栏 |
| `packages/session-ui/src/v2/components/session-file-panel-v2.tsx` | 新版文件面板 |
