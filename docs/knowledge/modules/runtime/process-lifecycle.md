---
id: runtime/process-lifecycle
title: 进程与生命周期
level: L0
layer: runtime
status: stable
paths:
  - packages/cli/src/index.ts
  - packages/cli/src/server-process.ts
  - packages/cli/src/shutdown-deadline.ts
  - packages/cli/src/mini.ts
  - packages/cli/src/mini-host.ts
  - packages/cli/src/database-path.ts
  - packages/cli/src/services
symbols:
  - ServerProcess
  - ShutdownDeadline
  - ServiceConfig
  - PortOwner
  - ServerConnection
  - RemoteTunnel
  - ServiceRegistration
entry_cli:
  - run
  - serve
  - mini
  - service start
  - service status
  - service stop
tests:
  - packages/cli/src/services/updater.test.ts
  - packages/cli/src/ssh-askpass.test.ts
depends_on:
  - core/location-instance
  - contracts/config-flag
related:
  - cli/commands
  - server/event-feed
keywords:
  - 进程
  - 启动
  - 关闭
  - SIGTERM
  - 后台服务
  - service
  - 端口
  - mini
source_hash: 44ae94cd0bead71d9579f854d27747d3767209a0
---

## 职责

CLI 进程的唯一入口：解析命令、装配 Effect 运行环境、把进程跑起来并在退出时按信号语义收敛。三种进程形态都在这里定义：

| 形态 | 触发 | 特点 |
| --- | --- | --- |
| `default`（前台） | `opencode run` / TUI / `serve` | 进程即产品，退出即结束 |
| `service`（后台） | `opencode service start` | 常驻，注册到 `Service.Info` 文件，端口/密码/远程隧道由 `ServiceConfig` 决定 |
| `stdio` | 由上游宿主拉起 | 删除 `OPENCODE_PASSWORD`，密码走 stdio 租约，不落环境变量 |

## 边界

- 这里**不实现**业务：只做 Layer 装配、信号、端口、单例互斥、退出码。会话/工具/模型分别在 `core/session-execution`、`core/tool-registry`、`core/provider-models`。
- 不决定"要不要重启服务"这类策略——那是 `packages/cli/src/services/updater` 与 desktop 的事。

## 入口与调用链

1. `index.ts` 顶层先做三件事：合并 `NO_PROXY/no_proxy`（Bun 只认小写，本地服务必须绕代理）、`ensurePluginRuntime()`、`OPENCODE_SSH_ASKPASS_PORT` 分支直接跑 askpass 并退出。
2. `Runtime.handlers(Commands, …)` 用动态 `import()` 挂命令处理器——**新增 CLI 命令必须在这里注册**，否则命令存在但 handler 不加载。
3. `Effect.gen` 里依次：`Heap.listen` / `CpuProfile.listen` / `ShutdownDeadline.install()` / 安装 `uncaughtException`+`unhandledRejection` 日志桥 / `Runtime.run(...)`。
4. `serve`/`service` 进入 `ServerProcess.run({ mode })`：解 PTY 交接（`OPENCODE_PTY_HANDOFF`）、`service` 模式 `chdir(Global.home)`、读 `ServiceConfig`、算 `hostname/port`、用 `Service.incumbent` 做单例检查（已有实例直接 return）、`ServiceConfig.processEnv` 注入环境、Windows 上 `RetainedImage.retain` 保活、动态 `import("@opencode/server/process")` 启动 HTTP 服务。

## 数据与状态

- `ServiceConfig` 文件按 channel 命名：`latest|dev|beta|next` → `service.json`，其它 → `service-<channel>.json`；字段 `disabled / remote{route} / remoteAccepted / hostname / port / password / cors / env`，旧版 `remote` 布尔值有兼容解码。
- 默认端口由 channel 派生；**Windows 且端口 ≥0x8000 时改到 `0x7000 | (port & 0xfff)`**，避开 Hyper-V/WinNAT/WSL 保留段（否则会"端口被占用但没人监听"）。
- 退出码：默认 teardown 会把信号中断统一报成 130，所以 `index.ts` 记一个 `SIGTERM` 标记，把 130 改判 143。

## 关键不变式

- `ShutdownDeadline`：收到 SIGTERM/SIGINT 后 teardown 最多 10s，超时把 `Teardown.pending()` 打到 stderr、再等 1.5s 日志刷盘、`exit(1)`；**第二次信号立即退出**。没有 TTY 时不监听 SIGHUP（否则会破坏 nohup 的忽略语义），有 TTY 时 SIGHUP 转成 SIGTERM。
- 退出前必须等 `stdout/stderr` 的 `end` 回调，否则管道里的日志会丢（`index.ts` 的 teardown 就是这么写的）。
- `stdio` 模式必须删掉 `OPENCODE_PASSWORD`/`OPENCODE_SERVER_PASSWORD`，避免被子进程工具继承。
- 启动失败原因写 stderr（`disableErrorReporting` + `tapCause`），因为 desktop 和 `Service.ensure` 只捕获 stderr。

## 配置与开关

| 环境变量 | 作用 |
| --- | --- |
| `OPENCODE_CONFIG_DIR` | 配置目录，替换 `Global` 的 layer |
| `OPENCODE_PTY_HANDOFF` | 重启时交接待恢复的持久终端，读完即删 |
| `OPENCODE_PASSWORD` / `OPENCODE_SERVER_PASSWORD` | 本地服务租约密码 |
| `NO_PROXY` / `no_proxy` | 合并后写入进程环境 |
| `OPENCODE_SSH_ASKPASS_PORT` | 进入 askpass 子进程模式 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` / `_HEADERS` | 观测导出 |

## 扩展点

- **加一个 CLI 命令**：`packages/cli/src/commands/commands` 里声明 + 在 `index.ts` 的 `Handlers` 里挂 `import()` + 写 `commands/handlers/<name>.ts`。三处缺一不可。
- **加一种进程形态**：`ServerProcess.Mode` 加枚举 → `processEffect` 里处理单例/端口/环境 → `serve` handler 透传。
- **加服务期常驻资源**：放 `packages/cli/src/services/`，用 `Effect.acquireRelease` 保证进 `Teardown` 台账，否则 shutdown 超时报告里看不到它。

## 常见改法与坑

- `server-process.ts` 里 `Service.incumbent` 的返回 `undefined` 才能继续启动；改端口逻辑很容易破坏单例判断（两个服务抢同一端口）。
- `RetainedImage` 只在 Windows + `service` 模式生效，别在 Linux 上照抄这段判断。
- `mini.ts` / `mini-host.ts` 是精简宿主（手机/嵌入式），和完整 CLI 共用 `ServerProcess`，改启动参数要两边都过一遍。
- 命令 handler 是**动态导入**：循环依赖或顶层副作用会导致命令静默不可用，排查时直接看 `index.ts` 的映射表。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/cli/src/index.ts` | 进程入口、命令 handler 表、Layer 装配、退出码规则 |
| `packages/cli/src/server-process.ts` | 三种进程形态、单例、端口、PTY 交接 |
| `packages/cli/src/shutdown-deadline.ts` | 10s 关闭预算、SIGHUP 转换、pending 报告 |
| `packages/cli/src/services/service-config.ts` | `service.json` 结构与端口派生 |
| `packages/cli/src/services/server-connection.ts` | 客户端连服务（含密码/远程） |
| `packages/cli/src/services/port-owner.ts` | 端口归属判定 |
| `packages/cli/src/services/remote-tunnel.ts` | 远程访问隧道 |
| `packages/cli/src/services/retained-image.ts` | Windows 服务保活 |
| `packages/cli/src/services/service-registration.ts` | 服务注册文件读写 |
| `packages/cli/src/mini.ts`、`mini-host.ts` | 精简宿主 |
