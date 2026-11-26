# cogagent + cogagent-hud-bundle 技术手册

> 本文自包含：不依赖其它文档即可读懂已实现的两部分——**cogagent 产品本体**与 **cogagent-hud-bundle**。
> 只写**已实现、已变更**的内容；不写规划项。

---

# 第一部分：cogagent

## 1. 基线与开发规模

| 项 | 值 |
|---|---|
| 上游基线 | `6a89e9f2`（2026-11-07，与 `upstream/dev` 同一提交） |
| 开发区间 | 2026-11-07 → 2026-11-26，共 **157 个提交** |
| 分支/远端 | `dev` → `origin`（`Joinfly0403/diy-opencode`） |
| 提交规范 | conventional commits（`feat/fix/docs/chore/refactor/test` + scope） |

改动分布：`hud` 87、`tui` 27、`cac` 20、`linux` 4、`brand` 2、`core` 2、`cli` 2、其余文档/知识库。
内核（`core`/`server`/`protocol`/`schema`/`sdk`）基本沿用上游，开发集中在外围。

---

## 2. 形态收敛：Linux-only 终端产品

| 变更 | 规模 |
|---|---|
| 删除 GUI / marketing / publishing 面 | 7644 文件，+134 / **−1,112,178 行** |
| 删除 workerd runtime 与 ACP bridge | 83 文件，−9,641 |
| 删除自更新与 Windows-only 面 | 34 文件，−3,041 |
| 修复删除后的 manifests 与 start-call arity | — |

删除的包（12）：

```
app  desktop  gui-plugins  plugin-browser  plugins  script
session-ui  simulation  stats  stories  ui  web
```

删除的顶层目录：`services/`、`sdks/`、`nix/`、`infra/`、`install/`（以及 `sst.config.ts`、`sst-env.d.ts`）。

保留的 22 个包：

```
ai  cli  client  codemode  core  effect-drizzle-sqlite  function
http-recorder  httpapi-codegen  identity  latex  merman  patchmark
plugin  process-daemon  protocol  schema  sdk  server  theme  tui  util
```

单文件 Linux 产物构建：`packages/cli/script/build-linux.ts`。

---

## 3. 品牌：opencode → cogagent

| 项 | 实现 |
|---|---|
| 运行时目录 | `cogagent`（`packages/util/src/global.ts`：`const app = "cogagent"`） |
| 数据库 | `cogagent.db` |
| 配置 | `cogagent.json` / `cogagent.jsonc`，配置发现优先新名 |
| 环境变量 | `packages/util/src/env.ts` 的 `Env.read()`：优先 `COGAGENT_<NAME>`，缺失时回落 `OPENCODE_<NAME>` 并打印一次弃用告警 |
| TUI 字标 | `cog|agent` 像素字标（5×7 点阵、ANSI 阴影），标题与续接提示显示新名 |

回落分支是**兼容期实现**，当前代码即按此行为运行。

---

## 4. CAC 登录、安装与运行环境

### 4.1 交付脚本（`script/cac/`）

| 文件 | 作用 |
|---|---|
| `cogagent` | 登录包装器：拉起 CAC/SSO、捕获登录链接与账号、再启动 TUI |
| `cogagent-local` | 本地模式启动器（无需域账号） |
| `install.sh` | 全量安装（由自解压包调用，也可手动执行） |
| `uninstall.sh` / `selfcheck.sh` | 卸载与自检 |
| `mock-server.py` | 无域环境下的登录流程演练 |
| `DEPLOY.md` / `README.md` | 部署与使用说明 |

### 4.2 安装行为（`install.sh`）

- 必须 root 运行；先清空旧内容再按包内文件重建（**全量替换**）。
- 安装根目录 `/srv/cogagent`，按用户分目录 `users/`；服务账号优先 `ossadm`，**系统中没有 ossadm 时回落 root**。
- 安装包组成：`cogagent-linux-*` 二进制 + `cogagent` 包装层 + `cac.json`。
- 自解压安装包内嵌 launcher，单文件分发。

### 4.3 运行特性

| 特性 | 实现 |
|---|---|
| 单实例 | 按**账号**判定，不再跨账号互斥 |
| 服务端口 | **每个账号独立端口** |
| 启动方式 | TUI 默认 `--standalone` |
| 语言 | 默认中文（`COGAGENT_LANG=zh_CN`） |
| 终端 | TERM 缺失时兜底；提供可 exec 的 `TMPDIR` |
| 本地模式 | `cogagent-local`：`COGAGENT_MODE=local`，数据落 `~/.cogagent/{config,data,state,cache,tmp}`，权限 700；用第三方 key（`DEEPSEEK_API_KEY` 等）或 `config/opencode/opencode.jsonc` |

---

## 5. 权限：全放行开关

`packages/core/src/permission.ts`：

```ts
export function bypassPermissions(): boolean {
  return process.env.COGAGENT_BYPASS_PERMISSIONS === "1"
      || process.env.OPENCODE_BYPASS_PERMISSIONS === "1"
}
```

- 命中时所有工具直接 `allow`，不弹询问。
- 仅用于可信环境/无人值守；未设置时保持原权限流程。
- 有对应单测 `packages/core/test/permission.test.ts`。

---

## 6. TUI：中文化与交互修复

### 6.1 国际化机制

`packages/tui/src/i18n.ts` 提供 `t()` / `L()`，默认中文、英文兜底；所有用户可见文案走这两个函数。

已中文化范围（按提交顺序）：

| 范围 | 内容 |
|---|---|
| 命令与快捷键 | 内置命令标题、快捷键标签 |
| 命令面板 | 每条描述（在渲染处翻译）、内联提示 |
| 斜杠补全 | 补全项描述 |
| 对话框 | 标题、行、通用动作 |
| 反馈 | toast、权限提示、空态文案 |
| 设置页 | 设置项与快捷键词汇 |
| 其它 | schedule 命令描述、侧边栏用量标签 |

### 6.2 布局与滚动

| 项 | 实现 |
|---|---|
| 侧边栏宽度 | 可拖拽调整；竖排标签宽度固定 42，拖拽不抖动 |
| 会话滚动条 | 默认显示 |
| 滚轮 | 曾改为路由到会话区，**已回滚**（保留原行为） |

### 6.3 重绘与尺寸

| 场景 | 实现 |
|---|---|
| 宿主不上报 resize | 轮询终端尺寸 |
| 运行时不上报尺寸 | 用 ioctl 读取 |
| 尺寸变化 | 强制全量重绘 |
| 手动重绘 | `Ctrl+L` 全量重绘 |

---

## 7. Provider：移除免费模型通道

`84ca7c7426`：删除内置免费模型通道，模型列表只来自登录/配置得到的 provider。

---

## 8. 构建、校验与约定

| 项 | 命令/位置 |
|---|---|
| 运行时/包管理 | `bun@1.4.4` |
| 构建编排 | `turbo` |
| Lint | `bun run lint`（oxlint）、`bun run lint:changed` |
| 规则测试 | `bun run test:lint-rules`、`test:effect-simplification-rules` |
| 类型检查 | 在包目录 `bun typecheck`；**不要直接 `tsc`** |
| 客户端生成 | 改 `HttpApi` 后在 `packages/client` 跑 `bun run generate`，不手改生成物 |
| 知识库 | `bun run knowledge` / `knowledge:bless`（42 张卡，覆盖 1684/1684 源文件） |
| 测试 | 不能在仓库根跑（根脚本直接 `exit 1`），按包目录跑 |
| 换行 | 部署脚本强制 LF |

---


---

# 第二部分：cogagent-hud-bundle

## 9. 设计目标与约束

### 9.1 目标

1. **零侵入**：不改 OSSDesign 业务代码，只靠 `app_main.js` 末尾一行 bootstrap 注入前端脚本 + 一个 Tornado handler 模块。
2. **可回放**：把“反复点的一串操作”沉淀成 JSON 宏，点一下重放；优先走 REST（接口层），UI 动作作为补充。
3. **确定性**：宏执行不经过 AI、不读截图，步骤与输入完全由 JSON 决定。
4. **多用户隔离**：每个网页登录账户只能看到/执行自己的宏与运行记录。
5. **可观察**：每轮执行、每次接口调用都有落盘记录，失败能定位到步与请求体。
6. **可恢复**：OSSDesign 重装后能一条命令恢复桥与前端。

### 9.2 约束（决定了架构）

| 约束 | 后果 |
|---|---|
| 页面与后端同源，跨进程无法直接带会话 | 必须有**同源桥**（`hud_proxy.py`）转发到本机 broker |
| 桥跑在 OSSDesign 的 Tornado 进程里 | 只能加 handler，不能阻塞事件循环 → 桥用 `AsyncHTTPClient` + coroutine |
| 前端文件属主是 `ossadm` | 安装脚本必须 `chown ossadm:ossgroup` + `chmod 0640`，否则 404 |
| 页面会被 OSSDesign 重装覆盖 | 桥/前端必须可重复安装、可检测（`HUD_BRIDGE_V`、`oss-hud-bootstrap-v2` 标记） |
| HUD 自己也在发请求（轮询、宏接口） | 录制器必须过滤 `/hud/*`，否则宏会自我递归 |
| 浏览器不能持有 cogagent 凭据 | 凭据只在 broker 侧；桥不读 `/srv/cogagent` |

### 9.3 非目标

- 不做跨标签页/跨浏览器的 CDP 控制；
- 不做截图/多模态定位；
- 不在回放时调用大模型。

---

## 10. 组件与职责边界

| 组件 | 运行位置 | 语言 | 输入 | 输出 | 失败模式 |
|---|---|---|---|---|---|
| `common/hud.js` | 浏览器页面 | JS | 用户操作、宏 JSON、broker 命令 | DOM 操作、REST 请求、`/macro/result` 上报 | 单步失败即整轮失败；busy 时等待重试 |
| `common/hud_proxy.py` | OSSDesign Tornado 进程 | Python | 页面同源请求 | 转发到 `127.0.0.1:18765` | 60s 超时；broker 不可达返回 502 |
| `common/hud_register.py` | 同上 | Python | `ossdiyservice.py` 的 app | 注册 `/designer/hud/*` handler | 注册块缺失 → 404 |
| `common/broker.py` | 独立进程（systemd） | Python | 桥的 HTTP 请求 | JSON 响应、队列、落盘 | 进程退出 → 桥 502；重启后内存态丢失（宏在磁盘） |
| `common/macro_store.py` | broker 进程内 | Python | 宏/运行记录 | 文件读写 | 磁盘满/权限错 → `macro_invalid` 或 IO 异常 |
| `common/install-all.sh` / `deploy.sh` | root shell | Bash | bundle 目录 | 文件落地、bootstrap、systemd | 权限错 → 前端 404；bootstrap 错 → COG 球不出现 |
| `common/cogagent-hud-broker.service` | systemd | — | — | 常驻 broker | 启动失败 → 桥 502 |
| `profiles/ossdesign-<n>/` | root shell | Bash/Python | 环境参数 | 注册脚本 | 环境不匹配 → 路径错 |

### 10.1 关键不变量

1. **单一运行**：同一 `owner` 同时只允许一个 `running` 的 run；否则 409 `macro_busy`。
2. **归属校验**：`list/get/delete/run/result/cancel` 全部校验 `owner`；跨 owner 返回 `forbidden` / `run_forbidden`。
3. **宏只读执行**：执行期不修改宏；参数通过 `params` 传入。
4. **结果必落盘**：`finish` 时 broker 调 `append_run`；页面消失则由 20s 陈旧清扫补写 `failed + stale=true`。

---

## 11. 运行拓扑与进程模型

```
┌─────────────────────────────── 浏览器 ───────────────────────────────┐
│ hud.<ver>.js（Shadow DOM）                                           │
│   ├ macroPoll  setInterval 1500ms  →  /hud/macro/pending             │
│   ├ execMacro  顺序执行 steps[]，逐步 POST /hud/macro/result          │
│   └ recNetStart hook fetch/XHR（仅在录制期）                          │
└──────────────────────────────┬────────────────────────────────────────┘
                               │ 同源 HTTPS（Cookie + roarand）
┌──────────────────────────────▼────────────────────────────────────────┐
│ OSSDesign（Tornado）  hud_proxy.py                                    │
│   /rest/ossdesign/v1/designer/hud/* → AsyncHTTPClient(60s)            │
│   把网关带来的 X-User-Name 转成 X-Hud-Web-User                         │
└──────────────────────────────┬────────────────────────────────────────┘
                               │ http://127.0.0.1:18765
┌──────────────────────────────▼────────────────────────────────────────┐
│ broker.py  ThreadingHTTPServer                                        │
│   MACRO_LOCK 保护 MACRO_RUNS / MACRO_PENDING                          │
│   MACRO_STORE（文件）  +  cogagent serve 实例表（AI 对话）             │
└───────────────────────────────────────────────────────────────────────┘
```

### 11.1 并发模型

| 资源 | 保护方式 |
|---|---|
| `MACRO_RUNS` / `MACRO_PENDING` | `MACRO_LOCK`（`threading.Lock`） |
| `INSTANCES` / `TICKETS` / `HANDLES` | `STATE_LOCK`（`threading.RLock`） |
| 宏/运行文件 | 单进程串行写（broker 内调用），无跨进程锁 |
| 页面并发 | 单页面单线程；重复点击由 broker 的 busy 检查拒绝 |

### 11.2 超时与阈值

| 项 | 值 | 位置 |
|---|---|---|
| 页面轮询间隔 | 1500 ms | `hud.js` `setInterval(macroPoll, 1500)` |
| 桥普通请求超时 | 60 s | `hud_proxy.py` `TIMEOUT` |
| 桥 SSE 超时 | 86400 s | `STREAM_TIMEOUT` |
| run 截止 | 默认 120 s（请求体 `timeout` 可调） | `broker.py` `/macro/run` |
| 陈旧运行释放 | 20 s 无 `touched` 更新 | `broker.py` `STALE_RUN_V1` |
| busy 等待 | 30 次 × 2 s，每 5 次触发 onlyStale cancel | `hud.js` |
| 元素定位重试 | 4 s（`macroResolveRecover`） | `hud.js` |
| API 响应体截断 | 录制 4000 字符；run 记录 req≤600/res≤300；api 日志 4000 | `hud.js` / `macro_store.py` |

### 11.3 run 状态机

```
start_run(owner, macroId)            → running
  ├ 每步 result                       → running（touched 更新）
  ├ 最后一步 ok                       → ok
  ├ 任一步 error                      → failed（failedStep/error）
  ├ /macro/cancel                     → cancelled
  └ 20s 无心跳（页面消失）            → failed + stale=true
```

---

## 12. 端到端时序

### 12.1 录制并保存

```
用户点「录制」 → startRecord()
  ├ 绑定 click/input/change/keydown 捕获（捕获阶段）
  └ recNetStart()：包装 window.fetch 与 XMLHttpRequest
用户操作页面 → recSteps（UI 动作） + recNet[]（接口流量）
用户点「停止」 → stopRecord()
  ├ recApiSteps()            过滤 /hud/* 与纯展示查询
  ├ 名称加时间戳             基础名(≤19) + _ + {{shortstamp}}
  ├ recCorrelate()           响应值 → {{sN.path}}
  ├ recAutoLookup()          project_id / site_id 的 lookup 或 save
  ├ recExistingSites()       已有站点 → {{target_site_id}} + 前置 lookup
  ├ recSyncLookupNames()     lookup.where.text 同步为最终值
  ├ 注入 assertList / assertField
  └ 追加 reload
用户输入名称 → POST /hud/macro/save {mode:upsert, macro}
  └ broker: store.validate() → 写 macros/<owner>/<id>.json → 更新 index.json
```

### 12.2 点击运行

```
点工具栏按钮 → runMacroById(id)
  → POST /hud/macro/run {id}
      broker: 取宏 → 清扫 >20s 的 running（置 failed+stale，落盘）
              → 若本 owner 仍有 running → 409 macro_busy
              → start_run() 写 running 记录
              → MACRO_PENDING[owner].append({runId, macro, params, count, deadline})
      ← {runId}
  → macroPoll（1.5s）→ GET /hud/macro/pending → 取到命令
  → execMacro(cmd)
```

### 12.3 单步执行

```
execMacro:
  macroClock = 冻结时间戳            （CLOCK_FREEZE_V1）
  outputs = {}; params = cmd.params
  for each step i:
      stepAt(i)
        ├ api:        macroDeepExpand(payload/query) → 未解析检查
        │             → fetch（带 roarand）→ JSON 解析 → retMsg 判定
        │             → outputs[as]=body；save 提取；POST result
        ├ lookup:     查列表 → 归一化匹配 → 最大 id → 数字校验 → outputs[as]
        ├ assertList: 查列表 → 全等匹配 → 无则报错
        ├ assertField:查接口 → 取路径 → nonEmpty/equals 校验
        ├ reload:     POST result 后 location.reload()
        └ UI 动作:    定位（候选/重试）→ 执行 → 等待条件
      失败 → failedStep=i，整轮 failed，停止后续步骤
```

### 12.4 取消与僵死

```
用户点「■ 停止执行」 → POST /hud/macro/cancel {runId, note}
   broker: 记录 result=cancelled + note → 释放 MACRO_RUNS → 清 PENDING 中该 runId
   HUD:    停止轮询执行，恢复按钮

页面刷新/关闭（无 cancel）:
   touched 不再更新 → 20s 后下一次 /macro/run 触发清扫
   → 该 run 被置 result=failed, stale=true, failedStep=null 并落盘
```

---

## 13. 录制器内部

### 13.1 网络采集（`recNetStart`）

| 目标 | 做法 |
|---|---|
| `fetch` | 包装 `window.fetch`：复制响应 `clone().text()`，记录 `{method,url,body,resp(≤4000),status,roarand}` |
| `XMLHttpRequest` | 包装 `open/send/setRequestHeader`，`onreadystatechange` 时取 `responseText`（≤4000） |
| CSRF | 从请求头捕获 `roarand`，供回放时复用 |

采集结果暂存内存数组，停止录制时统一转换；**不落盘**。

### 13.2 UI 动作采集

| 事件 | 记录内容 |
|---|---|
| `click` | 目标定位描述（testId / data-test-type / id / 字段名 / label / 路径） |
| `input` | 目标 + 实时值（`fill`） |
| `change` | 原生 select 变化（`select`） |
| `keydown` | Enter/Tab/Esc/方向键（`press`） |
| 下拉项点击 | 识别为选项事件，合并为 `choose(target, value)` |

定位优先级：`data-hud-id`（运行时标注） > `data-test-type` > `id` > `FormItem name` > label 文本 > DOM 路径。

### 13.3 关联算法（`recCorrelate`）

```
对每个响应：recLeaves(resp) 递归收集叶子 → 路径含数组下标，如 Products[0].product
对每个后续步骤 payload/query：
    标量按 String 比较（数字 id 也参与替换）      REPLACE_SCALAR_V1
    路径以 id/pid/*_id 结尾时不受“长度≥3”限制    CORRELATE_ID_V1
    命中 → 替换为 {{s<N>.<path>}}，N 为来源步骤序号
```

### 13.4 自动补全规则

| 规则 | 触发 | 结果 |
|---|---|---|
| 项目 id | 存在 `createPrj` | `createPrj` 之后插 `lookup queryPrjLst where{text:项目名} as=project_id` |
| 站点 id | 存在 `createSite` | 有响应 `id` → `save:{site_id:"id"}`；否则插 `lookup querySiteLst` |
| 已有站点 | payload.site_id ≠ 新站点 id | 反查站点名 → `{{target_site_id}}` + 宏首部 `lookup` |
| 落库断言 | `createSite` / `modifySiteAttr` | `assertList` / `assertField site.0.context` |
| 名称时间戳 | payload 键含 project/prj/site + name | `基础名(≤19) + _ + {{shortstamp}}` |

### 13.5 录制过滤

| 过滤对象 | 原因 |
|---|---|
| `/designer/hud/*` | HUD 自身轮询/宏接口，录进去会自我递归 |
| `querySiteParam`、`querySiteCusInfo`、`getStorageSpace`、`getDetailInfo`、`getRouteInfo_Net` | 纯展示查询，回放无意义 |
| 保留 `querySiteAttr` | 唯一能验证 `site_context` 是否落库的接口 |

---

## 14. 宏数据模型

### 14.1 完整示例

```json
{
  "id": "rec-mwugyppj",
  "name": "建站-272",
  "description": "录制于 https://<host>/ossdesign",
  "owner": "z30048462",
  "createdAt": "2026-11-24T14:32:52",
  "params": { "项目名": "expand" },
  "steps": [
    { "action": "api", "method": "POST",
      "endpoint": "/rest/ossdesign/v1/designer/createPrj",
      "payload": { "project_name": "expand_{{shortstamp}}" }, "as": "s1" },

    { "action": "lookup", "method": "POST",
      "endpoint": "/rest/ossdesign/v1/designer/queryPrjLst", "payload": {},
      "from": "ProjectList", "where": { "text": "expand_{{shortstamp}}" },
      "pick": "id", "as": "project_id" },

    { "action": "api", "method": "POST",
      "endpoint": "/rest/ossdesign/v1/designer/createSite",
      "payload": { "project_id": "{{project_id}}", "site_name": "site_{{shortstamp}}" },
      "save": { "site_id": "id" }, "as": "s4" },

    { "action": "assertList", "method": "POST",
      "endpoint": "/rest/ossdesign/v1/designer/querySiteLst", "payload": {},
      "from": "SiteList", "where": { "id": "{{site_id}}", "pid": "{{project_id}}" } },

    { "action": "api", "method": "POST",
      "endpoint": "/rest/ossdesign/v1/designer/modifySiteAttr",
      "payload": { "site_id": "{{site_id}}", "site_context": "{...}", "cus_name": "", "country": "" } },

    { "action": "assertField", "method": "POST",
      "endpoint": "/rest/ossdesign/v1/designer/querySiteAttr",
      "payload": { "site_id": "{{site_id}}" }, "pick": "site.0.context", "nonEmpty": true },

    { "action": "reload" }
  ]
}
```

### 14.2 校验规则（`Store.validate`）

| 规则 | 失败错误码 |
|---|---|
| `id` 匹配 `^[a-z0-9][a-z0-9-]{1,39}$` | `macro_invalid` |
| `name` 长度 1~40 | `macro_invalid` |
| `steps` 数量 1~**50** | `macro_invalid` |
| 每步 `action` ∈ 允许集合 | `macro_invalid` |
| UI 动作必须含 `target` 定位键 | `macro_invalid` |
| `fill/select/choose` 的 value ≤ 2000 字符 | `macro_invalid` |
| `api.endpoint` 必须以 `/rest/ossdesign/v1/designer/` 开头 | `macro_invalid` |
| `params` ≤ 20 | `macro_invalid` |
| 宏体积 ≤ 256 KB | `macro_invalid` |

### 14.3 限制汇总

```
LIMITS = { steps: 50, params: 20, valueLen: 2000, macroBytes: 256*1024, macrosPerOwner: 200 }
```

---

## 15. 存储与日志

### 15.1 目录

```
/var/lib/cogagent-hud/
├─ macros/index.json                 轻量索引（列表页）
├─ macros/<owner>/<macro-id>.json    宏全文
├─ runs/<owner>/<yyyy-mm>.jsonl      每轮一行
├─ runs/<owner>/<yyyy-mm>.api.jsonl  每次接口一行
└─ pins.json                         {签名: {testId}}
```

### 15.2 运行记录（`append_run`）

| 字段 | 说明 | 截断 |
|---|---|---|
| `runId` | `run_<yyyymmddHHMMSS>_<6位随机>` | — |
| `macroId` / `macroName` / `owner` | 归属 | — |
| `startedAt` / `endedAt` | ISO 时间 | — |
| `result` | `running/ok/failed/cancelled` | — |
| `stale` | 陈旧清扫标记 | — |
| `failedStep` / `error` | 失败定位 | error ≤ 300 |
| `steps[]` | 每步 `{index,action,ok,ms,via,error,req,res}` | steps ≤ 120；req≤400；res≤300 |

### 15.3 接口日志（`append_api`）

每步一次，字段：`runId/index/method/endpoint/ok/req/res/error`；`req` 与 `res` 各保留 **4000 字符**。
它是排查“请求到底发了什么、后端回了什么”的第一手材料（run 记录会截断）。

### 15.4 pins

元素定位缓存：键为定位签名，值为 `{testId}`。执行时优先用 pin 的 `data-hud-id`，命不中再回退常规定位。

---

## 16. 执行器内部

### 16.1 启动与 busy 处理

```
runMacroById(id, tries=0):
  POST /hud/macro/run {id}
    409 macro_busy 且 tries<30 → 状态「等待中 n/30」；tries%5==4 时
                               POST /hud/macro/cancel {onlyStale:true,minIdle:10}
                               2s 后重试
    409 且 tries=30        → 提示「点 ■ 停止执行 强制释放」
    其它错误               → 直接失败
```

### 16.2 轮询与派发

- `macroPoll` 每 1500 ms 调 `/hud/macro/pending`，拿到命令数组逐条 `execMacro`。
- 命令字段：`{runId, macro, params, count, sessionID, slowMode, deadline}`。
- `count>1` 时同一宏连续执行多次（每次重新取时间戳？不——时钟在执行入口生成，见 §17.3）。

### 16.3 步骤分发

| 动作 | 关键实现 |
|---|---|
| `api` | 展开 → 未解析检查 → fetch（`roarand` 头）→ JSON 解析 → `retMsg` 判定 → `outputs[as]` / `save` |
| `lookup` | 查列表 → 空白归一化逐键比较 → 多命中取最大 `pick` → `_id` 数字校验 → 3 次重试（700ms） |
| `assertList` | 查列表 → 全等匹配 → 无匹配抛错 |
| `assertField` | 查接口 → `macroGetPath` 取路径 → `nonEmpty` / `equals` 校验 |
| `click` | 定位（4s，候选回退）→ 记录 pin（若命中且在目标上）→ 派发鼠标事件 |
| `fill` | 定位 → 原生 setter 写值 → 派发 `input/change` |
| `choose` / `select` | 打开下拉 → 扫描选项文本 → 点击 / 赋值 |
| `press` | 派发 keydown/keyup（Enter/Tab/Esc/方向键） |
| `wait` | 轮询条件（selector/text）直到超时 |
| `read` | 读 `innerText/value` 写入 `outputs[as]`（≤2000 字符） |
| `verify` | 断言元素存在/文本匹配 |
| `reload` | 先上报本步结果，再 `location.reload()` |

### 16.4 错误传播

- 所有异步分支用 `guard(promise)` 包裹：成功忽略，失败调用 `bad(msg)`。
- `bad()` 记录 `failedStep`，整轮标记 failed，停止后续步骤，最终上报。
- 错误文案统一包含动作与端点，例如：
  `API POST /…/queryproductversioninfo -> 500: (空响应) | req={…}`

---

## 17. 占位符引擎

### 17.1 展开顺序

```
macroDeepExpand(v):
  1) macroExpand：{{date}} {{time}} {{stamp}} {{shortstamp}} {{datetime}}
                  {{seq:n}} {{rand:n}} {{参数名}}
  2) 裸键：{{key}} ← outputs[key]（save / lookup.as / read.as 产生）
  3) 带路径：{{as.path}} ← outputs[as] 上按路径取值（支持 [n] 下标）
```

### 17.2 路径语法

| 写法 | 含义 |
|---|---|
| `{{project_id}}` | outputs 顶层键 |
| `{{s5.data.list[0].id}}` | 第 5 步响应 → `data.list[0].id` |
| `{{s13.Products[0].product}}` | 数组下标支持 |

解析器把路径切成两类 token：名字与 `[n]` 下标，逐级取值；取不到返回 `undefined`。

### 17.3 时间戳冻结

```
execMacro 入口:
  macroClock = {date, time, datetime, stamp, shortstamp}   // 只取一次 new Date()
执行结束: macroClock = null
```

冻结的原因：`createPrj` 与后续 `lookup` 若各自取时间，跨秒会得到不同名字（曾导致“项目建了但查不到”）。

### 17.4 未解析处理

发请求前扫描 `payload` 与 `query`，若仍存在 `{{...}}`：

```
占位符未解析：{{s13.Products[0].product}} @ /rest/ossdesign/v1/designer/queryproductversioninfo
```

**不会**把占位符原样发给后端（旧行为会导致后端 500 且难以定位）。

### 17.5 名称约束

| 项 | 值 |
|---|---|
| 允许字符（后端） | 字母、数字、`_`、`-`（0~32 位） |
| 前端要求 | 1~32 位、不含反斜杠 |
| 录制改写 | 基础名截断到 19 + `_` + 12 位短戳 = 32 |
| 唯一性 | 项目名全局唯一；站点名项目内唯一 |

---

## 18. 动作参考

### 18.1 `api`

```json
{ "action": "api", "method": "POST",
  "endpoint": "/rest/ossdesign/v1/designer/createSite",
  "payload": { "project_id": "{{project_id}}", "site_name": "s_{{shortstamp}}" },
  "query": {}, "headers": {},
  "as": "s4", "save": { "site_id": "id" } }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `method` | 否 | 默认 `POST` |
| `endpoint` | 是 | 必须 `/rest/ossdesign/v1/designer/` 前缀 |
| `payload` | 否 | JSON 体（展开后序列化） |
| `query` | 否 | 拼到 URL 的查询参数 |
| `headers` | 否 | 额外头（`roarand` 自动加） |
| `as` | 否 | 整份响应存入 `outputs[as]` |
| `save` | 否 | `{变量: 响应路径}`，批量提取 |

### 18.2 `lookup`

```json
{ "action": "lookup", "method": "POST",
  "endpoint": "/rest/ossdesign/v1/designer/queryPrjLst", "payload": {},
  "from": "ProjectList", "where": { "text": "prj_{{shortstamp}}" },
  "pick": "id", "as": "project_id" }
```

| 字段 | 说明 |
|---|---|
| `from` | 列表在响应里的路径（如 `ProjectList`） |
| `where` | 匹配条件；每键做字符串比较（去空白） |
| `pick` | 命中后取哪个字段（默认 `id`） |
| `as` | 结果写入 `outputs[as]` |

### 18.3 `assertList` / `assertField`

```json
{ "action": "assertList", "endpoint": ".../querySiteLst", "payload": {},
  "from": "SiteList", "where": { "id": "{{site_id}}", "pid": "{{project_id}}" } }

{ "action": "assertField", "endpoint": ".../querySiteAttr",
  "payload": { "site_id": "{{site_id}}" },
  "pick": "site.0.context", "nonEmpty": true }
```

### 18.4 UI 动作

| 动作 | 示例 |
|---|---|
| `click` | `{"action":"click","target":{"testId":"eui_tf_10002"}}` |
| `fill` | `{"action":"fill","target":{"field":"project_name"},"value":"prj_{{shortstamp}}"}` |
| `choose` | `{"action":"choose","target":{"label":"硬件类型"},"value":"TaiShan"}` |
| `select` | `{"action":"select","target":{"testId":"…"},"value":"zh_CN"}` |
| `press` | `{"action":"press","target":{…},"key":"Enter"}` |
| `wait` | `{"action":"wait","wait":{"selector":".tree","timeout":8000}}` |
| `read` | `{"action":"read","target":{…},"as":"title"}` |
| `verify` | `{"action":"verify","target":{…},"expect":"已完成"}` |
| `reload` | `{"action":"reload"}` |
| `sleep` | `{"action":"sleep","ms":800}` |

`target` 支持键：`testId`、`field`、`label`、`text`、`selector`、`path`、`candidates`。

---

## 19. 断言与校验体系

### 19.1 三层校验

| 层 | 校验 | 失败表现 |
|---|---|---|
| 保存时 | `Store.validate` | `macro_invalid` + 具体原因 |
| 执行时 | 占位符解析、lookup 数字、断言 | 步失败，`failedStep` 指向该步 |
| 业务层 | `retMsg` / HTTP 状态 | 抛错并附 `errorMsg` 或 `req` |

### 19.2 `retMsg` 语义

| 值 | 语义 | 处理 |
|---|---|---|
| `OK` | 成功 | 继续 |
| `NA` | 无需变更（`modifyVnfNameSiteAttr` 的正常路径） | **视为成功** |
| `ERROR` / `Error` | 失败 | 抛错，带 `errorMsg` |
| 无 `retMsg` | 非标准响应 | 兜底看 `code/retCode/status/success` |

### 19.3 断言注入点

| 断言 | 位置 | 目的 |
|---|---|---|
| `assertList querySiteLst {id,pid}` | `createSite` 之后 | 站点确实挂在该项目下 |
| `assertField querySiteAttr.site.0.context` | `modifySiteAttr` 之后 | 基础配置确实落库 |

---

## 20. HTTP 契约

### 20.1 桥（同源）

- 前缀：`/rest/ossdesign/v1/designer/hud/`
- 实现：`hud_proxy.py`，`AsyncHTTPClient` 转发到 `http://127.0.0.1:18765`，普通请求 60s、SSE 86400s。
- 头部：把网关带来的 `X-User-Name` 转成 `X-Hud-Web-User` 传给 broker（`WEB_USER_V1`）。

路由（桥 → broker）：

| 桥路由 | 方法 | broker 路径 |
|---|---|---|
| `status` | GET | `/status` |
| `login/start`、`login/status`、`login/cancel`、`login/reset`、`login/active` | POST/GET | 同名 |
| `macro/list` | GET | `/agent/macro/list` |
| `macro/get` | GET | `/agent/macro/get` |
| `macro/save` | POST | `/agent/macro/save` |
| `macro/delete` | POST | `/agent/macro/delete` |
| `macro/run` | POST | `/agent/macro/run` |
| `macro/result` | POST | `/agent/macro/result` |
| `macro/pending` | GET | `/agent/macro/pending` |
| `macro/runs` | GET | `/agent/macro/runs` |
| `macro/cancel` | POST | `/agent/macro/cancel` |
| `macro/pin`、`macro/pins` | GET/POST | `/agent/macro/pin` |
| `macro/whoami` | GET | `/agent/macro/whoami` |
| `sessions`、`session`、`messages`、`prompt`、`reply`、`interrupt`、`forms`、`form/reply` | — | AI 对话（同名转发） |

### 20.2 broker 端点

| 端点 | 方法 | 请求 | 响应 |
|---|---|---|---|
| `/status` | GET | — | `{ok, macros, runs, …}` |
| `/agent/macro/list` | GET | `scope`,`q` | `{macros:[{id,name,owner,updatedAt,steps}]}` |
| `/agent/macro/get` | GET | `id` | `{macro}` |
| `/agent/macro/save` | POST | `{mode, macro}` | `{id, version}` |
| `/agent/macro/delete` | POST | `{id, hard}` | `{deleted:true}` |
| `/agent/macro/run` | POST | `{id, params, count, wait, timeout, trigger, sessionID, slowMode}` | `{runId}` 或 `{record}`（`wait`） |
| `/agent/macro/result` | POST | `{runId, step, action, ok, ms, req, res, error, final, result}` | `{ok:true}` |
| `/agent/macro/pending` | GET | — | `{commands:[…]}`（取走即清空） |
| `/agent/macro/runs` | GET | `id`,`limit` | `{runs:[…]}` |
| `/agent/macro/cancel` | POST | `{runId?, note, onlyStale?, minIdle?}` | `{cancelled:[runId]}` |
| `/agent/macro/pin` | GET/POST | `sig` / `{sig, pin}` | pin 列表 / `{ok:true}` |

### 20.3 错误码

| 码 | HTTP | 含义 |
|---|---|---|
| `macro_not_found` | 404 | 宏不存在 |
| `forbidden` | 403 | 宏不属于当前 owner |
| `macro_invalid` | 400 | 校验失败（含具体原因） |
| `macro_conflict` | 409 | 同名动作已存在 / 版本冲突 |
| `macro_busy` | 409 | 本 owner 仍有运行中的 run |
| `run_not_found` | 404 | runId 不存在 |
| `run_forbidden` | 403 | run 不属于当前 owner |

### 20.4 调用示例

```bash
curl -s --noproxy '*' http://127.0.0.1:18765/status

curl -s --noproxy '*' \
  -H 'X-Hud-Web-User: z30048462' \
  'http://127.0.0.1:18765/agent/macro/list?scope=all'

curl -s --noproxy '*' -X POST \
  -H 'X-Hud-Web-User: z30048462' -H 'Content-Type: application/json' \
  -d '{"id":"rec-mwugyppj"}' \
  http://127.0.0.1:18765/agent/macro/run

curl -s --noproxy '*' -X POST -H 'Content-Type: application/json' \
  -d '{"note":"manual-release"}' \
  http://127.0.0.1:18765/agent/macro/cancel
```

---

## 21. 安装与生命周期

### 21.1 bundle 组成

```
cogagent-hud-bundle.tgz
├─ common/      broker.py macro_store.py hud.js hud_proxy.py hud_register.py
│               install-all.sh deploy.sh recover.sh restore.sh uninstall-all.sh
│               cogagent-hud-broker.service manifest.json
├─ profiles/    ossdesign-270/ ossdesign-272/
├─ test/        macro-store-test.sh mock-install-test.sh
├─ examples/    create-project.json
└─ install-full.sh  README.md  SYNC.md
```

### 21.2 落地路径

| 内容 | 路径 |
|---|---|
| broker.py / macro_store.py / 脚本 | `/opt/cloud/manager/tools/cogagent-hud/` |
| systemd 单元 | `/etc/systemd/system/cogagent-hud-broker.service` |
| hud.js | `<APP>/webapps/ossdesignwebsite/osmuwebsite_app/hud.<ver>.js` |
| hud_proxy.py / hud_register.py | `<APP>/pyscript/ossdesign/interface/` |
| 运行态 | `/var/lib/cogagent-hud/` |
| 日志 | `/var/log/cogagent-hud/broker.log` |

### 21.3 前端注入机制（bootstrap v2）

`deploy.sh` 往 `app_main.js` **末尾追加**一段自执行脚本（带标记，重复执行不会重复注入）：

```js
;/*oss-hud-bootstrap-v2*/(function(){try{
  if(window.__OSS_HUD_BOOT_V2__)return;
  window.__OSS_HUD_BOOT_V2__=1;
  var s=document.createElement("script");
  s.src="/ossdesignwebsite/osmuwebsite_app/hud.<ver>.js";
  s.async=false;s.onerror=function(){};
  (document.head||document.documentElement).appendChild(s);
}catch(e){}})();
```

再次安装时改用正则**就地改指向**（不新增标记）。

### 21.4 桥注册

`hud_register.py` 由 `ossdiyservice.py` 中的注册块（标记 `HUD_BRIDGE_V`）挂载；缺失则桥 404。

### 21.5 systemd 单元

```ini
[Unit]
Description=cogagent HUD broker
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/cloud/manager/tools/cogagent-hud/broker.py \
  --port 18765 --root /srv/cogagent/users --state-dir /var/lib/cogagent-hud
Restart=on-failure
RestartSec=3
User=root
Group=root
StandardOutput=append:/var/log/cogagent-hud/broker.log
StandardError=append:/var/log/cogagent-hud/broker.log

[Install]
WantedBy=multi-user.target
```

### 21.6 升级 / 回滚 / 恢复 / 卸载

| 操作 | 做法 |
|---|---|
| 升级 | 装新 bundle → 生成新的 `hud.<ver>.js` → `deploy.sh` 改 bootstrap 指向 → 页面 Ctrl+Shift+R |
| 回滚 | 把 bootstrap 指回旧 `hud.*.js`（旧文件保留即可） |
| 恢复（重装 OSSDesign 后） | `recover.sh`：按最新 `hud*` 文件重写 bootstrap + 重装桥 |
| 还原备份 | `install-all.sh --restore=latest` / `--list-backups` |
| 卸载 | `common/uninstall-all.sh`：移除 bootstrap、桥、注册块、systemd |

### 21.7 安装校验清单

```bash
systemctl is-active cogagent-hud-broker
curl -s --noproxy '*' http://127.0.0.1:18765/status; echo

A=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
W="$A/webapps/ossdesignwebsite/osmuwebsite_app"
grep -o 'hud[^\"]*\.js' "$W/app_main.js" | sort -u     # bootstrap 指向
ls -l "$W"/hud*.js                                       # 文件属主应为 ossadm:ossgroup 0640
grep -c 'HUD_BRIDGE_V' "$A/pyscript/ossdiyservice.py"     # 注册块存在
```

页面 Console 应出现：`[hud] build <时间>`。

---

## 22. 安全模型

| 面 | 措施 |
|---|---|
| 传输 | 只走同源 HTTPS；broker 只监听 `127.0.0.1` |
| CSRF | 复用页面 `roarand` 头；不新增 token 机制 |
| 身份 | 桥把网关注入的 `X-User-Name` 作为 `X-Hud-Web-User`；broker 仅接受本机来源 |
| 归属 | 所有宏/运行按 owner 隔离，跨 owner 返回 403 |
| 凭据 | broker 不把 cogagent 凭据下发给页面；桥不读 `/srv/cogagent` |
| 接口范围 | 宏内 `api.endpoint` 仅允许 `/rest/ossdesign/v1/designer/` |
| 外联 | HUD 不访问外网；仅访问同源 OSSDesign 与 127.0.0.1 |
| 文件 | 前端 `0640 ossadm:ossgroup`；状态目录 `0700` |

---

## 23. 可观测性与故障机理

### 23.1 三处日志

| 位置 | 内容 | 用途 |
|---|---|---|
| `/var/log/cogagent-hud/broker.log` | broker 请求、cancel、stale 释放 | 服务端行为 |
| `/var/lib/cogagent-hud/runs/<owner>/<yyyy-mm>.jsonl` | 每轮结果与每步摘要 | 轮次定位 |
| `/var/lib/cogagent-hud/runs/<owner>/<yyyy-mm>.api.jsonl` | 每次接口 req/res（4000 字符） | 请求级定位 |

### 23.2 故障机理表

| 现象 | 真实机理 | 修复标记 |
|---|---|---|
| 一直「等待中（n/30）」 | 页面刷新导致 run 无心跳，旧阈值 60s > 等待窗口 30s | 阈值降至 20s + 等待中只清陈旧（`STALE_RUN_V1`/`onlyStale`） |
| 名字建了却查不到 | 两处 `{{shortstamp}}` 各取一次时间，跨秒差 1 秒 | 执行内冻结时钟 `CLOCK_FREEZE_V1` |
| `lookup 得到非数字 id` | 占位符没展开，字符串进了请求 | `LOOKUP_NUMERIC_V1` |
| 后端 500 空响应 | 数组下标路径解析失败，`{{s13.Products[0].product}}` 原样发出 | `API_V3` + `UNRESOLVED_V1` |
| 内容写丢 | 写操作打到旧 `site_id` | `REPLACE_SCALAR_V1` + `CORRELATE_ID_V1` + `ASSERTSITE_V1` |
| 弹层自动消失 | `mouseleave` 在按钮与弹层间隙触发 | `POP_HOVER_V1` |
| 图标空白/破图 | 内联 SVG 缺 `xmlns`，DOMParser 失败；data URI 被 CSP 拦 | `ICON_DOM_V1`（DOMParser + 文本兜底） |
| COG 球消失 | 手工复制后属主变 root，ossadm 读不到 → 404 | 安装脚本 `chown ossadm:ossgroup` + `chmod 0640` |
| 改了代码但没生效 | bootstrap 指向旧 `hud.*.js` | `[hud] build` 校验 + bootstrap 指向最新 |

---

## 24. 扩展指南

### 24.1 新增动作

| 步骤 | 改动点 |
|---|---|
| 1 | `macro_store.ACTIONS` 加入动作名 |
| 2 | `hud.js` 的 `stepAt` 增加分支（返回 promise，用 `guard` 包裹） |
| 3 | `macro_store.validate` 增加该动作的字段校验（如 target/value） |
| 4 | 本文 §18 增补字段表 |

### 24.2 新增断言

优先复用 `assertField`：新断言 = `{action:"assertField", endpoint, payload, pick, nonEmpty|equals}`，无需改执行器。

### 24.3 新增环境 profile

在 `profiles/<name>/` 放 `register.sh` + `register_impl.py`（负责该环境的桥/前端注册差异），并在安装脚本中按环境选择。

### 24.4 新增占位符

在 `macroExpand` 的 replace 链里加一条（如 `{{uuid}}`），注意**不要**每次取值都调用时间/随机源，除非就是要每次变化。

---

## 25. 版本标记与兼容性

| 标记 | 语义 |
|---|---|
| `CLOCK_FREEZE_V1` | 执行内冻结时间戳 |
| `REPLACE_SCALAR_V1` | 数字/布尔占位符替换 |
| `CORRELATE_ID_V1` | 短 id 参与关联 |
| `REC_LOOKUP_V1` | 自动插入 lookup |
| `LOOKUP_MAX_ID_V1` | 多命中取最大 id |
| `LOOKUP_NUMERIC_V1` | `_id` 结果必须数字 |
| `LOOKUP_NAME_SYNC_V1` | lookup 名称同步 |
| `EXISTING_SITE_V1` | 已有站点解析为 `target_site_id` |
| `ASSERTSITE_V1` | createSite 后断言站点归属 |
| `ASSERTSITEATTR_V1` | modifySiteAttr 后断言 context 非空 |
| `ASSERT_LIST_V1` / `ASSERT_FIELD_V1` | 两种断言动作 |
| `API_BIZ_V2` | `retMsg` 判定 |
| `API_V3` | 路径支持 `[n]` |
| `UNRESOLVED_V1` | 未解析占位符快速失败 |
| `ERR_REQ_V1` | 错误信息带 `req=` |
| `POP_HOVER_V1` | 弹层不误关 |
| `ICON_DOM_V1` | DOMParser 建图标 |

兼容策略：

- **宏格式向后兼容**：新执行器能跑旧宏（旧字面 id 的宏需要迁移或重录，因为字面 id 已无意义）。
- **环境变量双名**：`COGAGENT_*` 优先，`OPENCODE_*` 回退并告警。
- **前端可回滚**：旧 `hud.*.js` 保留，bootstrap 指回即可。
- **桥/注册可重装**：`recover.sh` 与 `install-all.sh --check` 用于重装后恢复。

