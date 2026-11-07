---
id: app/settings
title: 设置页（客户端偏好、provider 与模型凭据）
level: L2
layer: app
status: stable
paths:
  - packages/app/src/settings
symbols:
  - Settings
  - projectSettingsKey
  - monoDefault
  - sansDefault
  - terminalDefault
  - pageIcons
  - pageLabels
  - settingsViewRedirect
  - serverPagesConnection
  - canIndexServerSettings
  - canHoldProjectRoute
  - resolveServerAvailability
  - SERVER_RETRY_TIMEOUT_MS
  - createServerRetryState
  - createSettingsProvidersState
  - transitionSettingsProviders
  - createModelsRevealState
  - MODELS_REVEAL_TIMEOUT_MS
  - providerAccounts
  - activeProviderAccount
depends_on:
  - app/runtime
  - app/workspaces-servers
related:
  - app/composer
  - core/provider-models
keywords:
  - 设置
  - settings
  - 偏好
  - 字体
  - 主题
  - keybind
  - provider
  - 凭据
  - 模型可见性
  - 搜索
  - 页面路由
source_hash: 2100950d0e6562cb6d228549941252b8334da917
---

## 职责

- 设置页的页面结构（root tab / per-server tab / per-project tab）、导航与搜索、每页的读取与写入。
- 两类数据严格分开：
  - **客户端偏好**（`settings/model.tsx` 的 `Settings` schema）：外观、字体、通知、快捷键、时间线详情、工作区默认目的地、按 scope 的项目设置。
  - **server 侧配置**（providers 凭据、模型可见性/收藏、server 列表、项目与工作区）：通过 API 读写，失败要保留用户已做的改动。
- provider 与模型凭据 UI：连接/切换/重命名/移除账号，模型可见性与收藏，以及“从 Providers 跳到 Models 并定位”。

## 边界

做什么：设置页视图与路由、偏好持久化、设置搜索与定位、每页的状态机与驱动。

明确不做：

- 不实现 provider 目录、模型解析与请求（`core/provider-models`、`packages/server`）。
- 不实现 server 连接建立与健康检查（`app/workspaces-servers`、`app/runtime`）。
- 不写 CSS 变量映射之外的主题逻辑（字体写到 `--font-family-*` 由本模块负责）。

## 入口与调用链

```
settings/shell.tsx  → Tabs + SettingsNavigation + 内容 Switch
  ├─ rootClientTabs:  general / appearance / notifications / shortcuts     （纯客户端）
  ├─ serverTabs:      providers / models / extensions / projects / workspaces（按 server）
  └─ per-project:     general / workspaces / extensions
settings/route.ts   → SettingsView union、settingsViewRedirect、rootTabs 表
settings/search-*   → 搜索索引（search-index.ts）+ 结果 + 定位（search-reveal.ts）
settings/model.tsx  → persisted(...) 读写 `Settings`，并把字体/主题写到 CSS 变量
```

- provider 页：`providers/machine.ts` 的 `SettingsProvidersState`（`live` / `holding`）—— 对话框或账号操作进行中时，Connected 列表停在 `held` 快照。
- server 页可达性：`servers/machine.ts` 的 `resolveServerAvailability` → `serverPagesConnection` / `canHoldProjectRoute` 决定显示“不可达”占位而不是空列表。

## 数据与状态

- `Settings`（`model.tsx`）是单一的持久化 schema，用 `persisted` 落到 localStorage / 桌面 namespace；键名变更等于用户设置丢失。
- 字体：`monoDefault` = `IBM Plex Mono`、`sansDefault` = `Inter`、`terminalDefault` = `JetBrainsMono Nerd Font Mono`；用户选择写进 `--font-family-sans/mono` 与 v2 变量。
- 项目设置按 `projectSettingsKey(scope, projectID)` 存：projectID 只在单个 server 内唯一，键必须带 scope。
- provider 账号：`ProviderAccount` = `ConnectionInfo` 里的 `type: "credential"`；`activeProviderAccount` 取第一条。
- 模型展示：可见性（show/hide）、收藏、最近使用、per-model variant 都由 settings + server 目录共同决定。
- server 重试：`createServerRetryState` / `transitionServerRetry`，上限 `SERVER_RETRY_TIMEOUT_MS`（35s），超时后不再自动重试。

## 关键不变式

- **不要读字体/主题设置再自己拼回退**：字体设置只由 `settings/model.tsx` 写 CSS 变量，其它表面用变量（`packages/app/AGENTS.md` Fonts）。生产 CSS 里禁止写字面 font-family。
- **客户端偏好与 server 配置的写路径不同**：偏好走 `persisted`（本地、可离线）；provider/模型/server 改动必须等 server 确认，失败保留状态（AGENTS.md “A result that arrives late can still have side effects”）。
- 每个会阻塞的页面（连接、刷新、凭据校验、reveal）都要有状态机与超时，不能停在 “Loading”。
- 页面结构以 `route.ts` 的 union 为准：新增 tab 要同时改 `SettingsRootTab`、`rootTabs`（`route.ts`）、`pageIcons`、`pageLabels` 与 `shell.tsx` 的 Switch。
- i18n：只加英文源串，用 `language.t/plural`；不要改既有英文 key（AGENTS.md Localization）。

## 扩展点

- **加一个设置页**：`route.ts` 的 `SettingsRootTab` + `rootTabs` → `pages.ts` 的 `pageIcons`/`pageLabels` → `shell.tsx` 挂组件 → `search-index.ts` 加入可搜索项。
- **加一个偏好字段**：`model.tsx` 的 `settingsSchema` 加字段 + 默认值 → 消费方从 `useSettings()` 读。
- **加一个 per-server 页面**：`SettingsServerTab` 加值 → `serverTabs` + `serverPages` 标题/描述 → `serverPagesConnection` 的不可达处理。
- **加 provider 账号操作**：`providers/machine.ts` 加状态/事件 → 驱动里调 API → `account-actions.ts` 落实现。
- **加 GUI 插件的设置页**：走 `runtime/plugin/settings-pages`，不要改 `SettingsRootTab`。

## 常见改法与坑

- 改 `settingsSchema` 的字段名/结构且不加迁移 = 用户设置静默重置；旧字段要么保留解码，要么显式迁移。
- `serverPagesConnection` 与 `canHoldProjectRoute` 决定“不可达时是否保留路由”；改它会让深链接在服务器离线时跳到设置首页。
- provider 的 `holding` 状态是为了避免目录刷新把列表抽空；在 `holding` 里直接读 live 目录会出现行闪烁或消失。
- keybinds 有 `migration.ts`：改默认键位要同时更新迁移与冲突检测。
- 搜索索引是显式注册的，新页面不加索引项就搜不到（不会自动扫描）。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/app/src/settings/shell.tsx` | 设置页外壳：tab、导航、内容 Switch |
| `packages/app/src/settings/route.ts` | `SettingsView` union、root tab 表、`settingsViewRedirect` |
| `packages/app/src/settings/pages.ts` | 页面图标与标题 key |
| `packages/app/src/settings/model.tsx` | `Settings` schema、字体/主题写 CSS 变量 |
| `packages/app/src/settings/search-index.ts` | 设置搜索索引与结果 |
| `packages/app/src/settings/providers/machine.ts` | provider 列表状态机（live/holding） |
| `packages/app/src/settings/providers/accounts.ts` | 凭据账号选择器 |
| `packages/app/src/settings/models/machine.ts` | 从 Providers 跳转定位（reveal）状态机 |
| `packages/app/src/settings/servers/machine.ts` | server 可达性、重试状态、页面可用性 |
| `packages/app/src/settings/servers/inventory.ts` | 设置页内的 server 清单 |
| `packages/app/src/settings/keybinds/migration.ts` | 键位迁移与冲突 |
| `packages/app/src/settings/workspaces/queries.ts` | 项目/工作区查询与预取 |
| `packages/app/src/settings/experimental/experimental.tsx` | 实验特性开关页 |
| `packages/app/src/settings/server-scope.tsx` | 按 server 切换设置数据作用域 |
