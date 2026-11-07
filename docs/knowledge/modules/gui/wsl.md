---
id: gui/wsl
title: WSL 发行版里的服务
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/wsl
symbols:
  - Wsl
  - WslServersState
  - WslServerItem
  - WslServerConfig
  - WslServerRuntime
  - WslDistroJob
  - WslRuntimeCheck
  - WslInstalledDistro
  - WslOnlineDistro
  - WslDistroProbe
  - WslOpencodeCheck
  - createWslRuntime
  - wslArgs
  - wslCliInstallCommand
  - shellEscape
  - summarize
  - createWslServersController
  - wslServerIdForDistro
  - createWslMachineState
  - transitionWslMachine
  - toServersState
  - addServerViewModel
  - addServerProbePlan
  - createWslDialogState
  - transitionWslDialog
tests:
  - packages/gui-plugins/src/wsl/machine.test.ts
  - packages/gui-plugins/src/wsl/servers.test.ts
  - packages/gui-plugins/src/wsl/runtime.test.ts
  - packages/gui-plugins/src/wsl/dialog-machine.test.ts
  - packages/gui-plugins/src/wsl/probe-machine.test.ts
depends_on:
  - core/plugin-system
related:
  - gui/ssh
  - gui/terminal
  - runtime/process-lifecycle
  - core/pty-shell-worktree
keywords:
  - WSL
  - Windows
  - 发行版
  - distro
  - sidecar
  - wsl.exe
  - 安装
  - 服务
source_hash: adf98abd45d572cb9b9080f45209da161d5bd128
---

## 职责

在 WSL 发行版里运行 opencode 服务，并把它作为 app 的一个 server 提供：main 侧驱动 `wsl.exe`、在发行版里拉起 `opencode serve`（sidecar）、必要时安装 CLI，window 侧给出 server 行与"添加 WSL 服务器"对话框。

- main（`main.ts` → `servers.ts` 的 `createWslServersController` → `runtime.ts` / `sidecar.ts` / `remote-cli.ts` / `local.ts`）：`wsl` 命令、发行版探测、CLI 安装、进程与健康检查。
- window（`renderer.tsx` → `dialog-machine.ts` / `model.ts` / `row-view.ts` / `probe-machine.ts` / `probes.ts`）：server 列表项、添加向导。
- 状态机：`machine.ts`（`createWslMachineState` / `transitionWslMachine` / `toServersState`）。

## 边界

做：
- 运行时检查（`wsl --version`）、`wsl --install`、发行版列表、在线可装发行版目录。
- 发行版里 opencode CLI 的检查/安装，以及 sidecar 进程的生命周期与端口/密码分配。
- 添加/移除 server 记录。

不做：
- 不实现 WSL 本身：`runtime.ts` 只 spawn `wsl.exe` / `powershell.exe`。
- 只支持 Windows：`index.ts` 声明 `os: ["windows"]`；其它系统上插件从不运行，Extensions › Plugins 里显示 "Not available on this system."
- 不在 web 上运行（`ctx.app.platform !== "desktop"` return）；Ipc 在 web 上是 `inactive`，所以必须有"WSL 不可用"的状态而不是死按钮。

## 入口与调用链

window：

```
src/renderer.ts → wsl/renderer.tsx setup
  ctx.use(Wsl)
  ctx.add(Server, { ready, order: 1, entries })     // runtime.kind === "ready" 才 listed/http
  ctx.add(MenuItem, { menu: "server.add", order: 2 })
  ctx.add(MenuItem, { menu: "server.row", id: "retry" })
  dispatchAdd(add.requested) → bounded import("./dialog") → ctx.dialogs.open(<DialogAddWslServer/>)
```

main：

```
wsl/main.ts setup
  → storage.store("servers", { from: { settings: "wslServers" } })    // 宽松解码
  → createWslRuntime(ctx.t)
  → createWslServersController({ cli, runtime, t, log, readServers, writeServers, installCli, spawnSidecar })
  → ctx.provide(Wsl, { state, probeRuntime, refreshDistros, installWsl, installDistro,
                       probeAddable, installOpencode, addServer, removeServer, startServer })
  → controller.subscribe(() => provider.changed())
  → controller.startConfiguredServers()
```

- sidecar：`sidecar.ts` 用本地 `net` 分配端口、`randomUUID()` 生成密码，把脚本从 stdin 交给 `wsl -d <distro> --exec bash -se`，脚本里 `exec opencode serve --hostname 0.0.0.0 --port <port>`。

## 数据与状态

- main store `servers`，schema 是 `{ servers: unknown[] }`，逐条用 `Schema.decodeUnknownOption` 宽松解码：一条坏记录不会丢掉其它记录。缺 `id` 时用 `wslServerIdForDistro(distro)` 派生（老数据兼容）。
- `WslServersState`（Ipc state，window 只读）：`runtime`、`installed`、`online`、`distroProbes`、`opencodeChecks`、`pendingRestart`、`servers`、`hostJob`、`distroJobs`。
- `WslServerRuntime`：`starting` / `ready{url,password}` / `failed{message}` / `stopped`；只有 `ready` 的 distro 才 `listed` 进 app 的 server 列表（settings 里仍能看到）。
- 设备重启后：sidecar 进程不会自己回来，`controller.startConfiguredServers()` 在 setup 时按存储的记录重拉；`pendingRestart` 表示需要重启桌面 app 才能继续（安装 WSL 之后）。

## 关键不变式

- **一个发行版同时只有一个 job**：`WslDistroJob` = `probing / installing / updating / starting / removing`，`distroJobs` 缺省表示不跑任何 job。加新 job 必须同时进这个字面量 union，否则 window 侧会显示不一致。
- **所有 `wsl.exe` 调用都要有超时**：`runtime.ts` 的 `DEFAULT_WSL_TIMEOUT_MS = 20_000`；源码注释写明 `wsl.exe` 卡住（例如 Ubuntu-24.04 的首次运行提示）会让整个启动流程挂死。安装类操作用更长的 `DEFAULT_WSL_INSTALL_TIMEOUT_MS`。
- **`--exec`，不要用登录 shell**：`wslArgs` 注释说明 `--` 会把命令行交给发行版默认 shell 并展开 `$VAR`/`$(...)`，必须用 `--exec` 直接执行。
- **PATH 要裁掉 `/mnt/`**：sidecar 脚本把 PATH 里所有 `/mnt/...` 条目过滤掉，避免跑 Windows 上的二进制；同时 `export WSLENV=` 防止环境串味。
- **没有 Ipc 也要能答**：window 的 `api()` 在 `status !== "active"` 时抛 `error.unavailable`，UI 显示 "WSL 不可用"，绝不是一个静默 return 或无限 spinner。
- **绝不丢用户数据**：`servers` 的读取刻意宽松；新增字段要给默认值，别让旧记录解析失败后消失。
- **labels 用函数形式**：`ctx.add(MenuItem, () => ({ … }))`，否则语言切换后不更新（AGENTS.md Localization）。

## 扩展点

**新增一个主操作**（例如"修复 CLI"）：`contract.ts` 的 `Wsl.methods` → `main.ts` 的 `ctx.provide` 转发 → `servers.ts`（controller）实现并在完成时 `changed` → `dialog-machine.ts` 的 `WslMainOp` 加分支 → `dialog.tsx` 的按钮。

**新增一个可探测项**：`probes.ts`（`useWslAddServerProbes`）+ `probe-machine.ts`（`WSL_PROBE_TIMEOUT_MS`）+ `model.ts` 的 `addServerProbePlan`；结果落到 `WslServersState` 的 `distroProbes`/`opencodeChecks`。

**新增一种发行版状态文案**：`row-view.ts` 的 `wslRowView` + `i18n/en.ts`；`renderer.tsx` 的 `serverState` 只做 `WslServerRuntime` → `ServerState` 的映射，别在那里加文案。

## 常见改法与坑

- **平台**：整个插件的入口就有 `os: ["windows"]`；在其它系统上测不到任何东西，改动前先确认目标平台。
- **开发构建可用本仓库的 Linux CLI**：`main.ts` 里的 `local` 只在 `!packaged` 且 `OPENCODE_DESKTOP_WSL_CLI_BUILD` 与 `OPENCODE_DESKTOP_WSL_CLI_OUTPUT` 都存在时生效，随后动态 `import("./local")` 的 `buildLocalWslCli`。打包构建永远忽略这两个变量。
- **超时分层**：探测 60s（`WSL_PROBE_TIMEOUT_MS`）、普通动作 60s（`WSL_ACTION_TIMEOUT_MS`）、安装 17 分钟（`WSL_INSTALL_TIMEOUT_MS`）。把安装塞进 60s 会误报失败。
- **`wsl --install` 可能要重启**：`pendingRestart` 就是这条路径，不要把它当失败。
- **`wslpath` 换路径**：`wslCliInstallCommand` 用 `wslpath -a` 把 Windows 路径转成发行版路径，并且用 `shellEscape` 包住；自己拼路径会踩引号/盘符。
- **`summarize` 是给用户看的**：把多行输出压成非空行；日志走 `log("info"|"error", …)`（`[wsl]` 前缀进桌面日志），不要往 UI 塞原始 stdout。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `wsl/index.ts` | `Plugin.define`：`os: ["windows"]` + `builtinCatalog` 多语言 |
| `wsl/contract.ts` | `Wsl` Ipc 与全部 schema（`WslServersState`、`WslServerRuntime`、`WslDistroJob` …） |
| `wsl/main.ts` | main 入口：宽松存储读取、controller 装配、`ctx.provide(Wsl)` |
| `wsl/servers.ts` | `createWslServersController`、`wslServerIdForDistro` |
| `wsl/machine.ts` | 主状态机与 `toServersState`（内部状态 → Ipc state） |
| `wsl/runtime.ts` | `createWslRuntime`、`wslArgs`、超时与命令执行、`shellEscape` |
| `wsl/sidecar.ts` | 在发行版里拉 `opencode serve`：端口、密码、日志行、退出 |
| `wsl/remote-cli.ts` | 发行版内 CLI 的发现/版本/安装脚本 |
| `wsl/local.ts` | 开发构建：从本仓库构建 Linux CLI |
| `wsl/renderer.tsx` | window 入口：`Server` 行、菜单项、对话框 chunk 预算 |
| `wsl/dialog-machine.ts` | 添加对话框状态机与 `selectWslDialog*` 选择器 |
| `wsl/model.ts` | `addServerViewModel` / `addServerProbePlan`：对话框视图模型 |
| `wsl/probes.ts`、`wsl/probe-machine.ts` | 可添加发行版的探测（`useWslAddServerProbes`） |
| `wsl/row-view.ts` | `wslRowView`：一行能做什么 |
