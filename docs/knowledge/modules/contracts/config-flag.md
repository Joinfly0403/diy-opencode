---
id: contracts/config-flag
title: 配置与 feature flag
level: L0
layer: contracts
status: stable
paths:
  - packages/schema/src/config
  - packages/core/src/config.ts
  - packages/core/src/config
  - packages/core/src/flag.ts
  - packages/core/src/managed-policy.ts
symbols:
  - Config
  - Flag
  - Service
  - resolve
  - latest
config_keys:
  - experimental.*
  - experimental.all_flags
  - permissions
  - skills
  - mcp
  - providers
depends_on:
  - contracts/events-db
related:
  - core/plugin-system
  - core/tool-registry
keywords:
  - 配置
  - config
  - opencode.jsonc
  - flag
  - feature flag
  - 实验开关
  - managed policy
source_hash: 63b7a66513dc192b3086e968d3f5cdcf6136b4a9
---

## 职责

两层：**配置文档**（jsonc/json 多层合并、变量替换、发现与监听）与 **feature flag**（带优先级的开关求值）。

- schema 层：`packages/schema/src/config/*.ts` 按域定义配置结构与校验（agent、command、compaction、experimental、flag、formatter、lsp、mcp、media、model、plugin、policy、provider、reference、shell、tool-output、warming、watcher、websearch、worktree）。
- core 层：`packages/core/src/config.ts` 提供 `Config.Service`（`entries()`/`latest()`），`config/` 下是发现（discovery）、托管（managed）、归一化（normalize）、变量（variable）、监听（watch）、markdown 配置块等实现。

## 边界

- 不在 schema 里写业务默认行为，只描述形状与校验；默认值/派生值在核心逻辑里。
- flag 不是"配置开关"的另一种写法：flag 是**发版用的临时闸门**，上线后要删；配置是长期契约。

## 入口与调用链

- `Config.latest(entries, key)`：取"最高优先级文档里设置过该 key"的值——**任何按 key 读配置的地方都应该走它**，不要自己遍历 entries 覆盖。
- `Flag.resolve({ entries, channel, overrides })` 求值顺序（高→低）：
  1. `OPENCODE_FLAGS` 环境变量（逗号分隔，`-` 前缀关闭，`all` 全开）；
  2. 最高优先级文档的 `experimental.<key>`；
  3. 最高优先级文档的 `experimental.all_flags: true`（`false` 不生效，回落）；
  4. channel 默认值：只有 `local` 与 `dev` 默认开，release/beta 默认关。

## 数据与状态

- 配置来源分层：全局配置目录（`OPENCODE_CONFIG_DIR` 可覆盖）、项目配置、托管策略（`config/managed.ts`、`managed-policy.ts`，只允许收紧不允许放宽）、`.opencode/` 目录约定。
- `config/watch.ts` 监听变更并触发重载；重载会波及 `LocationServiceMap.reload()`。
- `config/variable.ts` 负责 `{env:...}`/`{file:...}` 一类变量替换，替换发生在校验之前。

## 关键不变式

- 团队/托管策略只能收紧；用户级配置不能放宽托管策略（这是"不可信仓库"场景的底线）。
- 新 flag 必须同时写进 `packages/schema/src/config/flag.ts` 的注册表并给描述，否则 `Flag.enabled` 拿不到；上线完成后要删 flag 与所有读取点。
- 新增 schema 配置域时遵循 `src/config` 的自导出约定：文件顶部 `export * as ConfigAgent from "./agent.js"` 这种形式。
- 配置解析在**拥有边界的那一层做一次**，往里传类型化值，别反复 `typeof` 检查。

## 扩展点

- **加一个配置项**：`schema/src/config/<domain>.ts` 加字段 → `core` 里读取 → 需要热重载的挂到 `watch` → 文档站（`services/site` 的 docs content）同步。
- **加一个 flag**：`flag.ts` 注册 + `Flag.enabled("<key>")` 读取 + PR 里说明闸门。
- **加一层配置来源**：`config/discovery.ts` 与 `normalize.ts` 一起改，注意优先级与 `latest()` 语义。

## 常见改法与坑

- `experimental.*` 同时被配置和 flag 使用，容易混淆：flag 读 `experimental.<flagKey>`，普通实验配置是长期项。
- `all_flags` 不是 flag key，别当普通 key 注册。
- 改 `Config.latest` 行为会同时影响 flag 求值、插件配置、provider 配置，属于高爆炸半径改动。
- 环境变量与配置同名时以环境变量为准（例如 `OPENCODE_CONFIG_DIR`）。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/config.ts` | `Config.Service`、`latest`、`Options` |
| `packages/core/src/flag.ts` | flag 注册表求值与优先级 |
| `packages/schema/src/config/*.ts` | 各域配置 schema、flag 注册表 |
| `packages/core/src/config/discovery.ts` | 配置发现 |
| `packages/core/src/config/managed.ts` | 托管策略 |
| `packages/core/src/config/watch.ts` | 变更监听与重载 |
| `packages/core/src/managed-policy.ts` | 托管策略生效点 |
