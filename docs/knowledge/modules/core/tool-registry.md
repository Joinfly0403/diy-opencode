---
id: core/tool-registry
title: 工具注册表与内置工具
level: L1
layer: core
status: stable
paths:
  - packages/core/src/tool.ts
  - packages/core/src/tool
  - packages/core/src/tool-output.ts
symbols:
  - Tool
  - RegistrationError
  - Editor
  - definition
  - execute
  - effectiveName
depends_on:
  - core/permission-policy
  - core/plugin-system
  - core/location-instance
  - core/session-execution
related:
  - core/mcp-integration
  - codemode/runtime
keywords:
  - tool
  - 工具
  - 注册表
  - namespace
  - codemode
  - 内置工具
  - 工具输出
source_hash: 9bccc250bba494d6812ab9a5f89302f2cdd84df0
---

## 职责

Location 作用域的工具服务：注册（register/transform）、按有效名查找、生成给模型的工具定义（含 namespace 扁平化）、执行、内容归一化。

- `tool.ts`：注册表本体（`Editor` 的 list/get/namespace/add/update/remove、`RegistrationError`、`State` 重放）。
- `tool/runtime.ts`：`definition` / `effectiveName` / `normalizedName` / `execute` / `normalizeContent`。
- `tool/plugin/*.ts`：19 个内置工具（read、write、edit、patch、glob、grep、shell、todo、skill、subagent、webfetch、websearch、image-generate、question、schedule、artifact、file-diff、mcp-resource、opencode）。
- `tool/search.ts` / `read-filesystem.ts` / `mcp.ts` / `html-markdown.ts` / `http-body.ts`：支撑运行时。
- `tool-output.ts`：输出边界与截断策略。

## 边界

- **注册表不做执行授权**（tool/AGENTS.md 明确）：它没有 `Permission.Service` 依赖；注册选项上的 permission action 只用于整体定义的可见性过滤。真正的授权在叶子工具里通过 `Permission.assert` 做。
- 不新增第二套可执行入口类型、注册表自己的 executor、授权回调、输出路径回调或旧式归一化路径（这是目录级硬约束）。

## 入口与调用链

```
内置层 / 插件 / MCP → Tool.Service.transform(editor => …) → 完整 tool 对象入 editor
                                                    ↓
模型请求 → 取当前快照的 definitions（有效名 + namespace 前缀）
        → execute → 叶子工具内部 Permission.assert → 返回内容 + 元数据
        → Session runner 统一做输出边界（tool-output）
```

## 数据与状态

- `Data` 里三张表：`tools`（当前注册）、`definitions`（注册时转换一次的 LLM 定义）、`namespaces`（namespace 描述，注册一次）。
- 共享 `State` 按注册顺序对**全新 editor** 重放同步 transform；`Tool.Service.reload()` 从捕获的源数据重建，不改变注册优先级。
- 每个模型请求捕获当次有效的 definitions 与 executors；之后的 reload/dispose 只影响后续快照（捕获的 executor 可能仍引用生产者可变状态）。

## 关键不变式

- **有效名裁决**：同名（有效名）以"最新且有效的活跃注册"为准；`update`/`remove` 针对有效名，缺失即 no-op；`update` 保留名字与 namespace，非法更新保留旧定义；创建必须 `add`。
- **dispose 语义**：注销一个注册只移除它的 transform 并按剩余 transform 重建，从而"露出"被它覆盖的先前定义；`dispose` 必须幂等。
- **namespace**：提供 namespace 的工具对模型扁平化为 `<namespace>_<tool>`；未注册的 namespace 仍合法、只是没有描述；默认进 CodeMode（`codemode: false` 才留在 provider 原生工具列表）。
- **MCP 只用一个稳定 transform**：读到最新发现的工具后 `reload`，不要把自己追加到 transform 链尾，否则会破坏后续插件覆盖的优先级。
- **注册即类型安全终点**：注册后按 `Tool.Info` 擦除；运行期校验模型输入与声明输出；不要在存储/执行链里携带生产者 schema 泛型。
- **叶子自己的编排**：叶子负责解析、权限、副作用顺序；只把预期类型化错误翻成 `ToolFailure`，不要用 `catchCause`（中断与缺陷必须存活）。用户拒绝（`Permission.DeclinedError`）与问题关闭以缺陷形式穿过 `mapError`，到 `SessionModelRequest.executeTool` 再变回类型化失败；带反馈的拒绝（`Permission.CorrectedError`）保持类型化，由叶子翻成 `ToolFailure` 让模型继续。

## 扩展点

- **加一个内置工具**：`tool/plugin/<name>.ts` → 在工具注册处挂进 Location 图层 → 补权限动作 → 补测试（含拒绝路径）。
- **加一个插件工具**：走 `Tool.Service.transform`（插件侧 API 见 `core/plugin-system`）。
- **加 namespace**：`editor.namespace(...)` 注册描述，工具选项仍按字符串引用 namespace。
- **改输出边界**：改 `tool-output.ts` 会影响所有工具与 runner（截断、保留路径、图片归一化都在这里）。

## 常见改法与坑

- 在注册表里加授权钩子 → 违反目录约定，且会绕过叶子自己的策略。
- 用 `update` 创建新工具（无效），必须 `add`。
- 在 transform 里做重 I/O：transform 会被重放多次，副作用会重复。
- MCP 工具列表变化时应在原 transform 内 reload，而不是重新注册到链尾。
- 工具名不允许重复有效名，排障先看 `RegistrationError`。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/tool.ts` | 注册表、有效名、执行入口 |
| `packages/core/src/tool/runtime.ts` | definition/execute/归一化原语 |
| `packages/core/src/tool/plugin/*.ts` | 19 个内置工具 |
| `packages/core/src/tool/search.ts` | grep/glob 支撑 |
| `packages/core/src/tool/read-filesystem.ts` | read 的虚拟文件系统 |
| `packages/core/src/tool/mcp.ts` | MCP 工具桥 |
| `packages/core/src/tool-output.ts` | 输出边界与截断 |
