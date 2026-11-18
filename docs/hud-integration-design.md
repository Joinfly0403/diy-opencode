# OSSDIY 页面 AI 悬浮窗 — 开发规格书（v6）

> 日期：2026-11-17
> 依据：**仅本会话内产生的证据**（两份现场取证报告 + 本会话中直接读取的源码）。
> 未在本会话出现过的内容一律标为「未确认」，不写进设计。
> 阅读顺序：第 3 节证据索引 → 第 5~9 节（可直接照着写代码）→ 第 11 节验收。

---

## 0. 本文档怎么用

| 角色 | 需要看 |
|---|---|
| 写 broker 的人 | 第 3、5、6、7 节 |
| 写桥（OSSDesign Python）的人 | 第 3、6、8 节 |
| 写 HUD（前端）的人 | 第 3、6.4、9 节 |
| 部署/运维 | 第 10 节 |
| 验收/测试 | 第 11 节 |

---

## 1. 术语（全文严格区分，禁止混用）

| 术语 | 定义 | 来源（本会话证据） | 决定什么 |
|---|---|---|---|
| **OSSDIY 前端账户** | 登录 OSSDIY 页面的平台身份 | hiro 按 cookie `roarand` 校验会话，并注入 `X-User-Name`（取证报告①Q6-a/Q6-b/Q6-c） | **仅**决定能否访问 `https://oss.PMS.com:6701` 与 `/rest/ossdesign/v1/...` |
| **cogagent 账号** | cogagent 自己 SSO 登录后返回的 `userAccount` | `/usr/local/bin/cogagent:162-167`：`return {"account": data.get("userAccount")}`（取证报告②Q2-a2） | 决定数据目录、端口、实例、该实例内的全部会话 |

**两者没有映射关系。**

---

## 2. 决策记录（含被推翻的方案，避免后人重走）

| # | 决策 | 依据 | 被推翻的旧方案 |
|---|---|---|---|
| D1 | 桥（OSSDesign 内）**不读取** `X-User-Name` | 用户明确要求"不要把 X-User-Name 和 cogagent 绑定" | 曾用 `crc32(X-User-Name)%20000` 推端口 |
| D2 | 隔离键 = **cogagent 账号** | 目录/端口/锁都由 `account` 决定（取证报告②Q1-a/Q1-d/Q3-c） | 曾错误外推为"全机一份会话列表" |
| D3 | 同 **cogagent 账号** 多窗口登录：**允许**，不互踢 | 认证是逐请求 Basic，同凭据 3 路并发全 200（取证报告②Q1-f） | 曾考虑按账号独占 handle |
| D4 | 会话与 OSSDIY 业务**零绑定**，请求体不带 siteID/projectID | 用户明确要求 | 曾设计"一站点一会话 + metadata" |
| D5 | 会话数量由**前端**决定，可任意多个并行 | prompt 投递即返回（16–22 ms，取证报告②Q4-b） | 曾设计"一浏览器一会话" |
| D6 | broker 必须 root | `service-local.json` 为 `0600 root:root`（取证报告②Q5-a） | 曾想让桥直接读凭据 |
| D7 | 桥不读文件、不持凭据，只做转发 | 桥不读文件、不持凭据，运行 UID 与设计无关 | — |
| D8 | 不做会话清理、不做提权工具 | 用户明确要求 | 曾设计 TTL 与 sudo 工具 |
| D9 | 一条 SSE 多路复用，前端按 `sessionID` 分发 | SSE 是实例级事件流（取证报告①Q12-a） | 曾设计"每会话一条 EventSource" |

---

## 3. 证据索引（每条都可回查）

### 3.1 部署与链路

| ID | 结论 | 证据 |
|---|---|---|
| E01 | 浏览器入口是 `https://10.44.228.181:6701/`，根路径 302 到 `/eviewwebsite/index.html#path=/plat/ossdesign/v1/home` | 取证①Q1-c、`pub/febs.json:11` |
| E02 | 入口证书 SAN 只有 `DNS:oss.PMS.com`，无 IP SAN → 用户地址栏是域名 | 取证①Q1-d |
| E03 | `/rest/ossdesign/v1/...` 先被 hiro 拦截：无会话 → 302 `/unisess/v1/auth`，头 `x-hiro-trace-err-code: check session: session fail response` | 取证①Q2-a、Q6-c |
| E04 | OSSDesign 主服务只监听 `127.0.0.1:25909`（TLS1.3），另有 IR `32038` | 取证①Q2-b、Q2-c |
| E05 | 32038=hiro-IR；32080=Zenith DB；32090/32091=Redis；浏览器不直连它们 | 取证①Q3-a、Q3-b、Q3-e |
| E06 | 接入层是平台自研 hiro（`MCHIROERService` pid 34181），无 nginx/haproxy/httpd | 取证①Q4-a、Q4-b |
| E07 | 静态资源由 OSSDesign 自身提供，路由 `@rest.get('(.+)$')`，访问日志里可见 `GET plugin/hud.js 200` | 取证①Q2-d、Q2-e、`interface/static_file_server.py:88-91` |
| E08 | 白名单前缀 `/rest/ossdesign/v1/designer` 已放行（`!` 表示需登录） | 取证①Q17-a |
| E09 | 新前缀必须改 `pub/app_define.json` + `ossdesignservice_microservice.yaml` 并需平台放行；同一前缀内新增接口不需要 | 取证①Q17 |
| E10 | 升级为版本目录整体替换，盘上只有当前版本目录 | 取证①Q15-a、Q15-b |
| E11 | `post_install.sh` 只做 chmod 与开源库拷贝，不碰 `webapps/` | 取证①Q16-b |
| E12 | `webapps` 目录 `root:root drwxr-x---`，文件 `-rw-r-----`；当前 shell uid=0 可写 | 取证①Q7-a、Q7-b |
| E13 | 静态资源带 query 参数会 500（框架把 query 当 kwargs 展开） | 取证①Q5-d 附注、`static_file_server.py:90-109` |
| E14 | 平台响应头含 `x-frame-options: SAMEORIGIN`；登录页 CSP `script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self'` | 取证①Q5-b、Q5-c |
| E15 | 应用页（已登录）CSP **未取到**（验证码阻断） | 取证①Q5-a、Q6-d |
| E16 | 前端可稳定拿到 `window.common.csrfToken` / `userName`，业务代码已在用 `roarand: window.common.csrfToken` | 取证①Q8-a、Q8-b |

### 3.2 cogagent

| ID | 结论 | 证据 |
|---|---|---|
| E20 | 包装层 SSO 登录是**轮询**：`POST /oauth/getToken`，每 `pollSeconds` 一次，最长 `loginSeconds`（默认 300 s）；全文件唯一 stdin 读取在锁冲突分支 | 取证②Q2-a、Q2-a2；`cogagent:118,146-171` |
| E21 | 登录返回 `{accessToken, refreshToken, expiresAt(+3d), account:userAccount}` | `cogagent:162-167` |
| E22 | 登录完成后唯一出口是 `sandbox()` → `setpriv … bash -c <CORE_CMD>`，默认 exec TUI；**无 serve 分支** | `cogagent:315-324,375-376`；`grep serve` 零命中 |
| E23 | 单实例锁：`flock(LOCK_EX|LOCK_NB)` 于 `<账号目录>/.instance.lock`；拿不到锁时交互询问 y/N，默认取消 | `cogagent:94-108,111-123` |
| E24 | 登录发生在抢锁**之前** | `cogagent:332,339` |
| E25 | 端口 `41000 + crc32(account) % 20000`，实测 `z30048462 → 50461` 与监听一致 | `cogagent:258-260`；取证②Q1-d |
| E26 | 启动前执行 `service stop` 与 `service set port <port>` | `cogagent:263-272` |
| E27 | 每账号独立目录：`/srv/cogagent/users/<account>/{config,state,cache,share,logs,tmp}` + `.instance.lock` | `cogagent:333,349-357`；取证②Q3-c |
| E28 | 凭据 `state/cogagent/service-local.json`：`{id,version,url,pid,password}`，`0600 root:root`，`url` 与监听端口一致 | 取证②Q3-a |
| E29 | 认证是 **HTTP Basic**，用户名固定 `opencode`；无凭据 401；同凭据可并发 | 取证②Q1-f、Q13-a |
| E30 | 138 个 `/api/*` 路径，来源是服务自带 `/openapi.json` | 取证①Q11-b |
| E31 | 会话：`GET /api/session`、`GET /api/session/{id}`、`GET /api/session/{id}/message`、`POST /api/session/{id}/prompt` 均可用 | 取证①Q14-a~d |
| E32 | prompt 投递即返回（16–22 ms，200），执行异步；忙状态由 `/api/session/active` 的 `type=running` 表达 | 取证②Q4-b |
| E33 | `GET /api/session` 是实例级全局列表，与连接无关 | 取证②Q4-a |
| E34 | 未发现任何并发/限流配置；`/api/experimental/usage/limits` 返回 `data:null` | 取证②Q4-c |
| E35 | SSE：`GET /api/event`，`text/event-stream` + chunked，首帧 `data: {"id":"evt_…","type":"server.connected","data":{}}`，随后 `: heartbeat` | 取证①Q12-a |
| E36 | systemd 可用，当前无 cogagent unit | 取证②Q5-c |
| E37 | 服务注册文件由 CLI 写入（`mode:0o600`，含 password） | 源码 `packages/cli/src/services/service-registration.ts:29-40` |
| E38 | 独立服务以 `serve --stdio --port 0` 启动，凭据通过 `OPENCODE_PASSWORD` 传递，Basic 用户名 `opencode` | 源码 `packages/cli/src/services/standalone.ts:17-33,53` |
| E39 | `serve` 支持 `--hostname --port --cors --service --stdio` | 取证①Q9-b |
| E40 | 框架：servant 线程池 10；`idle_connection_timeout=200`、`body_timeout=60`；servant 一次性 `finish()` 无流式；`add_handlers` 可挂 raw handler | 取证①§1.4/§3.5、`ossdiyservice.py:80-82` |

### 3.3 协议（本会话直接读源码得到）

| ID | 结论 | 证据 |
|---|---|---|
| E50 | `POST /api/session` 载荷：`id?, parentID?, title?, agent?, model?, location?, metadata?, permissions?` | `packages/protocol/src/groups/session.ts:165-176` |
| E51 | `POST /api/session/:sessionID/prompt` 载荷 = `{text, files?, agents?, skills?}` | `session.ts:337-341`、`packages/schema/src/prompt-input.ts:25-30` |
| E52 | 审批回复：`POST /api/session/:sessionID/permission/:requestID/reply`，载荷 `{decision:"once"|"always"|"reject", message?}` | `groups/permission.ts:142-147`、`schema/src/permission.ts:42` |
| E53 | `GET /api/event` 契约原文：「Volatile by contract: a slow consumer overflows and fails the stream, and events during disconnection are missed.」 | `groups/event.ts:61-70` |
| E54 | 事件类型共 65 个（清单见附录 A） | `packages/schema/src` 内 `type: "…"` 去重统计 |

---

## 4. 系统架构

### 4.1 链路

```
浏览器（https://oss.PMS.com）
  │  只访问 6701（E01/E02）
  ▼
hiro-ER :6701            校验 OSSDIY 前端账户（cookie roarand），注入 X-User-Name（我们不用）
  │                      失败 → 302 /unisess/v1/auth（E03）
  ▼
OSSDesign 127.0.0.1:25909（TLS，仅回环，E04）
  ├── 静态  /ossdesignwebsite/plugin/hud/*        ← HUD 前端（E07）
  └── 桥    /rest/ossdesign/v1/designer/hud/*     ← 已在放行前缀内（E08/E09）
        │  http，仅回环
        ▼
  broker 127.0.0.1:18765（root，systemd）
        │  HTTP Basic: opencode:<password>（E29）
        ▼
  cogagent serve 127.0.0.1:<41000+crc32(cogagent 账号)%20000>（E25）
```

### 4.2 组件职责

| 组件 | 运行身份 | 做 | 明确不做 |
|---|---|---|---|
| HUD | 浏览器 | 会话列表、对话、审批、登录引导 | 不直连 agent、不持凭据 |
| 桥 | OSSDesign 进程 | 转发、SSE 透传、错误映射 | 不读 `X-User-Name`、不读文件、不存状态、不管登录 |
| broker | root（`0600` 才能读，E28） | 登录、按 cogagent 账号起停实例、持凭据、代理 agent API | 不存会话、不做业务 |
| cogagent serve | root（现网实测，E27） | 执行 | — |

---

## 5. 身份、隔离、handle

### 5.1 隔离键

唯一隔离键 = **cogagent 账号**（E21 的 `account`）。

| 载体 | 取值 | 证据 |
|---|---|---|
| 数据目录 | `/srv/cogagent/users/<cogagent 账号>/` | E27 |
| 端口 | `41000 + crc32(<cogagent 账号>) % 20000` | E25 |
| 锁 | `<目录>/.instance.lock`（flock） | E23 |
| 凭据 | `<目录>/state/cogagent/service-local.json` | E28 |

### 5.2 handle 规格

| 项 | 规格 |
|---|---|
| 生成 | 登录成功且实例可访问后，broker 生成 32 字节随机数，base64url 编码（43 字符，与现网 password 长度无关，仅同格式） |
| 绑定 | `handle → {agentAccount, port, password, createdAt, lastSeenAt}` |
| 传递 | 请求头 `X-Hud-Handle` |
| 存储 | 内存 + `/var/lib/cogagent-hud/handles.json`（`0600 root`），进程重启后恢复 |
| 有效期 | 不过期；收到上游 401 时标记 `invalid` |
| 注销 | `POST /logout` 删除该 handle（不杀实例） |

### 5.3 四种组合（决策 D2/D3）

| OSSDIY 前端账户 | cogagent 账号 | 结果 |
|---|---|---|
| 任一 | `z3001` | 实例 50461，会话表 A |
| 任一 | `z3002` | 实例 crc32(z3002) 端口，会话表 B |
| 两个不同前端账户 | 同一个 `z3001` | **复用实例**，共享会话表 A（允许） |
| 同一个前端账户 | 先后两个 cogagent 账号 | 两个 handle，各自实例，互不可见 |

---

## 6. cogagent 接口参考（实测）

### 6.1 建立连接

```bash
PORT=50461
PW=$(/usr/local/lib/cogagent/cogagent service get password)   # 43 字符（E28/E29）
curl -s -u "opencode:$PW" http://127.0.0.1:$PORT/api/session
```

- 无凭据 / 错密码 → 401（E29）
- 服务只绑回环（E04 同类，cogagent 侧为 `127.0.0.1:50461`）

### 6.2 本方案会用到的端点

| 用途 | 方法 | 路径 | 请求体 | 说明 |
|---|---|---|---|---|
| 列会话 | GET | `/api/session` | — | 实例级全局（E33） |
| 会话详情 | GET | `/api/session/{sessionID}` | — | |
| 历史消息 | GET | `/api/session/{sessionID}/message` | — | |
| 新建会话 | POST | `/api/session` | `{title?}`（完整字段 E50） | |
| 发消息 | POST | `/api/session/{sessionID}/prompt` | `{text}`（完整字段 E51） | 立即返回（E32） |
| 忙状态 | GET | `/api/session/active` | — | `{[sessionID]:{type:"running"}}`（E32） |
| 审批列表 | GET | `/api/session/{sessionID}/permission` | — | |
| 审批回复 | POST | `/api/session/{sessionID}/permission/{requestID}/reply` | `{decision:"once"|"always"|"reject"}`（E52） | |
| 中断 | POST | `/api/session/{sessionID}/interrupt` | `{}` | 实测路由存在（E31 同族） |
| 事件流 | GET | `/api/event` | — | SSE（E35） |

### 6.3 响应示例（取证原文）

```json
GET /api/session →
{"data":[{"id":"ses_e3b1353e5ffeyCeKCkh40Tfkr2",
          "projectID":"9414a850059dbb106583f5e5854c69fee5970a26",
          "agent":"build","model":{"id":"deepseek-v4.1-flash-1017","providerID":"cac"},
          "cost":0,"tokens":{...}}]}
```

```json
POST /api/session/{id}/prompt  body={} →
400 {"_tag":"InvalidRequestError","message":"Missing key\n  at [\"text\"]","kind":"Payload"}
```

```text
POST /api/session/{id}/prompt  body={"text":"…"} →
{"data":{"id":"msg_…","sessionID":"ses_…","type":"user","payload":{"text":"…"},"delivery":"st…"}}
```

### 6.4 SSE 帧格式（E35）

```text
HTTP/1.1 200 OK
cache-control: no-cache, no-transform
content-type: text/event-stream
Transfer-Encoding: chunked

data: {"id":"evt_1e9825990001…","type":"server.connected","data":{}}

: heartbeat
```

**契约警告**（E53）：消费者变慢会导致流被丢弃；断线期间事件会丢。

事件类型清单见附录 A（65 个）。

---

## 7. broker 规格

### 7.1 进程模型

- 独立进程，root，systemd 托管，仅监听 `127.0.0.1:18765`
- 单进程管理 N 个 cogagent 实例（每个 cogagent 账号一个）
- 状态重启可恢复：`handles.json` + 实例健康检查

```ini
# /etc/systemd/system/cogagent-hud-broker.service
[Unit]
Description=cogagent HUD broker
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/cloud/manager/tools/cogagent-hud/broker.py --port 18765
Restart=on-failure
RestartSec=3
User=root
Group=root
StandardOutput=append:/var/log/cogagent-hud/broker.log
StandardError=append:/var/log/cogagent-hud/broker.log

[Install]
WantedBy=multi-user.target
```

### 7.2 数据结构

```json
// /var/lib/cogagent-hud/handles.json  (0600 root)
{
  "handles": {
    "H-9f2k…": {"agentAccount":"z3001","port":50461,"createdAt":"…","lastSeenAt":"…","state":"ready"}
  },
  "instances": {
    "z3001": {"pid":7842,"port":50461,"state":"ready","startedAt":"…"}
  }
}
```

ticket（登录会话）只放内存：

```text
ticket -> {state, url, proc, deadline, agentAccount?, handle?, reason?}
```

### 7.3 状态机

| 状态 | 进入条件 | 允许的下一步 | 超时 |
|---|---|---|---|
| `idle` | 初始 / logout | → pending | — |
| `pending` | POST /login/start 成功起登录进程 | → serving（拿到 account）/ failed | 300 s（E20） |
| `serving` | 已拿到 account，正在起/复用实例 | → ready / failed | 60 s（启动+注册） |
| `ready` | 实例 200 | → idle（logout）/ invalid（401） | — |
| `failed` | 任一步失败 | → idle（重试） | — |

### 7.4 实例管理规则

| 事项 | 规则 | 依据 |
|---|---|---|
| 启动命令 | `serve --service --port <port>`，环境变量按 7.5 注入 | E39、E22（需新增 serve-only，见 7.6） |
| 谁持锁 | **broker 进程**持有 `<目录>/.instance.lock` 的 flock | E23 |
| 同账号重复登录 | 复用现有实例，只发新 handle | D3 |
| 不同账号 | 各起一个进程，端口/目录/锁天然不同 | E25/E27 |
| 凭据 | 启动后读 `service-local.json`（0600） | E28 |
| 健康检查 | `GET /api/session` 返回 200 即就绪 | E29/E31 |
| 异常退出 | systemd 不托管实例，由 broker 在下次请求时检测并重启（重启后需重新读凭据） | — |
| 空闲回收 | **不做** | D8 |
| 上限 | 配置 `maxInstances`，超出返回 503 并在 HUD 提示 | 资源考虑（每实例 200–460 MB，本会话早前实测） |

### 7.5 启动实例时的环境变量（照现网取值）

```text
COGAGENT_SERVE_ONLY=1
COGAGENT_ROOT=<rootBase>/<cogagent 账号>
XDG_CONFIG_HOME=<root>/config
XDG_DATA_HOME=<root>/share
XDG_STATE_HOME=<root>/state
XDG_CACHE_HOME=<root>/cache
TMPDIR=<root>/tmp
OPENCODE_SERVICE_PORT=<port>
```

依据：`cogagent:333,349-361`（E27）。

### 7.6 cogagent 需要新增的 serve-only 分支

位置：`/usr/local/bin/cogagent`，在 `:375` 之前。

```python
if os.environ.get("COGAGENT_SERVE_ONLY") == "1":
    os.execvpe(binary, [binary, "serve", "--service", "--port", str(port)], env)
```

| 前置条件 | 说明 | 依据 |
|---|---|---|
| 已完成登录 | `token` 在 env 里（CONFIG_CONTENT 注入） | E21 |
| 已 `service stop` + `service set port` | 沿用 `cogagent:263-272` | E26 |
| 锁 | 由 broker 持有，不进 exec | E23 |
| 注册与密码 | `serve --service` 自行注册并写 `service-local.json` | E37（同类实现） |

> 未确认：`serve --service --port` 是否一定写 `service-local.json`。M1 必须先验证（13.1）。

### 7.7 登录子进程协议

```text
broker 启动：env COGAGENT_SERVE_ONLY=0 的 /usr/local/bin/cogagent（普通登录路径）
stdout 中出现 URL 行（正则：^https?://.+oauth2/authorize.+$）→ 记录 url，状态置 pending
等待子进程退出或超时 300 s
子进程退出码 0 且其写出的临时文件含 account → 用该 account 继续
```

实现建议：包装层不落盘 account。两种可行做法（M1 二选一验证）：

| 做法 | 说明 | 风险 |
|---|---|---|
| A. broker 自己实现轮询 | broker 直接调 `/oauth2/authorize` 生成 URL，再用 `/oauth/getToken` 轮询（完全照 `cogagent:125-172`） | 需要 broker 知道 `cac.json` 的 `apiBase/authBase/clientId` 等字段（`/etc/cogagent/cac.json`） |
| B. 让包装层输出 account | 在 serve-only 分支打印 `COGAGENT_LOGIN_ACCOUNT=<account>`，broker 解析 stdout | 需改包装层（本就要改 serve-only） |

**推荐 B**：改动集中在一个文件，且复用现有登录逻辑（E20/E21）。

### 7.8 接口定义（broker）

| # | 方法 | 路径 | 鉴权 | 请求 | 成功响应 | 错误 |
|---|---|---|---|---|---|---|
| 1 | GET | `/status` | 无 | — | `{instances:[{agentAccount,port,state}],count}` | — |
| 2 | POST | `/login/start` | 无 | — | `{ticket,url,expiresIn:300}` | 503（已有登录进行中） |
| 3 | GET | `/login/status` | 无 | `?ticket=` | `{state,url?,agentAccount?,handle?,reason?}` | 404（ticket 不存在） |
| 4 | POST | `/login/cancel` | 无 | `{ticket}` | `{state:"idle"}` | 404 |
| 5 | POST | `/logout` | handle | `{handle}` | `{state:"idle"}` | 404 |
| 6 | GET | `/agent/sessions` | handle | — | 透传 agent | 401/502 |
| 7 | POST | `/agent/session` | handle | `{title?}` | 透传 | 401/502 |
| 8 | GET | `/agent/messages` | handle | `?sessionID=` | 透传 | 401/502 |
| 9 | POST | `/agent/prompt` | handle | `{sessionID,text}` | 透传 | 401/502 |
| 10 | POST | `/agent/reply` | handle | `{sessionID,requestID,decision}` | 透传 | 401/502 |
| 11 | POST | `/agent/interrupt` | handle | `{sessionID}` | 透传 | 401/502 |
| 12 | GET | `/agent/events` | handle | — | SSE 透传 | 401/502 |

错误码约定：

| 码 | 含义 | HUD 行为 |
|---|---|---|
| 401 | handle 无效 / 上游 401 | 清除 handle，提示重新登录 |
| 404 | ticket/handle 不存在 | 回到 idle |
| 409 | 同账号登录进行中（可选） | 提示"正在登录中" |
| 503 | 实例不可用 / 达上限 | 提示稍后重试 |
| 502 | 上游异常 | 展示错误摘要 |

---

## 8. 桥规格（OSSDesign 内）

### 8.1 位置与注册

| 项 | 值 | 依据 |
|---|---|---|
| 前缀 | `/rest/ossdesign/v1/designer/hud` | 已在 patterns 内（E08） |
| 代码文件 | `pyscript/ossdesign/interface/hud_proxy.py` | 与 `designer.py` 同级（E07） |
| 注册 | 短接口用 servant 加入 `application_map`；SSE 用 `add_handlers` | E40 |

```python
# ossdiyservice.py 内（照 :80-82 的先例）
from ossdesign.interface.hud_proxy import HudProxy, HudSseHandler
application_map["hud_proxy"] = HudProxy()
rest.G_APPLICATION.add_handlers(r".*", [
    (r"/rest/ossdesign/v1/designer/hud/events", HudSseHandler),
])
```

### 8.2 桥的硬约束（可 review）

```python
# 禁止出现以下内容（CI 用 grep 卡）
#   headers.get("X-User-Name")
#   open("/srv/cogagent
#   import ossdesign.domain
```

校验命令：

```bash
grep -nE 'X-User-Name|/srv/cogagent|ossdesign\.domain' \
  ${APP_ROOT}/pyscript/ossdesign/interface/hud_proxy.py && echo "FAIL" || echo "OK"
```

### 8.3 桥接口映射

| 桥 | broker | 超时 | 说明 |
|---|---|---|---|
| GET `/hud/ping` | 自身 + `/status` | 2 s | 返回 `{bridge:true,broker:bool}` |
| GET `/hud/status` | `/status` | 5 s | |
| POST `/hud/login/start` | `/login/start` | 10 s | |
| GET `/hud/login/status` | `/login/status` | 5 s | HUD 每 2 s 轮询 |
| POST `/hud/login/cancel` | `/login/cancel` | 5 s | |
| POST `/hud/logout` | `/logout` | 5 s | |
| GET `/hud/sessions` | `/agent/sessions` | 15 s | |
| POST `/hud/session` | `/agent/session` | 30 s | |
| GET `/hud/messages` | `/agent/messages` | 30 s | |
| POST `/hud/prompt` | `/agent/prompt` | 30 s | |
| POST `/hud/reply` | `/agent/reply` | 15 s | |
| POST `/hud/interrupt` | `/agent/interrupt` | 15 s | |
| GET `/hud/events` | `/agent/events` | 无限 | raw handler |

### 8.4 SSE handler 骨架（Tornado）

```python
# hud_proxy.py
import base64, json, tornado.httpclient, tornado.web

class HudSseHandler(tornado.web.RequestHandler):
    async def get(self):
        handle = self.request.headers.get("X-Hud-Handle")
        if not handle:
            self.set_status(401); return
        base, auth = broker_agent_endpoint(handle)   # 访问 broker，取端口与密码
        if not base:
            self.set_status(401); return
        self.set_header("Content-Type", "text/event-stream")
        self.set_header("Cache-Control", "no-store")
        self.set_header("X-Accel-Buffering", "no")
        headers = {"Accept": "text/event-stream", "Authorization": auth}

        def on_chunk(chunk):
            self.write(chunk)
            return self.flush()

        client = tornado.httpclient.AsyncHTTPClient()
        await client.fetch(base + "/api/event", headers=headers,
                           streaming_callback=on_chunk, request_timeout=0)
```

要点（全部有依据）：

| 项 | 原因 | 依据 |
|---|---|---|
| 必须 raw handler | servant 一次性 `finish()`，不能流式 | E40 |
| `X-Accel-Buffering: no` | 链路是否缓冲未确认，先声明关闭 | 13.6 |
| 心跳 15 s | 框架 idle 200 s | E40 |
| 必须 async | 框架线程池仅 10 | E40 |
| Tornado 4.x 用 `@gen.coroutine` | 版本未确认 | 13.5 |

---

## 9. HUD 规格

### 9.1 文件与加载

```text
webapps/ossdesignwebsite/plugin/hud/
├── hud.js        主程序（UI + SSE + 多会话）
├── hud.css       样式
└── hud-boot.js   启动器（创建挂载点）
```

- 加载方式：`app_main.js` 末行 **bootstrap 注入**（现网已存在，E18；由用户手工放的 `plugin/hud.js` 只是原型）
- **禁止带 query 参数**（E13）
- 同源相对路径：`/ossdesignwebsite/plugin/hud/hud.js`

### 9.2 状态模型

```js
// localStorage 键：ossdesign.hud.v1
{
  handle: "…",
  agentAccount: "z3001",        // 仅用于显示
  sessions: [{id:"ses_…", title:"…", status:"idle|running|error", unread:0}],
  active: "ses_…",
  geometry: {mode:"floating", x: 40, y: 40, w: 420, h: 560},
  theme: "light|dark"
}
// 以下不持久化
messagesBySession: { "ses_…": [...] }
draftsBySession:   { "ses_…": "…" }
```

### 9.3 登录引导

```text
点"连接 AI"
  → POST /rest/ossdesign/v1/designer/hud/login/start
      ← {ticket,url}
  → window.open(url)           // 用户用某个 w3 账号授权
  → 每 2s GET /hud/login/status?ticket=…
      pending → 继续
      ready   → 保存 handle/agentAccount，进入会话列表
      failed  → 显示原因 + 重试按钮
  → 360s 无结果 → 提示"重新发起登录"
```

请求需带 `roarand`（E16）：

```js
fetch(path, {headers: {roarand: window.common?.csrfToken || ""}, credentials: "same-origin"})
```

### 9.4 会话与并行

| 操作 | 实现 | 依据 |
|---|---|---|
| 新建会话 | `POST /hud/session`，可任意多个 | E50 |
| 并行运行 | 不同会话分别 `POST /hud/prompt`，立即返回 | E32 |
| 忙状态 | 定时（3 s）或事件驱动查 `/hud/sessions` + `active` | E32 |
| 切换 | 只切前端 `active`，不重连 SSE | D9 |
| 中断 | `POST /hud/interrupt` | E31 |

### 9.5 事件 → UI 映射（关键子集；完整清单见附录 A）

| 事件 `type` | UI 动作 |
|---|---|
| `server.connected` | 标记"已连接"（E35 实测首帧） |
| `session.created` | 列表新增一项 |
| `session.updated` / `session.renamed` | 更新标题 |
| `session.status` / `session.idle` | 更新运行/空闲 |
| `session.execution.started` | 显示"运行中" |
| `session.execution.succeeded/failed/interrupted` | 结束运行态、错误提示 |
| `session.text.delta` | 追加正文（打字机） |
| `session.reasoning.delta` | 追加"思考"折叠区 |
| `session.tool.input.started/ended` | 新建工具卡（参数） |
| `session.tool.called` | 工具卡进入执行态 |
| `session.tool.progress` | 更新进度 |
| `session.tool.success` / `session.tool.failed` | 工具卡终态（耗时/结果） |
| `permission.asked` | 渲染审批卡（读 `/hud/sessions` 或事件载荷） |
| `permission.replied` | 关闭审批卡 |
| `session.error`（若存在，见附录 A 核对） | 错误气泡 |

> 事件名以附录 A 的 65 个为准；载荷结构在 M3 联调时用 `curl -N` 抓首帧确认（13.7）。

### 9.6 审批卡

```text
收到 permission.asked →
  POST /hud/reply {sessionID, requestID, decision}
    decision: once | always | reject      （E52）
```

### 9.7 SSE 与重连

| 项 | 规则 |
|---|---|
| 连接数 | **1 条** `/hud/events`，带 `X-Hud-Handle` |
| 分发 | 按事件载荷中的 `sessionID` 投递到对应会话视图 |
| 重连 | `EventSource` 自带重连；重连成功后对"当前打开会话"各拉一次 `/hud/messages` 对账（E53） |
| 断线提示 | 连续 2 次重连失败 → 顶部黄条"连接中断，重试中" |

### 9.8 样式与约束

| 项 | 约束 | 依据 |
|---|---|---|
| 不得加载外域资源 | CSP `default-src 'self'` | E14 |
| 内联样式/脚本可用 | 登录页 CSP 允许 `unsafe-inline`；应用页未确认 | E14/E15（13.4） |
| 不得用 iframe 嵌外部页面 | `X-Frame-Options: SAMEORIGIN` | E14 |
| 静态资源不得带 query | 会 500 | E13 |

---

## 10. 部署

### 10.1 文件清单

| 文件 | 目标路径 | 权限 | 升级影响 |
|---|---|---|---|
| `hud.js/hud.css/hud-boot.js` | `<WEB>/plugin/hud/` | `0640 root:root` | 被覆盖 |
| `app_main.js` 末行注入 | `<WEB>/osmuwebsite_app/app_main.js` | 保持 `0640` | 被覆盖 |
| `hud_proxy.py` | `<APP_ROOT>/pyscript/ossdesign/interface/` | `0500 root:root`（照 post_install 风格，E11） | 被覆盖 |
| 注册代码 | `<APP_ROOT>/pyscript/ossdiyservice.py` | 保持 | 被覆盖 |
| `broker.py` + unit | `/opt/cloud/manager/tools/cogagent-hud/`、`/etc/systemd/system/` | `0750 root:root` | **不受影响** |
| `recover.sh` | `/opt/cloud/manager/tools/cogagent-hud/` | `0750` | **不受影响** |

### 10.2 安装顺序

```bash
# 0) 备份 app_main.js（现场已有 .ccloud-backup 先例）
cp <WEB>/osmuwebsite_app/app_main.js <WEB>/osmuwebsite_app/app_main.js.hud-backup

# 1) 前端静态文件
install -d -m 0750 <WEB>/plugin/hud
install -m 0640 <src>/hud.js <src>/hud.css <src>/hud-boot.js <WEB>/plugin/hud/

# 2) 注入引导（幂等）
grep -q 'oss-hud-bootstrap' <WEB>/osmuwebsite_app/app_main.js || \
  printf '%s' "$BOOTSTRAP" >> <WEB>/osmuwebsite_app/app_main.js

# 3) 后端桥
install -m 0500 <src>/hud_proxy.py <APP_ROOT>/pyscript/ossdesign/interface/hud_proxy.py

# 4) 注册（幂等，见 10.3）
bash /opt/cloud/manager/tools/cogagent-hud/recover.sh --register-only

# 5) broker
install -m 0750 <src>/broker.py /opt/cloud/manager/tools/cogagent-hud/broker.py
install -m 0644 <src>/cogagent-hud-broker.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now cogagent-hud-broker

# 6) 重启 OSSDesign（路由在启动时注册，E40）
<APP_ROOT>/bin/restart.sh
```

### 10.3 recover.sh（升级后一条命令）

```bash
#!/bin/bash
# 幂等：升级后恢复 HUD。可反复执行。
set -uo pipefail
SRC=/opt/cloud/manager/tools/cogagent-hud/dist
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
WEB=$APP_ROOT/webapps/ossdesignwebsite
MARK='oss-hud-bootstrap'
changed=0

# 1) 静态文件
install -d -m 0750 "$WEB/plugin/hud"
for f in hud.js hud.css hud-boot.js; do
  if ! cmp -s "$SRC/$f" "$WEB/plugin/hud/$f"; then
    install -m 0640 "$SRC/$f" "$WEB/plugin/hud/$f"; changed=1
  fi
done

# 2) app_main.js 注入（幂等）
if ! grep -q "$MARK" "$WEB/osmuwebsite_app/app_main.js"; then
  cat "$SRC/bootstrap.snippet" >> "$WEB/osmuwebsite_app/app_main.js"; changed=1
fi

# 3) 桥文件
if ! cmp -s "$SRC/hud_proxy.py" "$APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py"; then
  install -m 0500 "$SRC/hud_proxy.py" "$APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py"; changed=1
fi

# 4) 注册代码（标记检测）
if ! grep -q 'hud_proxy' "$APP_ROOT/pyscript/ossdiyservice.py"; then
  python3 - "$APP_ROOT/pyscript/ossdiyservice.py" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
s = s.replace("application_map = {", "application_map = {\n    \"hud_proxy\": HudProxy(),", 1)
s = s.replace("rest.START_APPLICATION()",
  "rest.G_APPLICATION.add_handlers(r\".*\", [(r\"/rest/ossdesign/v1/designer/hud/events\", HudSseHandler)])\nrest.START_APPLICATION()", 1)
s = "from ossdesign.interface.hud_proxy import HudProxy, HudSseHandler\n" + s
open(p, "w").write(s)
PY
  changed=1
fi

# 5) 需要时重启
if [ "${1:-}" != "--register-only" ] && [ "$changed" = "1" ]; then
  "$APP_ROOT/bin/restart.sh"
fi
echo "recover done (changed=$changed)"
```

### 10.4 升级演练清单

| 步 | 期望 |
|---|---|
| 升级 OSSDesign | 浮窗消失（文件被覆盖） |
| 执行 `recover.sh` | 输出 `changed=1`，服务重启 |
| 刷新页面 | 浮窗出现，`handle` 仍有效，会话列表不变（数据在 cogagent 侧，E27） |

---

## 11. 测试与验收

### 11.1 分步验收脚本

```bash
BASE=https://10.44.228.181:6701
H='-H X-Hud-Handle:HANDLE_HERE'

# 1) 桥存活
curl -sk -b '<平台cookie>' $BASE/rest/ossdesign/v1/designer/hud/ping

# 2) broker 状态
curl -sk -b '<平台cookie>' $BASE/rest/ossdesign/v1/designer/hud/status

# 3) 发起登录
curl -sk -b '<平台cookie>' -X POST $BASE/rest/ossdesign/v1/designer/hud/login/start
#    → 拿到 ticket 与 url；浏览器打开 url 完成授权

# 4) 轮询
curl -sk -b '<平台cookie>' "$BASE/rest/ossdesign/v1/designer/hud/login/status?ticket=T"
#    → ready + handle

# 5) 列会话
curl -sk -b '<平台cookie>' $H $BASE/rest/ossdesign/v1/designer/hud/sessions

# 6) 新建会话
curl -sk -b '<平台cookie>' $H -H 'Content-Type: application/json' \
     -d '{"title":"测试"}' $BASE/rest/ossdesign/v1/designer/hud/session

# 7) 发消息
curl -sk -b '<平台cookie>' $H -H 'Content-Type: application/json' \
     -d '{"sessionID":"ses_x","text":"hi"}' $BASE/rest/ossdesign/v1/designer/hud/prompt

# 8) SSE
curl -skN -b '<平台cookie>' $H $BASE/rest/ossdesign/v1/designer/hud/events
```

### 11.2 验收用例

| # | 用例 | 期望 | 依据 |
|---|---|---|---|
| 1 | 无 handle 进入 | 显示"连接 AI" | 9.3 |
| 2 | 完成登录（cogagent 账号 A） | 返回 handle，列出 A 的会话 | D2/E33 |
| 3 | 新建 3 个会话并各发一条 | 三条独立对话，可并行 | E32 |
| 4 | 同一 cogagent 账号在第二个窗口登录 | 复用实例，看到同一份会话 | D3 |
| 5 | 不同 cogagent 账号登录 | 独立实例，互不可见 | E25/E27 |
| 6 | 刷新页面 | 恢复 handle、列表、选中 | 9.2 |
| 7 | 断网→恢复 | SSE 重连并补齐消息 | E53/9.7 |
| 8 | 审批：once/always/reject | 三种均生效 | E52 |
| 9 | 上游 401 | 清 handle，提示重新登录 | 7.8 |
| 10 | 升级后跑 recover | 浮窗恢复，会话不丢 | 10.3/10.4 |

---

## 12. 里程碑

| # | 内容 | 完成标准 | 人日 |
|---|---|---|---|
| M1 | `COGAGENT_SERVE_ONLY` + 验证 `serve --service --port` 写 `service-local.json` + 输出 `COGAGENT_LOGIN_ACCOUNT` | 手工起一台实例，`curl -u` 能列会话 | 1 |
| M2 | broker（状态机 + 实例管理 + 代理 12 接口） | `/status`、`/login/*`、`/agent/*` 全部按 7.8 工作 | 2 |
| M3 | 桥（13 接口 + SSE） | 11.1 脚本全绿（含 SSE 收到 `server.connected`） | 1.5 |
| M4 | HUD（登录、列表、对话、审批、分发） | 11.2 用例 1–9 通过 | 3 |
| M5 | `recover.sh` + 升级演练 | 10.4 四项全过 | 0.5 |

---

## 13. 未确认项（含验证方法）

| # | 内容 | 影响 | 验证方法 |
|---|---|---|---|
| 13.1 | `serve --service --port N` 是否写 `service-local.json` | broker 取密码方式 | M1：起实例后 `cat` 该文件 |
| 13.2 | `userAccount` 是否总等于目录名 | 目录/端口选择 | M2：登录后比对 `ls /srv/cogagent/users` |
| 13.3 | 同 cogagent 账号在他处再登录是否使旧 token 失效 | 是否必须 401 兜底 | 观察现网；已设计兜底，影响可控 |
| 13.4 | 应用页（已登录）CSP | `window.open` 与内联资源是否可用 | 需真实登录态取响应头（取证①未确认项 1） |
| 13.5 | Tornado 版本 | SSE handler 写法 | `python3 -c "import tornado;print(tornado.version)"` |
| 13.6 | hiro→OSSDesign 之间是否缓冲 SSE | 流是否实时 | M3：`curl -N` 观察帧间隔 |
| 13.7 | 事件载荷字段结构 | HUD 渲染字段名 | M3：`curl -N /api/event` 抓真实帧 |

---

## 14. 附录 A：事件类型清单（65 个，E54）

```text
会话：session.created, session.updated, session.deleted, session.renamed,
      session.metadata.updated, session.permissions, session.viewed,
      session.archived, session.unarchived, session.moved, session.forked,
      session.agent.selected, session.model.selected, session.instructions.updated,
      session.synthetic, session.skill.activated, session.status, session.idle
执行：session.execution.started, session.execution.succeeded,
      session.execution.failed, session.execution.interrupted,
      session.step.started, session.step.streamed, session.step.ended,
      session.step.failed, session.retry.scheduled
文本：session.text.started, session.text.delta, session.text.ended,
      session.reasoning.started, session.reasoning.delta, session.reasoning.ended,
      session.message.content.updated
工具：session.tool.input.started, session.tool.input.delta, session.tool.input.ended,
      session.tool.called, session.tool.progress, session.tool.success, session.tool.failed
审批：permission.asked, permission.replied
队列：session.inbox.enqueued, session.inbox.delivered, session.inbox.cancelled,
      session.inbox.delivery.changed
用量：session.usage.recorded, session.usage.updated
压缩：session.compaction.started, session.compaction.delta, session.compaction.ended,
      session.compaction.failed
回滚：session.revert.staged, session.revert.cleared, session.revert.committed
Shell：session.shell.started, session.shell.ended
消息：message.updated, message.removed
服务：server.connected（实测首帧，E35）
```

> 上表来自本会话对 `packages/schema/src` 的统计；名称以联调实测帧为最终依据（13.7）。

---

## 15. 附录 B：本方案明确不做的事

| 项 | 原因 |
|---|---|
| 会话与 OSSDIY project/site 绑定 | 需求明确禁止 |
| 桥读取 `X-User-Name` | 需求明确禁止 |
| 同 cogagent 账号多窗口互踢 | 已决策允许（D3） |
| 会话清理 / 归档 | 需求明确不做 |
| 提权（sudo）工具 | 暂不做 |
| 跨设备同步 | 仅"同一机器多浏览器窗口"场景 |
| 请求体 schema 强校验 | 明确不做，桥仅做最小字段检查 |
