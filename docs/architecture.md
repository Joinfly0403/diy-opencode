# cogagent 技术架构（全仓）

> 对象：本仓库（opencode fork，产品名 **cogagent**），分支 `dev`，基线 `2.2.5`。
> 依据：仓库内实际代码与 `docs/knowledge/`（42 张模块卡，覆盖 1684 个源文件）。
> 模块级检索入口：[docs/knowledge/index.md](knowledge/index.md)。HUD 单独成文：[docs/design/hud-implementation.md](design/hud-implementation.md)。

---

## 1. 定位与边界

| 项 | 说明 |
|---|---|
| 产品名 / 命令名 | cogagent |
| 来源 | opencode 派生（`@opencode/*` 包名保留，内部 import 用） |
| 平台 | **Linux only** |
| 与上游关系 | 已不再跟随上游同步，按自己的方向演进 |
| 差异点 | 中文界面、CAC 登录（华为 CodeAgentCLI）、用户级隔离、本地模式（`cogagent-local`，第三方 API） |
| 运行时目录 | `~/.local/share/cogagent`、`cogagent.db`、`cogagent.json(c)` |
| 分支 | `dev`（PR 目标、diff 基线都是 `origin/dev`） |

---

## 2. 仓库全景

| 目录 | 内容 |
|---|---|
| `packages/` | 工作区（bun workspaces）：23 个包，见 §3 |
| `script/` | 构建/质量/工具脚本：`knowledge`（模块卡生成）、`hud`（HUD 全量源码与发布包）、`ast-grep`、`oxlint`、`hooks`、`cac`、`drive`、`github`、`format.ts`、`lint-changed.ts` 等 |
| `docs/` | 设计与知识库：`knowledge/`（42 张卡）、`design/`（HUD、CDP、知识库方案）、`hud-handover.md` 等 |
| `specs/v2/` | 规格文档 |
| `.opencode/` | 仓库自用的 agent/command/skill/theme/plugin/tool 配置（`opencode.jsonc`、`tui.json`） |
| `patches/` | bun patch（依赖补丁） |
| `salesforce/` | 与 Salesforce 集成的独立子目录 |
| `dist/` | 构建产物（gitignore） |
| `.github/`、`.husky/` | CI 与 git hooks |

---

## 3. packages 分层与依赖规则

### 3.1 包清单（按角色）

| 层 | 包 | 作用 |
|---|---|---|
| 契约 | `schema` | 共享数据模型（`Schema.Class`、identifier、事件定义） |
| 契约 | `protocol` | HttpApi 定义、客户端契约、错误、仿真（`api.ts`/`client.ts`/`errors.ts`/`simulation.ts`） |
| 内核 | `core` | 会话、工具、权限、配置、provider、插件、PTY、VCS…（最大的包） |
| 内核 | `util` | 通用工具 |
| 服务 | `server` | HTTP/SSE 服务端（`handlers/` + `middleware/`，38 个 handler） |
| 客户端 | `client` | 生成的 SDK 客户端（三种形态：Effect / Promise / Solid） |
| 客户端 | `sdk` | 组合 Client + Core + Server 的对外 SDK |
| 界面 | `tui` | 终端 UI（component / routes / prompt / theme / feature-plugins） |
| 界面 | `theme` | 主题 token 与解析 |
| 界面 | `latex`、`merman`、`patchmark` | 渲染类（公式、图表、补丁标记） |
| 能力 | `ai` | 模型请求路由（Route / LLMClient / HttpClient、重试、压缩、超时） |
| 能力 | `codemode` | Effect 原生的受限代码执行（沙箱 VM + 工具面） |
| 能力 | `plugin`、`function` | 插件协议与函数工具 |
| 工具链 | `http-recorder` | 录制/回放 Effect HTTP 与 WebSocket 流量（确定性 cassette） |
| 工具链 | `httpapi-codegen` | 由 HttpApi 生成客户端代码 |
| 其它 | `identity`、`process-daemon`、`effect-drizzle-sqlite` 等 | 身份、进程守护、Drizzle/SQLite 适配 |

### 3.2 依赖方向（硬规则）

```
Schema ──► Core ──► Server
   │         ▲
   └──► Protocol ──► Server

Client ──► Schema / Protocol（不得依赖 Core、Server）
sdk   = Client + Core + Server
```

- 改动公开的 Protocol / Server `HttpApi` 后，必须 `bun run generate`（在 `packages/client`），**不要手改生成的客户端**。
- 领域依赖只能单向：Schema → Core/Protocol → Server。

---

## 4. 运行时拓扑

```
┌────────────┐   启动/连接    ┌─────────────────┐   HTTP + SSE   ┌────────────┐
│  CLI 进程   │ ────────────► │  server（后台）  │ ◄──────────── │ TUI 客户端  │
│ cli/src/   │               │ packages/server │                │ packages/tui│
│ index.ts   │               └────────┬────────┘                └────────────┘
└─────┬──────┘                        │
      │ 子进程/守护                   │ sqlite（Drizzle）
      ▼                               ▼
  process-daemon / persistent-pty   ~/.local/share/cogagent/cogagent.db
```

要点：

- **CLI** 是入口（`packages/cli/src/index.ts`），负责命令树（`commands/commands.ts`）、env/bootstrap、数据库路径、`run`/`mini` 宿主、`server-process` 管理、shutdown deadline、SSH askpass、CPU/heap profile。
- **server** 对 TUI/客户端提供 HTTP API 与 SSE 事件流；进程生命周期由 CLI 管理（可后台常驻）。
- **TUI** 通过客户端包连 server；`bun run dev:live` 会把开发版 TUI 接到当前已选的服务实例（注入其私有凭据）。
- **service 凭据** 由 CLI 的 service 子命令提供（见 `package.json` 的 `dev:live` 脚本）。

---

## 5. 核心域模型

| 概念 | 位置 | 职责 |
|---|---|---|
| Session | `core/src/session/session.ts` | 会话聚合根；`Session.prompt(...)` 是唯一入口 |
| Inbox | `session/inbox.ts` | 待消费输入（`session_inbox` 只存未消费项） |
| Message / Part | `session/message.ts`、`schema` | 可见消息与分片 |
| Step | 执行链 | 一次 `llm.stream` 调用；**不做内存工具循环** |
| SessionExecution | `session/execution.ts` | 进程级、按 Session ID 调度；写前 claim 用于崩溃恢复 |
| SessionRunner | `session/run-coordinator.ts` | 单步执行器；同 Session 串行、不同 Session 并发 |
| Projector | `session/projector.ts` | 事件 → 读模型投影 |
| Compaction | `session/compaction.ts` | 上下文压缩（step 边界触发） |
| Tool / Permission | `core/src/tool`、`core/src/permission` | 工具注册与权限裁决 |
| Location / Instance | `core/src/instance`、`workspace` | 作用域：会话、工具、权限、文件系统都按 Location 绑定 |

---

## 6. 会话执行链路

```
prompt
  └─► Session.prompt()
        ├─ 发布 session.inbox.enqueued（durable）
        ├─ 投影插入一条 session_inbox 行
        └─ SessionExecution.wake()（advisory）
              └─ 每次 drain：LLM 步骤（llm.stream）
                    ├─ 工具调用 → 权限 → 执行 → 结果回注
                    ├─ 必要时 compaction
                    └─ 结束 → idle
```

设计约束（来自仓库规范，改动时必须遵守）：

- **durable 事件只记不可推导的新事实**；可推导状态由投影补齐。
- **投递语义显式**：prompt 默认 steer；空闲边界优先 steer；队列项可在投递前取消/修改。
- **一步 = 一次逻辑 LLM 调用**；“turn”留给未来“从 prompt 提升到会话空闲”的单位。
- **写前 claim** 是恢复标记，不是分布式所有权，也不保证 exactly-once。

---

## 7. 事件、存储与投影

| 能力 | 位置 | 说明 |
|---|---|---|
| 事件总线 | `core/src/event` | 有序事件流，SSE 复用 |
| 持久化 | `core/src/database`、`effect-drizzle-sqlite` | SQLite + Drizzle；迁移在 `core/src/session/sql.ts` 等 |
| 投影 | `session/projector.ts` | 事件折叠成读模型；客户端也可自洽渲染 |
| 迁移 | `server` 的 `migration.ts` handler | 版本升级 |
| KV / Blob | `core/src/kv`、`session/blob.ts` | 小状态与大对象 |

---

## 8. Server HTTP / SSE 与协议

- 协议定义：`packages/protocol/src/api.ts`（HttpApi、OpenAPI 标识、`experimental.<group>.<method>`）。
- 服务端：`packages/server/src/handlers/*.ts`，38 个 handler，按资源划分：
  `session`、`message`、`event`、`agent`、`command`、`config`、`credential`、`form`、`fs`、`generate`、`integration`、`job`、`location`、`mcp`、`media`、`migration`、`model`、`permission`、`persistent-pty`、`plugin`、`project`、`provider`、`pty`、`pty-socket`、`reference`、`rpc`、`schedule`、`server`、`session-error`、`shell`、`skill`、`usage`、`vcs`、`voice`、`websearch`、`worktree`、`artifact`、`debug`。
- 实验性 API 规则：路径 `/api/experimental/<group>/...`、标识 `experimental.<group>.<method>`、SDK 命名空间 `client.experimental.<group>.<method>`；毕业后移出并记 CHANGELOG。
- 破坏性变更：保留旧路径/类型为 `@deprecated` 别名到下一个 minor。

---

## 9. 客户端三形态与 SDK

| 形态 | 入口 | 场景 |
|---|---|---|
| Effect | `packages/client` | 服务端/脚本内组合 |
| Promise | 同上 | 普通异步调用 |
| Solid | 同上 | TUI/前端响应式 |
| SDK | `packages/sdk` | 组合 Client + Core + Server，对外统一入口 |

服务发现：`service.incumbent` / `ensure`（见 `docs/knowledge/modules/client/sdk-transports.md`）。

---

## 10. TUI、主题与国际化

- 目录：`tui/src/{component,routes,prompt,theme,feature-plugins,devtools,plugin,mini,util}`。
- 文案：`tui/src/i18n.ts` 的 `t()` / `L()`，默认中文、英文兜底。
- 主题：语义 token（`theme` 包 + `tui/src/theme`）；禁止按“当前颜色”选 token；缺语义就扩展 schema。
- 开发预览：`OPENCODE_STORY=<story-id> bun run dev:live`；story 在 `tui/src/feature-plugins/system/storybook`，需用真实组件 + `StoryFooter` 列出按键与 reset。

---

## 11. 工具、插件与扩展

| 机制 | 位置 | 说明 |
|---|---|---|
| 工具注册 | `core/src/tool` | 内置工具 + 动态工具 |
| 插件 | `core/src/plugin`、`packages/plugin` | hooks（含 `experimental.*` 命名） |
| 函数工具 | `packages/function` | 声明式工具 |
| CodeMode | `packages/codemode` | 受限 JS 执行（VM/解释器、快照、限额、诊断） |
| MCP | `core/src/mcp`、`server/handlers/mcp.ts` | 外部 MCP server 接入 |
| 技能 | `core/src/skill`、`.opencode/skills` | 技能加载 |
| 仓库自用配置 | `.opencode/{agent,command,skills,themes,plugins,tool}` | 本仓库开发时的 agent 配置 |

---

## 12. 模型与 provider

- 路由与传输：`packages/ai`（Route、LLMClient、HttpClient、重试、压缩、超时）。
- 模型元数据：`core/src/models-dev`、`server/handlers/model.ts`、`provider.ts`。
- 凭据：`core/src/credential`、`oauth`、`account`；`server/handlers/credential.ts`。
- 登录：CAC（华为 CodeAgentCLI）走 `script/cac` 与 CLI 登录流程。

---

## 13. 配置与 feature flag

| 能力 | 位置 | 说明 |
|---|---|---|
| 配置发现/归一化 | `core/src/config/{discovery,normalize,variable,watch,managed}.ts` | `opencode.jsonc` → 运行时配置 |
| flag 定义 | `schema/src/config/flag.ts` | 键 + 描述；`Flag.enabled(key)` 读取 |
| flag 覆盖 | `OPENCODE_FLAGS="key,-other"` / `experimental.<key>` / `all` | 本地与 dev 构建默认开，release 默认关 |
| 托管策略 | `core/src/config/managed.ts` | 企业策略覆盖 |

---

## 14. 运维与本地环境

| 项 | 值/位置 |
|---|---|
| 数据目录 | `~/.local/share/cogagent` |
| 数据库 | `~/.local/share/cogagent/cogagent.db`（SQLite） |
| 配置 | `cogagent.json` / `cogagent.jsonc` |
| 数据库路径解析 | `packages/cli/src/database-path.ts` |
| 后台服务 | CLI service 子命令（start/status/get password） |
| PTY | `core/src/{pty,persistent-pty}`、`server/handlers/pty*.ts` |
| 作业/定时 | `core/src/{job,schedule}`、`server/handlers/{job,schedule}.ts` |
| 工作树/VCS | `core/src/{worktree,vcs}`、`server/handlers/{worktree,vcs}.ts` |

---

## 15. 工程与质量

| 项 | 命令/位置 |
|---|---|
| 包管理/运行时 | `bun@1.4.4`（`packageManager`） |
| 构建编排 | `turbo`（`turbo.json`） |
| Lint | `bun run lint`（oxlint）、`bun run lint:changed` |
| 规则测试 | `bun run test:lint-rules`、`test:effect-simplification-rules` |
| 类型检查 | `bun typecheck`（turbo，按包）；**不要直接 `tsc`** |
| 客户端生成 | `bun run generate`（`packages/client`） |
| 知识库 | `bun run knowledge` / `knowledge:bless`（`script/knowledge/build.ts`） |
| 测试 | 不能从仓库根跑（根脚本直接 exit 1）；按包目录跑；TUI/组件/E2E 各有 skill 说明 |
| 依赖补丁 | `patches/`（bun patch） |
| CI | `.github/workflows` |

---

## 16. 本仓库的增量：HUD

`script/hud/` 是本仓库特有的、与 OSSDesign 对接的悬浮助手 + 接口录制/回放：

| 文件 | 作用 |
|---|---|
| `common/hud.js` | 注入 OSSDesign 页面的面板、录制器、执行器 |
| `common/broker.py` | 本机 18765 服务（宏、运行记录、AI 对话） |
| `common/macro_store.py` | 宏与运行记录落盘 |
| `common/hud_proxy.py` | 页面 → broker 的同源桥 |
| `downloads/cogagent-hud-bundle.tgz` | 发布包（每次提交更新） |

细节见 [docs/design/hud-implementation.md](design/hud-implementation.md)；安装/排障见 [script/hud/README.md](../script/hud/README.md)。

---

## 17. 关键文件地图

| 关注点 | 入口 |
|---|---|
| CLI 启动 | `packages/cli/src/index.ts`、`src/env-bootstrap.ts`、`src/server-process.ts` |
| 命令树 | `packages/cli/src/commands/commands.ts` |
| 会话入口 | `packages/core/src/session/session.ts`（`Session.prompt`） |
| 执行器 | `packages/core/src/session/{execution,run-coordinator}.ts` |
| 事件/投影 | `packages/core/src/event`、`session/projector.ts` |
| 工具/权限 | `packages/core/src/tool`、`core/src/permission` |
| 协议 | `packages/protocol/src/api.ts` |
| 服务端 | `packages/server/src/handlers/*` |
| TUI | `packages/tui/src/component`、`src/routes`、`src/i18n.ts` |
| 配置/flag | `packages/core/src/config`、`packages/schema/src/config/flag.ts` |
| 模块卡 | `docs/knowledge/index.md` |

---

## 18. 术语表

| 术语 | 含义 |
|---|---|
| Session | 会话聚合根，prompt 的唯一入口 |
| Inbox | 未消费的用户输入队列（durable） |
| Step | 一次逻辑 LLM 调用 |
| Part | 消息分片（文本/工具调用/结果等） |
| Turn | 预留概念：从 prompt 提升到会话空闲 |
| Location / Instance | 作用域（目录/工作区）与其服务图 |
| Projector | 事件到读模型的投影器 |
| Claim | 写前执行标记，用于崩溃恢复 |
| Flag | feature flag（`Flag.enabled`） |
| HUD | OSSDesign 页面悬浮助手 + 录制/回放（本仓库增量） |

---

## 19. 已知约束与演进方向

- **Linux only**：Windows/macOS 不是目标平台。
- **不再同步上游**：upstream 仅作参考，不向其推送、不向上游开 PR。
- **release 默认关 flag**：新行为需 flag 保护，稳定后删 flag 与读取点。
- **无 Changesets**：不要加 `.changeset`，按仓库发布流程。
- 模块卡需要维护：改代码后跑 `bun run knowledge`，报 stale 的卡复核后 `--bless`。
