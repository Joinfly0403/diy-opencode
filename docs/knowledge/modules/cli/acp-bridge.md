---
id: cli/acp-bridge
title: ACP 桥（Agent Client Protocol）
level: L1
layer: cli
status: stable
paths:
  - packages/cli/src/acp
  - packages/cli/src/commands/handlers/acp.ts
  - packages/cli/src/services/standalone.ts
symbols:
  - ACP
  - ACPService
  - ACPConnection
  - ACPSessions
  - ACPTurn
  - ACPPermission
  - ACPElicitation
  - ACPReplay
  - ACPCapabilities
  - ACPCatalog
  - ACPClient
  - ACPError
  - ACPChild
  - ACPTranslate
  - ACPDirectories
  - ACPPrompt
  - Standalone
entry_cli:
  - acp
  - acp --login
tests:
  - packages/cli/test/acp/lifecycle.subprocess.test.ts
  - packages/cli/test/acp/turn.test.ts
  - packages/cli/test/acp/permission.test.ts
  - packages/cli/test/acp/replay.test.ts
  - packages/cli/test/acp/prompt-content.subprocess.test.ts
  - packages/cli/test/acp/additional-directories.test.ts
  - packages/cli/test/import-boundaries.test.ts
depends_on:
  - cli/commands
  - core/permission-policy
  - core/session-execution
related:
  - server/event-feed
  - runtime/process-lifecycle
  - core/tool-registry
  - core/mcp-integration
keywords:
  - acp
  - agent client protocol
  - 编辑器集成
  - stdio
  - ndjson
  - 会话桥
  - 权限转发
source_hash: 8699bd3808a37ee92213b8776ae5a229c61b66b6
---

## 职责

把 opencode 作为 **ACP agent** 暴露给编辑器/IDE：`opencode acp` 在 stdio 上讲 JSON-RPC（NDJSON 帧），把 ACP 的 `session/*`、`session/prompt`、`session/cancel` 翻译成 opencode 服务器会话的一次"turn"。

- `commands/handlers/acp.ts`：入口 —— 起 standalone 服务、建 client、接上 stdio 流、等断开。
- `acp/agent.ts`：注册 ACP 方法 → `ACPService`（方法级 span `cli.acp.<method>`）。
- `acp/service.ts`：会话生命周期（new/load/list/delete/resume/close/fork/set_config_option/set_mode/prompt/cancel）。
- `acp/turn.ts`：一次 prompt 的完整 turn（订阅事件、翻译、转发权限、取消与收尾）。
- `acp/translate.ts` + `replay.ts`：opencode 事件 ↔ ACP `session/update` 的双向映射（含历史回放）。
- `acp/connection.ts`：向 ACP client 发通知/请求（sessionUpdate、requestPermission、elicitation/create）。

## 边界

- **不实现会话/工具/权限本体**：所有实际工作都打到同机 opencode 服务的 HTTP API（`@opencode/client/effect`），ACP 只做协议转换与 UI 事件整形。
- **不决定授权**：`permission.asked` 只是被转发成 ACP 的权限询问，最终答复写回 `permission.reply`；策略仍在 `core/permission-policy`。
- **不读写用户的 opencode 数据库**：只经 client 端点（会话、消息、模型目录、MCP 注册）。
- 不是 TUI：没有渲染层，输出全部是 ACP `session/update`（含 `tool_call` / `diff` / `usage_update`）。

## 入口与调用链

```
opencode acp [--login]
  → handlers/acp.ts
      --login ? 动态 import auth/login 并复用其 default
      → process.env.OPENCODE_CLIENT = "acp"
      → Standalone.start()            // 子进程: opencode serve --stdio --port 0
      → OpenCode.make({ baseUrl, headers: Service.headers(endpoint) })
      → ACP.connect(client, ndJsonStream(process.stdout, Bun.stdin.stream()))
      → race(connection.closed, endpoint.exited) → stderr 报告 → process.exit(0|1)

ACP request → agent.ts handler → ACPService.<method>
session/prompt → ACPTurn.prompt → 订阅 client.event → ACPTranslate.fold
                → connection.sessionUpdate / requestPermission / elicitation
                → client.session.prompt({ delivery: "steer" })
```

## 数据与状态

- `ACPSessions`：`Map<sessionId, Entry{attached, scope, selected}>`，外加 `registeredMcpBySession`（重连不重复注册 MCP）与每会话的选择状态 `Ref<Selection{model, modeID}>`。
- `ACPTurn`：`FiberMap<sessionId, PromptResponse>` —— **一个会话同时只允许一个活跃 prompt**，第二次并发请求直接 `ACPServiceFailureError`。
- `ACPCatalog`：按 cwd 缓存的 `SubscriptionRef<Catalog>`（模型/模式/命令），由 `model.updated`/`agent.updated`/`command.updated` 事件触发 reload；代际号避免排队请求重复加载。
- `capabilities`：一个 `Ref<Capabilities>`，由 `initialize` 的 `clientCapabilities` 写入（child session updates / form elicitation / compaction 三项能力）。
- `service.ts` 的 `unprompted` Set：记录"建了但没 prompt 过"的会话，`session/close` 时若消息为空就直接删掉，避免残留空会话。
- 全部状态在内存：桥进程退出即丢；会话内容本身在服务端库里，重连后靠 `session/load` 的 `ACPReplay.history` 回放。

## 关键不变式

- **import 边界（测试强制）**：`src/acp/**` 与其测试**不得** import `@opencode/client/promise` 或 `@opencode/client/service`，只能用 `@opencode/client/effect`；`packages/cli` 不得 import `@opencode/core`。
- **先订阅再提交**：`turn.ts` 先开事件流（`client.event.subscribe()`）、读出首帧，再调 `session.prompt`。首帧必须是 `server.connected`，否则 `Effect.die`（feed 以此开头，之后的帧才保证属于本次提交）。
- **一个会话一个 turn**：并发 prompt 被 FiberMap 拒绝；`session/cancel` 只移除 fiber（走中断收敛），`session/close` 在空闲时也会调 `session.interrupt`（服务端工作可能比 turn 活得久）。
- **取消要有收尾预算**：取消时发 `session.interrupt`，然后最多等 `CancelDrainTimeout`（默认 5s，注释说明 core 先 ack 后清理、shell 工具 SIGKILL 前等 3s），超时用 `ACPTranslate.abandon` 补发终止帧。
- **错误必须变成 JSON-RPC error**：`ACPError.toRequestError` 统一映射；defect 也经 `catchDefect` 转成 `RequestError`，不能把缺陷漏进协议流。
- **选择状态先写本地再调服务**：`sessions.select` 先 `Ref.update`，这样服务端回显的 `session.model.selected` 事件成为 no-op，避免抖动。
- **catalog 加载先于建会话**：`newSession` 先 `catalog.get`，catalog 失败就不留下空会话。
- **cwd 必须匹配**：`getSession` 校验 `session.location.directory` 与请求 cwd 一致，否则 `SessionDirectoryMismatchError`。

## 扩展点

新增一个 ACP 方法：

1. `acp/agent.ts` —— `request("<method>", handle((service, ctx) => service.<fn>(ctx.params)))`（或 `notification`）。
2. `acp/service.ts` —— 在 `Interface` 与 `make()` 里实现，错误只抛 `ACPError.*`。
3. `acp/error.ts` —— 若需要新错误类型，加 `Schema.TaggedError` 并在 `toRequestError` 里映射 code/message。
4. 事件翻译改动落在 `acp/translate.ts`（`fold`/`response`/`failure`），历史回放同步改 `acp/replay.ts`，否则 load 与 live 不一致。
5. 补 `packages/cli/test/acp/*`：翻译与生命周期有独立测试文件，subprocess 测试用于端到端。

## 常见改法与坑

- 改 `translate.ts` 只测 live 不测 `replay.ts`：同一个会话 load 后 UI 会与实时路径不同（两条路径各自维护映射）。
- `withCompletedDiffs` 依赖 core 的 patch 元数据；core 若裁剪了 diff 缩进，只能从 patch hunk 反推（`Patch.derive`）并比对 hunk 区间，改这块要同时看 `core/tool-registry`。
- `Standalone.start` 的 stdin 是**租约**：服务端把 EOF 当所有权结束；不要改成 `ignore`，否则父进程被杀后子服务不会退。
- 桥进程用 `process.exit` 直接退出（注释：关 scope 会等优雅关闭），所以 finalizer 里的清理不能依赖正常关闭路径。
- `acp` 会覆盖 `OPENCODE_CLIENT`；同进程内跑别的命令路径要恢复。
- MCP server 只支持 stdio 与 http（`supportedMcpServers`），`sse`/`acp` 类型会被整体拒绝，不要逐个跳过。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/cli/src/commands/handlers/acp.ts` | 入口：standalone、stdio 流、退出码 |
| `packages/cli/src/services/standalone.ts` | 子进程 `serve --stdio --port 0`、随机密码租约、readiness 行 |
| `packages/cli/src/acp/agent.ts` | ACP 方法注册、ready Deferred、span、错误映射 |
| `packages/cli/src/acp/connection.ts` | sessionUpdate / requestPermission / elicitation 的发送与应答对齐 |
| `packages/cli/src/acp/service.ts` | 会话生命周期、config option、unprompted 清理 |
| `packages/cli/src/acp/sessions.ts` | attach/detach、选择状态、MCP 注册、catalog 变更推送 |
| `packages/cli/src/acp/turn.ts` | 一次 prompt：订阅、fold、权限/表单转发、取消与收尾 |
| `packages/cli/src/acp/translate.ts` | 事件 → `session/update` 折叠、终止判定 |
| `packages/cli/src/acp/replay.ts` | loadSession 的历史回放 |
| `packages/cli/src/acp/permission.ts` | 权限询问与 diff 预览 |
| `packages/cli/src/acp/elicitation.ts` | 表单问答 ↔ ACP elicitation |
| `packages/cli/src/acp/catalog.ts` | 模型/模式/命令目录缓存与 reload |
| `packages/cli/src/acp/directories.ts` | additionalDirectories 校验与授权元数据 |
| `packages/cli/src/acp/error.ts` | 错误类型与 `toRequestError` |
