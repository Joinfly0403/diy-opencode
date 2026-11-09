# 部署 / 升级 / 测试

> 二进制不走 git（单文件 175MB，超过 GitHub 100MB 限制），用 Release 附件分发。

## 1. 装二进制

    install -d -m 0755 /usr/local/lib/cogagent
    install -m 0755 cogagent-linux-arm64 /usr/local/lib/cogagent/cogagent
    /usr/local/lib/cogagent/cogagent --version     # 期望 opencode vlocal

## 2. 装脚本

    install -m 0755 script/cac/cogagent   /usr/local/bin/cogagent
    install -m 0755 script/cac/sandbox.sh /usr/local/lib/cogagent/sandbox.sh
    rm -f /usr/local/lib/cogagent/cogagent-core    # 清掉早期探针

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
