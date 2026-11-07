---
id: app/providers-usage
title: 模型供应商目录、连接流程、用量面板与组件实验室
level: L1
layer: app
status: stable
paths:
  - packages/app/src/providers
  - packages/app/src/usage
  - packages/app/src/components-lab
symbols:
  - useProviders
  - syncWhileBooting
  - popularProviders
  - useIntegrations
  - consoleProviderGroup
  - consoleCatalogLoaded
  - consoleProviderName
  - createConsoleCatalogSettler
  - transitionConsoleSettle
  - useMcpController
  - createProviderDialogController
  - transitionProviderConnect
  - transitionProviderDialog
  - transitionProviderForm
  - transitionMcp
  - DialogConnectProvider
  - DialogSelectMcp
  - DialogUsageExceeded
  - DialogSelectModel
  - ModelSelectorDrawer
  - transitionModelSelection
  - resolveModelVariant
  - cycleModelVariant
  - DialogUsage
  - UsageDialogContent
  - startUsageDialog
  - transitionUsageDialog
  - usageView
  - modelUsage
  - useUsageFormat
  - createModelUsage
  - DialogStoryRuntime
  - labEntry
  - storyMotion
  - applyMotionPatch
  - transitionLabStage
  - transitionLabBrowse
  - transitionDialogFlyout
tests:
  - packages/app/src/providers/catalog/console.test.ts
  - packages/app/src/providers/catalog/settle-machine.test.ts
  - packages/app/src/providers/connect/dialog-machine.test.ts
  - packages/app/src/providers/connect/form-machine.test.ts
  - packages/app/src/providers/connect/machine.test.ts
  - packages/app/src/providers/models/selection-machine.test.ts
  - packages/app/src/providers/models/variant.test.ts
  - packages/app/src/providers/models/models.test.ts
  - packages/app/src/usage/limits.test.ts
  - packages/app/src/usage/machine.test.ts
  - packages/app/src/components-lab/catalog.test.ts
  - packages/app/src/components-lab/machine.test.ts
  - packages/app/src/components-lab/motion.test.ts
depends_on:
  - app/runtime
  - app/settings
  - core/provider-models
  - contracts/httpapi-protocol
related:
  - app/composer
  - app/shell
  - ai/providers
  - tui/util-runtime
keywords:
  - provider
  - 供应商
  - 模型选择
  - model picker
  - variant
  - 连接
  - connect
  - API key
  - 登录
  - MCP
  - usage
  - 用量
  - 预算
  - budget
  - Console
  - Go 额度
  - components lab
  - 组件实验室
  - storybook
  - knobs
source_hash: a08c3a9252d8b11c97c9a5c0b605b50c455b252b
---

## 职责

四块围绕「模型与用量」的前端表面：

- `providers/catalog/`——供应商目录的读取与归一化：`useProviders(directory)` 在 server ctx 连接后同步 `provider`/`model`，用 `normalizeProviderList` 合成 `ProviderListResponse`；`useIntegrations` 同步可连接的 integration 列表；`console.ts` 识别签入 Console 工作区后多出来的 provider 组；`settle-machine.ts` 在凭据变更后短暂轮询目录；`order.ts` 是「热门供应商」排序表；`plugin.ts` 提供插件标签文案。
- `providers/connect/`——连接供应商：`DialogConnectProvider` + `createProviderDialogController`（打开哪个步骤、怎么关、关掉后选中谁）、`machine.ts`（一次连接的授权/轮询/重试）、`form-machine.ts`（API key 表单与浏览器登录的跳转）、`dialog-machine.ts`（账号列表、Claude/Console 集成、返回目标）、MCP 对话框与登录（`mcp*.tsx`）、ChatGPT 计划欢迎与用量上限、Go upsell。
- `providers/models/`——模型列表与选择：`DialogSelectModel`（宽屏对话框）与 `ModelSelectorDrawer`（手机抽屉）、`models.tsx`（`isFreeModel`/`latestModels`/`uniqueModels` 与 `ModelsProvider`）、`selection.tsx`（`ModelSelection` 上下文，按会话持久化选择）、`selection-machine.ts`、`variant.ts`（`inherit`/`default`/具体变体）、`useConfiguredModel`、`agent.ts`、`search.ts`。
- `usage/`——用量面板：`DialogUsage`（打开即刷新当前 Location 的 OpenCode Go 额度与 Console 预算）、`limits.ts`（纯视图模型：`usageView`/`modelUsage` → `BudgetRow`/`Callout`/`LimitAction`/`Footer`）、`format.ts`（`useUsageFormat` 走 `Intl` + `language.intl()`）、`model.tsx`（模型行上的剩余额度标签）、`machine.ts`（加载状态机）。
- `components-lab/`——开发（以及 beta 通道）用的组件实验室：glob 所有 `*.stories.tsx` 成目录，用真实 provider 栈渲染单个 story，带 knobs 检视器、网格视图、播放/暂停与动效回放。

## 边界

- **这里不是 Solid/Effect 上下文组装层**：Theme/Language/Dialog/QueryClient/PluginRoot 的组装在 `app.tsx` 的 `AppBaseProviders`，server 连接与持久化在 `app/runtime`。`providers/` 指 **LLM 供应商**。
- **不拥有数据**：provider/model/integration/usage 都来自 `useData()` 的 `data.location.{provider,model,integration,usage}`；本目录只读取、只触发 `sync`/`invalidate`。
- **不写凭据**：API key / OAuth 写入由 `settings/providers/account-actions` 与 server API 完成；连接对话框只调用并展示结果。
- **不定义预算语义**：`UsageLimitsInfo`/`UsageLimitsBudget` 来自 `@opencode/client`（协议），"花多少算爆"由服务端/Console 决定；这里只把数字翻成文字。
- **不解释后端统计**：`packages/stats` 是另一套（服务器侧使用统计），与本卡的 Console 预算面板无关。
- **components-lab 不进发布包**：`shell/routes/routes.tsx` 只在 `import.meta.env.DEV` 或 `VITE_OPENCODE_CHANNEL === "beta"` 时动态 import，其余构建直接把它摇掉。

## 入口与调用链

```
composer/commands.tsx
  → dialog.show(() => <DialogSelectModel model={...} />)          （动态 import，主包不带选择器）
  → dialog.show(() => <DialogConnectProvider directory={...} selection={...} />)
  → dialog.show(() => <DialogUsage location={...} model={...} />)  （"查看用量"命令）

useProviders(directory)
  → 连接后 data.location.syncInfo / .default()
  → syncWhileBooting(() => Promise.all([provider.sync, model.sync]))
  → createMemo → normalizeProviderList(provider.list, model.list)
  → { ready, all, default, popular }

DialogConnectProvider → createProviderDialogController
  → providers.catalog（列表）+ integrations（可连接项）
  → transitionProviderConnect / connectMethods() → 授权/轮询/CLI 登录
  → 成功后：刷新目录 + console settle（等待 Console 工作区的 provider 出现）
  → onConnected/onSelect → 写回模型选择

DialogUsage → startUsageDialog({ key, cached })
  → data.location.usage.sync(ref)（必要时 invalidate）
  → transitionUsageDialog → selectUsageDialogView
  → usageView(info) → BudgetRow/Callout/LimitAction → i18n 文案

ModelSelectorDrawer / DialogSelectModel
  → createModelUsage({ refresh: true }) → data.location.usage.limits(ref) → modelUsage(info, model, provider)
```

实验室入口：`/components` → `components-lab/lab.tsx`（默认导出）→ `createResource(loadCatalog)` → `import.meta.glob("../**/*.stories.tsx", "../../../ui/src/**/*.stories.tsx", "../../../session-ui/src/**/*.stories.tsx", "../../../gui-plugins/src/**/*.stories.tsx", "!../**/*.standalone.stories.tsx")`（另有 `?raw` 版本读源码顺序）。

## 数据与状态

- **目录就绪判定**：`useProviders` 的 `ready() = provider.list(ref) !== undefined && model.list(ref) !== undefined`；未就绪时返回 `emptyProviderCatalog`（`{ all: new Map(), connected: [], default: {} }`）。
- **冷启动重试**：`syncWhileBooting` = `retry(load, { attempts: 12, delay: 1000, maxDelay: 5000, retryIf: isServiceUnavailableError })`——Location 的插件激活可能比 server 的 5s 等待更慢。
- **Console settle**：`CONSOLE_SETTLE_POLL_MS = 250`、`CONSOLE_SETTLE_TIMEOUT_MS = 10_000`，状态 `idle`/`waiting`/`disposed`，outcome `loaded`/`timed-out`/`cancelled`。
- **用量面板**：状态 `loading`/`refreshing`/`ready`/`signed-out`/`failed`/`disposed`，带 `issued` 与 `attempt` 两个序号（丢弃过期结果），`USAGE_LOAD_TIMEOUT_MS = 15_000`；缓存读 `data.location.usage.limits(ref)`。
- **模型选择**：`ModelSelectionSchema` + `persisted`（按 server/directory 与 session 各存一份 `ModelChoice`/`AgentChoices`/`DurableSelection`）；`variant` 支持 `inherit`（跟随 agent）与显式 `default`。
- **实验室**：`catalog` resource（`{ entries, failed }`）、`?story=<file>`/`?view=grid` 查询参数、`LabEntry`（`file/title/args/argTypes/states/motion/fullscreen`）、每个 story 的 `parameters.motion` 决定检视器显示哪些动效旋钮。
- **fixture 运行时**：`dialog-story-runtime.tsx` 用固定 `STORY_SERVER` / `STORY_LOCKED_SERVER` / `STORY_DIRECTORY` 组装真实 provider 栈，避免 standalone 故事碰真实 storage。

## 关键不变式

- **provider 与 model 必须同时就绪**才算目录可用；只到一半时用空目录而不是半渲染。
- **Console 分组靠名称约定**：`consoleProviderGroup` 认 `"<workspace> / OpenCode"` 这个后缀，`consoleProviderName` 再把它切掉；改文案就分组失效。
- **settle 的 disposed 仍要应答**：状态机注释写明「调用方在 owner 消失后仍能得到结果，不会永远 await」；新逻辑不能破坏这一点。
- **`attempt` 单调递增，过期结果靠它丢弃**：连接、表单、settle、用量、模型选择都一样。
- **`refreshing` 必须继续显示上次缓存**（不闪空），`cache.synced` 只同步缓存、不重启加载。
- **免费模型不受预算约束**：`isFreeModel`（`provider.id === "opencode"` 且无费用）与 `modelUsage` 返回 `undefined` 是同一套判断。
- **`"default"` 变体是显式值**：`normalizeModelVariant` 把它当作「覆盖 agent 配置」，不能被当作 "未设置" 吞掉。
- **实验室里的 story 必须是真实组件**：`lab.tsx` 用 app 的 provider 栈渲染，不复制视觉；standalone 故事被 glob 排除，只能各自挂 fixture 运行时。
- **动效旋钮来自 `@opencode/ui/motion-tuning`**：实验室只做呈现与回放，不改动效实现。

## 扩展点

- **把供应商加进「热门」**：`providers/catalog/order.ts` 的 `popularProviders`（`opencode-go`/`opencode`/`anthropic`/`github-copilot`/`openai`/`google`/`openrouter`/`vercel`），并确认 `integrations` 里有同 id 的 integration。
- **加一种连接方式**：`connect/machine.ts` 的 `connectMethods()` + `dialog-machine.ts` 的步骤联合 + `form-machine.ts` 的表单步骤 + 文案 key。
- **加一段预算呈现**：`usage/limits.ts` 的 `BudgetLabel`/`BudgetNote`/`Callout`/`LimitAction` 联合 + `usage.*` i18n key；不要在组件里拼句子。
- **加一个 `usage` 数字格式**：`usage/format.ts` 的 `useUsageFormat`（货币/时间/短时间），组件只调用它。
- **加一个 story**：放进 glob 覆盖的四棵树之一（`packages/app/src`、`packages/ui/src`、`packages/session-ui/src`、`packages/gui-plugins/src`）且文件名 `*.stories.tsx`；要独立运行时用 `*.standalone.stories.tsx`（不进 lab）。
- **改实验室的 fixture**：`components-lab/dialog-story-runtime.tsx` 的 `STORY_*` 常量与假目录/文件系统。
- **改 mcp 对话框**：`providers/connect/mcp-machine.ts` 的状态 + `mcp.tsx` 的 `useMcpController`/`useMcpPool`。

## 常见改法与坑

- **别在实验室里读真实 storage**：standalone 故事必须走 `DialogStoryRuntime` 的 fixture，否则会污染开发者本地数据。
- **连接对话框一律动态 import**：`composer/commands.tsx`、`models/select-dialog.tsx`、`models/manage.tsx` 都是 `await import(...)` 再 `dialog.show`，加新入口请沿用，别静态引入。
- **不要绕过 `data.location.*` 直接 fetch**：会丢掉缓存、失效与跨窗口同步。
- **不要改 settle 的超时数字**：Console 目录在凭据写入后可能接近 10s 才到；缩短会让「刚连上还没有新模型」变成永久空列表。
- **`latestModels` 依赖 `family` + 免费标记**：免费模型和付费同胞共享 family/release_date，所以按 `${family}:${isFreeModel(x)}` 分组；改分组键会改变选择器默认项。
- **usage 文案用 `language.plural`**：`lab.failed` 就是复数 key 的例子；不要自己拼。
- **`DialogUsageExceeded` 与 `DialogUsage` 是两个入口**：前者由 `session/usage-exceeded-dialogs.tsx` 在请求被拒时弹，后者是主动查看；改文案时两边都要看。
- **实验室的 knobs 字段由 `argTypes`/`args`/`states` 推导**：story 里放非 `string|number|boolean` 的值会被静默跳过（`labFields` 的过滤）。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/app/src/providers/catalog/providers.ts` | `useProviders`、`syncWhileBooting`、空目录与 `ready()` |
| `packages/app/src/providers/catalog/console.ts` | Console 工作区的 provider 分组与命名 |
| `packages/app/src/providers/catalog/settle-machine.ts` | 凭据后轮询目录的状态机（250ms / 10s） |
| `packages/app/src/providers/connect/controller.ts` | `createProviderDialogController`：连接对话框的驱动 |
| `packages/app/src/providers/connect/machine.ts` | `connectMethods`、`transitionProviderConnect`（授权/轮询/重试） |
| `packages/app/src/providers/connect/dialog-machine.ts` | 对话框步骤、账号列表、集成常量与返回目标 |
| `packages/app/src/providers/models/selection.tsx` | `ModelSelection` 上下文与持久化选择 |
| `packages/app/src/providers/models/variant.ts` | `inherit`/`default`/具体变体的解析与循环 |
| `packages/app/src/providers/models/select-dialog.tsx` | `DialogSelectModel` / `ModelSelectorDrawer` |
| `packages/app/src/usage/dialog.tsx` | `DialogUsage` / `UsageDialogContent` 的渲染与刷新 |
| `packages/app/src/usage/limits.ts` | `usageView`/`modelUsage`：预算与额度 → 视图模型 |
| `packages/app/src/usage/machine.ts` | 用量加载状态机（15s 超时、issued/attempt） |
| `packages/app/src/usage/model.tsx` | `createModelUsage` / `ModelUsageTag`：模型行的剩余额度 |
| `packages/app/src/components-lab/lab.tsx` | 实验室页面：glob catalog、树、检视器、网格、播放 |
| `packages/app/src/components-lab/catalog.ts` | CSF story → `LabEntry`、knobs 字段与状态推导 |
