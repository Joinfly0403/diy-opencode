---
id: codemode/tool-surface
title: Code Mode 对外表面（标准库 / 工具与命名空间 / OpenAPI / 错误类型）
level: L1
layer: codemode
status: draft
paths:
  - packages/codemode/src/stdlib
  - packages/codemode/src/openapi
  - packages/codemode/src/index.ts
  - packages/codemode/src/extension.ts
  - packages/codemode/src/namespace.ts
  - packages/codemode/src/scan.ts
  - packages/codemode/src/suspend-error.ts
  - packages/codemode/src/tool-error.ts
  - packages/codemode/src/tool-schema.ts
  - packages/codemode/src/tool.ts
  - packages/codemode/src/tools.ts
symbols:
  - CodeMode
  - Extension
  - Namespace
  - OpenAPI
  - Tool
  - ToolError
  - toolError
  - SuspendError
  - SnapshotError
  - toBytes
  - fromBytes
  - searchSignature
  - toolExpression
  - Services
  - isAsync
  - make
  - isTool
  - isNamespace
  - JsonSchema
  - SchemaType
  - Tools
  - toTypeScript
  - jsonSchemaToTypeScript
  - inputProperties
  - inputTypeScript
  - outputTypeScript
  - isEmptyInput
  - decodeInput
  - decodeOutput
  - identifierSegment
  - scanTools
  - fromSpec
  - invoke
  - operationPath
  - operationInput
  - operationOutput
  - specServerUrl
  - validateBaseUrl
  - securitySchemes
  - securityRequirements
  - componentDefinitions
  - hasDirectionalSchemas
  - methods
  - Plan
  - Skipped
  - Credential
  - SecurityScheme
  - AuthResolver
  - arrayGlobal
  - callbackMethods
  - stringGlobal
  - mapGlobal
  - setGlobal
  - weakMapGlobal
  - weakSetGlobal
  - groupBy
  - iteratorGlobals
  - consoleGlobal
  - formatValue
  - dateGlobal
  - regexpGlobal
  - jsonGlobal
  - mathGlobal
  - numberGlobal
  - booleanGlobal
  - objectGlobal
  - objectAssign
  - enumerableSource
  - uint8ArrayGlobal
  - textEncoderGlobal
  - textDecoderGlobal
  - TextDecoderObj
  - headersGlobal
  - urlGlobal
  - urlSearchParamsGlobal
  - uriGlobal
  - base64Global
  - structuredCloneGlobal
  - cryptoGlobal
  - coerce
  - coercion
  - compoundOperators
  - Coercion
tests:
  - packages/codemode/test/codemode.test.ts
  - packages/codemode/test/scan.test.ts
  - packages/codemode/test/signature.test.ts
  - packages/codemode/test/stdlib.test.ts
  - packages/codemode/test/openapi.test.ts
  - packages/codemode/test/extensions.test.ts
  - packages/codemode/test/tool-paths.test.ts
  - packages/codemode/test/errors.test.ts
  - packages/codemode/test/parity.test.ts
  - packages/codemode/test/engines.test.ts
depends_on:
  - codemode/runtime
related:
  - core/tool-registry
  - contracts/config-flag
keywords:
  - codemode
  - 标准库
  - stdlib
  - Value
  - Obj
  - openapi
  - 命名空间
  - namespace
  - extension
  - fetch
  - 签名
  - 类型渲染
  - ToolError
  - SuspendError
source_hash: a3074f96205373f04fe39765e9f262151a66803b
---

## 职责

Code Mode 包**对外的表面**（执行引擎在 `codemode/runtime`）。六块：

1. **内建标准库 `stdlib/`**（16 个文件）：每个全局/构造器一个工厂 `xxxGlobal(ctx: Interpreter<R>)`，返回程序可见的 `Value`（`Obj` 子类）。覆盖 Array、String、Object、Number、Boolean、Map/Set/WeakMap/WeakSet、Date、RegExp、JSON、Math、捕获式 console、URL/URLSearchParams/URI 函数、TextEncoder/TextDecoder/Uint8Array、Headers、Iterator 与 Iterator helper、`atob`/`btoa`、`structuredClone`、`crypto`。
2. **工具与命名空间声明**：`Tool.make`（Effect Schema 或 render-only JSON Schema + `execute`）、`Namespace.make`、`Tools` 递归类型、`isTool`/`isNamespace`。
3. **模型可见签名渲染 `tool-schema.ts`**：Effect Schema / JSON Schema → TypeScript 签名字符串（`inputTypeScript`/`outputTypeScript`），外加 `inputProperties`（名字/描述/必填）、`isEmptyInput`、`decodeInput`/`decodeOutput`。
4. **OpenAPI → 工具命名空间 `openapi/`**：`fromSpec` 把 OpenAPI 3.x 每个可表示 operation 变成一个工具（`operationId` 的 `.` 分段产生命名空间），不可表示的进 `skipped`；`runtime.invoke` 负责真正发请求（auth 解析、参数/body 序列化、响应与错误）。
5. **错误类型**：`ToolError`/`toolError`（工具拒绝/失败）、`SuspendError`（挂起被阻塞，带阻塞调用路径）、`SnapshotError`（快照不可恢复）。
6. **静态扫描 `scan.ts`**：从程序源码抽出 `tools.<path>` 调用（首见顺序），拒绝动态下标与别名。

## 边界

- **执行引擎归 `codemode/runtime`**：`vm/`、`interpreter/`、`codemode.ts`（`make`/`execute`/挂起恢复）、`data.ts`（`fromJson`/`toBoundary`）、`tool-runtime.ts`（调用桥）。本卡不写解释循环、字节码、快照编解码、limits。
- **`stdlib/` 只有一份实现**：两个引擎各自在 `interpreter/globals.ts` 与 `vm/runtime/globals.ts` 里把同一批 `xxxGlobal` 组装成全局表——**注册在引擎侧，这里只提供实现**。
- **不做运行期 schema 校验（JSON Schema 分支）**：`tool.ts` 注释写明"CodeMode does not validate values against these schemas"；只有 Effect Schema 会解码。
- **不做授权**：`execute` 里的权限由宿主决定；OpenAPI 的凭据由宿主 `auth.resolve` 在调用时解析，永不出现在模型可见签名里。
- **不是 HTTP 客户端**：`openapi/runtime.ts` 只依赖 `HttpClient.HttpClient`（需求并入运行时环境），代理/超时/重试/重定向策略在宿主与 `TODO.md` 的 follow-up 列表里。
- **`scan.ts` 不是沙箱**：它只做静态路径抽取（供调度检查用），真正隔离在执行引擎。

## 入口与调用链

```
宿主装配（core/codemode/tool.ts，见 core/platform-foundations）
  Tool.make / Namespace.make 构造工具树
    → CodeMode.make({ tools, extensions, hooks, engine })
    → runtime.catalog() → tool-schema 渲染签名 → 模型说明（Instructions）

程序里
  tools.ns.name(input)
    → 引擎把路径解析到 Tool → decodeInput（仅 Effect Schema）→ execute → decodeOutput（同上）
    → 失败用 ToolError/toolError 回传，模型侧显示为 ToolFailure

宿主全局函数
  Extension.make({ name, globals }) → CodeMode.make({ extensions })
    → 引擎把每个可达函数注册为全局（对象里的函数按路径命名，如 fs.readFile）
    → isAsync 决定被拒绝的调用是 reject 还是 throw

OpenAPI
  OpenAPI.fromSpec({ spec, baseUrl, auth, headers })
    → spec.ts：operationOutput / operationInput / operationPath / securityRequirements / specServerUrl
    → make({ input: inputSchema(fields), output, execute: (i) => invoke(plan, i) })
    → runtime.invoke：buildUrl/必填校验 → resolveAuth → HttpClient.execute → 读体/解 JSON → ToolError
    → 返回 { tools, skipped }（宿主把它挂到自己的 tools 树下）

调度检查
  scanTools(code) → Result<string[], Diagnostic>
```

## 数据与状态

- **工具是纯值**：`Tool<R> = { _tag: "CodeModeTool", description, input, output, execute }`；`Namespace<R> = { _tag: "CodeModeNamespace", description?, tools }`；`Tools<R>` 是开放的递归记录（键名即路径段，`.` 会产生嵌套）。
- **环境是类型参数**：`Tool.make<I, O, R>` 的 `execute` 与 `Extension` 里 Effect 返回值的需求会并入 `CodeMode.make` 的运行时环境（`Services<E>` 做推导）。
- **同步性**：`isAsync(global)` = 原生 `async` 函数 或 被 `Extension.async` 放进 WeakSet 的普通函数。
- **OpenAPI 的 `Plan` 是纯数据**：`{ operation, url, fields, body, security, schemes, auth, headers }`；`Skipped = { method, path, reason }`；`Result = { tools, skipped }`；工具容器用 `Object.create(null)`（无原型，避免 `__proto__` 之类键污染）。
- **签名渲染无状态**：纯函数，受 `MAX_RENDER_DEPTH = 8` 与 `identifierSegment` 正则（合法标识符才不加引号）约束；`InputProperty = { name, description, required }`。
- **`scanTools` 的产物**：首见顺序的路径数组；失败是 `Diagnostic`（与引擎共用 `ParseError`/`UnsupportedSyntax`，错误信息带行列位置）。
- **`SuspendError.running`**：每个阻塞挂起的宿主调用一条 `{ path }`（`tools.x.y`、`search`、`fetch`）；状态没保存成功/超限时为空数组。
- **快照字节**：`toBytes` = UTF-8 JSON 编码，`fromBytes` = 严格 UTF-8 + JSON 解析（失败抛 `SnapshotError`）。

## 关键不变式

- **程序面的值只能是 `Value`**（packages/codemode/AGENTS.md）：宿主值是 `unknown`，只能经 `fromHost`/`fromJson` 进入；**不要**把面向程序的签名放宽成 `unknown`。
- **每种内建对象是一个 `Obj` 子类**（`Wrapper` 或 `Opaque`），只覆写需要的钩子；**问对象，不要加 `instanceof` 长链**（AGENTS.md）。
- **标准库单份、两引擎共享**：改 `stdlib/` 必须同时过 `test/parity.test.ts` 与 `test/engines.test.ts`；新增全局要在两个 `globals.ts` 都注册。
- **JSON Schema 只塑造签名**：`decodeInput`/`decodeOutput` 对 JSON Schema 输入原样透传；想校验就传 Effect Schema。
- **签名渲染永不失败**：`toTypeScript`/`jsonSchemaToTypeScript` 捕获一切异常返回 `"unknown"`，`inputProperties` 出错返回 `[]`——加关键字时保持"不能表示就 unknown"。
- **`isEmptyInput` 依赖 Effect 的空 struct 标记**（`{ not: { type: "null" } }`，且除 annotations 外无其它键），不是"没有 properties"；raw JSON Schema 才回退到 `"{}"` 判定。
- **`Extension.make` 只做浅层形状校验**：每个全局必须是函数或对象，否则构造时抛 `TypeError`；命名冲突（遮蔽内建/另一个扩展）在 `CodeMode.make` 时才抛。
- **被 before hook 拒绝的调用"像调用本身一样失败"**：异步全局 reject promise，同步全局 throw；这就是 `Extension.async` 存在的理由。
- **OpenAPI 的不可表示项一律进 `skipped`，不抛错**：参数编码（`style`/`explode`/`allowReserved`/`content`、cookie 参数）、非 JSON 请求体、`x-websocket`、SSE、二进制响应、相对或带 query/fragment 的 server URL，各有 reason 字符串。
- **operation 命名有冲突降级链**：`operationId` 按 `.` 分段 → 首段冲突则与前一段 camel 合并 → 再不行 `<joined>_<n>`（从 2 开始）；名字不能与已有工具或命名空间前缀撞。
- **`readOnly` 省略、`writeOnly` 省略只影响签名**：nested JSON body 属性与解码后的响应值原样通过（README 明确）。
- **先校验输入，再解析 auth**（`runtime.invoke` 注释）：`buildRequest` 里的 URL 与必填校验在 `resolveAuth` 之前，凭据刷新不能掩盖输入错误。
- **错误形态统一**：传输错误、非 2xx、JSON 解析失败都走 `toolError("<METHOD> <path> …")`；错误体截断到 1024 字符，响应体上限 50 MiB。
- **`scanTools` 只接受静态调用**：`tools[name]`（动态下标）、把 `tools` 起别名/传参都返回 `UnsupportedSyntax`，且做词法作用域遮蔽判断（`tools` 被局部变量遮蔽时不采集）。

## 扩展点

- **加一个内建全局**：`stdlib/<kind>.ts` 导出 `xxxGlobal(ctx)` → `interpreter/globals.ts` 与 `vm/runtime/globals.ts` 的 `table` 各加一项 → 补 `stdlib.test.ts`/`parity.test.ts`。
- **加一种内建对象**：`interpreter/objects.ts` 里的 `Obj` 子类（`Wrapper`/`Opaque`）+ 覆写钩子 → 在该类型的 stdlib 文件里用（不要新增 instanceof 分支）。
- **加签名渲染能力**：`tool-schema.ts` 的 `renderSchema`（新 JSON Schema 关键字）与 `docTags`（`@deprecated/@default/@format/@minimum/…`）。
- **接一个新 API 描述格式**：照 `openapi/` 的分层——`types.ts`（`Plan`/`Skipped` 契约）、`spec.ts`（纯解析，无 IO）、`index.ts`（组装 `Tool.make`）、`runtime.ts`（执行）。
- **加认证方案**：`openapi/types.ts` 的 `SecurityScheme`/`Credential` 联合 + `runtime.ts` 里应用（header/query/cookie 载体）。
- **加一条静态检查**：`scan.ts` 里复用 `interpreter/execute.ts` 的 `parseProgram` 与 `interpreter/model.ts` 的 `formatLocation`，输出 `Diagnostic` 而不是抛错。
- **改模型侧签名形状**：`tool-schema.ts` 影响所有工具（含 MCP/内置工具经 core 桥接后的签名）——改完要跑 `signature.test.ts`。

## 常见改法与坑

- 在 stdlib 里写 `instanceof` 判断具体对象类型：违反 AGENTS，且 VM 侧对象可能不是同一个子类；应当问对象（`Obj` 钩子）。
- 只在一个引擎注册新全局：`engines.test.ts`/`parity.test.ts` 会挂——两个引擎必须绑定同一批全局名。
- 传 JSON Schema 却期待运行期校验：不会发生；`decodeInput` 对它有 `isEffectSchema` 分支。
- 在 `renderSchema` 里 throw：整条签名退化成 `unknown`，症状是"工具描述突然只剩签名 unknown"，很难回溯；保持 `unknown` 兜底。
- 给 `$ref` 展开循环定义：`hasUnresolvedRef`/`seen` 会把它们渲染成 `unknown`，不要试图"猜"。
- 在 `fromSpec` 里对不支持的 operation 抛错：会连累整个 spec；必须进 `skipped` 并写清 reason。
- 期待 cookie 参数或非 JSON 请求体可用：`TODO.md` 明确是 follow-up，当前进 `skipped` 才是正确行为。
- 认为 OpenAPI 输出值会被 schema 过滤：只有签名受影响，运行期值原样通过。
- 在 `invoke` 之前解析 auth：会破坏"先校验输入"的顺序。
- 在 `scanTools` 里放过 `tools[expr]`：调度检查无法静态确定目标工具，注释里列出必须拒绝。
- 忘记 `Extension.async`：返回 Promise 的普通函数会被当成同步全局，被拒绝时 throw 而不是 reject，程序的 `catch` 位置会变。
- 把 `Namespace.description` 当成必填：它是可选的，且会参与 `search` 的匹配与目录摘要，删掉会让模型更难发现工具。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/codemode/src/index.ts` | 包门面：`CodeMode`/`Extension`/`Namespace`/`Tool`/`OpenAPI` 五个命名空间 + 快照/签名/错误顶层导出 |
| `packages/codemode/src/tool.ts` | `Tool` 契约、`JsonSchema`/`SchemaType`、`Tool.make`、`isTool` |
| `packages/codemode/src/tool-schema.ts` | Schema→TypeScript 签名渲染、`inputProperties`/`isEmptyInput`、`decodeInput`/`decodeOutput` |
| `packages/codemode/src/extension.ts`、`namespace.ts`、`tools.ts` | `Extension.make/async/isAsync`、`Namespace.make/isNamespace`、`Tools` 递归类型 |
| `packages/codemode/src/tool-error.ts`、`suspend-error.ts` | `ToolError`/`toolError`、`SuspendError`/`SnapshotError`/`toBytes`/`fromBytes` |
| `packages/codemode/src/scan.ts` | `scanTools`：静态抽取 `tools.<path>`、拒绝动态下标与别名、作用域遮蔽 |
| `packages/codemode/src/stdlib/value.ts` | 强制转换（`Number`/`String`/`parseInt`/`isNaN`…）与复合赋值运算符集合 |
| `packages/codemode/src/stdlib/array.ts`、`string.ts` | Array/String 原型与静态方法、回调回收（`callbackMethods`） |
| `packages/codemode/src/stdlib/collections.ts` | Map/Set/WeakMap/WeakSet 与 `groupBy` |
| `packages/codemode/src/stdlib/iterator.ts` | Iterator/IteratorHelper 与其惰性辅助函数 |
| `packages/codemode/src/stdlib/console.ts` | 捕获式 `console`（结果 `logs` 的来源）与 `formatValue` |
| `packages/codemode/src/stdlib/bytes.ts`、`url.ts`、`headers.ts`、`web.ts` | Uint8Array/TextEncoder/TextDecoder、URL/URLSearchParams/URI、Headers、`atob`/`structuredClone`/`crypto` |
| `packages/codemode/src/stdlib/date.ts`、`regexp.ts`、`json.ts`、`math.ts`、`number.ts`、`object.ts` | 其余内建（含 `enumerableSource`/`objectAssign`/`constructRegExp` 等共享工具） |
| `packages/codemode/src/openapi/index.ts` | `fromSpec`：operation → 命名空间工具 + `skipped` |
| `packages/codemode/src/openapi/spec.ts`、`runtime.ts`、`types.ts` | 解析/投影/命名降级、`invoke` 执行、`Plan`/`Credential` 等契约（`TODO.md` 列不支持项） |
