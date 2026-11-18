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
