#!/bin/bash
# 卸载 cogagent（root）。会先列清单，输入 YES 才执行。
set -u
[ "$(id -u)" = "0" ] || { echo "需要 root"; exit 1; }

echo "=== 将要删除 ==="
for p in /usr/local/bin/cogagent /usr/local/lib/cogagent /srv/cogagent \
         /var/log/cogagent /etc/cogagent /etc/sysctl.d/99-cogagent.conf; do
  [ -e "$p" ] && echo "  $p" || echo "  (不存在) $p"
done

echo
read -r -p "确认删除以上内容？输入 YES 继续: " ans
[ "$ans" = "YES" ] || { echo "已取消"; exit 0; }

pkill -f "/usr/local/lib/cogagent/cogagent" 2>/dev/null
pkill -f "cogagent-core" 2>/dev/null
sleep 1

rm -rf /usr/local/bin/cogagent /usr/local/lib/cogagent
rm -rf /srv/cogagent /var/log/cogagent
rm -rf /etc/cogagent

rm -f /etc/sysctl.d/99-cogagent.conf
sysctl -w kernel.yama.ptrace_scope=0 >/dev/null 2>&1 || true

rm -rf /tmp/cac-root /tmp/cac-wrapper.py /tmp/mock-server*.py /tmp/mock-cac.json 2>/dev/null

echo "卸载完成；ptrace_scope 现在是 $(cat /proc/sys/kernel/yama/ptrace_scope 2>/dev/null || echo unknown)"
