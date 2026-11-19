#!/bin/bash
# 重装/新机器一键恢复 HUD（本脚本与依赖文件必须在同一目录）
#   用法（root）：bash restore.sh [--keep]
set -euo pipefail

SRC=$(cd "$(dirname "$0")" && pwd)
TOOLS=/opt/cloud/manager/tools/cogagent-hud
UNIT=/etc/systemd/system/cogagent-hud-broker.service
STATE=/var/lib/cogagent-hud
LOG=/var/log/cogagent-hud

say() { printf '%s\n' "$*"; }
ok()  { printf '[ OK ] %s\n' "$*"; }
bad() { printf '[FAIL] %s\n' "$*"; }

[ "$(id -un)" = "root" ] || { bad "请用 root 执行"; exit 1; }

say "== 0) 环境检查 =="
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService 2>/dev/null || true)
say "APP_ROOT : ${APP_ROOT:-<解析失败>}"
[ -n "$APP_ROOT" ] && [ -d "$APP_ROOT" ] && ok "OSSDesign 版本目录存在" || { bad "找不到 OSSDesign 版本目录"; exit 1; }

if [ -x /usr/local/bin/cogagent ]; then
  ok "cogagent 启动器存在（serve-only 标记 $(grep -c COGAGENT_SERVE_ONLY /usr/local/bin/cogagent 2>/dev/null || echo 0) 处）"
else
  bad "cogagent 启动器缺失：需先重装 cogagent 包并打 serve-only 补丁（否则 broker 无法启动实例）"
fi
[ -d /srv/cogagent/users ] && ok "/srv/cogagent/users 存在" || bad "/srv/cogagent/users 缺失（cogagent 未安装？）"

for f in broker.py hud_proxy.py hud.js recover.sh deploy.sh; do
  [ -f "$SRC/$f" ] || { bad "缺少文件: $SRC/$f"; exit 1; }
done
ok "部署文件齐全"

say ""
say "== 1) 目录 =="
install -d -o ossadm -g ossgroup -m 0750 "$TOOLS"
install -d -m 0700 "$STATE"
install -d -m 0755 "$LOG"
ok "$TOOLS / $STATE / $LOG"

say ""
say "== 2) systemd 单元 =="
if [ -f "$UNIT" ]; then
  ok "单元已存在（保留）"
else
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
fi
systemctl daemon-reload
systemctl enable --now cogagent-hud-broker >/dev/null 2>&1 || true
systemctl is-active --quiet cogagent-hud-broker && ok "broker active" || bad "broker 未运行"

say ""
say "== 3) 部署（deploy.sh）=="
bash "$SRC/deploy.sh" "$@"

say ""
say "== 4) 收尾 =="
systemctl enable cogagent-hud-broker >/dev/null 2>&1 || true
bash "$TOOLS/recover.sh" check || true

say ""
say "完成。浏览器 Ctrl+Shift+R；若 HUD 不出现，看 /tmp/hud_bridge.log 与 /var/log/cogagent-hud/broker.log"
