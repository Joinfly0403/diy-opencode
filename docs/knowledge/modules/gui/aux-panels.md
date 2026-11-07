---
id: gui/aux-panels
title: 小型内置插件（goal / sources / btw）
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/goal
  - packages/gui-plugins/src/sources
  - packages/gui-plugins/src/btw
  - packages/gui-plugins/src/renderer.ts
  - packages/gui-plugins/src/main.ts
symbols:
  - builtins
  - createGoalState
  - transitionGoal
  - selectGoal
  - selectGoalBusy
  - GOAL_SNAPSHOT_TIMEOUT_MS
  - GOAL_COMMAND_TIMEOUT_MS
  - GoalAction
  - GoalEntry
  - createBtw
  - BtwModel
  - createBtwState
  - transitionBtw
  - btwTabView
  - btwChatView
  - BTW_GENERATE_TIMEOUT_MS
  - BtwFailure
  - BtwSavedChat
tests:
  - packages/gui-plugins/src/goal/machine.test.ts
  - packages/gui-plugins/src/btw/machine.test.ts
depends_on:
  - core/plugin-system
  - core/session-execution
related:
  - gui/context
  - gui/details
  - gui/terminal
  - contracts/events-db
  - core/tool-registry
keywords:
  - goal
  - 目标
  - composer
  - pill
  - sources
  - 来源
  - 引用
  - btw
  - 旁问
  - 小插件
  - 骨架
source_hash: 845a3f2f419fbbe214ace693c1f95a7b485e2e0d
---

## 职责

三个"小而完整"的内置插件，合在一张卡里因为它们共用同一套骨架、且都不需要 main 进程：

| 插件 | 提供什么 | 挂在哪 |
| --- | --- | --- |
| `goal` | 会话 `/goal` 的状态 pill 与暂停/恢复/清除 | `ctx.add(ComposerPill, { id: "goal" })` |
| `sources` | Sources 实验的"本轮引用了哪些来源"面板 | `ctx.add(Panel, { id: "turn", transient })` + `LinkHandler` |
| `btw` | `/btw` 旁问：问题与答案各占一个 tab | `Command`（`slash.btw`）+ `BuiltinPanel` |

同时列出 `src/renderer.ts` 与 `src/main.ts`——这 15 个内置插件的唯一注册表，是"加一个插件要改哪几处"的答案。

## 边界

做：
- goal：读/写 session 的 goal（`@opencode/schema/goal`），用服务器的 `Goal.Definition` RPC（`get` + `events.on("changed")`）与 `session.command({ name: "goal", text: action })`。
- sources：从会话消息里派生"某一轮引用的来源"（`@opencode/session-ui/sources`），点开时优先交给浏览器面板（`Browser` 契约），否则 `ctx.system.openExternal`。
- btw：把一个旁问发给模型并把问答存在本插件的 session store 里，关 tab 时丢弃。

不做：
- 三者都**没有 main 进程**（`main.ts` 里只列名、不挂 `mainEntry`）。
- goal 不拥有 goal：服务器持有，窗口只是视图 + 命令通道。
- sources 不做抓取：只展示已存在的引用；实验关闭（`sourcesExperiment.enabled`）时不再列 tab。
- btw 不做多轮：一个 tab 一个问题一个答案。

## 入口与调用链

```
src/renderer.ts   export const builtins = compose({ context, btw, debug, terminal, file, review, details,
                                               browser, pairing, updater, ssh, wsl, "microsoft-office",
                                               sources, goal })
src/main.ts       export const builtins = compose({ …, debug: {…mainEntry}, browser/ssh/wsl/pairing/updater 同 } )
```

- renderer 用本地 `eager(setup)` 把 window 入口包成 `Promise.resolve({ default: setup })`——因为"窗口在全部内置插件 active 后才渲染"，入口本身必须小。
- goal：`createKeyed(session)` 派发 `target.attached` → `run({type:"subscribe"})` 用 `client.rpc(Goal.Definition).events.on("changed")`，`run({type:"fetch"})` 用 `get({sessionID}, { location: { directory }, signal })`。
- sources：`LinkHandler` 的 `href` 是那条用户消息的 id → `layout.open(\`${ctx.id}:${href}\`, session, { tab: "select" })` → `Panel.list` 为每个 id 建一个 tab。
- btw：`Command` 的 `run(input)` → `btw.ask(input)`（`model.ts` 的 `createBtw`）→ `machine.ts` 的 `transitionBtw`，上限 `BTW_GENERATE_TIMEOUT_MS = 300_000`。

## 数据与状态

- goal：**无 store**。状态在 `machine.ts` 的 `Map<session.key, GoalEntry>` 里，取值链：`live`（订阅中，权威）→ `stale`（未路由但保留，不单独显示）→ `loading`（带 `cached` 上一次的值）→ `retrying` → `failed`。
- sources：**无 store**。全部从 `session.server.data.session.message.list(id)` 派生（`turnMessages` + `turnSources`）。
- btw：**session store** `chats`（`Store.session`，`{ chats: [{ id, question, answer?, agent?, model?, created?, duration? }] }`）——按 session 存储，tab 关闭即删。
- 重启后：goal 从服务器重新 `get`；sources 从消息重算；btw 的问答随 store 恢复（在 store 载入前 tab 是 `hidden`，避免误删恢复的 tab）。

## 关键不变式

- **仅路由 + 已连接时订阅**：goal 的 `createKeyed` 要求 `session.id && session.server.connected`，`equals` 只看 `key` 与 `directory`（同 key 换 directory 要重新订阅，因为期间发布的变更错过了）。
- **换 server 就换 client**：goal 每次都从 `ctx.servers.get(effect.serverID)?.client` 现取，不缓存——"A restarted or re-authenticated server gets a new client under the same id"。
- **一个 session 同时只有一个 goal 命令**：`selectGoalBusy(state, key)` 用 `commands` Map 的 attempt 号；按钮 disabled 由它决定。
- **btw 的 tab 隐藏有语义**：store 未载入时 `hidden` 为真，否则会在恢复时把 tab 丢掉；store 载入后 `status === "missing"` 的 tab 从 strip 移除。
- **sources 是实验开关驱动的**：`sourcesExperiment.enabled` 为假时 `list` 返回空，而 panel 是 `transient`，所以 tab 会一起关闭。关掉实验再打开不会恢复旧 tab。
- **`legacy` 键不能丢**：btw 的 `BuiltinPanel.legacy = { btw: "main" }`——旧布局把 tab 存成 `btw`。
- **注册表只有两份**：`src/renderer.ts` 与 `src/main.ts`。新增内置插件必须两个文件都加（main 里即使没有 `mainEntry` 也要列名以"保留 id"）。
- **禁止模块级状态**：三个插件的状态都在 `setup` 内；`renderer.ts`/`main.ts` 只有常量表。

## 扩展点

**新增一个内置插件**（标准动作，缺一不可）：
1. 建目录 `src/<id>/`：`index.ts`（`Plugin.define({ os?, stores?, i18n })`）、`renderer.tsx`（`export default setup`）、需要时 `contract.ts` / `main.ts` / `i18n/<locale>.ts`。
2. `src/renderer.ts`：import 两个文件，在 `compose({...})` 里加 `<id>: { ...definition, windowEntry: eager(<id>Renderer) }`。
3. `src/main.ts`：在 `compose` 里加同名键；有主进程代码则 `mainEntry: () => import("./<id>/main")`，否则只放 `definition`（保留 id）。
4. 文案用 `i18n/en.ts` 短键；多语言时改 `builtinCatalog`。
5. 面板/命令的键要 `BuiltinPanel.legacy`（如果它以前是 app 自带的功能）。

**给 goal 加一个动作**：`machine.ts` 的 `GoalAction` 字面量 → `renderer.tsx` 的按钮（`Show when` 按状态）→ 服务器端命令名（`session.command({ name: "goal", text: action })`）。

**给 btw 加一项持久化字段**：`btw/index.ts` 的 `Chats` schema → `machine.ts` 的 `BtwSavedChat` → `model.ts` 的落盘点。session store 不需要 `from`（它从插件化第一天就这么存）。

**改 sources 的展示**：`panel.tsx`（薄包装）+ `@opencode/session-ui/sources` 的 `SourcesPanel`；数据派生留在 `turnSources`/`turnMessages`。

## 常见改法与坑

- 三个插件都用 `i18n: { en }`（普通对象）而不是 `builtinCatalog`，因为只有英文；加第二种语言时必须同时换成带 loader 的形式，否则 host 会把整个目录当内联目录。
- goal 的 `stale` 条目**不能单独显示**：切回一个未订阅的 session 时，先显示缓存的 goal 再 fetch；直接把 stale 当权威会显示过期状态。
- goal 的失败重试有三次退避（`RETRY_DELAYS = [1_000, 2_000, 4_000]`），之后 `failed` 但仍保留订阅——服务器上没有 goal 插件时应该静默，不要报错弹窗。
- `btw` 的 `Command` 有 `slash: { name: "btw", arguments: true }` 且 `hidden: true`：它只从 slash 进，不出现在命令面板；改 `hidden` 会让它出现在全量命令列表里。
- `sources` 的 tab id 就是消息 id；`LinkHandler` 的 `match` 只看 `origin === ctx.id`，别加更多条件（timeline 的 chip 只有这一种入口）。
- `src/renderer.ts` 的 `eager()` 只是把同步 setup 包成 promise，**不要**在这里塞异步逻辑；重活放各自目录的 `lazy()`。
- `main.ts` 即使某插件没有主进程也要列出来——注释写明"Lists every built-in so their ids stay reserved"；漏掉会让第三方插件能占用同 id。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `renderer.ts` | 15 个内置插件的 window 注册表（`compose` + `eager`） |
| `main.ts` | 同上的 main 注册表（`mainEntry` 只给真有主进程的） |
| `goal/index.ts` | `Plugin.define({ i18n: { en } })` |
| `goal/renderer.tsx` | `ComposerPill`：状态 pill 与暂停/恢复/清除菜单 |
| `goal/machine.ts` | goal 状态机：订阅、快照、重试退避、命令在飞 |
| `sources/index.ts` | `Plugin.define({ i18n: { en } })` |
| `sources/renderer.tsx` | `LinkHandler` + `Panel(id "turn", transient)` + tab 缓存 |
| `sources/panel.tsx` | 面板薄包装：派生来源并交给 `SourcesPanel` |
| `btw/index.ts` | `Plugin.define`：`chats` session store |
| `btw/renderer.tsx` | `Command(slash btw)` + `BuiltinPanel(transient, legacy { btw: "main" })` |
| `btw/model.ts` | `createBtw`：提问、落盘、prune |
| `btw/machine.ts` | 旁问状态机与视图（`btwTabView`/`btwChatView`） |
| `btw/panel.tsx` | 问答面板 UI |
| `goal/i18n/en.ts`、`sources/i18n/en.ts`、`btw/i18n/en.ts` | 各自的短键文案 |
