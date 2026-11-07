---
id: codemode/runtime
title: CodeMode JS 执行内核（VM 与解释器）
level: L1
layer: codemode
status: draft
paths:
  - packages/codemode/src/vm
  - packages/codemode/src/interpreter
  - packages/codemode/src/codemode.ts
  - packages/codemode/src/data.ts
  - packages/codemode/src/tool-runtime.ts
  - packages/codemode/interpreter-support.md
symbols:
  - VmEngine
  - Vm
  - Interpreter
  - startProgram
  - resumeProgram
  - finishExecution
  - Running
  - toBytes
  - fromBytes
  - SnapshotError
  - fromJson
  - MAX_PENDING_PROMISES
  - MAX_VALUE_DEPTH
  - globalNames
  - extensionGlobals
related:
  - core/tool-registry
keywords:
  - codemode
  - 沙箱
  - 解释器
  - 字节码
  - vm
  - 快照
  - 挂起
  - 限制
  - 诊断
source_hash: 04b2a8a2b9114f621b7216900f79e1db5cd30e6b
---

## 职责

CodeMode 的受限 JavaScript 执行内核，两个引擎、同一套语义（`src/vm` 56 个 `.ts` 文件，`src/interpreter` 17 个）：

- `interpreter/`（默认 `engine: "legacy"`）：直接遍历 acorn AST 的生成器解释器；`Runner` 提供 `Slice`/批步 `tick()` 做协作式切片，`Interpreter` 持有工具桥、日志、全局作用域。
- `vm/`（`engine: "vm"`，实验）：先编译成 `Int32Array` 字节码（`compiler/compile.ts` + `code.ts` 的 `CodeBuilder`），再由 `vm/vm.ts` 的 `run()`/`exec()` 解释循环执行；额外能力是**快照 / 挂起 / 恢复**（`snapshot/`、`runtime/execute.ts`）。
- `codemode.ts`：门面 `CodeMode.make/execute`，引擎选择、limits 校验、`Program`（run/suspend）、VM 懒加载。
- `data.ts`：程序值 ↔ 宿主 JSON 的边界（`fromJson`/`toJson`/`toBoundary`）。
- `tool-runtime.ts`：`tools` 目录与调用桥（`maxToolCalls` 计数、hooks、Schema 输入输出编解码）。
- `interpreter-support.md`：可勾选的语言/标准库支持矩阵（**清单，不是 changelog**）。

## 边界

- **不是 V8/进程级沙箱**：没有独立 worker/进程，隔离靠「值模型 + 白名单全局 + 无宿主能力」；没有 fs/net/process，`require`/`import` 只按模块名映射到已注册全局（`interpreter.ts` `module()`，缺失时报 "can't load packages or files"）。
- 不做权限/审计：宿主通过 `hooks`（`tool.before/after`、`extension.before/after`）挂钩；策略在宿主。
- 不做工具目录语义：工具描述、签名生成、输入输出 Schema 编解码在 `tool-runtime.ts`/`tool-schema.ts`（本卡只覆盖桥接面）。
- 不持久化快照：`Snapshot` 是纯数据，保存/传输由调用方负责。

## 入口与调用链

```
CodeMode.execute/make（codemode.ts）
  → ToolRuntime.prepare(tools) + resolveExecutionLimits
  → engine === "legacy": interpreter/execute.ts executeProgram
        Interpreter → Frame.run(program) → 逐语句 Eval（生成器）→ Runner.tick() 切片
  → engine === "vm": 懒 import("./vm/index.js")
        startProgram → parseProgram(acorn) → compileSource → Vm.start(source) → Vm.run() → Stop
        Driver 把 Stop 翻译成 Effect：host(calls) → 宿主执行 → Vm.complete(id, completion) → 继续 run()
```

- `Vm.run()` 的 `Stop` 四态：`host(calls)`（交给宿主）、`slice`（时间片到）、`done(completion)`（主体结束）、`stuck(node)`（等一个永远不会 settle 的值）。
- 挂起：`Program.run()` 运行到结束或被 `program.suspend(maxBytes)` 保存（`running.suspend` → `vm.capture` → `Suspended{ok:"suspended", state}`）；`runtime.resume(state|bytes)` 用 `resumeProgram` 在新 VM 里恢复。
- 宿主错误回传：`normalizeError`（`interpreter/errors.ts`）→ `Result = {ok:false, error: Diagnostic}`；程序抛出的值经 `materialize` 变成程序可见的 Error 对象。

## 数据与状态

- **程序值** `Value`（`interpreter/objects.ts` 的 `Obj` 子类 + 原始值）。宿主值只能经 `fromJson`（JSON 副本）或 `fromHost` 进入；反向出口 `toJson`/`toBoundary`。
- **边界表**（`data.ts`，AGENTS 与注释明确）：与 `JSON.stringify` 一致（`toJSON` 生效、函数/undefined 属性消失、非有限数→null、循环→TypeError），例外：promise 先 await（rejection 让程序失败）、Set→数组、URLSearchParams→query 串、Error→`{name,message,...own}`、Uint8Array 拒收并提示编码成文本、自有 `__proto__` 键丢弃。
- **快照**（VM only）：`Snapshot` = header（build id、tools/extensions 指纹、limits、`activeMs`、`toolCalls`）+ records；`toBytes`/`fromBytes` 负责字节化；恢复时校验 build id / 扩展集合 / 源码，limits 沿用保存时的值（`timeoutMs` 跨多次 resume 计活跃时间）。
- **运行时对象**：`Vm.frames`/`Vm.hosts`（queued/running/inbox/blocked 的宿主调用）、`VmScheduler`（jobs + promises + 未处理 rejection 诊断）、`Interpreter.logs`（console 输出，作为结果的 `logs`）。

## 关键不变式

- `interpreter-support.md` **是清单不是 changelog**：新增支持就勾选，发现重大缺口加未勾选项；修 bug/重构不要动它（packages/codemode/AGENTS.md）。
- **程序值是 `Value`**（`src/interpreter/objects.ts`）。宿主值是 `unknown`，只能经 `fromHost`/`fromJson` 进入；**不要把面向程序的签名放宽成 `unknown`**（AGENTS.md）。
- **每种内建对象是一个 `Obj` 子类**（`Wrapper` 或 `Opaque`），只覆写它需要的钩子；**问对象，不要加 instanceof 长链**（AGENTS.md）。
- **两个引擎必须绑定同一批全局名**：`codemode.ts` 注释指出 `test/engines.test.ts` 保证 `interpreter/globals.ts` 与 `vm/runtime/globals.ts` 的 `table` 同步；新增全局要两边都加。
- **一个 program 只能 run 一次**：第二次 `run()` 是 defect（`vmProgram` 的 `claimed`）；要再跑用 `runtime.program` / `runtime.resume`。
- **默认引擎不加载 VM**：`loadVm()` 首次使用才动态 `import("./vm/index.js")`，别在模块顶层静态引入。
- **超时只在步骤边界触发**（协作式），所以单个内建必须自带上界：`MAX_STRING_LENGTH = 1<<24`、`MAX_ARRAY_LENGTH = 10_000_000`、`MAX_PENDING_PROMISES = 10_000`、`MAX_VALUE_DEPTH = 32`（`limits.ts`，越界抛 `RangeError`）。
- **程序失败是数据**：`Result` 的 `Failure` 分支（`ok:false`）不是 Effect 失败；只有中断（`Cause.hasInterruptsOnly`）继续中断（`runtime/execute.ts`）。
- **宿主值不可进快照**：进行中的 extension 调用、宿主返回的函数会让 `capture` 丢值；`strict` 模式下是 `SnapshotError`，round-trip 测试会跳过这类状态。

## 扩展点

- **加一个全局内建**：`interpreter/globals.ts` 与 `vm/runtime/globals.ts` 的 `table` 各加一项 + `stdlib/*.ts` 实现（`Obj` 子类）；跑 `test/engines.test.ts`/`test/parity.test.ts`。
- **加一个 VM intrinsic**：`vm/runtime/intrinsics.ts` 注册 + `internal-prelude.ts` 的 `VmIntrinsic`；若涉及 prelude 源码，改 `prelude/source.ts`/`prelude/*`，`prelude/bytecode.ts` 是生成的。
- **加一种宿主能力**：走 `Extension.make`（`src/extension.ts`），VM/interpreter 侧只经 `extensionGlobals` 暴露；不要直接往全局塞宿主对象。
- **支持新语法**：VM 侧 `compiler/compile.ts` + `opcodes.ts` + `vm.ts` 的 opcode 分支，legacy 侧 `interpreter/interpreter.ts`；两处都要，并在 `interpreter-support.md` 勾选。
- **改执行限制**：`codemode.ts` 的 `ExecutionLimits`/`resolveExecutionLimits`（影响两个引擎），构造上界在 `limits.ts`。

## 常见改法与坑

- 只改一个引擎 → `test/parity.test.ts`/`test/engines.test.ts` 挂；两个引擎的语义必须一致。
- 加 VM opcode 要同时处理 `EXTRA` 宽操作数与 16 位跳转溢出：`CodeSizeOverflow` 会让编译器切宽模式重编译（`code.ts`），不要绕过。
- 新内建能构造大值时必须自己 `checkStringLength`/`checkArrayLength`，否则协作式超时救不回来。
- 边界必须走 `toBoundary`：绕过它会泄露 `__proto__` 键、泄漏 Uint8Array 或未 await 的 promise。
- 恢复失败的诊断是 `SnapshotError`（在 `run()` 时才报），不要在 `resume` 阶段假设一定成功。
- `Search` 是阻塞型宿主调用（`callSearch` → `blockSearch`），而 `tools.*` 是并发 promise；两者的切片/中断行为不同，改调度要分别测。
- 超时后仍可能有后台 promise 在跑：`Running.execute` 会中断 driver 里的宿主调用，并给出 `TimeoutExceeded` warning（程序已返回值时保留值）。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/codemode/src/codemode.ts` | 门面：引擎选择、limits、`VmRuntime.program/resume`、懒加载 VM |
| `packages/codemode/src/vm/index.ts` | VM 引擎对外导出（执行/快照/全局） |
| `packages/codemode/src/vm/vm.ts` | `Vm` 解释循环、`Stop` 协议、slice/fuel、帧池 |
| `packages/codemode/src/vm/runtime/execute.ts` | `startProgram`/`resumeProgram`/`Running`、超时与输出裁剪 |
| `packages/codemode/src/vm/runtime/driver.ts` | `Stop` ↔ Effect 的桥、宿主调用生命周期 |
| `packages/codemode/src/vm/host.ts` | 工具/搜索/extension 调用、`BLOCK`/`ENTERED` |
| `packages/codemode/src/vm/compiler/compile.ts` | acorn AST → 字节码 |
| `packages/codemode/src/vm/code.ts` | `Code`/`CodeBuilder`、常量池、宽跳转 |
| `packages/codemode/src/vm/snapshot/snapshot.ts` | 快照头校验、字节化入口 |
| `packages/codemode/src/vm/snapshot/codec.ts` | 值与帧的编解码（codec gap 报错点） |
| `packages/codemode/src/vm/runtime/limits.ts` | VM 侧构造上界 |
| `packages/codemode/src/interpreter/interpreter.ts` | legacy 引擎：语句/表达式求值、模块解析、工具调用 |
| `packages/codemode/src/interpreter/runner.ts` | `Eval` 生成器调度、`Slice`、批步与 promise 队列 |
| `packages/codemode/src/interpreter/errors.ts` | `normalizeError`/`locate`/`materialize`（错误回传） |
| `packages/codemode/src/data.ts` | 宿主边界 `fromJson`/`toJson`/`toBoundary` |
| `packages/codemode/interpreter-support.md` | 支持矩阵（勾选清单） |
