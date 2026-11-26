# cogagent HUD（OSSDesign 页面悬浮助手 + 接口录制/回放）

> 技术细节见 [docs/design/hud-implementation.md](../../docs/design/hud-implementation.md)。
> 本文只讲：装什么、怎么装、怎么用、怎么排障。

## 组成

| 文件 | 部署位置 | 作用 |
|---|---|---|
| `common/hud.js` | `<OSSDesign>/webapps/ossdesignwebsite/osmuwebsite_app/hud.vNN.js` | 面板 UI + 录制器 + 执行器 |
| `common/broker.py` | `/opt/cloud/manager/tools/cogagent-hud/broker.py` | 本机 127.0.0.1:18765，宏/运行记录、AI 对话 |
| `common/macro_store.py` | 同上 | 宏与运行记录落盘 |
| `common/hud_proxy.py` | `<OSSDesign>/pyscript/ossdesign/interface/hud_proxy.py` | 页面 → broker 的同源桥 |
| `common/cogagent-hud-broker.service` | `/etc/systemd/system/` | systemd 单元 |
| `downloads/cogagent-hud-bundle.tgz` | 手工上传 | 发布包（仓库每次提交都更新） |

## 安装（执行用户：root）

```bash
rm -rf /root/hud-bundle && mkdir -p /root/hud-bundle
tar -xzf /root/cogagent-hud-bundle.tgz -C /root/hud-bundle
cd /root/hud-bundle && bash common/install-all.sh 2>&1 | tail -8
systemctl restart cogagent-hud-broker
curl -s --noproxy '*' http://127.0.0.1:18765/status; echo
```

装完确认浏览器加载的是新文件：

```bash
A=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
W="$A/webapps/ossdesignwebsite/osmuwebsite_app"
grep -o 'hud[^\"]*\.js' "$W/app_main.js" | sort -u
ls -l "$W"/hud*.js
```

手工复制 `hud*.js` 后必须补：

```bash
chown ossadm:ossgroup "$W"/hud*.js && chmod 0640 "$W"/hud*.js
```

页面 Console 出现 `[hud] build <时间>` 才说明新文件生效；否则 Ctrl+Shift+R。

## 使用

1. 点 COG 球打开面板，连接（SSO）。
2. 点「录制」→ 在页面上操作（建项目/建站/向导）→ 点「停止」。
3. 控制台打印 `[录制结果]`，确认步骤形状：
   - `lookup` 的 `text` 带 `{{shortstamp}}`
   - `createSite` 带 `save:{site_id:"id"}`
   - 有 `assertList` / `assertField`
4. 输入动作名保存 → 工具栏点一下即回放。

## 宏存储（服务器）

```
/var/lib/cogagent-hud/
├─ macros/index.json
├─ macros/<账号>/<id>.json
├─ runs/<账号>/<yyyy-mm>.jsonl
└─ runs/<账号>/<yyyy-mm>.api.jsonl
```

## 排障

| 现象 | 处理 |
|---|---|
| 一直「等待中（n/30）」 | 点「■ 停止执行」；或 `curl -X POST --noproxy '*' http://127.0.0.1:18765/agent/macro/cancel -d '{"note":"manual"}'` |
| `lookup 未找到匹配项` | 看 `.api.jsonl` 里 `createPrj.req` 与 `queryPrjLst.res`，名字必须完全一致 |
| `占位符未解析` | 被引用的步骤没执行或路径错；检查该步 `as` 与响应结构 |
| 后端 500 | 错误信息带 `req=`，按请求体校正 payload |
| COG 球消失 | `hud*.js` 属主/权限不对（ossadm 读不到 → 404） |

## 双机同步

见 [SYNC.md](SYNC.md)：线上改动 → 导出回仓库 → 重新打包 → 推送。
