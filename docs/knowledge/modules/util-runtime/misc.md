---
id: util-runtime/misc
title: 基础运行时与小而散的包（util / web / stories / simulation / http-recorder …）
level: L2
layer: util-runtime
status: stable
paths:
  - packages/util/src
  - packages/util/package.json
  - packages/web/src
  - packages/identity
  - packages/simulation/src
  - packages/stories
  - packages/function/src
  - packages/http-recorder/src
  - sdks/vscode/src
symbols:
  - LayerNode
  - Node
  - LayerNodePlatform
  - Global
  - Path
  - Teardown
  - Observability
  - Flock
  - SessionTurn
  - AppProcess
  - ProcessSignal
  - FSUtil
  - Glob
  - Hash
  - Npm
  - onRequest
  - collections
  - docsLocale
  - fromV1
  - ContentCode
  - Manifest
  - SimulationProtocol
  - SimulationControlServer
  - SimulationNetwork
  - SimulationRenderer
  - SimulationActions
  - SimulatedProvider
  - PluginStory
  - storyIndex
  - componentConfig
  - parseRepositoryClaim
  - HttpRecorder
  - Cassette
  - RequestMatcher
  - Redactor
  - ReplayState
  - activate
  - deactivate
config_keys:
  - OTEL_EXPORTER_OTLP_ENDPOINT
  - OTEL_EXPORTER_OTLP_HEADERS
  - OPENCODE_TEST_HOME
  - PLAYWRIGHT_STORIES_URL
  - PLAYWRIGHT_STORIES_PORT
depends_on:
  - contracts/config-flag
related:
  - infra/misc-packages
  - services/docs-site
  - app/runtime
  - gui/browser
keywords:
  - LayerNode
  - app-node
  - Global
  - Teardown
  - observability
  - OTLP
  - flock
  - cassette
  - http-recorder
  - stories
  - simulation
  - vscode 扩展
  - Astro 文档站
  - 品牌资产
source_hash: c8bdff70aaee245ad5e9ce6700531aff308fd963
---

## 职责

一堆体量小、彼此不相干的包，加上跨包复用的**基础运行时**。一句话一个包：

| 包 | 一句话 |
| --- | --- |
| `packages/util` | Effect 基础设施（`LayerNode`/`app-node`/`Global`/`Teardown`/observability）+ 通用工具（flock、process、glob、hash、patch、npm、session-turn、activity-calendar、uuid、qr、patch…） |
| `packages/web` | Astro/Starlight **文档与落地站点**（多语言 content/docs、分享页 `s/[id]`、`go`/`zen` 重定向、markdown 端点） |
| `packages/identity` | **纯品牌资产**（SVG/PNG 图标，无 TS 代码） |
| `packages/simulation` | GUI/前端**模拟驱动**：WebSocket 控制协议 + OpenCode 后端替身 + 前端动作/渲染记录 |
| `packages/stories` | **组件故事服务器**（Vite 单页）+ Playwright `story` fixture + app/gui-plugins 的 mock 上下文 |
| `packages/function` | SST 上的小 Hono API（GitHub App token 交换、分享页下线页） |
| `packages/http-recorder` | HTTP/WebSocket **cassette 录制回放**（Effect Layer），测试支撑 |
| `sdks/vscode` | VS Code 扩展（`activate`/`deactivate`，开 opencode 终端、把文件路径送进终端） |

## 边界

- `util` 是**最下层**：不得依赖 `core`/`protocol`/`client`；反过来所有包都可以依赖它。
- `LayerNode` **不是**新的依赖注入容器：它是在 Effect `Layer` 之上做分组/标签/替换的层图，最终仍编译成 `Layer`。
- `identity` 只有资源文件；"品牌组件"在 `ui`/`web` 侧，不要指望从 `identity` import 模块。
- `stories` 只提供故事宿主与 fixture；具体 spec 归属生产组件所在包（`session-ui`/`app`，见 `stories/playwright/README.md`）。
- `http-recorder` 是测试工具，不进产品运行时路径。
- `simulation` 是"驱动器/模拟器"，不是产品入口；`web` 是独立的 Astro 站点，与 `services/site` 不是同一个东西。

## 入口与调用链

- **层图**：`util/effect/layer-node.ts` 定义 `tags()`/`Graph`/`Node`/`Provider`/`Replacement`，编译成 `Layer`；`util/effect/app-node.ts` 固定两个标签（`global`、`location`）并导出 `makeGlobalNode`/`makeLocationNode`；`util/effect/app-node-platform.ts` 提供 `fetchLayer`/`filesystem`/`path` 等平台层。
- **全局路径**：`util/global.ts` 用 `#global-roots` 条件导出选 XDG 还是 workerd 临时根，导出 `Path`（home/data/bin/log/repos/cache/config/state/tmp）与 `Global.Service`；模块加载时 `Flock.setGlobal({ state })`。
- **关闭台账**：`util/teardown.ts` 的 `track(label)` / `pending()` 记录"关闭可能还在等的东西"，被 `runtime/process-lifecycle` 的超时报告消费。
- **观测**：`util/observability.ts` 的 `layer(options)` 组文件/控制台 logger + OTLP exporter（`OTEL_EXPORTER_OTLP_ENDPOINT`/`_HEADERS`），失败 `catchCause` 回落到本地 logger。
- **运行时差异**：`util/runtime-import.ts` 经 `#runtime-import` 选 bun/node/workerd 三份实现（`importModule`/`resolveModule`）。
- **http-recorder**：`src/index.ts` 汇出 `HttpRecorder.layer/layerFetch/layerSocket/layerWebSocketConstructor` 与 cassette 生命周期（`hasCassetteSync`/`removeCassetteSync`）。
- **stories**：`src/plugin.tsx` 用 `import.meta.glob` 载入 `gui-plugins/src/*/index.ts`，`PluginStory` 在插件上下文里渲染组件；`playwright/story.ts` 提供挂载 fixture，`playwright/config.ts` 提供共享 Playwright 配置。
- **vscode**：`activate(context)` 注册 `opencode.openTerminal`/`opencode.openNewTerminal`/`opencode.addFilepathToTerminal`。

## 数据与状态

- `util` 的 `Path` 来自 XDG（workerd 用一个 tmp 根）；`OPENCODE_TEST_HOME` 可覆盖 `home`。
- `Flock` 提供跨进程锁（`Lease`/`WaitEvent`），`state` 目录由其全局配置决定——日志/缓存目录的锁都在这套机制上。
- `http-recorder` cassette 是磁盘上的 JSON：metadata + 请求/响应快照 + WebSocket 交互；redaction 策略是**追加式**（`RedactOptions`：headers/queryParameters/jsonFields，另有 `allow*Headers` 白名单）。
- `simulation` manifest（`DriveManifest`）：`endpoints.ui`/`endpoints.backend` 必须是 `ws://127.0.0.1:<port>`，加上绝对路径与实例名（`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$`）。
- `stories` 用 `PLAYWRIGHT_STORIES_URL` 复用已运行的 story server，或用 `PLAYWRIGHT_STORIES_PORT` 指定端口。

## 关键不变式

- **标签必须匹配**：`GlobalGraph` 的位置不能塞 `LocationGraph`（类型层面就不同）；跨标签复用得走 `LayerNode` 的 replacement/tag 机制。
- **workerd 不可在模块作用域做 I/O**：`observability.ts` 用 `Layer.suspend` 的原因就是 file logger 与 run id 是模块级 I/O；新增 util 时同样不要在顶层碰文件/环境。
- **运行时差异只走条件导出**（`#global-roots`、`#runtime-import`），不要在代码里 `process.versions` 之类的 sniff。
- **关闭期长任务必须登记** `Teardown.track`，否则进程被关闭时无法解释"谁在拖住退出"。
- **录制不落真实密钥**：redaction 是追加而非覆盖（默认规则 + 调用方追加），加字段时不要顺手放宽默认。
- **故事只渲染生产组件**，不要复制视觉；fixture/副作用必须留在故事内（可重复探索）。
- **vscode 扩展入口固定** `src/extension.ts`（`package.json` 的 `main`），改文件名会让扩展静默失效。

## 扩展点

- **加一个 util 工具**：`packages/util/src/<name>.ts` + 同目录测试；`package.json` 的 `./*` → `src/*.ts` 让它自动可 `@opencode/util/<name>` 引用。
- **加一个平台层**：`packages/util/src/effect/app-node-platform.ts` 里补一个 `*Layer`，需要 workerd 变体就加 `.workerd.ts`。
- **加故事**：生产组件旁 `*.stories.tsx`，spec 放组件所属包（规范见 `packages/stories/playwright/README.md`）；`bun --cwd packages/stories dev` 起故事服务器。
- **加模拟动作/后端**：`simulation/src/protocol/index.ts` 加 RPC → `frontend/actions.ts` 或 `backend/*` 实现 → `manifest` 描述端点。
- **加文档页**：`packages/web/src/content/docs/**`（Astro content collections，多语言目录并列）。
- **加 cassette 场景**：`http-recorder/test/fixtures/recordings/` 加录制文件 + 对应 `test/*.test.ts`。

## 常见改法与坑

- `util` 导出的 `Path` 名字很通用，和 `node:path` 同时出现时容易混（新代码建议 `import { Global }` 后取 `Global.Path` 风格，按现有用法为准）。
- 在 `util` 里直接用 Node API（`node:fs`、`Bun.*`）会让 workerd 构建失败——Workers 里走 `.workerd.ts` 变体。
- `packages/web` 是 **Astro/Starlight**（不是 SolidStart/Astro app 混用）：内容集合与路由写法跟 `services/site` 不同，别照搬。
- `stories/mocks/` 是手写的 app 上下文替身：改 `@opencode/app` 的 context 形状（platform/command/layout/server…）必须同步改 mocks，否则故事在运行时才炸。
- `packages/identity` 没有 TS 源码，把它加进 `paths` 只为覆盖资产，不影响符号锚点。
- `packages/function` 依赖 SST 的 `Resource` 与 Cloudflare/GitHub 凭据，本地只能跑纯函数（`parseRepositoryClaim` 有单测）。
- `http-recorder` 的 `layer`/`layerFetch` 替换 `HttpClient`；在测试里忘加会让请求真的出网。
- `simulation` 的 endpoint 校验要求显式端口和 `127.0.0.1`，用 `localhost` 或 `ws://0.0.0.0` 会被拒。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/util/src/effect/layer-node.ts` | `LayerNode` 层图：tag/graph/provider/replacement → Layer |
| `packages/util/src/effect/app-node.ts` | `global`/`location` 标签与 `Node` 构造器 |
| `packages/util/src/effect/app-node-platform.ts` | 平台层（fetch/filesystem/path/http） |
| `packages/util/src/global.ts` | `Global`/`Path`、XDG 与 flock 全局状态 |
| `packages/util/src/teardown.ts` | `Teardown.track`/`pending` 关闭台账 |
| `packages/util/src/observability.ts`、`observability/*.ts` | logger + OTLP 组装 |
| `packages/util/src/flock.ts`、`effect-flock.ts` | 跨进程锁与 Effect 包装 |
| `packages/util/src/process.ts`、`cross-spawn-spawner.ts` | 进程执行与信号 |
| `packages/util/src/glob.ts`、`hash.ts`、`patch.ts`、`npm.ts` | 文件/哈希/patch/npm 工具 |
| `packages/web/src/pages/go.ts`、`zen.ts`、`s/[id].astro` | 重定向与分享页 |
| `packages/web/src/middleware.ts`、`content.config.ts` | 站点中间件与内容集合 |
| `packages/simulation/src/protocol/index.ts`、`control-server.ts` | 模拟协议与 WebSocket 控制服务器 |
| `packages/simulation/src/backend/*`、`frontend/*` | 模拟后端与前端驱动/渲染记录 |
| `packages/stories/src/plugin.tsx`、`playwright/story.ts` | 故事宿主与 Playwright fixture |
| `packages/http-recorder/src/index.ts`、`cassette/*` | cassette 录制回放入口与存储 |
| `packages/function/src/api.ts`、`github.ts` | Hono API 与 GitHub claim 解析 |
| `sdks/vscode/src/extension.ts` | VS Code 扩展入口 |
