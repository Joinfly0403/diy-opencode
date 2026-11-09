# 部署 / 升级 / 测试

## 0. 约定：所有上传包放 `/root/deploy/`

服务器上的安装包、升级包、离线发布物一律放在 **`/root/deploy/`**，不要散落在 `/root`、`/tmp`、`/home`。

    /root/deploy/
      cogagent-install-arm64.run      ← 自解压安装包（含程序、配置、证书占位、脚本）
      （升级包也放这里，文件名带版本号）

安装：

    bash /root/deploy/cogagent-install-arm64.run          # 会先确认
    bash /root/deploy/cogagent-install-arm64.run --yes    # 跳过确认
    bash /root/deploy/cogagent-install-arm64.run /root/deploy/unpacked   # 只解压

安装包自身不改动 `/root/deploy/` 的内容，解压与安装都在临时目录里完成。

> 二进制不走 git（单文件 175MB，超过 GitHub 100MB 限制），用 Release 附件分发。

## 1. 装二进制

    install -d -m 0755 /usr/local/lib/cogagent
    install -m 0755 cogagent-linux-arm64 /usr/local/lib/cogagent/cogagent
    /usr/local/lib/cogagent/cogagent --version     # 期望 opencode vlocal

## 2. 装脚本

    install -m 0755 script/cac/cogagent /usr/local/bin/cogagent
    rm -f /usr/local/lib/cogagent/cogagent-core    # 清掉早期探针
    # 沙箱已内建在包装层里，不再需要 sandbox.sh

## 3. 环境（首次）

    bash script/cac/install.sh                     # 目录、权限、sysctl、CA 占位、配置
    su - ossadm -c "bash /srv/cogagent/tools/selfcheck.sh"

配置文件默认在 `/etc/cogagent/cac.json`，企业 CA 在 `/etc/cogagent/cert.pem`。

## 4. 运行

    su - ossadm -c "cogagent"

授权后进入 TUI；默认模型是包装层拉到的第一个模型。

## 5. 验收清单

| # | 命令 / 操作 | 期望 |
|---|---|---|
| 1 | `cogagent --version` | `opencode vlocal` |
| 2 | `selfcheck.sh` | 通过 14 项，失败 0 |
| 3 | `cogagent` | 授权后进 TUI |
| 4 | Ctrl+P → model | 4 个 `cac/*` 模型 |
| 5 | 问一句话 | 正常回答 |
| 6 | 让它 `ls /srv/cogagent/users` | 只看到自己账号目录 |
| 7 | 再开一个 `cogagent` | 提示已有实例，回车退出 |

## 6. 升级 / 卸载

    # 升级：换二进制 + 脚本，数据保留
    install -m 0755 cogagent-linux-arm64 /usr/local/lib/cogagent/cogagent

    # 卸载（先列清单，输入 YES 才删）
    bash script/cac/uninstall.sh

## 7. 已知未实现

- 令牌不会自动刷新（3 天到期后需重新授权）
- 审计落盘未实现
- 默认模型取清单第一个，不按“上次使用 / large”规则
- `reasoning_content` 未单独展示

## 已知问题：MobaXterm 下鼠标滚轮不滚动会话

**结论（已定位，代码无责）**：MobaXterm 不把滚轮作为 SGR 鼠标事件（`\x1b[<64;`/`<65;`）发给应用，程序侧收不到滚轮，因此无法处理。同一台服务器用 Windows Terminal 滚动正常。

排查依据（在 WSL/服务器实测）：

| 证据 | 值 |
|---|---|
| 渲染器鼠标 | `useMouse=true` |
| 收到的鼠标序列 | 只有 `35`（移动）、`0`（按下）、`32`（拖拽），**没有 64/65** |
| 方向键回退 | 也没有 `\x1b[A`/`\x1b[B` |

替代方案：

- 键盘滚动（已内置）：`PgUp`/`PgDn` 翻页、`Ctrl+Alt+U/D` 半页、`Ctrl+Alt+Y/E` 单行
- 需要滚轮就用 Windows Terminal / Xshell 连同一台机器

> 不要在应用侧为这个做兼容：事件根本没到程序，加多少处理都没用。
