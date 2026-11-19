# HUD 接入：当前状态与恢复手册

> 更新时间：2026-11-18
> 用途：记录已经**实测可用**的代码与部署状态；OSSDesign 重装后照第 4 节恢复即可。
> 约定：每条命令都标注执行用户。改 OSSDesign 自身代码必须先读源码，不猜。

---

## 1. 当前状态（已实测）

| 环节 | 位置 / 值 | 验证方式 | 结果 |
|---|---|---|---|
| 浏览器入口 | `https://oss.PMS.com` → `10.44.228.181:6701`（hiro-ER） | 浏览器访问 | ✅ |
| OSSDesign 版本目录 | `/opt/cloud/envs/Product-OSSDesignService/272.010.152` | `readlink -f /opt/cloud/manager/apps/OSSDesignService` | ✅ |
| OSSDesign 真实本地端口 | `127.0.0.1:25912`（python，mTLS） | `ss -ltnp \| grep 25912` | ✅ |
| 网关访问 API | 浏览器 fetch 成功 | `/rest/ossdesign/v1/designer/hud/status` → **200** | ✅ |
| 桥（OSSDesign 内） | `pyscript/ossdesign/interface/hud_proxy.py` + 注册块 `HUD_BRIDGE_V3` | `/tmp/hud_bridge.log` 有 `[import]`、`[hit]` | ✅ |
| broker | `127.0.0.1:18765`，systemd `cogagent-hud-broker` | `curl /status` 返回实例列表 | ✅ |
| cogagent 实例 | `127.0.0.1:50461`（账号 `z30048462`） | `curl -u opencode:<pw> /api/session` → 200 | ✅ |
| handle | `/tmp/hud-login.json`，持久化 `/var/lib/cogagent-hud/handles.json` | 列会话 200 | ✅ |
| 桥诊断日志 | `/tmp/hud_bridge.log` | `cat` | ✅ |
| HUD 前端 | `webapps/ossdesignwebsite/plugin/hud/hud.js` | 浏览器注入后可见悬浮球 | ✅ |
| 表单（question） | `GET /api/session/{id}/form` → HUD 表单卡 | 回答后会话解锁（实测 2→15 条消息） | ✅ |
| 授权（permission） | `GET /api/permission/request` → HUD 授权卡 | 待真实触发验证 | ⚠️ |

实测证据（浏览器控制台）：

```text
HUD HTTP 200 {"instances": [{"account": "z30048462", "port": 50461, "state": "ready"}], "count": 1}
```

桥诊断日志：

```text
[import] hud_proxy loaded
[hit] GET status
```

---

## 2. 术语（全文严格区分）

| 术语 | 定义 | 来源 |
|---|---|---|
| **OSSDIY 前端账户** | 登录 OSSDIY 页面的平台身份（hiro 用 cookie `roarand` 校验） | 网关 |
| **cogagent 账号** | cogagent 自己 SSO 登录后返回的 `userAccount` | `/usr/local/bin/cogagent:162-167` |

桥**不使用** OSSDIY 前端账户做任何路由；隔离只由 cogagent 账号决定。

---

## 3. 已在服务器上落地的改动（精确清单）

### 3.1 cogagent 启动器（`/usr/local/bin/cogagent`）

| 标记 | 作用 |
|---|---|
| `SERVE_ONLY_EARLY_ACCOUNT` | serve-only 时登录后立刻打印 `COGAGENT_LOGIN_ACCOUNT=<账号>`（供 broker 提前决策） |
| `SERVE_ONLY_REUSE_EXIT` | 锁冲突时 serve-only 自动退出（不读 stdin） |
| `SERVE_ONLY_NO_STOP` | serve-only 不执行 `prepare_service`（避免停掉已有实例） |
| `COGAGENT_SERVE_ONLY` 分支 | 把最终执行目标换成 `serve --service --port <port>`，跳过 userns 沙箱 |

校验：

```bash
# 执行用户：root
grep -c COGAGENT_SERVE_ONLY /usr/local/bin/cogagent        # 期望 ≥2
grep -c SERVE_ONLY_EARLY_ACCOUNT /usr/local/bin/cogagent   # 期望 1
```

启动方式（由 broker 调用，也可手工验证）：

```bash
# 执行用户：root
COGAGENT_SERVE_ONLY=1 /usr/local/bin/cogagent > /tmp/m1.log 2>&1 &
# 日志依次出现：SSO 链接 → COGAGENT_LOGIN_ACCOUNT=<账号> → server listening on http://127.0.0.1:<port>
```

### 3.2 broker（版本目录之外，重装 OSSDesign 不受影响）

| 项 | 路径 |
|---|---|
| 程序 | `/opt/cloud/manager/tools/cogagent-hud/broker.py` ⚠️ **当前丢失，需按附录 B 恢复** |
| systemd | `/etc/systemd/system/cogagent-hud-broker.service` |
| 状态 | `/var/lib/cogagent-hud/handles.json`（0600） |
| 日志 | `/var/log/cogagent-hud/broker.log` |

接口（`127.0.0.1:18765`）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/status` | 实例列表 |
| POST | `/login/start` | 起登录，返回 `{ticket,url}` |
| GET | `/login/status?ticket=` | `pending/serving/ready/failed` |
| POST | `/login/cancel`、`/logout` | — |
| GET/POST | `/agent/{sessions,session,messages,prompt,reply,interrupt}` | 需要 `X-Hud-Handle` |
| GET | `/agent/events` | SSE 透传 |

### 3.3 桥（OSSDesign 内，**重装会被覆盖**）

| 项 | 路径 |
|---|---|
| 程序 | `$APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py`（root:root 0644） |
| 注册 | `$APP_ROOT/pyscript/ossdiyservice.py`，插入块标记 `HUD_BRIDGE_V3`（`main()` 内、缩进 4 空格） |
| 诊断 | `hud_proxy.py` 内 `HUD_DIAG_V1` 写 `/tmp/hud_bridge.log` |

注册块（**必须缩进 4 空格，且 import 名是 `interface.hud_proxy`**）：

```python
    # HUD_BRIDGE_V3
    try:
        from interface.hud_proxy import HudProxyHandler
        rest.G_APPLICATION.add_handlers(
            r".*", [(r"/rest/ossdesign/v1/designer/hud/(.*)", HudProxyHandler)])
        print("[hud] bridge enabled")
    except Exception as _hud_exc:
        print("[hud] bridge disabled:", _hud_exc)
```

> 教训：**必须 try/except**。早期版本是裸 import，模块缺失时直接让主进程启动失败。

---

## 4. OSSDesign 重装后恢复清单

> 重装 = 版本目录整体替换（`272.010.152` → 新版本），`pyscript/`、`webapps/` 全部重置。
> 版本目录之外的东西（broker、cogagent、`/var/lib`）**不受影响**。

### 步骤 0：确认现状（执行用户：root）

```bash
# 执行用户：root
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
echo "APP_ROOT=$APP_ROOT"
su - ossadm -c "bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd statusapp -app OSSDesignService" | sed -n '1,8p'
ss -ltn | grep -E '18765|50461'
grep -n "HUD_BRIDGE_V3" "$APP_ROOT/pyscript/ossdiyservice.py" || echo "  未注册（需要恢复）"
systemctl is-active cogagent-hud-broker
```

### 步骤 1：恢复 broker 文件（执行用户：root）

若 `/opt/cloud/manager/tools/cogagent-hud/broker.py` 不存在：

1. 按**附录 B** 写入该文件
2. `chmod 0750`，`systemctl restart cogagent-hud-broker`
3. `curl -s http://127.0.0.1:18765/status` 应返回 200

> broker 文件在版本目录之外，正常重装不会丢；本机曾因手工清理丢失过一次。

### 步骤 2：恢复桥文件（执行用户：root）

```bash
# 执行用户：root
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
install -m 0644 /tmp/hud_proxy.py.hold "$APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py"
# 若无 /tmp 副本，按附录 A 写入
ls -l "$APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py"
```

### 步骤 3：恢复注册块（执行用户：root）

先确认锚点存在（**新版可能变化，锚点不匹配必须停下并读源码**）：

```bash
# 执行用户：root
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
grep -n "from rest.handler import OSSRequestHandler" "$APP_ROOT/pyscript/ossdiyservice.py"
grep -n "rest.START_APPLICATION()" "$APP_ROOT/pyscript/ossdiyservice.py"
```

打补丁（锚点不匹配会拒绝写入）：

```bash
# 执行用户：root
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
python3 - "$APP_ROOT/pyscript/ossdiyservice.py" <<'PY'
import sys, shutil, time
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "HUD_BRIDGE_V3" in s:
    print("already patched"); raise SystemExit
anchor = (
    '    from rest.handler import OSSRequestHandler\n'
    '    rest.G_APPLICATION.add_handlers(r".*", [(r"/ossdesignwebsite/(.*)", OSSRequestHandler)])\n'
)
if anchor not in s:
    print("ANCHOR_MISMATCH: 未做任何修改"); raise SystemExit(2)
block = (
    "\n"
    "    # HUD_BRIDGE_V3\n"
    "    try:\n"
    "        from interface.hud_proxy import HudProxyHandler\n"
    '        rest.G_APPLICATION.add_handlers(\n'
    '            r".*", [(r"/rest/ossdesign/v1/designer/hud/(.*)", HudProxyHandler)])\n'
    '        print("[hud] bridge enabled")\n'
    "    except Exception as _hud_exc:\n"
    '        print("[hud] bridge disabled:", _hud_exc)\n'
    "\n"
)
bak = p + ".bak." + time.strftime("%Y%m%d%H%M%S")
shutil.copy2(p, bak)
open(p, "w", encoding="utf-8").write(s.replace(anchor, anchor + block, 1))
print("patched, backup:", bak)
PY
python3 -m py_compile "$APP_ROOT/pyscript/ossdiyservice.py" && echo "py-ok"
sed -n '/HUD_BRIDGE_V3/,+8p' "$APP_ROOT/pyscript/ossdiyservice.py"
```

### 步骤 4：重启并验证（执行用户：root）

```bash
# 执行用户：root（内部以 ossadm 执行）
su - ossadm -c "bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd restartapp -app OSSDesignService"
sleep 10
su - ossadm -c "bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd statusapp -app OSSDesignService" | sed -n '1,8p'
cat /tmp/hud_bridge.log 2>/dev/null | tail -5
```

**注意**：不要再试图用 `curl` 直连 `127.0.0.1:25912` —— 该端口要求**客户端证书（mTLS）**，本机没有客户端证书，永远是 `000`。

### 步骤 5：用浏览器验证（执行用户：你自己的 Windows 浏览器）

在已登录的 OSSDesign 页面 Console 执行：

```js
// 执行位置：浏览器控制台
fetch('/rest/ossdesign/v1/designer/hud/status', {
  credentials: 'same-origin',
  headers: { roarand: (window.common && window.common.csrfToken) || '' }
}).then(async r => console.log('HUD HTTP', r.status, (await r.text()).slice(0,300)))
  .catch(e => console.log('HUD ERR', String(e)));
```

期望：`HUD HTTP 200 {"instances":[...],"count":N}`

### 步骤 6：恢复前端静态文件（M4 完成后补充）

`$APP_ROOT/webapps/ossdesignwebsite/plugin/hud/` 下的文件会被重装覆盖，恢复方式同步骤 2（从版本目录外的备份拷贝）。**M4 尚未完成，此步暂时为空。**

---

## 5. 验证手册

| 验证对象 | 命令 / 方法 | 期望 |
|---|---|---|
| agent 是否在跑 | `ss -ltn \| grep 50461` | LISTEN |
| agent 认证 | `curl -u opencode:<pw> http://127.0.0.1:50461/api/session` | 200 |
| broker 存活 | `curl -s http://127.0.0.1:18765/status` | `{"instances":…}` |
| broker 登录 | `curl -s -X POST http://127.0.0.1:18765/login/start` | `{ticket,url}` |
| broker SSE | `curl -sN -H "X-Hud-Handle: $H" http://127.0.0.1:18765/agent/events` | `server.connected` + heartbeat |
| 桥加载 | `cat /tmp/hud_bridge.log` | `[import] hud_proxy loaded` |
| 桥调用 | 浏览器 fetch `/hud/status` | 200 |

---

## 5.5 消息"发不出去/被吞"的判据（重要）

cogagent 的 prompt 是**先入 inbox 再投递**（`delivery:"steer"`）。所以 POST /prompt 返回 200 **不代表**消息会立刻出现。

| 事件流里看到 | 含义 | 处理 |
|---|---|---|
| `session.inbox.enqueued` 有、`session.inbox.delivered` 无 | 入队但**没被执行** | 会话被 form 或 permission 阻塞 |
| 有 `delivered` + `session.text.delta` | 正常执行 | 前端展示问题 |
| 完全没有该会话事件 | wake 没发生 | 检查实例/会话状态 |

**排查顺序**：

```bash
# 执行用户：root
export no_proxy=127.0.0.1 NO_PROXY=127.0.0.1
H=$(python3 -c 'import json;print(json.load(open("/tmp/hud-login.json"))["handle"])')
SID=<会话ID>
curl -s -H "X-Hud-Handle: $H" "http://127.0.0.1:18765/agent/forms?sessionID=$SID"
curl -s -H "X-Hud-Handle: $H" "http://127.0.0.1:18765/agent/permissions"
```

任一返回非空 → 先在 HUD 里回答表单 / 确认授权，消息才会投递。

**form 接口**：

| 用途 | 接口 | 说明 |
|---|---|---|
| 列待答 | `GET /api/session/:sessionID/form` | 返回 `{data:[Info]}` |
| 提交 | `POST /api/session/:sessionID/form/:formID/reply` | body `{answer:{key:value}}` |
| 事件 | `form.created` / `form.replied` / `form.cancelled` | 临时事件，用于刷新 |

字段类型：`string`（可带 `options` + `custom:true` 允许自定义）、`number`、`integer`、`boolean`、`multiselect`、`external`。

**permission 接口**：

| 用途 | 接口 |
|---|---|
| 列表 | `GET /api/permission/request` |
| 回复 | `POST /api/session/:sessionID/permission/:requestID/reply`，body `{decision:"once"|"always"|"reject"}` |
| 事件 | `permission.asked`（data 即 Request：id/sessionID/action/resources/message） |

**消息查询参数**（默认 `order=desc&limit=50`，必须显式改）：

`GET /api/session/:sessionID/message?order=asc&limit=200`

---

## 6. 已知问题与注意（踩过的坑）

| # | 问题 | 结论 |
|---|---|---|
| 1 | `127.0.0.1:25909` 误判为 OSSDesign | 实际是 java（`OU=UniEPService`）；OSSDesign 新版在 **25912** |
| 2 | `curl` 直连 25912 得 `000` | 该端口要求**客户端证书**，本机无客户端证书；验证只能走网关（浏览器） |
| 3 | 进程 stdout 是 `/dev/null` | 桥里 `print` 看不到 → 用 `/tmp/hud_bridge.log` 落盘诊断（`HUD_DIAG_V1`） |
| 4 | 裸 import 注册导致服务起不来 | 必须 `try/except` 包裹；且 import 名是 `interface.hud_proxy` |
| 5 | 手工 `python ossdiyservice.py` 报 `ModuleNotFoundError: infrastructure_verification` | 缺平台 `PYTHONPATH`，是假象，不是回归 |
| 6 | `restart.sh` 只能用 ossadm 执行 | root 需 `su - ossadm -c`；用 root 直接跑会留下 STOPPED |
| 7 | `broker.py` 曾被清理丢失 | 进程在内存里仍可用，但一旦重启无法恢复 → 见附录 B |
| 8 | `serve --service` 忽略 `OPENCODE_PASSWORD` | 密码总由服务随机生成，写进 `state/cogagent/service-local.json`，broker 读文件 |

---

## 6.5 前端 `hud.js` 的补丁标记（对账用）

| 标记 | 作用 |
|---|---|
| `TEXTOF_V2` | 消息文本提取：`m.text` → `m.content[]`（text/tool/reasoning） |
| `ORDER_V3` | 消息按 `time.created` 升序渲染 |
| `SEND_V4` / `POLL_V4` | 发送成功后乐观追加 + 30 秒轮询刷新 |
| `MSG_ASC_V5` | 请求 `&order=asc&limit=200` |
| `FORMS_V6` | 表单卡片（单/多选/布尔/数字/自定义） |
| `PERM_V7` | 授权卡片（once/always/reject） |

校验（执行用户：root）：

```bash
# 执行用户：root
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
F="$APP_ROOT/webapps/ossdesignwebsite/plugin/hud/hud.js"
for m in TEXTOF_V2 ORDER_V3 SEND_V4 MSG_ASC_V5 FORMS_V6 PERM_V7; do
  printf "%-12s %s\n" "$m" "$(grep -c "$m" "$F")"
done
```

---

## 6.6 一键恢复脚本 `recover.sh`（M5）

位置：`/opt/cloud/manager/tools/cogagent-hud/recover.sh`（`ossadm:ossgroup 0750`，版本目录之外，重装不丢）

| 命令 | 行为 |
|---|---|
| `bash recover.sh check` | 只读体检；非 0 表示有问题 |
| `bash recover.sh snapshot` | 把线上 `hud_proxy.py` / `hud.js` / `broker.py` 快照到 `assets/`（0640 ossadm） |
| `bash recover.sh apply` | 缺什么补什么 → 必要时重启 → 自检 |

安全设计：

| 风险 | 处理 |
|---|---|
| 裸 import 拖垮服务 | 注册块固定带 `try/except` |
| 锚点不匹配 | 直接退出（码 3），不动文件 |
| 无脑重启 | 仅"服务未运行"或"注册刚改动"时重启 |
| 属主错误 | `tools/` 下强制 `ossadm:ossgroup` |
| 覆盖线上文件 | 仅在文件**缺失**时从 assets 恢复 |

**重装 OSSDesign 后的标准动作**：

```bash
# 执行用户：root
bash /opt/cloud/manager/tools/cogagent-hud/recover.sh apply
```

**判断"服务是否运行"用 PID，不用端口猜**（踩过坑：`2591[0-9]` 会撞上别的服务）：

```bash
# 执行用户：root
pgrep -f ossdiyservice.py | head -1          # 主进程 pid
ss -ltnp | grep "pid=<pid>," | awk '{print $4}'   # 它真正监听的端口
```

---

## 7. 下一步（M4）

| 项 | 内容 |
|---|---|
| 落点 | `$APP_ROOT/webapps/ossdesignwebsite/plugin/hud/{hud.js,hud.css}` |
| 加载 | 先用浏览器手动注入验证，稳定后写 `app_main.js` 尾部 bootstrap（幂等） |
| 范围 | 悬浮球 + 面板（左列表/右对话）、登录引导、会话增删切、消息收发、SSE 分发、审批卡、401 处理 |
| 不动的东西 | OSSDesign 的 `pyscript/`（M3 已完成） |

---

## 8. 2026-11-18 晚：流式、Markdown、自启动（本轮全部结论）

### 8.1 最终架构（当前线上形态）

```text
浏览器 F5
  └─ app_main.js 尾部 bootstrap（oss-hud-bootstrap-v2）
       └─ /ossdesignwebsite/plugin/hud/hud.js   （HUD，单文件，Shadow DOM）
            ├─ GET  /rest/ossdesign/v1/designer/hud/status        （实例列表，无需 handle）
            ├─ POST /hud/login/start  → SSO URL → 轮询 /hud/login/status
            ├─ GET  /hud/sessions | /hud/messages?sessionID&order=asc&limit=200
            ├─ GET  /hud/forms?sessionID      （待答表单 = question 工具）
            ├─ POST /hud/form/reply           （{sessionID, formID, answer}）
            ├─ GET  /hud/permissions          （待授权）
            ├─ POST /hud/reply                （{sessionID, requestID, decision}）
            ├─ POST /hud/prompt               （{sessionID, text}）
            └─ GET  /hud/events?handle=…      （SSE：逐字、状态、刷新信号）
```

桥（`hud_proxy.py`）把未知路由**透传**到 broker 的 `/agent/<route>`，所以新加接口一般不用重启 OSSDesign——除了 SSE 这种需要特殊处理的。

### 8.2 SSE 的四个坑（都踩过，必须按此实现）

| # | 坑 | 现象 | 正确做法 |
|---|---|---|---|
| 1 | 用 `AsyncHTTPClient().fetch(streaming_callback=…)` 转发 | 桥日志停在 `[stream] client ok`，broker 收不到请求 | 桥内**用 socket 线程**转发，不依赖框架 HTTP 客户端 |
| 2 | `socket.create_connection(timeout=10)` 会继承给 `recv` | 每 10 秒 `TimeoutError` 断开 | 连接后立刻 `sock.settimeout(None)` |
| 3 | handler 返回即结束响应 | `SSE OPEN` 后立刻 `ERR`，无限重连 | `stream()` 里 `yield done_future`，线程结束时 `set_result` |
| 4 | 多个 EventSource 同时订阅 | 手工测试占住事件，HUD 收不到 | 测试前 `F5` 关掉旧的；HUD 内只保留一个 `es` |

另外两条经验：

- 响应头**不要**加 `Connection: close`（会被网关按"读到关闭"缓存，浏览器拿不到帧）；要靠 chunked 边收边转。
- 桥一进入 events 就立刻写 `: open\n\n` 并 `flush()`，再加 5 秒 `: ping\n\n` 心跳，避免网关把头部憋住。

### 8.3 阻塞模型（为什么"消息发出去不显示"）

`POST /prompt` 返回 200 只代表**入队**（`delivery:"steer"`）。只有出现 `session.inbox.delivered` 才会变成可见消息。

**会阻塞投递的两种状态**（HUD 必须能处理，否则永远"发不出去"）：

| 阻塞源 | 查询接口 | 回复接口 | 事件 |
|---|---|---|---|
| `question` 工具（表单） | `GET /api/session/:id/form` | `POST /api/session/:id/form/:formID/reply` body `{answer:{key:value}}` | `form.created / form.replied / form.cancelled` |
| 权限确认 | `GET /api/permission/request` | `POST /api/session/:id/permission/:reqID/reply` body `{decision:"once"\|"always"\|"reject"}` | `permission.asked` |

### 8.4 消息与事件的真实结构

```json
// 消息（GET /api/session/:id/message?order=asc&limit=200）
{"data":[
  {"id":"msg_x","type":"user","text":"1","time":{"created":1794...}},
  {"id":"msg_y","type":"assistant","content":[
      {"type":"text","text":"…"},
      {"type":"tool","name":"bash","state":{"status":"completed","input":{...}}}
  ]},
  {"id":"msg_z","type":"system","text":"Today's date is now: …"}
]}
```

```json
// 流式（SSE，ephemeral）
{"type":"session.text.delta","data":{"sessionID":"ses_…","assistantMessageID":"msg_…","ordinal":0,"delta":"1"}}
{"type":"session.text.ended", ...}
```

默认 `order=desc&limit=50`（新→旧、50 条），**必须**显式传 `order=asc&limit=200`。

### 8.5 自启动（刷新后 HUD 自动出现）

`webapps/ossdesignwebsite/` 下**没有** `index.html`，页面入口是 `osmuwebsite_app/app_main.js`。因此在 `app_main.js` **尾部追加**：

```js
;/*oss-hud-bootstrap-v2*/(function(){try{
  if(window.__OSS_HUD_BOOT_V2__)return;window.__OSS_HUD_BOOT_V2__=1;
  var s=document.createElement("script");
  s.src="/ossdesignwebsite/plugin/hud/hud.js";
  s.async=false;s.onerror=function(){};
  (document.head||document.documentElement).appendChild(s);
}catch(e){}})();
```

要点：

- 只追加、不改原有代码；带标记可回滚（删掉最后一行）
- `app_main.js.ccloud-backup` 是原始备份（**不要动**）
- 重装后由 `recover.sh apply` 自动补（会先备份 `app_main.js`）
- 旧的 `plugin/hud.js`（19 KB，重装前版本）已改名为 `hud.js.old.<时间>`，避免被误加载

### 8.6 前端 `hud.js` 功能与补丁标记（全部已上线）

| 标记 | 功能 |
|---|---|
| `TEXTOF_V2` | 消息文本提取（`text` / `content[]`） |
| `ORDER_V3` | 按 `time.created` 升序渲染 |
| `SEND_V4` / `POLL_V4` | 发送后乐观追加 + 30 秒轮询 |
| `MSG_ASC_V5` | 请求 `&order=asc&limit=200` |
| `FORMS_V6` | 表单卡片（单选/多选/布尔/数字/自定义） |
| `PERM_V7` | 授权卡片（once/always/reject） |
| `STREAM_V8` / `STREAM_KEEP_V11` / `STREAM_CURSOR_V11` | 逐字输出、渲染后重挂气泡、光标 |
| `MD_RENDER_V9` / `MD_CSS_V9` | Markdown（代码块/列表/标题/粗斜体/链接） |
| `COPY_V10` | 代码块「复制」按钮（clipboard + execCommand 兜底） |
| `RESIZE_V13` | 面板拖拽改尺寸 + 记住位置（`localStorage`） |
| `TOOLCARD_V14` | 工具调用卡片（名称/状态/参数折叠） |
| `SSE_DEBUG_V12` | `window.__HUD_DEBUG__=true` 时打印 `[hud] evt …` |

一键核对：

```bash
# 执行用户：root
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
F="$APP_ROOT/webapps/ossdesignwebsite/plugin/hud/hud.js"
for m in TEXTOF_V2 ORDER_V3 SEND_V4 FORMS_V6 PERM_V7 STREAM_V8 MD_RENDER_V9 COPY_V10 RESIZE_V13 TOOLCARD_V14; do
  printf "%-16s %s\n" "$m" "$(grep -c "$m" "$F")"
done
```

### 8.7 已知限制

| 限制 | 说明 |
|---|---|
| 流式只在 SSE 连接唯一时可靠 | 多标签页同时开会互相抢事件（cogagent 的事件流似乎单订阅者） |
| 无 Markdown 表格/图片 | 当前渲染器只覆盖常用语法 |
| 工具卡片不展示输出 | 只展示名称/状态/入参 |
| 审批卡无命令详情 | 只显示 action + resources |
| 面板无最小化到侧边 | 只能收起（点 —） |

---

## 9. 版本日志（前端 hud.v*.js）

> 因为网关会缓存同名静态文件，**每次改前端都递增版本号**并同步改两处指向：
> `app_main.js` 的 bootstrap、`recover.sh`。旧文件保留，便于回滚。

| 版本 | 主要改动 |
|---|---|
| v16 | 会话/消息/发送/排序/表单/授权/流式雏形 |
| v17–v21 | 代码块复制、面板拖拽改尺寸、工具卡片、模型切换（初版） |
| v22–v24 | `state.models` 初始化与兜底（修 `reading 'length'`） |
| v25 | 下拉框显示 **模型 id**（name 过长）；composer 改上下两行 |
| v26–v27 | 提示条语义化：成功=蓝 0.6s，失败=红 4s |
| v28 | 新建会话默认第 2 个模型 |
| v29–v31 | 防闪：消息指纹、流式期间不重绘、轮询降频 |
| v32 | 流式合帧（requestAnimationFrame）+ 贴底才滚动 |
| v33 | 流式期间不再插入"思考中" |
| v34–v36 | 流式结束就地转正为 Markdown，`idle` 不再删气泡 |
| v37 | Markdown **表格**渲染 |
| v38 | 品牌：悬浮球 `COG`、标题 `cog助手` |

当前线上版本：**v38**（`plugin/hud/hud.v38.js`）。

### 9.1 前端同步到仓库的约定

- 仓库里的 `script/hud/hud.js` 是**参考实现/源码基线**，包含全部补丁标记；
- 线上真实运行的 `hud.vNN.js` 通过 `recover.sh snapshot` 存到 `assets/`（重装可恢复）；
- 每次线上改动后应执行一次 `recover.sh snapshot`。

---

## 10. 仓库 ↔ 服务器：如何保证 install 后仍然可用

### 10.1 三层保障

| 层 | 位置 | 作用 |
|---|---|---|
| ① 运行时快照 | 服务器 `/opt/cloud/manager/tools/cogagent-hud/assets/` | `recover.sh apply` 的唯一依据；**重装 OSSDesign 包后一条命令恢复** |
| ② 仓库镜像 | `script/hud/{broker.py,hud_proxy.py,hud.js,recover.sh}` + `script/hud/server/`（原样留档） | 逐字节等于线上；可审计、可回滚、可部署到新机器 |
| ③ 部署脚本 | `script/hud/deploy.sh` | 从仓库文件安装：版本号递增、改 bootstrap、打注册、重启、快照、自检 |

### 10.2 为什么"增量改出来的代码"也能可靠重装

| 场景 | 恢复路径 |
|---|---|
| 重装 **OSSDesign 包**（版本目录被替换） | `bash /opt/cloud/manager/tools/cogagent-hud/recover.sh apply` → 从 ① 恢复桥、注册、前端、bootstrap |
| 机器重启 | systemd 拉起 broker；OSSDesign 自启；缺失文件时 `apply` |
| 换新机器 | 装 cogagent 包（打 serve-only 补丁）→ 拷 `script/hud/` → `bash deploy.sh`（从 ② 安装） |
| 想回滚某版前端 | `hud.vN.js` 全部保留，改 bootstrap 指向即可（不用改代码） |

### 10.3 一致性校验

对比服务器文件 sha256 与 `script/hud/manifest.json`：

```bash
# 执行用户：root
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
B=/opt/cloud/manager/tools/cogagent-hud
sha256sum "$B/broker.py" "$B/recover.sh" \
          "$APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py" \
          "$APP_ROOT/webapps/ossdesignwebsite/plugin/hud/hud.v59.js"
```

### 10.4 纪律（必须遵守）

1. **线上每改一次 → 立刻 `recover.sh snapshot`**（否则 assets 落后，重装就回退）
2. **当天收尾 → 从服务器导出 → 覆盖仓库 → 更新 manifest → 提交**（见 `script/hud/SYNC.md`）
3. 不在服务器上长期保留"仓库里没有的改动"

### 10.5 当前线上版本（2026-11-18 20:45 导出）

| 文件 | 大小 | sha256（前 16 位） |
|---|---|---|
| `broker.py` | 23653 | `f857343b8f56d6c7` |
| `hud_proxy.py` | 7253 | `07a0af25b303fde0` |
| `hud.js`（= `hud.v59.js`） | 61024 | `e2163227a9d78c42` |
| `recover.sh` | 7919 | `25ab3363bac076cd` |

---

## 11. 版本日志补充（v39 → v59）

| 版本 | 改动 |
|---|---|
| v39 | 会话列表搜索 + 删除（`✎` 前身：先只有 ×） |
| v40 | 权限模式下拉：询问 / 全放行（`PATCH /api/session/:id {permissions}`） |
| v41–v44 | 消息分页（首屏 30 条 + 加载更多）、cursor 修正、切换加速 |
| v45–v46 | 停止按钮（`POST .../interrupt`），从标题栏移到输入行 |
| v47 | 会话徽标：bypass / 运行中 / 等待 |
| v48 | 审批卡命令高亮（metadata 里的 command/path） |
| v49 | 修复 Shadow DOM 下卡片重复（`document.getElementById` → `msgs.querySelector`） |
| v51 | reasoning 折叠 + 消息复制 + 用量/成本 |
| v52 | 复制按钮移到气泡右下角 |
| v53–v55 | 语音输入（Web Speech API）、位置、自动聚焦 |
| v56–v57 | SSE 断线补拉 + 会话重命名（`✎` + 双击委托） |
| v58 | `✎`/× 仅悬停显示 |
| v59 | 用户模式 / 开发者模式（`plan` / `build` 切换） |

## 12. 双版本兼容（OSSDesign 270 / 272）

### 12.1 结构差异

| 维度 | 272.x（新） | 270.150.107（老） |
|---|---|---|
| 路由注册 | `ossdiyservice.py` 里 `rest.G_APPLICATION.add_handlers(...)` | 平台自研 ROA：`rest.INIT_APPLICATION` → `REGISTER_SERVANT` → `START_APPLICATION`；`OSSApplication` **没有 add_handlers** |
| 底层 HTTP | Tornado | **也是 Tornado 6.6**（`OSSRequestHandler` 继承 `tornado.web.RequestHandler`） |
| 静态目录 | `plugin/` 可用 | **只认已注册目录**，`plugin/` 404；`osmuwebsite_app/` 可用 |
| 前端入口 | `osmuwebsite_app/app_main.js` | 同路径 |

### 12.2 目录布局（profile 化）

```
script/hud/
├── common/                     # 唯一实现（两版本共用）
│   ├── broker.py hud_proxy.py hud.js
│   ├── deploy.sh install-all.sh uninstall-all.sh restore.sh recover.sh
│   ├── hud_register.py         # 272 风格注册器（add_handlers / Application 赋值）
│   └── cogagent-hud-broker.service manifest.json
├── profiles/
│   ├── ossdesign-272/{register.sh,register_impl.py,notes.md}   # G_APPLICATION.add_handlers
│   └── ossdesign-270/{register.sh,register_impl.py,notes.md}   # Tornado Application.__init__ 旁路
├── install-full.sh             # 全量包入口
└── SYNC.md
```

服务器上：`/opt/cloud/manager/tools/cogagent-hud/`（common 文件）+ `profiles/`。

### 12.3 自动识别

```bash
grep -q "\.add_handlers(" ossdiyservice.py   → ossdesign-272
grep -q "INIT_APPLICATION"  ossdiyservice.py  → ossdesign-270
```

`deploy.sh` 按识别结果调用对应 `profiles/<x>/register.sh`；前端**统一**装到
`webapps/ossdesignwebsite/osmuwebsite_app/hud.vN.js`（两版本都可访问）。

### 12.4 270 上必须的三条修复（已进 common/）

| 标记 | 内容 |
|---|---|
| `HUD_BRIDGE_V6` | 给 `tornado.web.Application.__init__` 打旁路，`insert(0)` 插路由（append 会被平台兜底 handler 吞掉） |
| `WAIT_READY_V1` | broker 不再依赖 launcher 打印 "listening"；账号识别后主动探测 `service-local.json` + `/api/session` |
| `LOGIN_RESET_V1` / `LOGIN_RETRY_V2` | 卡住的登录票据自动清理；桥白名单补 `login/reset`、`login/active`；HUD 遇"另一个登录"自动重置重试 |

### 12.5 分场景安装

| 场景 | 命令 | 说明 |
|---|---|---|
| 272 装 HUD | `bash common/install-all.sh` | 自动注册、前端放 osmuwebsite_app |
| 270 装 HUD | 同上 | profile 自动选 270 |
| OSSDesign 升级 | 同上（重跑） | 新版本目录 = 全新文件，需重新注册 + 补 bootstrap |
| 只升前端 | `bash common/deploy.sh` | 生成 hud.vN+1，改 bootstrap，不动注册 |
| 重装 cogagent | `--cogagent-pkg=x.run --yes-wipe` | 自动备份 + 装完自动还原 |
| 卸载 | `bash common/uninstall-all.sh --yes` | 两种标记都能清 |

---

## 附录 A：`hud_proxy.py`（桥，含诊断补丁）

```python
#!/usr/bin/env python3
"""OSSDesign 侧的 HUD 桥。

放在 $APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py
暴露 /rest/ossdesign/v1/designer/hud/*，把请求原样转给本机 broker（127.0.0.1:18765）。

约束（review 时可直接 grep）：
  - 不读 X-User-Name
  - 不读 /srv/cogagent（凭据只在 broker 手里）
  - 不 import ossdesign.domain.*

兼容 Tornado 4.x / 5.x / 6.x：统一用 tornado.gen.coroutine。
"""

import json

from tornado import gen
from tornado.httpclient import AsyncHTTPClient, HTTPRequest
from tornado.web import RequestHandler

BROKER = "http://127.0.0.1:18765"
TIMEOUT = 60
ROUTES = {
    "status": ("GET", "/status"),
    "login/start": ("POST", "/login/start"),
    "login/status": ("GET", "/login/status"),
    "login/cancel": ("POST", "/login/cancel"),
    "logout": ("POST", "/logout"),
    "sessions": ("GET", "/agent/sessions"),
    "session": ("POST", "/agent/session"),
    "messages": ("GET", "/agent/messages"),
    "prompt": ("POST", "/agent/prompt"),
    "reply": ("POST", "/agent/reply"),
    "interrupt": ("POST", "/agent/interrupt"),
    "events": ("GET", "/agent/events"),
}


class HudProxyHandler(RequestHandler):
    """一个 handler 覆盖 hud 下所有路径。"""

    def set_default_headers(self):
        self.set_header("Cache-Control", "no-store")

    @gen.coroutine
    def get(self, route):
        yield self.dispatch("GET", route)

    @gen.coroutine
    def post(self, route):
        yield self.dispatch("POST", route)

    @gen.coroutine
    def dispatch(self, method, route):
        route = (route or "").strip("/")
        mapping = ROUTES.get(route)
        if not mapping:
            self.set_status(404)
            self.finish(json.dumps({"error": "unknown_route", "route": route}))
            return
        expect, target = mapping
        if expect != method:
            self.set_status(405)
            self.finish(json.dumps({"error": "method_not_allowed"}))
            return

        query = self.request.query
        url = BROKER + target + (("?" + query) if query else "")
        headers = {"Accept": "application/json, text/event-stream"}
        handle = self.request.headers.get("X-Hud-Handle")
        if handle:
            headers["X-Hud-Handle"] = handle
        body = None
        if method == "POST":
            body = self.request.body or b"{}"
            headers["Content-Type"] = "application/json"

        if route == "events":
            yield self.stream(url, headers)
            return

        request = HTTPRequest(url, method=method, body=body, headers=headers,
                              request_timeout=TIMEOUT, follow_redirects=False)
        try:
            response = yield AsyncHTTPClient().fetch(request, raise_error=False)
        except Exception as exc:  # noqa: BLE001
            self.set_status(502)
            self.finish(json.dumps({"error": "broker_unreachable", "detail": str(exc)}))
            return
        self.set_status(response.code)
        self.set_header("Content-Type", response.headers.get("Content-Type", "application/json; charset=utf-8"))
        self.finish(response.body or b"")

    @gen.coroutine
    def stream(self, url, headers):
        self.set_header("Content-Type", "text/event-stream")
        self.set_header("Cache-Control", "no-store")
        self.set_header("X-Accel-Buffering", "no")
        self.set_header("Connection", "close")

        def on_chunk(chunk):
            self.write(chunk)
            self.flush()

        request = HTTPRequest(url, method="GET", headers=headers,
                              request_timeout=0, follow_redirects=False,
                              streaming_callback=on_chunk)
        try:
            yield AsyncHTTPClient().fetch(request, raise_error=False)
        except Exception:  # noqa: BLE001
            pass
        self.finish()

```

---

## 附录 B：`broker.py`（容器外进程，**当前服务器上缺失，需按此恢复**）

```python
#!/usr/bin/env python3
"""cogagent HUD broker.

职责（只做这三件事）：
  1. 驱动 cogagent 的 SSO 登录（无 TTY），拿到 cogagent 账号
  2. 按 cogagent 账号启动/复用 serve 实例，读取其凭据
  3. 发放 handle，并把前端请求代理到对应实例

不做什么：不存会话、不碰 OSSDIY 数据、不读 X-User-Name。

用法：
  python3 broker.py --port 18765
"""

import argparse
import base64
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import zlib
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

URL_RE = re.compile(r"^https://\S*oauth2/authorize\S*$")
ACCOUNT_RE = re.compile(r"^COGAGENT_LOGIN_ACCOUNT=(\S+)$")
LISTEN_RE = re.compile(r"server listening on http://127\.0\.0\.1:(\d+)")

STATE_LOCK = threading.RLock()
TICKETS = {}
HANDLES = {}
INSTANCES = {}


def log(msg):
    sys.stderr.write(time.strftime("[%H:%M:%S] ") + msg + "\n")
    sys.stderr.flush()


def account_port(account):
    return 41000 + (zlib.crc32(account.encode("utf-8")) % 20000)


def credential(root_base, account):
    path = os.path.join(root_base, account, "state", "cogagent", "service-local.json")
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return None
    password = data.get("password") or ""
    url = data.get("url") or ""
    port = None
    if url:
        try:
            port = int(urlparse(url).port or 0) or None
        except ValueError:
            port = None
    if not password:
        return None
    return {"password": password, "port": port or account_port(account)}


def basic(password):
    raw = ("opencode:" + password).encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("ascii")


def upstream_get(base, path, password, timeout=15):
    req = urllib.request.Request(base + path, method="GET")
    req.add_header("Authorization", basic(password))
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read()


class Server:
    def __init__(self, args):
        self.args = args
        self.root_base = args.root
        self.state_dir = args.state_dir
        os.makedirs(self.state_dir, exist_ok=True)
        self.handles_path = os.path.join(self.state_dir, "handles.json")
        self._load_handles()

    # ---------- 持久化 ----------
    def _load_handles(self):
        try:
            with open(self.handles_path, encoding="utf-8") as fh:
                data = json.load(fh)
            HANDLES.update(data.get("handles") or {})
        except (OSError, ValueError):
            pass

    def _save_handles(self):
        tmp = self.handles_path + ".tmp"
        payload = json.dumps({"handles": HANDLES}, ensure_ascii=False)
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(payload)
        os.replace(tmp, self.handles_path)

    # ---------- 实例 ----------
    def instance(self, account):
        entry = INSTANCES.get(account)
        if not entry:
            return None
        proc = entry.get("proc")
        if proc is not None and proc.poll() is not None:
            log("instance for %s exited with %s" % (account, proc.returncode))
            entry["state"] = "exited"
        return entry

    def ensure_instance(self, account):
        """复用已有实例；没有则起一个（登录由调用方先完成，这里只起 serve）。"""
        entry = self.instance(account)
        if entry and entry.get("state") == "ready":
            cred = credential(self.root_base, account)
            if cred and self.probe(cred["port"], cred["password"]):
                return entry
        cred = credential(self.root_base, account)
        if cred and self.probe(cred["port"], cred["password"]):
            entry = {"account": account, "port": cred["port"], "state": "ready", "proc": None}
            INSTANCES[account] = entry
            return entry
        return None

    def probe(self, port, password, timeout=4):
        try:
            status, _ = upstream_get("http://127.0.0.1:%d" % port, "/api/session", password, timeout)
            return status == 200
        except Exception:
            return False

    def start_login(self):
        """起一个登录进程；它成功后自身变成 serve。"""
        if any(t.get("state") in ("pending", "serving") for t in TICKETS.values()):
            return None, "另一个登录正在进行"
        ticket = secrets.token_urlsafe(16)
        env = dict(os.environ)
        env["COGAGENT_SERVE_ONLY"] = "1"
        env.pop("COGAGENT_NO_SANDBOX", None)
        proc = subprocess.Popen(
            [self.args.launcher],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=env,
            text=True,
            bufsize=1,
        )
        entry = {
            "state": "pending",
            "proc": proc,
            "url": None,
            "account": None,
            "port": None,
            "reason": None,
            "created": time.time(),
            "deadline": time.time() + self.args.login_timeout,
        }
        with STATE_LOCK:
            TICKETS[ticket] = entry
        threading.Thread(target=self._pump, args=(ticket, entry), daemon=True).start()
        return ticket, None

    def _pump(self, ticket, entry):
        proc = entry["proc"]
        try:
            for line in proc.stdout:
                line = line.rstrip("\n")
                m = URL_RE.match(line.strip())
                if m and not entry["url"]:
                    entry["url"] = line.strip()
                    log("ticket %s url captured" % ticket)
                    continue
                m = ACCOUNT_RE.match(line.strip())
                if m:
                    entry["account"] = m.group(1)
                    entry["state"] = "serving"
                    log("ticket %s account %s" % (ticket, m.group(1)))
                    reused = self.ensure_instance(entry["account"])
                    if reused:
                        entry["port"] = reused["port"]
                        log("ticket %s reuse existing instance on %d" % (ticket, reused["port"]))
                        try:
                            proc.terminate()
                        except Exception:
                            pass
                        self._finish(ticket, entry, proc=None)
                        return
                    continue
                m = LISTEN_RE.search(line)
                if m:
                    entry["port"] = int(m.group(1))
                    log("ticket %s listening on %s" % (ticket, m.group(1)))
                    self._finish(ticket, entry)
                    continue
            proc.wait(timeout=5)
        except Exception as exc:  # noqa: BLE001
            log("pump error for %s: %s" % (ticket, exc))
        if entry["state"] in ("pending", "serving"):
            entry["state"] = "failed"
            entry["reason"] = "登录进程已退出"

    def _finish(self, ticket, entry, proc="keep"):
        account = entry["account"]
        port = entry["port"]
        cred = None
        for _ in range(20):
            cred = credential(self.root_base, account)
            if cred and self.probe(port, cred["password"]):
                break
            time.sleep(0.5)
        if not cred:
            entry["state"] = "failed"
            entry["reason"] = "读不到 service-local.json"
            return
        handle = secrets.token_urlsafe(32)
        with STATE_LOCK:
            HANDLES[handle] = {"account": account, "port": port, "created": time.time()}
            if (INSTANCES.get(account) or {}).get("state") != "ready":
                INSTANCES[account] = {"account": account, "port": port, "state": "ready",
                                      "proc": entry["proc"] if proc == "keep" else proc}
            entry["handle"] = handle
            entry["state"] = "ready"
            self._save_handles()
        log("ticket %s ready, account=%s port=%d" % (ticket, account, port))

    def resolve(self, handle):
        info = HANDLES.get(handle)
        if not info:
            return None
        cred = credential(self.root_base, info["account"])
        if not cred:
            return None
        return {"account": info["account"], "port": cred["port"], "password": cred["password"]}


class Handler(BaseHTTPRequestHandler):
    server_version = "cogagent-hud-broker/1.0"
    protocol_version = "HTTP/1.1"

    @property
    def app(self):
        return self.server.app

    def log_message(self, fmt, *args):  # noqa: A003
        log("http %s - %s" % (self.address_string(), fmt % args))

    # ---------- 工具 ----------
    def body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except ValueError:
            return {}

    def send_json(self, code, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def require_handle(self):
        handle = self.headers.get("X-Hud-Handle") or ""
        info = self.app.resolve(handle)
        if not info:
            self.send_json(401, {"error": "handle_invalid"})
            return None, None
        return handle, info

    # ---------- 路由 ----------
    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/status":
            with STATE_LOCK:
                items = [
                    {"account": i["account"], "port": i["port"], "state": i["state"]}
                    for i in INSTANCES.values()
                ]
            self.send_json(200, {"instances": items, "count": len(items)})
            return
        if path == "/login/status":
            ticket = (parse_qs(parsed.query).get("ticket") or [""])[0]
            entry = TICKETS.get(ticket)
            if not entry:
                self.send_json(404, {"error": "ticket_not_found"})
                return
            if entry["state"] in ("pending", "serving") and time.time() > entry["deadline"]:
                entry["state"] = "failed"
                entry["reason"] = "登录超时"
                try:
                    entry["proc"].terminate()
                except Exception:
                    pass
            payload = {"state": entry["state"]}
            for key in ("url", "account", "handle", "reason"):
                if entry.get(key):
                    payload[key] = entry[key]
            self.send_json(200, payload)
            return
        if path.startswith("/agent/"):
            handle, info = self.require_handle()
            if not info:
                return
            self.proxy(path, info, parsed)
            return
        self.send_json(404, {"error": "not_found"})

    def do_POST(self):  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/login/start":
            ticket, error = self.app.start_login()
            if error:
                self.send_json(503, {"error": error})
                return
            entry = TICKETS[ticket]
            for _ in range(100):
                if entry.get("url"):
                    break
                time.sleep(0.1)
            self.send_json(200, {"ticket": ticket, "url": entry.get("url"), "expiresIn": self.app.args.login_timeout})
            return
        if path == "/login/cancel":
            ticket = (self.body().get("ticket") or "")
            entry = TICKETS.get(ticket)
            if not entry:
                self.send_json(404, {"error": "ticket_not_found"})
                return
            try:
                entry["proc"].terminate()
            except Exception:
                pass
            entry["state"] = "failed"
            entry["reason"] = "已取消"
            self.send_json(200, {"state": "idle"})
            return
        if path == "/logout":
            handle = (self.body().get("handle") or self.headers.get("X-Hud-Handle") or "")
            with STATE_LOCK:
                HANDLES.pop(handle, None)
                self.app._save_handles()
            self.send_json(200, {"state": "idle"})
            return
        if path.startswith("/agent/"):
            handle, info = self.require_handle()
            if not info:
                return
            self.proxy(path, info, parsed)
            return
        self.send_json(404, {"error": "not_found"})

    # ---------- 代理 ----------
    def proxy(self, path, info, parsed):
        body = b""
        if self.command == "POST":
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b"{}"
        method = self.command
        if path == "/agent/events":
            self.stream_events(info)
            return
        target, payload = self.map_path(path, parsed, body)
        if target is None:
            self.send_json(400, {"error": "bad_request"})
            return
        req = urllib.request.Request(
            "http://127.0.0.1:%d%s" % (info["port"], target), data=payload, method=method
        )
        req.add_header("Authorization", basic(info["password"]))
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
                status = resp.status
        except urllib.error.HTTPError as exc:
            data = exc.read()
            status = exc.code
        except Exception as exc:  # noqa: BLE001
            self.send_json(502, {"error": "upstream_failed", "detail": str(exc)})
            return
        if status == 401:
            self.send_json(401, {"error": "upstream_unauthorized"})
            return
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def map_path(self, path, parsed, body):
        if path == "/agent/sessions":
            return "/api/session", None
        if path == "/agent/session":
            return "/api/session", body
        if path == "/agent/messages":
            session = (parse_qs(parsed.query).get("sessionID") or [""])[0]
            if not session:
                return None, None
            return "/api/session/%s/message" % session, None
        if path == "/agent/prompt":
            try:
                data = json.loads(body.decode("utf-8"))
            except ValueError:
                return None, None
            session = data.get("sessionID")
            if not session:
                return None, None
            return "/api/session/%s/prompt" % session, json.dumps({"text": data.get("text", "")}).encode("utf-8")
        if path == "/agent/reply":
            try:
                data = json.loads(body.decode("utf-8"))
            except ValueError:
                return None, None
            session = data.get("sessionID")
            request = data.get("requestID")
            if not session or not request:
                return None, None
            payload = {"decision": data.get("decision", "once")}
            if data.get("message"):
                payload["message"] = data["message"]
            return "/api/session/%s/permission/%s/reply" % (session, request), json.dumps(payload).encode("utf-8")
        if path == "/agent/interrupt":
            try:
                data = json.loads(body.decode("utf-8"))
            except ValueError:
                return None, None
            session = data.get("sessionID")
            if not session:
                return None, None
            return "/api/session/%s/interrupt" % session, b"{}"
        return None, None

    def stream_events(self, info):
        conn = HTTPConnection("127.0.0.1", info["port"], timeout=None)
        try:
            conn.request("GET", "/api/event", headers={
                "Authorization": basic(info["password"]),
                "Accept": "text/event-stream",
            })
            upstream = conn.getresponse()
        except Exception as exc:  # noqa: BLE001
            self.send_json(502, {"error": "upstream_failed", "detail": str(exc)})
            return
        if upstream.status != 200:
            self.send_json(upstream.status, {"error": "upstream_status"})
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        self.close_connection = True
        self.end_headers()
        last_ping = time.time()
        try:
            while True:
                chunk = upstream.read(1)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
                if time.time() - last_ping > 15:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    last_ping = time.time()
        except Exception:  # noqa: BLE001
            pass
        finally:
            try:
                conn.close()
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18765)
    parser.add_argument("--hostname", default="127.0.0.1")
    parser.add_argument("--root", default="/srv/cogagent/users")
    parser.add_argument("--state-dir", default="/var/lib/cogagent-hud")
    parser.add_argument("--launcher", default="/usr/local/bin/cogagent")
    parser.add_argument("--login-timeout", type=int, default=300)
    args = parser.parse_args()

    app = Server(args)
    httpd = ThreadingHTTPServer((args.hostname, args.port), Handler)
    httpd.app = app
    httpd.daemon_threads = True
    log("broker listening on http://%s:%d" % (args.hostname, args.port))
    httpd.serve_forever()


if __name__ == "__main__":
    main()

```

---

## 附录 C：systemd 单元与安装脚本

```ini
[Unit]
Description=cogagent HUD broker
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/cloud/manager/tools/cogagent-hud/broker.py --port 18765 --root /srv/cogagent/users --state-dir /var/lib/cogagent-hud
Restart=on-failure
RestartSec=3
User=root
Group=root
StandardOutput=append:/var/log/cogagent-hud/broker.log
StandardError=append:/var/log/cogagent-hud/broker.log

[Install]
WantedBy=multi-user.target

```

```bash
#!/bin/bash
# cogagent HUD broker 安装（幂等）
set -euo pipefail
SRC=$(cd "$(dirname "$0")" && pwd)
DEST=/opt/cloud/manager/tools/cogagent-hud
STATE=/var/lib/cogagent-hud
LOGDIR=/var/log/cogagent-hud

[ "$(id -u)" = "0" ] || { echo "必须以 root 运行"; exit 1; }

echo "== 1/4 目录"
install -d -m 0750 "$DEST"
install -d -m 0700 "$STATE"
install -d -m 0755 "$LOGDIR"

echo "== 2/4 broker.py"
install -m 0750 "$SRC/broker.py" "$DEST/broker.py"
python3 -m py_compile "$DEST/broker.py"

echo "== 3/4 systemd unit"
install -m 0644 "$SRC/cogagent-hud-broker.service" /etc/systemd/system/cogagent-hud-broker.service
systemctl daemon-reload
if systemctl is-active --quiet cogagent-hud-broker; then
  systemctl restart cogagent-hud-broker
else
  systemctl enable --now cogagent-hud-broker
fi

echo "== 4/4 自检"
sleep 2
systemctl is-active cogagent-hud-broker && echo "service: active"
curl -s --noproxy '*' -o /dev/null -w 'broker /status = %{http_code}\n' http://127.0.0.1:18765/status || true
curl -s --noproxy '*' http://127.0.0.1:18765/status || true
echo
echo "日志: tail -f /var/log/cogagent-hud/broker.log"

```
