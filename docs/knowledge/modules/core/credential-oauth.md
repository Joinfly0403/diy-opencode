---
id: core/credential-oauth
title: 凭据存储与 OAuth 接入
level: L1
layer: core
status: stable
paths:
  - packages/core/src/credential.ts
  - packages/core/src/credential
  - packages/core/src/integration.ts
  - packages/core/src/integration
  - packages/core/src/oauth/page.ts
  - packages/core/src/account
  - packages/core/src/console-access.ts
  - packages/core/src/github-copilot
  - packages/core/src/plugin/provider/credential-settings.ts
  - packages/schema/src/credential.ts
  - packages/schema/src/credential-legacy.ts
  - packages/schema/src/integration.ts
symbols:
  - Credential
  - Integration
  - CredentialTable
  - IntegrationConnection
  - ConsoleAccess
  - OauthCallbackPage
  - CopilotModels
  - AccountTable
  - AccountStateTable
  - ControlAccountTable
  - activeCredential
  - credentialSettings
  - createOpenaiCompatible
  - defaultServer
  - bootstrap
  - key
events:
  - credential.updated
  - credential.switched
  - integration.updated
entry_http:
  - GET /api/credential
  - POST /api/credential
  - PATCH /api/credential/:credentialID
  - POST /api/credential/:credentialID/activate
  - DELETE /api/credential/:credentialID
  - POST /api/integration/:integrationID/connect/oauth
  - GET /api/integration/:integrationID/connect/oauth/:attemptID
tables:
  - credential
  - account
  - account_state
  - control_account
depends_on:
  - contracts/events-db
  - core/provider-models
  - core/plugin-system
related:
  - core/mcp-integration
  - cli/commands
keywords:
  - 凭据
  - credential
  - oauth
  - 登录
  - integration
  - 令牌
  - refresh
  - copilot
  - console
tests:
  - packages/core/test/credential.test.ts
  - packages/core/test/credential-lock.test.ts
  - packages/core/test/integration.test.ts
  - packages/core/test/integration-refresh.test.ts
  - packages/core/test/oauth-page.test.ts
  - packages/core/test/github-copilot
  - packages/core/test/plugin/provider-github-copilot.test.ts
source_hash: c0e25dcd086b2514a4e8a316d0bef7c70222df8c
---

## 职责

三件事，围绕"用户/组织提供的登录材料"：

1. **凭据存储** `credential.ts`：sqlite `credential` 表的 CRUD，外加"同一 integration 只有一个 active"的选择语义；变更发布 `credential.updated` / `credential.switched`（`{ global: true }`）。
2. **登录流程** `integration.ts`：Integration 注册表（integration + methods）+ 五种方法（`oauth` / `key` / `external` / `command` / `env`）+ OAuth attempt 状态机 + `connection.resolve` 的令牌刷新。
3. **控制台与 Copilot**：`console-access.ts` 从凭据 metadata 推出 Console 的 server 与鉴权头；`github-copilot/` 是设备码登录 + Copilot 侧的 AI SDK 适配（`copilot-provider.ts` 装配、`models.ts` 目录对账）。

## 边界

- **凭据值只有三种形状**：`OAuth{methodID,refresh,access,expires,metadata?}`、`Key{key,metadata?}`、`External{methodID,metadata?}`。`External` 只存"引用"，真正的密钥在外部（云厂商 CLI/SDK）手里，opencode 不代管续期。
- **不存明文到配置文件**：唯一存储是 sqlite `credential` 表（旧版 `auth.json` 由迁移导入后不再读写）。
- Integration 注册表不拥有凭据值：`revision` 只反映 integration 定义变化；凭据由 `Credential` 拥有。
- 不做 UI：弹窗/表单在 TUI 与 app 侧，这里是 `Form` 描述 + HTTP 端点。
- `account` / `account_state` / `control_account` 只剩表定义（`account/sql.ts`），仓库内没有运行时读取方，仅由迁移与 `schema.gen.ts` 保留。

## 入口与调用链

**存一个 key**：`POST /api/integration/:id/connect/key`（或 command/external 端点）→ `Integration.connection.key/external` → `createCredential`（自动生成 label：`<integration name>`、`<name> 2`…）→ `Credential.create` → 事务里改 `active` → 发布事件。

**OAuth**：
1. `POST /api/integration/:id/connect/oauth` → `Integration.oauth.connect` → 取该 method 的 `authorize(answer)`（实现由 provider 插件通过 `ctx.integration.transform` 注册）→ 返回 `Attempt{attemptID, url, instructions, mode}`。
2. `mode: "auto"`（设备码/本地回环）：`authorize` 给出的 `callback` 在 attempt scope 里跑，完成即 `settle`；`paste: true` 时也接受用户粘贴回调 URL。
3. `mode: "code"`：客户端轮询 `GET …/connect/oauth/:attemptID`，用 `POST` 带 code 收尾（`Integration.oauth.complete`）。
4. `settle` → `createCredential` 落库 → 终态 `complete|failed`，保留 1 分钟后被清理。

**用凭据**：provider 插件启动时 `activeCredential(ctx, integrationID)` 或 `ctx.integration.connection.active/resolve`；`resolve` 在 `expires <= now + 5min` 时用 `Credential.lock` + method 的 `refresh` 换新并 `update` 回库。

## 数据与状态

- `credential`：`id / integration_id / label / value(json) / connector_id / method_id / active / timestamps`。`label` 是给人看的可重命名名，`active` 是选择位。
- `account` / `account_state`（`active_account_id`、`active_org_id`）/ `control_account`：历史表，迁移仍在建。
- 读取顺序固定：`orderBy(asc(active), asc(time_created), asc(id))` 用于列表；"当前激活"用 `desc(active), desc(time_created), desc(id)`。
- OAuth attempt 全部在内存 `SynchronizedRef`：`attemptLifetime = 10 分钟`、终态保留 `1 分钟`、每 `30s` 扫一次过期；**进程重启即丢失未完成的 attempt**。
- attempt 生命周期细节：过期 attempt 关闭其 scope；成功但尚在落库（`persisting`）的 attempt 不能被取消、过期或重复 claim。
- 兼容：行内 `value` 用 `CredentialLegacy.Value` 解码（v2.1 前 key 把表单答案放 `configuration`，现合并进 `metadata`）。

## 关键不变式

- **同一 integration 只允许一个 active**：`activate`/`create`/`remove` 都在事务内 `deactivateAll` 再置位；删除 active 时按 `time_created` 选最新的一条接替，并把 `credential.switched` 的 `credentialID` 置为 `null`（无接替者）。
- **旧行没有 active 标志**：新建时若要保持"不激活"，得先把当前最新行 `active` 钉成 true，否则新行按时间会被当成激活（代码里就为这个场景专门写了一段）。
- **刷新必须合并并发**：`Credential.lock` 让同一凭据的并发调用共享同一个运行中的结果（含失败），跨进程用 `flock("credential-refresh:<id>")`；锁内要"重读 + 再判过期"，因为等待期间别的 Location 可能已经刷新。`refresh` 超时 30s。
- **没有 `refresh` 就不刷新**：只有 `value.type === "oauth"` 且该 method 注册了 `refresh` 才走刷新路径。GitHub Copilot 注册的实现没有 `refresh`，并且故意写 `expires: 0`（token 无到期信息，直接透传）。
- **OAuth 完成即持久化**：`settle` 内 `Effect.uninterruptible`，落库阶段的 attempt 不可取消，避免"凭据写了一半"。
- **`credential.*` 事件是全局的**：用 `{ global: true }` 发布，因为凭据不属于单个 Location。
- **Copilot 适配目录不许当通用 OpenAI 兼容层改**（`github-copilot/README.md`）：`chat/`、`responses/` 要贴近上游 Vercel AI SDK 结构，只保留有意的 Copilot 适配（`thinking_budget`、opaque reasoning、无状态 Responses、轮换 item ID、function-tool strictness 优先）；只保留流式路径（`doGenerate` 抛错）。认证、请求头、模型路由属于 provider 插件，不在这两个目录里。

## 扩展点

- **加一种登录方式**：`packages/schema/src/integration.ts` 加 `Method` 变体 → `integration.ts` 的 `Editor.method.update` 与对应 `connection.*` 分支 → provider 插件里 `ctx.integration.transform` 注册 → 补 `answerError` 表单校验（`Form.validateFields`）。
- **加一个 OAuth provider**：写一个 `OAuthImplementation{ integrationID, method, authorize, refresh?, label? }`，在插件里 `editor.method.update(...)`；`authorize` 返回 `{ url, instructions, mode, callback }`。
- **加一个新的凭据形状**：`schema/credential.ts` 的 `Value` union + `credential/sql.ts` 的类型 + `Credential.Info` 解码 + 迁移脚本（老行要能继续解）。
- **改 Console 端点**：`console-access.ts` 的 `defaultServer` 与 `server()` 的旧域名重写、`headers()` 的 `x-org-id`。
- **改 Copilot 模型目录**：`github-copilot/models.ts`（`load` / `derive`），路由与端点选择在 `plugin/provider/github-copilot.ts`。

## 常见改法与坑

- 以为 `Credential.lock` 是通用互斥：它按 `credential.id` 去重，只有"同一凭据的同一操作"才合并。
- 在 `connection.resolve` 之外直接读 `credential.value` 使用 OAuth access：会绕过刷新窗口，拿到已过期 token。
- 以为 attempt 会持久化：服务重启后 `GET …/connect/oauth/:attemptID` 只会得到 `AttemptNotFound`。
- 改 `credential` 表结构忘了兼容解码：`CredentialLegacy.Value` 是老行的唯一通道，删掉会读不出历史凭据。
- 给 Copilot 加 `refresh`：它会改变"每次 resolve 都判断过期"的行为（`expires: 0` 恒过期），必须同时改 `authorize` 里的 `expires`。
- 把 `external` 方法当成密钥存储：它只存 `methodID` + `metadata`，真实 token 由外部进程/CLI 提供。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/credential.ts` | 凭据 CRUD、active 选择、`lock` 合并刷新、事件 |
| `packages/core/src/credential/sql.ts` | `credential` 表定义 |
| `packages/core/src/integration.ts` | Integration 注册表、五种方法、OAuth attempt 状态机、`connection.resolve` 刷新 |
| `packages/core/src/integration/connection.ts` | `Connection.Info/Status`、连接身份 `key` |
| `packages/core/src/oauth/page.ts` | 本地回环回调页（success/error/bootstrap），自包含 HTML |
| `packages/core/src/console-access.ts` | Console server 推导 + Bearer/`x-org-id` 头 |
| `packages/core/src/account/sql.ts` | `account`/`account_state`/`control_account` 表（无运行时读者） |
| `packages/core/src/github-copilot/copilot-provider.ts` | Copilot AI SDK 装配入口 |
| `packages/core/src/github-copilot/models.ts` | Copilot 模型目录抓取与对账 |
| `packages/core/src/plugin/provider/credential-settings.ts` | 凭据 → provider settings 的桥 |
| `packages/schema/src/credential.ts` | `OAuth/Key/External/Value` 契约与事件 |
| `packages/schema/src/credential-legacy.ts` | 老行/老导出的兼容解码 |
| `packages/schema/src/integration.ts` | Integration/Method/Attempt 契约 |
| `packages/core/src/database/migration/20260805200742_import_legacy_credentials.ts` | `auth.json` → `credential` 的迁移 |
