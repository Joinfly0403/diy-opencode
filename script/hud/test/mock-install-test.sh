#!/usr/bin/env bash
# HUD 安装器本地 mock 测试（在 WSL 里用假目录 + 假 systemctl 模拟 270/272）
set -uo pipefail

# 仓库内自测：bash test/mock-install-test.sh（需要 root，建议在 WSL/容器里跑）
REPO=$(cd "$(dirname "$0")/.." && pwd)
ROOT=/tmp/hudtest
APPDIR=$ROOT/app
SHIM=$ROOT/shim
PASS=0; FAIL=0

say() { printf '%s\n' "$*"; }
pass() { PASS=$((PASS+1)); printf '  [PASS] %s\n' "$*"; }
fail() { FAIL=$((FAIL+1)); printf '  [FAIL] %s\n' "$*"; }
chk() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

say "===== 0) 准备环境 ====="
rm -rf "$ROOT"
mkdir -p "$SHIM" "$APPDIR"
# 假 systemctl
cat > "$SHIM/systemctl" <<'EOF'
#!/bin/bash
case "$1" in
  is-active) exit 0 ;;
  restart|enable|disable|daemon-reload|stop) exit 0 ;;
  *) exit 0 ;;
esac
EOF
chmod +x "$SHIM/systemctl"
# 假 ipmc_adm（脚本里是绝对路径调用，可能不存在 → 用 || true 兜住）
export PATH="$SHIM:$PATH"

# 造两个版本目录
mk_env() {
  local d="$1" flavor="$2"
  mkdir -p "$d/webapps/ossdesignwebsite/osmuwebsite_app" \
           "$d/pyscript/ossdesign/interface"
  printf '/* fake app_main */\n' > "$d/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js"
  if [ "$flavor" = "272" ]; then
    REPO_FOR_TEST="$REPO" python3 - "$d/pyscript/ossdiyservice.py" <<'PY'
import sys
s = open(__import__("os").path.join(__import__("os").environ.get("REPO_FOR_TEST", "."), "server/ossdiyservice.py"), encoding="utf-8").read()
i = s.find("    # HUD_BRIDGE_V3")
if i >= 0:
    j = s.find('print("[hud] bridge disabled:", _hud_exc)', i)
    j = s.find("\n", j) + 1
    s = s[:i] + s[j:]
open(sys.argv[1], "w", encoding="utf-8").write(s)
PY
  else
    cat > "$d/pyscript/ossdiyservice.py" <<'PY'
import os
import sys

from enginering_com_utils.http_util import rest
from interface.designer import OssDesigner

application_map = {"common_util": OssDesigner()}


def main():
    rest.INIT_APPLICATION("idx", app_version_file=None, extend_http_server_config_list=[])
    for _, application in application_map.items():
        rest.REGISTER_SERVANT(application)
    rest.START_APPLICATION()


if __name__ == '__main__':
    main()
PY
  fi
}

mkdir -p "$ROOT/env272" "$ROOT/env270"
mk_env "$ROOT/env272" 272
mk_env "$ROOT/env270" 270

# 假 APP_ROOT（脚本里 readlink -f /opt/cloud/manager/apps/OSSDesignService）
mkdir -p /opt/cloud/manager/apps
ln -sfn "$ROOT/env272" /opt/cloud/manager/apps/OSSDesignService
mkdir -p /srv/cogagent/users

# 复制待测脚本
cp -a "$REPO/common" "$ROOT/common"
cp -a "$REPO/profiles" "$ROOT/profiles"
cd "$ROOT"

say "  环境: $(id -un) | app -> $(readlink -f /opt/cloud/manager/apps/OSSDesignService)"

########## T1: 272 --check ##########
say ""
say "===== T1: 272 --check ====="
bash common/install-all.sh --check > "$ROOT/t1.log" 2>&1
chk "272 --check 退出码 0" "[ $? -eq 0 ]"
chk "识别为 ossdesign-272" "grep -q 'ossdesign-272' '$ROOT/t1.log'"
chk "未改动 ossdiyservice.py" "! grep -q HUD_BRIDGE '$ROOT/env272/pyscript/ossdiyservice.py'"

########## T2: 272 安装 ##########
say ""
say "===== T2: 272 安装 ====="
bash common/install-all.sh --no-restart-oss > "$ROOT/t2.log" 2>&1
RC=$?
chk "安装退出码 0（实际 $RC）" "[ $RC -eq 0 ]"
chk "前端 hud.v1.js 存在于 osmuwebsite_app" "[ -f '$ROOT/env272/webapps/ossdesignwebsite/osmuwebsite_app/hud.v1.js' ]"
chk "bootstrap 指向 osmuwebsite_app/hud.v1.js" "grep -q 'osmuwebsite_app/hud.v1.js' '$ROOT/env272/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js'"
chk "注册块 HUD_BRIDGE_V3 出现 1 次" "[ \"\$(grep -c HUD_BRIDGE_V3 '$ROOT/env272/pyscript/ossdiyservice.py')\" = '1' ]"
chk "注册位置在 add_handlers 之后" "python3 -c \"import sys;s=open('$ROOT/env272/pyscript/ossdiyservice.py').read();i=s.find('HUD_BRIDGE_V3');j=s.find('.add_handlers(');sys.exit(0 if j>=0 and i>j else 1)\""
chk "broker.py 含 WAIT_READY_V1" "grep -q WAIT_READY_V1 /opt/cloud/manager/tools/cogagent-hud/broker.py"
chk "桥白名单含 login/reset" "grep -q 'login/reset' '$ROOT/env272/pyscript/ossdesign/interface/hud_proxy.py'"
chk "profiles 已安装到 tools" "[ -d /opt/cloud/manager/tools/cogagent-hud/profiles/ossdesign-272 ]"

########## T3: 272 再装一次（幂等 + 版本递增）##########
say ""
say "===== T3: 272 重复安装 ====="
bash common/install-all.sh --no-restart-oss > "$ROOT/t3.log" 2>&1
chk "生成 hud.v2.js" "[ -f '$ROOT/env272/webapps/ossdesignwebsite/osmuwebsite_app/hud.v2.js' ]"
chk "bootstrap 指向 v2" "grep -q 'osmuwebsite_app/hud.v2.js' '$ROOT/env272/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js'"
chk "注册块仍只有 1 个" "[ \"\$(grep -c HUD_BRIDGE_V3 '$ROOT/env272/pyscript/ossdiyservice.py')\" = '1' ]"

########## T4: 切到 270 安装 ##########
say ""
say "===== T4: 270 安装 ====="
ln -sfn "$ROOT/env270" /opt/cloud/manager/apps/OSSDesignService
bash common/install-all.sh --no-restart-oss > "$ROOT/t4.log" 2>&1
RC=$?
chk "安装退出码 0（实际 $RC）" "[ $RC -eq 0 ]"
chk "识别为 ossdesign-270" "grep -q 'ossdesign-270' '$ROOT/t4.log'"
chk "前端 hud.v1.js（270 新目录）" "[ -f '$ROOT/env270/webapps/ossdesignwebsite/osmuwebsite_app/hud.v1.js' ]"
chk "注册块 HUD_BRIDGE_V6 出现 1 次" "[ \"\$(grep -c HUD_BRIDGE_V6 '$ROOT/env270/pyscript/ossdiyservice.py')\" = '1' ]"
chk "270 没有 V3 块" "! grep -q HUD_BRIDGE_V3 '$ROOT/env270/pyscript/ossdiyservice.py'"
chk "V6 块在模块级（有 _hud_install_bridge）" "grep -q '_hud_install_bridge()' '$ROOT/env270/pyscript/ossdiyservice.py'"
chk "bootstrap 指向 osmuwebsite_app/hud.v1.js（270）" "grep -q 'osmuwebsite_app/hud.v1.js' '$ROOT/env270/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js'"

########## T5: 270 重复安装 ##########
say ""
say "===== T5: 270 重复安装 ====="
bash common/install-all.sh --no-restart-oss > "$ROOT/t5.log" 2>&1
chk "生成 hud.v2.js（270）" "[ -f '$ROOT/env270/webapps/ossdesignwebsite/osmuwebsite_app/hud.v2.js' ]"
chk "V6 仍只有 1 个" "[ \"\$(grep -c HUD_BRIDGE_V6 '$ROOT/env270/pyscript/ossdiyservice.py')\" = '1' ]"

########## T6: 卸载 270 ##########
say ""
say "===== T6: 270 卸载 ====="
bash common/uninstall-all.sh --yes > "$ROOT/t6.log" 2>&1 || true
chk "hud*.js 已删除（270）" "! ls '$ROOT/env270/webapps/ossdesignwebsite/osmuwebsite_app/'hud*.js >/dev/null 2>&1"
chk "V6 块已移除" "! grep -q HUD_BRIDGE_V6 '$ROOT/env270/pyscript/ossdiyservice.py'"
chk "bootstrap 标记已移除" "! grep -q 'oss-hud-bootstrap-v2' '$ROOT/env270/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js'"
chk "systemd 单元已删除" "[ ! -f /etc/systemd/system/cogagent-hud-broker.service ]"
chk "app_main.js 仍存在（未被误删）" "[ -f '$ROOT/env270/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js' ]"

########## T7: 卸载 272 ##########
say ""
say "===== T7: 272 卸载 ====="
ln -sfn "$ROOT/env272" /opt/cloud/manager/apps/OSSDesignService
bash common/uninstall-all.sh --yes > "$ROOT/t7.log" 2>&1 || true
chk "hud*.js 已删除（272）" "! ls '$ROOT/env272/webapps/ossdesignwebsite/osmuwebsite_app/'hud*.js >/dev/null 2>&1"
chk "V3 块已移除" "! grep -q HUD_BRIDGE_V3 '$ROOT/env272/pyscript/ossdiyservice.py'"
chk "桥文件已删除" "[ ! -f '$ROOT/env272/pyscript/ossdesign/interface/hud_proxy.py' ]"
chk "app_main.js 仍存在（272）" "[ -f '$ROOT/env272/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js' ]"

say ""
say "===== 结果: PASS=$PASS FAIL=$FAIL ====="
[ "$FAIL" = "0" ] && exit 0 || exit 1
