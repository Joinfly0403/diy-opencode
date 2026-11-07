---
id: gui/ssh
title: SSH 远端服务接入
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/ssh
symbols:
  - Ssh
  - SshConfig
  - SshHttp
  - SshItem
  - SshStage
  - SshError
  - SshPrompt
  - SshStart
  - SshState
  - createSshController
  - createSshMainState
  - selectSshServers
  - transitionSshMain
  - createSshWindowState
  - transitionSshWindow
  - parseRegistration
  - discoverScript
  - binaryPath
  - parseTarget
  - sshArgs
  - tunnelArgs
  - quote
  - runSsh
  - createAskpass
  - sshName
  - SSH_RETRY_LIMIT
tests:
  - packages/gui-plugins/src/ssh/main-machine.test.ts
  - packages/gui-plugins/src/ssh/window-machine.test.ts
  - packages/gui-plugins/src/ssh/dialog-machine.test.ts
  - packages/gui-plugins/src/ssh/command.test.ts
  - packages/gui-plugins/src/ssh/askpass.test.ts
  - packages/gui-plugins/src/ssh/bootstrap.test.ts
depends_on:
  - core/plugin-system
related:
  - gui/wsl
  - gui/terminal
  - runtime/process-lifecycle
  - core/pty-shell-worktree
keywords:
  - SSH
  - 远端
  - 隧道
  - tunnel
  - askpass
  - 服务
  - service
  - remote
  - 主机
source_hash: 9c56703463858f3347c4c602d99dc7f94e39bf86
---

## 职责

把一台远端主机上跑的 opencode 后台服务接进 app 的 server 列表：main 进程起 `ssh` 子进程做端口转发并把远端服务的 `url/password` 取回来，window 只拿到 `SshHttp`。

- main（`main.ts` → `controller.ts` → `bootstrap.ts` / `command.ts` / `askpass.ts` / `remote-cli.ts`）：连接、安装/发现远端 CLI、起隧道、回答认证提示。
- window（`renderer.tsx` → `state.ts` / `dialog-machine.ts` / `window-machine.ts`）：`Server` 注册表里的一行、添加对话框、认证对话框。
- 状态机：main `main-machine.ts`（`createSshMainState` / `transitionSshMain`），window `window-machine.ts`。

## 边界

做：
- `user@host` 目标解析与保存（`SshConfig{ id, target, name }`）。
- 远端 opencode CLI 的发现/安装脚本（`remote-cli.ts` 与 `bootstrap.ts`），以及 `service start`/`restart`。
- 每个失败的 server 自动重连（`SSH_RETRY_LIMIT` 次、`SSH_RETRY_DELAY_MS` 间隔），之后等用户。

不做：
- 不实现 SSH 协议：调用系统 `ssh`（`sshExecutable()` 在 win32 上是 `ssh.exe`）。
- 不在 window 侧保存凭据：密码类提示走 askpass 子进程，`SshHttp.password` 只在 main 里出现。
- 不在 web 上运行：`renderer.tsx` 里 `ctx.app.platform !== "desktop"` 直接 return，main 只在 Electron 里。
- 不负责远端 server 的行为（会话、工具、权限都在远端进程里）。

## 入口与调用链

window：

```
src/renderer.ts → ssh/renderer.tsx setup
  ctx.use(Ssh)                     // Live<Ipc>
  ctx.add(Server, { ready, order: 2, entries: saved 的 servers → ServerEntry })
  ctx.add(MenuItem, { menu: "server.add" | "server.row" })
  ctx.add(Command, { id: "add" })   // 打开添加对话框（会在添加后打开项目）
  createKeyed(dialog.active() ? undefined : ssh.dialog.next())   // 别的窗口发起的认证提示
```

main：

```
ssh/main.ts setup
  → builtinMainContext(ctx).storage.store("servers", { from: { settings: "ssh.servers" } })
  → ManagedRuntime(NodeServices ∪ FetchHttpClient) → Scope.make()
  → createSshController({ version, development, binary, command, configs, save })
  → ctx.provide(Ssh, { state, start, resolve, respond, cancel, forget })
  → controller.changes() 流 → push()（revision++ 后 provider.changed()）
  → ctx.windows.on("close", win => controller.detach(win.id))
```

- 连接流程：`controller.start` → `bootstrap`（`discoverScript` → 解析 `OPENCODE_SSH_STATUS` 与 registration JSON → 必要时 `startScript`）→ `command.ts` 的 `tunnelArgs` 建本地端口 → `resolve(id)` 等到 `SshHttp`。
- 认证：`askpass.ts` 的 `createAskpass` 把远端 `ssh` 的 `SSH_ASKPASS` 接成 `SshPrompt`，经 `SshState` 推给**发起该 attempt 的 window**，`respond` 回填。

## 数据与状态

- main store `servers`（`SshConfig[]`，初始 `[]`），旧的桌面设置键 `ssh.servers` 通过 `from: { settings: "ssh.servers" }` 一次性导入。
- 舞台（`SshStage`）：`disconnected / connecting / ready / authentication / incompatible / failed`；`SshItem.http` 只在 `ready` 时存在。
- 错误码（`SshError`）：`connection / input / platform / version / install / service / host-key / ssh-missing / unpublished`，window 用 `error.<code>` 取文案。
- revision：`SshState.revision` 每次 push 递增；`start` 返回这次加入后的 revision，window 用 `state()?.revision >= revision` 判断"我的请求已经落地"。
- 重启窗口后：`Server` 行由 main 的 `state()` 重建，window 不持久化任何连接状态。

## 关键不变式

- **提示只回到发起者**：`selectSshServers(state, viewer)` 按 window 过滤 `prompt`；窗口关闭时 `controller.detach(win.id)` 取消它回答过的 attempt。改这段会泄漏认证提示到别的窗口。
- **凭据不出 main**：`SshHttp.password` 由 main 生成/持有；window 侧只作为 `ServerEntry.http` 交给 host 的连接逻辑。
- **隧道地址必须是 loopback**：`bootstrap.ts` 的 `connectionAddress` 只接受 `http:` + `127.0.0.1 / localhost / 0.0.0.0 / [::] / [::1]`，否则 `SshFailure("service")`。
- **资源按 acquire 顺序注册 finalizer**：`main.ts` 里 scope 逆序释放（changes → controller → scope → runtime）；`ctx.signal.aborted` 在每个 `await` 后都要检查，因为 setup 是 async 的。
- **Ipc 消失是暂停**：window 侧每个动作都先看 `ipc().status === "active"`；`forget` 在 Ipc 非 active 时**拒绝**而不是假装成功（"main keeps the server"）。
- **一个 attempt 只结算一次**：`window-machine.ts` 用 attempt 号；`selectSshCanOpenDialog(id, attempt)`、`selectSshAnsweredPrompt` 等选择器决定 UI，不要在 render 里改状态。
- **接口文案与状态都走 `contract.ts`**：别的插件只允许 import 这个文件（AGENTS.md "Another plugin may import only your contract.ts"）。

## 扩展点

**新增一种连接失败原因**：`contract.ts` 的 `SshError` 加字面量 → `main-machine.ts` 的转换里产出它 → `i18n/*` 的 `error.<code>` → `dialog-machine.ts` 的 `SshDialogErrorKey` 类型会自动收窄。

**新增一个 Ipc 方法**（例如断开）：`contract.ts` 的 `Ssh.methods` → `main.ts` 的 `ctx.provide` 转发 → `controller.ts` 实现并 `PubSub.publish(changed)` → `renderer.tsx` 的菜单项里调用。

**新增认证提示的种类**：`askpass.ts` 解析与 `SshPrompt` 构造 → `dialog-machine.ts` 的视图 → `dialog.tsx`。

## 常见改法与坑

- **平台**：`sshExecutable()` 在 Windows 返回 `ssh.exe`；远端脚本用 `sh -l -s` 走登录 shell，不要把 bash 专属语法塞进 `bootstrap.ts` 的脚本。
- **远端 CLI 位置**：`binaryPath(version)` 固定为 `$HOME/.opencode/desktop-ssh/<version>/opencode`；版本取 `RemoteCli.requireVersion` 规范化后的值。版本不匹配会落到 `incompatible`。
- **首次连接慢**：安装/启动远端服务可能到分钟级，别在 `start` 上调短超时；window 侧用 `ServerEntry.state` 展示"连接中"即可。
- **host key**：`host-key` 是独立错误码，说明 `ssh` 认为主机指纹变了；不要自动接受。
- **docker/CI 里没有 ssh**：`ssh-missing` 是预期分支，不是缺陷。
- **别把 `ctx.cli` 的 binary 猜错**：`main.ts` 用 `cli.binary ?? cli.command[0] ?? "opencode"`，改 CLI 入口时这里要同步。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `ssh/index.ts` | `Plugin.define`：只有 `i18n`（`builtinCatalog`，多语言懒加载） |
| `ssh/contract.ts` | `Ssh` Ipc 与全部 schema（`SshConfig`/`SshItem`/`SshStage`/`SshError`/`SshPrompt`） |
| `ssh/main.ts` | main 入口：存储导入、runtime/scope、`ctx.provide(Ssh)`、窗口关闭 detach |
| `ssh/controller.ts` | `createSshController`：派发机器效果、连接/隧道/提示/等待者表 |
| `ssh/main-machine.ts` | main 状态机与选择器（`selectSshServers`、重试常量） |
| `ssh/bootstrap.ts` | 远端 CLI 发现与注册脚本、`parseRegistration`、`startScript` |
| `ssh/remote-cli.ts` | 远端 CLI 的探测/安装脚本、`archiveUrl`、`latestBeta` |
| `ssh/command.ts` | `SshFailure`、`parseTarget`、`sshArgs`、`tunnelArgs`、`runSsh` |
| `ssh/askpass.ts` | `createAskpass`：把 `SSH_ASKPASS` 接成 UI 提示 |
| `ssh/renderer.tsx` | window 入口：`Server` 行、菜单项、对话框 chunk 预算 |
| `ssh/state.ts` | `createSshController`（window）：attempt、revision 等待、错误 toast |
| `ssh/window-machine.ts` | window 状态机与 `selectSsh*` 选择器 |
| `ssh/dialog-machine.ts` | 添加/连接/提示三种对话框的状态与视图 |
| `ssh/name.ts` | `sshName` / `sshServerState`：显示名与 `ServerState` 映射 |
