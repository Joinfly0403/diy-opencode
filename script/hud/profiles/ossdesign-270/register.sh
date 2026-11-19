#!/bin/bash
# profile: OSSDesign 270.x —— 平台自研 ROA（OSSApplication 无 add_handlers），底层仍是 Tornado
# 做法：给 tornado.web.Application.__init__ 打旁路，把 /hud/* 插到路由表最前面
# 用法：register.sh <ossdiyservice.py> [--apply|--dry-run]
set -uo pipefail
exec python3 "$(dirname "$0")/register_impl.py" "$@"
