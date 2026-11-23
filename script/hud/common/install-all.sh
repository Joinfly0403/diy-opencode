#!/bin/bash
# cogagent + HUD 一体化安装（幂等，自动识别 OSSDesign 270 / 272）
#
#   bash install-all.sh --check                   只体检
#   bash install-all.sh                           只装/升级 HUD
#   bash install-all.sh --patch-launcher          额外重打 serve-only 补丁
#   bash install-all.sh --cogagent-pkg=x.run --yes-wipe   重装 cogagent（备份+还原）
#   bash install-all.sh --restore=latest | --list-backups | --no-restore
#   bash install-all.sh --no-restart-oss | --keep
set -euo pipefail

SRC=$(cd "$(dirname "$0")" && pwd)
TOOLS=/opt/cloud/manager/tools/cogagent-hud
UNIT=/etc/systemd/system/cogagent-hud-broker.service
STATE=/var/lib/cogagent-hud
LOG=/var/log/cogagent-hud
LAUNCHER=/usr/local/bin/cogagent

CHECK=0; PATCH_LAUNCHER=0; PKG=""; YES_WIPE=0
NO_BACKUP=0; BACKUP_DIR=/var/backups; NO_RESTART_OSS=0; KEEP=0
NO_RESTORE=0; RESTORE=""; LIST_BACKUPS=0; BK=""

while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK=1; shift ;;
    --patch-launcher) PATCH_LAUNCHER=1; shift ;;
    --cogagent-pkg=*) PKG="${1#*=}"; shift ;;
    --yes-wipe) YES_WIPE=1; shift ;;
    --no-backup) NO_BACKUP=1; shift ;;
    --backup-dir=*) BACKUP_DIR="${1#*=}"; shift ;;
    --no-restart-oss) NO_RESTART_OSS=1; shift ;;
    --keep) KEEP=1; shift ;;
    --no-restore) NO_RESTORE=1; shift ;;
    --restore=*) RESTORE="${1#*=}"; shift ;;
    --list-backups) LIST_BACKUPS=1; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "未知参数: $1"; exit 2 ;;
  esac
done

say() { printf '%s\n' "$*"; }
ok()  { printf '[ OK ] %s\n' "$*"; }
warn(){ printf '[WARN] %s\n' "$*"; }
bad() { printf '[FAIL] %s\n' "$*"; }

[ "$(id -un)" = "root" ] || { bad "请用 root"; exit 1; }
SVC_USER=ossadm; id "$SVC_USER" >/dev/null 2>&1 || SVC_USER=root
SVC_GROUP=$(id -gn "$SVC_USER")
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService 2>/dev/null || true)

if [ "$LIST_BACKUPS" = "1" ]; then
  say "== 备份（$BACKUP_DIR）=="
  ls -lh "$BACKUP_DIR"/cogagent-*.tgz 2>/dev/null || say "  （暂无）"
  exit 0
fi

say "==================== 0) 环境检查 ===================="
say "架构      : $(uname -m)"
say "APP_ROOT  : ${APP_ROOT:-<解析失败>}"
say "服务用户  : $SVC_USER"
say "模式      : CHECK=$CHECK PATCH=$PATCH_LAUNCHER PKG=${PKG:-<未指定>} WIPE=$YES_WIPE"

FAIL=0
[ -n "$APP_ROOT" ] && [ -d "$APP_ROOT" ] && ok "OSSDesign 版本目录" || { bad "找不到 OSSDesign"; FAIL=1; }
command -v python3 >/dev/null && ok "python3" || { bad "缺 python3"; FAIL=1; }
command -v systemctl >/dev/null && ok "systemd" || { bad "缺 systemd"; FAIL=1; }
command -v node >/dev/null && ok "node" || warn "没有 node（跳过前端语法检查）"
for f in broker.py hud_proxy.py hud.js recover.sh deploy.sh hud_register.py macro_store.py; do
  [ -f "$SRC/$f" ] || { bad "缺失: $f"; FAIL=1; }
done
[ "$FAIL" = "0" ] && ok "部署文件齐全"

say ""
CUR_PROFILE="unknown"
if [ -n "$APP_ROOT" ]; then
  SVC="$APP_ROOT/pyscript/ossdiyservice.py"
  if grep -q "\.add_handlers(" "$SVC" 2>/dev/null; then CUR_PROFILE=ossdesign-272
  elif grep -q "INIT_APPLICATION" "$SVC" 2>/dev/null; then CUR_PROFILE=ossdesign-270; fi
fi
say "== OSSDesign 版本识别：$CUR_PROFILE =="
case "$CUR_PROFILE" in
  ossdesign-270) ok "老版本：走 Tornado Application 旁路，前端放 osmuwebsite_app/" ;;
  ossdesign-272) ok "新版本：走 G_APPLICATION.add_handlers，前端放 osmuwebsite_app/" ;;
  *) warn "未识别（可能是别的版本或文件结构变化），安装将尝试通用方式" ;;
esac

say ""
say "== cogagent 现状 =="
if [ -x "$LAUNCHER" ]; then
  N=$(grep -c COGAGENT_SERVE_ONLY "$LAUNCHER" 2>/dev/null) || N=0
  ok "启动器存在（serve-only 标记 $N 处）"
else
  warn "启动器缺失（需 --cogagent-pkg 安装）"
fi
[ -d /srv/cogagent/users ] && ok "/srv/cogagent/users" || warn "/srv/cogagent/users 不存在"
systemctl is-active --quiet cogagent-hud-broker 2>/dev/null && ok "broker active" || warn "broker 未运行"

say ""
say "== 安装完整性 =="
HUD_DIR="$APP_ROOT/webapps/ossdesignwebsite/osmuwebsite_app"
BOOT="$HUD_DIR/app_main.js"
PROXY_CHK="$APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py"
BOOT_MARK=0; REG_CNT=0; HUD_CNT=0; PROXY_SIZE=0
[ -f "$BOOT" ] && grep -q "oss-hud-bootstrap-v2" "$BOOT" 2>/dev/null && BOOT_MARK=1
[ -f "$APP_ROOT/pyscript/ossdiyservice.py" ] && grep -q "HUD_BRIDGE_V" "$APP_ROOT/pyscript/ossdiyservice.py" 2>/dev/null && REG_CNT=1
if [ -d "$HUD_DIR" ]; then
  for hf in "$HUD_DIR"/hud*.js; do [ -e "$hf" ] && HUD_CNT=$((HUD_CNT + 1)); done
fi
[ -f "$PROXY_CHK" ] && PROXY_SIZE=$(stat -c%s "$PROXY_CHK" 2>/dev/null) || PROXY_SIZE=0
[ "$PROXY_SIZE" -gt 0 ] && ok "桥文件（$PROXY_SIZE 字节）" || warn "桥文件缺失"
[ "$REG_CNT" -gt 0 ] && ok "注册块" || warn "注册块缺失"
[ "$HUD_CNT" -gt 0 ] && ok "前端（$HUD_CNT 个）" || warn "前端缺失"
[ "$BOOT_MARK" -gt 0 ] && ok "bootstrap 已注入" || warn "bootstrap 缺失（装完会自动补）"

if [ "$CHECK" = "1" ]; then
  say ""
  say "== 检查结束（未改动）=="
  [ "$FAIL" = "0" ] && exit 0 || exit 1
fi

say ""
say "==================== 1) cogagent ===================="
if [ -n "$PKG" ]; then
  [ -f "$PKG" ] || { bad "安装包不存在: $PKG"; exit 1; }
  case "$(uname -m)" in aarch64|arm64) ok "架构匹配" ;; *) bad "架构不匹配"; exit 1 ;; esac
  if [ "$YES_WIPE" != "1" ]; then bad "需 --yes-wipe（会删除 /srv/cogagent）"; exit 3; fi
  if [ "$NO_BACKUP" != "1" ] && { [ -d /srv/cogagent ] || [ -d /etc/cogagent ]; }; then
    install -d -m 0700 "$BACKUP_DIR"
    BK="$BACKUP_DIR/cogagent-$(date +%Y%m%d%H%M%S).tgz"
    say "备份 -> $BK"
    tar czf "$BK" -C / srv/cogagent etc/cogagent 2>/dev/null || warn "备份部分失败"
    ls -lh "$BK" 2>/dev/null || true
  fi
  say "即将删除：/usr/local/{lib,bin}/cogagent /etc/cogagent /srv/cogagent /var/log/cogagent"
  sleep 5
  bash "$PKG" --yes
  ok "cogagent 安装完成"
fi

if [ "$PATCH_LAUNCHER" = "1" ] || [ -n "$PKG" ]; then
  if [ -x "$LAUNCHER" ]; then
    say "打 serve-only 补丁…"
    python3 - "$LAUNCHER" <<'PYPATCH'
import sys, shutil, time, os
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
orig = s
a1 = '    root = os.path.join(cfg["rootBase"].rstrip("/"), token["account"])\n'
b1 = a1 + '    if os.environ.get("COGAGENT_SERVE_ONLY") == "1":  # SERVE_ONLY_EARLY_ACCOUNT\n        print("COGAGENT_LOGIN_ACCOUNT=" + token["account"], flush=True)\n'
if "SERVE_ONLY_EARLY_ACCOUNT" not in s:
    if a1 not in s: print("ANCHOR1_MISMATCH"); raise SystemExit(4)
    s = s.replace(a1, b1, 1)
a2 = '    print("[cogagent] 账号 " + account + " 已有实例在运行")\n'
b2 = '    if os.environ.get("COGAGENT_SERVE_ONLY") == "1":  # SERVE_ONLY_REUSE_EXIT\n        print("[cogagent] serve-only：已有实例，本进程退出")\n        return handle\n' + a2
if "SERVE_ONLY_REUSE_EXIT" not in s:
    if a2 not in s: print("ANCHOR2_MISMATCH"); raise SystemExit(5)
    s = s.replace(a2, b2, 1)
a3 = '    prepare_service(binary, port, env)\n    env["OPENCODE_SERVICE_PORT"] = str(port)\n'
b3 = '    if os.environ.get("COGAGENT_SERVE_ONLY") == "1":  # SERVE_ONLY_NO_STOP\n        pass\n    else:\n        prepare_service(binary, port, env)\n    env["OPENCODE_SERVICE_PORT"] = str(port)\n'
if "SERVE_ONLY_NO_STOP" not in s and a3 in s:
    s = s.replace(a3, b3, 1)
if s != orig:
    shutil.copy2(p, p + ".bak." + time.strftime("%Y%m%d%H%M%S"))
    open(p, "w", encoding="utf-8").write(s)
    os.chmod(p, 0o755)
compile(open(p, encoding="utf-8").read(), p, "exec")
print("EARLY", s.count("SERVE_ONLY_EARLY_ACCOUNT"), "REUSE", s.count("SERVE_ONLY_REUSE_EXIT"), "NOSTOP", s.count("SERVE_ONLY_NO_STOP"))
PYPATCH
    grep -q COGAGENT_SERVE_ONLY "$LAUNCHER" && ok "补丁已生效" || { bad "补丁失败"; exit 6; }
  else
    warn "启动器不存在，跳过补丁"
  fi
fi

if [ "$NO_RESTORE" != "1" ] && [ -n "${BK:-}" ] && [ -f "${BK:-/nonexistent}" ] && [ -z "$RESTORE" ]; then
  RESTORE="$BK"; say "重装后自动还原备份"
fi
if [ -n "$RESTORE" ]; then
  [ "$RESTORE" = "latest" ] && RESTORE=$(ls -t "$BACKUP_DIR"/cogagent-*.tgz 2>/dev/null | head -1) || true
  [ -f "${RESTORE:-}" ] || { bad "找不到备份"; exit 7; }
  say "还原：$RESTORE"
  tar xzf "$RESTORE" -C / || { bad "解包失败"; exit 8; }
  for d in /srv/cogagent/users /srv/cogagent/login-logs; do
    [ -d "$d" ] && chown -R "$SVC_USER":"$SVC_GROUP" "$d" 2>/dev/null || true
  done
  ok "已还原"
  warn "CAC 登录态可能过期：首次使用请重新 SSO"
fi

say ""
say "==================== 2) 目录与 systemd ===================="
install -d -m 0750 "$TOOLS"; install -d -m 0700 "$STATE"; install -d -m 0755 "$LOG"
if [ ! -f "$UNIT" ]; then
  cat > "$UNIT" <<'UNITEOF'
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
UNITEOF
  ok "已写入单元"
else
  ok "单元已存在"
fi
systemctl daemon-reload
systemctl enable --now cogagent-hud-broker >/dev/null 2>&1 || true

say ""
say "==================== 3) 部署 HUD ===================="
DEPLOY_RC=0
if [ "$KEEP" = "1" ]; then bash "$SRC/deploy.sh" --keep || DEPLOY_RC=$?; else bash "$SRC/deploy.sh" || DEPLOY_RC=$?; fi
[ "$DEPLOY_RC" != "0" ] && warn "deploy.sh 返回 $DEPLOY_RC（注册可能未完成），继续"

say ""
say "==================== 4) 重启 OSSDesign ===================="
if [ "$NO_RESTART_OSS" = "1" ]; then
  warn "按参数跳过"
else
  if id ossadm >/dev/null 2>&1; then
    su - ossadm -c "bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd restartapp -app OSSDesignService" 2>/dev/null | tail -2 || true
  else
    bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd restartapp -app OSSDesignService 2>/dev/null | tail -2 || true
  fi
  sleep 10
  pgrep -f ossdiyservice.py >/dev/null && ok "OSSDesign running" || bad "OSSDesign 未运行"
fi

say ""
say "==================== 5) 快照 + 自检 ===================="
[ -f "$TOOLS/recover.sh" ] && bash "$TOOLS/recover.sh" snapshot | tail -5 || true
[ -f "$TOOLS/recover.sh" ] && bash "$TOOLS/recover.sh" check || true

say ""
say "==================== 完成 ===================="
say "profile  : $CUR_PROFILE"
say "前端     : $(ls "$HUD_DIR"/hud.v*.js 2>/dev/null | tail -1 | xargs -r basename)"
say "浏览器   : Ctrl+Shift+R；点 COG 球 → 连接 → SSO"
say "日志     : /var/log/cogagent-hud/broker.log、/tmp/hud_bridge.log、/tmp/hud_boot.log"
