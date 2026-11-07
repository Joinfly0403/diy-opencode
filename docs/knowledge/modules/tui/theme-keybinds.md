---
id: tui/theme-keybinds
title: 主题 token 与 keybind 配置
level: L1
layer: tui
status: stable
paths:
  - packages/theme/src/tui
  - packages/tui/src/theme
  - packages/tui/src/config
  - packages/tui/src/context/theme.tsx
symbols:
  - ThemeDocument
  - ThemeDefinition
  - ModeDefinition
  - BaseThemeDefinition
  - ThemeTokensDefinition
  - DialogTokensDefinition
  - TextDefinition
  - BackgroundDefinition
  - SyntaxDefinition
  - MarkdownDefinition
  - MarkdownToken
  - SyntaxToken
  - HueStep
  - HueName
  - HueDefinition
  - CategoricalDefinition
  - ActionState
  - ActionVariant
  - FeedbackKind
  - FormfieldState
  - SurfaceName
  - StatefulColorDefinition
  - parseThemeDocument
  - resolveThemeDocument
  - resolveTheme
  - selectTheme
  - selectThemeMode
  - supportsThemeMode
  - themeModes
  - expandTheme
  - migrateV1
  - migrateV1NewDesigns
  - generateSyntax
  - rgbToOklch
  - themeDecodeError
  - ResolvedTheme
  - ResolvedThemeTokens
  - DEFAULT_THEMES
  - allThemes
  - hasTheme
  - isThemeSource
  - parseTheme
  - setCustomThemes
  - setSystemTheme
  - subscribeThemes
  - getOpenCodeTheme
  - getOpenCode2Theme
  - resolveThemeColors
  - generateSystem
  - terminalMode
  - ansiToRgba
  - tint
  - createComponentTheme
  - ComponentTheme
  - discoverThemes
  - ThemeError
  - ThemeSource
  - createThemeSource
  - createSyntaxStyleMemo
  - useTheme
  - useThemes
  - ThemeContextProvider
  - Config
  - Info
  - Interface
  - Cursor
  - Plugin
  - DiffSource
  - MiniWorkSpinner
  - AttentionSoundName
  - AttentionSoundPaths
  - resolve
  - useConfig
  - useCursorStyle
  - useNewDesigns
  - useClientMcpExperiment
  - TuiKeybind
  - Definitions
  - LeaderDefault
  - KeybindOverrides
  - BindingValueSchema
  - bindingDefaults
  - defaultValue
  - parse
  - toBindingConfig
  - unknownKeys
  - BindingLookupView
  - CommandMap
depends_on:
  - contracts/config-flag
related:
  - tui/components
  - tui/routes-shell
  - tui/mini
  - core/plugin-system
config_keys:
  - theme.name
  - theme.mode
  - keybinds
  - leader.timeout
  - experimental
  - animations
  - mouse
  - cursor.style
  - cursor.blinking
  - diffs.source
  - diffs.wrap
  - tabs.mode
  - tabs.layout
  - tabs.scope
  - tabs.indicators
  - session.new_location
  - session.permissions
  - attention.notifications
  - attention.sound
  - attention.volume
  - attention.sound_pack
  - attention.sounds
  - scroll.speed
  - scroll.acceleration
keywords:
  - 主题
  - theme
  - token
  - 亮暗
  - 自定义主题
  - 回退
  - keybind
  - 快捷键配置
  - leader
  - config
source_hash: eadad2a8f8ef05248adf8ba99ecf47765bc97ac4
---

## 职责

两套配置面：

1. **主题**：`packages/theme/src/tui` 是与渲染器无关的纯逻辑（Effect Schema 定义、展开、迁移、模式选择、解析），`packages/tui/src/theme` 是 TUI 侧的主题目录、内置 JSON、系统主题生成与 v1 解析，`context/theme.tsx` 把结果变成组件可读的 `ResolvedTheme`。
2. **keybind 与 TUI 配置**：`packages/tui/src/config` 定义 `Info`（theme/keybinds/plugins/leader/scroll/attention/diffs/session/tabs/cursor/mouse/experimental…）、`resolve()` 默认值、keybind 名字表与解析。

## 边界

做什么：token 命名与解析、亮暗模式选择、自定义主题加载与校验、系统主题生成、语法高亮配色、快捷键默认值与覆盖解析、TUI 配置文件读写与热重载。

不做什么：
- 不定义组件（见 `tui/components`），组件只消费 `useTheme()`。
- 不做 keymap 运行时（绑定生效、冲突、mode 栈在 `context/keymap.tsx`；这里只提供"命令名 → 绑定"的数据）。
- 不做全局配置文件的 schema（服务端/产品级配置在 `contracts/config-flag` 与 schema 包）。

## 入口与调用链

```
配置文件 → Config.Interface.get() → Config.resolve(info) → Info → Resolved（含 bindingLookup）
app.tsx run()  → <ThemeProvider mode={…} source={createThemeSource(global.config)}>
                    → discoverThemes(<config>/themes) / generateSystem(终端调色板) / setCustomThemes
                    → parseTheme(source) → parseThemeDocument | migrateV1 | migrateV1NewDesigns
                    → resolveThemeDocument(document, mode) → ResolvedTheme（含 surface("dialog")）
组件 → useTheme() → theme.text.base / background.raised.base / … 或 useThemes() → set/setMode/lock
Keymap.Provider → createDefaultOpenTuiKeymap → 每层 createLayer(config.keybinds.get(id))
```

- 主题来源优先级（`tui/src/theme/index.ts`）：内置 `DEFAULT_THEMES` < 用户自定义文件 < 生成的 `system`；`opencode` 用 `assets/v2/opencode.json`，`opencode2` 只在 `new-designs` 实验下由 `getOpenCode2Theme()` 提供（不进 `allThemes()`）。
- 主题发现：`createThemeSource(config)` → `discoverThemes(configDirectories(config, cwd))`（读每个配置目录下 `themes/*.json`）；也可用 `SIGUSR2` 触发刷新。
- 模式：`config.theme.mode` 为 `dark|light` 时是锁定模式，`system` 时跟随终端（`renderer.themeMode`/`waitForThemeMode`），锁定/解锁走 `themes.lock()`/`unlock()`。
- keybind：`app.tsx` 的 layer 只写命令 id，`createLayer` 用 `config.keybinds.get(id)` 取实际绑定；用户覆盖在 `resolve()` 里经 `TuiKeybind.parse` 解成完整 `Keybinds` 再 `createBindingLookup`。

## 数据与状态

- `ThemeDocument`（`schema.ts`）：`{ base, light?, dark? }`，**必须**有 `base` 且 `light`/`dark` 至少有一个；`base` 是 `BaseThemeDefinition`（categorical + 全部 token），模式是 `ModeDefinition`（hue + 可选 token 覆盖）。
- `ColorValue` 只能是 `#hex`、`transparent` 或 `$引用`；hue 引用形如 `$hue.<name>.<100..900>`；语义 hue 固定 `accent | interactive | neutral`，缺一个即校验失败。
- token 树：`text.{base,muted,faint,action{primary,secondary,destructive},formfield,feedback{error,warning,success,info}}`、`background.{base,raised{base,high,max},action,formfield,feedback}`、`border.base`、`scrollbar.base`、`diff.*`、`syntax.<9 token>`、`markdown.<14 token>`，另有 `@dialog`（可再含 `@footer`）覆盖层。
- 状态色（`$hovered/$focused/$pressed/$selected/$disabled`）在解析后变成 `StatefulColor`：既能读 `base`，也能用 `state(states)` 求当前值；`ResolvedTheme.surface(name)` 返回同一主题在提升表面上的再解析结果（绝对：所有视图的 surface 都基于 base 主题）。
- 主题对象缓存用 `WeakMap`（`tui/src/theme/index.ts` 的 `parsed.current` / `parsed.newDesigns`），同一 source 对象只解析一次；自定义主题与系统主题是模块级变量 + 订阅者集合。
- keybind 数据：`Definitions`（每个名字带 `default` 与 `description`）、`LeaderDefault = "ctrl+x"`、`Descriptions`、`KeybindOverrides`（Effect Schema，逐 key 可选）。配置默认值在 `resolve()`：leader timeout 2000ms、mouse true、cursor block+blinking、attention volume 0.4 / sound_pack `opencode.default`、session.new_location `launch` / permissions `prompt`、tabs.mode `auto`（`HERDR_ENV=1` 时禁用）、layout `horizontal`、indicators `status`。
- 主题/配置无数据库表参与；`system` 主题的终端调色板缓存写到 storage 键 `system-theme`，重启后先读缓存再刷新。

## 关键不变式

- **按语义角色选 token，不按当前颜色选**（根 AGENTS.md「TUI Theme Tokens」）：禁止直接用 `theme.hue` 原始值；禁止借不相关的语义 token 凑外观；`text.feedback`/`background.feedback` 只给结果/状态反馈；表单控件文本、序号、选中标记用 `formfield`，动作态用 `action`；缺角色时**先扩 schema + defaults + resolution + types**，再在组件里用。
- 改公开 token 面时必须同时验证内置亮/暗默认值与自定义主题回退路径，而不只是改到的组件。
- **主题模式回退在 `selectThemeMode`**：请求的模式不在 `themeModes(document)` 里时回退到文档提供的第一个模式；一个模式都没有则抛 `Theme must provide at least one mode`。自定义主题只写 `dark`（或只写 `light`）是合法的。
- **v1 主题走迁移，不走新 schema**：`isThemeSource` 用 `"theme" in source || "base" in source` 区分；带 `theme` 键的旧文档必须过 `migrateV1`（或实验下的 `migrateV1NewDesigns`），否则 `parseThemeDocument` 会 `themeDecodeError`。
- **主题错误是事件不是崩溃**：`context/theme.tsx` 把解析失败经 `themeErrors.emit` 交给 `ThemeErrorToast`，没有监听者时暂存（pending）直到有人订阅。
- **`system` 主题永远有值**：`listThemes()` 末尾 `system: systemTheme ?? themes.system ?? themes.opencode`，保证跟随终端时不会空主题。
- **keybind 名字是公开 API**：删除的名字要保留为 `none` + `Deprecated:` 描述（`Definitions` 里能看到 `diff.toggle`、`session.share` 这类先例），否则老配置会让 `parse()` 抛 `Unrecognized keybind`。
- **配置更新要窄**：`useCursorStyle()` 用 `createMemo` 只随 cursor 配置变化（注释：每次 render 新建对象会在无关 prop 变化时重设 textarea 样式，丢掉插件设的样式）。
- **实验开关是 `config.experimental[<key>]`**：`useNewDesigns`/`useClientMcpExperiment` 是唯一读取方式，不要在组件里直接读对象。

## 扩展点

- **加一个主题 token 角色**：`packages/theme/src/tui/schema.ts` 加字段（含 `Complete*` 与 `Mode`/`Base` 两套）→ `expand.ts` 的合并/reference 解析 → `resolve.ts` → `types.ts` 的 `ResolvedThemeTokens` → 内置 `assets/v2/opencode*.json` 与 `DEFAULT_THEMES` 补默认值 → 最后才在组件里用。
- **加一个内置主题**：`packages/tui/src/theme/assets/`（v2 格式）或 `v1.ts` 的 `DEFAULT_THEMES` → `allThemes()` 自动收录，`DialogThemeList` 无需改。
- **加一个 keybind**：`packages/tui/src/config/keybind.ts` 的 `Definitions` 加 `keybind(default, description)` → 在消费处（`app.tsx` 的 layer 或组件里的 `Keymap.createLayer`）引用该 id。
- **加一个 TUI 配置项**：`config/index.tsx` 的 `Info` schema 加字段 → `resolve()` 给默认值 → 消费处用 `useConfig()`；需要热重载时什么都不用做（provider 监听配置文件）。
- **加一个实验**：先在 schema 的 `experimental` 键下声明，再走 `tui/components` 里 `dialog-experiments` 的注册表。

## 常见改法与坑

- 在组件里用 `RGBA.fromHex("#…")` 硬编码颜色：亮暗切换、自定义主题、dialog surface 三重路径都会失效。
- 把 `$hue.accent.500` 之类的引用写错层级（少一段 step）会 schema 校验失败，报错来自 `themeDecodeError`，不是运行时缺色。
- 只改 `ModeDefinition` 忘了 `BaseThemeDefinition`：`base` 是完整 token 树，漏字段在解析期就抛。
- 自定义主题只写 `light` 却在暗色终端下打开：会走 `selectThemeMode` 回退到 light，这是预期行为，不要"修"成报错。
- 改 `LeaderDefault` 会同时改变 keymap 的显示别名（`formatOptions` 用它做 `leader` 的展示 token），快捷键帮助文本会一起变。
- keybind 的值同时接受 `false` 与 `"none"`（schema 里是不同字面量，都会进 `Keybinds`）；仓库里"删绑定"的既有做法是一律写 `"none"`（`Definitions` 中大量条目），改成 `false` 前先确认 lookup 行为（待确认）。
- 终端调色板查询与帧输出串行（注释原文：`Terminal palette queries serialize with frame output`），首帧用缓存或内置回退；`afterPaint()` 必须在可见输出之后触发（`app.tsx` 里 50ms 延迟就是为此）。
- `input.undo` 的 `ctrl+z` 是在 `resolve()` 里拼进去的（与原有绑定去重），改 undo 默认值要改这里而不是只改 `Definitions`。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/theme/src/tui/schema.ts` | token 与主题文档的 Effect Schema、状态色、语义 hue |
| `packages/theme/src/tui/resolve.ts` | 文档 → 解析结果（含 surface 与 footer 覆盖） |
| `packages/theme/src/tui/expand.ts` | reference 展开与 base/mode 合并 |
| `packages/theme/src/tui/select.ts` | 模式选择与回退 |
| `packages/theme/src/tui/syntax.ts` | 语法高亮样式生成 |
| `packages/theme/src/tui/types.ts` | `ResolvedTheme`/`StatefulColor` 类型 |
| `packages/theme/src/tui/v1-migrate.ts` | v1 主题迁移 |
| `packages/tui/src/theme/index.ts` | 主题目录、优先级、解析缓存、订阅 |
| `packages/tui/src/theme/system.ts` | 由终端调色板生成 `system` 主题 |
| `packages/tui/src/theme/discovery.ts` | `<config>/themes/*.json` 发现 |
| `packages/tui/src/theme/resolve.ts` | v1 主题色解析（引用/ANSI/循环检测） |
| `packages/tui/src/context/theme.tsx` | 主题上下文、模式锁、错误事件、调色板刷新 |
| `packages/tui/src/config/index.tsx` | `Info` schema、`resolve()` 默认值、配置热重载 |
| `packages/tui/src/config/keybind.ts` | keybind 名字表、默认绑定、解析与校验 |
| `packages/tui/src/config/v1/keybind.ts` | 旧版 keybind 名字表（兼容） |
