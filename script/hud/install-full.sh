#!/bin/bash
# 全量包入口：内置 cogagent 安装包 + HUD
#   用法（root）：
#     bash install-full.sh --yes-wipe           重装 cogagent（自动备份+还原）+ 装 HUD
#     bash install-full.sh --yes-wipe --no-restore   重装但不还原数据
#     bash install-full.sh --check              只体检
#     bash install-full.sh                      仅装/升级 HUD（不重装 cogagent）
set -euo pipefail
SRC=$(cd "$(dirname "$0")" && pwd)
RUN=$(ls -1 "$SRC"/cogagent-install-*.run 2>/dev/null | head -1 || true)

echo "== 全量包 =="
echo "目录 : $SRC"
echo "安装包: ${RUN:-<未找到>}"
ls -lh "$SRC" | head -20

if [ -z "${RUN:-}" ]; then
  echo "[FAIL] 目录里没有 cogagent-install-*.run"
  exit 1
fi

# 无参数或只带 --check 时不重装 cogagent
if [ $# -eq 0 ]; then
  echo
  echo "未提供参数：将只安装/升级 HUD（不动 cogagent）"
  echo "如需重装 cogagent，请加 --yes-wipe"
  exec bash "$SRC/install-all.sh"
fi

case "$1" in
  --check|--list-backups|--patch-launcher)
    exec bash "$SRC/install-all.sh" "$@"
    ;;
esac

exec bash "$SRC/install-all.sh" --cogagent-pkg="$RUN" "$@"
