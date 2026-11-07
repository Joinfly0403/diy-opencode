---
id: core/platform-foundations
title: 平台底座（文件系统 / 环境 / PTY 后端 / Effect 工具 / 身份持久化）
level: L1
layer: core
status: draft
paths:
  - packages/core/src/filesystem
  - packages/core/src/environment
  - packages/core/src/util
  - packages/core/src/effect
  - packages/core/src/pty
  - packages/core/src/codemode
  - packages/core/src/project.ts
  - packages/core/src/workspace.ts
  - packages/core/src/project
  - packages/core/src/workspace
symbols:
  - FileWatch
  - DisabledError
  - MAX_PER_LOCATION
  - Watcher
  - Native
  - hasNativeBinding
  - Fff
  - FileSystemSearch
  - makeFffLayer
  - LocationWatcher
  - LocationWatcherPolicy
  - Protected
  - isHome
  - EnvironmentService
  - EnvironmentLocal
  - EnvironmentMemory
  - EnvironmentUnavailable
  - EnvironmentDriver
  - FilesImpl
  - typeFollowing
  - execDefaults
  - makeFiles
  - makeLocalDriver
  - makeMemoryDriver
  - MemoryDriver
  - KeyedMutex
  - makeUnsafe
  - AppNodeBuilder
  - LayerNodePlatform
  - requestExecutor
  - WebSocketConstructor
  - ErrorSummary
  - gitExecutable
  - resolveGitExecutable
  - lazy
  - Slug
  - which
  - Wildcard
  - PtyProtocol
  - metaFrame
  - REPLAY_CHUNK
  - PtyTicket
  - ConnectToken
  - Proc
  - CodeModeCatalog
  - summarize
  - CodeModeExecution
  - CodeModeFetch
  - MAX_REDIRECTS
  - CodeModeInstructions
  - CodeModeTool
  - qualifiedName
  - Project
  - ACTIVATE_INTERVAL
  - sweepNode
  - ProjectSchema
  - ProjectTable
  - upsertProject
  - ProjectDirectoryTable
  - ProjectIcon
  - Workspace
  - CreateConflict
  - WorkspaceTable
  - WorkspaceDriver
  - Binding
  - ProviderNotFound
  - registryNode
events:
  - filesystem.changed
  - project.updated
tables:
  - project
  - project_directory
  - workspace
tests:
  - packages/core/test/location-filesystem.test.ts
  - packages/core/test/environment.test.ts
  - packages/core/test/project.test.ts
  - packages/core/test/project-activate.test.ts
  - packages/core/test/project-icon.test.ts
  - packages/core/test/workspace.test.ts
  - packages/core/test/codemode.test.ts
depends_on:
  - core/location-instance
  - util-runtime/misc
  - core/pty-shell-worktree
related:
  - codemode/runtime
  - core/tool-registry
  - contracts/events-db
  - schema/core-model
keywords:
  - 文件系统
  - watcher
  - fff
  - ripgrep
  - fuzzysort
  - environment
  - exec
  - pty
  - websocket
  - 代理
  - keyed mutex
  - project
  - workspace
  - 持久化
  - 归档
source_hash: c41fc836f0a4c74608677f82356f455d76859682
---

## 职责

这一卡收 core 里"没有业务故事、但每个服务都踩在上面"的底座，外加 project / workspace 两条身份链的持久化实现。

| 目录 | 这里有什么 |
| --- | --- |
| `filesystem/` | ① `FileSystemSearch`：只有一个 `find(FindInput)`，内含两套索引后端——fff 原生扫描器（`fff.bun/node/workerd` 三份实现）与 ripgrep + `fuzzysort` 回退；② `Watcher`：底层订阅（`node:fs.watch` 处理 `file`/`entries`，`@parcel/watcher` 处理递归 `directory`），带 `Test` 内存层；③ `LocationWatcher`：只盯 VCS 头文件（`<gitDir>/HEAD`、`<store>/branch`），变了就发 `filesystem.changed`；④ `FileWatch`：按单文件订阅、TTL 24h、每 Location 上限 256；⑤ `LocationWatcherPolicy`：可被 `State` 变换的 ignore 列表；⑥ `protected.ts`：home 目录扫描保护（按平台列出要跳过的目录名）。 |
| `environment/` | `Files` 契约（lstat 语义的 read/write/stat/list/remove/move/mkdir）+ 三种 driver：`local`（裸 `node:fs`，注释明确：effect 的 node FileSystem stat 会跟随符号链接，这里需要 lstat）、`memory`（虚拟 FS，含符号链接解析）、`unavailable`（没有执行面时 spawner 直接抛 PlatformError）；`exec-defaults.ts` 是"进程版"实现（`sh -c` 脚本 + 退出码协议）。 |
| `util/` | `ErrorSummary.from`（剥栈的 cause 链摘要，最多 8 层）、`git-executable`（macOS `/usr/bin/git` shim 与 Xcode 路径修正、Windows 绝对化）、`lazy`、`Slug`、`Token.estimate`、`which`（含 Windows app execution alias 兜底）、`Wildcard.match`。 |
| `effect/` | `AppNodeBuilder.build`：把 `LayerNode.Graph` 编译成带 `Instance` 与 `LocationServiceMap` 替换的图层；`app-node-platform`：`RequestExecutor`/`LLMClient`/`Socket.WebSocketConstructor` 三个全局节点；`KeyedMutex`（同 key 排队、不同 key 并行、无人持有时自清理）；`WebSocketConstructor`（带代理与 CA 的 WebSocket，Bun/Node 两条路径）。 |
| `pty/` | PTY 的 runtime 分派（`bun-pty` / `@lydell/node-pty` / workerd 直接抛错）、`protocol.ts` 的 websocket 线协议、`ticket.ts` 的一次性升级票据。 |
| `codemode/` | core 侧的 Code Mode 桥：`catalog`（工具目录摘要与 token 预算）、`instructions`（给模型的目录说明与增量更新）、`tool`（模型可见的 `execute` 工具）、`fetch`（`fetch` 扩展 + 权限复用）、`execution`（程序运行时的执行上下文 Service）。 |
| `project.ts` + `project/` | Project 身份解析（git remote → 仓库根 `opencode` 文件 → root commit → 目录哈希）、行 upsert、图标发现、归档清扫；`project/sql.ts`、`project/schema.ts`、`project/icon.ts`。 |
| `workspace.ts` + `workspace/` | Workspace 身份（instant `create` / 单飞 `provision` / `connect` / `destroy`）、provider 绑定的不透明持久化、driver registry、空闲挂起；`workspace/driver.ts`、`workspace/sql.ts`。 |

## 边界

- **顶层的 `core/src/filesystem.ts` 与 `core/src/pty.ts` 不在本卡**：那是 Location 作用域的 `FileSystem` / `Pty` 服务门面，分别归 `core/tool-registry` 与 `core/pty-shell-worktree`。本卡只覆盖同名**子目录**（实现层）。
- **`project.ts` / `workspace.ts` 的语义归 `core/location-instance`**：`Location` → `Project.resolve` → `Instance`/`LocationServiceMap` 的服务图在那张卡里讲。本卡只讲这两条身份链**怎么落库、怎么被 driver 接管**（`project/sql`、`project/icon`、`workspace/sql`、`workspace/driver`），重复内容不在此展开。
- **PTY 服务与 Shell/Worktree 归 `core/pty-shell-worktree`**：本卡只讲 `pty/` 的 runtime 分派、线协议与票据。
- **`LayerNode` / `app-node` / `Global` / `Teardown` 本体在 `packages/util`**（`util-runtime/misc`）；`effect/` 只是把 core 的服务装进那套节点的粘合代码。
- **Code Mode 引擎归 `codemode/runtime`**：本卡只讲 core 如何把工具目录喂给引擎、如何回放调用进度、`fetch` 扩展的权限语义；解释器/VM、`Value` 模型、快照都不在这里。
- **watcher 不决定"要不要 watch"**：是否启用由 `Options.enabled`（配置）与 `Location` 的 `vcs` 决定；watch 也不做内容索引（grep/glob 是另一条路）。
- **`util/` 不是公共工具库**：这些是 core 内部小工具，不要从别的包直接依赖它们当 API。

## 入口与调用链

```
文件查找
  工具层（read/glob/grep 支撑，见 core/tool-registry）
    → FileSystemSearch.find(FindInput)
       → layer() 选后端（见"关键不变式"）
          · fffLayer：首次 find 才建 picker，等扫描 ≤3s，destroy 在 finalizer
          · ripgrepLayer：ripgrep `*` 全量列目录 + fuzzysort 索引，10s 内不重复刷新

目录/文件变更
  LocationWatcher（插件激活后）→ Watcher.subscribe({path: vcs head, type: "file"})
    → Bus.publish(FileSystem.Event.Changed)
  FileWatch.watch({location, file}) → Watcher.subscribe → 每次事件再 existsSafe 判定 change/unlink
    → Bus.publish(FileSystem.Event.Changed, …, { location })

执行面
  Environment.node → location.workspaceID ? Workspace.connect(id) : makeLocalDriver(ChildProcessSpawner)
    → makeFiles(driver) = execDefaults(driver.spawner) + driver.overrides
    → Files 的使用者（shell/file 工具、workspace 内的 Files）拿到同一套契约

PTY
  Pty 服务 → import("#pty")（package.json imports 条件：bun/node/workerd）
    → pty.bun.spawn / pty.node.spawn / pty.workerd.spawn(throw)
  服务端 websocket 适配层 → PtyProtocol.metaFrame / chunks / decodeInput
  客户端升级前 → PtyTicket.issue → 用 ticket 换连接（consume 一次性核销）

Code Mode（core 侧）
  tool/plugin（execute）→ CodeModeTool.create(inventory, executeTool, permission)
    → runtime(inventory, engine)（按 inventory+引擎缓存）
       → CodeMode.make({ tools, extensions: [CodeModeFetch.extension] })
       → hooks 收集 toolCalls → context.progress（100ms 合并）
    → CodeModeInstructions.make(summarize(inventory)) 生成/更新模型侧目录

身份
  Project.resolve(directory) → git/hg 探测 → 身份 ID → persist（upsert + worktree 行 + 事件）
  Workspace.create/provision/connect → registry.get(provider) → driver.create/connect → saveBinding
```

## 数据与状态

- **`Files` 契约的语义差别**（`environment/files.ts` 注释）：`read`/`list` 跟随最终符号链接，`stat` 与 `list` 返回的条目类型**不跟随**；`typeFollowing` 用 `read(offset:0,length:0)` 把 lstat 结果补成 follow 语义，悬空链接报 `NotFound`。
- **`Files` 的三类错误是类型化数据**：`NotFound` / `WrongKind{path, actual}` / `Failed{path, cause}`；进程版靠退出码 44/45/46 分类，不解析本地化错误文本（唯一例外用 `LC_ALL=C` 钉住的 stderr 匹配）。
- **watcher 表**：`RcMap<Target, PubSub>`，`Target` 按结构相等（effect `Equal`），所以等价 watch 共享一个原生订阅；`ignore` 数组在交给原生代码前必须复制（它同时是 RcMap key，哈希被缓存）。
- **`FileWatch` 表**：`Map<locationKey, Map<file, {expires, scope}>>`，`locationKey = JSON.stringify([directory, workspaceID])`；每个文件一个子 scope，`Scope.close` 即停订阅。
- **`LocationWatcherPolicy`**：`State<{ignore: string[]}>`，`observe` 注册监听（带 scope 清理），每次通知都重读 `current()`（注释：前一个监听里的重入变换必须能传到后面的监听）。
- **Project 行**（`project` 表）：`id`（身份）、`worktree`（canonical 路径）、`vcs`、`name`、三个 icon 字段、`time_initialized/time_active/time_archived`、`sandboxes`、`commands`；`project_directory` 表已标 `@deprecated`，改用 `worktree` 表（本卡不覆盖 `worktree/`）。
- **Workspace 行**（`workspace` 表）：`id`、`provider`、`binding`（JSON，driver 私有，core 只存不读内部）、`created_at`、`last_used_at`。
- **进程内缓存**：`Project` 的 `gitCache`（`Cache` capacity 512，key = `.git` 路径 + fingerprint）、`activated: Map<ID, number>`（激活节流）、`Workspace` 的 `connections: Map<ID, Connection>` 与 `attempts: Map<ID, Deferred>`。
- **Code Mode 运行时缓存**：`runtimes.legacy` / `runtimes.vm` 是两个 `WeakMap<Inventory, Runtime>`，inventory 是不可变快照，所以工具定义、schema、search 索引只建一次。

## 关键不变式

- **搜索后端选择是有条件的，别乱简化**（`filesystem/search.ts` `layer`）：`location.workspaceID` 存在 → 一律 ripgrep（fff 会在本进程索引服务器本地目录，给出错的结果）；`options.fff === false`、未配置且在 Windows、或 `Fff.available()` 为假 → ripgrep；只有"有 VCS 且不是 home"才用 fff。改这段会同时改变结果相关性、内存和 Windows 行为。
- **fff picker 惰性创建，且创建/发布是一个不可中断的同步步骤**：注释写明——否则被中断的搜索会留下没人 `destroy()` 的原生 picker。扫描最多等 3s（`FFF_SCAN_WAIT`），超时只是本次放弃等待。
- **watcher 只有 `file`/`entries` 用 `fs.watch`，递归目录才走 parcel**：`nativeLayer` 里 `watch(directory, { recursive: false })` 只用于前两种；目录必须按平台选 backend（windows / fs-events / inotify），拿不到原生绑定就 `logError` 并返回 `undefined`（订阅流直接结束，而不是挂住）。
- **原生订阅有 10s 上限且必须可中断**：`SUBSCRIBE_TIMEOUT_MS` 与 `RcMap` 的 `{ interruptible: true }`；被中断/超时后仍要在 promise 完成后 `unsubscribe`（`onInterrupt` 里补），否则泄漏原生 watcher。
- **ENOENT 不是崩溃**：目录消失时 watch 直接结束（`Effect.undefined`），调用方（`LocationWatcher`、`FileWatch`）负责在流结束后重新订阅。
- **`FileWatch` 是全局层，不是 Location 作用域**：注释明确"watches outlive idle location eviction"；超上限时**踢掉最早到期的那一个**（不是最早的）。
- **`LocationWatcher` 只看 VCS 头文件**：`.git/HEAD` / `.hg/branch`（含别名 `.git`/`.hg`/真实目录），分支切换才触发；policy 的 ignore 命中别名时**不订阅**，reconcile 在 policy 变化时重跑（同 path 直接返回，不重建 scope）。
- **`execDefaults` 要求 GNU coreutils + findutils**（文件头注释）：BSD / busybox 用户态不工作；`"$1"` 永远是目标路径；单次收集上限 64 MiB（stdout）与 64 KiB（stderr），超限按 `Failed` 处理，所以大文件必须用 range 读。
- **`Environment` 没有错误通道**：`Workspace.connect` 失败被 `mapError` 成 `Error` 再 `orDie`（注释：未知/已销毁的 placement 按配置缺陷处理）。别指望它返回可恢复错误。
- **Project 身份只在"前一个 canonical 目录已不存在"时才被改写**：克隆共享同一个 project id，`persist` 里对 `worktree` 列的替换有 `fs.exists(previous.canonical)` 守卫；`resolve` 会顺带把归档的项目取消归档。
- **Project 的目录行与事件在同一事务里提交**（`bus.publish(Worktree.Event.Resolved, …, { commit: insert … onConflictDoNothing })`），且 `announcing` 集合防并发重复公告——注释把这条写成幂等性要求。
- **`Project.sweep` 只在空闲时归档**：`time_updated` 与 `time_active` 都早于 1 小时前（`SWEEP_INTERVAL`）才检查；路径读不出来按"存在"处理，避免临时 IO 错误归档项目；有存活的非 strategy（主检出）worktree 就改 canonical 而不是归档。
- **Workspace 的 `binding` 只会被写、不会被清空**：`open` 里 `!row.binding` 直接 `die`（注释：竞态 destroy 会删整行，表现为 `NotFound`）；provision 用 `Deferred` 单飞，`destroy` 通过完成该 Deferred 来取消并行的 provision。
- **空闲挂起是"持锁挂起"**：注释明确——挂起期间一直持 keyed lock，唤醒的 spawn 阻塞后再干净地重连；不要在 suspend 中途放锁。
- **`KeyedMutex` 的条目在最后一个持有者/等待者释放时删除**（`users` 计数含等待者），所以 `size` 会回到 0，不能拿它当"曾经用过的 key"记录。
- **Code Mode 的 `fetch` 与 webfetch 工具共用同一套权限**：`permission.assert({ action: "webfetch" })`，重定向逐跳 `assertNotDenied`，`MAX_REDIRECTS = 20`，30s 超时；`file:`、URL 内嵌凭据、非 http(s) 重定向都直接拒绝。
- **Code Mode 的 toolCalls 进度最多 100ms 一条**，且内层工具的 `progress` 被替换成 `Effect.void`（否则内层更新会盖掉 execute 自己的调用行）；失败/中断时要把 trailing 行发出去再结束。

## 扩展点

- **加一个搜索后端**：实现 `FileSystem/fff.ts` 的 `Backend`（`isAvailable`/`create`）→ 用 `bind(backend, "unavailable 文案")` 导出 → 在 `package.json` 的 `imports` 加一份 `#xxx` 条件映射，并补 `fff.workerd.ts` 之类的降级实现 → `search.ts` 的 `layer` 里加选择分支。
- **加一种 watch 目标**：`Watcher.subscribe` 的 `WatchInput` 是 `file | entries | directory` 三态联合；新形态要同时改 `nativeLayer`（parcel/fs.watch）与 `testLayer`（`emit` 的匹配谓词），否则测试层和真实层语义会分叉。
- **让某个文件"被跟踪"**：调用 `FileWatch.watch({ location, file })`，不要自己调 `Watcher`——`FileWatch` 负责 TTL、上限、`change/unlink` 判定与 Bus 事件。
- **改 home 目录保护名单**：`filesystem/protected.ts` 的 `DARWIN_HOME` / `WIN32_HOME`；`FileSystemSearch` 用它决定是否把 `--exclude` 传给 ripgrep。
- **加一个新的环境类型**：写一个 `Driver`（`{ spawner, overrides? }`）→ `makeFiles(driver)` 自动得到"进程默认 + 覆盖"的 `Files`；`memory.ts` 是最小样例。
- **加一个新的 PTY 后端**：`pty/pty.ts` 的 `Proc`/`Opts` 是唯一契约；把 `#pty` 的 `imports` 条件指向新文件，并保证 `workerd` 仍然抛错。
- **加一条 Code Mode 扩展**：在 `codemode/tool.ts` 的 `CodeMode.make({ extensions: [...] })` 里加；若要在 TUI 里显示行，还要在 `progressHooks` 的 `extension.before` `switch` 里加一个 case（默认不显示）。
- **改模型侧的 Code Mode 目录**：`codemode/catalog.ts` 的 `summarize`（`INLINE_BUDGET = 2000` token、描述截断 120 字符、每轮每命名空间选一条）与 `instructions.ts` 的 `render`/`update`（短 delta 优先，否则整段重发）。
- **加一个 workspace provider**：实现 `workspace/driver.ts` 的 `Interface`（`create` **必须**按 `workspaceID` 幂等、`connect`、`suspendForIdle`、`destroy`）→ 用 `registryNode({ provider: driver })` 注册 → 由 `process-lifecycle` 侧的装配替换 `WorkspaceDriver.node`。

## 常见改法与坑

- 把 fff 设成"永远优先"：Windows 默认就是关的，workspace-backed Location 更必须走 ripgrep，否则索引的是服务器本地目录。
- 在 `Watcher` 里直接改 `ignore` 数组：它和 RcMap 的 key 是同一个对象，原生代码拿到手后再变会让结构哈希失效——必须先 `[...ignore]`。
- 给 watcher 加"出错就重试"的循环：订阅失败的正确语义是结束流，由上层（`LocationWatcher`/`FileWatch`）重建；在这里重试会和 RcMap 的引用计数打架。
- 用 `effect` 的 node `FileSystem.stat` 替掉 `environment/local.ts`：它跟随符号链接，`stat` 就再也报不出 `symlink`，`typeFollowing` 与 `WrongKind.actual` 全部失真。
- 用 `execDefaults` 读大文件整篇：64 MiB 上限会直接 `Failed`，改成分段 `read(range)`。
- 在 `Environment` 上加错误通道"让它更稳"：`Workspace.connect` 的失败按设计是配置缺陷，加通道等于把装配错误变成运行期分支。
- `Project.resolve` 里加"总是更新 canonical"：会让 git clone 的多份检出互相改写路径；只在旧路径消失时才改。
- 在 `Project.activate` 里绕过节流：`ACTIVATE_INTERVAL = 60s` 是刻意的，热路径每步都调它。
- `Workspace.open` 里把 `die` 改成返回错误：`binding` 在 provision 前就已持久化，出现 null 说明装配坏了（注释已写明），别把它做成可重试分支。
- 用手写 JSON 解析 Code Mode 的 `fetch` 结果：`read()` 已经给出 `text/json/bytes` 三个方法和 `headers.get/has/entries`，程序侧依赖这个形状。
- 给 `CodeModeTool` 的进度加"每次都发"：会按次打爆 SSE 与 TUI 渲染，注释里的 100ms 合并是必须的。
- 在 `codemode/tool.ts` 里每次 execute 都 `CodeMode.make`：inventory 缓存（`runtimes` WeakMap）就是为了复用工具定义与 search 索引，绕过它会让每次 execute 重新编译签名。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/filesystem/search.ts` | `FileSystemSearch`、fff/ripgrep 双后端选择、fff 惰性 picker |
| `packages/core/src/filesystem/watcher.ts` | `Watcher`/`Native`/`Test`、RcMap 订阅表、10s 订阅上限、parcel vs `fs.watch` |
| `packages/core/src/filesystem/watcher-binding.ts` | 惰性 `require` 原生 watcher（workerd 上不加载） |
| `packages/core/src/filesystem/file-watch.ts` | `FileWatch`：TTL/上限/清扫、change-unlink 判定 |
| `packages/core/src/filesystem/location-watcher.ts` | `LocationWatcher`：VCS 头文件订阅、reconcile、Bus 发布 |
| `packages/core/src/filesystem/location-watcher-policy.ts` | `LocationWatcherPolicy`：ignore 列表的 State 变换与监听 |
| `packages/core/src/filesystem/fff.ts` | `Backend`/`Picker`/`bind`（三个 runtime 实现的公共契约） |
| `packages/core/src/filesystem/protected.ts` | `isHome`、平台相关的 home 跳过名单 |
| `packages/core/src/environment/exec-defaults.ts` | 进程版 `Files`：`sh -c` 脚本、退出码 44/45/46、输出上限 |
| `packages/core/src/environment/local.ts` | 宿主 `node:fs` 版 driver（lstat 语义的理由写在文件头） |
| `packages/core/src/environment/environment.ts` | `Environment` 服务：workspace 连接或本地 driver，`makeFiles` 装配 |
| `packages/core/src/environment/memory.ts` | 内存驱动（含符号链接、`MemoryDriver.symlink`） |
| `packages/core/src/effect/keyed-mutex.ts` | `KeyedMutex`：按 key 的 in-memory mutex |
| `packages/core/src/effect/app-node-platform.ts` | `RequestExecutor`/`LLMClient`/`WebSocketConstructor` 全局节点（关掉 Bun 5 分钟超时） |
| `packages/core/src/effect/websocket-constructor.ts` | 代理选择（`WS_PROXY`/`WSS_PROXY`/`*_PROXY`/`NO_PROXY`）与 CA 组合 |
| `packages/core/src/pty/protocol.ts` | websocket 线协议：`0x00` + JSON 游标帧、64 KiB replay 分片 |
| `packages/core/src/pty/ticket.ts` | `PtyTicket`：60s TTL、容量 10000 的一次性升级票据 |
| `packages/core/src/codemode/tool.ts` | `execute` 工具、inventory→Code Mode 工具的转换、进度 hooks、runtime 缓存 |
| `packages/core/src/codemode/catalog.ts` | `summarize`：按 token 预算挑选目录条目 |
| `packages/core/src/codemode/fetch.ts` | `fetch` 扩展：权限、重定向逐跳校验、响应包装 |
| `packages/core/src/project.ts` | `Project`：身份解析、persist、activate 节流、sweep |
| `packages/core/src/project/sql.ts` | `project` 表、`upsertProject`、`@deprecated` 的 `project_directory` |
| `packages/core/src/project/icon.ts` | `ProjectIcon.discover/refresh`：候选图标路径与 data URL |
| `packages/core/src/workspace.ts` | `Workspace`：create/provision/connect/destroy、空闲挂起 |
| `packages/core/src/workspace/driver.ts` | `WorkspaceDriver` 契约（幂等 create）、`Binding`、registry |
| `packages/core/src/workspace/sql.ts` | `workspace` 表定义 |
