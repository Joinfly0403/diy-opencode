---
id: core/mcp-integration
title: MCP 集成
level: L1
layer: core
status: stable
paths:
  - packages/core/src/mcp
  - packages/core/src/tool/mcp.ts
  - packages/schema/src/mcp.ts
  - packages/schema/src/mcp-event.ts
symbols:
  - Mcp
  - McpConnection
  - McpPool
config_keys:
  - mcp
related:
  - core/tool-registry
  - core/plugin-system
keywords:
  - mcp
  - model context protocol
  - 服务器
  - stdio
  - oauth
  - 工具发现
source_hash: f7daf3d1f36209842e198a5743de176ef5be3801
---

## 职责

把外部 MCP server 接进 opencode：连接管理（stdio / HTTP / socket）、工具与资源发现、工具调用桥接、OAuth 授权、MCP 提供的 instructions 注入。

## 边界

- 不实现工具语义：只把 MCP 的 `tools` 映射成 `Tool.Info` 注册进工具注册表（`packages/core/src/tool/mcp.ts`）。
- 不做权限判定：MCP 工具和内置工具一样走 `Permission.assert`。
- 不做 UI：授权弹窗/表单在 TUI 与 app 侧（`Form` 是跨端的形式描述）。

## 入口与调用链

```
配置 mcp.* → Mcp 服务（Location 作用域）按 server 建连接（pool 复用）
          → 发现 tools/resources → 通过一个稳定 transform 注册进 Tool 服务
          → 运行期调用 → McpConnection.call → 结果归一化成 tool content
          → 工具列表变化：更新源数据 + Tool.Service.reload()（不追加新 transform）
```

## 数据与状态

- 连接与工具清单是 **State 捕获**，刷新时替换源数据再 reload；不同 server 各自独立，互不影响。
- `McpEvent` 是 MCP 专属事件域（连接状态、工具变化），跨进程通过 Bus 广播。
- OAuth 令牌等敏感信息走 `Credential`/`Integration`，不要写进 State 明文。
- stdio server 的生命周期随进程/作用域，进程退出要显式收尾（阻塞式清理会拖长 shutdown，见 `runtime/process-lifecycle` 的 10s 预算）。

## 关键不变式

- **MCP 只拥有一个稳定的 tool transform**：工具列表变化时更新内部源并 `reload`，绝不把自己追加到 transform 链尾——否则后续插件对同名工具的覆盖优先级会被破坏（这条是 `core/tool-registry` 的硬约束）。
- 工具名冲突按注册顺序裁决，MCP 工具与内置同名时行为取决于顺序，改顺序等于改行为。
- 刷新失败必须保留旧工具集（不能因为一次刷新失败把工具清空），对应"连接错误不清空列表"的容错语义。
- 未识别的 MCP 事件/字段不能导致连接失败，只能忽略或透传。

## 扩展点

- **加一种传输**：`mcp/stdio.ts`、`socket-client.ts`、`connection.ts` 里实现 `Transport` 适配，pool 里登记。
- **接 MCP resources/prompts**：走 `tool/mcp-resource.ts`（工具形态）而不是新注册表。
- **加一种授权方式**：`mcp/oauth.ts` + `Credential`；命令侧入口在 `cli mcp auth`。

## 常见改法与坑

- `mcp/index.ts` 是 1000 行级的单文件：改连接/刷新逻辑前先看清 pool 与 KeyedMutex 的加锁范围。
- MCP server 启动慢会拖慢首个模型请求（工具清单要等发现完成）；想改"先给模型不含 MCP 的定义"要同时考虑 reload 语义。
- stdio server 的子进程环境继承 `OPENCODE_PASSWORD` 一类敏感变量的问题，已在 serve 侧处理，别在 MCP 层再加一份白名单。
- 刷新与工具调用并发时，正在进行的调用应继续用旧连接完成，不要中途换连接。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/mcp/index.ts` | Mcp 服务、连接池、发现、刷新 |
| `packages/core/src/mcp/connection.ts` | 单个 server 连接与调用 |
| `packages/core/src/mcp/pool.ts` | 连接池复用 |
| `packages/core/src/mcp/stdio.ts` | stdio 传输 |
| `packages/core/src/mcp/socket-client.ts` | socket 传输 |
| `packages/core/src/mcp/oauth.ts` | OAuth 授权 |
| `packages/core/src/mcp/instructions.ts` | MCP instructions 注入 |
| `packages/core/src/tool/mcp.ts` | MCP 工具 → Tool 注册桥 |
| `packages/schema/src/mcp.ts`、`mcp-event.ts` | 配置与事件 schema |
