#!/bin/bash
# 全量包入口：内置 cogagent 安装包 + HUD（common + profiles）
#   bash install-full.sh --yes-wipe     重装 cogagent + 装 HUD
#   bash install-full.sh --check        只体检
#   bash install-full.sh                只装/升级 HUD
set -euo pipefail
SRC=$(cd "$(dirname "$0")" && pwd)
RUN=$(ls -1 "$SRC"/cogagent-install-*.run 2>/dev/null | head -1 || true)

if [ ! -d /opt/cloud/manager/apps/OSSDesignService ]; then
  echo "[FAIL] 未检测到 OSSDesign（/opt/cloud/manager/apps/OSSDesignService）"
  echo "       本包不含 OSSDesign 本体，请先安装 OSSDesign"
  exit 1
fi

mkdir -p "$SRC/common" "$SRC/profiles"
# 兼容两种布局：解包后 common/ 在脚本旁，或脚本就在 common/ 里
if [ ! -d "$SRC/profiles/ossdesign-270" ] && [ -d "$SRC/../profiles/ossdesign-270" ]; then
  SRC=$(cd "$SRC/.." && pwd)
fi

echo "== 全量包 =="
echo "目录 : $SRC"
echo "安装包: ${RUN:-<未找到>}"
[ -z "${RUN:-}" ] && { echo "[FAIL] 缺少 cogagent-install-*.run"; exit 1; }

case "${1:-}" in
  --check|--list-backups|--patch-launcher) exec bash "$SRC/common/install-all.sh" "$@" ;;
  "") exec bash "$SRC/common/install-all.sh" ;;
esac
exec bash "$SRC/common/install-all.sh" --cogagent-pkg="$RUN" "$@"
