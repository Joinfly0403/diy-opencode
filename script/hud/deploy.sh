#!/bin/bash
# 从仓库文件部署 cogagent HUD 到本机 OSSDesign（幂等、可回滚）
#
#   用法（root）：
#     bash deploy.sh              自动版本号（hud.vN+1.js）并切换指向
#     bash deploy.sh --keep       安装文件但不切换 bootstrap 指向（安全预演）
#     bash deploy.sh --version v60  指定版本号
#
# 做的事：
#   1) 安装 broker.py / recover.sh 到 /opt/cloud/manager/tools/cogagent-hud（ossadm 属主）
#   2) 安装 hud_proxy.py 到版本目录，并打注册块（锚点不匹配则拒绝）
#   3) 安装 hud.js 为 hud.vN.js，并改写 app_main.js 的 bootstrap 与 recover.sh 指向
#   4) 按需重启 broker / OSSDesign
#   5) 最后执行 recover.sh snapshot + check
set -euo pipefail

SRC=$(cd "$(dirname "$0")" && pwd)
TOOLS=/opt/cloud/manager/tools/cogagent-hud
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
HUD_DIR="$APP_ROOT/webapps/ossdesignwebsite/plugin/hud"
BOOT="$APP_ROOT/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js"
PROXY="$APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py"
SVC="$APP_ROOT/pyscript/ossdiyservice.py"
R="$TOOLS/recover.sh"

say()  { printf '%s\n' "$*"; }
ok()   { printf '[ OK ] %s\n' "$*"; }
bad()  { printf '[FAIL] %s\n' "$*"; }

[ "$(id -un)" = "root" ] || { bad "请用 root 执行"; exit 1; }
for f in broker.py hud_proxy.py hud.js recover.sh; do
  [ -f "$SRC/$f" ] || { bad "缺少仓库文件: $SRC/$f"; exit 1; }
done

KEEP=0; VERSION=""
while [ $# -gt 0 ]; do
  case "$1" in
    --keep) KEEP=1; shift ;;
    --version) VERSION="$2"; shift 2 ;;
    *) bad "未知参数 $1"; exit 2 ;;
  esac
done

say "== 目标 =="
say "SRC      : $SRC"
say "APP_ROOT : $APP_ROOT"
say "KEEP     : $KEEP"

# ---- 自动版本号 ----
if [ -z "$VERSION" ]; then
  MAX=0
  for f in "$HUD_DIR"/hud.v*.js; do
    [ -e "$f" ] || continue
    n=$(basename "$f" .js); n=${n#hud.v}
    case "$n" in ''|*[!0-9]*) continue;; esac
    [ "$n" -gt "$MAX" ] && MAX=$n
  done
  VERSION="v$((MAX + 1))"
fi
HUD_FILE="hud.$VERSION.js"
say "新版本   : $HUD_FILE"

say ""
say "== 1) broker.py / recover.sh =="
install -d -o ossadm -g ossgroup -m 0750 "$TOOLS"
install -m 0750 -o ossadm -g ossgroup "$SRC/broker.py" "$TOOLS/broker.py"
install -m 0750 -o ossadm -g ossgroup "$SRC/recover.sh" "$TOOLS/recover.sh"
python3 -c "import py_compile;py_compile.compile('$TOOLS/broker.py', cfile='/tmp/broker.pyc', doraise=True)"
ok "已安装 broker.py / recover.sh"

say ""
say "== 2) hud_proxy.py + 注册块 =="
install -d -o ossadm -g ossgroup -m 0750 "$(dirname "$PROXY")"
install -m 0644 -o ossadm -g ossgroup "$SRC/hud_proxy.py" "$PROXY"
python3 -c "import py_compile;py_compile.compile('$PROXY', cfile='/tmp/proxy.pyc', doraise=True)"
REG_CHANGED=0
if grep -q "HUD_BRIDGE_V3" "$SVC" 2>/dev/null; then
  ok "注册块已存在"
else
  python3 - "$SVC" <<'PY'
import sys, shutil, time
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
anchor = (
    '    from rest.handler import OSSRequestHandler\n'
    '    rest.G_APPLICATION.add_handlers(r".*", [(r"/ossdesignwebsite/(.*)", OSSRequestHandler)])\n'
)
if anchor not in s:
    print("ANCHOR_MISMATCH"); raise SystemExit(3)
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
shutil.copy2(p, p + ".bak." + time.strftime("%Y%m%d%H%M%S"))
open(p, "w", encoding="utf-8").write(s.replace(anchor, anchor + block, 1))
print("REGISTERED")
PY
  case $? in
    0) REG_CHANGED=1; ok "已写入注册块" ;;
    3) bad "锚点不匹配：ossdiyservice.py 结构变了，请先人工确认" ; exit 3 ;;
    *) bad "注册失败"; exit 4 ;;
  esac
fi

say ""
say "== 3) hud.js -> $HUD_FILE =="
install -d -o ossadm -g ossgroup -m 0750 "$HUD_DIR"
install -m 0640 -o ossadm -g ossgroup "$SRC/hud.js" "$HUD_DIR/$HUD_FILE"
if command -v node >/dev/null 2>&1; then
  node --check "$HUD_DIR/$HUD_FILE"
  ok "js 语法检查通过"
fi

if [ "$KEEP" = "1" ]; then
  say "（--keep）不改 bootstrap 指向，线上仍是旧版本"
else
  python3 - "$BOOT" "$R" "$HUD_FILE" <<'PY'
import sys, shutil, time, re
boot, recover, name = sys.argv[1], sys.argv[2], sys.argv[3]
target = "/ossdesignwebsite/plugin/hud/" + name
for p in (boot, recover):
    s = open(p, encoding="utf-8").read()
    s2 = re.sub(r"/ossdesignwebsite/plugin/hud/hud(\.v\d+)?\.js", target, s)
    if s2 != s:
        shutil.copy2(p, p + ".bak." + time.strftime("%Y%m%d%H%M%S"))
        open(p, "w", encoding="utf-8").write(s2)
        print("updated", p.rsplit("/", 1)[-1])
    else:
        s3 = re.sub(r"plugin/hud/hud(\.v\d+)?\.js", "plugin/hud/" + name, s)
        if s3 != s:
            shutil.copy2(p, p + ".bak." + time.strftime("%Y%m%d%H%M%S"))
            open(p, "w", encoding="utf-8").write(s3)
            print("updated(rel)", p.rsplit("/", 1)[-1])
        else:
            print("no change", p.rsplit("/", 1)[-1])
PY
  chown ossadm:ossgroup "$BOOT" 2>/dev/null || true
  chmod 0640 "$BOOT"
  ok "bootstrap / recover 指向 $HUD_FILE"
fi

say ""
say "== 4) 重启 =="
if systemctl is-active --quiet cogagent-hud-broker; then
  systemctl restart cogagent-hud-broker
  sleep 2
fi
systemctl is-active --quiet cogagent-hud-broker && ok "broker active" || bad "broker 未运行"
if [ "$REG_CHANGED" = "1" ]; then
  say "注册有变化，重启 OSSDesign…"
  su - ossadm -c "bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd restartapp -app OSSDesignService" | tail -3
  sleep 10
fi
pgrep -f ossdiyservice.py >/dev/null && ok "OSSDesign running" || bad "OSSDesign 未运行"

say ""
say "== 5) 快照 + 自检 =="
bash "$R" snapshot | tail -5
bash "$R" check || true

say ""
if [ "$KEEP" = "1" ]; then
  say "完成（--keep：未切换线上版本；验证后可手动改指向或重跑不带 --keep）"
else
  say "完成：线上现在是 $HUD_FILE，请浏览器 Ctrl+Shift+R"
fi
