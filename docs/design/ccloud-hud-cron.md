# ccloud-hud 定时任务：旧 HUD 被反复恢复的排查与处置

> 现象：每次环境安装/升级后，页面上会出现**旧的 COG 球**（与我们的新版 HUD 并存，出现两个球）。
> 结论：存在一个**每 5 分钟执行的自愈脚本**，它把旧版 `plugin/hud.js` 恢复回去，并保证 `app_main.js` 里有指向它的引导。
> 状态：**已定位，处置方案未执行**（本文只记录事实与方案）。

---

## 1. 结论速览

| 项 | 内容 |
|---|---|
| 定时任务 | `/etc/cron.d/ccloud-hud`：`*/5 * * * * ossadm /bin/bash /opt/ccloud-hud/ensure.sh` |
| 脚本 | `/opt/ccloud-hud/ensure.sh`（80 行，3122 B，`ossadm:ossgroup`，2026-11-06 17:23） |
| 脚本自述 | “OSS Design HUD - 自愈脚本：确保 HUD 注入始终生效。微服务重装/升级后自动恢复，无需人工干预。” |
| 旧 HUD 源 | `/opt/ccloud-hud/hud.js`（19228 B，2026-11-06 17:18） |
| 线上副本 | `<APP_ROOT>/webapps/ossdesignwebsite/plugin/hud.js`（md5 与源完全一致） |
| 来源 | `/var/log/secure`：2026-11-06 17:18/17:23 由 **SFTP 上传** |
| 后果 | 页面同时加载 `plugin/hud.js`（旧）与 `osmuwebsite_app/hud.vN.js`（新）→ **两个球** |

## 2. 排查过程（只读命令）

### 2.1 cron

~~~bash
crontab -l -u root
for u in $(cut -d: -f1 /etc/passwd); do crontab -l -u "$u" 2>/dev/null; done
cat /etc/crontab; ls -l /etc/cron.d /etc/cron.hourly /etc/cron.daily
grep -rn "hud" /etc/crontab /etc/cron.d /etc/cron.hourly /etc/cron.daily /var/spool/cron 2>/dev/null
~~~
命中：
~~~
/etc/cron.d/ccloud-hud:4:*/5 * * * * ossadm /bin/bash /opt/ccloud-hud/ensure.sh >/dev/null 2>&1
~~~

### 2.2 systemd（排除）
~~~bash
systemctl list-timers --all --no-pager
systemctl list-units --type=path --all --no-pager
grep -rl "hud" /etc/systemd/system /usr/lib/systemd/system 2>/dev/null
~~~
结果：只有我们自己的 `cogagent-hud-broker.service`，**没有** hud 相关 timer/path 单元。

### 2.3 脚本与文件身份核对
~~~bash
ls -la /opt/ccloud-hud
sed -n '1,120p' /opt/ccloud-hud/ensure.sh
A=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
ls -l "$A/webapps/ossdesignwebsite/plugin/hud.js"
md5sum "$A/webapps/ossdesignwebsite/plugin/hud.js" /opt/ccloud-hud/hud.js
~~~
结果：两者 md5 相同（`425fdb76b655f031268e1aef00d3aa5c`）→ 线上副本就是脚本复制出来的。

### 2.4 执行痕迹
~~~bash
grep -i "ensure.sh" /var/log/cron | tail -5
stat -c '%y | %U:%G | %s | %n' /opt/ccloud-hud/ensure.sh /opt/ccloud-hud/hud.js
~~~
结果：`CROND (ossadm) CMD (/bin/bash /opt/ccloud-hud/ensure.sh ...)` 每 5 分钟一次（10:15、10:20、10:25、10:30、10:35、10:40…）。

### 2.5 为什么会出现“两个球”
~~~bash
grep -o 'oss-hud-bootstrap-v2\|plugin/hud[^"'\'']*\|hud\.v[0-9]*\.js' \
  "$A/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js" | sort | uniq -c
~~~
结果：
~~~
1 hud.v1.js              ← 我们的 -v2 引导
1 oss-hud-bootstrap-v2   ← 我们的标记
1 plugin/hud.js          ← 旧引导段（自愈脚本早期注入的）
~~~
注意：旧引导是**文件** `plugin/hud.js`，不是目录，所以 `grep "plugin/hud/hud.js"` 为 0。

### 2.6 一个关键细节：标记是“子串”
| 脚本使用的标记 | 我们的标记 | 关系 |
|---|---|---|
| `oss-hud-bootstrap` | `oss-hud-bootstrap-v2` | **前者是后者的前缀** |

因此 `ensure.sh` 里的 `grep -q "$MARKER"` 会命中我们的 `-v2` 标记 → **它不会再追加旧引导**；
但它仍然会**每 5 分钟检查并恢复 `plugin/hud.js` 文件**（md5 不一致或文件缺失就复制）。
所以：旧球来自“文件被恢复 + 早期注入段仍在”，而不是“每次都重新注入”。

---

## 3. 影响评估

| 影响 | 说明 |
|---|---|
| 双 HUD | 两个 Shadow DOM 宿主、两个球、可能各自连接 broker（重复调用接口） |
| 版本混乱 | 旧 HUD（19228 B）功能落后，出现“功能时好时坏” |
| 排障困难 | 看起来像“我们的改动被回滚” |
| 不会破坏数据 | 旧 HUD 只做展示/代理，不写业务数据 |

## 4. 处置方案（推荐：改造自愈脚本，而不是删除）

### 4.1 为什么不直接删 cron
| 方案 | 优点 | 缺点 |
|---|---|---|
| 删除/停用 cron | 立刻少一个球 | 丢掉“安装后自动恢复”的能力；若同事的机制还在，可能被再次下发 |
| **改造 cron 指向 v2 脚本（推荐）** | 保留自愈能力，恢复的是我们的 HUD，且自动清理旧物 | 需要一次性改造与验证 |

### 4.2 改造后的行为
| 步 | v1（现状） | v2（改造后） |
|---|---|---|
| 1 | 复制 `hud.js` → `webapps/.../plugin/hud.js` | 复制最新 HUD → `webapps/.../osmuwebsite_app/hud.v<md5前8>.js` |
| 2 | 无 | **删除** `plugin/hud.js`（legacy） |
| 3 | 标记 `oss-hud-bootstrap`，缺则追加 | 标记 `oss-hud-bootstrap-v2`；**删除** `app_main.js` 中含 `plugin/hud.js` 的旧段；把 `src` 指向新文件 |
| 4 | 无 | `node --check` 校验，失败自动回滚 `app_main.js.ccloud-backup` |
| 5 | 日志 `/opt/ccloud-hud/ccloud-hud.log` | 同名日志，保持轮转（>2MB 截断） |

版本化文件名（`hud.v<md5>.js`）还顺带解决**网关对同名静态文件的缓存**问题。

### 4.3 执行步骤（未执行）
| 步 | 动作 | 命令要点 |
|---|---|---|
| 1 | 备份 | `cp -a /etc/cron.d/ccloud-hud`、`cp -a /opt/ccloud-hud`、`cp -a app_main.js` 到 `/root/ccloud-hud-backup-<ts>/` |
| 2 | 写入 `ensure.v2.sh` | 见附录 A；先 `--check` 干跑 |
| 3 | 替换自愈源 | 用 `assets/hud.js`（或线上 `hud.vN.js`）覆盖 `/opt/ccloud-hud/hud.js` |
| 4 | 正式执行一次 | `su - ossadm -c "bash /opt/ccloud-hud/ensure.v2.sh"` |
| 5 | 切换 cron | `sed -i 's#ensure.sh#ensure.v2.sh#' /etc/cron.d/ccloud-hud` |
| 6 | 重启 OSSDesign | `ipmc_adm -cmd restartapp -app OSSDesignService` |
| 7 | 5 分钟后再验 | 只有一个球；`plugin/hud.js` 不存在；`app_main.js` 旧段为 0 |

## 5. 回滚

~~~bash
cp -a /etc/cron.d/ccloud-hud.v1.bak /etc/cron.d/ccloud-hud
cp -a /opt/ccloud-hud/hud.js.bak.<ts> /opt/ccloud-hud/hud.js
A=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
cp -a /root/ccloud-hud-backup-<ts>/app_main.js "$A/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js"
su - ossadm -c "bash /opt/cloud/manager/agent/bin/ipmc_adm -cmd restartapp -app OSSDesignService"
~~~

## 6. 风险与注意事项

| 风险 | 说明 | 缓解 |
|---|---|---|
| 这是**他人/平台下发**的机制 | 对方可能再次覆盖 `ensure.sh` | 改造后同步告知；并保留 cron 文件名不变（只改执行目标） |
| 改造脚本写坏 bundle | `app_main.js` 语法错误 → 整站白屏 | 写入前备份 + `node --check` + 失败回滚 |
| 旧 HUD 文件被其他页面引用 | 若有其他入口引用 `plugin/hud.js` | 全量 grep 一次再删 |
| 缓存 | 同名静态文件可能被网关缓存 | 用 `hud.v<md5>.js` 版本化命名 |

## 7. 待办清单

| # | 事项 | 状态 |
|---|---|---|
| 1 | 与下发该脚本的同事确认归属 | 待确认 |
| 2 | 备份 | 待执行 |
| 3 | 写入并 `--check` 干跑 `ensure.v2.sh` | 待执行 |
| 4 | 替换自愈源 HUD | 待执行 |
| 5 | 切换 cron + 重启 | 待执行 |
| 6 | 5 分钟后复验（单球、无 legacy、bundle 正确） | 待执行 |
| 7 | 把该机制写进 `docs/hud-handover.md` 运维章节 | 待执行 |

## 附录 A：ensure.v2.sh（完整脚本）

~~~bash
#!/bin/bash
# OSS Design HUD - 自愈脚本 v2（cogagent HUD 版）
# 与 v1 差异：恢复 cogagent HUD（osmuwebsite_app/hud.<md5>.js）；清理 legacy；标记用 -v2
# 用法：ensure.v2.sh [--check]
set -u
HUD_HOME=/opt/ccloud-hud
SRC_HUD="$HUD_HOME/hud.js"
LOG="$HUD_HOME/ccloud-hud.log"
APP_LINK=/opt/cloud/manager/apps/OSSDesignService
MARKER='oss-hud-bootstrap-v2'
CHECK=0; [ "${1:-}" = "--check" ] && CHECK=1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }
say() { [ "$CHECK" = "1" ] && echo "$*"; }

if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG" 2>/dev/null || echo 0)" -gt 2097152 ]; then
  tail -n 2000 "$LOG" > "$LOG.tmp" && mv -f "$LOG.tmp" "$LOG"
fi

[ -f "$SRC_HUD" ] || { log "ERROR: source hud.js missing: $SRC_HUD"; echo "ERROR: 缺 $SRC_HUD"; exit 1; }
APP_ROOT=$(readlink -f "$APP_LINK" 2>/dev/null)
[ -n "$APP_ROOT" ] && [ -d "$APP_ROOT" ] || { log "ERROR: cannot resolve APP_ROOT"; exit 1; }

WEBAPP="$APP_ROOT/webapps/ossdesignwebsite"
DEST_DIR="$WEBAPP/osmuwebsite_app"
BUNDLE="$DEST_DIR/app_main.js"
BACKUP="$BUNDLE.ccloud-backup"
SRC_MD5=$(md5sum "$SRC_HUD" | awk '{print $1}')
HUD_NAME="hud.v${SRC_MD5:0:8}.js"
DEST="$DEST_DIR/$HUD_NAME"
URL="/ossdesignwebsite/osmuwebsite_app/$HUD_NAME"

say "APP_ROOT=$APP_ROOT"
say "HUD_NAME=$HUD_NAME"
say "BUNDLE=$BUNDLE"
changed=0

# 1. 恢复 HUD 文件
if [ -d "$DEST_DIR" ]; then
  if [ ! -f "$DEST" ] || [ "$(md5sum "$DEST" 2>/dev/null | awk '{print $1}')" != "$SRC_MD5" ]; then
    say "would install $DEST"
    if [ "$CHECK" = "0" ]; then
      cp -f "$SRC_HUD" "$DEST" || { log "ERROR: copy $DEST failed"; exit 1; }
      chown ossadm:ossgroup "$DEST" 2>/dev/null; chmod 640 "$DEST"
      log "installed $DEST (md5=$SRC_MD5)"
    fi
    changed=1
  fi
fi

# 2. 清理 legacy
OLD_HUD="$WEBAPP/plugin/hud.js"
if [ -f "$OLD_HUD" ]; then
  say "would remove legacy $OLD_HUD"
  [ "$CHECK" = "0" ] && { rm -f "$OLD_HUD" && log "removed legacy plugin/hud.js"; }
  changed=1
fi

# 3. bundle 引导：删旧段 + 指向新文件
if [ -f "$BUNDLE" ]; then
  NEED=0
  grep -q 'plugin/hud\.js' "$BUNDLE" && NEED=1
  grep -q "$MARKER" "$BUNDLE" || NEED=1
  grep -q "$URL" "$BUNDLE" || NEED=1
  if [ "$NEED" = "1" ]; then
    say "would update bootstrap in $BUNDLE -> $URL"
    if [ "$CHECK" = "0" ]; then
      cp -p "$BUNDLE" "$BACKUP" 2>/dev/null
      python3 - "$BUNDLE" "$URL" "$MARKER" <<'PY'
import sys, re
bundle, url, marker = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(bundle, encoding="utf-8", errors="surrogateescape").read()
orig = s
s = "\n".join(l for l in s.split("\n") if "plugin/hud.js" not in l)
s = re.sub(r'(;/\*' + re.escape(marker) + r'\*/.*?s\.src=")[^"]*(")',
           lambda m: m.group(1) + url + m.group(2), s, flags=re.S)
if marker not in s:
    s = s.rstrip("\n") + ('\n;/*%s*/(function(){try{if(window.__OSS_HUD_BOOT_V2__)return;'
                         'window.__OSS_HUD_BOOT_V2__=1;var s=document.createElement("script");'
                         's.src="%s";s.async=false;s.onerror=function(){};'
                         '(document.head||document.documentElement).appendChild(s);}catch(e){}})();\n'
                         % (marker, url))
if s != orig:
    open(bundle, "w", encoding="utf-8", errors="surrogateescape").write(s)
    print("bootstrap updated")
PY
      if command -v node >/dev/null 2>&1; then
        if ! node --check "$BUNDLE" >/dev/null 2>&1; then
          log "ERROR: bundle syntax broken, restoring backup"
          cp -p "$BACKUP" "$BUNDLE"; echo "ERROR: 注入后语法错误，已回滚"; exit 1
        fi
      fi
      log "bootstrap updated -> $URL"
    fi
    changed=1
  fi
else
  log "WARN: bundle not found: $BUNDLE"
fi

[ "$changed" = "1" ] && log "ensure done (APP_ROOT=$APP_ROOT)"
[ "$CHECK" = "1" ] && echo "CHECK 完成（未修改）"
exit 0
~~~

## 附录 B：涉及路径清单

| 类型 | 路径 |
|---|---|
| cron | `/etc/cron.d/ccloud-hud` |
| 脚本 | `/opt/ccloud-hud/ensure.sh`（v1）/ `ensure.v2.sh`（改造后） |
| 日志 | `/opt/ccloud-hud/ccloud-hud.log` |
| 旧源 | `/opt/ccloud-hud/hud.js`（19228 B，md5 `425fdb76…`） |
| 旧线上 | `<APP_ROOT>/webapps/ossdesignwebsite/plugin/hud.js` |
| 新线上 | `<APP_ROOT>/webapps/ossdesignwebsite/osmuwebsite_app/hud.vN.js` |
| bundle | `<APP_ROOT>/webapps/ossdesignwebsite/osmuwebsite_app/app_main.js` |
| bundle 备份 | `app_main.js.ccloud-backup`（v1 脚本创建） |
