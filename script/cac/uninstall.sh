#!/bin/bash
# cogagent 卸载：停止进程并删除程序、配置、数据、日志与内核设置。
set -u
[ "$(id -u)" = "0" ] || { echo "需要 root"; exit 1; }

echo "=== 将要删除 ==="
for p in /usr/local/bin/cogagent /usr/local/lib/cogagent /etc/cogagent /srv/cogagent \
         /var/log/cogagent /etc/sysctl.d/99-cogagent.conf; do
  [ -e "$p" ] && echo "  $p" || echo "  (不存在) $p"
done
echo
read -r -p "输入 YES 确认删除: " a
[ "$a" = "YES" ] || { echo "已取消"; exit 0; }

pkill -x cogagent 2>/dev/null || true
pkill -x opencode-pty 2>/dev/null || true
sleep 1

HOME_DIR=$(getent passwd ossadm 2>/dev/null | cut -d: -f6)
rm -rf /usr/local/bin/cogagent /usr/local/lib/cogagent /etc/cogagent /srv/cogagent /var/log/cogagent
rm -f /etc/sysctl.d/99-cogagent.conf
[ -n "$HOME_DIR" ] && rm -rf "$HOME_DIR/.local/share/opencode" "$HOME_DIR/.local/state/opencode" \
  "$HOME_DIR/.cache/opencode" "$HOME_DIR/.config/opencode" 2>/dev/null
sysctl -w kernel.yama.ptrace_scope=0 >/dev/null 2>&1 || true
echo "卸载完成；ptrace_scope=$(cat /proc/sys/kernel/yama/ptrace_scope 2>/dev/null)"
