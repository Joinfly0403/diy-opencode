---
id: app/composer
title: 输入区与新建会话（附件、@ 引用、模型选择、发送）
level: L1
layer: app
status: stable
paths:
  - packages/app/src/composer
  - packages/app/src/new-session
symbols:
  - Composer
  - ComposerEditor
  - createComposerModel
  - createComposerAttachments
  - buildPromptRequest
  - serializePrompt
  - promptLength
  - appendPrompt
  - parseSlashCommand
  - DEFAULT_PROMPT
  - isCommentItem
  - createComposerSubmitState
  - transitionComposerSubmit
  - transitionModelChip
  - ComposerStateTarget
  - createNewSessionStartStore
  - createNewSessionWorkspaceController
  - NEW_SESSION_WORKTREE_TIMEOUT_MS
depends_on:
  - app/runtime
  - app/settings
  - app/session-chat
related:
  - app/voice
  - session-ui/timeline-message
  - core/session-execution
keywords:
  - 输入框
  - composer
  - 附件
  - 粘贴图片
  - @ 引用
  - slash 命令
  - 模型选择
  - agent
  - 发送
  - steer
  - 队列
  - 新建会话
  - worktree
source_hash: f29177f3a2a3185f6de5d9e6768fa234e6c667a1
---

## 职责

- 提示词的编辑与提交：富文本编辑器（段落/附件/@ 引用/skill/评论）、slash 命令、历史、附件上传、图片粘贴与拖拽、模型与 agent 选择、发送（含 steer 与 queue 两种投递）。
- `new-session/`：草稿会话页。选项目/工作区/分支、MCP 开关、提交后创建 worktree 与 Session，再把 composer 与草稿“提升”成真实会话的输入区。
- 提交的核心是一台状态机（`machine.ts` + `submit.ts`）：草稿被捕获 → 附件解析 → 发送 → settle；失败可恢复草稿。

## 边界

做什么：提示词编码（`buildPromptRequest`）、编辑体验、附件生命周期、输入区状态持久化、发送/排队/编辑队列项、新建会话的准备工作区。

明确不做：

- 不渲染时间线（`session-ui/timeline-message`），不持有会话数据（`app/session-chat`）。
- 不实现 server 端 prompt 接纳语义（`core/session-execution` 的 `session.inbox.enqueued`）。
- 不实现模型目录与凭据（`app/settings` 的 providers/models）。

## 入口与调用链

```
Composer(composer.tsx) → ComposerEditor(editor/editor.tsx)
   ├─ createComposerModel(adapter)          // 会话/草稿两种 adapter 都实现同一契约
   ├─ createComposerAttachments(...)        // 文件选择、拖拽、粘贴、上传
   └─ submit.ts → transitionComposerSubmit(machine.ts)
        idle → held / running / preparing → idle
        ↓ buildPromptRequest(request.ts)   // text + files + agents + skills + comments + attachments
        ↓ adapter.session.send / queue      // delivery: "steer" | "queue"
```

- 模型选择：`model-chip-machine.ts`（打开/选中/挂起）+ `providers/models/selection`（真正的选择状态在 settings 侧）。
- @ 引用：`editor/mention-search-machine.ts` 提供候选，`suggestions/machine.ts` 管弹出层；引用最终进 `Prompt` 的 `file`/`agent`/`skill` part。
- 新建会话：`new-session/screen.tsx` → `createNewSessionWorkspaceController` → 提交 → `machine.ts` 的 worktree → mcp → session → started 四段。

## 数据与状态

- `ComposerStore`（`schema.ts`）按 scope 持久化：`{ draftID }`（新建草稿）或 `{ dir, id? }`（会话草稿）；内容含 prompt、cursor、context items、retry。
- 附件：`attachments/uploads.ts` 管进行中的上传（按 draft scope 复用），`persistence/drafts.ts` 的 blob 引用让草稿能跨重挂载存活。
- 提交结果：`PromptHistoryComment`、`CapturedDraft`（initial/target/preserveDraft）；提升到新会话后 `target` 会变。
- 乐观状态：`submit.ts` 里的 `statuses`（per session 的 busy 状态）与 `switched`（从本客户端切过的模型）是模块级 Map，跨 composer 实例共享。
- 新建会话超时：worktree 11 分钟（比 server 端 10 分钟的 setup 脚本预算更长）、MCP 2 分钟、创建 Session 30s。

## 关键不变式

- **发送的生命周期必须走状态机**：`transitionComposerSubmit` 是唯一真相；不要在组件里加 `sending` 布尔（`packages/app/AGENTS.md` “State Machines”）。
- **同步认领**：离开 `idle` 必须在启动工作的同一个事件里、第一个 `await` 之前完成，否则第二次 Enter/点击会穿过去。
- **同一数据的操作串行化**（steer、删除、重排、undo）在机器的 `active` + `pending` 队列里走；旁路会复活已被删除的内容。
- 草稿提升（新建会话）时 `preserveDraft` 决定是否保留用户在准备期间新输入的跟进内容——改了会丢字。
- 不要硬编码用户可见英文：用 `language.t(...)` / `language.plural(...)`（AGENTS.md Localization）。
- 滚动条：输入区这类会因原生滚动条重排文本的容器用 `scrollbar-gutter: stable` 并减 `var(--scrollbar-size, 0px)`；不要用 `ScrollView`。

## 扩展点

- **加一种 prompt part**：`schema.ts` 的 `Prompt` union 加变体 → `prompt-parts.ts` 的序列化/长度 → `request.ts` 的 `buildPromptRequest` → `editor/editor.tsx` 渲染。
- **加一个 slash 命令**：`client-slash-command.ts` 解析 → `commands.tsx` 注册 → `machine.ts` 的 `SubmissionKind` 处理。
- **加附件类型**：`attachments/destination.ts` 加目的地 → `attachments.ts` 的接受类型 → `request.ts` 的 mime 映射。
- **加新建会话步骤**：`new-session/machine.ts` 加状态/事件 → `composer-adapter.ts` 的 driver 执行 effect → `view.tsx` 加视图。
- **改投递语义**：只改 `adapter.ts` 的 `ComposerDelivery`/`ComposerQueue` 契约与消费方（`session/composer/queue.ts`）。

## 常见改法与坑

- 在 `buildPromptRequest` 之外自己拼请求体：会把 mention 的 `start/end` 偏移丢掉，导致 server 端高亮/引用错位。
- 附件 blob 引用必须等发送完成再释放；提前 `URL.revokeObjectURL` 会让已发出的图片变空。
- 改 `NEW_SESSION_WORKTREE_TIMEOUT_MS` 要同时看 server 端 setup 预算：比它短会杀掉正在跑脚本的 worktree，留下“已注册但半初始化”的工作区。
- `DEFAULT_PROMPT` 是结构化默认值，不是空字符串；`reset()` 用它，别手写 `[]`。
- 输入区的 `scrollbar-gutter`/padding 补偿有专属约定，改高度会在滚动条出现的瞬间触发文本重排。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/app/src/composer/composer.tsx` | 输入区外壳、模型 chip、按钮与快捷键 |
| `packages/app/src/composer/editor/editor.tsx` | 富文本编辑器、popover、附件卡片、@ 引用 |
| `packages/app/src/composer/machine.ts` | 提交状态机（held/running/preparing）与草稿捕获 |
| `packages/app/src/composer/submit.ts` | 提交驱动：附件解析、发送、settle、乐观状态 |
| `packages/app/src/composer/adapter.ts` | `ComposerSession` / `ComposerQueue` / `ComposerDelivery` 契约 |
| `packages/app/src/composer/request.ts` | `buildPromptRequest`：text/files/agents/skills/comments |
| `packages/app/src/composer/schema.ts` | `ComposerStore` 持久化 schema 与 `DEFAULT_PROMPT` |
| `packages/app/src/composer/state.ts` | store 与 actions、按 scope 的草稿恢复 |
| `packages/app/src/composer/prompt-parts.ts` | prompt part 序列化、长度、克隆 |
| `packages/app/src/composer/attachments/` | 上传机、目的地、文件选择与拖拽 |
| `packages/app/src/composer/model-chip-machine.ts` | 模型 chip 的打开/选中/挂起 |
| `packages/app/src/new-session/machine.ts` | 新建会话四段：worktree → mcp → session → started |
| `packages/app/src/new-session/composer-adapter.ts` | 草稿会话的 adapter 与 start store |
| `packages/app/src/new-session/workspace/controller.ts` | 工作区/分支选择与 inventory 读取 |
| `packages/app/src/new-session/location/dialog.tsx` | 目录选择对话框 |
