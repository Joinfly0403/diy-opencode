# 服务器 ↔ 仓库 同步说明

> 原则：**线上跑的文件 = 仓库里的文件（逐字节一致）**。不靠"重新打补丁"，靠原样导出。

## 一、从服务器导出到仓库（每次线上改动后必做）

在**服务器**上（root）：

```bash
APP_ROOT=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
D="$APP_ROOT/webapps/ossdesignwebsite/plugin/hud"
P="$APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py"
B=/opt/cloud/manager/tools/cogagent-hud

S=/tmp/hudsync; rm -rf "$S"; mkdir -p "$S"
cp -f "$B/broker.py"     "$S/broker.py"
cp -f "$B/recover.sh"    "$S/recover.sh"
cp -f "$P"               "$S/hud_proxy.py"
cp -f "$D/hud.vNN.js"    "$S/hud.js"          # 换成当前线上版本号
cp -f "$APP_ROOT/pyscript/ossdiyservice.py" "$S/ossdiyservice.py"
cd "$S" && tar czf /tmp/hud-sync.tgz .
sha256sum /tmp/hud-sync.tgz
```

在**Windows**（PowerShell）：

```powershell
scp root@10.44.228.181:/tmp/hud-sync.tgz $env:TEMP\
# 解包后覆盖仓库：
#   script/hud/common/{broker.py,hud_proxy.py,hud.js,recover.sh}
#   script/hud/server/*（原样留档）
```

然后更新 `script/hud/manifest.json`（sha256/size），提交。

## 二、从仓库部署到服务器（重装/新机器）

在**服务器**上（root），把仓库 `script/hud/` 内容拷到临时目录后：

```bash
bash deploy.sh            # 自动版本号并切换指向
bash deploy.sh --keep     # 只安装文件，不切换（预演）
```

`deploy.sh` 会：装 broker/recover → 装桥并打注册（锚点不匹配则拒绝）→ 装 `hud.vN.js` → 改 bootstrap 与 recover 指向 → 重启 → 快照 + 自检。

## 三、校验一致性

```bash
# 执行用户：root
cd /opt/cloud/manager/tools/cogagent-hud
sha256sum broker.py recover.sh
sha256sum "$(readlink -f /opt/cloud/manager/apps/OSSDesignService)/pyscript/ossdesign/interface/hud_proxy.py"
sha256sum "$(readlink -f /opt/cloud/manager/apps/OSSDesignService)/webapps/ossdesignwebsite/plugin/hud/$(grep -o 'hud\.v[0-9]*\.js' /opt/cloud/manager/apps/OSSDesignService/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js | head -1)"
```

与 `script/hud/manifest.json` 里的 sha256 对比即可。

## 四、纪律

1. 线上每次改动 → 立刻 `recover.sh snapshot`（assets 才是重装恢复的依据）
2. 当天结束 → 按第一节导出 → 覆盖仓库 → 更新 manifest → 提交
3. 不要在服务器上长期保留"仓库里没有的改动"
