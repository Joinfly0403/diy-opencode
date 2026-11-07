---
id: infra/misc-packages
title: 小包与配套服务（script / figma 插件 / browser 插件 / update 服务）
level: L2
layer: infra
status: stable
paths:
  - packages/script/src
  - packages/plugins
  - packages/plugin-browser/src
  - services/update/src
symbols:
  - pack
  - BrowserTools
  - BrowserConnection
related:
  - core/plugin-system
  - gui/browser
  - cli/services-updater
keywords:
  - 发布脚本
  - pack
  - figma
  - browser 插件
  - update 服务
  - 更新清单
source_hash: 918534711943e86a972e4d991f0e41e3b35ca7b9
---

## 职责

四个体量小但各自独立的东西，放在一张卡里：

| 包 | 职责 |
| --- | --- |
| `packages/script`（`@opencode/script`） | 打包/发布辅助脚本：`pack`（打包成可分发产物）、`highlights`（生成发版亮点）。会校验 bun 版本与根 `packageManager` 一致 |
| `packages/plugins/figma`（`@opencode/plugin-figma`） | Figma 插件：注册远程 MCP（`https://mcp.figma.com/mcp`）并把自带的 skills 注入为 skill 定义 |
| `packages/plugin-browser`（`@opencode/plugin-browser`） | 桌面版浏览器插件：连接/隧道/RPC/工具注册（`BrowserConnection` + `BrowserTools`），配合 `gui/browser` 面板 |
| `services/update`（`@opencode/update`） | 更新服务（Cloudflare Worker + D1）：按 channel 维护产物清单、版本比较（semver）、JWT 校验与事件上报 |

## 边界

- 这些包都不参与运行时核心逻辑；`script` 只在构建/发布时用，`update` 是独立部署的服务。
- `plugin-browser` 与 `plugin-browser` 侧的浏览器能力属于桌面端，**不要**把它接进纯 CLI 路径。
- `services/update` 不做自动更新客户端逻辑（那个在 `cli/services-updater`），它只提供清单与版本裁决。

## 入口与调用链

- `packages/script/src/index.ts` 在 import 时校验 bun 版本 → `pack.ts` 产出分发包 → `highlights.ts` 生成发版亮点。
- `packages/plugins/figma/index.ts`：`Plugin.define({ id: "opencode.figma" })` → `ctx.mcp.transform` 注册远程 MCP → 读 `skills-source.json` 与各 `SKILL.md` 注册 skill。
- `packages/plugin-browser/src/index.ts`：`Plugin.define({ id: "opencode.browser" })` → `BrowserConnection.make(ctx)` → `BrowserTools.register(...)`。
- `services/update/src/index.ts`：Worker fetch handler 读书 D1 的 `artifact` 表（单数，见 `migrations/0001_artifact.sql`）与 `channel_rollout`，按 channel/版本返回清单，写 `EVENTS` pipeline。

## 数据与状态

- `services/update` 的表结构：`artifact(channel, name, distribution, version, metadata, active, minimum, time_created, time_updated)` 加 `channel_rollout(duration_hours)`；`active`/`minimum` 控制灰度与最低可升级版本。另：`services/files` 与 `services/update` **不在** `sst.config.ts`/`infra` 部署图里，各自走 `wrangler.jsonc` + `deploy-*.yml`（详见 `services/host` 卡）。
- figma 插件的 skill 内容由 `skills-source.json` 清单 + 目录里的 `SKILL.md` 组成（`script/sync-skills.ts` 同步）。
- browser 插件的连接态是 XState 状态机（`machine.ts`、`proxy-machine.ts`、`tunnel-machine.ts`）。

## 关键不变式

- 插件必须用 `Plugin.define` 并给稳定 `id`（如 `opencode.browser`），id 是重载与去重的键。
- `ctx.mcp.transform` 里先 `editor.get("<name>")` 判重，避免覆盖用户已有 MCP 配置。
- `packages/script` 的 bun 版本校验失败会直接抛错：改根 `packageManager` 前先跑打包脚本。
- `services/update` 的 `minimum` 一旦抬高，低版本客户端会被强制升级，属于高风险字段。

## 扩展点

- **加一个官方插件包**：`packages/plugins/<name>/` + `Plugin.define` + `package.json` 的 `files/exports`（参考 figma）。
- **改发布产物**：`packages/script/src/pack.ts`，注意各平台的产物命名与 `.github/release/*` 脚本对齐。
- **改更新策略**：`services/update` 的 `active`/`minimum` 与 channel 映射。

## 常见改法与坑

- figma 插件依赖外部 MCP 服务可用性，离线环境会注册失败但不该阻塞启动。
- browser 插件与 `gui/browser` 面板是同一功能的两端，改 RPC 方法名要两边一起改。
- `services/update` 用 Cloudflare 的 `cloudflare:pipelines` 类型，本地类型检查需要 CF 环境声明。
- `packages/script` 里的脚本直接跑 `$`（bun shell），不能在 node 下执行。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/script/src/index.ts` | bun 版本校验、脚本入口 |
| `packages/script/src/pack.ts` | 打包 |
| `packages/script/src/highlights.ts` | 发版亮点生成 |
| `packages/plugins/figma/index.ts` | Figma 插件与 MCP/skill 注册 |
| `packages/plugins/figma/script/sync-skills.ts` | skill 同步 |
| `packages/plugin-browser/src/index.ts` | 浏览器插件入口 |
| `packages/plugin-browser/src/connection.ts`、`tools.ts` | 连接与工具注册 |
| `packages/plugin-browser/src/tunnel.ts`、`proxy.ts` | 隧道与代理 |
| `services/update/src/index.ts` | 更新清单 Worker |
