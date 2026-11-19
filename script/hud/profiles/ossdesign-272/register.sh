#!/bin/bash
# profile: OSSDesign 272.x —— 在 ossdiyservice.py 的 main() 里追加 add_handlers
# 用法：register.sh <ossdiyservice.py> [--apply|--dry-run]
# 退出码：0 成功/已存在；3 找不到插入点；4 语法校验失败（已回滚）
set -uo pipefail
exec python3 "$(dirname "$0")/register_impl.py" "$@"
