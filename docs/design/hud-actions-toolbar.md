# HUD 动作工具栏 + AI 协作设计

> 目标：把页面上要反复点的一串操作沉淀为**动作**，在悬浮窗里以**工具栏**呈现；
> **用户点一下就执行**，AI 能**看到执行过程、也能自己调用**，还能**新建/修改/删除**动作。
> 关联文档：docs/design/cdp-browser-control.md（CDP 跨标签方案，本文只覆盖 HUD 页面代理）。

---

## 1. 目标与非目标

### 1.1 目标

| # | 目标 |
|---|---|
| G1 | 用户点工具栏按钮即可执行一条固定流程（真点击、真输入、真跳转） |
| G2 | 执行过程**可视**：目标元素高亮、步骤进度、可暂停 |
| G3 | AI **感知**用户手动执行（合成消息），并能**自己调用**动作（macro_run） |
| G4 | AI 能**新建 / 修改 / 删除**动作（直接落盘，带版本与审计） |
| G5 | 名称类参数支持**时间戳/序号**，天然防重复 |
| G6 | 动作可**共享**给他人调用，但执行用**调用者自己的登录态** |
| G7 | 危险步骤的确认策略**跟随会话权限模式**（ask 确认 / bypass 直接执行） |

### 1.2 非目标

| 不解决 | 说明 |
|---|---|
| 跨标签页 / 其它系统 | 需要 CDP 方案（另一份文档） |
| 通用桌面 RPA | 只操作当前 OSSDesign 文档 |
| 绕过权限 | 动作不携带凭证，一律以调用者身份执行 |
| 无页面时执行 | 动作必须在 HUD 所在页面执行；不在页面会失败并提示 |

---

## 2. 角色与边界

| 角色 | 能做 | 不能做 |
|---|---|---|
| **用户** | 点工具栏执行、录制、右键编辑/共享/停用、参数微调 | — |
| **AI** | 列出/调用/新建/修改/删除动作；读取执行结果；建议用哪个动作 | 绕过危险步骤确认（ask 模式下仍需用户确认） |
| **HUD** | 执行动作、高亮、上报结果、渲染工具栏 | 直接访问服务器（只经 broker） |
| **broker** | 存储动作、调度执行、转发结果、写审计 | 执行页面操作（由 HUD 做） |

---

## 3. 总体架构

~~~
┌────────────── 用户浏览器 ──────────────┐        ┌──────── 服务器 ────────┐
│  HUD（Shadow DOM）                      │        │  broker :18765         │
│   ├─ 工具栏（动作按钮 / ⋯ 更多 / 录制） │◀─HTTP─▶│   ├─ /agent/macro/*     │
│   ├─ 执行器（高亮/慢速/确认/进度）      │        │   ├─ 动作存储 + 版本    │
│   └─ 录制器（点击/输入 → 泛化为步骤）   │        │   └─ 审计 runs.jsonl    │
└───────────────┬────────────────────────┘        └───────────┬────────────┘
                │ SSE（执行事件）                              │ 工具调用
                ▼                                              ▼
        ┌──────────────────────────────────────────────────────────┐
        │ cogagent 会话                                             │
        │  macro_list / macro_run / macro_edit / macro_delete       │
        └──────────────────────────────────────────────────────────┘
~~~

### 3.1 用户点击执行（时序）

~~~
用户点[新建站点]
  → HUD: 展开参数（内置变量）→ 若需确认参数，弹小表单
  → HUD → broker: POST /agent/macro/run {id, params, runId}
  → broker: 装载动作 + 写 run.start 审计 + 返回指令
  → HUD: 逐步执行（高亮 → 动作 → 等条件）
  → HUD → broker: POST /agent/macro/result {runId, step, ok, error, outputs}
  → broker: 落审计 + 向会话注入合成消息
  → AI 下一轮看到【动作完成】…
~~~

### 3.2 AI 调用（时序）

~~~
AI: macro_run("新建站点", {count:2})
  → 工具实现 → broker /agent/macro/run（同 3.1）
  → HUD 执行（用户可见）
  → 结果回到工具 → 工具卡片展示 → AI 继续
~~~

> 关键：**同一个执行通道**，只是触发者不同；执行串行（同一会话同一时刻只跑一个 run）。

---

## 4. 数据模型

### 4.1 动作（Macro）

~~~json
{
  "id": "new-site",
  "name": "新建站点",
  "version": 3,
  "scope": "private|team|public",
  "owner": "z30048462",
  "description": "新建一个站点并填写基础信息",
  "page": { "urlPattern": "/ossdesignwebsite/.*#/site/new", "titleHint": "新建站点" },
  "params": {
    "siteName": { "label": "站点名称", "template": "XX-政务云-{{datetime}}-{{seq:2}}" },
    "vlan":     { "label": "管理 VLAN", "default": "100" }
  },
  "steps": [
    { "action": "click",  "target": { "text": "新建站点", "role": "button" } },
    { "action": "fill",   "target": { "label": "站点名称" }, "value": "{{siteName}}" },
    { "action": "select", "target": { "label": "站点类型" }, "value": "新建" },
    { "action": "fill",   "target": { "label": "管理 VLAN" }, "value": "{{vlan}}" },
    { "action": "click",  "target": { "text": "保存", "role": "button" }, "danger": true },
    { "action": "wait",   "for": { "text": "保存成功" }, "timeout": 15000 },
    { "action": "read",   "target": { "selector": ".site-id" }, "as": "siteId" }
  ],
  "ui": { "pinned": true, "order": 1 },
  "createdAt": "2026-11-20T10:00:00+08:00",
  "updatedAt": "2026-11-20T10:30:00+08:00",
  "deletedAt": null
}
~~~

### 4.2 执行记录（Run）

~~~json
{
  "runId": "run_20261120_143512_ab12",
  "macroId": "new-site",
  "version": 3,
  "trigger": "user|ai",
  "by": "z30048462",
  "startedAt": "...", "endedAt": "...",
  "params": { "siteName": "XX-政务云-20261120-143512-01", "vlan": "200" },
  "result": "ok|failed|cancelled",
  "failedStep": null,
  "steps": [ { "index": 1, "action": "click", "ok": true, "ms": 210 } ],
  "outputs": { "siteId": "SITE-1001" }
}
~~~

### 4.3 存储布局（服务器）

~~~
/var/lib/cogagent-hud/
├── macros/
│   ├── index.json                 # 所有动作的轻量索引（id/name/owner/scope/version）
│   └── <owner>/<id>.json          # 动作全文（含版本历史）
└── runs/
    └── <owner>/<yyyy-mm>.jsonl    # 审计：每次执行一行
~~~

权限：0750，属主 ossadm；broker 以 root 读写。

---

## 5. 动作 DSL

### 5.1 动作类型

| action | 参数 | 说明 |
|---|---|---|
| click | target, danger? | 真点击（滚动到可见 → 高亮 → mousedown/mouseup） |
| fill | target, value, secret? | 逐字输入（可配置整段填入） |
| select | target, value | 下拉选择（按可见文本匹配） |
| check | target, value | 勾选/取消 |
| press | target, key | 按键（Enter/Escape/Tab） |
| wait | for, timeout | 等待条件（文本出现 / 元素可见 / URL 变化 / 请求完成） |
| read | target, as | 读取文本/属性，存入输出变量 |
| navigate | url | 页面跳转（跳转后需重新附着，见 6.4） |
| sleep | ms | 显式等待（少用） |

### 5.2 元素定位（按优先级回退）

~~~
1. label 文本（表单字段）
2. 可见文本 + role（按钮/链接/标签页）
3. placeholder / aria-label / title
4. data-testid / id（若有）
5. CSS 选择器（最后手段，录制时若只能用 CSS 会给出警告）
~~~

命中多个 → 取**可见 + 未被禁用 + 面积最大**者；仍不唯一 → 报错并附候选列表（让用户/AI 决定）。

### 5.3 内置变量

| 变量 | 展开 |
|---|---|
| {{date}} | 20261120 |
| {{time}} | 143512 |
| {{datetime}} | 20261120-143512 |
| {{seq:N}} | 零填充序号（批量运行时自增） |
| {{rand:N}} | 随机十六进制后缀 |
| {{outputs.xxx}} | 引用前序步骤 read 的输出 |

**查重**（可选，动作级配置）：命中同名 → 序号自增重试（最多 5 次）。

---

## 6. 执行器

### 6.1 可视化

| 行为 | 细节 |
|---|---|
| 高亮 | 目标元素 outline 2px #2F6BFF + 400ms 脉冲，再执行 |
| 慢速模式 | 默认 300ms/步；可关（全速） |
| 进度 | 工具栏按钮显示 ⟳ ②/7 填写站点名；HUD 顶部状态条同步 |
| 暂停 | 执行中显示「暂停」；暂停后当前步完成即停住，可继续/终止 |
| 页面滚动 | 目标不在视口时先 scrollIntoView({block:"center"}) |

### 6.2 确认策略（跟随权限模式）

~~~
if step.danger:
    if session.permissionMode == "bypass": 直接执行
    else: 弹确认（动作名 / 第几步 / 目标文本 / 计划输入值）
~~~

- 用户可「本次会话内不再询问该动作」（sessionStorage）
- AI 触发的 run 同样遵守

### 6.3 串行与并发

| 规则 | 说明 |
|---|---|
| 同一会话同一时刻只允许 1 个 run | 后来者排队，按钮显示“等待中” |
| 不同会话可并发 | 各自页面互不影响 |
| run 超时 | 默认 120s（动作可覆盖），超时 → failed + DOM 摘要 |
| 用户手动操作打断 | 检测到导航/关键元素消失 → 终止并标 cancelled |

### 6.4 导航后重新附着

~~~
执行 navigate（或点击导致跳转）
  → 检测 document 卸载（beforeunload / 心跳丢失）
  → broker 侧 run 状态置 re-attaching
  → 新页面 HUD 启动，带 runId 上报 /agent/macro/attach
  → broker 匹配 runId → 继续执行后续步骤
  → 超时（默认 20s）未附着 → failed
~~~

要求：动作步骤里 navigate 后自动进入等待附着；纯点击跳转同理（通过 URL 变化检测）。

---

## 7. 工具栏 UI

~~~
┌─ HUD ─────────────────────────────────────────────┐
│ ● 已连接  z30048462                        [—] [×] │
├───────────────────────────────────────────────────┤
│ [＋新建站点] [导出月报] [读配置] [⋯3]      [⟳录制] │
├───────────────────────────────────────────────────┤
│ 消息区…                                            │
└───────────────────────────────────────────────────┘
~~~

| 交互 | 行为 |
|---|---|
| 单击 | 立即执行（参数用默认/模板展开） |
| 长按/右键 | 菜单：编辑用 AI / 录制覆盖 / 复制为新动作 / 共享 / 停用 / 删除 / 回滚到 vN |
| ⋯ 更多 | 弹出列表：搜索、按“我的/共享”过滤、置顶、排序 |
| ⟳录制 | 进入录制模式（§8），结束时可保存为新动作或覆盖现有 |
| 执行中 | 按钮变 ⟳ ②/7 …，再点 = 暂停/终止菜单 |
| 共享动作 | 按钮右上角小圆点 + 悬浮显示“来自 <owner>” |
| 需参数 | 单击后若参数无默认值 → 面板内弹小表单（内置变量已预填） |

溢出策略：横向滚动（overflow-x:auto，scrollbar-width:thin），⋯ 固定在最右。

---

## 8. 录制器

| 阶段 | 内容 |
|---|---|
| 开始录制 | HUD 监听 click / input / change（捕获阶段，不阻断） |
| 采集 | 记录目标元素（label/文本/role/placeholder）、输入值、页面 URL |
| 泛化 | 具体值替换为参数占位（站点名 → {{siteName}}，含时间戳模式自动识别） |
| 过滤 | 忽略 HUD 自身、忽略轮询导致的 DOM 抖动、合并连续输入为一次 fill |
| 结束 | 展示步骤列表 + 差异（覆盖已有动作时：新增/修改/删除高亮） |
| 保存 | 新建 or 覆盖（版本 +1） or 另存为 |

录制产物默认 scope=private，显式勾选才共享。

---

## 9. AI 集成

### 9.1 工具定义（cogagent 侧）

| 工具 | 输入 | 输出 | 说明 |
|---|---|---|---|
| macro_list | {query?, scope?} | 动作摘要列表 | AI 用来发现动作 |
| macro_run | {name\|id, params?, count?} | run 结果（步骤/耗时/outputs） | 直接执行 |
| macro_edit | {name\|id, patch? , full?} | 新版本号 + diff 摘要 | 新建/修改 |
| macro_delete | {name\|id, hard?} | 结果 | 默认软删除（deletedAt），hard 才物理删除 |

工具描述里带一句用途与参数名，让 AI 能自然建议：“这件事可以用『新建站点』动作，要我现在跑吗？”

### 9.2 AI 感知用户执行

用户手动跑完（或跑失败）后，broker 向当前会话注入**合成消息**：

~~~
【动作执行】新建站点 v3（用户触发）
参数：siteName=XX-政务云-20261120-143512-01, vlan=200
结果：成功（4.2s）；输出 siteId=SITE-1001
~~~

失败时附：失败步序号、动作、目标、错误原因、当前 URL。

> 合成消息使用现有 session.synthetic 通道（resume:false，不打断执行）。

### 9.3 AI 执行时的可见性

- 页面照样高亮/慢速/进度（用户看得见）
- 对话里出现工具卡片：步骤列表 + 每步耗时 + 结果
- 危险步骤在 ask 模式下仍弹确认（用户可拒绝 → 工具返回 declined）

### 9.4 落盘规则

| 操作 | 行为 |
|---|---|
| macro_edit | 直接落盘，version+1，写审计（谁、改了什么摘要） |
| macro_delete | 默认软删除（可恢复）；hard:true 物理删除并写审计 |
| 回滚 | 工具栏右键「回滚到 vN」或 AI macro_edit(full=历史版本) |
| 可选严格模式 | 配置 macro.editRequireApply: true → AI 只出 diff，等用户点「应用」 |

---

## 10. 安全与审计

| 风险 | 措施 |
|---|---|
| 危险动作误执行 | danger:true 步骤跟随权限模式；ask 必确认 |
| 共享动作携带敏感值 | 参数 secret:true 不落盘明文；导出时剔除 |
| 他人动作越权 | 执行以**调用者**身份；动作本身无凭证 |
| 动作被恶意篡改 | 版本历史 + 审计（by/at/diff 摘要）+ 回滚 |
| 审计缺失 | 每次 run 写 runs/<owner>/<yyyy-mm>.jsonl |
| DOM 注入风险 | 只允许 DSL 动作，不执行任意 JS（read 只取值） |

---

## 11. 接口设计（broker）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /agent/macro/list | 列出可见动作（含 owner/scope/version） |
| GET | /agent/macro/get?id= | 取动作全文 |
| POST | /agent/macro/save | 新建/修改（含版本、审计） |
| POST | /agent/macro/delete | 软删除/物理删除 |
| POST | /agent/macro/run | 发起执行（返回 runId；触发者 user/ai） |
| POST | /agent/macro/attach | 导航后新页面 HUD 附着到 runId |
| POST | /agent/macro/result | HUD 上报步骤/最终结果 |
| GET | /agent/macro/runs?id= | 历史执行记录 |

桥（hud_proxy.py）需把这 8 条加入白名单。

---

## 12. 错误处理

| 情况 | 处理 |
|---|---|
| 元素找不到 | failed + 候选列表 + 当前 URL + DOM 摘要片段 |
| 元素不可见/被遮挡 | 先滚动居中，重试 2 次，仍失败 → 同上 |
| 等待条件超时 | failed + 最后 3 条网络请求摘要（若可得） |
| 导航后未附着 | 20s 超时 → failed（提示页面可能未加载 HUD） |
| 用户手动干预导致流程错乱 | 检测 URL/关键元素变化 → cancelled |
| 动作版本与页面不匹配 | 执行前比对 urlPattern；不匹配 → 警告并询问是否继续 |

---

## 13. 里程碑与工作量

| 阶段 | 内容 | 估时 |
|---|---|---|
| M1 | 页面代理基础（指令通道、执行器、高亮/慢速/暂停、导航重新附着） | 2–3 天 |
| M2 | 动作存储 + 工具栏 UI（横向滚动/更多/右键菜单）+ 参数模板 | 2 天 |
| M3 | 录制器（泛化 + 差异） | 1.5 天 |
| M4 | 四个工具（list/run/edit/delete）+ 合成消息 | 1.5 天 |
| M5 | 确认策略、审计、错误处理打磨 | 1 天 |
| **合计** | | **8–9 天** |

---

## 14. 验收用例

| # | 用例 | 期望 |
|---|---|---|
| 1 | 用户点「新建站点」 | 高亮→填写→提交→成功；工具栏显示进度 |
| 2 | ask 模式跑到「提交」 | 弹确认；拒绝则终止并标 cancelled |
| 3 | bypass 模式跑到「提交」 | 不弹确认，直接执行 |
| 4 | AI 调 macro_run | 页面同样可见执行；工具卡片有步骤与耗时 |
| 5 | 用户手动跑完 | AI 下一轮收到合成消息并能解释结果 |
| 6 | AI macro_edit 改第 3 步 | 版本 +1；工具栏立即用新版；可回滚 |
| 7 | AI macro_delete | 软删除（列表不可见，可恢复）；审计有记录 |
| 8 | 动作跨页面（点击后跳转） | 新页面 HUD 附着，流程继续 |
| 9 | 名称带 {{datetime}}-{{seq}} | 连续跑 3 次生成 3 个不同名称 |
| 10 | 元素改名（页面改版） | failed + 候选列表，提示“动作可能过期” |
| 11 | 共享动作由同事调用 | 用调用者会话执行，审计记录调用者 |

---

## 15. 开放问题

| # | 问题 | 现状 |
|---|---|---|
| 1 | 批量参数来源（CSV 逐行）是否纳入一期 | 暂定二期 |
| 2 | 动作能否跨服务器共享 | 暂定同服务器内共享 |
| 3 | 截图留证是否默认开启 | 暂定关闭（DOM 摘要替代） |

---

## 16. 代码落点（改哪些文件）

| 文件 | 类型 | 改动 |
|---|---|---|
| script/hud/common/macro_store.py | 新增 | 动作与执行记录的读写、校验、版本、审计（纯 stdlib） |
| script/hud/common/broker.py | 修改 | 挂 8 个 /agent/macro/* 路由；SSE 增加 macro.command 事件；结果写审计 + 合成消息 |
| script/hud/common/hud_proxy.py | 修改 | ROUTES 白名单加 macro/* 8 条 |
| script/hud/common/hud.js | 修改 | 工具栏渲染、执行器、录制器、SSE 指令处理、重新附着（标记 MACRO_V1） |
| packages/core/src/tool/plugin/macro.ts | 新增 | macro_list / macro_run / macro_edit / macro_delete 四个工具 |
| packages/core/src/tool/macro-client.ts | 新增 | 调 broker 的 HTTP 客户端（127.0.0.1:18765，X-Hud-Account） |
| packages/schema/src/config/flag.ts | 修改 | 新增 flag: macro |
| packages/schema/src/config/config.ts | 修改 | 新增 config.macro（enabled / brokerUrl / requireApply） |
| script/hud/test/macro-store-test.sh | 新增 | macro_store.py 单测 + 审计格式校验 |
| script/hud/test/macro-exec-test.mjs | 新增 | 执行器纯函数（定位评分、变量展开、DSL 校验）单测 |
| docs/hud-handover.md | 修改 | 新增第 13 章“动作工具栏”运维说明 |

## 17. 接口契约（broker）

### 17.1 通用约定

| 项 | 约定 |
|---|---|
| 基址 | http://127.0.0.1:18765 |
| 身份（HUD 调用） | 头 X-Hud-Handle: <handle>（既有机制） |
| 身份（cogagent 工具调用） | 头 X-Hud-Account: <account>；**仅接受来自 127.0.0.1 的请求** |
| 编码 | JSON UTF-8；请求/响应均 application/json |
| 错误体 | {"error":"<code>","detail":"<可读信息>"} |
| 超时 | 普通接口 10s；run 接口立即返回（异步执行） |

### 17.2 错误码

| code | HTTP | 含义 |
|---|---|---|
| macro_not_found | 404 | 动作不存在或已删除且未恢复 |
| macro_invalid | 400 | DSL 校验失败（steps 为空/未知 action/target 缺失） |
| macro_conflict | 409 | 名称冲突（同 owner 同名同版本） |
| macro_busy | 409 | 该账号已有 run 在执行 |
| hud_not_attached | 503 | 该账号没有在线 HUD，无法执行页面动作 |
| run_not_found | 404 | runId 不存在 |
| forbidden | 403 | 跨账号访问他人 private 动作 |

### 17.3 端点明细

#### GET /agent/macro/list

```
query: scope=all|mine|shared  q=<关键字>
resp:  { "macros": [ { "id","name","version","scope","owner","description","pinned","order" } ] }
```

#### GET /agent/macro/get?id=<id>

```
resp:  { "macro": { ...完整 Macro... } }            // 含 steps/params/versionHistory
```

#### POST /agent/macro/save

```
body:  { "macro": { ...Macro... }, "mode": "create|update|upsert" }
resp:  { "id", "version", "diff": { "added","removed","changed" } }
规则:  update 时 version+1；写审计（actor=提交者）；名称冲突→macro_conflict
```

#### POST /agent/macro/delete

```
body:  { "id": "...", "hard": false }
resp:  { "deleted": true, "hard": false }
规则:  默认软删除（deletedAt 置时间）；hard=true 物理删除；写审计
```

#### POST /agent/macro/run

```
body:  { "id": "...", "params": {...}, "count": 1, "trigger": "user|ai", "sessionID": "ses_..." }
resp:  { "runId": "run_...", "accepted": true }
规则:  同账号同时只允许 1 个 run（macro_busy）；无在线 HUD → hud_not_attached
       count>1 时按批量循环，runId 复用，seq 自增
```

#### POST /agent/macro/result

```
body:  { "runId", "step": 3, "ok": true, "ms": 210, "error": null, "outputs": {...} }
resp:  { "ok": true }
规则:  逐步上报；最终一步带 "final": true 与 result=ok|failed|cancelled
```

#### POST /agent/macro/attach

```
body:  { "runId", "url", "title" }
resp:  { "resume": true, "step": 4, "macro": {...} }   // 让新页面 HUD 从第 4 步继续
```

#### GET /agent/macro/runs?id=<id>&limit=20

```
resp:  { "runs": [ {...Run...} ] }
```

## 18. broker ↔ HUD 指令协议（SSE 复用）

现有 SSE：GET /agent/events?handle=... （每账号一条流）。新增事件类型：

```json
{
  "type": "macro.command",
  "data": {
    "runId": "run_...",
    "macro": { ...Macro... },
    "params": { "siteName": "XX-...-01" },
    "count": 1,
    "seq": 1,
    "sessionID": "ses_...",
    "slowMode": true,
    "deadline": 1750000000
  }
}
```
| 事件 | 方向 | 说明 |
|---|---|---|
| macro.command | broker → HUD | 下发执行指令 |
| macro.ack | HUD → broker（HTTP /result step=0） | 收到指令 |
| macro.progress | HUD → broker（HTTP /result） | 每步结果 |
| macro.attached | HUD → broker（HTTP /attach） | 导航后重新附着 |
| macro.finished | HUD → broker（HTTP /result final） | 结束 |

## 19. 执行器算法（HUD 侧）

### 19.1 主循环伪代码

```
async function runMacro(cmd):
  for (i = startStep; i < steps.length; i++):
    step = steps[i]
    if (step.danger && permissionMode != 'bypass'):
       if (!await confirmDialog(step, i)) -> report(cancelled); return
    el = await resolveTarget(step.target, timeout=5000)
    if (!el) -> report(failed, i, 'target_not_found'); return
    highlight(el); if (slowMode) await sleep(300)
    switch (step.action):
      click:   await scrollIntoView(el); await dispatchClick(el)
      fill:    await setValue(el, expand(step.value)); 
      select:  await selectOption(el, expand(step.value))
      check:   await setChecked(el, step.value)
      press:   await pressKey(el, step.key)
      wait:    await waitFor(step.for, step.timeout)
      read:    outputs[step.as] = readValue(el)
      navigate: report(i); await goto(step.url); return 'detached' // 走重新附着
    report(i, ok)
  report(final, ok)
```

### 19.2 元素定位（5 级回退 + 评分）

```
candidates = []
if (target.label)      candidates += byLabel(target.label)
if (target.text&&role) candidates += byRoleText(target.role, target.text)
if (target.placeholder)candidates += byPlaceholder(target.placeholder)
if (target.ariaLabel)  candidates += byAria(target.ariaLabel)
if (target.testId)     candidates += byTestId(target.testId)
if (target.selector)   candidates += qsa(target.selector)
filter: visible && !disabled && inDocument
score:  exact text match +30, role match +20, 面积大 +10, 靠近视口中心 +5
取 score 最高且唯一；并列 → 返回错误 + 候选清单(最多 5 条)
排除: HUD 自身 shadow root 内的元素
```

### 19.3 真实输入（兼容 React/Vue 受控组件）

```
const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
setter.call(el, value);
el.dispatchEvent(new Event('input', { bubbles: true }));
el.dispatchEvent(new Event('change', { bubbles: true }));
// 若元素是 contenteditable：改用 document.execCommand('insertText')
```
点击：`pointerdown → mousedown → pointerup → mouseup → click`，坐标取 `getBoundingClientRect()` 中心，元素中心被遮挡时改用四角试探。

### 19.4 等待条件

| for | 实现 |
|---|---|
| { text } | MutationObserver + 每 250ms 兜底扫描，匹配可见文本 |
| { selector } | querySelector 轮询 + visible 判断 |
| { urlPattern } | 轮询 location.href |
| { request } | 包一层 fetch/XHR，匹配 URL 且完成 |
| { idle: 500 } | DOM 静默 500ms |

### 19.5 重新附着

```
// 跳转前
sessionStorage['hud.run'] = JSON.stringify({runId, step});
// 新页面 boot
const pending = JSON.parse(sessionStorage['hud.run'] || 'null');
if (pending) POST /attach {runId, url, title} -> {resume, step, macro}
  resume=true  -> 用返回的 macro 从 step 继续执行
  resume=false -> 清理 sessionStorage，上报 failed('attach_rejected')
sessionStorage.removeItem('hud.run') 仅在结束后
```

## 20. cogagent 工具实现

### 20.1 文件与注册

```ts
// packages/core/src/tool/plugin/macro.ts
export const Plugin = {
  id: "opencode.tool.macro",
  effect: Effect.fn(function* (ctx) {
    const flags = yield* Flag.resolver
    yield* ctx.tool.transform((editor) => {
      if (!flags(entries).macro.enabled) return;
      editor.add({ name: "macro_list", options: { namespace: "macro", codemode: true }, ... });
      editor.add({ name: "macro_run",  options: { namespace: "macro", codemode: true }, ... });
      editor.add({ name: "macro_edit", options: { namespace: "macro", codemode: true }, ... });
      editor.add({ name: "macro_delete", options: { namespace: "macro", codemode: true }, ... });
    });
  }),
}
```
模型看到的工具名：macro_list / macro_run / macro_edit / macro_delete（namespace 拍平）。

### 20.2 输入/输出 Schema

| 工具 | Input | Output |
|---|---|---|
| macro_list | { query?: string, scope?: "all"\|"mine"\|"shared" } | { macros: Array<{id,name,version,scope,owner,description}> } |
| macro_run | { id?: string, name?: string, params?: Record<string,string>, count?: int } | { runId, result, steps: Array<{i,action,ok,ms}>, outputs?, error? } |
| macro_edit | { id?: string, name: string, patch?: object, macro?: object } | { id, version, diff } |
| macro_delete | { id?: string, name?: string, hard?: boolean } | { deleted, hard } |

### 20.3 身份与权限

| 项 | 实现 |
|---|---|
| 账号识别 | 进程环境 COGAGENT_ROOT=/srv/cogagent/users/<account> → basename |
| 调用 broker | http://127.0.0.1:18765，头 X-Hud-Account |
| 工具权限 | permission.assert({ action: "macro", resources: [macroId 或 "*"], ...invocation }) |
| 危险步骤确认 | 由 HUD 执行器按会话权限模式判断（工具不重复确认） |
| 失败映射 | macro_busy/hud_not_attached → ToolFailure（可读中文） |

### 20.4 合成消息（用户手动执行 → AI 感知）

```
POST {upstream}/api/session/{sessionID}/synthetic
{
  "text": "【动作执行】新建站点 v3（用户触发）...结果：成功（4.2s）...",
  "description": "macro_run_result",
  "resume": false
}
```
| 项 | 说明 |
|---|---|
| sessionID 来源 | /agent/macro/run 入参（HUD 报告当前会话）；AI 触发时由工具带入 |
| 时机 | 最终结果（ok/failed/cancelled）时发一条，逐步不发 |
| 长度 | ≤ 1500 字符，超长截断 steps 明细 |

## 21. 配置与开关

| 位置 | 键 | 默认 | 说明 |
|---|---|---|---|
| cogagent config | macro.enabled | true | 工具集总开关（flag: macro） |
| cogagent config | macro.brokerUrl | http://127.0.0.1:18765 | broker 地址 |
| cogagent config | macro.requireApply | false | true = AI 编辑需用户点“应用” |
| broker 配置文件 | /var/lib/cogagent-hud/macro.json | 见下 | 服务端默认值 |
| broker 配置文件 | slowMode | true | 慢速模式默认 |
| broker 配置文件 | stepDelayMs | 300 | 每步间隔 |
| broker 配置文件 | runTimeoutMs | 120000 | 单次 run 超时 |
| broker 配置文件 | maxSteps | 50 | 单动作最多步骤 |
| broker 配置文件 | maxMacrosPerOwner | 200 | 单账号动作上限 |

## 22. 数据校验与限额

| 字段 | 规则 |
|---|---|
| id | ^[a-z0-9][a-z0-9-]{1,39}$，唯一 |
| name | 1–40 字符，同 owner 内唯一 |
| steps | 1–50 条；action ∈ DSL 集合 |
| target | 至少含 label/text/placeholder/ariaLabel/testId/selector 之一 |
| value 长度 | ≤ 2000 字符 |
| params | ≤ 20 个；每个 value/template ≤ 500 字符 |
| 文件大小 | 单动作 JSON ≤ 256 KB |
| 审计行 | ≤ 4 KB（超长截断 outputs） |

## 23. 测试计划

| 层 | 文件 | 覆盖 |
|---|---|---|
| 存储单测 | script/hud/test/macro-store-test.sh | 增删改查、版本+1、软删/硬删、审计行格式、校验与限额、并发写 |
| 执行器单测 | script/hud/test/macro-exec-test.mjs | 变量展开（日期/序号/随机）、定位评分、DSL 校验、确认策略矩阵 |
| 桥/接口 | script/hud/test/macro-api-test.sh | 8 个端点（用 mock upstream）+ 错误码 + busy/not_attached |
| 安装回归 | script/hud/test/mock-install-test.sh | 保证新增文件被装到 tools/、桥白名单生效（扩展 3 条断言） |
| 真机 e2e | 手动 | 验收用例 1–11（§14） |

## 24. PR 拆分（可直接开工）

| PR | 内容 | 文件 | 验收 |
|---|---|---|---|
| PR1 | 动作存储 + 校验 + 审计 | common/macro_store.py、test/macro-store-test.sh | 单测全绿 |
| PR2 | broker 8 端点 + SSE 指令 + 合成消息 | common/broker.py、test/macro-api-test.sh | 端点契约测试通过 |
| PR3 | HUD 工具栏 + 执行器（含高亮/慢速/暂停/确认/重新附着） | common/hud.js、hud_proxy.py | 手动跑通“新建站点”动作 |
| PR4 | cogagent 四个工具 + flag/config | tool/plugin/macro.ts、tool/macro-client.ts、schema config/flag | 对话里能 macro_list/macro_run |
| PR5 | 录制器 + AI 编辑落盘 + 文档 | common/hud.js、docs/hud-handover.md | 录制→保存→重放；AI 改动作后版本+1 |

每个 PR 的完成定义：语法检查通过（bash -n / py_compile / node --check / bun typecheck）、相关测试通过、`mock-install-test.sh` 不回归。

## 25. 风险与回滚

| 风险 | 影响 | 缓解 | 回滚 |
|---|---|---|---|
| HUD 执行影响用户页面 | 误点/误填 | 高亮+慢速+暂停；danger 确认 | 关闭宏功能（flag off） |
| 动作与页面漂移 | 执行失败 | 5 级定位回退 + 失败候选清单 | 编辑/重录动作 |
| SSE 断线导致 run 悬挂 | 状态不一致 | deadline + 客户端心跳；超时置 failed | 重启 broker（状态重建） |
| broker 存储损坏 | 动作丢失 | 写临时文件 + 原子 rename；每日备份 | 从备份恢复 macros/ |
| AI 误删动作 | 数据丢失 | 默认软删除 + 版本历史 | 恢复 deletedAt / 回滚版本 |
