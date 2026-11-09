#!/bin/bash
# cogagent 全量安装（root）。用法：
#   bash install.sh <目录>
# 目录里需要：cogagent-linux-<arch>（二进制）、cogagent（包装层），可选 cac.json、selfcheck.sh
set -euo pipefail

[ "$(id -u)" = "0" ] || { echo "必须以 root 运行"; exit 1; }
SRC="${1:-$(cd "$(dirname "$0")" && pwd)}"
[ -d "$SRC" ] || { echo "目录不存在: $SRC"; exit 1; }

BIN_SRC=$(ls "$SRC"/cogagent-linux-* 2>/dev/null | head -1 || true)
[ -n "$BIN_SRC" ] || { echo "缺少二进制 cogagent-linux-*"; exit 1; }
[ -f "$SRC/cogagent" ] || { echo "缺少包装层 cogagent"; exit 1; }

SVC_USER=ossadm
ROOT_DIR=/srv/cogagent
USERS_DIR=$ROOT_DIR/users
LOGIN_DIR=$ROOT_DIR/login-logs
TOOLS_DIR=$ROOT_DIR/tools
AUDIT_DIR=/var/log/cogagent
ETC=/etc/cogagent
LIB=/usr/local/lib/cogagent
BIN=/usr/local/bin/cogagent

id "$SVC_USER" >/dev/null 2>&1 || { echo "找不到用户 $SVC_USER"; exit 1; }
SVC_GROUP=$(id -gn "$SVC_USER")

echo "== 1/6 停止旧进程"
pkill -f "$LIB/cogagent" 2>/dev/null || true
pkill -f "cogagent-core" 2>/dev/null || true
sleep 1

echo "== 2/6 全量替换程序目录（先删后装，不留旧文件）"
rm -rf "$LIB"
install -d -m 0755 "$LIB"
install -m 0755 "$BIN_SRC" "$LIB/cogagent"
install -m 0755 "$SRC/cogagent" "$BIN"

echo "== 3/6 清理旧的用户状态（陈旧端口注册等）"
if [ -d "$USERS_DIR" ]; then
  find "$USERS_DIR" -mindepth 2 -maxdepth 2 -type d -name state -exec sh -c 'rm -rf "$1"/*' _ {} \; 2>/dev/null || true
fi

echo "== 4/6 目录与权限"
install -d -m 0755 "$ROOT_DIR" "$TOOLS_DIR"
install -d -m 0755 -o "$SVC_USER" -g "$SVC_GROUP" "$USERS_DIR" "$LOGIN_DIR"
install -d -m 0775 -o "$SVC_USER" -g "$SVC_GROUP" "$AUDIT_DIR"
install -d -m 0755 -o root -g root "$ETC"
if [ -w /proc/sys/kernel/yama/ptrace_scope ]; then
  sysctl -w kernel.yama.ptrace_scope=1 >/dev/null
  echo "kernel.yama.ptrace_scope = 1" > /etc/sysctl.d/99-cogagent.conf
fi
if [ -f "$SRC/cac.json" ]; then
  install -m 0644 -o root -g root "$SRC/cac.json" "$ETC/cac.json"
fi
if [ ! -f "$ETC/cert.pem" ] && command -v openssl >/dev/null 2>&1; then
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout /tmp/cogagent-placeholder.key -out "$ETC/cert.pem" \
    -subj "/CN=PLACEHOLDER-REPLACE-WITH-ENTERPRISE-CA" >/dev/null 2>&1
  rm -f /tmp/cogagent-placeholder.key
  chmod 0644 "$ETC/cert.pem"
fi
[ -f "$SRC/selfcheck.sh" ] && install -m 0755 "$SRC/selfcheck.sh" "$TOOLS_DIR/selfcheck.sh"

echo "== 5/6 写入版本指纹"
BIN_SUM=$(sha256sum "$LIB/cogagent" | cut -d' ' -f1)
WRAP_SUM=$(sha256sum "$BIN" | cut -d' ' -f1)
{
  echo "installed_at=$(date -Is)"
  echo "binary_sha256=$BIN_SUM"
  echo "wrapper_sha256=$WRAP_SUM"
  echo "source=$(basename "$BIN_SRC")"
} > "$LIB/VERSION"
cat "$LIB/VERSION"

echo "== 6/6 校验（不一致直接失败）"
[ "$(sha256sum "$LIB/cogagent" | cut -d' ' -f1)" = "$BIN_SUM" ] || { echo "FAIL 二进制校验"; exit 1; }
[ "$(sha256sum "$BIN" | cut -d' ' -f1)" = "$WRAP_SUM" ] || { echo "FAIL 包装层校验"; exit 1; }
grep -q "COGAGENT_CAC_TOKEN" "$BIN" || { echo "FAIL 包装层不是新版"; exit 1; }
grep -q "service_port" "$BIN" || { echo "FAIL 包装层缺少端口分配"; exit 1; }
"$LIB/cogagent" --version || { echo "FAIL 二进制无法运行"; exit 1; }
echo ""
echo "== 安装完成"
echo "   二进制: $LIB/cogagent  ($BIN_SUM)"
echo "   包装层: $BIN           ($WRAP_SUM)"
echo "   运行:   su - $SVC_USER -c \"cogagent\""
