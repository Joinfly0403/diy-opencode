# CAC 接入（包装层 + 沙箱 + mock 测试）

本目录只放**不含敏感信息**的部分：端点、client_id、CA 一律从 `/etc/cogagent/cac.json` 读取，
仓库里不出现内网域名、账号、令牌。

## 文件

| 文件 | 作用 |
|---|---|
| `cogagent` | 包装层：单实例软检查 → 浏览器授权 → 建目录 → 进沙箱 → 注入 provider 配置 → 启动 TUI |
| （沙箱） | 已**内建在包装层**：包装层自己 unshare + mount + 掉能力，不再需要独立脚本 |
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


## 编译单文件（Linux）

原 `packages/cli/script/build.ts` 已随发布面一起删除，最小替代是
`packages/cli/script/build-linux.ts`。

    # 构建机先装全平台原生包（交叉编译需要）
    bun install --os="*" --cpu="*" --libc="*"

    # 交叉编译
    TARGET=bun-linux-arm64 bun packages/cli/script/build-linux.ts
    TARGET=bun-linux-x64   bun packages/cli/script/build-linux.ts

产物在 `dist/cogagent-linux-<arch>`。

脚本里有两个从原 build.ts 继承下来的补丁，缺一不可：

| 插件 | 解决什么 |
|---|---|
| `ws-named-reexports` | Bun 在 sideEffects-free 模块里丢掉 `export * from "ws"`，编译后 NodeWS 具名导出为空 |
| `plugin-runtime-static` | 编译后二进制没有 node_modules，插件运行时模块必须在构建期解析成静态表 |

已验证：x64 产物 `--version` 输出 `opencode vlocal`；arm64 产物为 ELF aarch64 可执行文件。
