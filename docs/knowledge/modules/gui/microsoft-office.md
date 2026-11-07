---
id: gui/microsoft-office
title: Office 文档预览（Word/Excel/PowerPoint）
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/microsoft-office
symbols:
  - wordFonts
  - presentationFace
  - scriptFace
  - loadFace
  - CJK_FONT_ASSET_URLS
  - externalUrl
  - wordLink
  - createOfficeWorker
  - WorkerClient
  - OfficeOpened
  - paper
  - maxImageSide
  - lineHeight
  - layerFont
  - headerHeight
  - transitionOfficePages
  - pagesList
  - pagesScale
  - pagesZoom
  - pageFit
  - columnName
  - parseRange
  - anchorRange
  - coverMerges
  - parseSpans
  - contains
  - drawFrame
  - paintFrame
  - paintCells
  - paintHeaders
  - shiftGrid
  - transitionSheetFrame
  - transitionSheetPick
  - transitionSheetPointer
  - transitionSlideFonts
  - selectDeckFontRequests
  - transitionSlidePaint
  - transitionVectorRaster
  - createWordLayoutState
  - transitionWordLayout
  - wordLayoutPages
  - transitionWordPaint
  - pageText
  - deckText
  - withoutMedia
  - createBitmapImageResolver
  - transitionWorker
  - workerLoading
  - createWorkerClient
  - serveWorker
  - movableBuffer
  - SupersededError
  - WorkerClosedError
  - AbortedError
  - transitionWorkerRpcClient
  - transitionWorkerRpcServer
tests:
  - packages/gui-plugins/src/microsoft-office/worker-rpc.test.ts
  - packages/gui-plugins/src/microsoft-office/worker-rpc-machine.test.ts
  - packages/gui-plugins/src/microsoft-office/pages-machine.test.ts
  - packages/gui-plugins/src/microsoft-office/sheet-cells.test.ts
  - packages/gui-plugins/src/microsoft-office/sheet-frame-machine.test.ts
  - packages/gui-plugins/src/microsoft-office/slide-text.test.ts
  - packages/gui-plugins/src/microsoft-office/word-layout-machine.test.ts
depends_on:
  - core/plugin-system
related:
  - gui/file
  - gui/review
keywords:
  - Office
  - Word
  - Excel
  - PowerPoint
  - docx
  - xlsx
  - pptx
  - worker
  - wasm
  - 预览
  - 字体
source_hash: 6d790a5d186dcd0d7055b914dd24ffe5d42f55b4
---

## 职责

在文件面板里只读预览三种 Office Open XML 文档：Word（`.docx`）、Excel（`.xlsx`）、PowerPoint（`.pptx`）。

- 注册：`renderer.tsx` 用 `ctx.add(FileViewer, { kinds, problem, View })` 注册三个查看器（`@opencode/plugin/gui/file` 的契约），View 是 `lazy()`。
- 引擎：每个打开的文件一个 Web Worker（`*.worker.ts`），通过 `worker-rpc.ts` 的带类型 RPC 通信；解析与布局在 worker 里，绘制在主线程 canvas。
- 排版与绘制：`pages-machine.ts`（分页）、`word-*`、`sheet-*`、`slide-*` 三套各自的协议机。

## 边界

做：
- 三种格式的只读渲染：Word 的分页文本、Excel 的网格（虚拟滚动 + 选择 + 冻结窗格）、PPT 的幻灯片（含矢量图与字体回退）。
- 在下载引擎之前用文件头签名拒绝打不开的文件。
- 自带字体：Word 与 PPT 各自把需要的 face 注册进 `FontFaceSet`。

不做：
- 不编辑、不保存、不导出：全部只读。
- 不做格式转换（不把 docx 转 HTML 再交给 Markdown 渲染）。
- 不处理加密文档与旧二进制格式（`.doc`/`.xls`/`.ppt`）：`compound` 签名直接给出 `problem.compound`。
- 不预加载引擎：`renderer.tsx` 注释——"Nothing preloads: most sessions never open an Office file"。

## 入口与调用链

```
src/renderer.ts → microsoft-office/renderer.tsx setup
  viewer("document",     lazy(() => import("./document")))
  viewer("spreadsheet",  lazy(() => import("./spreadsheet")))
  viewer("presentation", lazy(() => import("./presentation")))
     ctx.add(FileViewer, { kinds: [kind], problem(bytes), View: bindPlugin(props => <Suspense><View …/></Suspense>) })
```

- 打开：`gui/file` 的 artifact 面板按 `artifactKind(path)` 找注册的 viewer → `problem(bytes)` 先判签名 → `View` 挂载 → 组件里 `createOfficeWorker` 起 worker。
- worker 握手：`worker-machine.ts` 的 `transitionWorker`（`WORKER_OPEN_TIMEOUT_MS = 60_000`）→ `worker-rpc.ts` 的 `createWorkerClient` / `serveWorker` → 方法集来自 `word-protocol.ts` / `sheet-protocol.ts` / `slide-protocol.ts` 的 `*Methods`。
- 绘制：worker 返回 display list / 帧数据 → `sheet-frame.ts` 的 `drawFrame`/`paintFrame`、`sheet-paint.ts` 的 `paintCells`/`paintHeaders`、`word-text.ts` 的 `pageText` 等在主线程画。

## 数据与状态

- **没有 store**：`index.ts` 只有 `i18n: { en }`（注意是普通对象，不是 `builtinCatalog`——本插件目前只有英文）。
- 状态都在组件内的状态机里，按文件实例存活：`WorkerState`、`OfficePagesState`、`SheetFrameState`、`SheetPickState`、`SheetPointerState`、`SlidePaintState`、`SlideFontsState`、`WordLayoutState`、`WordPaintState`、`WorkerRpcClientState`/`WorkerRpcServerState`。
- worker 侧状态在 worker 自己内存里；主线程只持有 `ImageBitmap` 与 display list。`Transfer`/`movableBuffer` 让 buffer 移动而非复制。
- 重启后无需恢复：没有持久化。

## 关键不变式

- **签名先行**：`zip = [0x50,0x4b,0x03,0x04]` 表示 OOXML，可以交给引擎；否则若是 `compound`（`D0 CF 11 E0 A1 B1 1A E1`）报 `problem.compound`，其它报 `problem.format`。这条检查必须在**下载引擎之前**，否则用户为打不开的文件等几 MB wasm。
- **每个格式一个 worker**：引擎跑在 worker 里，主线程只绘制。禁则在渲染层直接调引擎会把窗口卡住（`worker-rpc.ts` 头部注释）。
- **RPC 的错误分类要分清**：`SupersededError`（同 key 的新调用顶掉了它）、`WorkerClosedError`（worker 死了/关了）、`AbortedError`（调用方自己取消，是 `WorkerClosedError` 的子类——检查顺序必须先判它）。
- **`movableBuffer` 会清空入参**：把整段 buffer 移动给 worker 后，调用方的 `Uint8Array` 就空了。共享同一份字节的调用方必须自己复制。
- **字体自带、不写死字体族**：`fonts.ts` 提供 `wordFonts`/`presentationFace`/`scriptFace`，PPT 还有字体回退机（`slide-fonts-machine.ts`，`MAX_SLIDE_LAYOUT_PASSES = 8`、`SLIDE_FONT_LOAD_TIMEOUT_MS`）。这是 AGENTS.md "Never bundle font files or write literal families" 的唯一例外（文档自带字体）。
- **分片有预算**：`PAGES_SLICE_BUDGET_MS = 12`、`WORD_STEP_BUDGET_MS = 24`、`SHEET_SETTLE_DELAY_MS = 150`、`PAGES_SETTLE_DELAY_MS = 150`——排版不能一次做完，必须分片让出主线程。
- **超时不可省**：`PAGES_*`/`SHEET_FRAME_TIMEOUT_MS = 30_000`/`SLIDE_PAINT_TIMEOUT_MS = 30_000`/`WORD_PAINT_TIMEOUT_MS = 30_000`/`SHEET_SHOW_TIMEOUT_MS = 30_000`；缺一个就会有"永远转圈的页面"。

## 扩展点

**新增一种格式**（例如 `.odt`）：`renderer.tsx` 里再 `viewer(kind, lazy(...))` → 新的 `*-protocol.ts` 的 `Methods` + `.worker.ts` 的 `serveWorker` → 主线程的绘制与状态机。`problem(bytes)` 要给出新的签名判定。

**新增一个 worker 方法**：`<format>-protocol.ts` 的 `*Methods` 加条目 → `.worker.ts` 的 handler → 主线程状态机的事件/效果 → 调用点（`createWorkerClient` 是带类型的，签名不一致会编译失败）。

**改绘制**：sheet 走 `sheet-frame.ts`/`sheet-paint.ts`，word 走 `word-text.ts`，slide 走 `slide-paint-machine.ts`；不要在主线程重新实现引擎已经算好的布局。

**调字体**：`fonts.ts` 的 `wordFonts`/`presentationFace` + `slide-fonts-machine.ts` 的回退逻辑 + `fonts.test.ts`。CJK 由 `fonts-cjk.ts` 的 `CJK_FONT_ASSET_URLS` 提供（构建期注入）。

## 常见改法与坑

- **三套协议不要互相抄**：`word-protocol.ts` 有 `lineHeight = 1.2` 与 `layerFont = "sans-serif"`（用于测量层），`slide-protocol.ts` 有 `maxImageSide = 2560`（位图上限），`sheet-protocol.ts` 是网格。改一个别把另一个的常量带过去。
- `sheet-cells.ts` 的 `lastCell = { row: 1048575, col: 16383 }` 是 Excel 的硬上限；`parseRange`/`anchorRange`/`coverMerges` 处理 A1 记法与合并单元格，自己解析会错。
- `paintHeaders` 的 `headerHeight = 20` 与 `sheet-paint.ts` 的命中测试耦合；改行高要同时改 `sheet-pointer-machine.ts`。
- `slide-text.ts` 的 `deckText`/`withoutMedia` 会从 deck 里剥掉媒体再算文本；`word-images.ts` 的 `createBitmapImageResolver` 用 `YrsMediaSource` 取图——两者的生命周期不同，别混用。
- `pageFit`/`pagesScale`/`pagesRasterScale` 是三个不同的缩放（布局 vs 位图清晰度）；高分屏下发虚通常是 `pagesRasterScale` 没用上 `devicePixelRatio`。
- worker 崩溃由 `createWorkerClient` 的 `onCrash` 上报，状态机走 `transitionWorker` 的失败分支；不要吞掉崩溃继续等待。
- 本插件只有英文文案（`i18n: { en }`），加语言时改成 `builtinCatalog` 并把其它 locale 懒加载。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `microsoft-office/index.ts` | `Plugin.define`：只有 `i18n: { en }`（无 store、无 `builtinCatalog`） |
| `microsoft-office/renderer.tsx` | 注册三个 `FileViewer`，签名判定 `problem` |
| `microsoft-office/worker-rpc.ts` | 带类型的 worker RPC（`createWorkerClient`/`serveWorker`/`Transfer`/三类错误） |
| `microsoft-office/worker-rpc-machine.ts` | RPC 两端的状态机（取消、排队、崩溃） |
| `microsoft-office/worker-machine.ts` | worker 打开的生命周期（`WORKER_OPEN_TIMEOUT_MS`） |
| `microsoft-office/document.tsx`、`word-*` | Word：布局机、绘制机、文本测量、图片 |
| `microsoft-office/spreadsheet.tsx`、`sheet-*` | Excel：网格绘制、帧状态机、选择/指针、A1 记法 |
| `microsoft-office/presentation.tsx`、`slide-*` | PowerPoint：幻灯片绘制、字体回退、矢量位图 |
| `microsoft-office/pages-machine.ts` | 通用分页（切片预算、缩放范围 0.25–2） |
| `microsoft-office/fonts.ts` | `wordFonts`/`presentationFace`/`scriptFace`/`loadFace` |
| `microsoft-office/fonts-cjk.ts` | `CJK_FONT_ASSET_URLS`（构建期注入的 CJK 字体） |
| `microsoft-office/links.ts` | `wordLink`/`externalUrl`：文档内与外部链接 |
| `microsoft-office/office-worker.ts` | 通用 worker 装配（`createOfficeWorker`） |
| `microsoft-office/paper.ts` | `paper = "#ffffff"`：页面底色常量 |
