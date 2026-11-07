---
id: misc/residual-modules
title: 零散模块（session-ui 文档层 / server 启动层 / UI 动效 / textjs / 类型守卫）
level: L2
layer: misc
status: stable
paths:
  - packages/session-ui/src/actions.ts
  - packages/session-ui/src/document.ts
  - packages/session-ui/src/file-presentation.ts
  - packages/session-ui/src/context
  - packages/session-ui/src/storybook
  - packages/server/src/fetch.ts
  - packages/server/src/media-uri.ts
  - packages/server/src/options.ts
  - packages/server/src/workerd.ts
  - packages/ui/src/motion-tuning.ts
  - packages/ui/src/motion-tuning-fields.ts
  - packages/ui/src/motion-tuning-features.ts
  - packages/tui/src/runtime.tsx
  - packages/tui/src/simulation/semantics.ts
  - packages/app/src/index.ts
  - packages/gui-plugins/src/icon-name.typecheck.ts
  - services/site/textjs/src
symbols:
  - SessionUserActions
  - SessionDocument
  - FilePartSource
  - PresentationFileDiff
  - ServerOptions
  - ServerFetch
  - ServerWorkerd
  - wantsMediaRefs
  - motionPresets
  - MotionPreset
  - SimulationSemantics
  - iconNamesMatch
related:
  - session-ui/timeline-message
  - session-ui/tool-renderers
  - contracts/httpapi-protocol
  - ui/primitives
keywords:
  - session-ui 文档层
  - server 启动
  - motion tuning
  - textjs
  - 类型守卫
  - workerd
source_hash: a9dcffcead1647f36246247a00f7c4941d037edb
---

## 职责

一批"没有独立成卡、但会被别处引用"的零散模块，按归属分四组：

| 组 | 文件 | 定位 |
| --- | --- | --- |
| session-ui 文档层 | `src/actions.ts`、`document.ts`、`file-presentation.ts`、`src/context/`、`src/storybook/` | 会话界面的数据契约与装配：用户动作（评论/附件引用）、`SessionDocument`、文件差异/内容的呈现类型、context 聚合（`context/index.ts` 只做 `export * from "./data"`）、storybook 夹具与场景 |
| server 启动层 | `src/fetch.ts`、`options.ts`、`media-uri.ts`、`workerd.ts` | `ServerFetch.make(options, boot)` 的启动装配、`ServerOptions` 校验、是否要媒体引用头的判定（`wantsMediaRefs`）、workerd 运行时入口（`ServerWorkerd.create`） |
| UI 动效 | `src/motion-tuning.ts`、`-fields.ts`、`-features.ts` | 动效预设（`snappy/smooth/calm`）、可调字段与开关矩阵 |
| 杂项 | `tui/src/runtime.tsx`、`tui/src/simulation/semantics.ts`、`app/src/index.ts`、`gui-plugins/src/icon-name.typecheck.ts`、`services/site/textjs` | TUI 运行时挂载点、模拟器的按键语义（`SimulationSemantics.bind`）、app 的 barrel 导出、图标类型一致性守卫（编译期断言）、站点文字渲染小包（`lite.tsx`/`picker.tsx`） |

## 边界

- 这些不是"功能模块"，而是**接口契约与装配点**；找功能实现请去对应 L2 卡（session-ui 两块见 `session-ui/timeline-message`、`session-ui/tool-renderers`，server 见 `server/*`，UI 见 `ui/primitives`）。
- `icon-name.typecheck.ts` 只为编译期类型一致性存在，没有运行时行为。

## 入口与调用链

- `ServerFetch.make` 是 `server` 启 HTTP 的入口之一（另一条是 `server/src/process.ts`，见 `runtime/process-lifecycle`），`BootOptions` 决定启动阶段的注入。
- `wantsMediaRefs(request)` 在返回媒体时决定响应是内联字节还是引用 URL，影响缓存与请求头。
- `session-ui/src/context/index.ts` 是纯 barrel，改导出即改所有消费方的 import 面。

## 数据与状态

- `SessionUserActions`/`SessionDocument` 是**渲染层数据形状**（不是持久化模型），持久化模型在 `schema/core-model`。
- `motionPresets` 是常量表；`-fields`/`-features` 提供可调项的声明，供设置页读写。
- storybook 的 `current-session-*` 是夹具：给 `session-ui` 组件做确定性渲染测试，不参与生产构建。

## 关键不变式

- 改 `session-ui/src/context/` 的导出或 barrel，会同时影响 app 与 gui-plugins 的 import，属于破坏性改动。
- `wantsMediaRefs` 与媒体 URL 的生成必须成对：只改一边会出现"返回了引用头但内容被内联"的错配。
- `iconNamesMatch` 这类编译期守卫只能在类型层生效，别试图在运行期依赖它。
- storybook 夹具要能反复探索（无副作用），不要把真实网络/磁盘操作塞进去。

## 扩展点

- **加一个动效预设**：`motion-tuning.ts` 的 `motionPresets` 加条目 → `-fields`/`-features` 声明可调项 → 设置页读它。
- **加一种呈现类型**：`file-presentation.ts` 联合类型 + 渲染方（`session-ui/tool-renderers`）。
- **workerd 部署差异**：`server/src/workerd.ts`，注意与 node 入口的选项差异。

## 常见改法与坑

- `app/src/index.ts` 是 barrel：加导出会把模块拖进主包，注意包体与循环依赖。
- `tui/src/runtime.tsx` 是挂载点而非组件库，改它相当于改 TUI 启动顺序。
- `services/site/textjs` 是站点构建期的小渲染器，改了要重新构建站点产物（见 `services/docs-site`）。
- `simulation/semantics.ts` 只服务模拟器（`packages/simulation`），不要在生产路径引用。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/session-ui/src/actions.ts` | 用户动作用户评论/附件引用类型 |
| `packages/session-ui/src/document.ts` | `SessionDocument` 形状 |
| `packages/session-ui/src/file-presentation.ts` | 文件差异/内容呈现类型 |
| `packages/session-ui/src/context/index.ts` | context barrel |
| `packages/session-ui/src/storybook/*` | 会话夹具与场景 |
| `packages/server/src/fetch.ts` | `ServerFetch.make` 启动装配 |
| `packages/server/src/options.ts` | `ServerOptions` schema |
| `packages/server/src/media-uri.ts` | `wantsMediaRefs` |
| `packages/server/src/workerd.ts` | workerd 入口 |
| `packages/ui/src/motion-tuning*.ts` | 动效预设与可调项 |
| `packages/tui/src/runtime.tsx` | TUI 挂载点 |
| `packages/tui/src/simulation/semantics.ts` | 模拟器按键语义 |
| `packages/app/src/index.ts` | app barrel |
| `packages/gui-plugins/src/icon-name.typecheck.ts` | 图标名编译期守卫 |
| `services/site/textjs/src/*` | 站点文字渲染小包 |
