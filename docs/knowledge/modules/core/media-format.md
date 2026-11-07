---
id: core/media-format
title: 格式化、图像与渲染适配
level: L2
layer: core
status: stable
paths:
  - packages/core/src/formatter.ts
  - packages/core/src/formatter
  - packages/core/src/image.ts
  - packages/core/src/image
  - packages/core/src/file-write.ts
  - packages/core/src/config/plugin/formatter.ts
  - packages/core/src/config/plugin/image.ts
  - packages/latex/src
  - packages/merman/src
  - packages/patchmark/src
symbols:
  - Formatter
  - Image
  - FileWrite
  - ResizerUnavailableError
  - DecodeError
  - SizeError
  - Limits
  - Photon
  - PhotonNormalize
  - ImageNotice
  - ConfigFormatterPlugin
  - ConfigImagePlugin
  - renderLatex
  - createLatexCodeBlockRenderer
  - LatexParseError
  - DEFAULT_MAX_SOURCE_LENGTH
  - detectMermaidDiagram
  - MermaidSyntaxError
  - createMermaidCodeBlockRenderer
  - createMarkdownStream
  - PatchmarkStream
  - healStreamingInline
  - parseInlines
  - renderBlocksToHtml
config_keys:
  - formatter
  - media.image
depends_on:
  - core/location-instance
  - contracts/config-flag
related:
  - core/tool-registry
  - core/background-jobs
keywords:
  - formatter
  - 格式化
  - prettier
  - lsp
  - 图像
  - 缩放
  - photon
  - latex
  - mermaid
  - markdown
  - 渲染
  - 终端
tests:
  - packages/core/test/formatter.test.ts
  - packages/core/test/image-photon.test.ts
  - packages/core/test/config/image.test.ts
  - packages/latex/src/parser.test.ts
  - packages/latex/src/markdown.test.ts
  - packages/merman/src/test/markdown.test.ts
  - packages/patchmark/test/patchmark.test.ts
  - packages/patchmark/test/commonmark-spec.test.ts
source_hash: 87443bc3a9fc181faa1f7a4de8425987c40eaa35
---

## 职责

四块互不相干的"内容加工"，因为都是"把某类输入变成另一类表示"而放在一张卡：

| 子模块 | 职责 |
| --- | --- |
| `formatter.ts` + `formatter/builtins.ts` | 写文件后按扩展名选格式化器并执行（`$FILE` 占位） |
| `image.ts` + `image/` | 图像归一化：解码、判断尺寸/体积、缩放与重编码（photon wasm） |
| `packages/latex`、`packages/merman` | TUI 里把 `latex`/`math`、`mermaid` 代码块渲染成终端字符画 |
| `packages/patchmark` | 流式 Markdown 解析器：把增量文本切成块/补丁，并渲染 HTML |

## 边界

- **没有 LSP**：`tool/plugin/edit.ts`、`write.ts`、`file-mutation.ts` 三处都写着 `TODO: ... after LSP runtime exists`。改文件后只有 formatter，没有诊断。
- Formatter **不做语法检查、不决定"该用哪个格式化器"的策略**：只按 `extname` 命中 + 注册顺序依次尝试；是否启用由 builtins/`config` 决定。
- Image **不改像素内容语义**：只保证尺寸/体积在配置上限内（等比缩放 + JPEG/PNG 重编码），不做裁剪、旋转、水印。
- latex/merman/patchmark **都不在 server 侧**：latex 与 merman 是 TUI 插件（`@opencode/plugin/tui` + `@opentui/core`），patchmark 被 app/session-ui 消费。三者都不产生图片，也不调用网络。
- patchmark **不解析 mermaid/latex 语法、不做语法高亮**：它只负责 Markdown 结构（块 + inline），数学分隔符只在类型里记录。

## 入口与调用链

**写文件 → 格式化**

```
write/patch 工具 → FileWrite.commit → FileMutation.writeTextPreservingBom
                → Formatter.file(target.absolute) → 命中扩展名的 enabled 命令 → 跑子进程
                → 成功（exit 0）则 FileMutation.syncTextBom 重新读回（返回 formatted 快照）
```

- 配置侧：`ConfigFormatterPlugin` 用 `formatter/builtins.make({directory, worktree, fs, npm, processes, bin})` 生成内置列表后 `editor.set` 逐个注册，再叠加 config `formatter` 文档（`disabled` 删、`command`/`extensions`/`environment` 覆盖）。

**图像归一化**

```
工具输出里的 image 内容 → Tool.Service 的 normalizeImages → Image.normalize
会话附件的图片 → session/prompt.ts → Image.normalize
config media.image → ConfigImagePlugin → editor.configure
Image.normalize → 懒加载 image/photon.js 适配器 → worker 线程（不可用则主线程）→ PhotonNormalize.normalize
```

**渲染适配**

- latex：`plugin.ts` 注册 `"latex"`/`"math"` 代码块渲染器 → `markdown.ts` `layoutLatex(token.text)`（`renderLatex({strict, displayMode})`）→ `TextRenderable`（外层 `ScrollBoxRenderable` 支持横向滚动）。
- merman：`plugin.ts` 注册 `"mermaid"` → `detectMermaidDiagram` 选 kind → 对应 `parse*/layout/drawing` 产出字符网格 → `render-*-grid` 转 `StyledText` → `StaticDiagramRenderable`。
- patchmark：`session-ui` 的 `markdown-stream.ts` → `createMarkdownStream()` → 逐帧 `MarkdownBlock`/`BlockPatch` → `html.ts` 渲染。

## 数据与状态

- `Formatter` 只有内存态：`State<{formatters: Info[]}, Editor>`，`transform/reload` 可重放；`enabled` 的结果按 `Info` 对象身份缓存在 `WeakMap` 里（`false` 不缓存，所以"没装就每次再探一次"）。
- `Image` 只有内存态：`Limits{autoResize, maxWidth, maxHeight, maxBase64Bytes}`，默认 `true / 2000 / 2000 / 5 MiB`（`maxBase64Bytes = 5 * 1024 * 1024`）。
- photon worker 是**每进程一个**、请求串行（`Semaphore(1)`），空闲 `10s` 被 `terminate` 回收 wasm 堆；worker 死了下次请求重开。
- **三者都没有表**：配置与限制在启动/配置变更时从 config 重算，重启即恢复默认+配置值。唯一的持久化副产物是后台图片任务落盘的图片文件与 `job` 行（见 `core/background-jobs`）。
- latex/merman 的渲染缓存是面板内的 `Map<key, frame>`（`lastGood`），随渲染对象销毁在 `queueMicrotask` 里清理，不跨进程。

## 关键不变式

- **formatter 选择是"注册顺序 + 扩展名"，不是精确度**：`Formatter.file` 遍历 `state.get().formatters` 中 `extensions` 命中的项，第一个 `exitCode === 0` 的算成功；失败（非 0 或 spawn 报错）继续试下一个，全失败返回 `false`（文件保持原样，不报错）。
- **命令必须带 `$FILE` 占位**：`cmd = enabled.map(arg => arg.replace("$FILE", filepath))`，没有占位就等于对该文件无操作。
- **子进程 stdio 全忽略**：`stdin/stdout/stderr: "ignore"`，cwd 是 `Location.directory`、`extendEnv: true`；所以格式化器不能是交互式的，也不要指望它的输出进日志（只有失败时记 error）。
- **image 的 typed 降级是契约**：无 wasm 的运行时（workerd）必须先抛 `ResizerUnavailableError` 而不是在模块加载期炸（`PhotonNormalize.available = photonWasm !== ""`，`photon-wasm.workerd.ts` 导出空字符串）。调用方据此**保留原图**。
- **PNG 有直通白名单**：base64 ≤ 384 KiB 或 ≤ 256×256 像素、且尺寸本就合规时原样返回；透明像素抽样（最多 64×64 网格，alpha<250 的采样点占比 >5% 即视为透明）为真时不会转 JPEG。
- **重编码顺序**：先试 PNG，再按 `[80, 70, 55, 40]` 的 JPEG 质量降级；缩放尺寸按 0.75 递减最多 32 档；第一个满足 `maxBase64Bytes` 的编码胜出，全部失败才 `SizeError`（带 width/height/bytes/上限，供调用方提示用户）。
- **worker 失败会连坐**：一次失败或中断会 `terminate` 当前 worker（堆可能已被 wasm panic 污染），不在坏堆上服务后续请求；worker 不可用则永久降级到主线程并记一条 warning。
- **latex 解析失败必须回退而不是抛错**：`markdown.ts` 只吞 `LatexParseError` / `RangeError`，其它错误照抛；解析失败时若有"上一帧且当前文本以它开头"就复用上一帧（流式不闪）。
- **latex 输入有硬上限**：`DEFAULT_MAX_SOURCE_LENGTH = 100_000`、`DEFAULT_MAX_NESTING_DEPTH = 256`，还有 `maxExpand` 宏展开上限——这是为了不让 AI 生成的超长公式吃满终端进程。
- **merman 只支持 6 种图**：`flowchart / sequence / state / timeline / gitGraph / gantt`。`detectMermaidDiagram` 认不出就返回 `undefined`，调用方回落到普通代码块；`MermaidSyntaxError` 带 `lineNumber`，流式时优先复用上一帧，其次只渲染出错行之前的部分，`DiagramCanvasSizeError` 直接放弃渲染。
- **merman 的宽度上限**：`layoutMaxWidth` 默认 120，并被 `ctx.width` 夹住（`Math.min(configuredMaxWidth, ctx.width)`）；改这个值会影响所有横向图表的折叠行为。
- **patchmark 的唯一消费者是 session-ui**：它没有 register/plugin 机制，契约就是 `createMarkdownStream` 的帧序列；改 `StreamFrame`/`MarkdownBlock` 会同时打断 app 的流式渲染。

## 扩展点

- **加一个内置格式化器**：`formatter/builtins.ts` 里定义 `Info{name, extensions, enabled}` 并加进 `make()` 返回的数组（顺序即优先级）；需要 npm 依赖探测就用 `findUp("package.json") + hasDependency + npm.which`。
- **让某个扩展名走自定义命令**：只改 config `formatter.<name>.command/extensions/environment`（或 `disabled: true`），不用改代码。
- **改图像上限**：config `media.image.auto_resize / max_width / max_height / max_base64_bytes` → `ConfigImagePlugin`；默认值在 `image.ts` 的 `initial()`。
- **换/加图像后端**：`image.ts` 里 `import("./image/photon.js")` 的适配器契约是 `make: Effect<normalize>`；新后端要实现同样的 `PhotonNormalize.Result`（`Unchanged|Content|DecodeError|SizeError`）。
- **加一种 terminal 渲染的代码块语言**：新建包，导出 `Plugin.define({ id, setup })`，在 `setup` 里 `context.markdown.registerCodeBlockRenderer("<lang>", renderer)`（照 `packages/latex/src/plugin.ts`、`packages/merman/src/plugin.ts`）；渲染器要处理"流式半截输入"（参考两家的 `lastGood` 缓存）。
- **加一种 mermaid 图**：`detect.ts` 加识别 + `diagnostics.ts` 的 `MermaidDiagramKind` + 新目录 `<kind>/{parser,layout,drawing,render-grid,style,types}` + `markdown.ts` 的 `prepareDiagram` 分支。

## 常见改法与坑

- 在 `Formatter.file` 里加"找不到就装依赖"：它在每个写文件路径上跑（含 patch 的每个文件），装包会阻塞工具调用。
- 以为格式化失败会报错给模型：失败只 `logError` 并继续/返回 `false`，模型看到的是"写成功"。
- 给 formatter 传交互式参数（`-i`、watch 模式）：stdio 全忽略 + 子进程随调用结束，必然挂住或无效。
- 改 image 的降级链只改一边：`photon-normalize.ts` 的编码顺序、`PNG_PASSTHROUGH_MAX_BASE64_BYTES`、透明阈值三处耦合，改一个会让"本该直通的图"被重编码（视觉无损但体积/格式变了）。
- 在 workerd/无 wasm 环境里把 `ResizerUnavailableError` 当致命错误：正确行为是保留原图继续（`Tool.Service` 就是这么 catch 的）。
- latex 里抛非 `LatexParseError`/`RangeError`：会被 `markdown.ts` 重新抛出，等于一条坏公式让整个 TUI 渲染路径报错。
- merman 里放宽 `detectMermaidDiagram`：把普通代码块误判成 mermaid 会让它变成"不支持语法"的空块，比不渲染更糟。
- 改 `patchmark` 的 `heal`/`splitPendingMarker`：这两处决定流式时"哪些字符先不显示"，改错会让流式输出出现内容闪回或吞字；有 commonmark spec + micromark 差分 fuzz 兜底，改完跑 `packages/patchmark` 的测试。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/formatter.ts` | `Formatter.Service`：按扩展名选命令、`$FILE` 替换、跑子进程 |
| `packages/core/src/formatter/builtins.ts` | 内置格式化器清单与启用探测（npm 依赖 / `which`） |
| `packages/core/src/config/plugin/formatter.ts` | config `formatter` 合并（boolean 重置、对象按名合并、`disabled` 删除） |
| `packages/core/src/file-write.ts` | 写文件后的格式化落点（`commit`）与 `formatted` 快照 |
| `packages/core/src/image.ts` | `Image.Service`、`Limits` 默认值、typed 错误、适配器懒加载 |
| `packages/core/src/image/photon.ts` | worker 生命周期、串行化、主线程降级；`photon-wasm.*.ts` 是三平台 wasm 路径 |
| `packages/core/src/image/photon-normalize.ts` | 纯数据归一化：直通判定、透明检测、缩放/编码阶梯 |
| `packages/core/src/config/plugin/image.ts` | config `media.image` → `editor.configure` |
| `packages/latex/src/render.ts` | `renderLatex` = `parseLatex` + `layoutMath` |
| `packages/latex/src/markdown.ts` | TUI 代码块渲染器、`lastGood` 帧复用、宽字符占位 |
| `packages/merman/src/detect.ts` | 6 类图的识别入口 |
| `packages/merman/src/markdown.ts` | 选择 kind、`prepareDiagram`、`StaticDiagramRenderable` |
| `packages/patchmark/src/stream.ts` | `createMarkdownStream` / `PatchmarkStream` 增量帧 |
| `packages/patchmark/src/html.ts` | 块/inline → HTML（app 侧渲染） |
