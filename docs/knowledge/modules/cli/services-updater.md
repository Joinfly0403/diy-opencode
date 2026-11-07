---
id: cli/services-updater
title: 自更新与服务周边（updater / standalone / web-ui / tunnel）
level: L2
layer: cli
status: stable
paths:
  - packages/cli/src/services/updater.ts
  - packages/cli/src/services/updater-action.ts
  - packages/cli/src/services/update-preflight.tsx
  - packages/cli/src/services/standalone.ts
  - packages/cli/src/services/web-ui.ts
  - packages/cli/src/services/server-connection.ts
  - packages/cli/src/services/port-owner.ts
  - packages/cli/src/services/remote-tunnel.ts
  - packages/cli/src/services/retained-image.ts
  - packages/cli/src/services/service-registration.ts
symbols:
  - Updater
  - Service
  - UpgradeError
  - RunResult
  - action
  - parseReleaseVersion
  - decodePolicy
  - methods
  - UpdatePreflight
  - Handle
  - RetainedImage
  - retain
  - relocate
  - installed
  - Standalone
  - start
  - PortOwner
  - describe
  - RemoteTunnel
  - ensure
  - hostname
  - ServiceRegistration
  - register
  - ServerConnection
  - resolve
  - Resolved
  - Args
entry_cli:
  - default
  - upgrade
  - uninstall
  - service start
  - service restart
  - service stop
config_keys:
  - update
  - autoupdate
tests:
  - packages/cli/src/services/updater.test.ts
  - packages/cli/test/updater-install.test.ts
  - packages/cli/test/web-ui.test.ts
  - packages/cli/test/retained-image.test.ts
  - packages/cli/test/server-connection.test.ts
  - packages/cli/test/service.test.ts
depends_on:
  - runtime/process-lifecycle
  - client/sdk-transports
  - contracts/config-flag
related:
  - contracts/httpapi-protocol
keywords:
  - 自更新
  - updater
  - upgrade
  - 版本检查
  - 安装方式
  - standalone
  - web ui
  - 远程隧道
  - 端口占用
  - 硬链接
source_hash: f62a87e23d75cd80248d9c623ad9eeec2f240e51
---

## 职责

CLI 侧"进程之外"的一圈基础设施，六件事：

1. **自更新**（`updater.ts` + `updater-action.ts` + `update-preflight.tsx`）：检测安装方式 → 查最新版本 → 按策略决定 `none|notify|auto` → 用对应包管理器的命令替换自身。
2. **更新期界面**（`update-preflight.tsx`）：后台服务因版本不匹配被替换时，在 TUI 挂载前用 split-footer 显示三阶段进度。
3. **standalone 服务器**（`standalone.ts`）：为单条命令起一个私有 `serve --stdio --port 0` 子进程。
4. **Web UI 托管**（`web-ui.ts`）：把内嵌的 web 资源服务在同一个 HTTP 端口上，API 路径交给后面的 handler。
5. **服务周边**：`server-connection.ts`（决定连哪儿）、`port-owner.ts`（端口被谁占）、`remote-tunnel.ts`（远程访问隧道）、`service-registration.ts`（注册文件写入与所有权守卫）、`retained-image.ts`（Windows 保活镜像）。

## 边界

- `service.json` 的字段、端口派生、单例判定都不是本卡内容——见 `runtime/process-lifecycle`，这里只在"必须知道有它"的地方链接。
- updater 不实现安装器：它只拼命令并执行（`curl` 走 `https://opencode.ai/v2/install` 脚本，包管理器各一条命令）。
- `web-ui` 不做鉴权：它决定"哪些 path 走 API（含鉴权）、哪些走静态资源"，真正鉴权在 server 层。
- `retained-image` 只在 Windows 生效；Linux/macOS 上这些分支是 no-op。
- `server-connection` 只负责"拿到一个可用 endpoint"，不负责重启策略本身（重启由 `Service.stop/ensure` 组合）。

## 入口与调用链

`````
opencode upgrade [target] [--method]      → handlers/upgrade.ts → Updater.method() / latest() / upgrade()
opencode uninstall                        → handlers/uninstall.ts → Updater.method() / removal() → RetainedImage.relocate
default（TUI 启动）                        → handlers/default.ts
      ServerConnection.resolve({ mismatch: "replace", onStart })
            └─ version-mismatch 且有 TTY ⇒ UpdatePreflight.make().begin(previousVersion)
      Updater.run(onInstall) repeat 10 minutes（Semaphore(1) 串行）
            └─ inspect() → latest() → action(current, latest, policy)
opencode service/... (任意命令)            → ServerConnection.resolve() → Service.ensure() / Standalone.start()

server 侧（serve/service 模式）            → server-process.ts
      WebUi.handler() 作为 transform 注入
      ServiceRegistration.register({ address, password, id, file, shutdown })
      RemoteTunnel.run({ route, target, onURL })   // 仅 service 模式且 config.remote 有 route
      PortOwner.describe(port, hostname)           // 仅在 bind 失败后用于报错
`````

## 数据与状态

- **策略来源**：`global.config` 下的 `config.json` / `opencode.json` / `opencode.jsonc`（jsonc 解析，取最后一个有值的）；主键 `update`（`disable|notify|auto`），兼容旧键 `autoupdate`（`false→disable`、`"notify"→notify`、`true→auto`）；都没有时默认 `notify`。**不经过 Config 服务**——注释明确说 CLI 只投影这个宿主级偏好，不初始化 location 作用域的配置图。
- **版本比较**（`updater-action.ts`）：严格 semver 解析（拒绝前导零、`>256` 字符、超过 `9007199254740991` 的数字组件、非法 prerelease）；`action()` 只做"是否不同"，`+build` 不算新版本；latest 比当前低也返回 `notify`（允许回滚）。
- **安装方式检测**（顺序）：可执行文件 realpath 等于 `~/.opencode/bin/opencode[.exe]` → `curl`；路径含 `/Cellar/{opencode,opencode-beta,opencode-v2}/` → `brew`；路径匹配 `/winget/packages/anomaly.opencode_/` → `winget`；否则读安装目录 `package.json`（必须是 `@opencode/cli` 或 `@opencode-ai/cli`，且 `bin` 指向当前可执行文件）再并发跑 `npm/pnpm/bun/yarn/vp` 的"全局列表"，按可执行文件路径里出现的包管理器优先。
- **版本查询**：`https://opencode.ai/update/api/<channel>/<artifact>/<distribution>?current=<version>`（10s 超时），brew Core 走 `formulae.brew.sh/api/formula/opencode.json`，winget 走 `winget search --id Anomaly.OpenCode`（解析"标识符后一列"为版本，因为表头是本地化的）。
- **安装命令**：`npm install -g --allow-scripts=<pkg> <pkg>@<v>`（跨包迁移时加 `--force`）、`pnpm add -g --allow-build=…`、`yarn global add`、`vp install/update -g`、`bun install -g --trust --cache-dir <tmp>`、`curl` 下载脚本后 `bash <installer> --version <v> --no-modify-path`（Windows 必须 Git Bash）、`brew upgrade`、`winget upgrade --version <v> --silent`。
- **并发**：`EffectFlock` 锁 `cli-upgrade`，等待上限 15 分钟（curl 路径要连跑两条 5 分钟命令）；TUI 内部再用 `Semaphore(1)` 让后台检查、`/update` 查询与手动安装轮流跑。
- **Windows 保活**：`RetainedImage.retain(directory, "upgrade"|"service")` 给运行中的镜像建第二个硬链接（文件名含 pid 与随机串），并清扫 pid 已死的旧链接；目录要删时先 `relocate` 到别处。
- **注册文件**：先写 `<file>.<id>.tmp`（`mode 0o600`）再 `rename`（Windows EPERM 重试 20×10ms），随后每 5s 校验 `id/version/url/pid/password` 是否仍属于自己，被接管就 `shutdown`。
- **Web UI**：`/api`、`/api/*`、`/auth/*`、`/openapi.json` 交给 API（`RouteNotFound` 变 404）；其余走内嵌资源，`index.html`/`sw.js`/`registerSW.js` 用 `no-cache`，其余 `max-age=31536000, immutable`；支持 brotli 直传（`content-encoding: br` + `vary`）；HTML 的 CSP 用内联 theme script 的 sha256 白名单。
- **standalone 生命周期**：子进程 `--stdio --port 0`，`OPENCODE_PASSWORD` 显式覆盖继承值，`stdin` 是管道 —— **EOF 即租约结束**（TUI 被 kill 时 OS 关闭管道）；`killSignal: SIGTERM` + `forceKillAfter 3s`；stdout 第一行 `{"url": "..."}` 是就绪信号，之后继续 drain 防 EPIPE。

## 关键不变式

- **失败必须可解释**：所有安装/查询失败都收敛成 `UpgradeError{ title, detail, command?, retry }`；`detail` 只取 stderr（或 stdout）尾部 12 行 / 2000 字符，并做 ANSI 剥离，避免把整段包管理器输出糊给用户。
- **不许抢用户的安装方式**：当已装包名与目标包名不同且方法是 `pnpm`/`yarn` 时直接失败，要求用户用同一方法重装（否则会出现两份并存）。
- `RetainedImage` 只对"安装形态"启用：`installed()` 排除 `bun`/`node` 运行时，`retaining()` 再按方法判断（`curl` 比对 `~/.opencode/bin` 路径、`winget` 比对 winget 路径、其余要求识别到 `installedPackage`），`brew` 一律跳过。**在源码 checkout 里跑不会去 link 自己**。
- `upgrade` 先 `parseReleaseVersion` 校验入参（非法版本直接失败）；`Ref.set(installedVersion)` 只发生在 `install` 成功之后（`apply`/`run` 走 `install`）。`apply` 在没有检测到安装方式时明确失败，不静默成功。
- `check()` 的"已安装"分支：若某次检查发现"没有更新"但 `OPENCODE_VERSION` 与内存里的 `installedVersion` 不同，说明另一个客户端已经装完了，返回 `{ type: "installed", version }` 让 UI 提示重启。
- `preflight` 只在 `reason === "version-mismatch"` 且 `stdout`/`stdin` 都是 TTY 时启用；否则退回一行 `stderr` 文案。每个阶段有 480ms 下限，避免闪烁。
- **远程隧道只认 route 不认 hostname**：服务声明自己的子域名（route），因为证书是通配的，而隧道 hostname 会出现在公开证书日志里；随机 route 让地址不可猜。致命错误（attach 失败、证书失败、不支持的代理 scheme）**不重试**；其余按 1s 指数退避到 30s 上限重试。
- **端口报错只说人话**：`PortOwner.describe` 仅在非 Windows 且 bind 失败后调用，`lsof`/`ps` 各 1s 超时，拿不到就退回 `PID` 或"another process"。

## 回滚与失败语义

- **没有文件级备份/回滚步骤**。安全边界只有三条：(1) `EffectFlock` 让升级串行；(2) `RetainedImage` 保证旧镜像在替换期间仍可执行（Windows 上"最后一个硬链接不可删"是这里的根本原因）；(3) 安装命令非 0 退出就转成 `UpgradeError`，updater 自己不再动任何文件。
- 安装中断后的最终状态由包管理器/安装脚本决定（`（待确认）`具体中间态）；updater 不做校验重试。
- `upgrade` 里的 `npm --force`/`vp --force` 只在"跨包迁移"或 `artifact === "cli"` 且当前是 `cli-node` 之外时加，避免无谓的强制覆盖。

## 扩展点

- **加一种安装方式**：`methods` 数组 + `installNames` + `method()` 检测 + `commands` 一条命令 + `removalCommand` + 测试（`packages/cli/test/updater-install.test.ts` 用 fixture 逐方法断言，fixture 在 `test/fixture/upgrade.ts`）。
- **改策略/比较规则**：`updater-action.ts` 是纯函数（`action`/`parseReleaseVersion`），先扩 `packages/cli/src/services/updater.test.ts` 的边界用例再动手。
- **改更新期界面**：`update-preflight.tsx` 的 `stages`/`stageFloor`/`transitionDuration`/`completionHold`，以及 `Handle` 的 `begin/loading/finish/fail/close` 契约（`default.ts` 依赖它）。
- **换 web 资源加载**：`WebUi.handler({ assets, brotli })` 允许注入 `AssetMap`/`BrotliMap`（测试与桌面内嵌都这么用）。
- **换隧道实现**：`RemoteTunnel.run` 只依赖 `@opentunnel/client/effect` 的 `OpenTunnelClient`；route 在 `ServiceConfig` 里由 `service set remote` 写入。

## 常见改法与坑

- 在 Linux/macOS 上照抄 `RetainedImage` 分支：`fs.link` 成功也没意义，且会留下垃圾链接（该函数自己做平台判断，别在调用侧再复制一遍）。
- 改 `upgrade` 的命令顺序忘了 `flock`：两个进程同时安装会互相删掉对方刚写的二进制。
- 让 `preflight.begin()` 在没有 TTY 时也返回 `true`：CI/管道下 TUI 会挂死等渲染器。
- 往 `WebUi` 的"API 路径白名单"里漏了 `/auth/*` 或 `/openapi.json`：前者断登录，后者断 `opencode api` 与 `/openapi.json` 客户端。
- 把 `RemoteTunnel` 的 fatal 判定放宽：证书/代理类错误会被无意义重试 30s×N，日志里刷屏。
- 改 `service-registration` 的临时文件 + rename：直接 `writeFileString` 覆盖会让轮询方读到半个 JSON，导致客户端判定服务不健康并重启它。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/cli/src/services/updater.ts` | `Updater.Service`：method/latest/upgrade/removal/run/check/apply、策略读取、方法检测 |
| `packages/cli/src/services/updater-action.ts` | `action` / `parseReleaseVersion` / `Policy` / `Action`（纯函数） |
| `packages/cli/src/services/update-preflight.tsx` | 更新期 split-footer 三阶段进度（`Handle`） |
| `packages/cli/src/services/standalone.ts` | 私有 `serve --stdio` 子进程与就绪握手 |
| `packages/cli/src/services/web-ui.ts` | 内嵌 web 资源服务、CSP、brotli、API 路径白名单 |
| `packages/cli/src/services/server-connection.ts` | `resolve`：`--server` / standalone / `service disabled` / `Service.ensure` 决策 |
| `packages/cli/src/services/port-owner.ts` | 端口占用者描述（lsof + ps） |
| `packages/cli/src/services/remote-tunnel.ts` | `run` / `ensure` / `hostname`：OpenTunnel 路由与重试分类 |
| `packages/cli/src/services/retained-image.ts` | `retain` / `relocate` / `installed`：Windows 硬链接保活 |
| `packages/cli/src/services/service-registration.ts` | 注册文件原子写入 + 所有权守卫 |
