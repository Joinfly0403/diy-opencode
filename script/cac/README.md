# CAC 接入（包装层 + 沙箱 + mock 测试）

本目录只放**不含敏感信息**的部分：端点、client_id、CA 一律从 `/etc/cogagent/cac.json` 读取，
仓库里不出现内网域名、账号、令牌。

## 文件

| 文件 | 作用 |
|---|---|
| `cogagent` | 包装层：单实例软检查 → 浏览器授权 → 建目录 → 进沙箱 → 注入 provider 配置 → 启动 TUI |
| `sandbox.sh` | 沙箱：盖掉用户根、bind 回自己、掉能力、校验条目数（fail-closed） |
| `mock-server.py` | 本地 mock CAC 服务，用于无内网环境下验证链路 |

## 已在本机（WSL）验证

1. 包装层登录（mock）→ 用户信息 → 模型清单 → `[cogagent] 账号 mockuser 区域 yellow 模型 3 个`
2. 沙箱内可见账号只有自己：`users 下可见: mockuser`
3. `OPENCODE_CONFIG_CONTENT` 注入生效：`bun src/index.ts --standalone models` 输出
   `cac/mock-chat`、`cac/mock-chat-large`、`cac/mock-flash`

## 原生插件（已实现）

配置声明的 provider 不会把 package 写进 model 记录，所以必须有插件。
插件在 `packages/core/src/plugin/provider/cac.ts`：

- 读 `/etc/cogagent/cac.json`（或 `COGAGENT_CAC_CONFIG`）
- 令牌与模型清单来自环境 `COGAGENT_CAC_TOKEN` / `COGAGENT_CAC_MODELS`（包装层注入，ptrace_scope=1 下同 UID 读不到）
- `providers.add({ info, models })`，每个 model 显式带 `package`
- 请求头由 provider 的 headers 注入

单元测试：`packages/core/test/plugin/provider-cac.test.ts`（8 项，全绿）。

真实对话在 mock 下已验证：

    > build · mock-chat
    你好，我是 mock 模型
    [mock] "POST /api/v2/chat/completions HTTP/1.1" 200

## 本地复现

```bash
python3 script/cac/mock-server.py 18080 &
cat > /tmp/mock-cac.json <<JSON
{
  "apiBase": "http://127.0.0.1:18080",
  "authBase": "http://127.0.0.1:18080",
  "clientId": "mock-client",
  "scope": "1000",
  "scopeResource": "devuc",
  "snapengine": { "yellow": "http://127.0.0.1:18080/api/v2", "green": "http://127.0.0.1:18080/api/v2" },
  "headers": { "agentType": "AgentCenter", "pluginVersion": "mock", "kernelVersion": "mock", "clientVersion": "mock" },
  "caPath": "/nonexistent",
  "rootBase": "/tmp/cac-root",
  "timeouts": { "loginSeconds": 10, "pollSeconds": 0.2 }
}
JSON

COGAGENT_CAC_CONFIG=/tmp/mock-cac.json \
COGAGENT_SANDBOX=$PWD/script/cac/sandbox.sh \
COGAGENT_CMD="cd packages/cli && exec bun src/index.ts --standalone" \
python3 script/cac/cogagent models
```

## 踩过的坑（都已在代码里修）

| 坑 | 现象 | 修法 |
|---|---|---|
| `os.pipe()` 读端本身就是 fd 3 | `Bad file descriptor` | `r == 3` 时不要 `dup2`、不要 `close` |
| Python stdout 缓冲 | 关键行在 exec 后丢失 | `print(..., flush=True)` |
| 从仓库根启动 TUI | `Cannot find module 'react/jsx-dev-runtime'` | 包装层 `os.chdir` 到工作区 |
| 沙箱内起后台服务失败 | `NodeHttpServer` 报错 | 包装层默认加 `--standalone` |
| 逐个遮蔽兄弟目录 | 属主不同时 mount 被拒 | 改为遮蔽父目录 + bind 回自己 |
