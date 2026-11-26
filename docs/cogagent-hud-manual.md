# cogagent + cogagent-hud-bundle 技术手册

> 本文自包含：不依赖其它文档即可读懂已实现的两部分——**cogagent 产品本体**与 **cogagent-hud-bundle**。
> 只写**已实现、已变更**的内容；不写规划项。

---

# 第一部分：cogagent

## 1. 基线与开发规模

| 项 | 值 |
|---|---|
| 上游基线 | `6a89e9f2`（2026-11-07，与 `upstream/dev` 同一提交） |
| 开发区间 | 2026-11-07 → 2026-11-26，共 **157 个提交** |
| 分支/远端 | `dev` → `origin`（`Joinfly0403/diy-opencode`） |
| 提交规范 | conventional commits（`feat/fix/docs/chore/refactor/test` + scope） |

改动分布：`hud` 87、`tui` 27、`cac` 20、`linux` 4、`brand` 2、`core` 2、`cli` 2、其余文档/知识库。
内核（`core`/`server`/`protocol`/`schema`/`sdk`）基本沿用上游，开发集中在外围。

---

## 2. 形态收敛：Linux-only 终端产品

| 变更 | 规模 |
|---|---|
| 删除 GUI / marketing / publishing 面 | 7644 文件，+134 / **−1,112,178 行** |
| 删除 workerd runtime 与 ACP bridge | 83 文件，−9,641 |
| 删除自更新与 Windows-only 面 | 34 文件，−3,041 |
| 修复删除后的 manifests 与 start-call arity | — |

删除的包（12）：

```
app  desktop  gui-plugins  plugin-browser  plugins  script
session-ui  simulation  stats  stories  ui  web
```

删除的顶层目录：`services/`、`sdks/`、`nix/`、`infra/`、`install/`（以及 `sst.config.ts`、`sst-env.d.ts`）。

保留的 22 个包：

```
ai  cli  client  codemode  core  effect-drizzle-sqlite  function
http-recorder  httpapi-codegen  identity  latex  merman  patchmark
plugin  process-daemon  protocol  schema  sdk  server  theme  tui  util
```

单文件 Linux 产物构建：`packages/cli/script/build-linux.ts`。

---

## 3. 品牌：opencode → cogagent

| 项 | 实现 |
|---|---|
| 运行时目录 | `cogagent`（`packages/util/src/global.ts`：`const app = "cogagent"`） |
| 数据库 | `cogagent.db` |
| 配置 | `cogagent.json` / `cogagent.jsonc`，配置发现优先新名 |
| 环境变量 | `packages/util/src/env.ts` 的 `Env.read()`：优先 `COGAGENT_<NAME>`，缺失时回落 `OPENCODE_<NAME>` 并打印一次弃用告警 |
| TUI 字标 | `cog|agent` 像素字标（5×7 点阵、ANSI 阴影），标题与续接提示显示新名 |

回落分支是**兼容期实现**，当前代码即按此行为运行。

---

## 4. CAC 登录、安装与运行环境

### 4.1 交付脚本（`script/cac/`）

| 文件 | 作用 |
|---|---|
| `cogagent` | 登录包装器：拉起 CAC/SSO、捕获登录链接与账号、再启动 TUI |
| `cogagent-local` | 本地模式启动器（无需域账号） |
| `install.sh` | 全量安装（由自解压包调用，也可手动执行） |
| `uninstall.sh` / `selfcheck.sh` | 卸载与自检 |
| `mock-server.py` | 无域环境下的登录流程演练 |
| `DEPLOY.md` / `README.md` | 部署与使用说明 |

### 4.2 安装行为（`install.sh`）

- 必须 root 运行；先清空旧内容再按包内文件重建（**全量替换**）。
- 安装根目录 `/srv/cogagent`，按用户分目录 `users/`；服务账号优先 `ossadm`，**系统中没有 ossadm 时回落 root**。
- 安装包组成：`cogagent-linux-*` 二进制 + `cogagent` 包装层 + `cac.json`。
- 自解压安装包内嵌 launcher，单文件分发。

### 4.3 运行特性

| 特性 | 实现 |
|---|---|
| 单实例 | 按**账号**判定，不再跨账号互斥 |
| 服务端口 | **每个账号独立端口** |
| 启动方式 | TUI 默认 `--standalone` |
| 语言 | 默认中文（`COGAGENT_LANG=zh_CN`） |
| 终端 | TERM 缺失时兜底；提供可 exec 的 `TMPDIR` |
| 本地模式 | `cogagent-local`：`COGAGENT_MODE=local`，数据落 `~/.cogagent/{config,data,state,cache,tmp}`，权限 700；用第三方 key（`DEEPSEEK_API_KEY` 等）或 `config/opencode/opencode.jsonc` |

---

## 5. 权限：全放行开关

`packages/core/src/permission.ts`：

```ts
export function bypassPermissions(): boolean {
  return process.env.COGAGENT_BYPASS_PERMISSIONS === "1"
      || process.env.OPENCODE_BYPASS_PERMISSIONS === "1"
}
```

- 命中时所有工具直接 `allow`，不弹询问。
- 仅用于可信环境/无人值守；未设置时保持原权限流程。
- 有对应单测 `packages/core/test/permission.test.ts`。

---

## 6. TUI：中文化与交互修复

### 6.1 国际化机制

`packages/tui/src/i18n.ts` 提供 `t()` / `L()`，默认中文、英文兜底；所有用户可见文案走这两个函数。

已中文化范围（按提交顺序）：

| 范围 | 内容 |
|---|---|
| 命令与快捷键 | 内置命令标题、快捷键标签 |
| 命令面板 | 每条描述（在渲染处翻译）、内联提示 |
| 斜杠补全 | 补全项描述 |
| 对话框 | 标题、行、通用动作 |
| 反馈 | toast、权限提示、空态文案 |
| 设置页 | 设置项与快捷键词汇 |
| 其它 | schedule 命令描述、侧边栏用量标签 |

### 6.2 布局与滚动

| 项 | 实现 |
|---|---|
| 侧边栏宽度 | 可拖拽调整；竖排标签宽度固定 42，拖拽不抖动 |
| 会话滚动条 | 默认显示 |
| 滚轮 | 曾改为路由到会话区，**已回滚**（保留原行为） |

### 6.3 重绘与尺寸

| 场景 | 实现 |
|---|---|
| 宿主不上报 resize | 轮询终端尺寸 |
| 运行时不上报尺寸 | 用 ioctl 读取 |
| 尺寸变化 | 强制全量重绘 |
| 手动重绘 | `Ctrl+L` 全量重绘 |

---

## 7. Provider：移除免费模型通道

`84ca7c7426`：删除内置免费模型通道，模型列表只来自登录/配置得到的 provider。

---

## 8. 构建、校验与约定

| 项 | 命令/位置 |
|---|---|
| 运行时/包管理 | `bun@1.4.4` |
| 构建编排 | `turbo` |
| Lint | `bun run lint`（oxlint）、`bun run lint:changed` |
| 规则测试 | `bun run test:lint-rules`、`test:effect-simplification-rules` |
| 类型检查 | 在包目录 `bun typecheck`；**不要直接 `tsc`** |
| 客户端生成 | 改 `HttpApi` 后在 `packages/client` 跑 `bun run generate`，不手改生成物 |
| 知识库 | `bun run knowledge` / `knowledge:bless`（42 张卡，覆盖 1684/1684 源文件） |
| 测试 | 不能在仓库根跑（根脚本直接 `exit 1`），按包目录跑 |
| 换行 | 部署脚本强制 LF |

---

# 第二部分：cogagent-hud-bundle

## 9. 包组成与落地位置

`cogagent-hud-bundle.tgz` 解包后：

```
common/      broker.py macro_store.py hud.js hud_proxy.py hud_register.py
             install-all.sh deploy.sh recover.sh restore.sh uninstall-all.sh
             cogagent-hud-broker.service manifest.json
profiles/    ossdesign-270/ ossdesign-272/（环境注册脚本与笔记）
test/        macro-store-test.sh mock-install-test.sh
examples/    create-project.json
install-full.sh  README.md  SYNC.md
```

安装位置：

| 内容 | 目标路径 |
|---|---|
| broker.py / macro_store.py / 脚本 | `/opt/cloud/manager/tools/cogagent-hud/` |
| systemd 单元 | `/etc/systemd/system/cogagent-hud-broker.service` |
| hud.js | `<OSSDesign>/webapps/ossdesignwebsite/osmuwebsite_app/hud.<版本>.js`（由 `app_main.js` 的 bootstrap 引入） |
| hud_proxy.py / hud_register.py | `<OSSDesign>/pyscript/ossdesign/interface/` |
| 状态 | `/var/lib/cogagent-hud/` |
| 日志 | `/var/log/cogagent-hud/broker.log` |

---

## 10. 运行时架构

```
浏览器（OSSDesign 页面）
  hud.<版本>.js：Shadow DOM 面板 + 录制器（hook fetch/XHR）+ 执行器 execMacro
        │ 同源请求，带 session 与 roarand
        ▼
  hud_proxy.py（OSSDesign 内 Tornado 桥）
        前缀 /rest/ossdesign/v1/designer/hud/*
        把 X-User-Name 注入为 X-Hud-Web-User
        │ http://127.0.0.1:18765
        ▼
  broker.py（systemd: cogagent-hud-broker）
        ├─ 宏与运行记录 → macro_store.py（JSON 落盘）
        ├─ 待执行队列（内存）
        └─ cogagent serve 实例（AI 对话；宏执行不依赖它）
```

- 宏执行是**确定性回放**：只发 HTTP + 操作 DOM，不经过 AI。
- 归属隔离：每个网页账户只能看到/执行自己的宏。

---

## 11. 安装 / 升级 / 卸载

```bash
# 执行用户：root
sha256sum /root/cogagent-hud-bundle.tgz
rm -rf /root/hud-bundle && mkdir -p /root/hud-bundle
tar -xzf /root/cogagent-hud-bundle.tgz -C /root/hud-bundle
cd /root/hud-bundle && bash common/install-all.sh 2>&1 | tail -8
systemctl restart cogagent-hud-broker
curl -s --noproxy '*' http://127.0.0.1:18765/status; echo
```

`install-all.sh` 开关：

| 开关 | 作用 |
|---|---|
| `--check` | 只体检 |
| `--patch-launcher` | 重打 serve-only 启动器补丁 |
| `--cogagent-pkg=x.run --yes-wipe` | 重装 cogagent（自动备份/还原） |
| `--restore=latest` / `--list-backups` | 恢复备份 |
| `--no-restart-oss` / `--keep` | 不重启 OSSDesign / 保留现场 |
| `--uninstall` 或 `common/uninstall-all.sh` | 卸载 |

装完必须校验浏览器实际加载的文件：

```bash
A=$(readlink -f /opt/cloud/manager/apps/OSSDesignService)
W="$A/webapps/ossdesignwebsite/osmuwebsite_app"
grep -o 'hud[^\"]*\.js' "$W/app_main.js" | sort -u     # bootstrap 指向
ls -l "$W"/hud*.js                                       # 现存文件
chown ossadm:ossgroup "$W"/hud*.js && chmod 0640 "$W"/hud*.js   # 手工复制后必须补
```

页面 Console 出现 `[hud] build <时间>` 才说明新文件生效；否则 Ctrl+Shift+R。

---

## 12. 存储与数据模型

```
/var/lib/cogagent-hud/
├─ macros/index.json                 列表索引
├─ macros/<owner>/<macro-id>.json    宏全文
├─ runs/<owner>/<yyyy-mm>.jsonl      每轮一行
├─ runs/<owner>/<yyyy-mm>.api.jsonl  每次接口调用一行（req/res 各 4000 字符）
└─ pins.json                         元素定位缓存
```

宏字段：`id`、`name`、`description`、`owner`、`createdAt`、`steps[]`。

限制：steps ≤ 50、params ≤ 20、单值 ≤ 2000 字符、宏 ≤ 256 KB、每 owner ≤ 200 个。

运行记录字段：

| 字段 | 说明 |
|---|---|
| `runId` | `run_<yyyymmddHHMMSS>_<6位随机>` |
| `macroId` / `macroName` / `owner` | 来源与归属 |
| `startedAt` / `finishedAt` | 时间 |
| `result` | `running` / `ok` / `failed` / `cancelled` |
| `failedStep` / `error` | 失败定位 |
| `steps[]` | 每步 `{action, endpoint, ms, ok, req(≤600), res(≤300), error}` |

---

## 13. 动作 DSL

| action | 字段 | 语义 |
|---|---|---|
| `api` | `method,endpoint,payload,query,headers,as,save` | 发 REST 请求；`as` 存整份响应，`save` 按路径提取多个值 |
| `lookup` | `endpoint,payload,from,where,pick,as` | 查列表 → 匹配行 → 取字段 → 写入 outputs |
| `assertList` | `endpoint,payload,from,where` | 断言列表中存在匹配行 |
| `assertField` | `endpoint,payload,pick,nonEmpty,equals` | 断言某路径字段非空/等于期望 |
| `reload` | — | `location.reload()` |
| `click` | `target,candidates` | 点击（含候选回退） |
| `fill` | `target,value` | 写输入框（React 安全 setter） |
| `select` / `choose` | `target,value` | 原生下拉 / 自定义下拉 |
| `press` | `target,key` | 键盘事件 |
| `wait` | `wait.{selector,text,timeout}` | 等待条件 |
| `read` | `target,as` | 读文本/值入 outputs |
| `verify` | `target,expect` | 断言元素状态 |
| `refresh` / `sleep` | `wait` / `ms` | 等待类 |

---

## 14. 占位符

| 占位符 | 展开 | 说明 |
|---|---|---|
| `{{date}}` | `20261126` | 日期 |
| `{{time}}` | `153012` | 时间 |
| `{{stamp}}` | `20261126153012` | 日期+时间 |
| `{{shortstamp}}` | `261126153012` | **12 位含秒**；名称字段默认追加 |
| `{{datetime}}` | `20261126-153012` | 带连字符 |
| `{{seq:n}}` / `{{rand:n}}` | 序号 / 随机 hex | — |
| `{{参数名}}` | 宏 `params` 值 | — |
| `{{键}}` | outputs 值 | 由 `save`/`lookup.as`/`read.as` 产生 |
| `{{s5.data.x}}` | 第 5 步响应字段 | 录制自动生成 |
| `{{s13.Products[0].product}}` | 数组下标 | 路径解析支持 `[n]` |

规则：

1. 时间戳在**一次执行内冻结**（执行开始那一刻），保证建对象与 lookup 用的是同一时间。
2. 名称类字段自动改写为 `基础名(≤19) + _ + 12 位短戳`，总长 ≤ 32。
3. 发请求前若仍有 `{{...}}` 未解析，**直接报错**，不会把占位符发给后端。

---

## 15. 录制管线（停止录制时按序执行）

1. 收集 hook 到的请求，转成 `api` 步骤（跳过 `/hud/*` 自身轮询与纯展示查询）。
2. 名称加时间戳（键名含 `project/prj/site` + `name`）。
3. 用上游响应值反查下游 payload，生成 `{{sN.path}}`（id 类字段不受长度限制）。
4. `createPrj` 后插项目 `lookup`；`createSite` 响应带 `id` 时写 `save:{site_id:"id"}`，否则插站点 `lookup`。
5. 操作**已有站点**（site_id ≠ 新站点 id）时，按 id 反查站点名，替换为 `{{target_site_id}}` 并在最前面插 `lookup`。
6. 把所有 `lookup.where.text` 同步为最终 payload 值。
7. 插 `assertList`（站点挂在该项目下）与 `assertField`（`querySiteAttr` 的 `site[0].context` 非空）。
8. 末尾追加 `reload`。

纯展示接口不录制：`querySiteParam`、`querySiteCusInfo`、`getStorageSpace`、`getDetailInfo`、`getRouteInfo_Net`。
`querySiteAttr` 必须保留——它是内容落库的唯一验证点。

---

## 16. 执行语义

### 16.1 成败判定

| `retMsg` | 处理 |
|---|---|
| `OK` | 继续 |
| `NA` | **视为成功**（`modifyVnfNameSiteAttr` 的正常路径） |
| `ERROR` / `Error` | 失败，错误信息含 `errorMsg` |
| 无 `retMsg` | 兜底看 `code/retCode/status/success` |

HTTP 非 2xx：错误信息追加 `| req=<请求体前 400 字符>`。

### 16.2 lookup

- `where` 逐键 `String` 比较，空白归一化。
- 多命中取 `pick` 数值最大者。
- 未命中重试 3 次（700ms），仍失败报错并附「列表前 12 项」。
- `as`/`pick` 以 `_id` 结尾时值必须为数字。

### 16.3 并发与僵死

- `macro_busy`：每 2s 重试，最多 30 次；每 5 次调 `cancel {onlyStale:true, minIdle:10}`（只清 10 秒无动静的运行）。
- broker 在 `/macro/run` 前释放 **>20 秒**未更新的运行（页面刷新导致的僵死）。
- 仍占用时提示「点 ■ 停止执行 强制释放」。

---

## 17. HTTP 接口

### 17.1 桥（同源，页面调用）

前缀 `/rest/ossdesign/v1/designer/hud/`：

```
macro/list  macro/get  macro/save  macro/delete
macro/run   macro/result  macro/pending  macro/runs
macro/cancel  macro/pin  macro/pins  macro/whoami
```

### 17.2 broker（127.0.0.1:18765）

```
/status
/agent/macro/{list,get,save,delete,run,result,pending,runs,cancel,pin}
/agent/{sessions,prompt,events,models,model,permissions,forms,...}   # AI 对话
```

调用示例：

```bash
curl -s --noproxy '*' http://127.0.0.1:18765/status
curl -s --noproxy '*' -H 'X-Hud-Web-User: z30048462' http://127.0.0.1:18765/agent/macro/list
curl -s --noproxy '*' -X POST -H 'Content-Type: application/json' \
     -d '{"note":"manual-release"}' http://127.0.0.1:18765/agent/macro/cancel
```

---

## 18. 排障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| 一直「等待中（n/30）」 | 上一轮僵死（运行中刷新过页面） | 点「■ 停止执行」或调 `/agent/macro/cancel` |
| `lookup 未找到匹配项 … 列表前 12 项=…` | 名称不一致/项目没建成 | 对照 `.api.jsonl` 的 `createPrj.req` 与 `queryPrjLst.res` |
| `占位符未解析：{{s13.…}}` | 引用未执行步骤或路径错 | 确认该步为 `api` 且 `as=s13`，路径与响应结构一致 |
| `API … -> 500 … | req=…` | 后端参数校验缺失（如未知 `hardware_type`） | 按 `req` 校正 payload |
| `retMsg=ERROR` | 业务失败（重名/非法名/缺参） | 看 `errorMsg` |
| COG 球消失 | `hud*.js` 属主/权限不对（ossadm 读不到 → 404） | `chown ossadm:ossgroup` + `chmod 0640` |
| 图标不显示 | 加载了旧文件 | 看 `[hud] build` 行；现版本用 DOMParser 建 SVG 节点 |

---

## 19. 版本标记索引（在 hud.js 内可检索）

```
CLOCK_FREEZE_V1  CORRELATE_ID_V1  REC_LOOKUP_V1  LOOKUP_NAME_SYNC_V1
EXISTING_SITE_V1  ASSERTSITE_V1  ASSERTSITEATTR_V1  ASSERT_LIST_V1
ASSERT_FIELD_V1  LOOKUP_MAX_ID_V1  LOOKUP_NUMERIC_V1  API_BIZ_V2
API_V3  UNRESOLVED_V1  ERR_REQ_V1  REPLACE_SCALAR_V1  POP_HOVER_V1
ICON_DOM_V1
```

---

## 20. 术语

| 术语 | 含义 |
|---|---|
| 宏（macro） | 一串可回放的步骤，含元数据与 `steps[]` |
| 运行（run） | 一次宏执行，产生 `runId` 与逐条记录 |
| 桥（bridge） | `hud_proxy.py`，页面与 broker 之间的同源转发层 |
| broker | 本机 18765 服务，管理宏/运行/队列与 AI 对话 |
| lookup | 按名称查 id 的动作，解决“新建对象 id 未知” |
| 落库断言 | `assertList` / `assertField`，验证数据真的写进数据库 |
| 冻结时钟 | 一次执行内固定的时间戳，保证占位符一致 |
| CAC | 华为域登录（CodeAgentCLI） |
| 本地模式 | `cogagent-local`，免域账号，使用第三方 API key |
