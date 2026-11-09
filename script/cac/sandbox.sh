#!/bin/bash
# 沙箱：遮掉整个用户根，再 bind 回自己；失败即退出；最后执行目标命令
set -u
SELF_ROOT="$1"
BASE_DIR=$(dirname "$SELF_ROOT")
TMP=/tmp/.cogagent-self-$$

mkdir -p "$TMP" || exit 3
mount --make-rprivate / 2>/dev/null

mount --bind "$SELF_ROOT" "$TMP" || { echo "[sandbox] bind self failed" >&2; exit 3; }
mount -t tmpfs none "$BASE_DIR" || { echo "[sandbox] mask parent failed" >&2; exit 3; }
mkdir -p "$SELF_ROOT" || { echo "[sandbox] mkdir self failed" >&2; exit 3; }
mount --bind "$TMP" "$SELF_ROOT" || { echo "[sandbox] restore self failed" >&2; exit 3; }
umount "$TMP" 2>/dev/null
rmdir "$TMP" 2>/dev/null

N=$(ls -A "$BASE_DIR" | wc -l)
if [ "$N" != "1" ]; then
  echo "[sandbox] verification failed: $N entries" >&2
  exit 3
fi

exec setpriv --bounding-set=-all --inh-caps=-all --ambient-caps=-all --no-new-privs \
  bash -c "${COGAGENT_CMD:-exec /usr/local/lib/cogagent/cogagent}"
