# opencode 模块检索索引

> 由 build.ts 生成，不要手改。卡片正文在 modules/ 下，机器事实在 _generated/ 下。
>
> 卡片数 75；源文件覆盖 4419/4419。检索顺序：本索引 → 1~3 张卡 → 卡内坐标。

## L0 骨架层（进程 / 契约 / 存储）

- [contracts/config-flag](modules/contracts/config-flag.md) — 配置与 feature flag ｜ 配置、config、opencode.jsonc、flag、feature flag、实验开关、managed policy
- [contracts/events-db](modules/contracts/events-db.md) — 事件总线与持久化 ｜ 事件、bus、持久化、sqlite、drizzle、投影、迁移、sequence
- [contracts/httpapi-protocol](modules/contracts/httpapi-protocol.md) — 协议与 HttpApi ｜ HttpApi、protocol、openapi、端点、handler、sdk 生成、experimental
- [core/location-instance](modules/core/location-instance.md) — Location / Instance 作用域 ｜ Location、Instance、作用域、workspace、project、多目录、服务图
- [runtime/process-lifecycle](modules/runtime/process-lifecycle.md) — 进程与生命周期 ｜ 进程、启动、关闭、SIGTERM、后台服务、service、端口、mini
- [schema/core-model](modules/schema/core-model.md) — 共享数据模型（Schema 顶层契约） ｜ schema、数据模型、契约、Schema.Class、identifier、brand、事件定义、依赖方向

## L1 核心能力（会话 / 工具 / 权限 / 模型 / 插件）

- [ai/routing](modules/ai/routing.md) — 请求路由（Route/LLMClient/HttpClient） ｜ 路由、route、请求、HttpClient、重试、压缩、compact、中间件、超时
- [app/composer](modules/app/composer.md) — 输入区与新建会话（附件、@ 引用、模型选择、发送） ｜ 输入框、composer、附件、粘贴图片、@ 引用、slash 命令、模型选择、agent、发送、steer、队列、新建会话、worktree
- [app/home](modules/app/home.md) — 首页（工作区选择、最近会话、新建会话与空态） ｜ 首页、home、工作区、项目选择、最近会话、recent sessions、新建会话、空态、会话搜索、分组、today、长按、重命名、归档、ScrollView、命令面板
- [app/providers-usage](modules/app/providers-usage.md) — 模型供应商目录、连接流程、用量面板与组件实验室 ｜ provider、供应商、模型选择、model picker、variant、连接、connect、API key、登录、MCP、usage、用量、预算、budget、Console、Go 额度、components lab、组件实验室、storybook、knobs
- [app/runtime](modules/app/runtime.md) — 前端运行时（server 连接、持久化、插件宿主） ｜ 运行时、server 连接、重连、事件订阅、SSE、持久化、localStorage、状态机、GUI 插件、请求队列
- [app/session-chat](modules/app/session-chat.md) — 会话视图（时间线、虚拟化、请求 dock） ｜ 会话、session、时间线、虚拟化、滚动、流式、权限、提问、steer、队列、路由、反转
- [app/shell](modules/app/shell.md) — 应用外壳（布局、标签页、命令面板与通知） ｜ 外壳、shell、布局、titlebar、标签页、tabs、命令面板、palette、keybind、通知、toast、inbox、侧栏、sidebar、面板动效、错误页、路由
- [app/workspaces-servers](modules/app/workspaces-servers.md) — 多工作区与多服务器（Location 上下文、server 注册表、连接态） ｜ 工作区、workspace、worktree、项目、Location、多服务器、server 注册表、连接态、配对、目录选择
- [cli/acp-bridge](modules/cli/acp-bridge.md) — ACP 桥（Agent Client Protocol） ｜ acp、agent client protocol、编辑器集成、stdio、ndjson、会话桥、权限转发
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
- [desktop/main](modules/desktop/main.md) — 桌面主进程（Electron main） ｜ Electron、主进程、窗口、IPC、MessagePort、侧车、--service、深链、原生菜单、单实例锁、sqlite
- [desktop/renderer](modules/desktop/renderer.md) — 桌面渲染进程、preload 与共享 IPC 契约 ｜ 渲染进程、preload、contextBridge、contextIsolation、MessagePort、RPC、IPC 契约、启动状态机、多窗口、深链
- [protocol/codegen](modules/protocol/codegen.md) — HttpApi 代码生成（client / SDK / OpenAPI） ｜ codegen、代码生成、HttpApi、OpenAPI、生成物、generate、提交约定、prettier
- [server/auth-pairing](modules/server/auth-pairing.md) — 认证、配对与安全头 ｜ 认证、密码、basic auth、会话 cookie、配对、pairing、CORS、安全头、CSP、401
- [server/event-feed](modules/server/event-feed.md) — 事件流（SSE）、请求追踪与服务状态 ｜ sse、event feed、事件流、断线重连、服务状态、就绪、trace、server info、端口
- [server/http-handlers](modules/server/http-handlers.md) — HTTP handler 实现层 ｜ handler、HttpApiBuilder、端点、请求校验、错误映射、文件下载、Range、websocket、ticket、文件上传
- [session-ui/timeline-message](modules/session-ui/timeline-message.md) — 消息时间线与 markdown/diff 渲染管线 ｜ 时间线、timeline、消息、message、markdown、流式、代码高亮、diff、pierre、虚拟化、行评论、投影
- [session-ui/tool-renderers](modules/session-ui/tool-renderers.md) — 工具调用渲染约定与来源卡片 ｜ 工具调用、tool renderer、ToolRegistry、BasicTool、分组、错误卡、shell 输出、subagent、来源、sources、v2、新增工具
- [stats/usage](modules/stats/usage.md) — 使用统计与成本归属（stats） ｜ 使用统计、成本、token、聚合、R2 SQL、PlanetScale、Workflow、留存、排行榜、灰度
- [tui/components](modules/tui/components.md) — TUI 组件层与 OpenTUI 渲染约束 ｜ 组件、OpenTUI、渲染器、Renderable、对话框、toast、spinner、主题 token、动画、布局、实验开关
- [tui/prompt-editor](modules/tui/prompt-editor.md) — 输入框、编辑器与提交（steer / queue） ｜ 输入框、prompt、提交、steer、queue、粘贴、附件、mention、slash、编辑器、草稿、历史
- [tui/routes-shell](modules/tui/routes-shell.md) — TUI 路由与外壳 ｜ TUI、路由、页面栈、会话、快捷键、keymap、标签页、滚动、虚拟化、挂载预算
- [tui/theme-keybinds](modules/tui/theme-keybinds.md) — 主题 token 与 keybind 配置 ｜ 主题、theme、token、亮暗、自定义主题、回退、keybind、快捷键配置、leader、config
- [tui/util-runtime](modules/tui/util-runtime.md) — TUI 运行时工具（宽度/格式化、剪贴板、提示音、外部编辑器、模型偏好、parsers） ｜ 工具函数、util、string-width、宽度、locale、剪贴板、clipboard、提示音、attention、通知、编辑器、EDITOR、Zed、模型偏好、model preference、parsers、tree-sitter、devtools、bun、node

## L2 能力面（客户端 / 界面 / 扩展 / 周边）

- [ai/generation-media](modules/ai/generation-media.md) — 生成句柄与媒体（图像/媒体资产）入口 ｜ 生成、generation、轮询、图像、媒体、asset、流式、promise、effect、一致性
- [ai/protocols](modules/ai/protocols.md) — 协议适配层（聊天/图像/语音/转写/视频/决策） ｜ 协议、protocol、流式、SSE、事件映射、终止事件、usage、tool-call、错误形状
- [ai/providers](modules/ai/providers.md) — Provider 实现与模型工厂 ｜ provider、厂商、模型工厂、鉴权、baseURL、能力、兼容性、models.dev、透传
- [app/settings](modules/app/settings.md) — 设置页（客户端偏好、provider 与模型凭据） ｜ 设置、settings、偏好、字体、主题、keybind、provider、凭据、模型可见性、搜索、页面路由
- [app/voice](modules/app/voice.md) — 语音通话（录音 → 实时转写 → 委派工具 → 提交到会话） ｜ 语音、voice、WebRTC、麦克风、转写、委派、voice delegation、Live、工具调用、steer
- [cli/services-updater](modules/cli/services-updater.md) — 自更新与服务周边（updater / standalone / web-ui / tunnel） ｜ 自更新、updater、upgrade、版本检查、安装方式、standalone、web ui、远程隧道、端口占用、硬链接
- [core/media-format](modules/core/media-format.md) — 格式化、图像与渲染适配 ｜ formatter、格式化、prettier、lsp、图像、缩放、photon、latex、mermaid、markdown、渲染、终端
- [core/skill-system](modules/core/skill-system.md) — 技能系统（SKILL.md 发现与注入） ｜ skill、技能、SKILL.md、提示词、发现、catalog、autoinvoke
- [gui/aux-panels](modules/gui/aux-panels.md) — 小型内置插件（goal / sources / btw） ｜ goal、目标、composer、pill、sources、来源、引用、btw、旁问、小插件、骨架
- [gui/browser](modules/gui/browser.md) — 浏览器面板（内嵌 Chromium） ｜ 浏览器、browser、Chromium、CDP、面板、pane、tab、元素选择、网络诊断
- [gui/context](modules/gui/context.md) — 会话上下文用量 ｜ 上下文、context、token、用量、usage、费用、cost、导出、export、compaction
- [gui/debug](modules/gui/debug.md) — 调试栏与内存诊断 ｜ 调试、debug、内存、memory、heap、快照、snapshot、诊断、devtools、motion
- [gui/details](modules/gui/details.md) — 会话详情（服务/位置/MCP） ｜ 详情、details、MCP、插件、skills、配置、config、工作区、workspace、位置
- [gui/file](modules/gui/file.md) — 文件面板与文件链接 ｜ 文件、file、树、tree、预览、artifact、链接、link、打开方式、open in app
- [gui/microsoft-office](modules/gui/microsoft-office.md) — Office 文档预览（Word/Excel/PowerPoint） ｜ Office、Word、Excel、PowerPoint、docx、xlsx、pptx、worker、wasm、预览、字体
- [gui/pairing](modules/gui/pairing.md) — 设备配对与远程访问 ｜ 配对、pairing、二维码、QR、远程访问、remote、OpenTunnel、隧道、保持唤醒、设置页
- [gui/review](modules/gui/review.md) — 变更审阅（diff 面板） ｜ 审阅、review、diff、变更、changes、git、branch、turn、面板
- [gui/ssh](modules/gui/ssh.md) — SSH 远端服务接入 ｜ SSH、远端、隧道、tunnel、askpass、服务、service、remote、主机
- [gui/terminal](modules/gui/terminal.md) — 终端面板（服务端 PTY） ｜ 终端、terminal、PTY、ghostty、tab、会话、引用、quote
- [gui/updater](modules/gui/updater.md) — 应用更新与 What's New ｜ 更新、updater、升级、electron-updater、What's New、发行说明、release notes、beta、安装
- [gui/wsl](modules/gui/wsl.md) — WSL 发行版里的服务 ｜ WSL、Windows、发行版、distro、sidecar、wsl.exe、安装、服务
- [infra/misc-packages](modules/infra/misc-packages.md) — 小包与配套服务（script / figma 插件 / browser 插件 / update 服务） ｜ 发布脚本、pack、figma、browser 插件、update 服务、更新清单
- [misc/residual-modules](modules/misc/residual-modules.md) — 零散模块（session-ui 文档层 / server 启动层 / UI 动效 / textjs / 类型守卫） ｜ session-ui 文档层、server 启动、motion tuning、textjs、类型守卫、workerd
- [schema/v1-compat](modules/schema/v1-compat.md) — V1 兼容层与旧数据迁移 ｜ V1、兼容层、迁移、migration、legacy、旧库、删除时机
- [services/docs-site](modules/services/docs-site.md) — 官网与文档站（services/site） ｜ 文档、官网、opencode.ai、docs、llms.txt、站点、cloudflare worker
- [services/host](modules/services/host.md) — 独立部署服务（公开文件 files / 更新清单 update） ｜ Cloudflare Worker、R2、D1、wrangler、发布服务、更新清单、灰度、最低版本、OIDC、Range
- [tui/feature-plugins](modules/tui/feature-plugins.md) — TUI 插件体系与内置功能插件 ｜ 插件、plugin、slot、插槽、路由、热重载、storybook、内置插件、贡献点
- [tui/mini](modules/tui/mini.md) — 精简 TUI（mini） ｜ mini、精简、手机、嵌入式、分屏页脚、split-footer、scrollback、传输、SSE、队列、demo
- [ui/primitives](modules/ui/primitives.md) — 跨端 UI 基础件（@opencode/ui） ｜ UI、组件库、Solid、DOM、主题、i18n、排版、动画、状态机、storybook、组件测试
- [util-runtime/misc](modules/util-runtime/misc.md) — 基础运行时与小而散的包（util / web / stories / simulation / http-recorder …） ｜ LayerNode、app-node、Global、Teardown、observability、OTLP、flock、cassette、http-recorder、stories、simulation、vscode 扩展、Astro 文档站、品牌资产

## 按目录找

- .github/workflows → [services/host](modules/services/host.md)
- .opencode/plugins → [core/plugin-system](modules/core/plugin-system.md)
- .opencode/skills → [core/skill-system](modules/core/skill-system.md)
- infra/stats.ts → [stats/usage](modules/stats/usage.md)
- packages/ai → [ai/generation-media](modules/ai/generation-media.md)、[ai/protocols](modules/ai/protocols.md)、[ai/providers](modules/ai/providers.md)、[ai/routing](modules/ai/routing.md)、[core/provider-models](modules/core/provider-models.md)
- packages/app → [app/composer](modules/app/composer.md)、[app/home](modules/app/home.md)、[app/providers-usage](modules/app/providers-usage.md)、[app/runtime](modules/app/runtime.md)、[app/session-chat](modules/app/session-chat.md)、[app/settings](modules/app/settings.md)、[app/shell](modules/app/shell.md)、[app/voice](modules/app/voice.md)、[app/workspaces-servers](modules/app/workspaces-servers.md)、[misc/residual-modules](modules/misc/residual-modules.md)
- packages/cli → [cli/acp-bridge](modules/cli/acp-bridge.md)、[cli/commands](modules/cli/commands.md)、[cli/host-glue](modules/cli/host-glue.md)、[cli/services-updater](modules/cli/services-updater.md)、[runtime/process-lifecycle](modules/runtime/process-lifecycle.md)、[tui/mini](modules/tui/mini.md)
- packages/client → [client/sdk-transports](modules/client/sdk-transports.md)、[contracts/httpapi-protocol](modules/contracts/httpapi-protocol.md)、[protocol/codegen](modules/protocol/codegen.md)
- packages/codemode → [codemode/runtime](modules/codemode/runtime.md)、[codemode/tool-surface](modules/codemode/tool-surface.md)
- packages/core → [contracts/config-flag](modules/contracts/config-flag.md)、[contracts/events-db](modules/contracts/events-db.md)、[core/background-jobs](modules/core/background-jobs.md)、[core/core-facades](modules/core/core-facades.md)、[core/credential-oauth](modules/core/credential-oauth.md)、[core/location-instance](modules/core/location-instance.md)、[core/mcp-integration](modules/core/mcp-integration.md)、[core/media-format](modules/core/media-format.md)、[core/permission-policy](modules/core/permission-policy.md)、[core/platform-foundations](modules/core/platform-foundations.md)、[core/plugin-system](modules/core/plugin-system.md)、[core/provider-models](modules/core/provider-models.md)、[core/pty-shell-worktree](modules/core/pty-shell-worktree.md)、[core/session-execution](modules/core/session-execution.md)、[core/skill-system](modules/core/skill-system.md)、[core/tool-registry](modules/core/tool-registry.md)、[schema/v1-compat](modules/schema/v1-compat.md)
- packages/desktop → [desktop/main](modules/desktop/main.md)、[desktop/renderer](modules/desktop/renderer.md)
- packages/function → [util-runtime/misc](modules/util-runtime/misc.md)
- packages/gui-plugins → [gui/aux-panels](modules/gui/aux-panels.md)、[gui/browser](modules/gui/browser.md)、[gui/context](modules/gui/context.md)、[gui/debug](modules/gui/debug.md)、[gui/details](modules/gui/details.md)、[gui/file](modules/gui/file.md)、[gui/microsoft-office](modules/gui/microsoft-office.md)、[gui/pairing](modules/gui/pairing.md)、[gui/review](modules/gui/review.md)、[gui/ssh](modules/gui/ssh.md)、[gui/terminal](modules/gui/terminal.md)、[gui/updater](modules/gui/updater.md)、[gui/wsl](modules/gui/wsl.md)、[misc/residual-modules](modules/misc/residual-modules.md)
- packages/http-recorder → [util-runtime/misc](modules/util-runtime/misc.md)
- packages/httpapi-codegen → [contracts/httpapi-protocol](modules/contracts/httpapi-protocol.md)、[protocol/codegen](modules/protocol/codegen.md)
- packages/identity → [util-runtime/misc](modules/util-runtime/misc.md)
- packages/latex → [core/media-format](modules/core/media-format.md)
- packages/merman → [core/media-format](modules/core/media-format.md)
- packages/patchmark → [core/media-format](modules/core/media-format.md)
- packages/plugin → [core/plugin-system](modules/core/plugin-system.md)、[tui/feature-plugins](modules/tui/feature-plugins.md)
- packages/plugin-browser → [infra/misc-packages](modules/infra/misc-packages.md)
- packages/plugins → [infra/misc-packages](modules/infra/misc-packages.md)
- packages/protocol → [contracts/httpapi-protocol](modules/contracts/httpapi-protocol.md)、[protocol/codegen](modules/protocol/codegen.md)、[server/event-feed](modules/server/event-feed.md)
- packages/schema → [contracts/config-flag](modules/contracts/config-flag.md)、[contracts/events-db](modules/contracts/events-db.md)、[core/background-jobs](modules/core/background-jobs.md)、[core/credential-oauth](modules/core/credential-oauth.md)、[core/mcp-integration](modules/core/mcp-integration.md)、[core/skill-system](modules/core/skill-system.md)、[schema/core-model](modules/schema/core-model.md)、[schema/v1-compat](modules/schema/v1-compat.md)
- packages/script → [infra/misc-packages](modules/infra/misc-packages.md)
- packages/sdk → [client/sdk-transports](modules/client/sdk-transports.md)
- packages/server → [contracts/httpapi-protocol](modules/contracts/httpapi-protocol.md)、[misc/residual-modules](modules/misc/residual-modules.md)、[server/auth-pairing](modules/server/auth-pairing.md)、[server/event-feed](modules/server/event-feed.md)、[server/http-handlers](modules/server/http-handlers.md)
- packages/session-ui → [misc/residual-modules](modules/misc/residual-modules.md)、[session-ui/timeline-message](modules/session-ui/timeline-message.md)、[session-ui/tool-renderers](modules/session-ui/tool-renderers.md)
- packages/simulation → [util-runtime/misc](modules/util-runtime/misc.md)
- packages/stats → [stats/usage](modules/stats/usage.md)
- packages/stories → [ui/primitives](modules/ui/primitives.md)、[util-runtime/misc](modules/util-runtime/misc.md)
- packages/theme → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- packages/tui → [misc/residual-modules](modules/misc/residual-modules.md)、[tui/components](modules/tui/components.md)、[tui/feature-plugins](modules/tui/feature-plugins.md)、[tui/mini](modules/tui/mini.md)、[tui/prompt-editor](modules/tui/prompt-editor.md)、[tui/routes-shell](modules/tui/routes-shell.md)、[tui/theme-keybinds](modules/tui/theme-keybinds.md)、[tui/util-runtime](modules/tui/util-runtime.md)
- packages/ui → [misc/residual-modules](modules/misc/residual-modules.md)、[ui/primitives](modules/ui/primitives.md)
- packages/util → [util-runtime/misc](modules/util-runtime/misc.md)
- packages/web → [util-runtime/misc](modules/util-runtime/misc.md)
- sdks/vscode → [util-runtime/misc](modules/util-runtime/misc.md)
- services/files → [services/host](modules/services/host.md)
- services/site → [misc/residual-modules](modules/misc/residual-modules.md)、[services/docs-site](modules/services/docs-site.md)
- services/update → [infra/misc-packages](modules/infra/misc-packages.md)、[services/host](modules/services/host.md)
- sst.config.ts → [services/host](modules/services/host.md)

## 按事件找

- `credential.switched` → [core/credential-oauth](modules/core/credential-oauth.md)
- `credential.updated` → [core/credential-oauth](modules/core/credential-oauth.md)
- `DeepLinksOpened` → [desktop/main](modules/desktop/main.md)
- `DeepLinksOpened` → [desktop/renderer](modules/desktop/renderer.md)
- `experimental.ws.handshake` → [core/plugin-system](modules/core/plugin-system.md)
- `filesystem.changed` → [core/platform-foundations](modules/core/platform-foundations.md)
- `generation.completed` → [stats/usage](modules/stats/usage.md)
- `integration.updated` → [core/credential-oauth](modules/core/credential-oauth.md)
- `MenuCommandTriggered` → [desktop/main](modules/desktop/main.md)
- `MenuCommandTriggered` → [desktop/renderer](modules/desktop/renderer.md)
- `opencode:session-tabs-removed` → [app/shell](modules/app/shell.md)
- `permission.asked` → [core/permission-policy](modules/core/permission-policy.md)
- `PluginsChanged` → [desktop/main](modules/desktop/main.md)
- `PluginsChanged` → [desktop/renderer](modules/desktop/renderer.md)
- `project.updated` → [core/platform-foundations](modules/core/platform-foundations.md)
- `server.connected` → [server/event-feed](modules/server/event-feed.md)
- `session.inbox.delivered` → [contracts/events-db](modules/contracts/events-db.md)
- `session.inbox.delivered` → [core/session-execution](modules/core/session-execution.md)
- `session.inbox.enqueued` → [contracts/events-db](modules/contracts/events-db.md)
- `session.inbox.enqueued` → [core/session-execution](modules/core/session-execution.md)
- `SidecarChanged` → [desktop/main](modules/desktop/main.md)
- `SidecarChanged` → [desktop/renderer](modules/desktop/renderer.md)
- `skill.updated` → [core/skill-system](modules/core/skill-system.md)
- `StorageChanged` → [desktop/main](modules/desktop/main.md)
- `StorageChanged` → [desktop/renderer](modules/desktop/renderer.md)
- `WindowFullscreenChanged` → [desktop/main](modules/desktop/main.md)
- `WindowFullscreenChanged` → [desktop/renderer](modules/desktop/renderer.md)
- `WindowPinchZoomChanged` → [desktop/renderer](modules/desktop/renderer.md)
- `WindowZoomChanged` → [desktop/main](modules/desktop/main.md)
- `WindowZoomChanged` → [desktop/renderer](modules/desktop/renderer.md)

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
- `autoupdate` → [cli/services-updater](modules/cli/services-updater.md)
- `backgroundColor` → [desktop/main](modules/desktop/main.md)
- `bundledCliVersion` → [desktop/main](modules/desktop/main.md)
- `cors` → [server/auth-pairing](modules/server/auth-pairing.md)
- `cursor.blinking` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `cursor.style` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `DATABASE_URL` → [stats/usage](modules/stats/usage.md)
- `default.dat` → [desktop/renderer](modules/desktop/renderer.md)
- `devtools` → [tui/util-runtime](modules/tui/util-runtime.md)
- `diffs.source` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `diffs.wrap` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `events.persist` → [server/event-feed](modules/server/event-feed.md)
- `experimental` → [tui/feature-plugins](modules/tui/feature-plugins.md)
- `experimental` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `experimental.*` → [contracts/config-flag](modules/contracts/config-flag.md)
- `experimental.all_flags` → [contracts/config-flag](modules/contracts/config-flag.md)
- `experimental.schedules` → [core/background-jobs](modules/core/background-jobs.md)
- `firstLaunchOnboardingComplete` → [desktop/main](modules/desktop/main.md)
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
- `OPENCODE_TEST_HOME` → [util-runtime/misc](modules/util-runtime/misc.md)
- `opencode.global.dat` → [desktop/renderer](modules/desktop/renderer.md)
- `opencode.settings` → [desktop/main](modules/desktop/main.md)
- `opencode.window.<id>.dat` → [desktop/renderer](modules/desktop/renderer.md)
- `OTEL_EXPORTER_OTLP_ENDPOINT` → [util-runtime/misc](modules/util-runtime/misc.md)
- `OTEL_EXPORTER_OTLP_HEADERS` → [util-runtime/misc](modules/util-runtime/misc.md)
- `password` → [server/auth-pairing](modules/server/auth-pairing.md)
- `permissions` → [contracts/config-flag](modules/contracts/config-flag.md)
- `permissions` → [core/permission-policy](modules/core/permission-policy.md)
- `PLAYWRIGHT_STORIES_PORT` → [util-runtime/misc](modules/util-runtime/misc.md)
- `PLAYWRIGHT_STORIES_URL` → [util-runtime/misc](modules/util-runtime/misc.md)
- `plugins` → [tui/feature-plugins](modules/tui/feature-plugins.md)
- `providers` → [contracts/config-flag](modules/contracts/config-flag.md)
- `providers` → [core/provider-models](modules/core/provider-models.md)
- `PUBLIC_URL` → [stats/usage](modules/stats/usage.md)
- `scroll.acceleration` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `scroll.speed` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `session.new_location` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `session.permissions` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `skills` → [contracts/config-flag](modules/contracts/config-flag.md)
- `skills` → [core/skill-system](modules/core/skill-system.md)
- `StatsHiddenModels` → [stats/usage](modules/stats/usage.md)
- `StatsSyncConfig.dataset` → [stats/usage](modules/stats/usage.md)
- `tabs.indicators` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `tabs.layout` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `tabs.mode` → [cli/host-glue](modules/cli/host-glue.md)
- `tabs.mode` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `tabs.scope` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `terminal.copy` → [cli/host-glue](modules/cli/host-glue.md)
- `theme.mode` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `theme.name` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `update` → [cli/services-updater](modules/cli/services-updater.md)
- `windowIds` → [desktop/main](modules/desktop/main.md)
- `zoomLevel` → [desktop/main](modules/desktop/main.md)

## 按 HTTP 端点找

- `DELETE /api/credential/:credentialID` → [core/credential-oauth](modules/core/credential-oauth.md)
- `GET /admin` → [services/host](modules/services/host.md)
- `GET /api/<channel>/<name>/<distribution>` → [services/host](modules/services/host.md)
- `GET /api/<channel>/<name>/<distribution>/<filename>` → [services/host](modules/services/host.md)
- `GET /api/<channel>/desktop/<distribution>/latest.yml` → [services/host](modules/services/host.md)
- `GET /api/credential` → [core/credential-oauth](modules/core/credential-oauth.md)
- `GET /api/event` → [server/event-feed](modules/server/event-feed.md)
- `GET /api/event` → [server/http-handlers](modules/server/http-handlers.md)
- `GET /api/experimental/media/:hash` → [server/http-handlers](modules/server/http-handlers.md)
- `GET /api/experimental/session/:sessionID/terminal/read` → [server/http-handlers](modules/server/http-handlers.md)
- `GET /api/fs/read/*` → [server/http-handlers](modules/server/http-handlers.md)
- `GET /api/info` → [server/auth-pairing](modules/server/auth-pairing.md)
- `GET /api/info` → [server/event-feed](modules/server/event-feed.md)
- `GET /api/integration/:integrationID/connect/oauth/:attemptID` → [core/credential-oauth](modules/core/credential-oauth.md)
- `GET /api/latest` → [services/host](modules/services/host.md)
- `GET /api/pty/:ptyID/connect` → [server/http-handlers](modules/server/http-handlers.md)
- `GET /auth/connect/:code` → [server/auth-pairing](modules/server/auth-pairing.md)
- `GET /files/<key>` → [services/host](modules/services/host.md)
- `PATCH /api/credential/:credentialID` → [core/credential-oauth](modules/core/credential-oauth.md)
- `POST /admin/activate` → [services/host](modules/services/host.md)
- `POST /admin/minimum` → [services/host](modules/services/host.md)
- `POST /admin/rollout` → [services/host](modules/services/host.md)
- `POST /api/credential` → [core/credential-oauth](modules/core/credential-oauth.md)
- `POST /api/credential/:credentialID/activate` → [core/credential-oauth](modules/core/credential-oauth.md)
- `POST /api/experimental/fs/write` → [server/http-handlers](modules/server/http-handlers.md)
- `POST /api/integration/:integrationID/connect/oauth` → [core/credential-oauth](modules/core/credential-oauth.md)
- `POST /api/pair` → [server/auth-pairing](modules/server/auth-pairing.md)
- `POST /api/publish` → [services/host](modules/services/host.md)

## 按符号找

- `Generation`、`resultEvents`、`isTerminal`、`ImageModel`、`ImageEvent`、`ImageResponse`、`ImageClient`、`Asset`、`AssetSchema`、`Media`、`GenerationHandle`、`MediaModel`、`MediaClient` → [ai/generation-media](modules/ai/generation-media.md)
- `OpenAIChat`、`AnthropicMessages`、`BedrockConverse`、`CohereChat`、`AlibabaChat`、`OpenResponses`、`Gemini`、`MistralChat`、`ProviderShared`、`Lifecycle`、`ToolStream`、`BedrockEventStream` → [ai/protocols](modules/ai/protocols.md)
- `ProviderPackage`、`LanguageModel`、`LanguageModelCompatibility`、`Capabilities`、`ProviderOptions`、`mergeProviderOptions`、`bearerRouteDefaults`、`toConfig`、`OpenAIOptionsInput`、`ProviderID`、`DeepSeek`、`Anthropic` → [ai/providers](modules/ai/providers.md)
- `Route`、`LLMClient`、`RequestExecutor`、`Auth`、`Endpoint`、`Framing`、`HttpTransport`、`Protocol`、`StreamOptions`、`CompactionOperations`、`canCompact`、`compileRequest` → [ai/routing](modules/ai/routing.md)
- `Composer`、`ComposerEditor`、`createComposerModel`、`createComposerAttachments`、`buildPromptRequest`、`serializePrompt`、`promptLength`、`appendPrompt`、`parseSlashCommand`、`DEFAULT_PROMPT`、`isCommentItem`、`createComposerSubmitState`、`transitionComposerSubmit`、`transitionModelChip`、`ComposerStateTarget`、`createNewSessionStartStore`、`createNewSessionWorkspaceController`、`NEW_SESSION_WORKTREE_TIMEOUT_MS` → [app/composer](modules/app/composer.md)
- `Home`、`createHomeController`、`HomeController`、`transitionHomeSelection`、`selectHomeSelection`、`sameHomeSelection`、`createHomeProjectsController`、`createProjectActions`、`addProjects`、`transitionProjectImport`、`useRevealProject`、`createHomeSessionsController`、`createHomeSessionSearchController`、`transitionHomeSessionsLoad`、`selectHomeSessionsListView`、`homeSessionsQuery`、`loadHomeSessionIndex`、`parseHomeSessionIndex`、`mergeHomeSessionIndex`、`retainHomeSessions`、`buildHomeSessionRecords`、`homeProjectForSession`、`homeSessionLocation`、`HOME_SESSION_LIMIT`、`HOME_SESSION_PAGE_LIMIT`、`HOME_SESSION_INDEX_LIMIT`、`transitionHomeSessionRow`、`transitionHomeSessionSearch`、`createAltHold`、`archiveHomeSession`、`shouldOpenSessionInBackground`、`createHomeScrollController`、`HomeCommandPalette`、`HomeProjectsView`、`HomeSessionsView`、`HomeSessionRecord`、`fileManagerApp` → [app/home](modules/app/home.md)
- `useProviders`、`syncWhileBooting`、`popularProviders`、`useIntegrations`、`consoleProviderGroup`、`consoleCatalogLoaded`、`consoleProviderName`、`createConsoleCatalogSettler`、`transitionConsoleSettle`、`useMcpController`、`createProviderDialogController`、`transitionProviderConnect`、`transitionProviderDialog`、`transitionProviderForm`、`transitionMcp`、`DialogConnectProvider`、`DialogSelectMcp`、`DialogUsageExceeded`、`DialogSelectModel`、`ModelSelectorDrawer`、`transitionModelSelection`、`resolveModelVariant`、`cycleModelVariant`、`DialogUsage`、`UsageDialogContent`、`startUsageDialog`、`transitionUsageDialog`、`usageView`、`modelUsage`、`useUsageFormat`、`createModelUsage`、`DialogStoryRuntime`、`labEntry`、`storyMotion`、`applyMotionPatch`、`transitionLabStage`、`transitionLabBrowse`、`transitionDialogFlyout` → [app/providers-usage](modules/app/providers-usage.md)
- `createOpenCodeEventSource`、`createApiForServer`、`fileStreamUrl`、`createServerTransport`、`createServerSdkContext`、`createServerControllersState`、`transitionServerControllers`、`createServerHealthState`、`transitionServerHealth`、`transitionConnectionSync`、`createMediaCache`、`createRequestQueue`、`normalizeServerUrl`、`ServerScope`、`persisted`、`Persistence`、`flushPersisted` → [app/runtime](modules/app/runtime.md)
- `useSessionModel`、`selectSessionUserMessages`、`selectVisibleSessionUserMessages`、`MessageTimeline`、`createTimelineModel`、`createTimelineController`、`createTimelineCache`、`createTimelineVirtualizer`、`createSessionScreenLayout`、`createSessionResolution`、`sessionRouteView`、`viewedSessionID`、`createSessionQueue`、`createFollowState`、`transitionFollow`、`END_EPSILON` → [app/session-chat](modules/app/session-chat.md)
- `Settings`、`projectSettingsKey`、`monoDefault`、`sansDefault`、`terminalDefault`、`pageIcons`、`pageLabels`、`settingsViewRedirect`、`serverPagesConnection`、`canIndexServerSettings`、`canHoldProjectRoute`、`resolveServerAvailability`、`SERVER_RETRY_TIMEOUT_MS`、`createServerRetryState`、`createSettingsProvidersState`、`transitionSettingsProviders`、`createModelsRevealState`、`MODELS_REVEAL_TIMEOUT_MS`、`providerAccounts`、`activeProviderAccount` → [app/settings](modules/app/settings.md)
- `AppBaseProviders`、`AppInterface`、`preloadRoute`、`currentRoute`、`useCurrentRoute`、`layoutSchema`、`layoutPersistence`、`initialLayout`、`tabKey`、`tabHref`、`draftHref`、`sessionHref`、`createLayoutIntentState`、`transitionLayoutIntent`、`createSidebarPeek`、`transitionSidebarPeek`、`createPanelMotion`、`panelsMoving`、`SESSION_PANES`、`placeSessionTabs`、`openSessionTab`、`closeSessionTab`、`sessionTabPane`、`notifySessionTabsRemoved`、`SESSION_TABS_REMOVED_EVENT`、`createNotificationCoordinator`、`showToast`、`ToastRegion`、`playSoundById`、`createTitlebarHistory`、`transitionRouteTab`、`createRouteTabSync`、`transitionTabsHydration`、`transitionTabPromotion`、`pushClosedTab`、`takeClosedTab`、`transitionScrollPersistence`、`createScrollPersistence`、`ensureSessionKey`、`pruneSessionKeys`、`transitionScopedSession`、`canPruneSessions`、`transitionFocusLock`、`COMMAND_SEARCH_ID`、`DEFAULT_PALETTE_KEYBIND`、`matchKeybind`、`formatKeybind`、`desktopZoomLevels`、`DESKTOP_MENU`、`transitionErrorPage`、`errorDescriptionKey`、`ErrorPage`、`getRelativeTime`、`compareSessionTime`、`createTabMemory` → [app/shell](modules/app/shell.md)
- `VoiceTransport`、`VoiceFailure`、`decodeEvent`、`decodeArguments`、`liveInstructions`、`delegatorInstructions`、`version`、`formatHandoff`、`headerLapse`、`VoiceTools`、`VoiceComposer`、`createVoiceCall`、`voiceCallView`、`createVoiceTransportState`、`transitionVoiceTransport`、`createVoiceCallState`、`transitionVoiceCall` → [app/voice](modules/app/voice.md)
- `LOCATION_SYNC_RETRIES`、`LOCATION_SYNC_RETRY_DELAY`、`LOCATION_SYNC_TIMEOUT`、`createLocationSyncState`、`transitionLocationSync`、`workspaceDirectories`、`workspaceSelectionDirectories`、`managedWorkspaceDirectories`、`workspaceInventory`、`sessionsForWorkspace`、`createWorktreeInventory`、`withWorktreeInventory`、`worktreeInventoryKey`、`worktreeInventoryViewKey`、`sortServerConnections`、`useServerActionsController`、`replaceServerConnection`、`SERVER_CONNECT_TIMEOUT_MS`、`startServerConnect`、`transitionServerConnect`、`directoryPickerKind` → [app/workspaces-servers](modules/app/workspaces-servers.md)
- `ACP`、`ACPService`、`ACPConnection`、`ACPSessions`、`ACPTurn`、`ACPPermission`、`ACPElicitation`、`ACPReplay`、`ACPCapabilities`、`ACPCatalog`、`ACPClient`、`ACPError`、`ACPChild`、`ACPTranslate`、`ACPDirectories`、`ACPPrompt`、`Standalone` → [cli/acp-bridge](modules/cli/acp-bridge.md)
- `Commands`、`PrintLogs`、`Standalone`、`Server`、`Spec`、`Runtime`、`CliFlag`、`resolveOperation`、`remoteConsent`、`remoteWarning`、`createClient`、`inspect` → [cli/commands](modules/cli/commands.md)
- `Env`、`password`、`OPENCODE_VERSION`、`OPENCODE_CHANNEL`、`OPENCODE_ARTIFACT`、`OPENCODE_HIGHLIGHTS`、`OPENCODE_LOCAL`、`databasePath`、`Heap`、`CpuProfile`、`AppArchive`、`AssetMap`、`BrotliMap`、`MiniCommandInput`、`runMini`、`createMiniConnection`、`resolveMiniTarget`、`validateMiniTerminal`、`InteractiveStdin`、`INTERACTIVE_INPUT_ERROR`、`createMiniHost`、`resolveInteractiveStdin`、`usingInteractiveStdin`、`SessionTarget`、`SessionTargetMutationError`、`SessionTargetPreparation`、`resolveSessionTarget`、`createWorktreeLocation`、`findSession`、`parseSessionTargetModel`、`RunCommandInput`、`runNonInteractive`、`mergeInput`、`parseRunModel`、`reportRunError`、`runNonInteractivePrompt`、`Style`、`UI`、`println`、`TimelineHost`、`createTimelineHost`、`IntegrationChoice`、`selectIntegration`、`handlePromptErrors`、`openUrl`、`requireInteractive`、`errorMessage`、`readStdin`、`readStdinIfReady`、`selfCommand`、`NodeTarget`、`nodeTarget`、`nodeExecArgv`、`photonWasmAsset`、`attentionSoundAssets`、`Config`、`ConfigMigration`、`migrateV1`、`Info`、`SchemaURL`、`normalizeLegacyTabs`、`ShutdownDeadline`、`DEADLINE`、`askpass` → [cli/host-glue](modules/cli/host-glue.md)
- `Updater`、`Service`、`UpgradeError`、`RunResult`、`action`、`parseReleaseVersion`、`decodePolicy`、`methods`、`UpdatePreflight`、`Handle`、`RetainedImage`、`retain`、`relocate`、`installed`、`Standalone`、`start`、`WebUi`、`handler`、`PortOwner`、`describe`、`RemoteTunnel`、`ensure`、`hostname`、`ServiceRegistration`、`register`、`ServerConnection`、`resolve`、`Resolved`、`Args` → [cli/services-updater](modules/cli/services-updater.md)
- `OpenCode`、`make`、`Service`、`discover`、`incumbent`、`ensure`、`stop`、`Info`、`SharedEvents`、`createData`、`Data`、`createClientConnection`、`defaultIdleTimeout`、`createPersistentPtyClient`、`decodePersistentPtyMessage`、`createSessionRetention`、`lastAssistantWithUsage`、`EmbeddedHost`、`SdkInstances`、`WorkerdProfile`、`PromiseSdk`、`Interface`、`layer`、`create` → [client/sdk-transports](modules/client/sdk-transports.md)
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
- `Ipc`、`IpcPortHandoff`、`emitIpcEvent`、`setIpcEventSink`、`DesktopStorage`、`ApplicationLifecycle`、`BackgroundService`、`DesktopCli`、`SidecarCredentials`、`Plugins`、`DeepLinks`、`Shutdown`、`mainWindows`、`getMainWindows`、`getWindowID`、`registerRendererScheme`、`isRendererUrl`、`windowAppearance`、`wireNavigationPolicy`、`wireRendererHeaders`、`createWindowRegistry`、`startSidecarProbe`、`cleanStages`、`serviceVersion`、`getStore`、`openDatabase`、`configureApplication`、`acquireApplicationLock`、`createMenu`、`setMenubarProvider`、`runDesktopMenuAction`、`windowBootstrap`、`marks`、`CHANNEL`、`DesktopPaths`、`nativeT`、`createHost`、`createEmbeds`、`preventsQuit`、`restoresWindows` → [desktop/main](modules/desktop/main.md)
- `api`、`DesktopApp`、`ElectronAPI`、`ElectronNative`、`createDesktopPlatform`、`startDesktopMenu`、`bindDesktopMenu`、`startDeepLinks`、`requireRendererRoot`、`desktopVersion`、`DesktopMemoryRouter`、`getLastActiveUrl`、`setLastActiveUrl`、`createDesktopFiles`、`createDesktopNotify`、`createDesktopStorage`、`createPluginBridge`、`createIpcClientState`、`transitionIpcClient`、`invoke`、`listen`、`send`、`DesktopRpcs`、`DesktopRpcClient`、`AppRpcs`、`StorageRpcs`、`PluginRpcs`、`WindowRpcs`、`DesktopEvents`、`DesktopEvent`、`SidecarChanged`、`StorageChanged`、`DeepLinksOpened`、`MenuCommandTriggered`、`IpcTransportPort`、`WindowSnapshotChannel`、`DragCancelEvent`、`omitUndefined`、`storageSnapshotNames`、`windowDataFile`、`WindowBootstrap`、`windowBootstrapArgument`、`windowBootstrapFromArguments` → [desktop/renderer](modules/desktop/renderer.md)
- `builtins`、`createGoalState`、`transitionGoal`、`selectGoal`、`selectGoalBusy`、`GOAL_SNAPSHOT_TIMEOUT_MS`、`GOAL_COMMAND_TIMEOUT_MS`、`GoalAction`、`GoalEntry`、`createBtw`、`BtwModel`、`createBtwState`、`transitionBtw`、`btwTabView`、`btwChatView`、`BTW_GENERATE_TIMEOUT_MS`、`BtwFailure`、`BtwSavedChat` → [gui/aux-panels](modules/gui/aux-panels.md)
- `BrowserPane`、`PaneEvent`、`PaneElement`、`PaneCloseReason`、`MAX_ICON_URL`、`createBrowserPane`、`createBrowserPage`、`createCdp`、`normalizeURL`、`fileURLWithin`、`RefsStore`、`History`、`remember`、`createModel`、`transition`、`createPaneState`、`selectInventory`、`MAX_RETAINED_REQUESTS` → [gui/browser](modules/gui/browser.md)
- `syncCatalog`、`catalogModel`、`createSessionContextFormatter`、`sessionExportFilename`、`EXPORT_REQUEST_TIMEOUT_MS`、`CATALOG_LOAD_TIMEOUT_MS`、`createSessionExportState`、`transitionSessionExport`、`selectSessionExporting`、`createContextScrollState`、`transitionContextScroll`、`createCatalogState`、`transitionCatalog`、`SessionExportData` → [gui/context](modules/gui/context.md)
- `HeapSnapshots`、`MemoryDiagnostics`、`createHeapCaptureState`、`transitionHeapCapture`、`createHeapCommandState`、`transitionHeapCommand`、`isHeapCommandEnabled`、`createMemoryDiagnosticsState`、`transitionMemoryDiagnostics`、`isMemoryDiagnosticsOn`、`isRendererProbing`、`debugBarView`、`DebugBarVisibility`、`memoryLogFile`、`traceConfig`、`summarize`、`RendererMemory`、`memoryRecord`、`debugBuild`、`memoryLogInterval`、`createMotionState`、`transitionMotion`、`selectMotionWide`、`MOTION_WIDE_AT`、`initialFocusToggleState`、`transitionFocusToggle`、`snapshotDirectory`、`signalIncludesServer`、`ServerSnapshot` → [gui/debug](modules/gui/debug.md)
- `serviceConfigFile`、`globalConfigDirectory`、`workspaceDirectories`、`WorkspaceProject`、`transitionMcp`、`mcpRowView`、`mcpDialogView`、`MCP_TOGGLE_TIMEOUT_MS`、`McpServerStatus`、`transitionFlyout`、`flyoutActive`、`flyoutPane`、`flyoutAnchor`、`createFlyoutMotion`、`transitionConfigAction`、`configActionView`、`CONFIG_ACTION_TIMEOUT_MS`、`transitionDetailsPopover`、`detailsPopoverOpen`、`detailsPopoverFocusesContent`、`transitionServiceLoad`、`serviceLoadView`、`SERVICE_LOAD_TIMEOUT_MS`、`createWorkspaceMoveState`、`transitionWorkspaceMove`、`workspaceMenuView`、`workspaceDialogView`、`WORKSPACE_MOVE_TIMEOUT_MS`、`WORKSPACE_CREATE_TIMEOUT_MS` → [gui/details](modules/gui/details.md)
- `OpenAppPreferences`、`OpenApp`、`FileContext`、`FileShared`、`useShared`、`createArtifactViewerState`、`transitionArtifactViewer`、`selectArtifactMode`、`selectArtifactPreviewable`、`transitionImageStageGesture`、`transitionVideoOverlay`、`createLinkExistsState`、`transitionLinkExists`、`linkExistsAnswer`、`createLinkOpenState`、`transitionLinkOpen`、`createOpenInAppState`、`transitionOpenInApp`、`createPickerState`、`transitionPicker`、`pickerFilterText`、`createPierreTreeState`、`transitionPierreTree`、`buildLiveTreeInput`、`buildAllowedTreeInput`、`FILE_TREE_ROW_HEIGHT`、`normalizeFileTreeV2Path`、`fileTabId`、`fileTabPath`、`isFileTab`、`pathToFileUrl`、`workspaceFileUrl`、`resolveOpenInAppPath`、`parseFileLink`、`resolveArtifactPath`、`parseDelimited`、`splitFrontmatter`、`startFileDrag`、`FILE_SEARCH_TIMEOUT_MS`、`LINK_EXISTS_TIMEOUT_MS` → [gui/file](modules/gui/file.md)
- `wordFonts`、`presentationFace`、`scriptFace`、`loadFace`、`CJK_FONT_ASSET_URLS`、`externalUrl`、`wordLink`、`createOfficeWorker`、`WorkerClient`、`OfficeOpened`、`paper`、`maxImageSide`、`lineHeight`、`layerFont`、`headerHeight`、`transitionOfficePages`、`pagesList`、`pagesScale`、`pagesZoom`、`pageFit`、`columnName`、`parseRange`、`anchorRange`、`coverMerges`、`parseSpans`、`contains`、`drawFrame`、`paintFrame`、`paintCells`、`paintHeaders`、`shiftGrid`、`transitionSheetFrame`、`transitionSheetPick`、`transitionSheetPointer`、`transitionSlideFonts`、`selectDeckFontRequests`、`transitionSlidePaint`、`transitionVectorRaster`、`createWordLayoutState`、`transitionWordLayout`、`wordLayoutPages`、`transitionWordPaint`、`pageText`、`deckText`、`withoutMedia`、`createBitmapImageResolver`、`transitionWorker`、`workerLoading`、`createWorkerClient`、`serveWorker`、`movableBuffer`、`SupersededError`、`WorkerClosedError`、`AbortedError`、`transitionWorkerRpcClient`、`transitionWorkerRpcServer` → [gui/microsoft-office](modules/gui/microsoft-office.md)
- `Pairing`、`createPairingState`、`transitionPairing`、`pairingEffectFailed`、`viewPairingPage`、`viewDialog`、`dialogUrl`、`remainingSeconds`、`createDispatch`、`createCopyState`、`transitionCopy`、`copyEffectFailed`、`viewCopy`、`COPY_FEEDBACK_MS`、`COPY_TIMEOUT_MS`、`createPairingMainState`、`transitionPairingMain`、`selectBlocker`、`pairingMainEffectFailed`、`SERVICE_READ_TIMEOUT_MS`、`SERVICE_SET_TIMEOUT_MS`、`SERVICE_START_TIMEOUT_MS`、`remoteAddress`、`REMOTE_READ_TIMEOUT_MS`、`REMOTE_READ_RETRIES`、`REMOTE_CHANGE_TIMEOUT_MS`、`TUNNEL_RETRIES`、`TUNNEL_RETRY_DELAY_MS`、`TUNNEL_TIMEOUT_MS`、`CODE_TIMEOUT_MS`、`SCREEN_TIMEOUT_MS` → [gui/pairing](modules/gui/pairing.md)
- `ReviewDetails`、`ReviewDetailsView`、`ReviewDetailsFailure`、`createReviewModel`、`ChangeMode`、`Demand`、`ReviewModel`、`transitionReviewDiff`、`reviewDiffView`、`reviewDiffReady`、`transitionReviewFolders`、`reviewExpandedDiffs`、`reviewFolderCandidates`、`transitionReviewDetail`、`reviewDetailView`、`transitionReviewScreen`、`reviewScreenModel`、`reviewScreenDemand`、`transitionReviewScroll`、`transitionReviewRender`、`reviewPanelReady`、`createReviewInitGitState`、`transitionReviewInitGit`、`normalizePath`、`filterRenderableDiff`、`reviewDiffNeedsLoad`、`reviewDiffKinds`、`expandReviewFolders`、`filterReviewFiles`、`REVIEW_DIFF_TIMEOUT_MS`、`REVIEW_SCROLL_MAX_FRAMES` → [gui/review](modules/gui/review.md)
- `Ssh`、`SshConfig`、`SshHttp`、`SshItem`、`SshStage`、`SshError`、`SshPrompt`、`SshStart`、`SshState`、`createSshController`、`createSshMainState`、`selectSshServers`、`transitionSshMain`、`createSshWindowState`、`transitionSshWindow`、`parseRegistration`、`discoverScript`、`binaryPath`、`parseTarget`、`sshArgs`、`tunnelArgs`、`quote`、`runSsh`、`createAskpass`、`sshName`、`SSH_RETRY_LIMIT` → [gui/ssh](modules/gui/ssh.md)
- `terminalToggleCommand`、`createTerminalModel`、`TerminalModel`、`TerminalSession`、`initialState`、`transition`、`serverAvailable`、`sessionView`、`tabHidden`、`tabTargetable`、`createConnectionState`、`transitionConnection`、`canAcceptOutput`、`transitionPane`、`paneRevealed`、`createPaneDispatch`、`createDispatch`、`terminalTabLabel`、`defaultTitle`、`titleNumber`、`terminalWriter`、`createQuoteState`、`transitionQuote`、`createQuoteDispatch`、`transitionRename`、`initialSurfaceState`、`terminalKeyInput`、`TERMINAL_REQUEST_TIMEOUT_MS`、`GHOSTTY_LOAD_TIMEOUT_MS`、`TERMINAL_CONNECT_TIMEOUT_MS`、`TERMINAL_SIZE_DEBOUNCE_MS` → [gui/terminal](modules/gui/terminal.md)
- `make`、`initUpdaterMachine`、`transitionUpdater`、`toUpdaterState`、`UpdateTarget`、`Platform`、`Dependencies`、`UpdaterMachineState`、`updaterAction`、`initWhatsNew`、`transitionWhatsNew`、`whatsNewLoading`、`WHATS_NEW_TIMEOUT_MS`、`ACTION_CHUNK_TIMEOUT_MS`、`initialWindowUpdater`、`transitionWindowUpdater`、`initialWebUpdate`、`transitionWebUpdate`、`webUpdateAction`、`webUpdatePending`、`AUTO_CHECK_SPACING_MS`、`CHECK_TIMEOUT_MS`、`startWebUpdater`、`decodeEmbeddedNotes`、`sliceBetaNotes`、`allBetaNotes`、`betaBuild`、`betaHistory`、`visualSource`、`logContext` → [gui/updater](modules/gui/updater.md)
- `Wsl`、`WslServersState`、`WslServerItem`、`WslServerConfig`、`WslServerRuntime`、`WslDistroJob`、`WslRuntimeCheck`、`WslInstalledDistro`、`WslOnlineDistro`、`WslDistroProbe`、`WslOpencodeCheck`、`createWslRuntime`、`wslArgs`、`wslCliInstallCommand`、`shellEscape`、`summarize`、`createWslServersController`、`wslServerIdForDistro`、`createWslMachineState`、`transitionWslMachine`、`toServersState`、`addServerViewModel`、`addServerProbePlan`、`createWslDialogState`、`transitionWslDialog` → [gui/wsl](modules/gui/wsl.md)
- `pack`、`BrowserTools`、`BrowserConnection` → [infra/misc-packages](modules/infra/misc-packages.md)
- `SessionUserActions`、`SessionDocument`、`FilePartSource`、`PresentationFileDiff`、`ServerOptions`、`ServerFetch`、`ServerWorkerd`、`wantsMediaRefs`、`motionPresets`、`MotionPreset`、`SimulationSemantics`、`iconNamesMatch` → [misc/residual-modules](modules/misc/residual-modules.md)
- `compile`、`emitEffect`、`emitEffectImported`、`emitEffectShape`、`emitPromise`、`write`、`generate`、`GenerationError`、`Contract`、`Output`、`Alias`、`stabilizeOpenApi` → [protocol/codegen](modules/protocol/codegen.md)
- `ServerProcess`、`ShutdownDeadline`、`ServiceConfig`、`PortOwner`、`ServerConnection`、`RemoteTunnel`、`RetainedImage`、`WebUi`、`ServiceRegistration` → [runtime/process-lifecycle](modules/runtime/process-lifecycle.md)
- `Identifier`、`ascending`、`descending`、`SessionID`、`ProjectID`、`WorkspaceID`、`AbsolutePath`、`RelativePath`、`optional`、`statics`、`withStatics`、`DateTimeUtcFromMillis`、`Event`、`durable`、`ephemeral`、`inventory`、`latest`、`versionedType`、`durableMap`、`Location`、`Permission`、`Tool`、`Session`、`SessionMessage`、`Prompt`、`PromptInput` → [schema/core-model](modules/schema/core-model.md)
- `SessionV1`、`PermissionV1`、`FileSystemV1`、`LegacyEventV1`、`ConfigAgentV1`、`ConfigCommandV1`、`ConfigMCPV1`、`ConfigPermissionV1`、`ConfigPluginV1`、`ConfigProviderV1`、`ConfigMigrateV1`、`normalizeAction`、`migrateAgent`、`V1Migration`、`transformSession`、`SourceMessage`、`Status`、`Warning` → [schema/v1-compat](modules/schema/v1-compat.md)
- `ServerAuth`、`ServerPairing`、`ContentHeaders`、`CONTENT_SECURITY_POLICY`、`disposition`、`CorsConfig`、`isAllowedCorsOrigin`、`isAllowedRequestOrigin`、`RequestSite`、`rejected`、`authorizationLayer`、`authorizedRequest`、`unauthorizedResponse`、`schemaErrorLayer`、`SessionLocationMiddleware`、`FormLocationMiddleware`、`sessionLocationLayer`、`formLocationLayer`、`SESSION_TTL_SECONDS`、`issueSession`、`verifySession`、`sessionCookieName`、`authorized`、`required`、`ServerProcess` → [server/auth-pairing](modules/server/auth-pairing.md)
- `EventFeed`、`SubscriberCapacity`、`SubscriberOverflowError`、`EncodingError`、`frame`、`make`、`Service`、`layer`、`withoutParentSpan`、`Status`、`ServerInfo`、`connectionURLs`、`EventGroup`、`isOpenCodeEvent`、`OpenCodeEvent` → [server/event-feed](modules/server/event-feed.md)
- `handlers`、`FileSystemHandler`、`SessionHandler`、`EventHandler`、`ConfigHandler`、`PtyHandler`、`McpHandler`、`makeMediaGet`、`makeArtifact`、`makeSchedule`、`makeJob`、`runPtySocket`、`holdLocation`、`missingSession`、`failedSnapshot`、`response`、`locationErrors`、`sessionInfo`、`LocationMiddleware` → [server/http-handlers](modules/server/http-handlers.md)
- `mediaUrl`、`sitemapFiles`、`sitemapExclusions`、`track`、`docsRoute`、`docsUrl`、`docsBase` → [services/docs-site](modules/services/docs-site.md)
- `validGitHubClaims`、`allowedChannels`、`resolveChannel` → [services/host](modules/services/host.md)
- `Timeline`、`TimelineRow`、`createTimelineProjection`、`createReactiveTimelineProjection`、`timelineCategories`、`timelineCategory`、`timelinePresets`、`transitionTurnPhase`、`viewTurnPhase`、`IDLE_TURN_PHASE`、`transitionSteerArrival`、`SessionUserMessage`、`SessionAssistantContent`、`AssistantTextContent`、`CurrentUserMessageDisplay`、`relativeTime`、`transitionPacedText`、`TEXT_RENDER_PACE_MS`、`Markdown`、`parseMarkdownNodes`、`createMarkdownRenderer`、`projectMarkdown`、`createMarkdownWorkerClient`、`renderCachedMarkdown`、`resolveFileDiff`、`SessionReview`、`DiffProps`、`highlightOptions`、`createFileFind`、`acquireVirtualizer`、`mediaKindFromPath`、`transitionViewerRender` → [session-ui/timeline-message](modules/session-ui/timeline-message.md)
- `ToolRegistry`、`ToolProps`、`ToolDisplay`、`ContextGroupPart`、`CurrentContextToolGroup`、`CurrentReadToolGroup`、`CurrentFileToolGroup`、`SessionShellMessage`、`taskAgentName`、`BasicTool`、`GenericTool`、`ToolErrorCard`、`ToolStatusTitle`、`transitionDisclosure`、`createDisclosure`、`createCopyFeedback`、`stripAnsi`、`createShellFollower`、`shellRunProps`、`subagentRunProps`、`transitionShellRun`、`transitionShellFollower`、`ApplyPatchFile`、`SourcesChip`、`SourcesPanel`、`SourcesTitle`、`turnSources`、`SessionReviewV2`、`SessionFilePanelV2`、`SessionProgressIndicatorV2`、`FileMedia` → [session-ui/tool-renderers](modules/session-ui/tool-renderers.md)
- `StatSync`、`Database`、`AppConfig`、`Runtime`、`R2Sql`、`Inference`、`ModelStat`、`ProviderStat`、`GeoStat`、`RetentionStat`、`Stat`、`StatsHome`、`syncStats`、`planStatsSync`、`syncStatPeriod`、`syncRetentionCohort`、`deterministicFailureAsResult`、`StatsSyncPlan`、`buildPeriodStatsQueries`、`buildPeriodRetentionQuery`、`hiddenStatModels`、`statPeriods`、`retentionPeriods`、`periodKeyFor`、`isoWeekId`、`normalizeTier`、`rankBy`、`chunks`、`modelStat`、`providerStat`、`geoStat`、`modelRetention`、`getStatsHomeData`、`getStatsLabData`、`getStatsModelData`、`setStatsPageCacheHeaders`、`runStatsEffect`、`StatsSyncWorkflow`、`HISTORY_SCHEDULE`、`instanceId`、`skipReason`、`recentInstanceIds` → [stats/usage](modules/stats/usage.md)
- `Dialog`、`DialogHeader`、`DialogFooter`、`DialogLayout`、`DialogBleed`、`DialogSelect`、`DialogSelectProps`、`DialogAlert`、`DialogConfirm`、`DialogPrompt`、`DialogHelp`、`DialogExportOptions`、`DialogExportResult`、`DIALOG_INSET`、`DIALOG_LIST_INSET`、`dialogWidth`、`FilePath`、`truncateFilePath`、`Link`、`clickedLink`、`PaneResizeHandle`、`createPaneResize`、`moveSelection`、`reconcileSelection`、`octantGlyph`、`oneCellFrame`、`spring`、`tween`、`createAnimatable`、`SESSION_SIDEBAR_WIDTH`、`SESSION_SIDEBAR_MAX_WIDTH`、`clampSessionTabsWidth`、`sessionTabsFitVertically`、`SESSION_PANEL_SPLIT_MIN_WIDTH`、`SplitBorder`、`EmptyBorder`、`Toast`、`ToastProvider`、`Spinner`、`SpinnerRenderable`、`SPINNER_FRAMES`、`OneCellSpinner`、`SessionTabs`、`SessionFrame`、`PanelHost`、`TerminalPane`、`TabPulse`、`RetryProvider`、`PatchDiff`、`CommandPaletteDialog`、`DialogConfig`、`DialogExperiments`、`experiments`、`ErrorComponent`、`FadeInText`、`Logo`、`MigrationOverlay`、`PluginRouteMissing`、`Reconnecting`、`StartupLoading`、`TodoItem`、`DialogThemeList`、`DialogSessionList`、`DialogModel`、`DialogMcp`、`DialogStatus`、`ThemeErrorToast`、`DialogDebug`、`Prompt` → [tui/components](modules/tui/components.md)
- `Plugin`、`PluginContextProvider`、`usePlugin`、`define`、`Definition`、`Cleanup`、`Context`、`SlotMap`、`SlotPath`、`SlotClaim`、`Keymap`、`KeymapLayer`、`KeymapCommand`、`UI`、`Storage`、`Data`、`Route`、`Page`、`Dialog`、`Toast`、`Attention`、`PanelPresentation`、`PluginProvider`、`PackageSource`、`PluginBoundary`、`PluginRoute`、`Slot`、`builtins`、`resolveSlots`、`contains`、`emptySlotted`、`PlacementKind`、`Placement`、`Claim`、`Slotted`、`Suppressed`、`Degraded`、`createPluginContext`、`createDialogApi`、`usePluginHost`、`Registry`、`SlotRender`、`RegisteredSlot`、`Dispose`、`createSourceWatcher`、`createMarkdownRenderer`、`discoverPluginTargets`、`localPluginDirectories`、`mergePluginTargets`、`Story`、`StoryFooter`、`StoryFooterControl`、`sessionTabsStory`、`oneCellSpinnerStory`、`todoStory`、`linkClicksStory`、`highlightsStory`、`mermanLayoutsStory`、`sessionLocationMissingStory`、`ONE_CELL_SPINNERS`、`SUBCELL_SPINNERS`、`PromptFooter`、`SidebarTodo`、`SidebarContext`、`SidebarOnboarding`、`SidebarLimit`、`SidebarMcp`、`Answer`、`GoalStatus`、`createGoal`、`PluginsDialog`、`StatsPoster`、`DiffFile`、`DiffViewerContent`、`DiffViewerFileTree`、`DiffViewerImage`、`homeFooterVisibility` → [tui/feature-plugins](modules/tui/feature-plugins.md)
- `MiniFrontendInput`、`runMini`、`MiniCommandInput`、`createMiniHost`、`usingInteractiveStdin`、`INTERACTIVE_INPUT_ERROR`、`RunDeferredInput`、`RunRuntimeDeps`、`RunInput`、`RunPrompt`、`RunDelivery`、`RunSession`、`MiniHost`、`MiniSettings`、`MiniVerbosity`、`RunTuiConfig`、`FooterApi`、`FooterEvent`、`FooterPatch`、`FooterView`、`FooterState`、`FooterPromptRoute`、`FooterQueuedPrompt`、`StreamCommit`、`LocalReplayRow`、`RunFooter`、`RunFooterView`、`RunScrollbackStream`、`RunEntryBody`、`RunTheme`、`RUN_THEME_FALLBACK`、`RunEntryTheme`、`RunFooterTheme`、`RunBlockTheme`、`Lifecycle`、`LifecycleInput`、`QueueInput`、`SessionTransport`、`createSession`、`sessionHistory`、`sessionVariant`、`messagePrompt`、`resolveMiniSettings`、`resolveModelInfo`、`resolveModelInfoStrict`、`resolveSessionInfo`、`resolveRunTuiConfig`、`verbosityPreset`、`verbosityChange`、`applyMiniSettingChange`、`cycleMiniVerbosity`、`matchMiniVerbosity`、`createPromptState`、`createPromptHistory`、`movePromptHistory`、`promptAppend`、`promptCopy`、`createPermissionBodyState`、`createFormBodyState`、`formReply`、`entrySplash`、`exitSplash`、`splashMeta`、`monoSnapshot`、`monoMarkdownRenderable`、`entryBody`、`entryWriter`、`writeSessionOutput`、`createFragmentReconciler`、`createSubagentTracker`、`toolCommit`、`turnSummaryCommit`、`createRunDemo`、`demo`、`footerMenuText`、`footerPromptLayout`、`footerStatuslinePolicy`、`footerPanelLayout`、`toolView`、`normalizeTool` → [tui/mini](modules/tui/mini.md)
- `Prompt`、`PromptProps`、`PromptRef`、`Autocomplete`、`PromptMetadataRow`、`usePromptMove`、`saveDraft`、`takeDraft`、`appendToSessionPrompt`、`registerComposer`、`MAX_LOCAL_ATTACHMENT_BYTES`、`normalizePastedFilepath`、`parsePastedFilepaths`、`promptFilesForServer`、`readLocalAttachment`、`normalizePromptContent`、`expandTrackedPastedText`、`expandPastedTextPlaceholders`、`parseSlashHead`、`parseFileLineRange`、`stripFileLineRange`、`promptOffsetIndex`、`mentionTriggerIndex`、`slashTriggerIndex`、`computePromptTraits`、`projectedPromptInput`、`restoredPromptInput`、`realignPromptMentions`、`deduplicatePromptImages`、`deduplicateVisibleImages`、`preserveMentionlessPromptAttachments`、`promptAttachmentLabel`、`usePromptRestore`、`MAX_FRECENCY_ENTRIES`、`parseFrecency`、`MAX_STASH_ENTRIES`、`parsePromptStash`、`parsePromptHistory`、`parsePromptInfo`、`appendPrompt`、`emptyPrompt`、`directoryAutocompleteExactValue`、`directoryAutocompleteMatches`、`slashArgumentAutocomplete`、`useDirectoryRecents`、`createSimpleContext`、`createStorage`、`useStorage`、`useStorageOptional`、`useEvent`、`usePathFormatter`、`createPanelState`、`EditorSelection`、`EditorIntegration`、`TuiPaths`、`useTuiPaths`、`InteractivityProvider`、`resolveInteractivity`、`programStatusReports`、`createProgramStatus`、`Composer`、`useComposerTab`、`ShellTab`、`TerminalsTab`、`SubagentsTab` → [tui/prompt-editor](modules/tui/prompt-editor.md)
- `Home`、`Session`、`useRouteData`、`Route`、`HomeRoute`、`SessionRoute`、`PluginRoute`、`Keymap`、`COMMAND_PALETTE_COMMAND`、`Slot`、`SessionFrame`、`Sidebar`、`Composer`、`SessionGroupView`、`PermissionPrompt`、`FormPrompt`、`createSessionRows`、`sessionRowID`、`createTimelineAnchors`、`rowWeight`、`rowsBefore`、`rowsAfter`、`createHistoryPrepend`、`findMessageBoundary`、`generateThinkingSyntax`、`activitySummary`、`openSessionTab`、`closeSessionTab`、`reopenSessionTab`、`adaptiveSessionTabLayout`、`SESSION_TAB_MAX_WIDTH` → [tui/routes-shell](modules/tui/routes-shell.md)
- `ThemeDocument`、`ThemeDefinition`、`ModeDefinition`、`BaseThemeDefinition`、`ThemeTokensDefinition`、`DialogTokensDefinition`、`TextDefinition`、`BackgroundDefinition`、`SyntaxDefinition`、`MarkdownDefinition`、`MarkdownToken`、`SyntaxToken`、`HueStep`、`HueName`、`HueDefinition`、`CategoricalDefinition`、`ActionState`、`ActionVariant`、`FeedbackKind`、`FormfieldState`、`SurfaceName`、`StatefulColorDefinition`、`parseThemeDocument`、`resolveThemeDocument`、`resolveTheme`、`selectTheme`、`selectThemeMode`、`supportsThemeMode`、`themeModes`、`expandTheme`、`migrateV1`、`migrateV1NewDesigns`、`generateSyntax`、`rgbToOklch`、`themeDecodeError`、`ResolvedTheme`、`ResolvedThemeTokens`、`DEFAULT_THEMES`、`allThemes`、`hasTheme`、`isThemeSource`、`parseTheme`、`setCustomThemes`、`setSystemTheme`、`subscribeThemes`、`getOpenCodeTheme`、`getOpenCode2Theme`、`resolveThemeColors`、`generateSystem`、`terminalMode`、`ansiToRgba`、`tint`、`createComponentTheme`、`ComponentTheme`、`discoverThemes`、`ThemeError`、`ThemeSource`、`createThemeSource`、`createSyntaxStyleMemo`、`useTheme`、`useThemes`、`ThemeContextProvider`、`Config`、`Info`、`Interface`、`Cursor`、`Plugin`、`DiffSource`、`MiniWorkSpinner`、`AttentionSoundName`、`AttentionSoundPaths`、`resolve`、`useConfig`、`useCursorStyle`、`useNewDesigns`、`useClientMcpExperiment`、`TuiKeybind`、`Definitions`、`LeaderDefault`、`KeybindOverrides`、`BindingValueSchema`、`bindingDefaults`、`defaultValue`、`parse`、`toBindingConfig`、`unknownKeys`、`BindingLookupView`、`CommandMap` → [tui/theme-keybinds](modules/tui/theme-keybinds.md)
- `stringWidth`、`collapseToolOutput`、`collapseShellOutput`、`configDirectories`、`projectConfigDirectories`、`localProjectDirectory`、`hasConnectedProvider`、`createDelayedPresence`、`splitPatchHunks`、`splitAddedPatch`、`errorDetails`、`cliErrorMessage`、`errorFormat`、`errorMessage`、`filetype`、`formRows`、`formInitialValues`、`formValidateValue`、`decide`、`claim`、`titlecase`、`truncate`、`truncateWidth`、`graphemes`、`marqueeText`、`marqueeOverflows`、`createMediaCache`、`parse`、`formatRef`、`switchLabel`、`abbreviateHome`、`formatPath`、`normalizePath`、`permissionPresentation`、`readJson`、`writeJsonAtomic`、`epilogue`、`projectName`、`isRecord`、`setTerminalTitle`、`destroyRenderer`、`getScrollAcceleration`、`CustomSpeedScroll`、`copy`、`copyOnSelectRelease`、`handleSelectionKey`、`sessionFamily`、`contextUsage`、`formatContextUsage`、`createDebouncedSignal`、`createFadeIn`、`createSingleFlight`、`describeOS`、`describeTerminal`、`parseTodos`、`todoMarker`、`sessionTodos`、`canonicalToolName`、`toolDisplayMetadata`、`toolDisplayContent`、`executeCalls`、`webSearchProviderLabel`、`servedByConsole`、`usageLevel`、`formatDollars`、`formatReset`、`goLimitName`、`limitScope`、`safeWatch`、`register`、`data`、`createTuiAttention`、`createTuiClipboard`、`createClipboardAdapter`、`openEditor`、`discoverEditorConnection`、`editorIntegration`、`resolveZedSelection`、`resolveZedDbPath`、`logo`、`go`、`modelPreferenceKey`、`recentModels`、`favoriteModels`、`cycleModelVariant`、`normalizeModelVariant`、`createModelPreferenceRepository`、`decodeModelPreference` → [tui/util-runtime](modules/tui/util-runtime.md)
- `Button`、`ButtonProps`、`Select`、`SelectProps`、`TextInput`、`TextInputProps`、`Dialog`、`DialogBody`、`DialogFooter`、`DialogHeader`、`DialogTitle`、`DialogProvider`、`useDialog`、`useDialogLayer`、`createDialogStackState`、`transitionDialogStack`、`DialogStackState`、`DIALOG_EXIT_MS`、`selectTopDialog`、`Tabs`、`Keybind`、`TextShimmer`、`ScrollView`、`Icon`、`newIcons`、`setNewIcons`、`IconName`、`getIcon`、`iconNames`、`createListState`、`transitionList`、`listActive`、`listScrollTarget`、`groupItems`、`selectListEmptyState`、`LIST_LOAD_TIMEOUT_MS`、`useFilteredList`、`FilteredListProps`、`pinSpinPhase`、`syncSpinPhase`、`springStyle`、`slidingHighlight`、`widthMorph`、`numberTween`、`ThemeProvider`、`useTheme`、`themeToCss`、`themeV2ToCss`、`resolveThemeV2`、`resolveThemeVariant`、`resolveThemeVariantV2`、`generateV2Primitives`、`mapV2Semantics`、`mergeV2Tokens`、`V2_PRIMITIVES_DEFAULT`、`ColorValue`、`ResolvedTheme`、`ResolvedV2Theme`、`DesktopTheme`、`ThemeToken`、`ThemeVariant`、`blend`、`withAlpha`、`oklchToHex`、`rgbToOklch`、`createUiI18n`、`useI18n`、`pluralCategory`、`pluralKey`、`UiI18n`、`UiTranslate`、`localizedListSeparator`、`resolveTemplate`、`showToast`、`toaster`、`Toast`、`ToastOptions`、`transitionTextFieldCopy`、`TextFieldCopyState`、`transitionTypeahead`、`createTypeaheadState`、`transitionScrollThumb`、`scrollOffsetFromThumbPointer`、`canScrollKey`、`create`、`story`、`sourceURL`、`componentConfig` → [ui/primitives](modules/ui/primitives.md)
- `LayerNode`、`Node`、`LayerNodePlatform`、`Global`、`Path`、`Teardown`、`Observability`、`Flock`、`SessionTurn`、`AppProcess`、`ProcessSignal`、`FSUtil`、`Glob`、`Hash`、`Npm`、`onRequest`、`collections`、`docsLocale`、`fromV1`、`ContentCode`、`Manifest`、`SimulationProtocol`、`SimulationControlServer`、`SimulationNetwork`、`SimulationRenderer`、`SimulationActions`、`SimulatedProvider`、`PluginStory`、`storyIndex`、`componentConfig`、`parseRepositoryClaim`、`HttpRecorder`、`Cassette`、`RequestMatcher`、`Redactor`、`ReplayState`、`activate`、`deactivate` → [util-runtime/misc](modules/util-runtime/misc.md)

## 覆盖率

| 目录 | 源文件 | 未归属 |
| --- | --- | --- |
| `packages/web` | 20 | 0 |
| `packages/util` | 45 | 0 |
| `packages/ui` | 266 | 0 |
| `packages/tui` | 300 | 0 |
| `packages/theme` | 11 | 0 |
| `packages/stories` | 3 | 0 |
| `packages/stats` | 83 | 0 |
| `packages/simulation` | 13 | 0 |
| `packages/session-ui` | 139 | 0 |
| `packages/server` | 60 | 0 |
| `packages/sdk` | 15 | 0 |
| `packages/script` | 3 | 0 |
| `packages/schema` | 107 | 0 |
| `packages/protocol` | 43 | 0 |
| `packages/plugin-browser` | 11 | 0 |
| `packages/plugin` | 88 | 0 |
| `packages/patchmark` | 8 | 0 |
| `packages/merman` | 62 | 0 |
| `packages/latex` | 8 | 0 |
| `packages/httpapi-codegen` | 1 | 0 |
| `packages/http-recorder` | 14 | 0 |
| `packages/gui-plugins` | 904 | 0 |
| `packages/function` | 3 | 0 |
| `packages/desktop` | 148 | 0 |
| `packages/core` | 493 | 0 |
| `packages/codemode` | 105 | 0 |
| `packages/client` | 28 | 0 |
| `packages/cli` | 115 | 0 |
| `packages/app` | 685 | 0 |
| `packages/ai` | 247 | 0 |

