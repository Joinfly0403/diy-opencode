---
id: core/plugin-system
title: 插件系统与扩展点
level: L1
layer: core
status: stable
paths:
  - packages/core/src/plugin.ts
  - packages/core/src/plugin
  - packages/plugin/src
  - .opencode/plugins
symbols:
  - Plugin
  - PluginHooks
  - PluginSupervisor
  - InstancePlugins
  - PluginHost
events:
  - experimental.ws.handshake
depends_on:
  - contracts/config-flag
  - core/location-instance
related:
  - core/tool-registry
  - session-ui/tool-renderers
keywords:
  - 插件
  - plugin
  - hook
  - 扩展点
  - 激活
  - 热重载
  - gui 插件
source_hash: d35229b9ccfa7fe85223fedfa57fd72e1cf69dce
---

## 职责

加载、激活、重载、卸载第三方扩展，并把它们的能力（工具、agent、命令、skill、provider、hook、GUI 面板）挂进运行时。

三个面向：
- `packages/core/src/plugin.ts` + `plugin/`：服务实现（激活槽位、锁、就绪闩、hook 分发、supervisor、实例插件）。
- `packages/plugin/src/{effect,promise,gui,tui}`：给插件作者的四套 API 形态（Effect / Promise / GUI 面板 / TUI 面板）。
- `.opencode/plugins`：**本仓自用的插件目录**（示例与内部扩展）。

## 边界

- 插件不拥有权限判定（走 `Permission`），也不直接改注册表内部结构（走 `editor` transform）。
- core 不解析插件源码语义：只负责生命周期、隔离、错误边界与 hook 广播。

## 入口与调用链

```
Plugin.Service 激活 → 每个声明的 plugin 一个 slot（按声明顺序，含激活失败的）
                  → prefix diff 计算要重建的前缀 → 用 Semaphore(1) 串行重建
                  → hook 广播（PluginHooks）→ 各消费方（tool/agent/command/skill/provider/session）
                  → 失败 revision 不重试，直到声明变化
```

## 数据与状态

- 激活槽位 `active` 与声明顺序**索引对齐**：失败也要占位，否则 diff 错位会导致错误的插件被重建/重试。
- `Latch`（ready）+ `holdUnsafe/pending` 计数实现"激活期间不对外宣告就绪"。
- 插件状态走 `State`（可重放），凭证类东西走 `Credential`。

## 关键不变式

- 一个插件 revision 激活失败后**不会自动重试**，只有声明变化才会；排障时先看 plugin 状态事件。
- 插件图层的重建是串行的（`Semaphore.makeUnsafe(1)`），别在里面做长阻塞。
- 插件 hook 命名：实验性 hook 用 `experimental.*` 前缀（例如 `experimental.ws.handshake`）。
- 插件对工具注册的影响必须通过 `Tool.Service.transform`，且**注册顺序决定覆盖**（见 `core/tool-registry`）。

## 扩展点

- **写一个插件**：选形态（effect/promise）→ 导出插件对象（id/source/state）→ 在配置 `plugin` 或 `.opencode/plugins` 里声明 → 用 hook 挂能力。
- **加一个 hook**：在 `plugin/hooks.ts` 定义事件类型 → 在对应消费方广播 → 补类型化的载荷。
- **GUI/TUI 面板插件**：见 `plugin/src/gui`、`plugin/src/tui`，面板与 `gui-plugins/*` 的实现配套。
- **热重载**：`Plugin.Service` 的 reload + `LocationServiceMap.reload()`。

## 常见改法与坑

- 激活失败被静默：插件没生效时先查 plugin 状态，而不是重装。
- 在 hook 里做副作用而不捕获错误，会让一次广播拖垮整条链路。
- 插件与内置工具同名 → 按注册顺序覆盖，排查"内置工具行为变了"先看有没有插件抢先注册。
- `mcp-codemode-defaults.ts`、`tool-input-repair.ts`、`optimize.ts` 这类"内置插件"会改变模型可见的工具定义，改它们等于改全局行为。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/plugin.ts` | 激活、槽位、重建、就绪 |
| `packages/core/src/plugin/hooks.ts` | hook 定义与广播 |
| `packages/core/src/plugin/service.ts` | Service 接口与 Generation |
| `packages/core/src/plugin/supervisor.ts` | 生命周期监管 |
| `packages/core/src/plugin/instance.ts` | 实例级插件装配 |
| `packages/plugin/src/effect`、`promise` | 两种插件作者 API |
| `packages/plugin/src/gui`、`tui` | 面板类插件 API |
