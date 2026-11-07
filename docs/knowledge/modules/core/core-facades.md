---
id: core/core-facades
title: core 顶层门面模块（未单独成卡的服务与单例）
level: L1
layer: core
status: stable
paths:
  - packages/core/src/agent.ts
  - packages/core/src/app.ts
  - packages/core/src/artifact.ts
  - packages/core/src/command.ts
  - packages/core/src/file-access.ts
  - packages/core/src/file-mutation.ts
  - packages/core/src/file-retention.ts
  - packages/core/src/filesystem.ts
  - packages/core/src/form.ts
  - packages/core/src/generate.ts
  - packages/core/src/instruction-discovery.ts
  - packages/core/src/kv.ts
  - packages/core/src/kv
  - packages/core/src/mime.ts
  - packages/core/src/models-dev.ts
  - packages/core/src/reference.ts
  - packages/core/src/reference
  - packages/core/src/repository.ts
  - packages/core/src/repository-cache.ts
  - packages/core/src/ripgrep.ts
  - packages/core/src/rpc.ts
  - packages/core/src/schema.ts
  - packages/core/src/shared-cache.ts
  - packages/core/src/snapshot.ts
  - packages/core/src/state.ts
  - packages/core/src/variant.ts
  - packages/core/src/voice.ts
  - packages/core/src/websearch.ts
  - packages/core/src/wellknown.ts
  - packages/core/src/wellknown
  - packages/core/src/instructions
  - packages/core/src/modal
  - packages/core/src/ripgrep
  - packages/core/src/vcs
symbols:
  - Agent
  - App
  - Artifact
  - Command
  - FileAccess
  - FileMutation
  - FileRetention
  - FileSystem
  - Form
  - Generate
  - InstructionDiscovery
  - KV
  - Mime
  - ModelsDev
  - Reference
  - SharedCache
  - Snapshot
  - State
  - Variant
  - Voice
  - WebSearch
depends_on:
  - core/location-instance
related:
  - core/session-execution
  - core/tool-registry
  - contracts/events-db
keywords:
  - core 顶层
  - 门面
  - 服务
  - agent
  - snapshot
  - state
  - kv
  - websearch
  - 指令发现
source_hash: 0b244fc95936e2eba8254e7e241e7e5a20745aac
---

## 职责

`packages/core/src` 顶层那一批**单文件服务**（不是 session/tool/permission 这种大模块）。它们各自只做一件事，但因为都放在顶层、又以 `export * as X from "./x.js"` 自导出，检索时容易"知道有这东西但不知道在哪"。

这张卡是它们的**索引**：按文件给出一句话定位，细节仍读文件本体。

| 文件 | 定位 |
| --- | --- |
| `agent.ts` | 代理（agent）定义与解析：`Agent.ID/Name`、agents 目录发现、与 config 的 agent 项合并 |
| `app.ts` | 应用元数据：`App.Metadata`（name/version/channel）与 `useragent(app)` 生成 UA |
| `artifact.ts` | 产物（artifact）服务：`ProviderID`/`ProviderCreateInput`/`ProviderUpdateInput`，本地 provider 写入与版本 |
| `command.ts` | 自定义命令（`/xxx`）：`Info`、`Invocation`、`Definition`，模板展开与参数 |
| `form.ts` | 跨端表单描述（工具提问/授权之外的输入表单）：`Form.ID`/`Form.Info` |
| `generate.ts` | 生成类调用（标题、摘要等）：`TextInput`、`UnavailableError`、`ModelNotFoundError` |
| `filesystem.ts` | Location 作用域文件系统门面（读写删、目录列举）；底层在 `filesystem/`，本卡只索引 |
| `file-access.ts` | 路径访问解析与越界判定：`Kind = file|directory`、`ResolveInput` |
| `file-mutation.ts` | 写前变更模型：`WriteInput`/`TextWriteInput`/`WriteResult`，供 edit/write/patch 工具共用 |
| `file-retention.ts` | 过期文件清理：`cleanup`（按保留期扫目录） |
| `instruction-discovery.ts` | 指令文件发现（AGENTS.md/CLAUDE.md 一类）：`File`、`Event`、`Editor` |
| `kv.ts` + `kv/` | Location 键值存取：JSON 值、`Entry`、`ScanOptions`，sql 实现在 `kv/sql.ts` |
| `mime.ts` | MIME 探测：`detect(bytes)`、`isTextual` |
| `models-dev.ts` | models.dev 快照服务：`Snapshot`、`Options`，提供模型能力目录（provider 侧只消费） |
| `reference.ts` + `reference/` | 外部引用（`@file`/`@git`）：`LocalSource`、`GitSource`，instructions 注入在 `reference/instructions.ts` |
| `repository.ts` | 仓库引用（remote/file）与 `InvalidReferenceError` |
| `repository-cache.ts` | 仓库缓存：`EnsureInput`、`InvalidBranchError`、`CloneFailedError` |
| `ripgrep.ts` | ripgrep 搜索服务门面（二进制定位在 `ripgrep/`） |
| `rpc.ts` | 插件 RPC 服务（跨进程调用端点） |
| `schema.ts` | core 内部类型工具：`DeepMutable` 等 |
| `shared-cache.ts` | 跨实例共享缓存原语：`Service`、`interval = 10 分钟` |
| `snapshot.ts` | 文件树快照与 diff：`CompareInput`/`DiffInput`，供会话的改动回看与 revert |
| `state.ts` | 可重放状态：`Registration`、`Transform`、`Reload`，插件/工具注册表共用（注册顺序语义在这里） |
| `variant.ts` | 模型变体与推理档：`supports(reasoning)`、`resolve(...)` |
| `voice.ts` | 语音能力入口（转写/合成） |
| `websearch.ts` | 联网搜索服务（工具 `websearch` 的后端） |
| `wellknown.ts` + `wellknown/` | well-known 端点/元数据（含 `wellknown/plugin.ts`） |
| `instructions/` | 内置指令（`builtins.ts`）与指令装配 |
| `modal/` | 模态服务实现（`models.ts`） |
| `ripgrep/` | ripgrep 二进制定位（`binary.ts`） |
| `vcs/` | VCS 补丁处理（`patch.ts`） |

## 边界

- 每个模块自己的完整语义在它内部实现里；大模块（session / tool / permission / plugin / provider / mcp / pty）**不在这张卡**，见对应 L1 卡。
- `filesystem.ts`、`state.ts` 属于"被几乎所有服务依赖的地基"，改它们等于改全局，别当普通工具模块处理。

## 入口与调用链

- 服务型（`Agent`、`Artifact`、`Command`、`Form`、`Generate`、`KV`、`ModelsDev`、`SharedCache`、`Voice`、`WebSearch`、`FileSystem`、`FileAccess`、`FileMutation`）通过 `Instance.graph` 的 node 装配（见 `core/location-instance`）。
- 纯函数型（`Mime`、`Variant`、`FileRetention`、`Snapshot` 的比较部分）直接被调用，不入图层。

## 数据与状态

- `KV` 的数据落在 location 的 sqlite（`kv/sql.ts`）；`SharedCache` 有 10 分钟刷新间隔；`RepositoryCache` 缓存克隆结果；`Snapshot` 存的是文件树哈希对比结果。
- `ModelsDev` 维护 models.dev 快照（模型能力/上下文/价格），`provider-models` 卡消费它但拥有权在这里。

## 关键不变式

- `state.ts` 的 transform 必须可重放、无副作用：注册表（工具、插件、agent、command、skill）都按注册顺序重放，写错会改变覆盖优先级。
- `file-access.ts` 的越界判定是所有读写工具的安全边界，绕过它单独拼路径 = 绕过权限模型。
- `snapshot.ts` 的 diff 用于 revert，必须与 `file-mutation` 的写入语义一致（写前快照、写后可比）。
- `instruction-discovery` 发现的指令文件属于"不可信输入"（仓库内容），不能当系统指令直接信任。

## 扩展点

- **加一个顶层服务**：新建 `xxx.ts`（`export * as Xxx from "./xxx.js"`）→ `instance.ts` 的 `nodes` 注册 → 这里补一行索引。
- **加一种引用源**：`reference.ts` 的 `LocalSource/GitSource` 模式 + `reference/` 实现。
- **改模型能力数据**：`models-dev.ts`（含快照刷新），别在 provider 侧硬编码。

## 常见改法与坑

- 这批文件很多是"薄门面 + 内部实现在同名目录"（`kv.ts`/`kv/`、`reference.ts`/`reference/`、`wellknown.ts`/`wellknown/`），改行为要去目录里，别只改顶层。
- `repository.ts` 与 `repository-cache.ts` 名字相近、职责不同（引用描述 vs 克隆缓存），排障先分清。
- `variant.ts` 的推理档支持矩阵与 provider 的 `ReasoningField` 强相关，改一边要同步。
- 顶层文件都在 `Instance.graph` 的装配路径上，加 import 容易引入循环依赖。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/agent.ts` | agent 定义与解析 |
| `packages/core/src/artifact.ts` | 产物 provider 与版本 |
| `packages/core/src/command.ts` | 自定义命令 |
| `packages/core/src/file-access.ts`、`file-mutation.ts`、`file-retention.ts` | 访问解析、写前变更、过期清理 |
| `packages/core/src/filesystem.ts` + `filesystem/` | 文件系统门面与 watcher |
| `packages/core/src/form.ts` | 表单描述 |
| `packages/core/src/generate.ts` | 生成类调用 |
| `packages/core/src/instruction-discovery.ts`、`instructions/` | 指令发现与内置指令 |
| `packages/core/src/kv.ts` + `kv/` | KV 存取 |
| `packages/core/src/mime.ts` | MIME 探测 |
| `packages/core/src/models-dev.ts` | models.dev 快照 |
| `packages/core/src/reference.ts` + `reference/` | 外部引用与注入 |
| `packages/core/src/repository.ts`、`repository-cache.ts` | 仓库引用与缓存 |
| `packages/core/src/shared-cache.ts` | 共享缓存原语 |
| `packages/core/src/snapshot.ts` | 快照与 diff |
| `packages/core/src/state.ts` | 可重放状态与注册顺序 |
| `packages/core/src/variant.ts` | 模型变体/推理档 |
| `packages/core/src/voice.ts`、`websearch.ts` | 语音与联网搜索 |
| `packages/core/src/wellknown.ts` + `wellknown/`、`modal/`、`ripgrep/`、`vcs/` | well-known、模态、ripgrep 二进制、VCS patch |
