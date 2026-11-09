#!/bin/bash
# cogagent 安装脚本（P0）：目录、权限、CA 占位、内核保护、/etc 配置、自检脚本
# 用法：root 身份执行  bash install.sh
set -euo pipefail

ROOT_DIR=/srv/cogagent
USERS_DIR=$ROOT_DIR/users
LOGIN_DIR=$ROOT_DIR/login-logs
TOOLS_DIR=$ROOT_DIR/tools
AUDIT_DIR=/var/log/cogagent
ETC=/etc/cogagent
SVC_USER=ossadm

if [ "$(id -u)" != "0" ]; then echo "必须以 root 运行"; exit 1; fi
if ! id "$SVC_USER" >/dev/null 2>&1; then echo "找不到用户 $SVC_USER"; exit 1; fi
SVC_GROUP=$(id -gn "$SVC_USER")

SRC_DIR=$(cd "$(dirname "$0")" && pwd)
echo "== 服务用户: $SVC_USER  组: $SVC_GROUP"
echo "== 源目录: $SRC_DIR"

install -d -m 0755 "$ROOT_DIR"
install -d -m 0755 "$TOOLS_DIR"
install -d -m 0755 -o "$SVC_USER" -g "$SVC_GROUP" "$USERS_DIR"
install -d -m 0755 -o "$SVC_USER" -g "$SVC_GROUP" "$LOGIN_DIR"
install -d -m 0775 -o "$SVC_USER" -g "$SVC_GROUP" "$AUDIT_DIR"
install -d -m 0755 -o root -g root "$ETC"

# ---------- 内核保护：禁止同 UID 互看内存 ----------
if [ -w /proc/sys/kernel/yama/ptrace_scope ]; then
  sysctl -w kernel.yama.ptrace_scope=1 >/dev/null
  echo "kernel.yama.ptrace_scope = 1" > /etc/sysctl.d/99-cogagent.conf
  echo "== ptrace_scope = $(cat /proc/sys/kernel/yama/ptrace_scope)"
else
  echo "== 警告：此内核没有 Yama（/proc/sys/kernel/yama 不存在）"
fi

# ---------- 企业 CA 占位（后续手动替换） ----------
if [ ! -f "$ETC/cert.pem" ]; then
  if command -v openssl >/dev/null 2>&1; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
      -keyout /tmp/cogagent-placeholder.key -out "$ETC/cert.pem" \
      -subj "/CN=PLACEHOLDER-REPLACE-WITH-ENTERPRISE-CA" >/dev/null 2>&1
    rm -f /tmp/cogagent-placeholder.key
    chmod 0644 "$ETC/cert.pem"
    echo "== 已生成占位 CA：$ETC/cert.pem（请替换为企业证书）"
  else
    echo "== 警告：没有 openssl，无法生成占位 CA；请手动放置 $ETC/cert.pem"
  fi
else
  echo "== 已存在 CA：$ETC/cert.pem（保留不动）"
fi

# ---------- /etc 配置 ----------
if [ -f "$SRC_DIR/cac.json" ]; then
  install -m 0644 -o root -g root "$SRC_DIR/cac.json" "$ETC/cac.json"
  if command -v python3 >/dev/null 2>&1; then
    python3 -m json.tool "$ETC/cac.json" >/dev/null && echo "== 配置 JSON 合法：$ETC/cac.json"
  fi
else
  echo "== 警告：缺少 $SRC_DIR/cac.json，跳过配置安装"
fi

# ---------- 自检脚本 ----------
if [ -f "$SRC_DIR/selfcheck.sh" ]; then
  install -m 0755 -o root -g root "$SRC_DIR/selfcheck.sh" "$TOOLS_DIR/selfcheck.sh"
  echo "== 自检脚本：$TOOLS_DIR/selfcheck.sh"
fi

# ---------- 结果 ----------
echo ""
echo "== 目录与权限"
ls -ld "$ROOT_DIR" "$USERS_DIR" "$LOGIN_DIR" "$TOOLS_DIR" "$AUDIT_DIR" "$ETC" 2>&1
echo ""
echo "== 下一步"
echo "1) 把企业 CA 覆盖到 $ETC/cert.pem"
echo "2) 以 ossadm 身份运行自检：su - ossadm -c \"bash $TOOLS_DIR/selfcheck.sh\""
echo "3) 自检全绿后再装 cogagent 本体"