---
id: ui/primitives
title: 跨端 UI 基础件（@opencode/ui）
level: L2
layer: ui
status: stable
paths:
  - packages/ui/src/actions
  - packages/ui/src/components
  - packages/ui/src/context
  - packages/ui/src/data-display
  - packages/ui/src/feedback
  - packages/ui/src/forms
  - packages/ui/src/hooks
  - packages/ui/src/icons
  - packages/ui/src/i18n
  - packages/ui/src/layout
  - packages/ui/src/motion
  - packages/ui/src/navigation
  - packages/ui/src/overlays
  - packages/ui/src/storybook
  - packages/ui/src/styles
  - packages/ui/src/theme
  - packages/ui/src/typography
  - packages/stories/src
  - packages/stories/playwright
symbols:
  - Button
  - ButtonProps
  - Select
  - SelectProps
  - TextInput
  - TextInputProps
  - Dialog
  - DialogBody
  - DialogFooter
  - DialogHeader
  - DialogTitle
  - DialogProvider
  - useDialog
  - useDialogLayer
  - createDialogStackState
  - transitionDialogStack
  - DialogStackState
  - DIALOG_EXIT_MS
  - selectTopDialog
  - Tabs
  - Keybind
  - TextShimmer
  - ScrollView
  - Icon
  - newIcons
  - setNewIcons
  - IconName
  - getIcon
  - iconNames
  - createListState
  - transitionList
  - listActive
  - listScrollTarget
  - groupItems
  - selectListEmptyState
  - LIST_LOAD_TIMEOUT_MS
  - useFilteredList
  - FilteredListProps
  - pinSpinPhase
  - syncSpinPhase
  - springStyle
  - slidingHighlight
  - widthMorph
  - numberTween
  - ThemeProvider
  - useTheme
  - themeToCss
  - themeV2ToCss
  - resolveThemeV2
  - resolveThemeVariant
  - resolveThemeVariantV2
  - generateV2Primitives
  - mapV2Semantics
  - mergeV2Tokens
  - V2_PRIMITIVES_DEFAULT
  - ColorValue
  - ResolvedTheme
  - ResolvedV2Theme
  - DesktopTheme
  - ThemeToken
  - ThemeVariant
  - blend
  - withAlpha
  - oklchToHex
  - rgbToOklch
  - createUiI18n
  - useI18n
  - pluralCategory
  - pluralKey
  - UiI18n
  - UiTranslate
  - localizedListSeparator
  - resolveTemplate
  - showToast
  - toaster
  - Toast
  - ToastOptions
  - transitionTextFieldCopy
  - TextFieldCopyState
  - transitionTypeahead
  - createTypeaheadState
  - transitionScrollThumb
  - scrollOffsetFromThumbPointer
  - canScrollKey
  - create
  - story
  - sourceURL
  - componentConfig
depends_on:
  - contracts/httpapi-protocol
related:
  - tui/components
  - tui/theme-keybinds
  - core/plugin-system
keywords:
  - UI
  - 组件库
  - Solid
  - DOM
  - 主题
  - i18n
  - 排版
  - 动画
  - 状态机
  - storybook
  - 组件测试
source_hash: 2d54f54501549043086dd4cdd21657b168edd6bd
---

## 职责

`@opencode/ui`：给 Web 桌面端（app / gui-plugins / session-ui / desktop / stats）用的 Solid + DOM 组件库与设计系统。

- 组件按角色分目录：`actions/`（button / icon-button / split-button）、`forms/`（checkbox / field / inline-input / radio / search-list / select / switch / text-input / textarea / typeahead）、`data-display/`（accordion / avatar / badge / diff-changes / keybind / line-comment / project-avatar）、`feedback/`（activity-ring / loader / progress-circle / toast）、`navigation/`（menu / segmented-control / tabs）、`overlays/`（dialog / mcp-sign-in / tooltip）、`typography/`（slash / text-shimmer / wordmark）、`layout/divider`、`icons/`、`components/`（组合件：list / card / scroll-view / popover / image-preview / progress / spinner / text-field / typewriter…）。
- 基础设施：`context/`（dialog 栈、file、i18n、marked 解析、helper）、`hooks/`（list/auto-scroll/spin-phase/filtered-list）、`motion/`（弹簧 + 共享帧循环 + WAAPI 控制器）、`theme/`（v1 主题 JSON、v2 原语与 CSS 变量生成）、`styles/`（token CSS 与 tailwind 入口）、`i18n/`（各语言字典）。
- `packages/stories` 是这些组件的 story 服务器与 Playwright 组件测试宿主。

## 边界

做什么：无业务语义的视觉与交互原语、主题 token 到 CSS 变量的解析、i18n 运行时、DOM 动画、组件级状态机，以及 story/组件测试的挂载契约。

不做什么：
- **不服务 TUI**：`packages/tui` 只从 `@opencode/ui` 引音频资源（`audio/*.mp3` 用于注意音），组件全部是 DOM/Solid，TUI 用的是 OpenTUI 渲染器（见 `tui/components`）。
- 不含服务端数据获取：组件接收 props 或读 app 侧 context；`packages/stories` 的 mocks 在页面内假扮 server/SDK/sync。
- 不定义产品文案：所有用户可见字符串必须是 i18n key。
- 不实现桌面端外壳逻辑（`packages/app`、`packages/desktop`、`packages/gui-plugins` 的事）。

## 入口与调用链

```
消费方 → import { Button } from "@opencode/ui/button"      （package.json exports 子路径）
        → import "@opencode/ui/styles" / "./styles/tailwind" （CSS 与 tailwind 入口）
        → import { useI18n } from "@opencode/ui/context/i18n"
组件 → useTheme()（theme/context）→ CSS 变量 / token → 类名 + 内联变量
表单 → *-machine.ts 的 transition(state, event) 产出 effects → 组件执行副作用
story → *.stories.tsx（与组件同目录）→ stories 的 index-plugin 扫描 → #[story-id]
测试 → packages/stories/playwright/story.ts 的 mount() + sourceURL() → Playwright 断言
```

- 打包：`exports` 逐组件列子路径，`./*` 兜底到 `src/components/*.tsx`，`sideEffects` 只声明 `**/*.css`；构建是 `tsc -p tsconfig.build.json` 到 `dist`，开发用 `vite`。
- 主题：`themeToCss`/`themeV2ToCss` 把主题解析成 CSS 变量；`theme/desktop-theme.schema.json` 是桌面主题文件的外部契约；`theme/themes/*.json` 是 v1 内置主题，`theme/v2/` 提供 primitives/mapping/resolve。
- i18n：`createUiI18n(source)` → `I18nProvider` → `useI18n()` 给出 `{ t, plural, tDynamic, list, listSeparator, locale }`；缺失 key 回退到英文来源。

## 数据与状态

- 组件状态机是纯函数模块（`*-machine.ts`）：`createXState` + `transitionX(state, event)` 返回 `{ state, effects }`，选择器（`select*`）单独导出；UI 组件只负责跑 effect。
- 受控/非受控：既有 `controlled | uncontrolled` 的机器模式（见 `hooks/list-machine.ts` 作为先例），公开 props API 必须保持兼容。
- dialog 栈状态在 `context/dialog-machine.ts`（`DialogStackState`/`transitionDialogStack`/`DIALOG_EXIT_MS`/`selectTopDialog`），DOM 呈现由 `context/dialog.tsx` 的 provider 驱动。
- 主题解析结果（`ResolvedTheme`/`ResolvedV2Theme`）是运行时值，最终写成一族 CSS 变量；组件不持有主题副本。
- i18n 字典是静态模块（`src/i18n/<locale>.ts`），运行时只保留当前 locale 与英文回退；`tDynamic` 用于运行时生成的英文源文案。
- 持久化不在本包：状态要么在 props，要么由消费方（app/gui-plugins）持久化。

## 关键不变式

- **禁止硬编码用户可见英文**（`packages/ui/AGENTS.md` Localization）：组件默认值、可见文案、placeholder、可访问标签、tooltip、dialog、toast、空态、展示的错误，全部走 i18n key。
- **功能开发只加英文源 key**：非英文 key 留空让运行时回退到英文，翻译在语言评审后单独落地。
- **复数必须有 `plural(baseKey, count, params)`**：绝不把 `.zero/.one/.two/.few/.many/.other` 变体直接传给 `t(...)`；`pluralForm(...)` 只给需要逐字形做动画的组件（`pluralCategory`/`pluralKey` 是它的底层）。
- **不得为便于翻译改动既有英文文案或英文 key**：英文是设计师写的源文案；要适配就在翻译与 i18n 机制侧适配。
- **`tDynamic(...)` 用于运行时生成的英文源**：功能代码里不允许按 locale 分支。
- **排版度量统一**：`--line-height-tight` 12px / `--line-height-compact` 16px / `--line-height-base` 20px；13px 的 Inter 至少用 compact 16px（13px 实心行盒会裁 `g j p q y`）；`line-height: 1` 只给非文本字形；不要用 transform、负 margin 或 clip-padding 补偿文本。
- **`TextShimmer` 继承父级字体度量**：要覆盖排版就写在它的父节点上。
- **字体只用 `var(--font-family-sans)` / `var(--font-family-mono)` 及其别名**：不写具体字族，不在本包加字体文件或 `@font-face`。
- **生命周期按 `packages/app/AGENTS.md` 的 State Machines 段**：接受受控值的组件在机器里有唯一真源与显式 `controlled | uncontrolled` 模式。
- **motion 的所有权**（`src/motion/README.md`）：Solid 只提供目标值，motion 拥有"显示值"；绘制回调必须直接写 DOM，不能写回 signal；`springStyle` 复用其值记录，不要长期持有；`frameLoop.addMeasured(read, write)` 保证所有读先于所有写。
- **story 契约**（`packages/stories`）：story 放在组件旁 `src/**/*.stories.tsx`；story id 取 meta 的 `id`，否则 `kebab(title)--kebab(export)`；`globals` 是 `theme`（默认 light）、`direction`、`locale`；ID 错就是"没有这个 story"，`mount` 会等满 30s 再失败。

## 扩展点

- **加一个组件**：`src/<category>/<name>/<name>.tsx` + `<name>.css` + `<name>.stories.tsx` → `package.json` 的 `exports` 加子路径（css 若被子路径引用也要单独导出）→ 若需要内部状态，加 `<name>-machine.ts` 并写单测。
- **加一个主题 token**：`src/theme/types.ts` 的 token 类型 → `theme/resolve.ts` / `theme/v2/mapping.ts` 的解析 → `themeToCss`/`themeV2ToCss` 的变量输出 → `styles/tokens/*.css` 与 `tailwind` 生成（`bun run generate:tailwind`）。
- **加一条 i18n 文案**：`src/i18n/en.ts` 加英文源 → 组件用 `t("…")` 或 `plural("…", count)`；其它语言留空。
- **加一个 story**：用 `@opencode/ui/storybook/scaffold` 的 `create({ title, mod, name?, args? })` 生成 `meta` + `Basic`，导出 default；文件名必须 `*.stories.tsx`（story 索引与 Vite 预打包扫描只认这个扩展名）。
- **加一个组件测试**：`packages/stories/playwright/config.ts` 的 harness + `mount(id, { args, globals })`；源码模块用 `sourceURL(new URL("<相对路径含扩展名>", import.meta.url))` 引入。

## 常见改法与坑

- 新组件忘了 `package.json` 的 `exports`：消费方 `import "@opencode/ui/<name>"` 直接解析失败（`./*` 只兜底到 `src/components/*.tsx`）。
- 把 CSS 写在组件里但 `sideEffects`/exports 没带上：生产构建会丢样式。
- 用 `t(`…${n}`)` 拼数量：违反复数约束，且`t` 的类型只接受字典 key。
- 直接给 `TextShimmer` 传字号/行高：它继承父级度量，改父节点。
- 在 `render` 里同步读布局再写样式：违反 motion 的 read-before-write 阶段划分，会造成布局抖动。
- 把 `springStyle` 的值对象存进 signal 或闭包长期持有：README 明确它会被复用。
- 组件 props 里给默认英文串（而不是 i18n key）：评审会被拦。
- story 里依赖只存在于 `packages/stories/mocks` 的导出：app 的组件实验室会用真实 app 渲染同一 story，会挂。
- 端口/URL：story 服务器默认 6006（`bun --cwd packages/stories dev`），组件测试的 fixture server 一律 `port: 0`，不要写死端口。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/ui/package.json` | 子路径 exports、sideEffects、构建与生成脚本 |
| `packages/ui/AGENTS.md` | 本地化、状态机、排版、字体的硬约束 |
| `packages/ui/src/context/i18n.tsx` | i18n 运行时：`t`/`plural`/`tDynamic`/`list`、复数类别与回退 |
| `packages/ui/src/context/dialog-machine.ts` | dialog 栈状态机与选择器 |
| `packages/ui/src/hooks/list-machine.ts` | 受控/非受控列表状态机（受控组件先例） |
| `packages/ui/src/theme/index.ts` | 主题解析入口、OKLCH 工具、CSS 变量输出 |
| `packages/ui/src/theme/types.ts` | token 与主题类型 |
| `packages/ui/src/theme/v2/resolve.ts` | v2 原语与语义映射解析 |
| `packages/ui/src/styles/tokens/index.css` | token CSS（变量层） |
| `packages/ui/src/motion/README.md` | 弹簧/帧循环所有权与测量阶段规则 |
| `packages/ui/src/motion/solid.ts` | Solid 侧动画原语（`springStyle` 等） |
| `packages/ui/src/storybook/scaffold.tsx` | story 脚手架 `create()` |
| `packages/stories/vite.config.ts` | story 索引与 Vite 预打包入口 |
| `packages/stories/playwright/story.ts` | 组件测试挂载与源码 URL 引入 |
| `packages/ui/src/components/scroll-view.tsx` | 组合件范例（滚动 + 机器 + 选择器） |
