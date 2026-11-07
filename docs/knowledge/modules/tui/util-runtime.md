---
id: tui/util-runtime
title: TUI 运行时工具（宽度/格式化、剪贴板、提示音、外部编辑器、模型偏好、parsers）
level: L1
layer: tui
status: stable
paths:
  - packages/tui/src/util
  - packages/tui/src/devtools
  - packages/tui/src/attention.ts
  - packages/tui/src/attention-sounds.bun.ts
  - packages/tui/src/attention-sounds.node.ts
  - packages/tui/src/audio.ts
  - packages/tui/src/audio.d.ts
  - packages/tui/src/clipboard.ts
  - packages/tui/src/editor.ts
  - packages/tui/src/editor-zed.ts
  - packages/tui/src/editor-zed-sqlite.bun.ts
  - packages/tui/src/editor-zed-sqlite.node.ts
  - packages/tui/src/logo.ts
  - packages/tui/src/model-preference.ts
  - packages/tui/src/parsers-config.ts
symbols:
  - stringWidth
  - collapseToolOutput
  - collapseShellOutput
  - configDirectories
  - projectConfigDirectories
  - localProjectDirectory
  - hasConnectedProvider
  - createDelayedPresence
  - splitPatchHunks
  - splitAddedPatch
  - errorDetails
  - cliErrorMessage
  - errorFormat
  - errorMessage
  - filetype
  - formRows
  - formInitialValues
  - formValidateValue
  - decide
  - claim
  - titlecase
  - truncate
  - truncateWidth
  - graphemes
  - marqueeText
  - marqueeOverflows
  - createMediaCache
  - parse
  - formatRef
  - switchLabel
  - abbreviateHome
  - formatPath
  - normalizePath
  - permissionPresentation
  - readJson
  - writeJsonAtomic
  - epilogue
  - projectName
  - isRecord
  - setTerminalTitle
  - destroyRenderer
  - getScrollAcceleration
  - CustomSpeedScroll
  - copy
  - copyOnSelectRelease
  - handleSelectionKey
  - sessionFamily
  - contextUsage
  - formatContextUsage
  - createDebouncedSignal
  - createFadeIn
  - createSingleFlight
  - describeOS
  - describeTerminal
  - parseTodos
  - todoMarker
  - sessionTodos
  - canonicalToolName
  - toolDisplayMetadata
  - toolDisplayContent
  - executeCalls
  - webSearchProviderLabel
  - servedByConsole
  - usageLevel
  - formatDollars
  - formatReset
  - goLimitName
  - limitScope
  - safeWatch
  - register
  - data
  - createTuiAttention
  - createTuiClipboard
  - createClipboardAdapter
  - openEditor
  - discoverEditorConnection
  - editorIntegration
  - resolveZedSelection
  - resolveZedDbPath
  - logo
  - go
  - modelPreferenceKey
  - recentModels
  - favoriteModels
  - cycleModelVariant
  - normalizeModelVariant
  - createModelPreferenceRepository
  - decodeModelPreference
config_keys:
  - devtools
  - attention.notifications
  - attention.sound
  - attention.volume
  - attention.sound_pack
  - attention.sounds
tests:
  - packages/tui/test/clipboard.test.ts
  - packages/tui/test/editor.test.ts
  - packages/tui/test/model-preference.test.ts
  - packages/tui/test/highlights.test.ts
  - packages/tui/test/usage-limits.test.tsx
  - packages/tui/test/theme.test.ts
depends_on:
  - tui/routes-shell
  - tui/prompt-editor
  - tui/components
related:
  - tui/theme-keybinds
  - tui/mini
  - core/location-instance
keywords:
  - 工具函数
  - util
  - string-width
  - 宽度
  - locale
  - 剪贴板
  - clipboard
  - 提示音
  - attention
  - 通知
  - 编辑器
  - EDITOR
  - Zed
  - 模型偏好
  - model preference
  - parsers
  - tree-sitter
  - devtools
  - bun
  - node
source_hash: d792489b01e3407579d637c6d6acbc6eacf0147c
---

## 职责

TUI 的运行时「小工具层」：没有界面的纯函数、进程级副作用、以及 `*.bun.ts`/`*.node.ts` 双实现的选择机制。

- `util/`（30 余个模块，按用途分组）：
  - **文本与宽度**：`string-width.ts`（re-export `#string-width`）、`string-width.bun.ts`（`Bun.stringWidth`）、`string-width.node.ts`（`string-width` + `strip-ansi` + `get-east-asian-width` 回退）、`locale.ts`（`titlecase`/`truncate`/`truncateWidth`/`graphemes`/`time`/`datetime`/`number`）、`marquee.ts`、`collapse-tool-output.ts`。
  - **代码与 diff**：`diff.ts`（`splitPatchHunks`/`splitAddedPatch`）、`filetype.ts`（扩展名 → 语言/图标）、`tool-display.ts`（工具名归一、输入摘要、`toolDisplayMetadata`）。
  - **文案与呈现**：`error.ts`/`error-details.ts`、`permission.ts`（权限选项的措辞与 `always` 列表）、`presentation.ts`（`epilogue` 用 `logo` 画会话收尾）、`todo.ts`、`session.ts`（`contextUsage`/`formatContextUsage`）、`usage-limits.ts`（TUI 侧额度/预算呈现）。
  - **路径与环境**：`path.ts`、`path-format.ts`、`project.ts`、`config-directories.ts`、`system.ts`（`describeOS`/`describeTerminal`）、`record.ts`。
  - **Solid 小工具**：`signal.ts`（`createDebouncedSignal`/`createFadeIn`）、`single-flight.ts`、`delayed-presence.ts`、`highlights.ts`（版本亮点该不该弹）。
  - **IO 与渲染辅助**：`persistence.ts`（`writeJsonAtomic` 等）、`watch.ts`（`safeWatch`）、`media.ts`（`media:<hash>` 字节缓存）、`renderer.ts`（`setTerminalTitle`/`destroyRenderer`）、`scroll.ts`、`selection.ts`（复制/选择键）、`form.ts`、`connected-provider.ts`。
- `devtools/index.ts`：极简调试注册表——模块级 `createSignal` 存 `Group[]`，`register({ id, title })` 返回 `set(key, value)`，`data()` 供 `component/devtools-bar.tsx` 渲染（`theme-performance` 组被该组件特殊处理）。
- 顶层单文件：
  - `attention.ts` + `attention-sounds.{bun,node}.ts` + `audio.ts` + `audio.d.ts`：系统通知与提示音。
  - `clipboard.ts`：剪贴板适配（宿主 + 终端渲染器两条通道）。
  - `editor.ts` + `editor-zed.ts` + `editor-zed-sqlite.{bun,node}.ts`：`$VISUAL`/`$EDITOR` 调用、Claude IDE 连接发现、Zed 选区读取。
  - `model-preference.ts`：最近/收藏模型与变体的 JSON 存储。
  - `logo.ts`：ASCII 字标（`logo`/`go`）。
  - `parsers-config.ts`：tree-sitter wasm + query 表（`routes/session/index.tsx` 用它做语法高亮）。

## 边界

- **不做渲染**：这里没有 renderable；界面在 `component/`、`ui/`、`routes/`。
- **不实现协议**：`UsageLimitsInfo`/`SessionMessageInfo` 等类型来自 `@opencode/client`/`@opencode/plugin/tui`，本层只消费。
- **不持有应用状态**：除 `devtools` 的模块级信号与 `attention` 的局部 focus 状态外，全部是入参→返回值。
- **不是日志/监控系统**：devtools 只是给开发者看的一列键值，不采集指标、不发往服务器。
- **客户端预算文案有第二份实现**：Web 侧在 `app/providers-usage` 的 `usage/limits.ts`；TUI 用 `util/usage-limits.ts`，两份独立，语义改动要同时改。

## 入口与调用链

```
宽度：任意组件 → util/string-width.ts → "#string-width"
        bun  → util/string-width.bun.ts   (Bun.stringWidth)
        node → util/string-width.node.ts  (string-width + emoji 文本呈现修正)

提示音：context/attention.tsx → createTuiAttention({ renderer, config })
        → notify() → renderer.triggerNotification(message, title)
                   → playSound(name, volume) → audio.loadSoundFile(路径) → audio.play(sound, {volume})
        → "#attention-sounds"
             bun  → attention-sounds.bun.ts  (import mp3 with { type: "file" } → 构建期路径)
             node → attention-sounds.node.ts (require.resolve("@opencode/ui/audio/<name>")，可用
                                             OPENCODE_NODE_ASSETS_DIR 指到打包产物)

剪贴板：app.tsx → createTuiClipboard(renderer) → context/clipboard 提供
        mini/footer.prompt.tsx 也会按需 createTuiClipboard

外部编辑器：component/prompt/index.tsx → openEditor({ value, renderer })
        → 临时 md 文件 → renderer.suspend() → spawn($VISUAL || $EDITOR) → resume() → 读回内容
        连接/选区：editorIntegration.connection = discoverEditorConnection(directory)
                   editorIntegration.selection = resolveZedSelection(resolveZedDbPath() ?? "", directory)

模型偏好：context/local.tsx / component/dialog-model*.tsx / mini/variant.shared.ts
        → modelPreferenceKey / recentModels / favoriteModels / cycleModelVariant
        → createModelPreferenceRepository（JSON + Flock + safeWatch）

高亮：app.tsx → util/highlights.ts 的 decide/claim（版本 + 是否首跑）
调试条：context/theme.tsx → DevTools.register({ id: "theme-performance" }) → component/devtools-bar.tsx
```

## 数据与状态

- **双实现的选择机制在 `packages/tui/package.json` 的 `imports`**：`#attention-sounds`、`#string-width`、`#zed-sqlite`、`#runtime-plugin-support`。每个都是 `{ bun: ./src/x.bun.ts, node: ./src/x.node.ts, default: ... }`；前三者的 `default` 是 bun 实现，`#runtime-plugin-support` 的 `default` 是 node 实现。
- **模型偏好文档**：`{ recent, favorite, variant }`（`ModelPreferenceDocument`），模型键 `${providerID}/${modelID}`（`modelPreferenceKey`）；`recentModels` 去重后截到 10 条；写入走 `writeJsonAtomic`（临时文件 + rename），并发用 `@opencode/util/flock`，变更用 `safeWatch` 监听。
- **attention 状态**：`focus: "unknown" | "focused" | "blurred"`（来自 `renderer.on("focus"/"blur")`）；音量 `clamp(0..1)`，默认来自 `config.attention.volume`；标题截断 80、正文截断 240（`stripAnsi` + 控制字符清洗）。
- **devtools**：进程内 `Group[]`（`id/title/entries`），`register` 幂等（同 id 只更新 title）。
- **parsers-config**：静态表（python/rust/go/cpp/csharp/… 各自的 `.wasm` release URL 与 `highlights`/`locals` query URL），markdown/javascript/typescript 用 OpenTUI 内置解析器。
- **media 缓存**：`media:<hash>` 的字节按 hash 缓存，重连后仍有效。

## 关键不变式

- **宽度只能经 `util/string-width`**：bun 下是原生 `Bun.stringWidth`；node 回退会把「文本默认呈现」的 emoji（宽度 2 但无 VS16/ZWJ/keycap）按 1 计。绕过它会得到与 bun 构建不一致的换行/截断。
- **双实现必须同名导出**：`attention-sounds.{bun,node}` 都导出那五个路径常量，`string-width.{bun,node}` 都导出 `stringWidth`，`editor-zed-sqlite.{bun,node}` 都导出 `Database`；新增 `#` 条件导入必须同时改 `package.json` 的 `imports`。
- **node 下的资源路径是运行时解析的**：`attention-sounds.node.ts` 用 `require.resolve("@opencode/ui/audio/<name>")`，所以新增音效要同步改这里；bun 下靠 `with { type: "file" }`。
- **`audio.ts` 失败即静音**：`Audio.create` 抛错 → `audio = null`，之后 `loadSoundFile`/`play` 返回 `null`，只打 `console.debug`；TUI 不因没有音频设备而崩。
- **`attention.notify` 的 skip 是可解释的**：`attention_disabled`/`renderer_destroyed`/`empty_message`/`focused`/`blurred`/`focus_unknown`，`dispose()` 后所有 notify 都必须拒绝。
- **`setTerminalTitle` 必须跳过挂起态**：`renderer.controlState === EXPLICIT_SUSPENDED` 时 OpenTUI 拒绝控制指令（`$EDITOR` 期间），所以 `renderer.ts` 先判 `isDestroyed`/`EXPLICIT_SUSPENDED`，并在 `destroyRenderer` 里先清标题。
- **`safeWatch` 绝不抛**：`fs.watch` 在 inotify 配额耗尽（ENOSPC/EMFILE）时同步抛错、之后还会发 `"error"`；两者都关掉 watch 并打日志，同时尊重 `OPENCODE_FILEWATCHER_DISABLE`/`OPENCODE_DISABLE_FILEWATCHER`。
- **`writeJsonAtomic` 是唯一的 JSON 落盘方式**：临时文件 + rename，失败清理临时文件。
- **`variant` 的 `"default"` 与 `undefined` 不同**：`normalizeModelVariant` 只把 `"default"` 归一成 `undefined`，而存储层要保留显式 `"default"` 才能覆盖 agent 配置（`variants()` 的注释）。
- **`highlights.decide` 只对稳定版本生效**：预发布版本直接 `none`；首跑（无历史）只记版本不弹。
- **`parsers-config` 的注释是硬约束**：从 nvim-treesitter 取 query 时要把 `; inherits:` 依赖一起放前面，且部分 query 与 (web-)tree-sitter 不兼容（python highlights 已被注释掉）。

## 扩展点

- **加一个小工具**：放 `util/`，无状态、纯函数；宽度用 `stringWidth`，格式化用 `util/locale`。
- **加一对双实现**：`src/foo.bun.ts` + `src/foo.node.ts` + `src/foo.ts`（re-export `#foo`）+ `package.json` 的 `imports`。
- **加一个提示音**：`packages/ui/src/audio/*.mp3` → `attention-sounds.bun.ts`（import）与 `attention-sounds.node.ts`（resolve）→ `attention.ts` 的 `BUILTIN_SOUNDS` → `Config.AttentionSoundName` 若需新名字。
- **加一个 devtools 分组**：`DevTools.register({ id, title })` 然后 `set(key, value)`；`id` 一旦被 UI 特判就不能改（如 `theme-performance`）。
- **加一门语言的高亮**：`parsers-config.ts` 的 `parsers` 加 `{ filetype, wasm, queries }`。
- **改外部编辑器的连接/选区**：`editor.ts` 的 `editorIntegration`（`connection`/`selection`）是唯一出口，别在组件里直接读 `~/.claude/ide`。

## 常见改法与坑

- **node 下新增音效只改 `.bun.ts` 会在打包产物里 ENOENT**：`attention-sounds.node.ts` 的 key 是 `@opencode/ui/audio/<file>`，五处要一起改。
- **不要直接 `import "string-width"`**：绕过 `#string-width` 就没有 bun 原生实现，宽度会与渲染器不一致。
- **`#runtime-plugin-support` 的 default 是 node**：与另外三个相反，复制粘贴新增条件导入时容易搞反。
- **`model-preference` 的读写要经 `Flock`**：多个 TUI 实例同时写会互相覆盖；直接 `writeJsonAtomic` 而不拿锁会丢更新。
- **`editor.ts` 在 Windows 用 `shell: true`**：`$EDITOR` 里带参数（如 `code -w`）依赖这一点；改成直接 `spawn(parts[0])` 会让 Windows 上找不到可执行文件。
- **Zed 读取失败要退化成 `unavailable`**：`resolveZedSelection` 的三种结果（`selection`/`empty`/`unavailable`）分别对应"有选区""无选区""读不到库"，别把错误当成空选区。
- **`devtools` 组里的值只允许 `string | number | boolean | null`**：塞对象不会报错但渲染出来是 `[object Object]`。
- **TUI 与 Web 的预算文案是两份实现**：改一边的"剩余/已达上限/重置"措辞或阈值，记得同步 `util/usage-limits.ts` 与 `app/src/usage/limits.ts`。
- **`collapse-tool-output` 依赖 `locale` 的宽度/截断**：改了 locale 的截断规则会连带影响工具输出的折叠阈值。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/tui/package.json` | `imports` 的 bun/node 条件（`#string-width`/`#attention-sounds`/`#zed-sqlite`/`#runtime-plugin-support`） |
| `packages/tui/src/util/string-width.ts` | `stringWidth` 的 re-export 入口（`#string-width`） |
| `packages/tui/src/util/string-width.node.ts` | node 回退：分段 + 东亚宽度 + emoji 文本呈现修正 |
| `packages/tui/src/util/locale.ts` | `titlecase`/`truncate`/`truncateWidth`/`graphemes`/时间与数字格式化 |
| `packages/tui/src/util/persistence.ts` | `readJson`/`writeJsonAtomic`（临时文件 + rename） |
| `packages/tui/src/util/watch.ts` | `safeWatch`：ENOSPC/EMFILE 与 disable 开关 |
| `packages/tui/src/util/usage-limits.ts` | TUI 侧额度/预算呈现（`usageLevel`/`formatDollars`/`formatReset`） |
| `packages/tui/src/devtools/index.ts` | `register`/`data`：调试条的数据源 |
| `packages/tui/src/attention.ts` | `createTuiAttention`：通知/声音的判定与 `notify` |
| `packages/tui/src/attention-sounds.node.ts` | node 下用 `require.resolve`/`OPENCODE_NODE_ASSETS_DIR` 定位音效 |
| `packages/tui/src/audio.ts` | OpenTUI `Audio` 单例、音效缓存、失败静音 |
| `packages/tui/src/clipboard.ts` | `createTuiClipboard`/`createClipboardAdapter`：读写与错误归一 |
| `packages/tui/src/editor.ts` | `openEditor`、`discoverEditorConnection`、`editorIntegration` |
| `packages/tui/src/editor-zed.ts` | Zed sqlite 选区读取（`resolveZedSelection`/`resolveZedDbPath`） |
| `packages/tui/src/model-preference.ts` | 最近/收藏/变体的 JSON 仓库与纯函数 |
