#!/bin/bash
# cogagent 全量安装：先清空一切旧内容，再按包内文件重建。
# 由自解压安装包调用，也可手动执行： bash install.sh <解压目录>
set -euo pipefail

[ "$(id -u)" = "0" ] || { echo "必须以 root 运行"; exit 1; }
SRC="${1:-$(cd "$(dirname "$0")" && pwd)}"
[ -d "$SRC" ] || { echo "目录不存在: $SRC"; exit 1; }
BIN_SRC=$(ls "$SRC"/cogagent-linux-* 2>/dev/null | head -1 || true)
[ -n "$BIN_SRC" ] || { echo "安装包缺少二进制"; exit 1; }
[ -f "$SRC/cogagent" ] || { echo "安装包缺少包装层"; exit 1; }
[ -f "$SRC/cac.json" ] || { echo "安装包缺少 cac.json"; exit 1; }

# 优先用 ossadm（公司标准账号）；没有该账号时退回 root，便于在普通服务器上部署
SVC_USER=ossadm
if ! id "$SVC_USER" >/dev/null 2>&1; then
  if id root >/dev/null 2>&1; then
    SVC_USER=root
    echo "提示：系统中没有 ossadm 用户，改用 root 部署"
  else
    echo "找不到用户 ossadm，且没有 root"; exit 1
  fi
fi
ROOT_DIR=/srv/cogagent
USERS_DIR=$ROOT_DIR/users
LOGIN_DIR=$ROOT_DIR/login-logs
TOOLS_DIR=$ROOT_DIR/tools
AUDIT_DIR=/var/log/cogagent
ETC=/etc/cogagent
LIB=/usr/local/lib/cogagent
BIN=/usr/local/bin/cogagent
SYSCTL_FILE=/etc/sysctl.d/99-cogagent.conf

SVC_GROUP=$(id -gn "$SVC_USER")
HOME_DIR=$(getent passwd "$SVC_USER" | cut -d: -f6)

if [ "${COGAGENT_YES:-}" != "1" ]; then
  echo "警告：本次安装会删除以下内容的全部旧数据（不可恢复）："
  echo "  /usr/local/lib/cogagent  /usr/local/bin/cogagent  /etc/cogagent"
  echo "  /srv/cogagent（所有用户会话与工作区）  /var/log/cogagent"
  read -r -p "输入 YES 继续: " CG_CONFIRM
  [ "$CG_CONFIRM" = "YES" ] || { echo "已取消"; exit 0; }
fi

echo "== 1/7 停止所有旧进程"
pkill -x cogagent 2>/dev/null || true
pkill -x opencode-pty 2>/dev/null || true
pkill -f "cogagent-core" 2>/dev/null || true
sleep 1

echo "== 2/7 删除所有旧内容（不复用、不继承）"
rm -rf "$LIB" "$BIN" "$ETC" "$ROOT_DIR" "$AUDIT_DIR" "$SYSCTL_FILE"
rm -rf "$HOME_DIR/.local/share/opencode" "$HOME_DIR/.local/state/opencode" \
       "$HOME_DIR/.cache/opencode" "$HOME_DIR/.config/opencode" 2>/dev/null || true
rm -f /tmp/.cogagent-* 2>/dev/null || true

echo "== 3/7 安装程序"
install -d -m 0755 "$LIB"
install -m 0755 "$BIN_SRC" "$LIB/cogagent"
install -d -m 0755 "$(dirname "$BIN")"
install -m 0755 "$SRC/cogagent" "$BIN"
if [ -f "$SRC/cogagent-local" ]; then
  install -m 0755 "$SRC/cogagent-local" "$(dirname "$BIN")/cogagent-local"
fi

echo "== 4/7 安装配置（cac.json + 空 cert.pem 占位）"
install -d -m 0755 -o root -g root "$ETC"
install -m 0644 -o root -g root "$SRC/cac.json" "$ETC/cac.json"
if [ -f "$SRC/cert.pem" ]; then
  install -m 0644 -o root -g root "$SRC/cert.pem" "$ETC/cert.pem"
else
  : > "$ETC/cert.pem"
  chmod 0644 "$ETC/cert.pem"
fi

echo "== 5/7 建立目录与权限"
install -d -m 0755 "$ROOT_DIR" "$TOOLS_DIR"
install -d -m 0755 -o "$SVC_USER" -g "$SVC_GROUP" "$USERS_DIR" "$LOGIN_DIR"
install -d -m 0775 -o "$SVC_USER" -g "$SVC_GROUP" "$AUDIT_DIR"
if [ -w /proc/sys/kernel/yama/ptrace_scope ]; then
  sysctl -w kernel.yama.ptrace_scope=1 >/dev/null
  echo "kernel.yama.ptrace_scope = 1" > "$SYSCTL_FILE"
fi
[ -f "$SRC/selfcheck.sh" ] && install -m 0755 "$SRC/selfcheck.sh" "$TOOLS_DIR/selfcheck.sh"
[ -f "$SRC/uninstall.sh" ] && install -m 0755 "$SRC/uninstall.sh" "$TOOLS_DIR/uninstall.sh"

echo "== 6/7 写入版本指纹"
BIN_SUM=$(sha256sum "$LIB/cogagent" | cut -d' ' -f1)
WRAP_SUM=$(sha256sum "$BIN" | cut -d' ' -f1)
CFG_SUM=$(sha256sum "$ETC/cac.json" | cut -d' ' -f1)
{
  echo "installed_at=$(date -Is)"
  echo "binary_sha256=$BIN_SUM"
  echo "wrapper_sha256=$WRAP_SUM"
  echo "config_sha256=$CFG_SUM"
  echo "source=$(basename "$BIN_SRC")"
} > "$LIB/VERSION"
cat "$LIB/VERSION"

echo "== 7/7 校验（不一致直接失败）"
[ "$(sha256sum "$LIB/cogagent" | cut -d' ' -f1)" = "$BIN_SUM" ] || { echo "FAIL 二进制校验"; exit 1; }
[ "$(sha256sum "$BIN" | cut -d' ' -f1)" = "$WRAP_SUM" ] || { echo "FAIL 包装层校验"; exit 1; }
[ "$(sha256sum "$ETC/cac.json" | cut -d' ' -f1)" = "$CFG_SUM" ] || { echo "FAIL 配置校验"; exit 1; }
grep -q "COGAGENT_CAC_TOKEN" "$BIN" || { echo "FAIL 包装层不是新版"; exit 1; }
grep -q "service_port" "$BIN" || { echo "FAIL 包装层缺少端口分配"; exit 1; }
grep -q "TMPDIR" "$BIN" || { echo "FAIL 包装层缺少 TMPDIR 处理"; exit 1; }
"$LIB/cogagent" --version || { echo "FAIL 二进制无法运行"; exit 1; }

echo ""
echo "== 安装完成"
echo "   二进制: $LIB/cogagent  ($BIN_SUM)"
echo "   包装层: $BIN           ($WRAP_SUM)"
echo "   配置:   $ETC/cac.json  ($CFG_SUM)"
echo "   证书:   $ETC/cert.pem（空占位，请手动替换为企业 CA）"
echo ""
if [ "$SVC_USER" = "root" ]; then
  echo "   下一步：把企业 CA 覆盖到 $ETC/cert.pem 后运行 cogagent"
else
  echo "   下一步：把企业 CA 覆盖到 $ETC/cert.pem 后运行 su - $SVC_USER -c \"cogagent\""
fi
