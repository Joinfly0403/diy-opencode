#!/bin/bash
# cogagent HUD 一键恢复 / 体检
#   bash recover.sh check      只检查，不改任何东西
#   bash recover.sh snapshot   把线上可用文件快照到 assets/
#   bash recover.sh apply      按需恢复 + 必要重启 + 自检
set -uo pipefail

TOOLS=/opt/cloud/manager/tools/cogagent-hud
ASSETS="$TOOLS/assets"
LAUNCHER=/usr/local/bin/cogagent
BROKER_URL=http://127.0.0.1:18765
MARK_REG=HUD_BRIDGE_V3

me() { id -un; }
say() { printf '%s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; }
ok() { printf '[ OK ] %s\n' "$*"; }
bad() { printf '[FAIL] %s\n' "$*"; }

need_root() {
  if [ "$(me)" != "root" ]; then bad "需 root 执行（当前 $(me)）"; exit 1; fi
}

app_root() { readlink -f /opt/cloud/manager/apps/OSSDesignService; }
svc_pid() { pgrep -f ossdiyservice.py 2>/dev/null | head -1; }
svc_running() { [ -n "$(svc_pid)" ]; }

local_port() {
  local pid
  pid=$(svc_pid)
  if [ -n "$pid" ]; then ss -ltnp 2>/dev/null | grep "pid=$pid," | awk '{print $4}' | head -1; fi
}

svc_restart() {
  say "[root] 重启 OSSDesign ..."
  su - ossadm -c "bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd restartapp -app OSSDesignService" || return 1
  sleep 10
  if svc_running; then ok "OSSDesign 已恢复"; else bad "OSSDesign 仍未运行"; fi
}

check_all() {
  local rc=0 root port n code
  root=$(app_root)
  port=$(local_port)

  say "== 环境 =="
  say "执行用户 : $(me)"
  say "APP_ROOT : $root"
  say "本地端口 : ${port:-未发现}"

  say ""
  say "== 服务 =="
  if svc_running; then ok "OSSDesign RUNNING（pid $(svc_pid)）"; else bad "OSSDesign 未运行"; rc=1; fi
  if systemctl is-active --quiet cogagent-hud-broker; then ok "broker active"; else bad "broker 未运行"; rc=1; fi
  if ss -ltn 2>/dev/null | grep -q '127.0.0.1:18765'; then ok "18765 在监听"; else bad "18765 未监听"; rc=1; fi
  if ss -ltn 2>/dev/null | grep -q '127.0.0.1:50461'; then ok "agent 50461 在监听"; else warn "50461 未监听（可能需重新登录）"; fi

  say ""
  say "== 文件 =="
  if [ -f "$TOOLS/broker.py" ]; then ok "broker.py"; else bad "broker.py 缺失"; rc=1; fi
  if [ -f "$root/pyscript/ossdesign/interface/hud_proxy.py" ]; then ok "桥文件"; else bad "桥文件缺失"; rc=1; fi
  if [ -f "$root/webapps/ossdesignwebsite/plugin/hud/hud.v59.js" ]; then ok "前端 hud.js"; else bad "前端缺失"; rc=1; fi

  say ""
  say "== 注册 =="
  if grep -q "$MARK_REG" "$root/pyscript/ossdiyservice.py" 2>/dev/null; then ok "已含 $MARK_REG"; else bad "注册块缺失"; rc=1; fi
  if [ -f "$ASSETS/hud_proxy.py" ] && [ -f "$ASSETS/hud.js" ]; then ok "assets 快照存在"; else warn "assets 不完整"; fi

  say ""
  say "== 自启动 bootstrap =="
  BOOT="$root/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js"
  if [ -f "$BOOT" ] && grep -q "oss-hud-bootstrap-v2" "$BOOT" 2>/dev/null; then
    ok "app_main.js 已含 HUD bootstrap v2"
  else
    bad "app_main.js 缺少 HUD bootstrap v2"; rc=1
  fi

  say ""
  say "== 启动器 =="
  n=$(grep -c COGAGENT_SERVE_ONLY "$LAUNCHER" 2>/dev/null || echo 0)
  if [ "$n" -ge 1 ]; then ok "serve-only 补丁在（$n 处）"; else warn "启动器疑似被覆盖"; fi

  say ""
  say "== 接口 =="
  code=$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' --max-time 5 "$BROKER_URL/status" 2>/dev/null)
  if [ "$code" = "200" ]; then ok "broker /status 200"; else bad "broker /status = $code"; rc=1; fi

  return $rc
}

do_snapshot() {
  local root
  root=$(app_root)
  install -d -o ossadm -g ossgroup -m 0750 "$ASSETS"

  if [ -f "$root/pyscript/ossdesign/interface/hud_proxy.py" ]; then
    cp -f "$root/pyscript/ossdesign/interface/hud_proxy.py" "$ASSETS/hud_proxy.py"; ok "快照 hud_proxy.py"
  else bad "线上无 hud_proxy.py"; fi

  if [ -f "$root/webapps/ossdesignwebsite/plugin/hud/hud.v59.js" ]; then
    cp -f "$root/webapps/ossdesignwebsite/plugin/hud/hud.v59.js" "$ASSETS/hud.js"; ok "快照 hud.js"
  else bad "线上无 hud.js"; fi

  if [ -f "$TOOLS/broker.py" ]; then
    cp -f "$TOOLS/broker.py" "$ASSETS/broker.py"; ok "快照 broker.py"
  fi

  if [ -f "$TOOLS/recover.sh" ]; then
    cp -f "$TOOLS/recover.sh" "$ASSETS/recover.sh"; ok "快照 recover.sh"
  fi

  chown -R ossadm:ossgroup "$ASSETS"
  chmod 0640 "$ASSETS"/* 2>/dev/null
  say "快照目录: $ASSETS"
}

do_apply() {
  local root proxy hud svc changed
  changed=0
  root=$(app_root)
  proxy="$root/pyscript/ossdesign/interface/hud_proxy.py"
  hud="$root/webapps/ossdesignwebsite/plugin/hud/hud.v59.js"
  svc="$root/pyscript/ossdiyservice.py"

  install -d -o ossadm -g ossgroup -m 0750 "$TOOLS" "$ASSETS"

  if [ ! -f "$TOOLS/broker.py" ] && [ -f "$ASSETS/broker.py" ]; then
    install -m 0750 -o ossadm -g ossgroup "$ASSETS/broker.py" "$TOOLS/broker.py"; ok "恢复 broker.py"
  elif [ -f "$TOOLS/broker.py" ]; then ok "broker.py 已存在"
  else bad "broker.py 缺失且无快照"; fi

  if [ ! -f "$proxy" ] && [ -f "$ASSETS/hud_proxy.py" ]; then
    install -m 0644 -o ossadm -g ossgroup "$ASSETS/hud_proxy.py" "$proxy"; ok "恢复桥文件"
  elif [ -f "$proxy" ]; then ok "桥文件已存在"
  else bad "桥文件缺失且无快照"; fi

  if [ ! -f "$hud" ] && [ -f "$ASSETS/hud.js" ]; then
    install -d -o ossadm -g ossgroup -m 0750 "$(dirname "$hud")"
    install -m 0640 -o ossadm -g ossgroup "$ASSETS/hud.js" "$hud"; ok "恢复前端"
  elif [ -f "$hud" ]; then ok "前端已存在"
  else bad "前端缺失且无快照"; fi

  BOOT="$root/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js"
  if [ -f "$BOOT" ] && ! grep -q "oss-hud-bootstrap-v2" "$BOOT" 2>/dev/null; then
    cp -f "$BOOT" "$BOOT.bak.$(date +%Y%m%d%H%M%S)"
    printf '\n%s\n' ';/*oss-hud-bootstrap-v2*/(function(){try{if(window.__OSS_HUD_BOOT_V2__)return;window.__OSS_HUD_BOOT_V2__=1;var s=document.createElement("script");s.src="/ossdesignwebsite/plugin/hud/hud.v59.js";s.async=false;s.onerror=function(){};(document.head||document.documentElement).appendChild(s);}catch(e){}})();' >> "$BOOT"
    chown ossadm:ossgroup "$BOOT"; chmod 0640 "$BOOT"
    ok "已追加 HUD bootstrap v2"
  fi

  if grep -q "$MARK_REG" "$svc" 2>/dev/null; then
    ok "注册已存在"
  else
    python3 - "$svc" <<'PY'
import sys, shutil, time
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
anchor = (
    '    from rest.handler import OSSRequestHandler\n'
    '    rest.G_APPLICATION.add_handlers(r".*", [(r"/ossdesignwebsite/(.*)", OSSRequestHandler)])\n'
)
if anchor not in s:
    print("ANCHOR_MISMATCH"); raise SystemExit(3)
block = (
    "\n"
    "    # HUD_BRIDGE_V3\n"
    "    try:\n"
    "        from interface.hud_proxy import HudProxyHandler\n"
    '        rest.G_APPLICATION.add_handlers(\n'
    '            r".*", [(r"/rest/ossdesign/v1/designer/hud/(.*)", HudProxyHandler)])\n'
    '        print("[hud] bridge enabled")\n'
    "    except Exception as _hud_exc:\n"
    '        print("[hud] bridge disabled:", _hud_exc)\n'
    "\n"
)
shutil.copy2(p, p + ".bak." + time.strftime("%Y%m%d%H%M%S"))
open(p, "w", encoding="utf-8").write(s.replace(anchor, anchor + block, 1))
print("REGISTERED")
PY
    case $? in
      0) changed=1; ok "已写入注册块" ;;
      3) bad "锚点不匹配，拒绝修改" ;;
      *) bad "注册失败" ;;
    esac
  fi

  if ! systemctl is-active --quiet cogagent-hud-broker; then
    systemctl daemon-reload 2>/dev/null
    systemctl start cogagent-hud-broker 2>/dev/null || systemctl enable --now cogagent-hud-broker 2>/dev/null
    sleep 2
  fi
  systemctl is-active --quiet cogagent-hud-broker && ok "broker active" || bad "broker 启动失败"

  if ! svc_running; then svc_restart
  elif [ "$changed" = "1" ]; then svc_restart
  else ok "OSSDesign 正常，跳过重启"; fi

  echo ""
  check_all
}

case "${1:-check}" in
  check) need_root; check_all ;;
  snapshot) need_root; do_snapshot ;;
  apply) need_root; do_apply ;;
  *) say "用法: bash recover.sh {check|snapshot|apply}"; exit 2 ;;
esac
