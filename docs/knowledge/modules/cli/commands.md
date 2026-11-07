---
id: cli/commands
title: CLI 命令树与 handler 桥接
level: L1
layer: cli
status: stable
paths:
  - packages/cli/src/commands/commands.ts
  - packages/cli/src/commands/handlers
  - packages/cli/src/framework/spec.ts
  - packages/cli/src/framework/runtime.ts
  - packages/cli/src/framework/flag.ts
  - packages/cli/src/index.ts
symbols:
  - Commands
  - PrintLogs
  - Standalone
  - Server
  - Spec
  - Runtime
  - CliFlag
  - resolveOperation
  - remoteConsent
  - remoteWarning
  - createClient
  - inspect
entry_cli:
  - run
  - serve
  - mini
  - acp
  - api
  - pair
  - stats
  - models
  - reload
  - session list
  - auth login
  - mcp add
  - plugin add
  - service start
  - debug paths
  - upgrade
depends_on:
  - runtime/process-lifecycle
  - contracts/httpapi-protocol
related:
  - cli/acp-bridge
  - server/event-feed
  - core/mcp-integration
  - core/plugin-system
  - core/session-execution
keywords:
  - cli
  - 命令树
  - 子命令
  - handler
  - effect/cli
  - 参数校验
  - 惰性导入
  - 全局 flag
source_hash: c79e61378b14f613524925961325b89d476f8b64
---

## 职责

声明 opencode 的整棵命令树（名字、描述、别名、参数 schema、全局 flag），并把每个叶子命令桥接到一个**按需动态导入**的 handler。

- `commands/commands.ts`：唯一的命令树字面量，导出 `Commands`。
- `framework/spec.ts`：`Spec.make` 是 `effect/cli` `Command.make` 的薄包装（description / globalFlags / aliases / commands）。
- `framework/runtime.ts`：`Runtime.handlers` 把树 + loader 表编译成 `LazyHandler[]`，`Runtime.run` 挂上 `PrintLogs` 并交给 `Command.run`。
- `commands/handlers/**`：41 个子命令 + 根命令（`$`）共 42 个 handler 模块；其余文件是共享 helper（`auth/shared.ts`、`auth/account.ts`、`auth/form.ts`、`mcp/resolve.ts`、`plugin/inventory.ts`、`debug/redact.ts`）。
- `index.ts`：命令名 → `() => import(...)` 的映射表，进程入口。

## 边界

- 这里**不实现**业务：handler 只做参数整形、调用 `@opencode/client`、打印输出、设置 `process.exitCode`。进程装配/信号/端口在 `runtime/process-lifecycle`，HTTP 契约在 `contracts/httpapi-protocol`。
- `packages/cli` **不得直接 import `@opencode/core`**（`test/import-boundaries.test.ts` 强制），CLI 只能经 client 包访问能力。
- 命令树不含权限判断：`--auto` / `--yolo` / `--dangerously-skip-permissions` 只是把意图透传给会话侧。

## 入口与调用链

```
opencode <cmd> [sub] [args]
  → index.ts: Runtime.handlers(Commands, Handlers)   // 编译 loader 表
  → Runtime.run → Command.run(withGlobalFlags([PrintLogs]))
  → 命中叶子 spec → Command.withHandler(effect)
      → 若 --print-logs，先写 OPENCODE_PRINT_LOGS=1
      → await handler.load()          // 动态 import，模块默认导出
      → module.default(parsedInput)   // Effect<void>
```

命令族（都在 `commands.ts` 一处声明）：

| 族 | 命令 |
| --- | --- |
| 服务 | `service start/restart/status/stop/get/set/unset`（后台服务器） |
| 会话 | `session list/delete/export/import` |
| 认证 | `auth list/login/logout/export/import/switch`（集成与凭据） |
| 插件 | `plugin list/add/check/update/remove` |
| MCP | `mcp list/add/auth/logout` |
| 调试 | `debug agents/config/heap-dump/paths` |
| 进程/前端 | `serve`、`acp`、`api`、`pair`、`reload`、`run`、`mini`、`models`、`stats` |
| 安装 | `upgrade`（别名 `update`）、`uninstall` |

## 数据与状态

- 命令树是**纯数据**（无副作用），在模块加载时构建一次；根名字来自构建期 define `OPENCODE_CLI_NAME`（未定义时回退 `"opencode"`）。
- 全局 flag 三个定义：`PrintLogs`（`Runtime.run` 统一挂）、`Standalone` + `Server`（`ServerFlags`，按命令选择性挂 `globalFlags`）。
- handler 表是 loader 函数，只在命中该命令时 import；没有任何跨调用缓存。命令之间不共享状态，状态都在 client/服务端。
- 失败通过 `process.exitCode` 而不是抛错上报；`index.ts` 的 teardown 把默认 130 在 SIGTERM 情形改判 143。

## 关键不变式

- **三处必须同步**：`commands.ts` 声明、`index.ts` 的 `Handlers` 映射、`handlers/<name>.ts` 文件。`Runtime.handlers` 递归按 `node.commands` 的键读 `value[name]`（`add()` 里直接取 `value.$`），声明了却没有 loader 会在启动阶段抛错，而不是给出友好提示。
- **别名只支持一个原生别名**：`Spec.make` 把 `aliases[0]` 交给 `Command.withAlias`，其余别名被生成为"共享 params 与 subcommands 的兄弟命令"；改别名逻辑要同时想到 `Runtime.handlers` 里对 `node.aliases` 的重复注册。
- **handler 必须默认导出** `Runtime.handler(node, Effect.fn(...))`：loader 读的是 `module.default`，`Runtime.handler` 只是把 node 的类型带到 input 上，运行期不消费。
- **顶层副作用会毁掉惰性**：handler 模块在 import 时才执行，模块顶层做 I/O 或循环依赖会让命令"存在但不可用"。
- **`--worktree` 的值必须用 `=` 附加**（`CliFlag.optionalValue` 注释）：`--worktree=name` 取值，`--worktree name` 保持 name 为位置参数。
- **参数校验放在声明处**：`Flag.withSchema` / `Schema.Int.check` / `Flag.Literals` / `Argument.Literals` / `Flag.atMost(100)` / `Schema.NonEmptyString`（`serve --cors`）/ `Flag.mapTryCatch`（`pair --url`）。handler 里再校验一遍属于重复校验。
- **`--print-logs` 是全局副作用**：`provide()` 在加载 handler 之前写 `OPENCODE_PRINT_LOGS=1`，所以它影响子进程日志，不是 handler 参数。

## 扩展点

新增一个命令（缺一不可）：

1. `packages/cli/src/commands/commands.ts` — 在对应父节点的 `commands` 里 `Spec.make("<name>", { description, params, globalFlags })`。
2. `packages/cli/src/commands/handlers/<path>.ts` — `export default Runtime.handler(Commands.commands.<parent>.commands.<name>, Effect.fn("cli.<name>")(function* (input) { ... }))`。
3. `packages/cli/src/index.ts` — 在 `Handlers` 的对应层级加 `() => import("./commands/handlers/<path>")`。
4. 需要 flag 语义扩展时改 `framework/flag.ts`（如 `optionalValue`）或 `framework/spec.ts`（如多别名）。
5. 补测试：纯参数/纯格式化的放进 `packages/cli/test/*.test.ts`；handler 内部逻辑放 `src/commands/handlers/*.test.ts`（现有 `api.test.ts` 就是这种）。

## 常见改法与坑

- 只加了 `commands.ts` 没加 loader：启动即崩（见上）；只加了 handler 文件没声明：文件成为死代码，且 `import-boundaries` 之类测试不会报错。
- `api` 命令按 **OpenAPI operationID 或 `METHOD path`** 解析（`handlers/api.ts` 的 `resolveOperation`）。改协议端点 identifier 会让 `opencode api <id>` 失效。
- `pair` 的 `--remote` 会先走 `remoteConsent` 写 `service.remote`（重启服务），再 `Service.ensure`；不要在 handler 里绕过 consent 直接改配置。
- `service` 族读 `ServiceConfig` 文件，不是读当前进程环境；改端口/密码的期望值要看 `runtime/process-lifecycle`。
- 输出格式（`--format json`）在各 handler 内自带渲染，没有统一序列化层；加机器可读输出要同时改 handler 与测试。
- `stats` 的 `--days/--year/--limit` 有 schema 边界校验，负数/越界在解析期就被拒（不是运行期报错）。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/cli/src/commands/commands.ts` | 整棵命令树、全局 flag 定义、`PrintLogs/Standalone/Server` |
| `packages/cli/src/framework/spec.ts` | `Spec.make`：description/globalFlags/别名展开/子命令收集 |
| `packages/cli/src/framework/runtime.ts` | `handlers`（loader 表编译）、`run`、`provide`（挂 handler + PrintLogs） |
| `packages/cli/src/framework/flag.ts` | `optionalValue`：`--name[=value]` 语义 |
| `packages/cli/src/index.ts` | `Handlers` 映射表、Layer 装配、退出码 130→143 |
| `packages/cli/src/commands/handlers/default.ts` | 根命令 `$`：无子命令时的交互入口 |
| `packages/cli/src/commands/handlers/run.ts` | `run`：单次消息、worktree、format、附件 |
| `packages/cli/src/commands/handlers/serve.ts` | `serve`：hostname/port/cors/stdio/service |
| `packages/cli/src/commands/handlers/api.ts` | `api`：operationID 解析与原始请求 |
| `packages/cli/src/commands/handlers/pair.ts` | `pair`：配对链接、远程同意、QR |
| `packages/cli/src/commands/handlers/auth/*.ts` | 认证族；`shared.ts` 是公共 client/集成解析 |
| `packages/cli/src/commands/handlers/service/*.ts` | 服务族，全部经 `ServiceConfig` + client |
| `packages/cli/src/commands/handlers/plugin/inventory.ts` | 插件清单/版本展示（`inspect`） |
