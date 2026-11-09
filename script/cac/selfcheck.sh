#!/bin/bash
# cogagent 环境自检（10 项）
set -u
PASS=0
FAIL=0
ok()   { echo "  [OK]   $1"; PASS=$((PASS+1)); }
bad()  { echo "  [FAIL] $1  <-- $2"; FAIL=$((FAIL+1)); }
warn() { echo "  [WARN] $1  <-- $2"; }

ETC=/etc/cogagent
ROOT_DIR=/srv/cogagent
USERS_DIR=$ROOT_DIR/users
AUDIT_DIR=/var/log/cogagent
CERT=$ETC/cert.pem
CFG=$ETC/cac.json

echo "=== 身份 ==="
echo "  runner=$(id -un) uid=$(id -u) kernel=$(uname -r)"
echo ""

echo "=== 1. 目录存在且属主正确 ==="
for d in "$ROOT_DIR" "$USERS_DIR" "$ROOT_DIR/login-logs" "$AUDIT_DIR"; do
  if [ -d "$d" ]; then
    ok "$d ($(stat -c %U:%G:%a "$d"))"
  else
    bad "$d 缺失" "运行 install.sh"
  fi
done

echo ""
echo "=== 2. 用户目录可写（当前身份） ==="
if touch "$USERS_DIR/.wtest" 2>/dev/null; then
  rm -f "$USERS_DIR/.wtest"
  ok "$USERS_DIR 可写"
else
  bad "$USERS_DIR 不可写" "检查属主/权限"
fi

echo ""
echo "=== 3. ptrace_scope ==="
if [ -r /proc/sys/kernel/yama/ptrace_scope ]; then
  V=$(cat /proc/sys/kernel/yama/ptrace_scope)
  if [ "$V" = "1" ]; then ok "ptrace_scope=1"; else bad "ptrace_scope=$V" "sysctl -w kernel.yama.ptrace_scope=1"; fi
else
  warn "内核无 Yama" "无法限制同 UID 内存访问"
fi

echo ""
echo "=== 4. 企业 CA 文件 ==="
if [ -f "$CERT" ]; then
  SUBJ=$(openssl x509 -in "$CERT" -noout -subject 2>/dev/null | head -1)
  case "$SUBJ" in
    *PLACEHOLDER*) warn "$CERT 是占位证书" "请替换为企业 CA" ;;
    "") warn "$CERT 无法解析" "确认是 PEM 格式证书" ;;
    *) ok "$CERT ($SUBJ)" ;;
  esac
else
  bad "$CERT 缺失" "放置企业 CA 或运行 install.sh"
fi

echo ""
echo "=== 5. 配置文件 ==="
if [ -f "$CFG" ]; then
  if python3 -m json.tool "$CFG" >/dev/null 2>&1; then ok "$CFG 合法"; else bad "$CFG 非法 JSON" "修正后重试"; fi
else
  bad "$CFG 缺失" "运行 install.sh"
fi

echo ""
echo "=== 6. 服务可达性（用 $CERT 校验） ==="
API=$(python3 -c 'import json;print(json.load(open("/etc/cogagent/cac.json"))["apiBase"])' 2>/dev/null)
if [ -z "$API" ]; then
  warn "读不到 apiBase" "先修好配置"
else
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --cacert "$CERT" --max-time 8 "$API/chat/modles" 2>/dev/null)
  case "$CODE" in
    200|401|403) ok "可达 $API (HTTP $CODE)" ;;
    000) bad "不可达或被证书拒绝" "检查 CA、DNS、网络" ;;
    *) warn "HTTP $CODE" "网络通但状态码非预期" ;;
  esac
fi

echo ""
echo "=== 7. user namespace ==="
if unshare -Ur true 2>/dev/null; then ok "可建 user namespace"; else bad "不允许 userns" "调整内核策略"; fi

echo ""
echo "=== 8. mount namespace ==="
if unshare -Urm sh -c 'mount -t tmpfs none /mnt' 2>/dev/null; then ok "命名空间内可挂载"; else bad "命名空间内不能挂载" "换 bubblewrap 或调策略"; fi

echo ""
echo "=== 9. setpriv ==="
if command -v setpriv >/dev/null 2>&1; then ok "setpriv 存在"; else bad "缺少 setpriv" "util-linux 未装全"; fi

echo ""
echo "=== 10. 沙箱端到端（遮蔽 + 掉能力） ==="
BASE=$(mktemp -d)
mkdir -p "$BASE/a" "$BASE/b"
echo a > "$BASE/a/x"
echo b > "$BASE/b/y"
export BASE

cat > "$BASE/step1.sh" <<'CHK'
mount --make-rprivate / 2>/dev/null
for d in "$BASE"/*; do
  case "$d" in
    */a) ;;
    */step1.sh) ;;
    */step2.sh) ;;
    *) mount -t tmpfs none "$d" 2>/dev/null ;;
  esac
done
echo "count_before=$(ls -A "$BASE/b" | wc -l)"
exec setpriv --bounding-set=-all --inh-caps=-all --ambient-caps=-all --no-new-privs bash "$BASE/step2.sh"
CHK

cat > "$BASE/step2.sh" <<'CHK'
echo "count_after=$(ls -A "$BASE/b" 2>/dev/null | wc -l)"
echo "umount_after=$(umount "$BASE/b" 2>&1 | head -1)"
echo "remount_after=$(mount -t tmpfs none "$BASE/b" 2>&1 | head -1)"
CHK

OUT=$(unshare -Urm bash "$BASE/step1.sh" 2>&1)
echo "$OUT" | sed 's/^/    /'

if echo "$OUT" | grep -q "count_before=0" && echo "$OUT" | grep -q "count_after=0"; then
  ok "遮蔽生效（别人目录不可见）"
else
  bad "遮蔽未生效" "看 count_before / count_after"
fi

if echo "$OUT" | grep -qiE "not permitted|superuser|不允许|Operation"; then
  ok "掉能力后掀不开"
else
  bad "掉能力后仍能 umount" "检查 setpriv 是否生效"
fi

rm -rf "$BASE"

echo ""
echo "=== 结果：通过 $PASS 项，失败 $FAIL 项 ==="
if [ "$FAIL" != "0" ]; then
  echo "有失败项，先修再继续"
  exit 1
fi
