# cogagent 开发内容技术文档（自 opencode 基线起）

> 范围：**只写我们从上游 opencode 分叉后自己开发/改造的部分**，不含上游既有实现。
> 上游骨架说明见 [architecture.md](architecture.md)（那只是参考，不是本次开发内容）。
> HUD 细节见 [design/hud-implementation.md](design/hud-implementation.md)。

---

## 0. 基线与规模

| 项 | 值 |
|---|---|
| 基线提交 | `6a89e9f2`（2026-11-07，与 `upstream/dev` 同一提交） |
| 开发区间 | 2026-11-07 → 2026-11-26 |
| 提交数 | **157** |
| 分支 / 远端 | `dev` → `origin`（`Joinfly0403/diy-opencode`） |

按 scope 分布（`git log 6a89e9f2..dev`）：

| scope | 提交数 | 说明 |
|---|---|---|
| `hud` | 87 | OSSDesign 悬浮助手 + 接口录制/回放（最大增量） |
| `tui` | 27 | 中文化、布局、重绘、wordmark |
| `cac` | 20 | 登录包装、安装器、本地模式、运行环境适配 |
| `linux` | 4 | 收敛为 Linux 终端形态（删除 GUI/发布面） |
| `brand` | 2 | 品牌与运行时目录改名 |
| `core` | 2 | 权限 bypass、测试清理 |
| `cli` | 2 | 单文件构建、测试跟随 |
| `provider` | 1 | 移除免费模型通道 |
| `knowledge` / `kb` | 3 | 模块检索卡、OSSDesign 知识库方案 |
| `design` / `ops` / `docs` | 9 | 设计稿、ccloud 调查、文档 |

---

## 1. 形态收敛：Linux-only 终端产品

这是**行数层面最大**的改动：把 fork 从“GUI + 服务 + 发布面”的多形态仓库，收敛成 Linux 终端 agent。

| 提交 | 内容 | 规模 |
|---|---|---|
| `4b5458bebd` | `chore(linux): drop GUI, marketing, and publishing surface` | **7644 文件，+134 / −1,112,178** |
| `1e047148ea` | `chore(linux): drop workerd runtime and the ACP bridge` | 83 文件，−9,641 |
| `465131aabf` | `chore(linux): remove self-update and the Windows-only surface` | 34 文件，−3,041 |
| `aec13b2f8f` | 修复删除后的 manifests 与 start-call arity | — |

### 1.1 删除的包（12 个）

```
app  desktop  gui-plugins  plugin-browser  plugins  script
session-ui  simulation  stats  stories  ui  web
```

### 1.2 删除的顶层目录

```
services/  sdks/  nix/  infra/  install/  （以及 sst.config.ts / sst-env.d.ts）
```

### 1.3 剩余形态

`packages/` 只保留终端与服务相关 22 个包：

```
ai  cli  client  codemode  core  effect-drizzle-sqlite  function
http-recorder  httpapi-codegen  identity  latex  merman  patchmark
plugin  process-daemon  protocol  schema  sdk  server  theme  tui  util
```

配套：`59d31482d1 feat(cli): add a linux-only single-file build script`（单文件产物构建）。

---

## 2. 品牌：opencode → cogagent

| 提交 | 内容 |
|---|---|
| `3e714621d2` | 运行时目录/数据库/配置改名（`cogagent`、`cogagent.db`、`cogagent.json(c)`）；新增环境变量读取器 |
| `ffda5aba8f` | 配置发现优先 `cogagent.json(c)`，兼容旧名 |
| `211eb81262` / `a19ac04a37` / `bc361b7858` | TUI 的 `cog|agent` 像素字标（5×7、ANSI 阴影） |
| `1f43d834e5` | 标题与续接提示显示 cogagent 名称 |

环境变量策略（`packages/util/src/env.ts`）：

```ts
// 优先 COGAGENT_<name>，回落到 OPENCODE_<name>（仅告警一次，后续版本删除回落）
export function read(name) { ... }
```

运行时目录（`packages/util/src/global.ts`）：`const app = "cogagent"`。

---

## 3. CAC 登录、安装与运行环境

围绕“内网 CAC（华为 CodeAgentCLI）登录 + 无 TTY 部署”做的一整套改造，共 20 个提交：

| 能力 | 提交 | 要点 |
|---|---|---|
| 登录包装器 | `0e0aad88b7` | `script/cac/cogagent`：拉起登录、捕获 SSO 链接、拿到账号 |
| 沙箱与 mock 测试台 | `0e0aad88b7` | 登录流程可在无域环境下演练 |
| provider 原生注册 | `0f7dec1483` | 用 native plugin 注册 CAC provider |
| 每账号独立服务端口 | `be0fc05f2b` | 多账号并存不抢端口；运行编译后的二进制 |
| 单文件自解压安装器 | `442079fef6` / `cf57a71d23` | 安装器内嵌 launcher |
| 全量替换式安装 | `00e00359c2` | 覆盖安装不留旧文件 |
| 默认 `--standalone` | `c940ddbd4c` | TUI 直接以独立模式启动 |
| 本地模式 | `78fccd72ca` | `script/cac/cogagent-local`：**无需域登录**，走第三方 API |
| 单实例按账号隔离 | `4b54319390` | 单实例检查不再跨账号 |
| root 兜底 | `1a0d20ce6a` | ossadm 不存在时回落 root |
| 中文默认 | `f98e838546` | 接口默认中文 |
| TERM 兜底 | `8d7747caed` | 诊断用 sandbox bypass + TERM 兜底 |
| 可执行临时目录 | `fe493ed843` | 给 TUI 一个可 exec 的 TMPDIR |
| 沙箱并入 wrapper | `156ee0c777` | `refactor(cac)` |
| 部署目录规范 | `9c35e491e8` | 统一 drop 目录 |
| 安装/自检/卸载文档 | `ef1737ba7a` | 随包交付 |
| 忽略 pyc | `3edfe2aa77` | — |
| 跳过实例提示 | `0e5120cbad` → **`01379aa3e1` 回滚** | `COGAGENT_ASSUME_YES` 方案被撤销 |

产物形态：`script/cac/{cogagent,cogagent-local,install.sh,...}`，默认安装到固定目录，TUI 为唯一界面。

---

## 4. 权限：全放行开关

`73c61676e6 feat(core): allow every tool without prompting with COGAGENT_BYPASS_PERMISSIONS`

- 改动：`packages/core/src/permission.ts`（+9 行）、`packages/core/test/permission.test.ts`（+19 行）。
- 语义：设置 `COGAGENT_BYPASS_PERMISSIONS` 后所有工具免询问；未设置时保持原行为。

---

## 5. TUI：中文化 + 布局 + 重绘（27 个提交）

### 5.1 中文化（11 个提交）

覆盖顺序：内置命令与快捷键 → 命令面板描述 → 斜杠补全 → 对话框标题/行/动作 → toast/权限/空态 → 设置页与快捷键词汇 → schedule 描述 → 侧边栏用量标签。

关键提交：`8f984a56b4`、`44e3d3d36e`、`13c40add63`、`eff5639023`、`8ef1032810`、`45fa63e773`、`726256a2df`、`db49805a7b`、`f65666b730`、`64dd453c27`、`4f56f66cd2`。

机制：`packages/tui/src/i18n.ts` 的 `t()` / `L()`，默认中文、英文兜底。

### 5.2 布局与交互

| 提交 | 内容 |
|---|---|
| `4bd459ab2d` | 侧边栏宽度可拖拽（带回归测试） |
| `bdc3a0ce3d` | 竖排标签宽度固定 42，拖拽不抖动 |
| `ef2139e9af` | 默认显示会话滚动条 |
| `fb3596bfea` → `bb051b14c0` | 滚轮路由到会话区（后回滚） |

### 5.3 重绘与尺寸

| 提交 | 内容 |
|---|---|
| `7626ade4ad` | 轮询终端尺寸（有些宿主不发 resize 事件） |
| `b8488662ae` | 运行时不上报时用 ioctl 读尺寸 |
| `0b344410b1` | 尺寸变化强制全量重绘 |
| `87d5beb50d` | `Ctrl+L` 全量重绘 |
| `71f7fadf34` | 确认修复后移除诊断日志 |

### 5.4 测试跟进

`22cb581d5b`（字标/引导文案）、`e018cb926f`（shell 输出渲染超时）、`59d31482d1` CLI 测试跟随目录改名。

---

## 6. Provider：移除免费模型通道

`84ca7c7426 feat(provider): remove the free-model channel` —— 去掉内置免费模型入口，模型列表只保留登录/配置得到的 provider。

---

## 7. HUD：OSSDesign 悬浮助手 + 接口录制/回放（87 个提交）

本仓库最大的一块自有开发，落在 `script/hud/`：

| 层 | 文件 | 职责 |
|---|---|---|
| 页面端 | `common/hud.js` | Shadow DOM 面板；录制器（hook fetch/XHR）；执行器 `execMacro` |
| 桥 | `common/hud_proxy.py` | OSSDesign 内 Tornado 路由 `/designer/hud/*`，注入 `X-Hud-Web-User` |
| 服务 | `common/broker.py` | 127.0.0.1:18765；宏 CRUD、运行队列、结果回传、AI 对话 |
| 存储 | `common/macro_store.py` | `macros/`、`runs/*.jsonl`、`runs/*.api.jsonl`、`pins.json` |
| 安装 | `common/install-all.sh`、`deploy.sh`、`recover.sh`、systemd unit | 一键安装/恢复 |
| 发布 | `downloads/cogagent-hud-bundle.tgz` | 每次提交更新，GitHub Release 同步 |

能力演进（按提交簇）：

1. **面板与交互**：悬浮球、拖拽 8 向缩放、双击复位、侧边栏折叠（7px 分隔条）、图标菜单、状态栏与停止按钮、toast 层级。
2. **接口录制**：hook fetch/XHR → `api` 步骤；按响应生成 `{{sN.path}}`；自动插 `lookup`、`assertList`、`assertField`；跳过纯展示查询与 HUD 自身轮询。
3. **回放正确性**：`retMsg` 判定（OK/NA/ERROR）、时间戳冻结、数组下标路径、数字 id 替换、短 id 关联、已有站点 `target_site_id`、占位符未解析快速失败。
4. **稳定性**：运行记录按 owner 归属、僵死运行 20s 释放、忙等 30×2s + 只清陈旧任务、错误带 `req=`。
5. **可观察性**：`runs/*.jsonl`（每轮）与 `*.api.jsonl`（每次调用）分层记录，步级截断不影响接口原文。

细节：[design/hud-implementation.md](design/hud-implementation.md)。

---

## 8. 知识库与文档

| 提交 | 内容 |
|---|---|
| `c581caddc1` | 模块检索卡与卡片生成工具（`script/knowledge/build.ts`） |
| `de8847f6a4` | 卡片补全，**42 张卡覆盖 1684/1684 源文件** |
| `5d4de99aa0` / `c40dce4fe6` / `6eb8733e63` | HUD 动作工具栏设计稿（含“UI 优先、接口兜底”策略切换） |
| `8948f297b5` | OSSDesign 知识库方案 v1.1 |
| `8073270ddc` | ccloud-hud cron 调查与整改方案 |
| `59897f96d0` / `3d86de8633` | 全仓架构说明、HUD 实现文档、文档地图 |

---

## 9. 工程约定（本次一并确立）

| 项 | 内容 |
|---|---|
| 仓库定位 | AGENTS.md 明确“当前项目是 cogagent，Linux-only 终端 coding agent，派生自 opencode 但不再跟随上游” |
| 回复语言 | 默认中文；只有代码/命令/日志保持原样 |
| 提交规范 | conventional commits（`feat/fix/docs/chore/refactor/test` + scope） |
| 分支命名 | 最多三个词、连字符分隔，不用 `feat/` 前缀 |
| 换行 | `086e03e0da chore: force LF endings for the deployment scripts` |
| 发布 | 不使用 Changesets；产物走 GitHub Release |

---

## 10. 未采用 / 已回滚

| 提交 | 结果 |
|---|---|
| `0e5120cbad` `COGAGENT_ASSUME_YES` | 被 `01379aa3e1` 回滚 |
| `fb3596bfea` 滚轮路由两栏 | 被 `bb051b14c0` 回滚 |
| `cdp-browser-control.md`（CDP 跨标签方案） | 仅草稿，未实现 |
| 文档中提到的 AI 自学习工具（`hud_probe` 等） | 未实现 |

---

## 11. 与上游的关系（结论）

- 内核（`core` / `server` / `protocol` / `schema` / `sdk`）**基本沿用上游**：本次只动了权限 bypass 与测试清理。
- 我们的开发集中在外围：**形态收敛（删 GUI）、品牌改名、CAC 登录与安装、TUI 体验、HUD**。
- 上游不再合并；`upstream/dev` 仅作对照基线。

---

## 12. 关键提交索引

| 主题 | 提交 |
|---|---|
| 删除 GUI/发布面 | `4b5458bebd` |
| 删除 workerd/ACP | `1e047148ea` |
| 删除自更新/Windows 面 | `465131aabf` |
| Linux 单文件构建 | `59d31482d1` |
| 品牌改名 | `3e714621d2`、`ffda5aba8f` |
| CAC 登录包装 | `0e0aad88b7` |
| 本地模式 | `78fccd72ca` |
| 自解压安装器 | `442079fef6` |
| 权限 bypass | `73c61676e6` |
| 免费模型通道移除 | `84ca7c7426` |
| TUI 中文化（起点） | `4f56f66cd2` |
| TUI 重绘修复 | `7626ade4ad`、`b8488662ae`、`0b344410b1` |
| HUD 首个版本 | `ce3aa8ac4c` |
| 知识库卡片 | `c581caddc1`、`de8847f6a4` |
