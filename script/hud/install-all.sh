#!/bin/bash
# cogagent + HUD 一体化安装（幂等）
#
#   bash install-all.sh --check                  只体检，不改任何东西
#   bash install-all.sh                          只安装/升级 HUD（不动 cogagent）
#   bash install-all.sh --patch-launcher         额外重打 serve-only 补丁
#   bash install-all.sh --cogagent-pkg=/root/x.run --yes-wipe
#                                                重装 cogagent（默认先备份，装完自动还原）
#   bash install-all.sh --restore=latest         手动还原最新备份
#   bash install-all.sh --list-backups           列出备份
#   其它：--no-restore --no-backup --backup-dir=/path --no-restart-oss --keep
set -euo pipefail

SRC=$(cd "$(dirname "$0")" && pwd)
TOOLS=/opt/cloud/manager/tools/cogagent-hud
UNIT=/etc/systemd/system/cogagent-hud-broker.service
STATE=/var/lib/cogagent-hud
LOG=/var/log/cogagent-hud
LAUNCHER=/usr/local/bin/cogagent

CHECK=0; PATCH_LAUNCHER=0; PKG=""; YES_WIPE=0
NO_BACKUP=0; BACKUP_DIR=/var/backups; NO_RESTART_OSS=0; KEEP=0
NO_RESTORE=0; RESTORE=""; LIST_BACKUPS=0

while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK=1; shift ;;
    --patch-launcher) PATCH_LAUNCHER=1; shift ;;
    --cogagent-pkg=*) PKG="${1#*=}"; shift ;;
    --cogagent-pkg) PKG="$2"; shift 2 ;;
    --yes-wipe) YES_WIPE=1; shift ;;
    --no-backup) NO_BACKUP=1; shift ;;
    --backup-dir=*) BACKUP_DIR="${1#*=}"; shift ;;
    --no-restart-oss) NO_RESTART_OSS=1; shift ;;
    --keep) KEEP=1; shift ;;
    --no-restore) NO_RESTORE=1; shift ;;
    --restore=*) RESTORE="${1#*=}"; shift ;;
    --list-backups) LIST_BACKUPS=1; shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "未知参数: $1"; exit 2 ;;
  esac
done

say() { printf '%s\n' "$*"; }
ok()  { printf '[ OK ] %s\n' "$*"; }
warn(){ printf '[WARN] %s\n' "$*"; }
bad() { printf '[FAIL] %s\n' "$*"; }

[ "$(id -un)" = "root" ] || { bad "请用 root 执行"; exit 1; }

SVC_USER=ossadm; id "$SVC_USER" >/dev/null 2>&1 || SVC_USER=root
SVC_GROUP=$(id -gn "$SVC_USER")
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService 2>/dev/null || true)

if [ "$LIST_BACKUPS" = "1" ]; then
  say "== 备份列表（$BACKUP_DIR）=="
  ls -lh "$BACKUP_DIR"/cogagent-*.tgz 2>/dev/null || say "  （暂无）"
  exit 0
fi

say "==================== 0) 环境检查 ===================="
say "架构      : $(uname -m)"
say "APP_ROOT  : ${APP_ROOT:-<解析失败>}"
say "服务用户  : $SVC_USER"
say "模式      : CHECK=$CHECK PATCH_LAUNCHER=$PATCH_LAUNCHER PKG=${PKG:-<未指定>} YES_WIPE=$YES_WIPE"

FAIL=0
[ -n "$APP_ROOT" ] && [ -d "$APP_ROOT" ] && ok "OSSDesign 版本目录" || { bad "找不到 OSSDesign 版本目录"; FAIL=1; }
command -v python3 >/dev/null && ok "python3" || { bad "缺 python3"; FAIL=1; }
command -v systemctl >/dev/null && ok "systemd" || { bad "缺 systemd"; FAIL=1; }
command -v node >/dev/null && ok "node（前端语法自检用）" || warn "没有 node，跳过前端语法检查"
for f in broker.py hud_proxy.py hud.js recover.sh deploy.sh; do
  [ -f "$SRC/$f" ] || { bad "缺少部署文件: $f"; FAIL=1; }
done
[ "$FAIL" = "0" ] && ok "部署文件齐全"

say ""
say "== cogagent 现状 =="
if [ -x "$LAUNCHER" ]; then
  N=$(grep -c COGAGENT_SERVE_ONLY "$LAUNCHER" 2>/dev/null) || N=0
  ok "启动器存在（serve-only 标记 $N 处）"
else
  warn "启动器缺失（需 --cogagent-pkg 安装，或先手工装 cogagent）"
fi
[ -d /srv/cogagent/users ] && ok "/srv/cogagent/users 存在（账号数据）" || warn "/srv/cogagent/users 不存在（尚无账号登录过）"
[ -d "$TOOLS" ] && ok "$TOOLS" || warn "$TOOLS 不存在（首次安装会创建）"
systemctl is-active --quiet cogagent-hud-broker 2>/dev/null && ok "broker active" || warn "broker 未运行"

# ---- 安装完整性 ----
BOOT_FILE="$APP_ROOT/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js"
HUD_DIR_CHK="$APP_ROOT/webapps/ossdesignwebsite/plugin/hud"
PROXY_CHK="$APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py"
SVC_CHK="$APP_ROOT/pyscript/ossdiyservice.py"

say ""
say "== 安装完整性 =="
BOOT_MARK=0; REG_CNT=0; HUD_CNT=0; PROXY_SIZE=0
if [ -f "$BOOT_FILE" ] && grep -q "oss-hud-bootstrap-v2" "$BOOT_FILE" 2>/dev/null; then BOOT_MARK=1; fi
if [ -f "$SVC_CHK" ] && grep -q "HUD_BRIDGE_V3" "$SVC_CHK" 2>/dev/null; then REG_CNT=1; fi
if [ -d "$HUD_DIR_CHK" ]; then
  for hf in "$HUD_DIR_CHK"/hud*.js; do
    [ -e "$hf" ] && HUD_CNT=$((HUD_CNT + 1))
  done
fi
if [ -f "$PROXY_CHK" ]; then PROXY_SIZE=$(stat -c%s "$PROXY_CHK" 2>/dev/null); fi
[ -n "${PROXY_SIZE:-}" ] || PROXY_SIZE=0

[ "$PROXY_SIZE" -gt 0 ] && ok "桥文件（$PROXY_SIZE 字节）" || warn "桥文件缺失（需要安装）"
[ "$REG_CNT" -gt 0 ] && ok "注册块 HUD_BRIDGE_V3" || warn "注册块缺失（需要安装）"
[ "$HUD_CNT" -gt 0 ] && ok "前端文件（$HUD_CNT 个）" || warn "前端文件缺失（需要安装）"
if [ "$BOOT_MARK" -gt 0 ]; then
  CUR_HUD=$(grep -o "plugin/hud/hud[^\"]*" "$BOOT_FILE" 2>/dev/null | head -1) || CUR_HUD="?"
  ok "bootstrap 已注入（指向 ${CUR_HUD:-?}）"
else
  warn "检测到 OSSDesign 升级或未安装：app_main.js 里没有 bootstrap 标记"
  say "       → 运行 bash install-all.sh 自动补齐（幂等）"
fi

if [ "$CHECK" = "1" ]; then
  say ""
  say "== 检查模式结束（未做任何修改）=="
  [ "$FAIL" = "0" ] && exit 0 || exit 1
fi

say ""
say "==================== 1) cogagent ===================="
if [ -n "$PKG" ]; then
  [ -f "$PKG" ] || { bad "安装包不存在: $PKG"; exit 1; }
  case "$(uname -m)" in
    aarch64|arm64) ok "架构匹配 arm64" ;;
    *) bad "当前架构 $(uname -m) 与 arm64 安装包不匹配"; exit 1 ;;
  esac
  if [ "$YES_WIPE" != "1" ]; then
    bad "重装 cogagent 会删除 /srv/cogagent（所有会话与工作区）"
    say "      确认要重装请加 --yes-wipe"
    exit 3
  fi
  if [ "$NO_BACKUP" != "1" ]; then
    install -d -m 0700 "$BACKUP_DIR"
    TS=$(date +%Y%m%d%H%M%S)
    BK="$BACKUP_DIR/cogagent-$TS.tgz"
    say "备份 /srv/cogagent + /etc/cogagent -> $BK"
    if [ -d /srv/cogagent ] || [ -d /etc/cogagent ]; then
      tar czf "$BK" -C / srv/cogagent etc/cogagent 2>/dev/null || warn "备份部分失败"
      ls -lh "$BK" 2>/dev/null || true
    else
      warn "没有可备份的 cogagent 数据（全新环境）"
      BK=""
    fi
  else
    warn "已指定 --no-backup：数据将不可恢复"
    BK=""
  fi
  say "即将删除：/usr/local/lib/cogagent /usr/local/bin/cogagent /etc/cogagent /srv/cogagent /var/log/cogagent"
  say "5 秒后开始安装…（Ctrl+C 可取消）"
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
    if a1 not in s:
        print("ANCHOR1_MISMATCH"); raise SystemExit(4)
    s = s.replace(a1, b1, 1)

a2 = '    print("[cogagent] 账号 " + account + " 已有实例在运行")\n'
b2 = '    if os.environ.get("COGAGENT_SERVE_ONLY") == "1":  # SERVE_ONLY_REUSE_EXIT\n        print("[cogagent] serve-only：已有实例，本进程退出")\n        return handle\n' + a2
if "SERVE_ONLY_REUSE_EXIT" not in s:
    if a2 not in s:
        print("ANCHOR2_MISMATCH"); raise SystemExit(5)
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

if [ "$NO_RESTORE" != "1" ] && [ -n "$PKG" ] && [ -n "${BK:-}" ] && [ -f "${BK:-/nonexistent}" ] && [ -z "$RESTORE" ]; then
  RESTORE="$BK"
  say "本次是重装 cogagent：自动还原刚做的备份（--no-restore 可关闭）"
fi

if [ -n "$RESTORE" ]; then
  if [ "$RESTORE" = "latest" ]; then
    RESTORE=$(ls -t "$BACKUP_DIR"/cogagent-*.tgz 2>/dev/null | head -1) || RESTORE=""
  fi
  if [ -z "${RESTORE:-}" ] || [ ! -f "$RESTORE" ]; then
    bad "找不到要还原的备份"; exit 7
  fi
  say "还原数据：$RESTORE"
  tar xzf "$RESTORE" -C / || { bad "解包失败"; exit 8; }
  for d in /srv/cogagent/users /srv/cogagent/login-logs; do
    [ -d "$d" ] && chown -R "$SVC_USER":"$SVC_GROUP" "$d" 2>/dev/null || true
  done
  ok "已还原 /srv/cogagent 与 /etc/cogagent（属主：$SVC_USER）"
  warn "CAC 登录态可能已过期：首次使用请重新 SSO 登录"
fi

say ""
say "==================== 2) 目录与 systemd 单元 ===================="
install -d -m 0750 "$TOOLS"
install -d -m 0700 "$STATE"
install -d -m 0755 "$LOG"
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
  ok "已写入 $UNIT"
else
  ok "systemd 单元已存在"
fi
systemctl daemon-reload
systemctl enable --now cogagent-hud-broker >/dev/null 2>&1 || true

say ""
say "==================== 3) 部署 HUD ===================="
DEPLOY_RC=0
if [ "$KEEP" = "1" ]; then
  bash "$SRC/deploy.sh" --keep || DEPLOY_RC=$?
else
  bash "$SRC/deploy.sh" || DEPLOY_RC=$?
fi
if [ "$DEPLOY_RC" != "0" ]; then
  warn "deploy.sh 返回 $DEPLOY_RC（多为注册锚点不匹配），继续补齐 bootstrap 与重启"
fi

say ""
say "==================== 4) 自启动 bootstrap ===================="
BOOT="$APP_ROOT/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js"
HUD_DIR="$APP_ROOT/webapps/ossdesignwebsite/plugin/hud"
HUD_FILE=$(basename "$(ls -t "$HUD_DIR"/hud.v*.js 2>/dev/null | head -1)" 2>/dev/null) || HUD_FILE="hud.js"
[ -n "${HUD_FILE:-}" ] || HUD_FILE="hud.js"
say "前端版本：$HUD_FILE"
python3 - "$BOOT" "$HUD_FILE" <<'PYBOOT'
import sys, shutil, time, re
p, hud = sys.argv[1], sys.argv[2]
target = "/ossdesignwebsite/plugin/hud/" + hud
s = open(p, encoding="utf-8", errors="surrogateescape").read()
if "oss-hud-bootstrap-v2" in s:
    s2 = re.sub(r"/ossdesignwebsite/plugin/hud/hud(\.v\d+)?\.js", target, s)
    if s2 != s:
        shutil.copy2(p, p + ".bak." + time.strftime("%Y%m%d%H%M%S"))
        open(p, "w", encoding="utf-8", errors="surrogateescape").write(s2)
        print("bootstrap 指向更新为", hud)
    else:
        print("bootstrap 已指向", hud)
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
    print("bootstrap 已追加 ->", hud)
PYBOOT
chown "$SVC_USER":"$SVC_GROUP" "$BOOT" 2>/dev/null || true
chmod 0640 "$BOOT"
grep -o "plugin/hud/hud[^\"]*" "$BOOT" | head -1 || true

say ""
say "==================== 5) 重启 ===================="
systemctl restart cogagent-hud-broker
sleep 2
systemctl is-active --quiet cogagent-hud-broker && ok "broker active" || bad "broker 未运行"
if [ "$NO_RESTART_OSS" = "1" ]; then
  warn "按参数跳过 OSSDesign 重启"
else
  say "重启 OSSDesign（约 10-20 秒中断）…"
  if id ossadm >/dev/null 2>&1; then
    su - ossadm -c "bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd restartapp -app OSSDesignService" 2>/dev/null | tail -3 || warn "restartapp 失败，请手动重启"
  else
    bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd restartapp -app OSSDesignService 2>/dev/null | tail -3 || warn "restartapp 失败，请手动重启 OSSDesign"
  fi
  sleep 10
  pgrep -f ossdiyservice.py >/dev/null && ok "OSSDesign running" || bad "OSSDesign 未运行"
fi

say ""
say "==================== 6) 快照 + 自检 ===================="
bash "$TOOLS/recover.sh" snapshot | tail -5
bash "$TOOLS/recover.sh" check || true

say ""
say "==================== 完成 ===================="
say "前端版本 : $HUD_FILE"
say "访问方式 : 浏览器打开 OSSDesign 页面，Ctrl+Shift+R"
say "首次使用 : 点 COG 球 → 连接 cogagent → SSO 登录"
say "回滚前端 : 改 app_main.js 里 hud.vN.js 为旧版本号即可"
say "日志     : /var/log/cogagent-hud/broker.log、/tmp/hud_bridge.log"
