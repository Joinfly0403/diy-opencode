# HUD 录制/回放 —— 实现技术文档

> 状态：与 script/hud/common/hud.js（HEAD 7684029af1，3248 行）一致。
> 适用环境：OSSDesign 270 / 272（/opt/cloud/manager/apps/OSSDesignService）。
> 设计稿见 docs/design/hud-actions-toolbar.md（早期设计，以本文为准）。

---

## 1. 组件与数据流

~~~
浏览器（OSSDesign 页面）
  hud.vNN.js  ← 由 app_main.js 的一行 bootstrap 注入
   ├─ 录制器：hook window.fetch / XMLHttpRequest
   ├─ 执行器：execMacro() 逐步执行 steps[]
   └─ 轮询：每 1.5s 拉 /hud/macro/pending
        │ 同源 HTTPS（带 session / roarand）
        ▼
  hud_proxy.py（OSSDesign 内 Tornado 桥）
   前缀 /rest/ossdesign/v1/designer/hud/*，注入 X-Hud-Web-User
        │ http://127.0.0.1:18765
        ▼
  broker.py（systemd: cogagent-hud-broker）
    ├─ 宏/运行记录 → macro_store.py（JSON 落盘）
    ├─ 待执行队列 → MACRO_PENDING
    └─ cogagent serve 实例（AI 对话，宏执行不依赖它）
~~~

- 宏执行不经过 AI，是纯 HTTP + DOM 动作的确定性回放。
- 页面只与同源桥通信；浏览器不需要知道 18765。
- 归属隔离：网页账户（X-User-Name）→ X-Hud-Web-User，各看各的宏。

---

## 2. 存储布局（服务器）

~~~
/var/lib/cogagent-hud/
├─ macros/index.json                 轻量索引（列表用）
├─ macros/<owner>/<macro-id>.json    宏全文（steps + 元数据）
├─ runs/<owner>/<yyyy-mm>.jsonl      每轮一行（含每步结果）
├─ runs/<owner>/<yyyy-mm>.api.jsonl  每次接口一行（req/res，4000 字符）
└─ pins.json                         元素定位缓存
~~~

- broker 日志：/var/log/cogagent-hud/broker.log
- 安装目录：/opt/cloud/manager/tools/cogagent-hud/

---

## 3. 数据模型

### 3.1 宏

~~~json
{
  "id": "rec-mwugyppj",
  "name": "建站-272",
  "description": "录制于 https://.../ossdesign",
  "owner": "z30048462",
  "steps": [ ... ]
}
~~~

限制（macro_store.LIMITS）：steps ≤ 50、params ≤ 20、单值 ≤ 2000 字符、宏 ≤ 256 KB、每 owner ≤ 200 个。

### 3.2 运行记录

| 字段 | 说明 |
|---|---|
| runId | run_<yyyymmddHHMMSS>_<6 位随机> |
| macroId / macroName | 来源宏 |
| owner | 网页账户 |
| startedAt / finishedAt | 时间 |
| result | running / ok / failed / cancelled |
| failedStep / error | 失败定位 |
| steps[] | 每步 {action, endpoint, ms, ok, req(≤600), res(≤300), error} |

> 单步排查优先看 .api.jsonl：req/res 保留 4000 字符，不被步级截断。

---

## 4. 动作 DSL

### 4.1 动作类型

| action | 关键字段 | 语义 |
|---|---|---|
| api | method, endpoint, payload, query, headers, as, save | 发请求；as 存响应，save 按路径提取多个值 |
| lookup | endpoint, payload, from, where, pick, as | 查询列表，严格匹配取 pick，写入 as |
| assertList | endpoint, payload, from, where | 断言列表中存在匹配行 |
| assertField | endpoint, payload, pick, nonEmpty, equals | 断言某路径字段非空/等于期望 |
| reload | — | location.reload()，让前端重新拉树 |
| click | target, candidates | 点击元素（含候选回退） |
| fill | target, value | 写输入框（React 安全 setter） |
| select / choose | target, value | 原生 select / 自定义下拉 |
| press | target, key | 派发键盘事件 |
| wait | wait.{selector,text,timeout} | 等待条件 |
| read | target, as | 读文本/值存入 outputs |
| verify | target, expect | 断言元素状态 |
| refresh / sleep | wait / ms | 等待类 |

### 4.2 内置占位符

| 占位符 | 展开值 | 说明 |
|---|---|---|
| {{date}} | 20261124 | |
| {{time}} | 143252 | |
| {{stamp}} | 20261124143252 | |
| {{shortstamp}} | 261124143252 | 12 位含秒；名称类字段默认追加 _短戳 |
| {{datetime}} | 20261124-143252 | |
| {{seq:n}} / {{rand:n}} | 序号 / 随机 hex | |
| {{参数名}} | 宏 params 的值 | |
| {{键}} | outputs 里的值 | save / lookup.as / read.as 产生 |
| {{s5.data.x}} | 第 5 步响应字段 | 录制时自动生成 |
| {{s13.Products[0].product}} | 支持数组下标 | 见 §6.2 |

时间戳在一次执行内冻结（CLOCK_FREEZE_V1）：所有占位符取执行开始那一刻。
原因：旧实现每步各取一次 new Date()，跨秒会让 createPrj 建的名字与 lookup 查的名字差 1 秒。

### 4.3 命名规则

- 后端 is_invalid_name：0~32 位，允许字母/数字/_/-（前端要求 1~32 且不含反斜杠）。
- 项目名全局唯一；站点名项目内唯一。
- 录制自动改写：基础名截断到 19 位 + _ + 12 位短戳 = 32。

---

## 5. 录制流程（stopRecord）

1. recApiSteps()：hook 到的请求转成 api 步骤（跳过 /hud/* 自身轮询）。
2. 名称加时间戳：payload 键名含 project/prj/site + name 的字符串 → 基础名_{{shortstamp}}。
3. recCorrelate()：用上游响应值反查下游 payload，生成 {{sN.path}}；id 类字段不受长度≥3 限制。
4. recAutoLookup()：createPrj 后插 lookup（按 name 精确匹配）；createSite 响应带 id 时写 save:{site_id:id}，否则插 querySiteLst lookup。
5. recExistingSites()：操作已有站点（site_id ≠ 新站点 id）时按 id 反查站点名，替换为 {{target_site_id}} 并在最前面插 lookup。
6. recSyncLookupNames()：所有 lookup.where.text 强制同步为最终 payload 值。
7. 插 assertList（站点挂在该项目下）与 assertField（querySiteAttr.site[0].context 非空）。
8. 末尾追加 reload。

录制时跳过的纯展示接口：querySiteParam、querySiteCusInfo、getStorageSpace、getDetailInfo、getRouteInfo_Net。
querySiteAttr 不跳过——它是唯一能验证内容是否落库的查询。

---

## 6. 执行流程（execMacro）

### 6.1 并发与僵死处理

- /macro/run 返回 macro_busy 时：每 2s 重试，最多 30 次（60s）；每 5 次调 cancel {onlyStale:true, minIdle:10}。
- broker 在 /macro/run 前释放 >20s 未更新的运行（页面刷新/关闭导致的僵死）。
- 仍占用时提示「点 ■ 停止执行 强制释放」。

### 6.2 占位符解析

- 路径支持 名字 与 [n]：Products[0].product、PortGrps[1].IpType。
- 解析不到时：早期版本原样保留（后端收到 {{...}} → 500）；现在发请求前检查，命中直接抛错：
  占位符未解析：{{s13.Products[0].product}} @ <endpoint>

### 6.3 业务成败判定

| retMsg | 含义 | 处理 |
|---|---|---|
| OK | 成功 | 继续 |
| NA | 无需变更（modifyVnfNameSiteAttr 正常路径） | 视为成功 |
| ERROR / Error | 失败 | 抛错，附 errorMsg |
| 无 retMsg | 兜底看 code/retCode/status/success | — |

HTTP 非 2xx 时错误信息带 | req=<请求体前 400 字符>（ERR_REQ_V1）。

### 6.4 lookup 规则

- where 每键 String 比较，空白归一化。
- 多命中取 pick 数值最大者。
- 未命中重试 3 次（700ms），仍失败报错并附「列表前 12 项」。
- as/pick 以 _id 结尾时值必须为数字，否则报「lookup 得到非数字 id」。

### 6.5 落库断言

| 断言 | 生成时机 | 失败含义 |
|---|---|---|
| assertList querySiteLst {id:{{site_id}}, pid:{{project_id}}} | createSite 之后 | 站点没挂到项目 |
| assertField querySiteAttr site.0.context 非空 | modifySiteAttr 之后 | 基础配置没写进库 |

---

## 7. 接口

- 桥（同源）：/rest/ossdesign/v1/designer/hud/macro/{list,get,save,delete,run,result,pending,runs,whoami,cancel,pin,pins}
- broker（127.0.0.1:18765）：/agent/macro/{list,get,save,delete,run,result,pending,runs,cancel,pin}；另有 /agent/{sessions,prompt,events,models,...}。
- run 返回 {runId}；HUD 轮询 pending 取指令，逐步回传 result。

---

## 8. 安装 / 升级 / 回滚

~~~bash
# 执行用户：root
rm -rf /root/hud-bundle && mkdir -p /root/hud-bundle
tar -xzf /root/cogagent-hud-bundle.tgz -C /root/hud-bundle
cd /root/hud-bundle && bash common/install-all.sh 2>&1 | tail -8
systemctl restart cogagent-hud-broker
~~~

install-all.sh 开关：--check（体检）、--patch-launcher、--cogagent-pkg=x.run --yes-wipe、--restore=latest、--list-backups、--no-restart-oss、--keep。

装完确认浏览器加载了新文件：

~~~bash
A=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
W="$A/webapps/ossdesignwebsite/osmuwebsite_app"
grep -o 'hud[^\"]*\.js' "$W/app_main.js" | sort -u
ls -l "$W"/hud*.js
~~~

手工复制文件后必须补：chown ossadm:ossgroup "$W"/hud*.js && chmod 0640 "$W"/hud*.js
否则 ossadm 读不到 → 404 → COG 球消失。

页面 Console 出现 [hud] build <时间> 才说明新文件生效。

---

## 9. 排障

| 现象 | 原因 | 处理 |
|---|---|---|
| 一直「等待中（n/30）」 | 上一轮僵死（运行中刷新过页面） | 点 ■ 停止执行，或 curl -X POST /agent/macro/cancel -d '{"note":"manual"}' |
| lookup 未找到匹配项…；列表前 12 项=… | 名字不一致 / 项目没建成 | 对照 createPrj.req 与列表 |
| 占位符未解析：{{s13.…}} | 引用未执行步骤或路径错 | 确认该步为 api 且 as=s13 |
| API … -> 500 … | req=… | 后端缺参数校验（未知 hardware_type 等） | 按 req 校正 payload |
| retMsg=ERROR | 业务失败（重名/非法名/缺参） | 看 errorMsg |
| COG 球消失 | bootstrap 指向的文件不可读 | 检查属主/权限 |
| 图标不显示 | 旧文件 / SVG 被 CSP 拦 | 确认 build 行；现用 DOMParser 建节点 |

---

## 10. 已知缺口

| # | 缺口 | 影响 |
|---|---|---|
| 1 | 快照/实时两种模式未实现 | modifyNETAttr/modifyStorage 用录制快照，换产品/规划会错 |
| 2 | 参数化与批量未实现 | 一次只能 1 项目 + 1 站点 |
| 3 | 网络/存储无落库断言 | 失败可能延后暴露 |
| 4 | 步骤上限 50 | 「建站+扩容」已 40 步 |
| 5 | 无断点续跑 | 失败即整轮中止 |
| 6 | 无运行历史 UI | 只能查服务器日志 |
| 7 | target_site_id 只按站点名匹配 | 跨项目同名会取 id 最大者 |
| 8 | 无宏导入/导出/复制 | 只有运行与删除 |

---

## 11. 关键标记索引

CLOCK_FREEZE_V1、CORRELATE_ID_V1、REC_LOOKUP_V1、LOOKUP_NAME_SYNC_V1、EXISTING_SITE_V1、ASSERTSITE_V1、ASSERTSITEATTR_V1、ASSERT_LIST_V1、ASSERT_FIELD_V1、LOOKUP_MAX_ID_V1、LOOKUP_NUMERIC_V1、API_BIZ_V2、API_V3、UNRESOLVED_V1、ERR_REQ_V1、REPLACE_SCALAR_V1、POP_HOVER_V1、ICON_DOM_V1。
