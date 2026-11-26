此目录存放可直接下载的发布物（供内网无 GitHub 登录环境使用）。

| 文件 | 说明 |
|---|---|
| `cogagent-hud-bundle.tgz` | HUD 安装包（common + profiles + test + examples + 安装脚本） |

当前包：

```
size    = 78,893 bytes
sha256  = 587be520a6830110a3fc55ea150fa43df88d3510a1d9ce07413e3421399a3ea5
```

下载地址：

- https://raw.githubusercontent.com/Joinfly0403/diy-opencode/dev/script/hud/downloads/cogagent-hud-bundle.tgz
- https://github.com/Joinfly0403/diy-opencode/releases/download/cogagent-intranet-20261110/cogagent-hud-bundle.tgz

上传后校验：

```bash
sha256sum /root/cogagent-hud-bundle.tgz
```

安装：

```bash
rm -rf /root/hud-bundle && mkdir -p /root/hud-bundle
tar -xzf /root/cogagent-hud-bundle.tgz -C /root/hud-bundle
cd /root/hud-bundle && bash common/install-all.sh 2>&1 | tail -8
systemctl restart cogagent-hud-broker
```
