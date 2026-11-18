# M0 前置验证清单（可执行）

> ## ⚠ 首轮结果与更正（2026-11-17 实测）
>
> | 项 | 首轮结果 | 结论 / 更正 |
> |---|---|---|
> | 1 注册文件 | **写**：`state/cogagent/service-local.json` 与 `config/cogagent/service-local.json`，`0600 root`，password 长度 43，url 与端口一致 | ✅ 13.1 确认。**但 `OPENCODE_PASSWORD` 被忽略**：用 `m0-test-pass` 请求 401，实际密码是随机生成的 → **broker 必须读文件**，不能依赖环境变量 |
> | 1 认证 | `no-auth=401`（正确） | ✅ |
> | 2 Tornado | 取解释器的 grep 未命中，`PY` 为空 | 改用 `ps` 取真实解释器路径（见下方"更正 2"） |
> | 3 SSE | 用 `service get password` 得到的密码请求 → **401** | **关键更正**：当前 shell（HOME=/root）下 `service get password` 读的不是实例的状态目录，返回了另一个密码 → 必须从 `/srv/cogagent/users/<账号>/state/cogagent/service-local.json` 取 |
> | 4 应用页 CSP | 带 mgntsession+roarand 仍 **302** | cookie 已失效或非 hiro 所需的那个；需重新登录后整包复制 cookie，并先验证一个受保护 API |
> | 5 端点核对 | openapi.json 因 401 未取到（paths=0） | 用更正后的密码重跑 |
> | 6 环境 | python 3.11.6 / systemd degraded / 18765 空闲 / tools 可写 / 无 jq | ✅ 可开工 |
>
> ### 更正 1：取"当前实例真正在用的密码"
>
> ```bash
> # 找出监听 127.0.0.1:50461 的账号（port 由 crc32(account) 决定）
> for f in /srv/cogagent/users/*/state/cogagent/service-local.json; do
>   url=$(python3 -c "import json;print(json.load(open('$f')).get('url',''))" 2>/dev/null)
>   [ "$url" = "http://127.0.0.1:50461" ] && echo "MATCH: $f"
> done
>
> # 用它做认证
> PW=$(python3 - <<'PY'
> import json,glob
> for p in glob.glob('/srv/cogagent/users/*/state/cogagent/service-local.json'):
>     d=json.load(open(p))
>     if d.get('url')=='http://127.0.0.1:50461': print(d['password']); break
> PY
> )
> curl -s -o /dev/null -w 'auth=%{http_code}\n' -u "opencode:$PW" http://127.0.0.1:50461/api/session
> ```
>
> ### 更正 2：取服务解释器
>
> ```bash
> ps -o args= -p "$(pgrep -f ossdiyservice.py | head -1)"
> # 输出里第一个 python 路径即为解释器，例如 /opt/cloud/rtsp/.../bin/python
> ```
>
> ### 更正 3：应用页 cookie 先做"会话有效性"验证
>
> ```bash
> curl -sk -D- -o /dev/null -H "Cookie: $COOKIE" -X POST \
>   https://10.44.228.181:6701/rest/ossdesign/v1/designer/queryPrjLst | head -3
> ```
> 仍 302 → cookie 过期；在浏览器重新登录后，控制台执行 `document.cookie` 复制**全部** cookie（hiro 需要的可能不止 roarand）。

---

> 目的：在写任何产品代码之前，把 4 个未确认项 + 1 个环境就绪检查落实。
> 全部只读；唯一有副作用的第 1 项用一个**临时目录 + 临时端口**，结束即清理。
> 填完最后一节的"结果回填"即可。

---

## 0. 准备变量

```bash
export APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
export BIN=/usr/local/lib/cogagent/cogagent
export WRAP=/usr/local/bin/cogagent
export PW=$($BIN service get password)      # 43 字符
echo "APP_ROOT=$APP_ROOT  PW_len=${#PW}"
```

---

## 1. 【13.1】`serve --service --port` 是否写 `service-local.json`

用**临时状态目录**，不影响现网实例。

```bash
R=/tmp/m0serve; rm -rf $R; mkdir -p $R
COGAGENT_ROOT=$R \
XDG_STATE_HOME=$R/state XDG_CONFIG_HOME=$R/config \
XDG_DATA_HOME=$R/share XDG_CACHE_HOME=$R/cache \
TMPDIR=$R/tmp \
OPENCODE_PASSWORD=m0-test-pass \
  $BIN serve --service --port 50599 > $R/out.log 2>&1 &
PID=$!
sleep 6

echo "--- 是否监听 ---"
ss -ltn | grep 50599 || echo "NOT LISTENING"
echo "--- 是否写注册文件 ---"
find $R -name 'service-local.json' -printf '%m %u:%g %p\n'
echo "--- 文件内容（密码脱敏）---"
python3 - <<'PY'
import json,glob
for p in glob.glob('/tmp/m0serve/**/service-local.json', recursive=True):
    d=json.load(open(p))
    print(p, {k:(('<masked len=%d>'%len(v)) if k=='password' else v) for k,v in d.items()})
PY
echo "--- 认证探测 ---"
curl -s -o /dev/null -w 'no-auth=%{http_code}\n' http://127.0.0.1:50599/api/session
curl -s -o /dev/null -w 'env-pass=%{http_code}\n' -u opencode:m0-test-pass http://127.0.0.1:50599/api/session

kill $PID 2>/dev/null; sleep 1
rm -rf $R
```

**判定**

| 观察 | 结论 | 后续 |
|---|---|---|
| 有 `service-local.json` 且 `password` = `m0-test-pass` | 沿用 `OPENCODE_PASSWORD`，并写注册文件 | broker 直接读文件取密码 ✅ |
| 有文件但密码是随机的 | `--service` 自生成密码 | broker 读文件即可 ✅ |
| 无文件 | `serve --service` 不注册 | broker 必须自己生成密码并写文件（改 M1 方案） |

---

## 2. 【13.5】Tornado 版本（决定 SSE handler 写法）

要用**服务实际使用的解释器**：

```bash
PY=$(grep -oE '/opt/cloud/rtsp/[^ ]*/bin/python' ${APP_ROOT}/bin/startPythonProcess.sh | head -1)
echo "service python: $PY"
"$PY" - <<'PY'
import tornado, sys
print("python", sys.version.split()[0])
print("tornado", tornado.version)
PY
```

**判定**

| 版本 | SSE handler 写法 |
|---|---|
| ≥ 5.0 | `async def get(self)` + `await self.flush()` |
| 4.x | `@gen.coroutine` + `def get(self)` + `yield self.flush()` |

---

## 3. 【13.7】真实 SSE 帧（事件名与载荷结构）

```bash
OUT=/tmp/m0-events.txt
timeout 6 curl -sN -u "opencode:$PW" http://127.0.0.1:50461/api/event > $OUT
echo "bytes=$(wc -c < $OUT)"
head -6 $OUT
echo "--- 事件名统计 ---"
grep -o '"type":"[^"]*"' $OUT | sort | uniq -c | sort -rn | head -20
```

> 只看不打字的话只有 `server.connected` 与心跳。想抓到消息/工具/审批类事件，需要**发一条真实消息**（会对该 cogagent 账号产生会话记录）：

```bash
# 可选，确认接受副作用再执行
SID=$(curl -s -u "opencode:$PW" -H 'Content-Type: application/json' \
      -d '{"title":"m0-probe"}' http://127.0.0.1:50461/api/session \
      | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])')
echo "SID=$SID"
( timeout 25 curl -sN -u "opencode:$PW" http://127.0.0.1:50461/api/event > /tmp/m0-events2.txt ) &
sleep 1
curl -s -u "opencode:$PW" -H 'Content-Type: application/json' \
     -d '{"text":"reply with the single word OK"}' \
     http://127.0.0.1:50461/api/session/$SID/prompt > /dev/null
wait
grep -o '"type":"[^"]*"' /tmp/m0-events2.txt | sort | uniq -c | sort -rn | head -30
```

**判定**：拿到真实事件名清单 → 回填文档附录 A；若与仓库统计不一致，以实测为准。

---

## 4. 【13.4】应用页 CSP（决定 `window.open` 是否可用）

需要**已登录**的 cookie。浏览器 F12 → Network → 任一请求 → 右键 Copy as cURL，从中取出 `Cookie:` 整行。

```bash
export COOKIE='<粘贴你的 Cookie 整行，含 roarand>'
curl -sk -D- -o /dev/null -H "Cookie: $COOKIE" \
  https://10.44.228.181:6701/eviewwebsite/index.html \
  | grep -iE '^(HTTP/|content-security-policy|x-frame-options|location)'
```

**判定**

| 结果 | 结论 |
|---|---|
| 200 且 CSP 无 `navigate-to` | `window.open` 可用 ✅ |
| 200 且 CSP 含 `navigate-to 'self'` | 改用"复制链接 + 手动打开" |
| 302 到登录页 | cookie 无效，重新取 |

---

## 5. 【依赖核对】安装版实际提供的端点

```bash
curl -s -u "opencode:$PW" http://127.0.0.1:50461/openapi.json -o /tmp/m0-oa.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/m0-oa.json'))
paths=set(d.get('paths',{}))
need=[
 "/api/session",
 "/api/session/{sessionID}",
 "/api/session/{sessionID}/message",
 "/api/session/{sessionID}/prompt",
 "/api/session/{sessionID}/permission",
 "/api/session/{sessionID}/permission/{requestID}/reply",
 "/api/session/{sessionID}/interrupt",
 "/api/session/active",
 "/api/event",
]
for p in need:
    print(("OK   " if p in paths else "MISS ")+p)
print("total paths:", len(paths))
PY
rm -f /tmp/m0-oa.json
```

**判定**：全部 OK 才继续 M2；有 MISS 的，M2/M3 必须按实际路径改写。

---

## 6. 【环境就绪】broker 与部署基础

```bash
echo "--- python ---"; python3 --version
echo "--- systemd ---"; systemctl is-system-running || true
echo "--- 18765 是否被占 ---"; ss -ltn | grep -q ':18765 ' && echo "OCCUPIED" || echo "FREE"
echo "--- 可写目录 ---"
ls -ld /opt/cloud/manager/tools 2>/dev/null || echo "no tools dir"
test -w /opt/cloud/manager/tools && echo "tools WRITABLE" || echo "tools NOT writable"
echo "--- 日志目录 ---"
ls -ld /var/log/cogagent-hud 2>/dev/null || echo "will create /var/log/cogagent-hud"
echo "--- curl/jq ---"
command -v curl; command -v jq || echo "no jq (用 python3 代替)"
```

**判定**：python3 ≥ 3.8、18765 空闲、tools 可写即可开工；否则先调整路径或端口。

---

## 7. 结果回填

| # | 检查项 | 结果 | 对设计的影响 |
|---|---|---|---|
| 1 | `serve --service --port` 是否写注册文件 | 是 / 否 | 否 → broker 自生成密码 |
| 2 | Tornado 版本 | ___ | 4.x → `@gen.coroutine` |
| 3 | 实测事件名 | ___ 个，清单见 /tmp/m0-events2.txt | 回填附录 A |
| 4 | 应用页 CSP | 允许 / 限制 | 限制 → 改为复制链接 |
| 5 | 依赖端点 | 全 OK / 缺 ___ | 缺 → 改接口路径 |
| 6 | 环境 | 就绪 / 缺 ___ | 缺 → 先补 |

把这张表填好贴回来，我就按结果把 M1–M3 的具体代码写死（不再有"到时候再看"）。
