---
id: gui/updater
title: 应用更新与 What's New
level: L2
layer: gui
status: stable
paths:
  - packages/gui-plugins/src/updater
symbols:
  - make
  - initUpdaterMachine
  - transitionUpdater
  - toUpdaterState
  - UpdateTarget
  - Platform
  - Dependencies
  - UpdaterMachineState
  - updaterAction
  - initWhatsNew
  - transitionWhatsNew
  - whatsNewLoading
  - WHATS_NEW_TIMEOUT_MS
  - ACTION_CHUNK_TIMEOUT_MS
  - initialWindowUpdater
  - transitionWindowUpdater
  - initialWebUpdate
  - transitionWebUpdate
  - webUpdateAction
  - webUpdatePending
  - AUTO_CHECK_SPACING_MS
  - CHECK_TIMEOUT_MS
  - startWebUpdater
  - decodeEmbeddedNotes
  - sliceBetaNotes
  - allBetaNotes
  - betaBuild
  - betaHistory
  - visualSource
  - logContext
tests:
  - packages/gui-plugins/src/updater/machine.test.ts
  - packages/gui-plugins/src/updater/whats-new-machine.test.ts
  - packages/gui-plugins/src/updater/web-machine.test.ts
  - packages/gui-plugins/src/updater/window-machine.test.ts
  - packages/gui-plugins/src/updater/beta-notes.test.ts
depends_on:
  - core/plugin-system
  - runtime/process-lifecycle
related:
  - gui/debug
  - gui/pairing
  - contracts/config-flag
keywords:
  - 更新
  - updater
  - 升级
  - electron-updater
  - What's New
  - 发行说明
  - release notes
  - beta
  - 安装
source_hash: eca6c8caeed4e07480c9d7083d385c7099c6d2dc
---

## 职责

两件与"版本"有关的事：

1. **应用更新**：desktop 用 `electron-updater` 检查/下载/安装并重启（`machine.ts` + `platform.ts`），web 用 `web-driver.ts` 的轮询提示。
2. **What's New**：更新后展示自上次版本以来的要点（`whats-new-machine.ts` + `whats-new.tsx`），beta 通道改展示嵌入的 beta 记录（`beta-notes.ts` + `beta-dialog.tsx`）。

- 主进程 `main.ts`：提供 `Updater` Ipc（`state` / `check` / `install` + `check` 事件）与 app 菜单项。
- window `renderer.tsx`：`TitlebarItem`、`SettingsPage(updates)`、隐藏的 `Command(check)`、What's New 的开合。

## 边界

做：
- 检查更新、下载（先 `--stage` 解包）、重启安装；把"待安装的版本"持久化，下次启动仍可提示。
- 在窗口内报告结果（beta）或弹原生对话框（其它通道）。
- What's New 的"已看过的版本/commit"记录与开合。

不做：
- 不实现更新分发：仓库地址、channel、签名都是 `electron-updater` 的配置。
- 不实现 web 的安装：web 只提示刷新/等待（`web-machine.ts` 的 `WebWorker`/`WebUpdateState`）。
- 不决定产品策略（何时强制更新）：`Updater` 的 state 是唯一输入，`updaterAction` 把状态映射成动作与文案。

## 入口与调用链

main：

```
updater/main.ts setup（async）
  const enabled = ctx.app.packaged
  platform = enabled ? await import("./platform").then(m => m.make(build.channel)) : undefined
  builtin.storage.store("ready", { from: { settings: "ready", file: "opencode.updater" } })
  make({ currentVersion, platform, restart: lifecycle.restart, persistence, changed })   // machine.ts
  ctx.provide(Updater, { state, check, install })
  ctx.add(MenubarItem, { menu: "app", id: "check", after: "about" })
```

window：

```
updater/renderer.tsx setup
  whatsNew(ctx); betaNotes(ctx)
  if (!ctx.desktop) return webUpdates(ctx)
  const updater = ctx.main(Updater); const state = () => updater.state()
  ctx.add(TitlebarItem, …)          // 只有 ready / download-required / installing 时出现
  ctx.add(SettingsPage, { id: "updates", page: "general" })   // entries: settings-release-notes, settings-check-updates
  ctx.add(Command, { id: "check", hidden: true })
  updater.on("check", () => act("check"))     // beta：菜单把检查转给聚焦窗口
```

- 动作：`act(name)` → `dispatchWindow(action.requested, available: state() !== undefined)` → `import("./actions")`（受 `ACTION_CHUNK_TIMEOUT_MS` 约束）→ `module.check(ctx, updater)` / `module.install(...)`。

## 数据与状态

- main store `ready`：`{ version } | null`，旧的整理文件 `opencode.updater` 的 `ready` 键通过 `from: { settings: "ready", file: "opencode.updater" }` 导入。
- window store `releaseNotes`（`{ enabled }`，默认 true），旧键 `settings.v3` 的 `general.releaseNotes`（`BuiltinStore.global` + `pick`）。
- window store `seen`（`{ version?, commit? }`），旧键 `highlights.v1`（`Store.global`）。
- 状态机：main `UpdaterMachineState`（`initUpdaterMachine`/`transitionUpdater`/`toUpdaterState`）、window `WindowUpdaterState`、web `WebUpdateState`、What's New `WhatsNewState`。
- 重启后：`ready` 让"已下载待安装"的版本仍在，titlebar 继续提示；What's New 靠 `seen` 决定是否再弹。

## 关键不变式

- **只检查不自动下载**：`platform.ts` 设 `autoDownload = false`；下载必须由 `install` 触发（用户明确动作）。
- **`platform.ts` 只能动态 import**：`electron-updater` 只在打包构建、且第一个窗口起来之后才加载。改回静态 import 会拖慢启动甚至在 web/dev 上炸。
- **安装失败必须可重试**：`lifecycle.restart` 期间 updater 保持 active；安装失败回到 `ready`，用户能再点一次（源码注释明确）。不要在失败时把状态清成 `idle`。
- **Windows 先解包再重启**：`unpackInstaller` 用安装包 `--stage` 把内容摊到安装目录旁，重启后只需移动一个目录；解包失败只记 warning，重启仍会安装（只是慢）。
- **ARM64 特判保留**：Windows 在 `app.runningUnderARM64Translation` 时只保留 `arm64` 的安装包，并关掉 differential download——否则会一直在 x64 上打补丁。
- **`allowDowngrade = true` / `channel = "latest"` / `allowPrerelease = false`** 是刻意组合：beta 用同一个 latest 通道 + 显式版本比较。
- **Ipc 消失就答"不能做"**：`act()` 的 `available` 参数让 main 缺失时也能回一句，而不是静默 return 或一直转圈。
- **`seen` 在 beta 上要记 commit**：没东西可显示时也要写 `commit`，否则下一次更新会重复列出旧条目。

## 扩展点

**新增一个更新通道行为**：`machine.ts` 的 `UpdaterMachineEvent`/效果 → `platform.ts` 的 `Platform` 接口 → `main.ts` 的 `make(...)` 依赖。

**新增一个窗口动作**（例如"稍后提醒"）：`window-machine.ts` 的事件 → `renderer.tsx` 的 `act` 分支 → `actions.tsx` 的实现（`actions.tsx` 是唯一允许调用 `updater.check/install` 的地方）。

**改 What's New 的来源**：`whats-new.tsx`（`loadWhatsNewHighlights`）+ `whats-new-machine.ts`（`WHATS_NEW_TIMEOUT_MS` 与失败分支）；beta 走 `beta-notes.ts` 的 `sliceBetaNotes`/`allBetaNotes`。

**新增设置项**：`SettingsPage` 的 `entries`/`render` + 本插件 store；`releaseNotes` 已经是一个例子。

## 常见改法与坑

- `updater/platform.ts` 的 `restartTimeout = 10_000`、`unpackTimeout = 120_000` 与 `ACTION_CHUNK_TIMEOUT_MS = 15_000`、`WHATS_NEW_TIMEOUT_MS = 15_000`、`CHECK_TIMEOUT_MS = 60_000`、`AUTO_CHECK_SPACING_MS = 60_000` 是不同层次的预算，别合并。
- beta 通道的"检查更新"走窗口内提示（`provider.emit("check", null, window.id)`），其它通道走 `dialog.showMessageBox`；改一侧容易只改到一半。
- `betaNotes` 只在 `import.meta.env.OPENCODE_BETA_NOTES` 存在时注册设置页；那是构建期常量，运行期改不了。
- What's New 加载期间用户关掉 `releaseNotes`，必须**不再打开**（`createKeyed(() => !releaseNotes.value.enabled, …)`），否则会弹一个用户已经关掉的对话框。
- `webUpdates` 与 desktop 是两条完全不同的驱动；在 `if (!ctx.desktop)` 之前加逻辑会让 web 也跑 desktop 路径。
- `logContext(ctx.log.write)` 让 Effect 日志进桌面日志；新加的 Effect 代码要用同一个 context，否则日志丢失。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `updater/index.ts` | `Plugin.define`：`releaseNotes`/`seen` 两个 store（含旧键迁移） |
| `updater/main.ts` | main 入口：`platform` 动态 import、`make(...)`、`ctx.provide(Updater)`、app 菜单项 |
| `updater/machine.ts` | 更新主状态机：`make`、`initUpdaterMachine`、`transitionUpdater`、`toUpdaterState` |
| `updater/platform.ts` | `electron-updater` 适配：检查、`--stage` 解包、`quitAndInstall`、ARM64 特判 |
| `updater/renderer.tsx` | window 入口：`TitlebarItem`、设置页、`check` 命令、What's New 开合 |
| `updater/action.ts` | `updaterAction`：state → 文案与动作的唯一映射 |
| `updater/actions.tsx` | 真正调用 `updater.check`/`updater.install` 的 chunk |
| `updater/window-machine.ts` | window 动作状态机与 chunk 预算 |
| `updater/section.tsx` | 设置页主体（检查/安装按钮与状态） |
| `updater/web.tsx`、`web-machine.ts`、`web-driver.ts` | web 通道的提示与轮询 |
| `updater/whats-new.tsx`、`whats-new-machine.ts` | What's New 的加载、超时与对话框 |
| `updater/beta-notes.ts`、`beta-dialog.tsx`、`beta-page.tsx` | beta 记录（切片、渲染、设置页） |
| `updater/log.ts` | `logContext`：Effect 日志桥到桌面日志 |
| `updater/window-machine.test.ts` | 动作竞态（rejection 先于事件）的回归 |
| `updater/platform.ts` | 平台差异集中处：Win/macOS 的下载与安装路径 |
