---
id: cli/host-glue
title: CLI 宿主胶水（env / 版本 / 数据库路径 / run·mini 宿主 / cli.json）
level: L1
layer: cli
status: draft
paths:
  - packages/cli/src/config
  - packages/cli/src/node
  - packages/cli/src/run
  - packages/cli/src/ui
  - packages/cli/src/util
  - packages/cli/src/app-archive.ts
  - packages/cli/src/app-assets.ts
  - packages/cli/src/cpu-profile.ts
  - packages/cli/src/database-path.ts
  - packages/cli/src/env.ts
  - packages/cli/src/heap.ts
  - packages/cli/src/mini.ts
  - packages/cli/src/mini-host.ts
  - packages/cli/src/photon-worker.ts
  - packages/cli/src/session-target.ts
  - packages/cli/src/shutdown-deadline.ts
  - packages/cli/src/version.ts
  - packages/cli/src/ssh-askpass.ts
symbols:
  - Env
  - password
  - OPENCODE_VERSION
  - OPENCODE_CHANNEL
  - OPENCODE_ARTIFACT
  - OPENCODE_HIGHLIGHTS
  - OPENCODE_LOCAL
  - databasePath
  - Heap
  - CpuProfile
  - MiniCommandInput
  - runMini
  - createMiniConnection
  - resolveMiniTarget
  - validateMiniTerminal
  - InteractiveStdin
  - INTERACTIVE_INPUT_ERROR
  - createMiniHost
  - resolveInteractiveStdin
  - usingInteractiveStdin
  - SessionTarget
  - SessionTargetMutationError
  - SessionTargetPreparation
  - resolveSessionTarget
  - createWorktreeLocation
  - findSession
  - parseSessionTargetModel
  - RunCommandInput
  - runNonInteractive
  - mergeInput
  - parseRunModel
  - reportRunError
  - runNonInteractivePrompt
  - Style
  - UI
  - println
  - TimelineHost
  - createTimelineHost
  - IntegrationChoice
  - selectIntegration
  - handlePromptErrors
  - openUrl
  - requireInteractive
  - errorMessage
  - readStdin
  - readStdinIfReady
  - selfCommand
  - NodeTarget
  - nodeTarget
  - nodeExecArgv
  - photonWasmAsset
  - attentionSoundAssets
  - Config
  - ConfigMigration
  - migrateV1
  - Info
  - SchemaURL
  - normalizeLegacyTabs
  - ShutdownDeadline
  - DEADLINE
  - askpass
entry_cli:
  - run
  - mini
config_keys:
  - tabs.mode
  - terminal.copy
tests:
  - packages/cli/test/app-archive.test.ts
  - packages/cli/test/config.test.ts
  - packages/cli/test/cpu-profile.test.ts
  - packages/cli/test/env.test.ts
  - packages/cli/test/mini-host.test.ts
  - packages/cli/test/mini.test.ts
  - packages/cli/test/session-target.test.ts
  - packages/cli/test/shutdown-deadline.test.ts
  - packages/cli/test/run/noninteractive.test.ts
  - packages/cli/test/prompt-open-url.test.ts
  - packages/cli/src/ssh-askpass.test.ts
depends_on:
  - runtime/process-lifecycle
  - cli/commands
  - client/sdk-transports
related:
  - tui/mini
  - core/location-instance
  - contracts/config-flag
  - tui/components
keywords:
  - env
  - 环境变量
  - 版本号
  - 数据库路径
  - cli.json
  - 迁移
  - run
  - mini
  - 宿主
  - timeline
  - askpass
  - 资源解包
  - cpu profile
  - heap
source_hash: 12a78cf087a608b1f47fbf904a66a5b5a98d9b5b
---

## 职责

CLI 里"把进程、配置、终端和 SDK 粘起来"的那一层，没有协议、没有业务规则，但每处都影响行为：

| 位置 | 这里有什么 |
| --- | --- |
| 顶层单文件 | `env.ts`：**所有**环境变量的唯一读取点（`Config.Redacted` + legacy 名兜底 + `session()` 剥密码后整份 env）；`version.ts`：构建期注入的 `OPENCODE_VERSION/CHANNEL/ARTIFACT/RELEASE_HIGHLIGHTS`，`local` 兜底；`database-path.ts`：按渠道分库的文件名；`heap.ts` / `cpu-profile.ts`：`SIGUSR1` / `SIGPROF` 触发的诊断采样；`app-archive.ts` + `app-assets.ts`：Web UI 资产的二进制归档格式与惰性解压；`photon-worker.ts`：第二个编译入口（`Image.Photon` 要的 `./photon-worker.js`）；`session-target.ts`：session/location/model/agent 的解析与 `--fork`/`--continue`/`--worktree` 语义；`ssh-askpass.ts`：OpenSSH 直接调用的口令代理；`mini.ts` + `mini-host.ts`：精简宿主的 CLI 侧（校验、stdin、宿主能力、重连）；`shutdown-deadline.ts`：10 秒关闭预算。 |
| `config/` | `cli.json` 的读写层：jsonc 解析、flock 串行、immer 差异 → `modify/applyEdits` 保注释、原子写；`migrate.ts` 是 v1→v2 键迁移；`schema.ts` 把 `@opencode/tui/config` 的 `Info` 摊平并加 `$schema`。 |
| `node/` | `node/index.ts`：Node 入口 shim（先注册 plugin runtime、吞 EPIPE、再动态 `import("../index")`）；`node/target.ts`：发布目标三元组与要随包分发的原生资产名；`node/plugin-runtime.{promise,effect}.ts`：把插件 API 挂到 `Symbol.for(...)` 全局上。 |
| `run/` | `run.ts`：`opencode run` 的编排（参数校验、stdin/files 合并、worktree、session target、title/archived）；`noninteractive.ts`：SSE 事件驱动的非交互状态机（662 行）；`ui.ts`：纯 ANSI 文本输出。 |
| `ui/` | `prompt.ts`：clack 提示的 Effect 封装（取消 → 130）；`integration-picker.ts`：分组 + 模糊过滤的集成选择器；`timeline.tsx`：把 OpenTUI renderer 当"逐行 scrollback 写入器 + 单行 footer"。 |
| `util/` | `errorMessage`、`readStdin`/`readStdinIfReady`、`selfCommand`（重跑自己时的 argv 与 node flags）。 |

## 边界

- **不做命令定义与派发**：命令树、参数 schema、handler 注册在 `cli/commands`（`Runtime.handlers`）；本卡的 `run/`、`ui/` 是被 handler 调用的下层。
- **进程入口与后台服务归 `runtime/process-lifecycle`**：`index.ts`、`server-process.ts`、`services/` 都在那张卡。本卡的 `mini.ts`、`mini-host.ts`、`shutdown-deadline.ts`、`database-path.ts` 与它 paths 重叠，这里只写**胶水契约**（谁调、依赖什么、改它影响谁），信号语义/服务注册/端口策略不重复。
- **不做 TUI 组件**：渲染组件在 `tui/components`，精简前端在 `tui/mini`；`ui/timeline.tsx` 只借 renderer 做 scrollback。
- **不做 Code Mode / 工具**：`run` 只驱动 client（创建会话、发 prompt、订阅事件），工具在服务端执行。
- **`config/` 只管 CLI 自己的 `cli.json`**（`global.config/cli.json`），不是项目级 `opencode.json`（那在 core 的 config）。
- **`node/` 不是 Node 适配层全部**：只是入口 shim + 打包目标描述；真正的 Node 平台服务由 `NodeServices`/`NodeRuntime` 提供。
- **`ssh-askpass` 不在 CLI 可观测性内**：注释要求"prompts 与 responses 都不进日志"，所以它不初始化 CLI 的 Effect 运行时。

## 入口与调用链

```
commands/handlers/run.ts
  → import("../../run/run").runNonInteractive(input, controller.signal)
      → run()：--fork/--worktree 前置校验 → localDirectory() → stdin 合并 → prepareFile()
      → execute()：OpenCode.make(endpoint, noTimeoutFetch)
          → createWorktreeLocation（可选）
          → resolveSessionTarget({ …, prepare })   ← utils/session-target.ts
          → session.update({ title, archived })     （新建会话才设 title）
          → runNonInteractivePrompt({ … })          ← run/noninteractive.ts
              → client.event.subscribe() 迭代 → 状态机（running→settled→cancelling）
              → renderTool/renderToolError → run/ui.ts 的 UI.println
              → reportRunError(...)（唯一错误出口）

commands/handlers/mini.ts
  → import("../../mini").runMini(input)
      → validate()（TTY、--replay-limit、--fork）
      → usingInteractiveStdin(resolveInteractiveStdin)      ← mini-host.ts
      → createMiniConnection(server) / resolveMiniTarget(重连)
      → resolveSessionTarget(...)（与 run 共用）
      → import("@opencode/tui/mini").runMiniFrontend({ host: createMiniHost(...), … })

config
  Runtime 需要 cli.json → Config.layer → get()
      → flock → ConfigMigration.run → load(migration) → merge(OPENCODE_CLI_CONFIG_CONTENT)
  update(draft) → flock → migrate → produce → changes → applyEdits → 校验 → 原子写

askpass（OpenSSH 直接执行本可执行文件）
  index.ts 发现 OPENCODE_SSH_ASKPASS_PORT → 动态 import("./ssh-askpass") → run → process.exit(code)
```

## 数据与状态

- **`cli.json`**：路径 `path.join(global.config, "cli.json")`；写到 `<file>.tmp` 再 `rename`，模式 `0o600`；读用 jsonc（`allowTrailingComma`）。
- **配置合并顺序**：`merge(迁移结果 ?? 文件内容, OPENCODE_CLI_CONFIG_CONTENT)`——环境变量内容是**覆盖层**，且 `normalizeLegacyTabs` 在合并的每个输入上都跑一次（`tabs.enabled` → `tabs.mode`）。
- **迁移产物**有三个字段：`{ info }`、`{ info, cause }`（迁移成功但持久化失败）、或 `undefined`（文件不存在/解析不了，直接返回）。`get()` 对 `cause` 只 `logWarning`，`update()` 则 `failCause`。
- **锁**：`Flock.acquire(file, { dir: global.state/locks })`，在 `uninterruptibleMask` 的 `restore` 段里获取，finalizer 里 `release`。
- **版本常量**是构建期 define（`declare const OPENCODE_VERSION: string` 等）；`OPENCODE_HIGHLIGHTS` 是 JSON 字符串，解码失败退化为 `[]`；`OPENCODE_LOCAL = channel === "local"`。
- **`databasePath(data)`**：`OPENCODE_DB` 优先；渠道名在白名单（`latest/dev/beta/next/prod`）或 `OPENCODE_DISABLE_CHANNEL_DB` 为 `1`/`true` 时用 `opencode.db`，否则 `opencode-<channel>.db`（非法字符替换成 `-`）；`:memory:` 原样返回。
- **诊断采样**：`heap`/`cpu-profile` 各用一个容量 1 的 dropping 队列接信号；产物落在 `Global.Service` 的 `log` 目录；CPU profile 固定采 10 秒，文件名 `cpu-<pid>-<ISO 去冒号>.cpuprofile`，用 `Bun.write` 落盘。
- **Web UI 资产**：`app-archive` 是"LE u32 的 JSON 索引长度 + 索引 + brotli 正文"；`app-assets.load()` 优先 `virtual:opencode-app-assets`（构建期注入），`OPENCODE_LOCAL` 且缺资产时回退读 `packages/app/dist`；返回的是 `Proxy`——每次 `get` 才解压，文本按后缀转字符串。
- **timeline 状态**：TTY 分支用 `createCliRenderer({ screenMode: "split-footer", footerHeight: 1, externalOutputMode: "capture-stdout", consoleMode: "disabled", clearOnShutdown: false })`；pending 是 Solid signal（只改 footer），`intro/item/success/failure/outro` 走 `writeToScrollback`（不可改）。
- **run 的输入**：`process.stdin.isTTY` → 无 stdin；有 message 参数 → `readStdinIfReady(1000)`；无 message → `readStdin()`。附件单文件上限 10 MiB。
- **mini 宿主能力**：`version/terminal/stdout/files.readText/editor.open/paths/signals(sigint,sigusr2)/startup(showTiming)/diagnostics.trace/preferences`；`OPENCODE_DIRECT_TRACE` 打开时写 `<log>/direct/<stamp>-<pid>.jsonl` 并更新 `latest.json`，偏好走 `<state>/model.json`。

## 关键不变式

- **`env.ts` 是唯一 env 读取点**（文件头注释）：新变量加到 `Env`，不要在别处直接 `process.env`；`Env.session()` 会**剔除** `OPENCODE_PASSWORD`/`OPENCODE_SERVER_PASSWORD` 后把整份 env 传给 `session.environment`。
- **非 local 构建缺 Web UI 资产必须失败**（`Effect.fail("Web UI assets are missing from the CLI build")`），只有 `OPENCODE_LOCAL` 才允许从源码目录读——本地开发与发布构建的降级路径不同。
- **配置写入必须保留注释与顺序**：所有写路径都是"读文本 → immer 算差异 → jsonc-parser `modify/applyEdits` → 重新解析校验 → 原子 rename"，不能 `JSON.stringify` 重写。
- **`update` 是读-改-写 + flock**：`get` 与 `update` 都在同一把锁里，且 `uninterruptibleMask` 保证获取锁不被中断打断。
- **timeline 写入串行、关闭幂等**：`writing` 标志下重入直接 reject；`closeTask` 缓存后重复 `close()` 返回同一个 promise；每步都包 `bounded(…, IDLE_TIMEOUT = 1000ms)`。
- **timeline 关停顺序固定**：`bounded(renderer.idle())` → `externalOutputMode = "passthrough"` → `screenMode = "main-screen"` → `destroy()` → 等 `renderer.closed`；顺序错了会把 shell 提示符写坏。
- **非 TTY 分支没有 renderer**：不创建 OpenTUI、不注册 Escape/Ctrl-C 快捷键（只有 section 的 `useKeyboard` 在 TTY 分支），输出就是 `marker + text + "\n"`。
- **run 的唯一错误出口是 `reportRunError`**：它设 `process.exitCode = 1`，`format === "json"` 时往 stdout 写一行 `{type:"error",…}`，否则 `UI.error`。
- **参数互斥在 run 前置校验**：`--fork` 需要 `--continue`/`--session`；`--worktree` 不能与 `--continue`/`--session` 同时给；错误经 `fail()` 抛 Error 走到最外层 catch。
- **归档必须在第一个 prompt 之前**：注释写明 `session.update({ archived })` 先于 prompt 入场，否则会话会以 working/finished 状态进 inbox。
- **session-target 的降级语义**：显式 `--session` 找不到时，非 `--fork` 会**新建**（`session: undefined`）而不是报错；`--continue` 按 location 找最近一页里 `location.directory` 完全匹配的会话，找不到且有下一页才翻页。
- **只有变更类失败被包成 `SessionTargetMutationError`**（create/fork/environment/worktree），读取失败原样抛——调用方靠这个区分"读不到"与"改不了"。
- **mini 的重连只在 transport 错误时发生**：`ClientError.reason === "Transport"` 才重试，间隔 250ms，受同一个 `signal` 约束；其他错误立即抛。
- **`shutdown-deadline` 的 SIGHUP 转换有前提**：只有 `stdin.isTTY || stdout.isTTY` 才注册 SIGHUP→SIGTERM（`nohup`/后台服务没有 TTY，不能覆盖 nohup 的忽略）；关闭一旦开始就**保持**监听。
- **heap/cpu-profile 在 win32 直接 return**：SIGUSR1/SIGPROF 在 Windows 上不可用，不要在那里加平台判断。
- **`ssh-askpass` 失败即 1**：`timeout("5 minutes")` + `orElseSucceed(() => 1)`；`value === null`（用户取消）也返回 1；成功才写一行密码到 stdout。
- **`node/target.ts` 的目标集是封闭的**：`darwin|linux|win32` × `arm64|x64`，其余抛错；linux 资产名带 `-glibc`/`-gnu`，win32 带 `-msvc`，这与打包脚本是同一份契约。
- **插件运行时两个全局都要注册**：`node/index.ts` 同时 `import` `plugin-runtime.promise` 与 `plugin-runtime.effect`，各写一个 `Symbol.for("opencode.plugin.v2.*")`。

## 扩展点

- **新增 CLI 环境变量**：只加在 `env.ts`（`Config.*`），调用方 `yield` 它；如果它会影响子进程，确认 `Env.session()` 的剥离规则。
- **新增 `cli.json` 字段**：先加到 `@opencode/tui/config` 的 `Info`（CLI schema 直接 spread `Config.Info.fields`），需要兼容旧键就在 `config/schema.ts` 的 normalize 里处理；写入一律走 `Config.update`。
- **新增 v1→v2 迁移**：`config/migrate.ts` 的 `run`（改名/搬位置/枚举值映射），用 jsonc-parser 编辑；补 `packages/cli/test/config.test.ts`。
- **新增一种非交互输出**：`run/ui.ts`（文本）或 `noninteractive.ts` 的 `format` 分支（JSON 事件流）；注意 `reportRunError` 两个格式都要覆盖。
- **新增 timeline 行类型**：`ui/timeline.tsx` 的 `RowKind` 联合 + `ROWS` 表（`marker`/`color`/`connector`）；TTY 与非 TTY 两个分支都会用到。
- **改 Web UI 资产格式**：`app-archive.ts` 的编解码必须与构建脚本的 produce 端同时改，否则 `decode` 会在 `getUint32` 处读到垃圾。
- **新增随包分发的原生资产**：`node/target.ts` 加字段（平台三元组 + 资产路径），并让打包脚本引用同一字段，别在脚本里重写一遍字符串。
- **给 mini 宿主加能力**：`mini-host.ts` 的 `createMiniHost` 返回对象（类型是 `@opencode/tui/mini` 的 `MiniFrontendInput["host"]`）；加字段要同时改前端类型。

## 常见改法与坑

- 在别处直接读 `process.env`：绕过 `Env` 的 legacy 名兜底与密码剥离，密码可能被塞进 session 环境。
- 用 `JSON.stringify` 写 `cli.json`：注释、键顺序、尾逗号全丢；也不要绕过锁（并发写会互相覆盖）。
- 把 `Config.get` 里的迁移失败改成致命：实现刻意是"warning + 继续用旧内容"，否则一个坏配置会让整个 CLI 起不来。
- 忘掉 `OPENCODE_CLI_CONFIG_CONTENT`：测试和嵌入形态靠它注入配置，`load` 的覆盖层语义不能删。
- 在 timeline 的 `write` 里并发 await：直接 reject；要并行就先串行化调用方。
- 用 `setInterval`/`render()` 持续刷新 timeline：`renderer.idle()` 永不 resolve，`bounded()` 每次都会超时，关停也会卡在 idle 那一步。
- 在 `close()` 里先 `destroy()` 再改 `screenMode`：会打乱主屏恢复顺序（实现是 idle → passthrough → main-screen → destroy）。
- 非 TTY 环境跑 TTY 分支：`createCliRenderer` 会拿到不是 TTY 的 stdin/stdout，且 Escape/Ctrl-C 处理没有来源。
- 改 `readStdinIfReady` 的 grace：太小会让 `spawn` 出来的静默 stdin 拖住（它本来就是要被 `destroy()` 的），太大则拖慢 `opencode run`。
- 给 `run` 放宽附件上限：内容会 base64 进 data URL 再进会话消息，10 MiB 是刻意的。
- 在 Windows 上期待 heap dump / CPU profile：两个 `listen` 开头就 `return`。
- 改了 `version.ts` 的常量名：构建期 define 与 `declare const` 必须同名，否则静默退化成 `"local"`。
- 给 `databasePath` 加新渠道却忘了白名单：新渠道会各自建库，用户的会话会"消失"。
- 把 `session-target.ts` 的错误全包成 `SessionTargetMutationError`：调用方就无法区分"没有这个会话"和"改不动这个会话"。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/cli/src/env.ts` | 全部环境变量的唯一入口、`session()` 剥密码 |
| `packages/cli/src/version.ts` | 构建期版本/渠道/产物/发布要点常量 |
| `packages/cli/src/database-path.ts` | 按渠道分库的文件名规则 |
| `packages/cli/src/app-archive.ts` | Web UI 资产的 u32 索引 + brotli 归档编解码 |
| `packages/cli/src/app-assets.ts` | 资产加载（构建期注入 / 本地 `packages/app/dist`）、惰性解压 Proxy |
| `packages/cli/src/mini.ts` | `runMini`：校验、stdin、连接、session target、动态导入前端 |
| `packages/cli/src/mini-host.ts` | `MiniHost` 能力装配、`CONIN$`/`/dev/tty` 接管、trace 与偏好 |
| `packages/cli/src/session-target.ts` | session/location/model/agent 解析、worktree location |
| `packages/cli/src/run/run.ts` | `opencode run` 编排、stdin/附件、错误出口 |
| `packages/cli/src/run/noninteractive.ts` | 非交互状态机（SSE 事件 → 输出/退出码） |
| `packages/cli/src/ui/timeline.tsx` | split-footer timeline：scrollback 行、footer spinner、幂等关停 |
| `packages/cli/src/ui/prompt.ts` | clack 提示的 Effect 封装、取消 → 130、打开浏览器 |
| `packages/cli/src/config/config.ts` | `cli.json` 读写：flock、migrate、immer + jsonc 编辑、原子写 |
| `packages/cli/src/config/migrate.ts` | v1→v2 配置迁移（`copy_on_select`、keybind 重命名） |
| `packages/cli/src/node/target.ts` | 发布目标三元组与原生资产名 |
| `packages/cli/src/heap.ts`、`cpu-profile.ts` | SIGUSR1/SIGPROF 诊断采样 |
| `packages/cli/src/ssh-askpass.ts` | OpenSSH askpass 代理（socket + 5 分钟上限） |
