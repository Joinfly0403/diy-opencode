#!/bin/bash
# 部署 HUD 到本机 OSSDesign（自动识别 270 / 272 两套注册方式）
#   bash deploy.sh                自动版本号并切换指向
#   bash deploy.sh --keep         只安装文件，不改 bootstrap
#   bash deploy.sh --version v60  指定版本号
set -euo pipefail

SRC=$(cd "$(dirname "$0")" && pwd)
TOOLS=/opt/cloud/manager/tools/cogagent-hud
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
WEB="$APP_ROOT/webapps/ossdesignwebsite"
HUD_DIR="$WEB/osmuwebsite_app"
BOOT="$HUD_DIR/app_main.js"
PROXY="$APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py"
SVC="$APP_ROOT/pyscript/ossdiyservice.py"

say() { printf '%s\n' "$*"; }
ok()  { printf '[ OK ] %s\n' "$*"; }
bad() { printf '[FAIL] %s\n' "$*"; }

[ "$(id -un)" = "root" ] || { bad "请用 root"; exit 1; }
SVC_USER=ossadm; id "$SVC_USER" >/dev/null 2>&1 || SVC_USER=root
SVC_GROUP=$(id -gn "$SVC_USER")

for f in broker.py hud_proxy.py hud.js recover.sh hud_register.py; do
  [ -f "$SRC/$f" ] || { bad "缺失文件: $SRC/$f"; exit 1; }
done

KEEP=0; VERSION=""
while [ $# -gt 0 ]; do
  case "$1" in
    --keep) KEEP=1; shift ;;
    --version) VERSION="$2"; shift 2 ;;
    *) bad "未知参数 $1"; exit 2 ;;
  esac
done

PROFILE=""
if grep -q "\.add_handlers(" "$SVC" 2>/dev/null; then
  PROFILE=ossdesign-272
elif grep -q "INIT_APPLICATION" "$SVC" 2>/dev/null; then
  PROFILE=ossdesign-270
fi
say "== 目标 =="
say "APP_ROOT : $APP_ROOT"
say "profile  : ${PROFILE:-<未识别>}"

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
say "== 1) broker / recover / hud_register =="
install -d -m 0750 "$TOOLS"
install -m 0750 "$SRC/broker.py"       "$TOOLS/broker.py"
install -m 0750 "$SRC/recover.sh"      "$TOOLS/recover.sh"
install -m 0750 "$SRC/hud_register.py" "$TOOLS/hud_register.py"
python3 -c "import py_compile;py_compile.compile('$TOOLS/broker.py', cfile='/tmp/broker.pyc', doraise=True)"
ok "已安装"

say ""
say "== 2) 桥 + 注册 =="
install -d "$(dirname "$PROXY")"
install -m 0644 "$SRC/hud_proxy.py" "$PROXY"
python3 -c "import py_compile;py_compile.compile('$PROXY', cfile='/tmp/proxy.pyc', doraise=True)"

REG_CHANGED=0; REG_FAIL=0
if grep -q "HUD_BRIDGE_V3\|HUD_BRIDGE_V6" "$SVC" 2>/dev/null; then
  ok "注册块已存在"
elif [ -n "$PROFILE" ] && [ -d "$SRC/../profiles/$PROFILE" ]; then
  install -d "$TOOLS/profiles"
  cp -rf "$SRC/../profiles/$PROFILE" "$TOOLS/profiles/"
  bash "$TOOLS/profiles/$PROFILE/register.sh" "$SVC" --apply
  RC=$?
  case $RC in
    0) REG_CHANGED=1; ok "已注册（$PROFILE）" ;;
    4) bad "注册后语法校验失败（已回滚）"; REG_FAIL=1 ;;
    *) bad "注册未完成（rc=$RC），继续后续步骤"; REG_FAIL=1 ;;
  esac
else
  bad "无法识别注册方式（既无 add_handlers 也无 INIT_APPLICATION）"
  REG_FAIL=1
fi

say ""
say "== 3) 前端 -> $HUD_FILE =="
install -d "$HUD_DIR"
install -m 0640 "$SRC/hud.js" "$HUD_DIR/$HUD_FILE"
chown "$SVC_USER":"$SVC_GROUP" "$HUD_DIR/$HUD_FILE" 2>/dev/null || true
if command -v node >/dev/null 2>&1; then
  node --check "$HUD_DIR/$HUD_FILE" && ok "js 语法检查通过"
fi

say ""
say "== 4) bootstrap =="
TARGET="/ossdesignwebsite/osmuwebsite_app/$HUD_FILE"
python3 - "$BOOT" "$TARGET" <<'PYBOOT'
import sys, os, shutil, time, re
p, target = sys.argv[1], sys.argv[2]
if not os.path.isfile(p):
    print("NO_BOOT"); raise SystemExit(0)
s = open(p, encoding="utf-8", errors="surrogateescape").read()
if "oss-hud-bootstrap-v2" in s:
    s2 = re.sub(r"/ossdesignwebsite/(?:plugin/hud|osmuwebsite_app)/hud(?:\.v\d+)?\.js", target, s)
    if s2 != s:
        shutil.copy2(p, p + ".bak." + time.strftime("%Y%m%d%H%M%S"))
        open(p, "w", encoding="utf-8", errors="surrogateescape").write(s2)
        print("bootstrap ->", target)
    else:
        print("bootstrap 已指向")
else:
    boot = (';/*oss-hud-bootstrap-v2*/(function(){try{'
            'if(window.__OSS_HUD_BOOT_V2__)return;window.__OSS_HUD_BOOT_V2__=1;'
            'var s=document.createElement("script");'
            's.src="' + target + '";'
            's.async=false;s.onerror=function(){};'
            '(document.head||document.documentElement).appendChild(s);'
            '}catch(e){}})();\n')
    shutil.copy2(p, p + ".bak." + time.strftime("%Y%m%d%H%M%S"))
    open(p, "w", encoding="utf-8", errors="surrogateescape").write(s + boot)
    print("bootstrap 已追加 ->", target)
PYBOOT
chown "$SVC_USER":"$SVC_GROUP" "$BOOT" 2>/dev/null || true
chmod 0640 "$BOOT" 2>/dev/null || true

say ""
say "== 5) 重启 broker =="
systemctl restart cogagent-hud-broker 2>/dev/null || true
sleep 2
systemctl is-active --quiet cogagent-hud-broker && ok "broker active" || bad "broker 未运行"

if [ "$REG_CHANGED" = "1" ]; then
  say "注册有变化：重启 OSSDesign…"
  if id ossadm >/dev/null 2>&1; then
    su - ossadm -c "bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd restartapp -app OSSDesignService" 2>/dev/null | tail -2 || true
  else
    bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd restartapp -app OSSDesignService 2>/dev/null | tail -2 || true
  fi
fi

say ""
[ "$REG_FAIL" = "1" ] && bad "注册未完成：/hud/* 仍会 404"
say "完成：前端 $HUD_FILE（profile=${PROFILE:-unknown}）"
[ "$REG_FAIL" = "1" ] && exit 3 || true
