---
id: tui/prompt-editor
title: 输入框、编辑器与提交（steer / queue）
level: L1
layer: tui
status: stable
paths:
  - packages/tui/src/prompt
  - packages/tui/src/component/prompt
  - packages/tui/src/context
  - packages/tui/src/routes/session/composer
symbols:
  - Prompt
  - PromptProps
  - PromptRef
  - Autocomplete
  - PromptMetadataRow
  - usePromptMove
  - saveDraft
  - takeDraft
  - appendToSessionPrompt
  - registerComposer
  - MAX_LOCAL_ATTACHMENT_BYTES
  - normalizePastedFilepath
  - parsePastedFilepaths
  - promptFilesForServer
  - readLocalAttachment
  - normalizePromptContent
  - expandTrackedPastedText
  - expandPastedTextPlaceholders
  - parseSlashHead
  - parseFileLineRange
  - stripFileLineRange
  - promptOffsetIndex
  - mentionTriggerIndex
  - slashTriggerIndex
  - computePromptTraits
  - projectedPromptInput
  - restoredPromptInput
  - realignPromptMentions
  - deduplicatePromptImages
  - deduplicateVisibleImages
  - preserveMentionlessPromptAttachments
  - promptAttachmentLabel
  - usePromptRestore
  - MAX_FRECENCY_ENTRIES
  - parseFrecency
  - MAX_STASH_ENTRIES
  - parsePromptStash
  - parsePromptHistory
  - parsePromptInfo
  - appendPrompt
  - emptyPrompt
  - directoryAutocompleteExactValue
  - directoryAutocompleteMatches
  - slashArgumentAutocomplete
  - useDirectoryRecents
  - createSimpleContext
  - createStorage
  - useStorage
  - useStorageOptional
  - useEvent
  - usePathFormatter
  - createPanelState
  - EditorSelection
  - EditorIntegration
  - TuiPaths
  - useTuiPaths
  - InteractivityProvider
  - resolveInteractivity
  - programStatusReports
  - createProgramStatus
  - Composer
  - useComposerTab
  - ShellTab
  - TerminalsTab
  - SubagentsTab
depends_on:
  - core/session-execution
  - contracts/events-db
  - tui/routes-shell
related:
  - tui/components
  - tui/mini
  - core/permission-policy
keywords:
  - 输入框
  - prompt
  - 提交
  - steer
  - queue
  - 粘贴
  - 附件
  - mention
  - slash
  - 编辑器
  - 草稿
  - 历史
source_hash: 465f533b08583aece8c5fad7117175b1b1155989
---

## 职责

会话输入的全部前端逻辑：文本编辑、部分（part）追踪、自动补全、粘贴与附件、草稿/历史/暂存、提交与投递方式。

- `component/prompt/index.tsx`（约 2000 行）是输入框渲染层：OpenTUI textarea + extmark 追踪、keymap 层、autocomplete 集成、提交函数 `submit(delivery)`。
- `component/prompt/autocomplete.tsx` 是 `@`/`/` 补全列表；`move.tsx` 负责新建会话时的提交交接；`metadata.tsx` 显示模型/agent 元信息；`draft-stash.ts` 是"按会话键保存草稿"的注册表。
- `prompt/*.ts` 是纯函数层：解析、偏移量换算、部分展开、附件去重、投影/还原、历史与暂存序列化。
- `context/*` 是跨组件状态：编辑器外部集成、模型/agent 选择、持久化 storage、数据 store 适配层。

## 边界

做什么：把"用户输入"变成一次带 `delivery` 的 admission 请求，并在失败时把输入还回编辑器。

不做什么：
- 不决定 steer/queue 的服务端语义（真正语义在 `core/session-execution`；TUI 只传 `SessionInbox.Delivery`）。
- 不做消息投影（`context/data.tsx` 只是 `@opencode/client/solid` 的 `createData` 适配）。
- 不做 slash 命令实现（命令表来自 keymap 的 `slash` 元数据与服务端 command 列表）。
- 不渲染会话转录（`routes/session`）。

## 入口与调用链

```
按键 → keymap 层（prompt.submit 绑定在主编辑器上，prompt.queue 单独一层）
  → submit(delivery = "steer")            // 未指定即 steer
      submitting 重入保护 → submitInner(delivery)
        IME 兜底：input.plainText 与 store 不一致时先同步
        trimmed 为空 → onEmptySubmit（提交当前 agent/model 选择）
        exit/quit/:q → 退出；slash → 执行命令后清空
        shell 模式 → client.api.session.shell
        slash 命令 → client.api.session.command（带 delivery）
        否则 → 快照 + 同步清空 composer → data.session.prompt({ delivery, prepare: commitModel })
                → 失败时若用户没开始输入则 restoreEntry
  → 新会话：session.create 的 gate 串起 editor context 的 synthetic(resume:false) 与真实 prompt
```

- 提交前会 `commitSelection()`：`prepareAgent` + `client.api.session.switchModel`（`local.model.trackSessionCommit` 做乐观追踪）。
- `prompt.queue` 走同一函数但 `delivery = "queue"`，并显式拒绝三种情况：shell 模式、退出词、slash 命令，以及"编辑器上下文待提交"。
- 提交成功后：`history.append(entry)` → 若是新会话则把还在 home 输入框里的后打字 stash 到新 sessionID → `route.navigate` 到会话页。

## 数据与状态

- `PromptInfo`（`prompt/history.tsx`）：`{ text, files, agents, skills, pasted, mode }`；`mode` 是 `normal | shell`。
- 部分追踪：file/agent/skill/pasted 四类，offset 用 textarea 偏移（不是字符串下标），存 `extmarkToPart` 映射。
- 持久化文件都在 `paths.state`：`prompt-history.jsonl`（`MAX_HISTORY_ENTRIES`）、`prompt-stash.jsonl`（`MAX_STASH_ENTRIES = 50`）、frecency（`MAX_FRECENCY_ENTRIES = 1000`，按 `frequency / (1 + days)` 排序）。
- `useStorage().store(key, { initial })`：JSON 文件 + flock + 原子写，值必须 JSON 可序列化（`clone()` 会抛）；`memory(key)` 是进程内状态，插件热重载后仍存活，退出即失。storage 路径是 `<root>/<channel>/tui/<key>.json`，key 会被 `segment()` 校验。
- `useDirectoryRecents` 存在 storage 键 `directory-recents`，每个 project 最多 10 条。
- 编辑器外部集成（`context/editor.ts`）用 JSON-RPC/MCP 协议（`MCP_PROTOCOL_VERSION`），把外部选区作为 `EditorSelection` 注入；选择态 `pending` 时不能排队。

## 关键不变式

- **提交前必须快照并在第一次 await 之前同步清空**（`submitInner` 注释）：之后所有读取都基于快照，飞行中打的字落进已清空的输入框得以保留，历史记录的是真正提交的内容。
- **重入保护**：`submitting` 守卫挡双击 Enter 与 native `onSubmit` 竞争；没有它会发出"幽灵空 prompt"到一个刚创建的会话。
- **IME 兜底**：双延迟回调可能在最后一个组合字符写入 store 前触发，所以先读 `input.plainText` 并同步。
- **偏移量必须按显示宽度换算**（`prompt/display.ts`）：`promptOffsetIndex` 按字形边界二分 `measureEditText`，粘贴展开从右往左做以保持左侧下标有效；用字符串长度必然错位。
- **`media:<hash>` 引用要还原成 `data:` 才能放回草稿**（`prompt/codec.ts` 的 `restoredPromptInput`）：inbox 取消或在提交时提交 revert 后服务端会释放 blob；`usePromptRestore` 在读之前就读字节，读失败不改变状态，缺失图片只警告（`allowMissing: false` 才拒绝）。
- **mention 身份不跟随 store reconcile**：`realignPromptMentions` 在文本变化后按出现次数重新对齐，纯文本重复项先按内容长度排序保护已有区间。
- **traits 不接管按键**：`computePromptTraits` 只声明 capture 与 status，`suspend` 归受管 textarea keymap 层。
- **queue 不是万能降级**：shell 命令、退出词、slash 命令、待提交的编辑器上下文都明确拒绝排队并 toast 警告。
- **空提交有语义**：在已有会话里空 Enter 会提交当前 agent/model 选择并交给路由（用于提升排队项），不是 no-op。

## 扩展点

- **加一种 prompt part**：`PromptInfo` 加字段 → `prompt/codec.ts` 的投影/还原 → `component/prompt/index.tsx` 的 extmark 同步与渲染 → `routes/session/session.shared`/`component/prompt/local-attachment.ts` 的发送格式 → server 端 schema。
- **加一个自动补全来源**：`component/prompt/autocomplete.tsx` 里加分支 → 触发条件放 `prompt/display.ts`（`mentionTriggerIndex`/`slashTriggerIndex`）→ 取数放 `prompt/directory-*.ts` 之类的纯函数。
- **加一条输入快捷键**：`config/keybind.ts` 的 `Definitions` 加 `prompt.*` 条目 → `component/prompt/index.tsx` 的 keymap 层引用该 id。
- **加一种持久化草稿维度**：`component/prompt/draft-stash.ts` 的 `saveDraft/takeDraft`（按会话键），别在组件里自己写文件。
- **接一个新的外部编辑器**：`context/editor.ts` 的集成集合 + `editor.ts`/`editor-zed*.ts` 的传输实现。

## 常见改法与坑

- 在 `submitInner` 里 await 之后再读 `store.prompt`：会读到飞行中新输入，历史与发送内容不一致。
- 用 `text.length` 换算 extmark 偏移：CJK/emoji/组合字符都会错位；一律走 `promptOffsetIndex`。
- 忘记 `restoreEntry` 的"用户已开始输入就不还原"判断：会把用户新打的字覆盖掉。
- 排队编辑器上下文会丢内容：代码直接拒绝，改这段要同步改提示语与测试。
- 直接 `writeFile` 到 `paths.state`：storage 用 flock + 原子写，绕过它会在多实例下损坏文件。
- `Prompt` 的 `ref`（`PromptRef`）是命令式句柄（`set`/`submit`/`focused`），`context/prompt.tsx` 只持有当前实例；换路由后旧 ref 失效，不要缓存。
- 新会话路径上输入框会卸载：仍在输入框里的文字必须在 `route.navigate` 前 `saveDraft` 到新 sessionID，否则草稿会被存到 home 键下。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/tui/src/component/prompt/index.tsx` | 输入框渲染、keymap 层、`submit`/`submitInner`、提交交接 |
| `packages/tui/src/component/prompt/autocomplete.tsx` | 补全列表与选中逻辑 |
| `packages/tui/src/component/prompt/draft-stash.ts` | 按会话键的草稿注册表 |
| `packages/tui/src/component/prompt/local-attachment.ts` | 本地文件粘贴、大小上限、发送格式 |
| `packages/tui/src/prompt/codec.ts` | 投影/还原（含 `media:` → `data:`） |
| `packages/tui/src/prompt/history.tsx` | `PromptInfo`、历史追加、序列化 |
| `packages/tui/src/prompt/stash.tsx` | 暂存条目与上限 |
| `packages/tui/src/prompt/display.ts` | 字形偏移、@ 与 / 触发位置 |
| `packages/tui/src/prompt/part.ts` | 粘贴文本展开（右到左） |
| `packages/tui/src/prompt/mention.ts` | mention 重对齐 |
| `packages/tui/src/prompt/attachment.ts` | 图片/PDF 去重与标签 |
| `packages/tui/src/prompt/restore.ts` | 从已发送消息还原输入 |
| `packages/tui/src/context/storage.tsx` | durable JSON store 与 memory store |
| `packages/tui/src/context/editor.ts` | 外部编辑器选区集成 |
| `packages/tui/src/context/local.tsx` | 模型/agent/变体选择与持久化 |
