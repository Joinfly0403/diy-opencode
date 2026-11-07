# opencode 模块检索索引

> 由 build.ts 生成，不要手改。卡片正文在 modules/ 下，机器事实在 _generated/ 下。
>
> 卡片数 42；源文件覆盖 1684/1684。检索顺序：本索引 → 1~3 张卡 → 卡内坐标。

## L0 骨架层（进程 / 契约 / 存储）

- [contracts/config-flag](modules/contracts/config-flag.md) — 配置与 feature flag ｜ 配置、config、opencode.jsonc、flag、feature flag、实验开关、managed policy
- [contracts/events-db](modules/contracts/events-db.md) — 事件总线与持久化 ｜ 事件、bus、持久化、sqlite、drizzle、投影、迁移、sequence
- [contracts/httpapi-protocol](modules/contracts/httpapi-protocol.md) — 协议与 HttpApi ｜ HttpApi、protocol、openapi、端点、handler、sdk 生成、experimental
- [core/location-instance](modules/core/location-instance.md) — Location / Instance 作用域 ｜ Location、Instance、作用域、workspace、project、多目录、服务图
- [runtime/process-lifecycle](modules/runtime/process-lifecycle.md) — 进程与生命周期 ｜ 进程、启动、关闭、SIGTERM、后台服务、service、端口、mini
- [schema/core-model](modules/schema/core-model.md) — 共享数据模型（Schema 顶层契约） ｜ schema、数据模型、契约、Schema.Class、identifier、brand、事件定义、依赖方向

## L1 核心能力（会话 / 工具 / 权限 / 模型 / 插件）

- [ai/routing](modules/ai/routing.md) — 请求路由（Route/LLMClient/HttpClient） ｜ 路由、route、请求、HttpClient、重试、压缩、compact、中间件、超时
- [cli/commands](modules/cli/commands.md) — CLI 命令树与 handler 桥接 ｜ cli、命令树、子命令、handler、effect/cli、参数校验、惰性导入、全局 flag
- [cli/host-glue](modules/cli/host-glue.md) — CLI 宿主胶水（env / 版本 / 数据库路径 / run·mini 宿主 / cli.json） ｜ env、环境变量、版本号、数据库路径、cli.json、迁移、run、mini、宿主、timeline、askpass、资源解包、cpu profile、heap
- [client/sdk-transports](modules/client/sdk-transports.md) — 客户端三种形态与服务发现 / SDK 宿主 ｜ client、客户端、Effect、Promise、Solid、sdk、服务发现、service.incumbent、ensure、SSE、嵌入式宿主
- [codemode/runtime](modules/codemode/runtime.md) — CodeMode JS 执行内核（VM 与解释器） ｜ codemode、沙箱、解释器、字节码、vm、快照、挂起、限制、诊断
- [codemode/tool-surface](modules/codemode/tool-surface.md) — Code Mode 对外表面（标准库 / 工具与命名空间 / OpenAPI / 错误类型） ｜ codemode、标准库、stdlib、Value、Obj、openapi、命名空间、namespace、extension、fetch、签名、类型渲染、ToolError、SuspendError
- [core/background-jobs](modules/core/background-jobs.md) — 后台任务与定时调度 ｜ 后台任务、job、background、定时、schedule、cron、leader、恢复
- [core/core-facades](modules/core/core-facades.md) — core 顶层门面模块（未单独成卡的服务与单例） ｜ core 顶层、门面、服务、agent、snapshot、state、kv、websearch、指令发现
- [core/credential-oauth](modules/core/credential-oauth.md) — 凭据存储与 OAuth 接入 ｜ 凭据、credential、oauth、登录、integration、令牌、refresh、copilot、console
- [core/mcp-integration](modules/core/mcp-integration.md) — MCP 集成 ｜ mcp、model context protocol、服务器、stdio、oauth、工具发现
- [core/permission-policy](modules/core/permission-policy.md) — 权限与策略 ｜ 权限、permission、审批、ruleset、allow、deny、ask、无人值守
- [core/platform-foundations](modules/core/platform-foundations.md) — 平台底座（文件系统 / 环境 / PTY 后端 / Effect 工具 / 身份持久化） ｜ 文件系统、watcher、fff、ripgrep、fuzzysort、environment、exec、pty、websocket、代理、keyed mutex、project、workspace、持久化、归档
- [core/plugin-system](modules/core/plugin-system.md) — 插件系统与扩展点 ｜ 插件、plugin、hook、扩展点、激活、热重载、gui 插件
- [core/provider-models](modules/core/provider-models.md) — 模型与 Provider 适配 ｜ 模型、provider、ai sdk、路由、重试、推理、models.dev
- [core/pty-shell-worktree](modules/core/pty-shell-worktree.md) — PTY / Shell / Worktree ｜ pty、终端、shell、worktree、git、vcs、持久终端
- [core/session-execution](modules/core/session-execution.md) — 会话执行 ｜ 会话、session、inbox、执行、步骤、steer、compaction、中断
- [core/tool-registry](modules/core/tool-registry.md) — 工具注册表与内置工具 ｜ tool、工具、注册表、namespace、codemode、内置工具、工具输出
- [protocol/codegen](modules/protocol/codegen.md) — HttpApi 代码生成（client / SDK / OpenAPI） ｜ codegen、代码生成、HttpApi、OpenAPI、生成物、generate、提交约定、prettier
- [server/auth-pairing](modules/server/auth-pairing.md) — 认证、配对与安全头 ｜ 认证、密码、basic auth、会话 cookie、配对、pairing、CORS、安全头、CSP、401
- [server/event-feed](modules/server/event-feed.md) — 事件流（SSE）、请求追踪与服务状态 ｜ sse、event feed、事件流、断线重连、服务状态、就绪、trace、server info、端口
- [server/http-handlers](modules/server/http-handlers.md) — HTTP handler 实现层 ｜ handler、HttpApiBuilder、端点、请求校验、错误映射、文件下载、Range、websocket、ticket、文件上传
- [tui/components](modules/tui/components.md) — TUI 组件层与 OpenTUI 渲染约束 ｜ 组件、OpenTUI、渲染器、Renderable、对话框、toast、spinner、主题 token、动画、布局、实验开关
- [tui/prompt-editor](modules/tui/prompt-editor.md) — 输入框、编辑器与提交（steer / queue） ｜ 输入框、prompt、提交、steer、queue、粘贴、附件、mention、slash、编辑器、草稿、历史
- [tui/routes-shell](modules/tui/routes-shell.md) — TUI 路由与外壳 ｜ TUI、路由、页面栈、会话、快捷键、keymap、标签页、滚动、虚拟化、挂载预算
- [tui/theme-keybinds](modules/tui/theme-keybinds.md) — 主题 token 与 keybind 配置 ｜ 主题、theme、token、亮暗、自定义主题、回退、keybind、快捷键配置、leader、config
- [tui/util-runtime](modules/tui/util-runtime.md) — TUI 运行时工具（宽度/格式化、剪贴板、提示音、外部编辑器、模型偏好、parsers） ｜ 工具函数、util、string-width、宽度、locale、剪贴板、clipboard、提示音、attention、通知、编辑器、EDITOR、Zed、模型偏好、model preference、parsers、tree-sitter、devtools、bun、node

## L2 能力面（客户端 / 界面 / 扩展 / 周边）

- [ai/generation-media](modules/ai/generation-media.md) — 生成句柄与媒体（图像/媒体资产）入口 ｜ 生成、generation、轮询、图像、媒体、asset、流式、promise、effect、一致性
- [ai/protocols](modules/ai/protocols.md) — 协议适配层（聊天/图像/语音/转写/视频/决策） ｜ 协议、protocol、流式、SSE、事件映射、终止事件、usage、tool-call、错误形状
- [ai/providers](modules/ai/providers.md) — Provider 实现与模型工厂 ｜ provider、厂商、模型工厂、鉴权、baseURL、能力、兼容性、models.dev、透传
- [core/media-format](modules/core/media-format.md) — 格式化、图像与渲染适配 ｜ formatter、格式化、prettier、lsp、图像、缩放、photon、latex、mermaid、markdown、渲染、终端
- [core/skill-system](modules/core/skill-system.md) — 技能系统（SKILL.md 发现与注入） ｜ skill、技能、SKILL.md、提示词、发现、catalog、autoinvoke
- [misc/residual-modules](modules/misc/residual-modules.md) — server 启动层与 TUI 挂载点 ｜ server 启动、ServerOptions、media refs、TUI 挂载
- [schema/v1-compat](modules/schema/v1-compat.md) — V1 兼容层与旧数据迁移 ｜ V1、兼容层、迁移、migration、legacy、旧库、删除时机
- [tui/feature-plugins](modules/tui/feature-plugins.md) — TUI 插件体系与内置功能插件 ｜ 插件、plugin、slot、插槽、路由、热重载、storybook、内置插件、贡献点
- [tui/mini](modules/tui/mini.md) — 精简 TUI（mini） ｜ mini、精简、手机、嵌入式、分屏页脚、split-footer、scrollback、传输、SSE、队列、demo
- [util-runtime/misc](modules/util-runtime/misc.md) — util 基础运行时与辅助包（identity / function / http-recorder） ｜ util、LayerNode、app-node、Global、Teardown、观测、flock、http-recorder、cassette

## 按目录找

- .opencode/plugins → [core/plugin-system](modules/core/plugin-system.md)
- .opencode/skills → [core/skill-system](modules/core/skill-system.md)
- packages/ai → [ai/generation-media](modules/ai/generation-media.md)、[ai/protocols](modules/ai/protocols.md)、[ai/providers](modules/ai/providers.md)、[ai/routing](modules/ai/routing.md)、[core/provider-models](modules/core/provider-models.md)
- packages/cli → [cli/commands](modules/cli/commands.md)、[cli/host-glue](modules/cli/host-glue.md)、[runtime/process-lifecycle](modules/runtime/process-lifecycle.md)、[tui/mini](modules/tui/mini.md)
- packages/client → [client/sdk-transports](modules/client/sdk-transports.md)、[contracts/httpapi-protocol](modules/contracts/httpapi-protocol.md)、[protocol/codegen](modules/protocol/codegen.md)
- packages/codemode → [codemode/runtime](modules/codemode/runtime.md)、[codemode/tool-surface](modules/codemode/tool-surface.md)
- packages/core → [contracts/config-flag](modules/contracts/config-flag.md)、[contracts/events-db](modules/contracts/events-db.md)、[core/background-jobs](modules/core/background-jobs.md)、[core/core-facades](modules/core/core-facades.md)、[core/credential-oauth](modules/core/credential-oauth.md)、[core/location-instance](modules/core/location-instance.md)、[core/mcp-integration](modules/core/mcp-integration.md)、[core/media-format](modules/core/media-format.md)、[core/permission-policy](modules/core/permission-policy.md)、[core/platform-foundations](modules/core/platform-foundations.md)、[core/plugin-system](modules/core/plugin-system.md)、[core/provider-models](modules/core/provider-models.md)、[core/pty-shell-worktree](modules/core/pty-shell-worktree.md)、[core/session-execution](modules/core/session-execution.md)、[core/skill-system](modules/core/skill-system.md)、[core/tool-registry](modules/core/tool-registry.md)、[schema/v1-compat](modules/schema/v1-compat.md)
- packages/function → [util-runtime/misc](modules/util-runtime/misc.md)
- packages/http-recorder → [util-runtime/misc](modules/util-runtime/misc.md)
- packages/httpapi-codegen → [contracts/httpapi-protocol](modules/contracts/httpapi-protocol.md)、[protocol/codegen](modules/protocol/codegen.md)
- packages/identity → [util-runtime/misc](modules/util-runtime/misc.md)
- packages/latex → [core/media-format](modules/core/media-format.md)
- packages/merman → [core/media-format](modules/core/media-format.md)
- packages/patchmark → [core/media-format](modules/core/media-format.md)
- packages/plugin → [core/plugin-system](modules/core/plugin-system.md)、[tui/feature-plugins](modules/tui/feature-plugins.md)
- packages/protocol → [contracts/httpapi-protocol](modules/contracts/httpapi-protocol.md)、[protocol/codegen](modules/protocol/codegen.md)、[server/event-feed](modules/server/event-feed.md)
- packages/schema → [contracts/config-flag](modules/contracts/config-flag.md)、[contracts/events-db](modules/contracts/events-db.md)、[core/background-jobs](modules/core/background-jobs.md)、[core/credential-oauth](modules/core/credential-oauth.md)、[core/mcp-integration](modules/core/mcp-integration.md)、[core/skill-system](modules/core/skill-system.md)、[schema/core-model](modules/schema/core-model.md)、[schema/v1-compat](modules/schema/v1-compat.md)
- packages/sdk → [client/sdk-transports](modules/client/sdk-transports.md)
- packages/server → [contracts/httpapi-protocol](modules/contracts/httpapi-protocol.md)、[misc/residual-modules](modules/misc/residual-modules.md)、[server/auth-pairing](modules/server/auth-pairing.md)、[server/event-feed](modules/server/event-feed.md)、[server/http-handlers](modules/server/http-handlers.md)
- packages/theme → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- packages/tui → [misc/residual-modules](modules/misc/residual-modules.md)、[tui/components](modules/tui/components.md)、[tui/feature-plugins](modules/tui/feature-plugins.md)、[tui/mini](modules/tui/mini.md)、[tui/prompt-editor](modules/tui/prompt-editor.md)、[tui/routes-shell](modules/tui/routes-shell.md)、[tui/theme-keybinds](modules/tui/theme-keybinds.md)、[tui/util-runtime](modules/tui/util-runtime.md)
- packages/util → [util-runtime/misc](modules/util-runtime/misc.md)

## 按事件找

- `credential.switched` → [core/credential-oauth](modules/core/credential-oauth.md)
- `credential.updated` → [core/credential-oauth](modules/core/credential-oauth.md)
- `experimental.ws.handshake` → [core/plugin-system](modules/core/plugin-system.md)
- `filesystem.changed` → [core/platform-foundations](modules/core/platform-foundations.md)
- `integration.updated` → [core/credential-oauth](modules/core/credential-oauth.md)
- `permission.asked` → [core/permission-policy](modules/core/permission-policy.md)
- `project.updated` → [core/platform-foundations](modules/core/platform-foundations.md)
- `server.connected` → [server/event-feed](modules/server/event-feed.md)
- `session.inbox.delivered` → [contracts/events-db](modules/contracts/events-db.md)
- `session.inbox.delivered` → [core/session-execution](modules/core/session-execution.md)
- `session.inbox.enqueued` → [contracts/events-db](modules/contracts/events-db.md)
- `session.inbox.enqueued` → [core/session-execution](modules/core/session-execution.md)
- `skill.updated` → [core/skill-system](modules/core/skill-system.md)

## 按配置键找

- `animations` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `attention.notifications` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `attention.notifications` → [tui/util-runtime](modules/tui/util-runtime.md)
- `attention.sound` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `attention.sound` → [tui/util-runtime](modules/tui/util-runtime.md)
- `attention.sound_pack` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `attention.sound_pack` → [tui/util-runtime](modules/tui/util-runtime.md)
- `attention.sounds` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `attention.sounds` → [tui/util-runtime](modules/tui/util-runtime.md)
- `attention.volume` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `attention.volume` → [tui/util-runtime](modules/tui/util-runtime.md)
- `cors` → [server/auth-pairing](modules/server/auth-pairing.md)
- `cursor.blinking` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `cursor.style` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `devtools` → [tui/util-runtime](modules/tui/util-runtime.md)
- `diffs.source` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `diffs.wrap` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `events.persist` → [server/event-feed](modules/server/event-feed.md)
- `experimental` → [tui/feature-plugins](modules/tui/feature-plugins.md)
- `experimental` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `experimental.*` → [contracts/config-flag](modules/contracts/config-flag.md)
- `experimental.all_flags` → [contracts/config-flag](modules/contracts/config-flag.md)
- `experimental.schedules` → [core/background-jobs](modules/core/background-jobs.md)
- `formatter` → [core/media-format](modules/core/media-format.md)
- `keybinds` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `leader.timeout` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `mcp` → [contracts/config-flag](modules/contracts/config-flag.md)
- `mcp` → [core/mcp-integration](modules/core/mcp-integration.md)
- `media.image` → [core/media-format](modules/core/media-format.md)
- `model` → [core/provider-models](modules/core/provider-models.md)
- `mouse` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `OPENCODE_PASSWORD` → [server/auth-pairing](modules/server/auth-pairing.md)
- `OPENCODE_SERVER_PASSWORD` → [server/auth-pairing](modules/server/auth-pairing.md)
- `password` → [server/auth-pairing](modules/server/auth-pairing.md)
- `permissions` → [contracts/config-flag](modules/contracts/config-flag.md)
- `permissions` → [core/permission-policy](modules/core/permission-policy.md)
- `plugins` → [tui/feature-plugins](modules/tui/feature-plugins.md)
- `providers` → [contracts/config-flag](modules/contracts/config-flag.md)
- `providers` → [core/provider-models](modules/core/provider-models.md)
- `scroll.acceleration` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `scroll.speed` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `session.new_location` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `session.permissions` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `skills` → [contracts/config-flag](modules/contracts/config-flag.md)
- `skills` → [core/skill-system](modules/core/skill-system.md)
- `tabs.indicators` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `tabs.layout` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `tabs.mode` → [cli/host-glue](modules/cli/host-glue.md)
- `tabs.mode` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `tabs.scope` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `terminal.copy` → [cli/host-glue](modules/cli/host-glue.md)
- `theme.mode` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `theme.name` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)

## 按 HTTP 端点找

- `DELETE /api/credential/:credentialID` → [core/credential-oauth](modules/core/credential-oauth.md)
- `GET /api/credential` → [core/credential-oauth](modules/core/credential-oauth.md)
- `GET /api/event` → [server/event-feed](modules/server/event-feed.md)
- `GET /api/event` → [server/http-handlers](modules/server/http-handlers.md)
- `GET /api/experimental/media/:hash` → [server/http-handlers](modules/server/http-handlers.md)
- `GET /api/experimental/session/:sessionID/terminal/read` → [server/http-handlers](modules/server/http-handlers.md)
- `GET /api/fs/read/*` → [server/http-handlers](modules/server/http-handlers.md)
- `GET /api/info` → [server/auth-pairing](modules/server/auth-pairing.md)
- `GET /api/info` → [server/event-feed](modules/server/event-feed.md)
- `GET /api/integration/:integrationID/connect/oauth/:attemptID` → [core/credential-oauth](modules/core/credential-oauth.md)
- `GET /api/pty/:ptyID/connect` → [server/http-handlers](modules/server/http-handlers.md)
- `GET /auth/connect/:code` → [server/auth-pairing](modules/server/auth-pairing.md)
- `PATCH /api/credential/:credentialID` → [core/credential-oauth](modules/core/credential-oauth.md)
- `POST /api/credential` → [core/credential-oauth](modules/core/credential-oauth.md)
- `POST /api/credential/:credentialID/activate` → [core/credential-oauth](modules/core/credential-oauth.md)
- `POST /api/experimental/fs/write` → [server/http-handlers](modules/server/http-handlers.md)
- `POST /api/integration/:integrationID/connect/oauth` → [core/credential-oauth](modules/core/credential-oauth.md)
- `POST /api/pair` → [server/auth-pairing](modules/server/auth-pairing.md)

## 按符号找

- `Generation`、`resultEvents`、`isTerminal`、`ImageModel`、`ImageEvent`、`ImageResponse`、`ImageClient`、`Asset`、`AssetSchema`、`Media`、`GenerationHandle`、`MediaModel`、`MediaClient` → [ai/generation-media](modules/ai/generation-media.md)
- `OpenAIChat`、`AnthropicMessages`、`BedrockConverse`、`CohereChat`、`AlibabaChat`、`OpenResponses`、`Gemini`、`MistralChat`、`ProviderShared`、`Lifecycle`、`ToolStream`、`BedrockEventStream` → [ai/protocols](modules/ai/protocols.md)
- `ProviderPackage`、`LanguageModel`、`LanguageModelCompatibility`、`Capabilities`、`ProviderOptions`、`mergeProviderOptions`、`bearerRouteDefaults`、`toConfig`、`OpenAIOptionsInput`、`ProviderID`、`DeepSeek`、`Anthropic` → [ai/providers](modules/ai/providers.md)
- `Route`、`LLMClient`、`RequestExecutor`、`Auth`、`Endpoint`、`Framing`、`HttpTransport`、`Protocol`、`StreamOptions`、`CompactionOperations`、`canCompact`、`compileRequest` → [ai/routing](modules/ai/routing.md)
- `Commands`、`PrintLogs`、`Standalone`、`Server`、`Spec`、`Runtime`、`CliFlag`、`resolveOperation`、`remoteConsent`、`remoteWarning`、`createClient`、`inspect` → [cli/commands](modules/cli/commands.md)
- `Env`、`password`、`OPENCODE_VERSION`、`OPENCODE_CHANNEL`、`OPENCODE_ARTIFACT`、`OPENCODE_HIGHLIGHTS`、`OPENCODE_LOCAL`、`databasePath`、`Heap`、`CpuProfile`、`MiniCommandInput`、`runMini`、`createMiniConnection`、`resolveMiniTarget`、`validateMiniTerminal`、`InteractiveStdin`、`INTERACTIVE_INPUT_ERROR`、`createMiniHost`、`resolveInteractiveStdin`、`usingInteractiveStdin`、`SessionTarget`、`SessionTargetMutationError`、`SessionTargetPreparation`、`resolveSessionTarget`、`createWorktreeLocation`、`findSession`、`parseSessionTargetModel`、`RunCommandInput`、`runNonInteractive`、`mergeInput`、`parseRunModel`、`reportRunError`、`runNonInteractivePrompt`、`Style`、`UI`、`println`、`TimelineHost`、`createTimelineHost`、`IntegrationChoice`、`selectIntegration`、`handlePromptErrors`、`openUrl`、`requireInteractive`、`errorMessage`、`readStdin`、`readStdinIfReady`、`selfCommand`、`NodeTarget`、`nodeTarget`、`nodeExecArgv`、`photonWasmAsset`、`attentionSoundAssets`、`Config`、`ConfigMigration`、`migrateV1`、`Info`、`SchemaURL`、`normalizeLegacyTabs`、`ShutdownDeadline`、`DEADLINE`、`askpass` → [cli/host-glue](modules/cli/host-glue.md)
- `OpenCode`、`make`、`Service`、`discover`、`incumbent`、`ensure`、`stop`、`Info`、`SharedEvents`、`createData`、`Data`、`createClientConnection`、`defaultIdleTimeout`、`createPersistentPtyClient`、`decodePersistentPtyMessage`、`createSessionRetention`、`lastAssistantWithUsage`、`EmbeddedHost`、`SdkInstances`、`PromiseSdk`、`Interface`、`layer`、`create` → [client/sdk-transports](modules/client/sdk-transports.md)
- `VmEngine`、`Vm`、`Interpreter`、`startProgram`、`resumeProgram`、`finishExecution`、`Running`、`toBytes`、`fromBytes`、`SnapshotError`、`fromJson`、`MAX_PENDING_PROMISES`、`MAX_VALUE_DEPTH`、`globalNames`、`extensionGlobals` → [codemode/runtime](modules/codemode/runtime.md)
- `CodeMode`、`Extension`、`Namespace`、`OpenAPI`、`Tool`、`ToolError`、`toolError`、`SuspendError`、`SnapshotError`、`toBytes`、`fromBytes`、`searchSignature`、`toolExpression`、`Services`、`isAsync`、`make`、`isTool`、`isNamespace`、`JsonSchema`、`SchemaType`、`Tools`、`toTypeScript`、`jsonSchemaToTypeScript`、`inputProperties`、`inputTypeScript`、`outputTypeScript`、`isEmptyInput`、`decodeInput`、`decodeOutput`、`identifierSegment`、`scanTools`、`fromSpec`、`invoke`、`operationPath`、`operationInput`、`operationOutput`、`specServerUrl`、`validateBaseUrl`、`securitySchemes`、`securityRequirements`、`componentDefinitions`、`hasDirectionalSchemas`、`methods`、`Plan`、`Skipped`、`Credential`、`SecurityScheme`、`AuthResolver`、`arrayGlobal`、`callbackMethods`、`stringGlobal`、`mapGlobal`、`setGlobal`、`weakMapGlobal`、`weakSetGlobal`、`groupBy`、`iteratorGlobals`、`consoleGlobal`、`formatValue`、`dateGlobal`、`regexpGlobal`、`jsonGlobal`、`mathGlobal`、`numberGlobal`、`booleanGlobal`、`objectGlobal`、`objectAssign`、`enumerableSource`、`uint8ArrayGlobal`、`textEncoderGlobal`、`textDecoderGlobal`、`TextDecoderObj`、`headersGlobal`、`urlGlobal`、`urlSearchParamsGlobal`、`uriGlobal`、`base64Global`、`structuredCloneGlobal`、`cryptoGlobal`、`coerce`、`coercion`、`compoundOperators`、`Coercion` → [codemode/tool-surface](modules/codemode/tool-surface.md)
- `Config`、`Flag`、`Service`、`resolve`、`latest` → [contracts/config-flag](modules/contracts/config-flag.md)
- `Bus`、`Database`、`latestSequence`、`reserveSequence`、`Service` → [contracts/events-db](modules/contracts/events-db.md)
- `Api`、`createRoutes`、`createEmbeddedRoutes`、`handlers` → [contracts/httpapi-protocol](modules/contracts/httpapi-protocol.md)
- `Job`、`JobList`、`Schedule`、`ScheduleCheck`、`JobTable`、`ScheduleTable`、`RecoverySchema`、`StartInput`、`WaitInput`、`BlockInput`、`NotFoundError`、`InvalidError`、`DisabledError`、`TIMEOUT_MS`、`validate`、`describe`、`authorize`、`evaluate` → [core/background-jobs](modules/core/background-jobs.md)
- `Agent`、`App`、`Artifact`、`Command`、`FileAccess`、`FileMutation`、`FileRetention`、`FileSystem`、`Form`、`Generate`、`InstructionDiscovery`、`KV`、`Mime`、`ModelsDev`、`Reference`、`SharedCache`、`Snapshot`、`State`、`Variant`、`Voice`、`WebSearch` → [core/core-facades](modules/core/core-facades.md)
- `Credential`、`Integration`、`CredentialTable`、`IntegrationConnection`、`ConsoleAccess`、`OauthCallbackPage`、`CopilotModels`、`AccountTable`、`AccountStateTable`、`ControlAccountTable`、`activeCredential`、`credentialSettings`、`createOpenaiCompatible`、`defaultServer`、`bootstrap`、`key` → [core/credential-oauth](modules/core/credential-oauth.md)
- `Location`、`LocationLifecycle`、`LocationServiceMap`、`Instance`、`Project`、`Workspace`、`Worktree` → [core/location-instance](modules/core/location-instance.md)
- `Mcp`、`McpConnection`、`McpPool` → [core/mcp-integration](modules/core/mcp-integration.md)
- `Formatter`、`Image`、`FileWrite`、`ResizerUnavailableError`、`DecodeError`、`SizeError`、`Limits`、`Photon`、`PhotonNormalize`、`ImageNotice`、`ConfigFormatterPlugin`、`ConfigImagePlugin`、`renderLatex`、`createLatexCodeBlockRenderer`、`LatexParseError`、`DEFAULT_MAX_SOURCE_LENGTH`、`detectMermaidDiagram`、`MermaidSyntaxError`、`createMermaidCodeBlockRenderer`、`createMarkdownStream`、`PatchmarkStream`、`healStreamingInline`、`parseInlines`、`renderBlocksToHtml` → [core/media-format](modules/core/media-format.md)
- `evaluate`、`merge`、`invocation`、`Unattended`、`DeclinedError`、`CorrectedError`、`BlockedError` → [core/permission-policy](modules/core/permission-policy.md)
- `FileWatch`、`DisabledError`、`MAX_PER_LOCATION`、`Watcher`、`Native`、`hasNativeBinding`、`Fff`、`FileSystemSearch`、`makeFffLayer`、`LocationWatcher`、`LocationWatcherPolicy`、`Protected`、`isHome`、`EnvironmentService`、`EnvironmentLocal`、`EnvironmentMemory`、`EnvironmentUnavailable`、`EnvironmentDriver`、`FilesImpl`、`typeFollowing`、`execDefaults`、`makeFiles`、`makeLocalDriver`、`makeMemoryDriver`、`MemoryDriver`、`KeyedMutex`、`makeUnsafe`、`AppNodeBuilder`、`LayerNodePlatform`、`requestExecutor`、`WebSocketConstructor`、`ErrorSummary`、`gitExecutable`、`resolveGitExecutable`、`lazy`、`Slug`、`which`、`Wildcard`、`PtyProtocol`、`metaFrame`、`REPLAY_CHUNK`、`PtyTicket`、`ConnectToken`、`Proc`、`CodeModeCatalog`、`summarize`、`CodeModeExecution`、`CodeModeFetch`、`MAX_REDIRECTS`、`CodeModeInstructions`、`CodeModeTool`、`qualifiedName`、`Project`、`ACTIVATE_INTERVAL`、`sweepNode`、`ProjectSchema`、`ProjectTable`、`upsertProject`、`ProjectDirectoryTable`、`ProjectIcon`、`Workspace`、`CreateConflict`、`WorkspaceTable`、`WorkspaceDriver`、`Binding`、`ProviderNotFound`、`registryNode` → [core/platform-foundations](modules/core/platform-foundations.md)
- `Plugin`、`PluginHooks`、`PluginSupervisor`、`InstancePlugins`、`PluginHost` → [core/plugin-system](modules/core/plugin-system.md)
- `Provider`、`Model`、`AISDK`、`ModelResolver`、`UsageLimits`、`mergeCapabilities` → [core/provider-models](modules/core/provider-models.md)
- `Pty`、`Shell`、`Worktree`、`Vcs`、`WorktreeStrategies`、`PersistentPty` → [core/pty-shell-worktree](modules/core/pty-shell-worktree.md)
- `Session`、`Service`、`terminal`、`serialized`、`find` → [core/session-execution](modules/core/session-execution.md)
- `Skill`、`SkillDiscovery`、`SkillInstructions`、`SkillTool`、`SkillScan`、`SkillFile`、`ConfigSkillPlugin`、`ConfigCompatibilityPlugin`、`available`、`toModelOutput`、`prepare`、`isSafeSegment`、`isSafeRelativePath`、`DirectorySource`、`EmbeddedSource`、`UrlSource`、`Plugin` → [core/skill-system](modules/core/skill-system.md)
- `Tool`、`RegistrationError`、`Editor`、`definition`、`execute`、`effectiveName` → [core/tool-registry](modules/core/tool-registry.md)
- `ServerOptions`、`ServerFetch`、`wantsMediaRefs`、`abbreviateHome` → [misc/residual-modules](modules/misc/residual-modules.md)
- `compile`、`emitEffect`、`emitEffectImported`、`emitEffectShape`、`emitPromise`、`write`、`generate`、`GenerationError`、`Contract`、`Output`、`Alias`、`stabilizeOpenApi` → [protocol/codegen](modules/protocol/codegen.md)
- `ServerProcess`、`ShutdownDeadline`、`ServiceConfig`、`PortOwner`、`ServerConnection`、`RemoteTunnel`、`ServiceRegistration` → [runtime/process-lifecycle](modules/runtime/process-lifecycle.md)
- `Identifier`、`ascending`、`descending`、`SessionID`、`ProjectID`、`WorkspaceID`、`AbsolutePath`、`RelativePath`、`optional`、`statics`、`withStatics`、`DateTimeUtcFromMillis`、`Event`、`durable`、`ephemeral`、`inventory`、`latest`、`versionedType`、`durableMap`、`Location`、`Permission`、`Tool`、`Session`、`SessionMessage`、`Prompt`、`PromptInput` → [schema/core-model](modules/schema/core-model.md)
- `SessionV1`、`PermissionV1`、`FileSystemV1`、`LegacyEventV1`、`ConfigAgentV1`、`ConfigCommandV1`、`ConfigMCPV1`、`ConfigPermissionV1`、`ConfigPluginV1`、`ConfigProviderV1`、`ConfigMigrateV1`、`normalizeAction`、`migrateAgent`、`V1Migration`、`transformSession`、`SourceMessage`、`Status`、`Warning` → [schema/v1-compat](modules/schema/v1-compat.md)
- `ServerAuth`、`ServerPairing`、`ContentHeaders`、`CONTENT_SECURITY_POLICY`、`disposition`、`CorsConfig`、`isAllowedCorsOrigin`、`isAllowedRequestOrigin`、`RequestSite`、`rejected`、`authorizationLayer`、`authorizedRequest`、`unauthorizedResponse`、`schemaErrorLayer`、`SessionLocationMiddleware`、`FormLocationMiddleware`、`sessionLocationLayer`、`formLocationLayer`、`SESSION_TTL_SECONDS`、`issueSession`、`verifySession`、`sessionCookieName`、`authorized`、`required`、`ServerProcess` → [server/auth-pairing](modules/server/auth-pairing.md)
- `EventFeed`、`SubscriberCapacity`、`SubscriberOverflowError`、`EncodingError`、`frame`、`make`、`Service`、`layer`、`withoutParentSpan`、`Status`、`ServerInfo`、`connectionURLs`、`EventGroup`、`isOpenCodeEvent`、`OpenCodeEvent` → [server/event-feed](modules/server/event-feed.md)
- `handlers`、`FileSystemHandler`、`SessionHandler`、`EventHandler`、`ConfigHandler`、`PtyHandler`、`McpHandler`、`makeMediaGet`、`makeArtifact`、`makeSchedule`、`makeJob`、`runPtySocket`、`holdLocation`、`missingSession`、`failedSnapshot`、`response`、`locationErrors`、`sessionInfo`、`LocationMiddleware` → [server/http-handlers](modules/server/http-handlers.md)
- `Dialog`、`DialogHeader`、`DialogFooter`、`DialogLayout`、`DialogBleed`、`DialogSelect`、`DialogSelectProps`、`DialogAlert`、`DialogConfirm`、`DialogPrompt`、`DialogHelp`、`DialogExportOptions`、`DialogExportResult`、`DIALOG_INSET`、`DIALOG_LIST_INSET`、`dialogWidth`、`FilePath`、`truncateFilePath`、`Link`、`clickedLink`、`PaneResizeHandle`、`createPaneResize`、`moveSelection`、`reconcileSelection`、`octantGlyph`、`oneCellFrame`、`spring`、`tween`、`createAnimatable`、`SESSION_SIDEBAR_WIDTH`、`SESSION_SIDEBAR_MAX_WIDTH`、`clampSessionTabsWidth`、`sessionTabsFitVertically`、`SESSION_PANEL_SPLIT_MIN_WIDTH`、`SplitBorder`、`EmptyBorder`、`Toast`、`ToastProvider`、`Spinner`、`SpinnerRenderable`、`SPINNER_FRAMES`、`OneCellSpinner`、`SessionTabs`、`SessionFrame`、`PanelHost`、`TerminalPane`、`TabPulse`、`RetryProvider`、`PatchDiff`、`CommandPaletteDialog`、`DialogConfig`、`DialogExperiments`、`experiments`、`ErrorComponent`、`FadeInText`、`Logo`、`MigrationOverlay`、`PluginRouteMissing`、`Reconnecting`、`StartupLoading`、`TodoItem`、`DialogThemeList`、`DialogSessionList`、`DialogModel`、`DialogMcp`、`DialogStatus`、`ThemeErrorToast`、`DialogDebug`、`Prompt` → [tui/components](modules/tui/components.md)
- `Plugin`、`PluginContextProvider`、`usePlugin`、`define`、`Definition`、`Cleanup`、`Context`、`SlotMap`、`SlotPath`、`SlotClaim`、`Keymap`、`KeymapLayer`、`KeymapCommand`、`UI`、`Storage`、`Data`、`Route`、`Page`、`Dialog`、`Toast`、`Attention`、`PanelPresentation`、`PluginProvider`、`PackageSource`、`PluginBoundary`、`PluginRoute`、`Slot`、`builtins`、`resolveSlots`、`contains`、`emptySlotted`、`PlacementKind`、`Placement`、`Claim`、`Slotted`、`Suppressed`、`Degraded`、`createPluginContext`、`createDialogApi`、`usePluginHost`、`Registry`、`SlotRender`、`RegisteredSlot`、`Dispose`、`createSourceWatcher`、`createMarkdownRenderer`、`discoverPluginTargets`、`localPluginDirectories`、`mergePluginTargets`、`Story`、`StoryFooter`、`StoryFooterControl`、`sessionTabsStory`、`oneCellSpinnerStory`、`todoStory`、`linkClicksStory`、`highlightsStory`、`mermanLayoutsStory`、`sessionLocationMissingStory`、`ONE_CELL_SPINNERS`、`SUBCELL_SPINNERS`、`PromptFooter`、`SidebarTodo`、`SidebarContext`、`SidebarOnboarding`、`SidebarLimit`、`SidebarMcp`、`Answer`、`GoalStatus`、`createGoal`、`PluginsDialog`、`StatsPoster`、`DiffFile`、`DiffViewerContent`、`DiffViewerFileTree`、`DiffViewerImage`、`homeFooterVisibility` → [tui/feature-plugins](modules/tui/feature-plugins.md)
- `MiniFrontendInput`、`runMini`、`MiniCommandInput`、`createMiniHost`、`usingInteractiveStdin`、`INTERACTIVE_INPUT_ERROR`、`RunDeferredInput`、`RunRuntimeDeps`、`RunInput`、`RunPrompt`、`RunDelivery`、`RunSession`、`MiniHost`、`MiniSettings`、`MiniVerbosity`、`RunTuiConfig`、`FooterApi`、`FooterEvent`、`FooterPatch`、`FooterView`、`FooterState`、`FooterPromptRoute`、`FooterQueuedPrompt`、`StreamCommit`、`LocalReplayRow`、`RunFooter`、`RunFooterView`、`RunScrollbackStream`、`RunEntryBody`、`RunTheme`、`RUN_THEME_FALLBACK`、`RunEntryTheme`、`RunFooterTheme`、`RunBlockTheme`、`Lifecycle`、`LifecycleInput`、`QueueInput`、`SessionTransport`、`createSession`、`sessionHistory`、`sessionVariant`、`messagePrompt`、`resolveMiniSettings`、`resolveModelInfo`、`resolveModelInfoStrict`、`resolveSessionInfo`、`resolveRunTuiConfig`、`verbosityPreset`、`verbosityChange`、`applyMiniSettingChange`、`cycleMiniVerbosity`、`matchMiniVerbosity`、`createPromptState`、`createPromptHistory`、`movePromptHistory`、`promptAppend`、`promptCopy`、`createPermissionBodyState`、`createFormBodyState`、`formReply`、`entrySplash`、`exitSplash`、`splashMeta`、`monoSnapshot`、`monoMarkdownRenderable`、`entryBody`、`entryWriter`、`writeSessionOutput`、`createFragmentReconciler`、`createSubagentTracker`、`toolCommit`、`turnSummaryCommit`、`createRunDemo`、`demo`、`footerMenuText`、`footerPromptLayout`、`footerStatuslinePolicy`、`footerPanelLayout`、`toolView`、`normalizeTool` → [tui/mini](modules/tui/mini.md)
- `Prompt`、`PromptProps`、`PromptRef`、`Autocomplete`、`PromptMetadataRow`、`usePromptMove`、`saveDraft`、`takeDraft`、`appendToSessionPrompt`、`registerComposer`、`MAX_LOCAL_ATTACHMENT_BYTES`、`normalizePastedFilepath`、`parsePastedFilepaths`、`promptFilesForServer`、`readLocalAttachment`、`normalizePromptContent`、`expandTrackedPastedText`、`expandPastedTextPlaceholders`、`parseSlashHead`、`parseFileLineRange`、`stripFileLineRange`、`promptOffsetIndex`、`mentionTriggerIndex`、`slashTriggerIndex`、`computePromptTraits`、`projectedPromptInput`、`restoredPromptInput`、`realignPromptMentions`、`deduplicatePromptImages`、`deduplicateVisibleImages`、`preserveMentionlessPromptAttachments`、`promptAttachmentLabel`、`usePromptRestore`、`MAX_FRECENCY_ENTRIES`、`parseFrecency`、`MAX_STASH_ENTRIES`、`parsePromptStash`、`parsePromptHistory`、`parsePromptInfo`、`appendPrompt`、`emptyPrompt`、`directoryAutocompleteExactValue`、`directoryAutocompleteMatches`、`slashArgumentAutocomplete`、`useDirectoryRecents`、`createSimpleContext`、`createStorage`、`useStorage`、`useStorageOptional`、`useEvent`、`usePathFormatter`、`createPanelState`、`EditorSelection`、`EditorIntegration`、`TuiPaths`、`useTuiPaths`、`InteractivityProvider`、`resolveInteractivity`、`programStatusReports`、`createProgramStatus`、`Composer`、`useComposerTab`、`ShellTab`、`TerminalsTab`、`SubagentsTab` → [tui/prompt-editor](modules/tui/prompt-editor.md)
- `Home`、`Session`、`useRouteData`、`Route`、`HomeRoute`、`SessionRoute`、`PluginRoute`、`Keymap`、`COMMAND_PALETTE_COMMAND`、`Slot`、`SessionFrame`、`Sidebar`、`Composer`、`SessionGroupView`、`PermissionPrompt`、`FormPrompt`、`createSessionRows`、`sessionRowID`、`createTimelineAnchors`、`rowWeight`、`rowsBefore`、`rowsAfter`、`createHistoryPrepend`、`findMessageBoundary`、`generateThinkingSyntax`、`activitySummary`、`openSessionTab`、`closeSessionTab`、`reopenSessionTab`、`adaptiveSessionTabLayout`、`SESSION_TAB_MAX_WIDTH` → [tui/routes-shell](modules/tui/routes-shell.md)
- `ThemeDocument`、`ThemeDefinition`、`ModeDefinition`、`BaseThemeDefinition`、`ThemeTokensDefinition`、`DialogTokensDefinition`、`TextDefinition`、`BackgroundDefinition`、`SyntaxDefinition`、`MarkdownDefinition`、`MarkdownToken`、`SyntaxToken`、`HueStep`、`HueName`、`HueDefinition`、`CategoricalDefinition`、`ActionState`、`ActionVariant`、`FeedbackKind`、`FormfieldState`、`SurfaceName`、`StatefulColorDefinition`、`parseThemeDocument`、`resolveThemeDocument`、`resolveTheme`、`selectTheme`、`selectThemeMode`、`supportsThemeMode`、`themeModes`、`expandTheme`、`migrateV1`、`migrateV1NewDesigns`、`generateSyntax`、`rgbToOklch`、`themeDecodeError`、`ResolvedTheme`、`ResolvedThemeTokens`、`DEFAULT_THEMES`、`allThemes`、`hasTheme`、`isThemeSource`、`parseTheme`、`setCustomThemes`、`setSystemTheme`、`subscribeThemes`、`getOpenCodeTheme`、`getOpenCode2Theme`、`resolveThemeColors`、`generateSystem`、`terminalMode`、`ansiToRgba`、`tint`、`createComponentTheme`、`ComponentTheme`、`discoverThemes`、`ThemeError`、`ThemeSource`、`createThemeSource`、`createSyntaxStyleMemo`、`useTheme`、`useThemes`、`ThemeContextProvider`、`Config`、`Info`、`Interface`、`Cursor`、`Plugin`、`DiffSource`、`MiniWorkSpinner`、`AttentionSoundName`、`AttentionSoundPaths`、`resolve`、`useConfig`、`useCursorStyle`、`useNewDesigns`、`useClientMcpExperiment`、`TuiKeybind`、`Definitions`、`LeaderDefault`、`KeybindOverrides`、`BindingValueSchema`、`bindingDefaults`、`defaultValue`、`parse`、`toBindingConfig`、`unknownKeys`、`BindingLookupView`、`CommandMap` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `stringWidth`、`collapseToolOutput`、`collapseShellOutput`、`configDirectories`、`projectConfigDirectories`、`localProjectDirectory`、`hasConnectedProvider`、`createDelayedPresence`、`splitPatchHunks`、`splitAddedPatch`、`errorDetails`、`cliErrorMessage`、`errorFormat`、`errorMessage`、`filetype`、`formRows`、`formInitialValues`、`formValidateValue`、`decide`、`claim`、`titlecase`、`truncate`、`truncateWidth`、`graphemes`、`marqueeText`、`marqueeOverflows`、`createMediaCache`、`parse`、`formatRef`、`switchLabel`、`abbreviateHome`、`formatPath`、`normalizePath`、`permissionPresentation`、`readJson`、`writeJsonAtomic`、`epilogue`、`projectName`、`isRecord`、`setTerminalTitle`、`destroyRenderer`、`getScrollAcceleration`、`CustomSpeedScroll`、`copy`、`copyOnSelectRelease`、`handleSelectionKey`、`sessionFamily`、`contextUsage`、`formatContextUsage`、`createDebouncedSignal`、`createFadeIn`、`createSingleFlight`、`describeOS`、`describeTerminal`、`parseTodos`、`todoMarker`、`sessionTodos`、`canonicalToolName`、`toolDisplayMetadata`、`toolDisplayContent`、`executeCalls`、`webSearchProviderLabel`、`servedByConsole`、`usageLevel`、`formatDollars`、`formatReset`、`goLimitName`、`limitScope`、`safeWatch`、`register`、`data`、`createTuiAttention`、`createTuiClipboard`、`createClipboardAdapter`、`openEditor`、`discoverEditorConnection`、`editorIntegration`、`resolveZedSelection`、`resolveZedDbPath`、`logo`、`go`、`modelPreferenceKey`、`recentModels`、`favoriteModels`、`cycleModelVariant`、`normalizeModelVariant`、`createModelPreferenceRepository`、`decodeModelPreference` → [tui/util-runtime](modules/tui/util-runtime.md)
- `Teardown`、`Observability`、`HttpRecorder`、`encode`、`pending` → [util-runtime/misc](modules/util-runtime/misc.md)

## 覆盖率

| 目录 | 源文件 | 未归属 |
| --- | --- | --- |
| `packages/util` | 43 | 0 |
| `packages/tui` | 297 | 0 |
| `packages/theme` | 11 | 0 |
| `packages/server` | 59 | 0 |
| `packages/sdk` | 12 | 0 |
| `packages/schema` | 107 | 0 |
| `packages/protocol` | 43 | 0 |
| `packages/plugin` | 64 | 0 |
| `packages/patchmark` | 8 | 0 |
| `packages/merman` | 62 | 0 |
| `packages/latex` | 8 | 0 |
| `packages/httpapi-codegen` | 1 | 0 |
| `packages/http-recorder` | 14 | 0 |
| `packages/function` | 3 | 0 |
| `packages/core` | 487 | 0 |
| `packages/codemode` | 105 | 0 |
| `packages/client` | 28 | 0 |
| `packages/cli` | 85 | 0 |
| `packages/ai` | 247 | 0 |

