#!/bin/bash
# 全量卸载：HUD + cogagent（可选保留 cogagent）
#   bash uninstall-all.sh           交互确认
#   bash uninstall-all.sh --yes     不询问
#   bash uninstall-all.sh --yes --keep-cogagent   只卸 HUD
set -uo pipefail

YES=0; KEEP_COG=0
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) YES=1; shift ;;
    --keep-cogagent) KEEP_COG=1; shift ;;
    -h|--help) sed -n '2,6p' "$0"; exit 0 ;;
    *) echo "未知参数: $1"; exit 2 ;;
  esac
done

[ "$(id -un)" = "root" ] || { echo "请用 root 执行"; exit 1; }

APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService 2>/dev/null || true)
BOOT="${APP_ROOT:-}/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js"
SVC="${APP_ROOT:-}/pyscript/ossdiyservice.py"
PROXY="${APP_ROOT:-}/pyscript/ossdesign/interface/hud_proxy.py"

echo "== 将执行 =="
echo "1) 停止并删除 broker 服务（cogagent-hud-broker）"
echo "2) 删除 /opt/cloud/manager/tools/cogagent-hud、/var/lib/cogagent-hud、/var/log/cogagent-hud"
echo "3) 删除前端目录 plugin/hud/"
echo "4) 从 app_main.js 去掉 bootstrap"
echo "5) 删除桥文件并从 ossdiyservice.py 去掉注册块"
if [ "$KEEP_COG" = "1" ]; then
  echo "6) 保留 cogagent（--keep-cogagent）"
else
  echo "6) 卸载 cogagent：/usr/local/{lib,bin}/cogagent、/etc/cogagent、/srv/cogagent、/var/log/cogagent"
fi
echo "7) 重启 OSSDesign"
echo
if [ "$YES" != "1" ]; then
  read -r -p "确认请输 YES: " A
  [ "$A" = "YES" ] || { echo "已取消"; exit 0; }
fi

echo
echo "== 1) broker 服务 =="
systemctl stop cogagent-hud-broker 2>/dev/null || true
systemctl disable cogagent-hud-broker 2>/dev/null || true
rm -f /etc/systemd/system/cogagent-hud-broker.service
systemctl daemon-reload
echo "  已移除 systemd 单元"

echo
echo "== 2) HUD 数据 =="
rm -rf /opt/cloud/manager/tools/cogagent-hud /var/lib/cogagent-hud /var/log/cogagent-hud
rm -f /tmp/hud_bridge.log /tmp/hud-login.json /tmp/.hud-*
echo "  已删除"

if [ -n "${APP_ROOT:-}" ] && [ -d "${APP_ROOT:-}" ]; then
  echo
  echo "== 3) 前端 =="
  rm -rf "${APP_ROOT:-}/webapps/ossdesignwebsite/osmuwebsite_app"
  echo "  已删除 plugin/hud/"

  echo
  echo "== 4) bootstrap =="
  if [ -f "$BOOT" ]; then
    python3 - "$BOOT" <<'PYBOOT'
import sys, shutil, time
p = sys.argv[1]
s = open(p, encoding="utf-8", errors="surrogateescape").read()
marker = ";/*oss-hud-bootstrap-v2*/"
if marker in s:
    shutil.copy2(p, p + ".bak." + time.strftime("%Y%m%d%H%M%S"))
    head = s.split(marker)[0]
    head = head.rstrip("\n")
    rest = s.split(marker, 1)[1]
    nl = rest.find("\n")
    tail = rest[nl + 1:] if nl >= 0 else ""
    open(p, "w", encoding="utf-8", errors="surrogateescape").write(head + "\n" + tail)
    print("  已移除 bootstrap")
else:
    print("  没有 bootstrap 标记（跳过）")
PYBOOT
  fi

  echo
  echo "== 5) 桥与注册 =="
  rm -f "$PROXY"
  rm -f "${APP_ROOT:-}/pyscript/ossdesign/interface/__pycache__/hud_proxy".pyc
  mkdir -p "${APP_ROOT:-}/pyscript/ossdesign/interface/__pycache__" 2>/dev/null || true
  rm -rf "${APP_ROOT:-}/pyscript/ossdesign/interface/__pycache__/hud_proxy"* 2>/dev/null || true
  if [ -f "$SVC" ]; then
    python3 - "$SVC" <<'PYSVC'
import sys, shutil, time
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "HUD_BRIDGE_V3" not in s and "HUD_BRIDGE_V6" not in s:
    print("  没有注册块（跳过）"); raise SystemExit(0)
start = s.find("    # HUD_BRIDGE_V3")
if start < 0:
    print("  标记位置异常（跳过）"); raise SystemExit(0)
endmark = 'print("[hud] bridge disabled:", _hud_exc)'
end = s.find(endmark, start)
if end < 0:
    print("  块结束标记未找到（跳过）"); raise SystemExit(0)
end = s.find("\n", end) + 1
shutil.copy2(p, p + ".bak." + time.strftime("%Y%m%d%H%M%S"))
open(p, "w", encoding="utf-8").write(s[:start] + s[end:])
print("  已移除注册块")
PYSVC
  fi
fi

if [ "$KEEP_COG" != "1" ]; then
  echo
  echo "== 6) cogagent =="
  pkill -x cogagent 2>/dev/null || true
  pkill -f cogagent-core 2>/dev/null || true
  pkill -x opencode-pty 2>/dev/null || true
  sleep 1
  if [ -x /srv/cogagent/tools/uninstall.sh ]; then
    bash /srv/cogagent/tools/uninstall.sh --yes 2>/dev/null || true
  fi
  rm -rf /usr/local/lib/cogagent /usr/local/bin/cogagent /usr/local/bin/cogagent-local
  rm -rf /etc/cogagent /srv/cogagent /var/log/cogagent /etc/sysctl.d/99-cogagent.conf
  for h in /root /home/ossadm; do
    rm -rf "$h/.local/share/cogagent" "$h/.local/state/cogagent" "$h/.cache/cogagent" "$h/.config/cogagent" 2>/dev/null || true
  done
  rm -f /tmp/.cogagent-*
  echo "  已卸载 cogagent"
fi

echo
echo "== 7) 重启 OSSDesign =="
if id ossadm >/dev/null 2>&1; then
  su - ossadm -c "bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd restartapp -app OSSDesignService" 2>/dev/null | tail -3 || echo "  restartapp 失败，请手动重启"
else
  bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd restartapp -app OSSDesignService 2>/dev/null | tail -3 || echo "  restartapp 失败，请手动重启"
fi
sleep 8

echo
echo "== 结果 =="
pgrep -f ossdiyservice.py >/dev/null && echo "  OSSDesign: running" || echo "  OSSDesign: 未运行"
[ -d /opt/cloud/manager/tools/cogagent-hud ] && echo "  HUD 目录: 仍存在" || echo "  HUD 目录: 已删除"
[ -x /usr/local/bin/cogagent ] && echo "  cogagent: 仍存在" || echo "  cogagent: 已删除"
[ -n "${APP_ROOT:-}" ] && grep -c HUD_BRIDGE_V3 "$SVC" 2>/dev/null | sed 's/^/  注册块剩余: /'
echo
echo "完成。现在可以重新安装（bash install-full.sh --yes-wipe）"
