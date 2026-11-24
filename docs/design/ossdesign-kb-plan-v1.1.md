# OSSDesign 业务知识库 —— 开发方案（可直接交付开发）

> 版本：v1.1　｜　适用读者：接手开发的任何 AI Agent / 工程师（无需额外背景）

> **v1.1 变更摘要（采纳外部评审）**
> 1. 新增 **Phase A 竖切验证**（9.2a）：先用 1 周验证"≤2 轮 / ≤20 s / 正确率"，再决定基础设施投入方向。
> 2. 函数卡由"全量 4000–5000 张"改为"**精选子集**（路由可达 ∩ (被高层卡引用 ∪ fan-in≥2 ∪ 有副作用)）约 600–1200 张"；fn 卡默认不参与 `kb_search` 召回（5.8、5.10）。
> 3. 变化感知由 inotify+防抖改为**定时全量扫描**（5.5）；查询时实时 L1/L2 校验保证时效。
> 4. 本地同步由 git bundle + read-tree 改为**变更文件 tar + manifest**（5.4、7.4①）。
> 5. 前端 sourcemap 降级为**可选（S8 后）**；前端知识直接解析本地源码（7.6）。
> 6. SQLite **单写者纪律**（5.2）。
> 7. 性能 SLO 拆分为首 token / 完整回答 / 轮数，含 P95（2.4）。
> 8. 技术细节修正：hash 含装饰器、norm_hash 范围、路由自检、NOT_LIVE 判定改为"重启时内容快照"、jieba 两端一致、默认小向量模型、备份用 Python API、部署原子替换与 chown、Go 生效判定置为 unknown、dirty 构建默认告警不阻断。
> 本文档自包含：环境事实、架构、数据格式、模块规格、Skill/工具定义、开发顺序与验收标准。
> 约定：**MUST** = 必须遵守；**SHOULD** = 强烈建议；**[待确认]** = 开发时需先实测确认的点（附确认命令）。

---

## 目录

- 第 0 章 一句话目标与核心原则
- 第 1 章 环境事实（已实测，开发依据）
- 第 2 章 总体架构
- 第 3 章 目录与配置
- 第 4 章 数据格式规范（卡片 / 清单 / 知识包 / 报告 / DB Schema）
- 第 5 章 服务器端模块规格（kbcore / 守护进程 / Worker）
- 第 6 章 cogagent 集成（MCP 工具 / 插件 / 系统提示）
- 第 7 章 本地端（kb-factory 仓库 / Skills / 部署脚本）
- 第 8 章 k8s_simu 接入
- 第 9 章 开发顺序、流程与验收
- 第 10 章 评测、运维、安全、风险
- 附录 A 实测命令清单　附录 B 提示词模板　附录 C 术语

---

## 第 0 章 一句话目标与核心原则

### 0.1 目标
在开发环境 Linux 服务器上，为自研 Agent **cogagent**（基于 OpenCode 改造）构建 **OSSDesignService（Python 后端 + Web 前端）** 与 **k8s_simu** 的业务知识库，使用户询问"某业务流程的后台逻辑""某计算过程的算法"时，**1–2 轮工具调用、20 秒内**给出带源码出处的正确答案。

### 0.2 约束（决定一切设计）
| 约束 | 数值/事实 |
|---|---|
| 服务器模型生成速度 | 30–40 token/s；并发时单会话不降速（→ 离线可大规模并发） |
| 服务器代码 | Python 源码齐全，**会被直接在服务器上修改且不提交 Git**；前端只有 webpack 压缩产物 |
| 本地 | 有 OSSDesign 完整源码（py + 前端，同一 Git 仓库）；k8s_simu 为**独立仓库**；使用商用 Agent（Claude Code / OpenCode），按 token 计费 |
| 网络 | **本地 → 服务器可 ssh/scp；服务器不能主动连本地** |
| 部署脚本 | 当前**没有**，需新建 |

### 0.3 核心原则（MUST）
1. **理解前置，在线只检索**：代码理解全部离线完成为"知识卡片"；在线回答只做检索 + 组织，禁止让 cogagent 现场大规模 grep/读文件。
2. **轮数与输出 token 是唯一性能指标**：工具粗粒度、返回预压缩、状态内嵌，一轮拿够信息。
3. **服务器文件为真相**：Python 以服务器磁盘为准；前端以"本地 Git commit + 构建清单"为准，并用产物 hash 与服务器核对。
4. **每张卡片可溯源、可校验**：带源码锚点 + 内容 hash；一致性检测实时标注 `fresh/stale/...`。
5. **本地贵而精、服务器慢而多**：商用模型只做高价值卡片（流程/算法/术语/审核）；服务器自研模型并发做海量函数卡。
6. **同一份 hash 实现**：本地与服务器使用同一 `kbcore`、同一 Python 版本（3.12）计算 AST hash。
7. **全部只读**：知识库所有组件对业务目录、数据库只读；不修改平台 Python 环境。

---

## 第 1 章 环境事实（已实测，开发依据）

### 1.1 服务器基础
| 项 | 值 |
|---|---|
| OS / 架构 | EulerOS 系，**ARM64 (aarch64)** |
| 主机 IP | 10.44.228.181（业务端口均绑定此 IP） |
| 平台 | 华为 OSS 管理平台，组件位于 `/opt/cloud/envs/Product-<Name>/<Version>/`，进程以 `-DNFW=<实例名>` 标识 |
| 平台 Python | `/opt/cloud/rtsp/python-27.19.355-euler_arm64/bin/python` → **Python 3.12.10** |
| 运行用户 | `ossadm:ossgroup` |
| 网关 | 平台 `hiro`（多 pid）对外监听；各服务通过 uds 或端口接入。**无 Nginx** |
| 数据库 | `zengine`（Zenith/GaussDB 系，:32080）；缓存 redis 多实例 |

> **范围声明（MUST）**：`/opt/cloud/envs/` 下除 `Product-OSSDesignService` 外的 23 个 `Product-*`（Weave、AppController、MCFEBService、DBAgent、DeployAgent、NodeAgent…）均为**平台底座，不解析、不建卡**。仅在 OSSDesign 调用它们时记录为"外部接口"。

### 1.2 目标一：OSSDesignService 后端（Python）
| 项 | 值 |
|---|---|
| 稳定路径（软链） | `/opt/cloud/manager/apps/OSSDesignService` → `/opt/cloud/envs/Product-OSSDesignService/272.010.156`（**配置一律用软链路径**，版本目录会变） |
| 代码根 | `$APP/pyscript/`，1153 个 `.py`，约 11.5 万行 |
| 进程 1 | `python $APP/pyscript/ossdiyservice.py -DNFW=ossdesignservice-0-0`（主服务，Tornado） |
| 进程 2 | `python $APP/pyscript/ossdesign_container/start_ossdiy_container.py -DNFW=ossdesignservice_container-0-0`（容器方案服务） |
| 监听端口 | `etc/service_config.conf` → `listen_port=33444` |
| Web 框架 | **Tornado**（4.x–6.x 兼容写法）+ 平台封装 `enginering_com_utils.http_util.rest` |
| 路由注册方式 | 装饰器：`@rest.post('/rest/ossdesign/v1/designer/createPrj', use_body=True, use_handler=True)`（见 `ossdesign/interface/designer.py:73`）；方法另有 `rest.get/put/delete`（[待确认]）。 |
| 路由类挂载 | `ossdiyservice.py` 中 `application_map = {"site_project_info": SiteProjectInfo(), ...}`，共 15 个接口类（OssDesigner、SiteProjectInfo、OperateSite、AnalyzeMgr、SiteBasicConfig、SiteNetworkConfig、StorageConfig、SiteExport、SiteImport、ConnectDiagram、DevicePannel、ResourceSummary、IpPlanning、PortHome、StaticFileServer） |
| 容器进程路由 | `/rest/ossdesign/v1/designer/container/*` 在 `ossdesign_container/start_ossdiy_container.py` 中注册（注册写法 [待确认]） |
| 分层 | `ossdesign/interface`（接口）→ `ossdesign/domain/oss_design/*`（领域）→ `ossdesign/infrastructure/*`（基础设施）；另有 `ossdesign_container/{application_container,domain_container}`、`ossdesign_common`、`ossdesign_mapper`、`ossdesign_verification`、`ossdiy`、`toolkit`、`com_utils` |
| 数据库 DDL | **`$APP/bin/create_db_file.sql`，27 张表**（直接入库，无需连库） |
| 出站 REST 配置 | `$APP/etc/conf/restclient.json` |
| 认证 | `$APP/etc/authconf/{auth,jwt}` |
| 外部依赖（已发现） | 平台 REST：`/rest/appcontroller/v2/projects/...`、`/rest/coldbackupmgmtservice/v1/...`、`/rest/nodeagent/v2/csi/appconf`、`/rest/osmu/node/v1/notify`、`/rest/osmu/v1/emergency/internal/...`；zenith DB（`com_utils/db_engine`、`db_helper`）；redis（`toolkit/redis_helper`）；uds（`toolkit/online_sync/infrastructure/uds_client.py`）；WSDL（`ossdiy/service/wsdl`） |
| cogagent 桥 | `ossdesign/interface/hud_proxy.py` 暴露 `/rest/ossdesign/v1/designer/hud/*` → 转发 `http://127.0.0.1:18765`（cogagent broker）。**此文件属于 cogagent 集成，建卡时归类为"基础设施/Agent 桥"，非业务** |
| 人工修改痕迹 | 存在 `ossdiyservice.py.bak.20261124091530` 等 `*.bak.<YYYYMMDDHHMMSS>` 文件 → 现场习惯"备份→替换→重启" |

**核心业务域（建卡优先级依据）**
| 业务域 | 代表代码 | 典型接口 |
|---|---|---|
| 项目/站点管理 | `domain/oss_design/Services/sitemgr.py`(2242 行) | createPrj、deletePrj、createSite、deleteSite、expandSite、createHaSite |
| 硬件配置 | `hardware_config/controller/board_manage_cbb.py` | DevicePannel 相关 |
| 网络配置 / IP 规划 | `network_config/net_config_mgr.py`(2713 行)、IpPlanning | IP 分配、路由 |
| 导入 | `import_data/site/import_mgr/{import_gradslayout,import_new_container}.py` | 导入数据、继承导入 |
| 导出 | `export_data/{lld,cfg_file,layout,swift_deploy}/...` | exportLLD、exportCFGFile、exportEquipmentExcel、exportHardwareInfo、exportGradsLayoutTools、exportCSMFile |
| 连线图 | `Services/Diagram/generater/svg_generater.py`(3097 行) | ConnectDiagram |
| 分析 | AnalyzeMgr | analyzeSpare、analyzeSpareString、checkMigrateSite、checkReplaceDiskSite |
| 校验 | `ossdesign_verification` | 校验规则 |
| 容器方案 | `ossdesign_container/*` | container/importsolution、hardwaremodel、devicelink、export_process |
| 端口归属 | PortHome | delProductPort、downPortHomeFile |

### 1.3 目标二：OSSDesignService 前端
| 项 | 值 |
|---|---|
| 服务器路径 | `$APP/webapps/ossdesignwebsite/osmuwebsite_app/` |
| 形态 | webpack 产物：`app_main.js`、`N.bundle.js`、`*.css`、`lightday.js` 等 9 个 js；**已压缩（单行）、无 sourcemap、文件名无 contenthash** |
| 框架 | 产物中**未检出 Vue/React/Angular 标记** → [待确认：本地查看 `package.json`] |
| 构建 | 本地 `npm run build` |
| 部署方式 | 手工覆盖文件，并保留 `*.bak.<时间>` 备份；静态资源由 Python `StaticFileServer` 提供 → **替换即生效（无需重启）**，但浏览器可能缓存旧文件 |
| 产物中可见 `/rest/` 字面量 | 仅 12 个（接口路径多为拼接）→ **前端 API 调用必须从源码抽取** |

### 1.4 目标三：k8s_simu
| 项 | 值 |
|---|---|
| 服务器路径 | `/usr/k8s_simu/`（`src/`、`cmc_pkgs/`、`tmp/`、依赖 zip、`MAE_V100R027C10_KubeSchedulerSimulator.zip`） |
| 性质 | Kube Scheduler Simulator 定制版；**与 OSSDesign 代码无引用关系，独立系统** |
| 源码 | 服务器上有源码（**非 git 工作区**）；本地有**独立 Git 仓库** |
| 语言构成 | go 84、py 349、ts 35、vue 58、js 3 |
| Web | `src/web`：Nuxt 2.15 + TypeScript + Vuetify + composition-api + `@kubernetes/client-node`；**dev 模式运行**（`nuxt` 进程，:3000，热更新） |
| 依赖集群 | kwok 模拟集群：docker 容器 `simulator-cluster`（:2379 etcd、:3131）+ 宿主 `/root/.kwok/clusters/kwok` |
| Go / Python 部分角色 | [待确认，附录 A-5] |

### 1.5 cogagent
| 项 | 值 |
|---|---|
| 性质 | 基于 **OpenCode** 改造，工具/Skill/MCP/插件机制与 OpenCode 一致 |
| broker | `/opt/cloud/manager/tools/cogagent-hud/broker.py`，监听 `127.0.0.1:18765`，`--root /srv/cogagent/users --state-dir /var/lib/cogagent-hud` |
| 相关文件 | `hud_register.py`、`macro_store.py`、`profiles/`、`recover.sh` |
| 进程 | `cogagent`（127.0.0.1:50461） |
| 扩展方式（OpenCode 机制） | ① **MCP Server**（推荐，本方案采用）；② `.opencode/tools/*.ts` 自定义工具；③ Plugin 钩子；④ Skills（`.opencode/skills` / `.claude/skills`）；⑤ AGENTS.md 规则 |

---

## 第 2 章 总体架构

### 2.1 全景图
```
┌──────────────────────── 本地（Windows/Mac，商用 Agent） ────────────────────────┐
│  repo: ossdesign (py+web, Git)      repo: k8s_simu (Git)                         │
│  repo: kb-factory  ← 本方案新建                                                    │
│   ├─ kbcore/            同一份核心库（与服务器共享）                                │
│   ├─ scripts/           extract / build-manifest / pack / sync / deploy           │
│   ├─ cards/             卡片源（Markdown，Git 管理）                               │
│   └─ .claude/skills/    kb-* Skills（Claude Code 与 OpenCode 通用）               │
│                                                                                   │
│  deploy_web.py：npm build → 清单 → 备份/替换前端 → 推知识包 → 拉报告               │
└───────────────┬──────────────────────────────────────────────▲────────────────────┘
          ssh/scp 推 ↓  inbox/                           outbox/ ↑ ssh/scp 拉
┌───────────────▼──────────────────────────────────────────────┴────────────────────┐
│ 服务器  /opt/cloud/manager/tools/cogagent-kb/                                        │
│  kbd（常驻守护进程, 127.0.0.1:18790）                                                │
│   ├─ scanner：py / k8s_simu 定时扫描(10min)+查询时校验 → 影子快照 → 函数级 AST 检测    │
│   ├─ drift：一致性检测（py / 前端 bundle / 卡片事实）+ 生效检测                        │
│   ├─ importer：知识包导入 → SQLite(FTS5) + 向量索引                                   │
│   ├─ worker：调用自研模型并发生成/增量更新函数卡                                       │
│   └─ search API：混合检索 + 状态内嵌                                                 │
│  kb-mcp（stdio MCP Server）→ 调 kbd HTTP API → 提供 kb_* 工具给 cogagent              │
│  cogagent（OpenCode）：AGENTS.md 规则 + MCP 工具 + 预检索插件                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 职责划分（MUST 遵守）
| 工作 | 在哪 | 由谁 | 理由 |
|---|---|---|---|
| Python 结构抽取（符号/调用图/路由/外部接口） | 服务器（主）+ 本地（快照副本） | 脚本 | 服务器代码最新；确定性 |
| 前端结构抽取（页面→API） | 本地 | 脚本 + 商用 Agent | 服务器无源码 |
| 前后端 API 对齐 | 本地 | 脚本 | 需两侧源码 |
| Python 函数卡 | 服务器 | 自研模型并发 | 量大、不计费、需实时 |
| 流程卡 / 算法卡 / 规则卡 / 术语表 | 本地 | 商用 Agent（Skill） | 质量要求高、跨前后端 |
| 一致性检测、生效检测 | 服务器 | 守护进程 | 高频、确定性、零 token |
| 检索与回答 | 服务器 | cogagent + MCP 工具 | 在线链路 |
| 服务器生成卡片的抽检 | 本地 | 商用 Agent | 小成本保质量 |

### 2.3 数据流
1. **服务器 py 变更**：scanner 定时扫描（或查询时实时校验）→ 影子快照 commit → AST diff → 卡片标 stale → worker 增量重写函数卡 → 涉及的流程/算法卡标 `stale` 并写入 outbox 报告。
2. **本地生产**：`kb-sync pull` 拉 outbox（py 快照 + 报告）→ 写入本地 `server-snapshot` 分支 → Skill 生成/更新高价值卡片 → `kb-release` 打包 → `kb-sync push` 到 inbox → importer 导入。
3. **前端发布**：`deploy_web.py` 一条命令完成 构建→清单→备份替换→推包→拉报告。
4. **在线问答**：cogagent 收到问题 → 插件预检索注入 top-k 卡片 → 模型必要时并行调用 `kb_*` 工具（结果自带 status/diff）→ 回答（含出处与版本声明）。

### 2.4 性能目标
| 指标 | 目标 |
|---|---|
| 工具调用轮数 | ≤ 2（P90） |
| 首 token 时间 | ≤ 6 s（P50）、≤ 10 s（P95） |
| 完整回答耗时 | ≤ 20 s（P50）、≤ 35 s（P95） |
| 检索 recall@5（评测集） | ≥ 85% |
| 答案正确率（评测集） | ≥ 85%（Phase A 门槛 ≥ 80%） |
| py 改动 → 结构数据/状态更新 | ≤ 10 min（定时扫描）；**查询时实时校验**，命中卡片的状态 0 延迟 |
| py 改动 → 函数卡更新 | ≤ 20 min |
| `kb_search` 延迟 | ≤ 300 ms（不含模型） |

> 估算依据：35 tok/s 生成、预填 3–5k token（prefill 速度 [待确认，附录 A-6 测量]）；400 token 回答约 11–12 s。P95 超时主要来自需要 2 轮工具的问题，因此首 token 与完整回答分别考核。

---

## 第 3 章 目录与配置

### 3.1 服务器目录（新建，属主 `ossadm:ossgroup`）
```
/opt/cloud/manager/tools/cogagent-kb/
├─ bin/
│   ├─ kbd                     # 守护进程入口（python -m kbcore.daemon）
│   ├─ kb                      # CLI（scan / status / import / rebuild / report）
│   └─ kb-mcp                  # MCP stdio server 入口
├─ kbcore/                     # 核心库（与本地同源，版本号见 kbcore/__init__.py）
├─ venv/                       # 独立虚拟环境（基于平台 python3.12 创建，--system-site-packages 关闭）
├─ models/                     # 嵌入/重排模型权重（默认 bge-small-zh-v1.5；可选 bge-m3、bge-reranker-v2-m3）
├─ config.yaml
├─ data/
│   ├─ kb.sqlite               # 主库（清单/符号/卡片/锚点/FTS5/向量）
│   └─ kb.sqlite.bak.<date>    # 每日备份
├─ shadow/
│   ├─ ossdesign_py.git        # bare 影子仓库（work-tree = pyscript）
│   └─ k8s_simu.git            # bare 影子仓库（work-tree = /usr/k8s_simu/src）
├─ inbox/                      # 本地推送的知识包 *.kbpack.tar.gz（+ .sha256）
│   └─ archive/                # 已导入包
├─ outbox/                     # 供本地拉取：报告、变更文件快照 tar + manifest
├─ cache/                      # 美化后的旧 bundle、diff 缓存
└─ logs/
```

### 3.2 服务器 `config.yaml`（完整模板）
```yaml
kb_version: 1
env: dev
python_hash_tag: py312            # AST hash 前缀；与本地必须一致

server:
  listen: 127.0.0.1:18790
  db: /opt/cloud/manager/tools/cogagent-kb/data/kb.sqlite

llm:                              # 服务器自研模型（OpenAI 兼容接口）
  base_url: http://127.0.0.1:<PORT>/v1   # [待确认] cogagent 使用的模型服务地址
  model: <MODEL_NAME>
  api_key_env: KB_LLM_KEY
  concurrency: 16                 # 函数卡并发
  max_output_tokens: 400
  disable_thinking: true

embedding:
  backend: local                  # local | api
  model_path: models/bge-small-zh-v1.5   # 默认（~100MB）；实测资源充足再换 bge-m3（dim 1024）
  dim: 512
reranker:
  enabled: false                  # 默认关闭；实测延迟可接受（≤150ms/30条）再开启
  model_path: models/bge-reranker-v2-m3
  top_n: 30

targets:
  ossdesign_py:
    kind: python
    root: /opt/cloud/manager/apps/OSSDesignService/pyscript
    processes:                    # 用 -DNFW 实例名匹配
      - ossdesignservice-0-0
      - ossdesignservice_container-0-0
    process_roots:                # 进程 → 其负责的代码子树（用于生效判定）
      ossdesignservice-0-0: ["."]
      ossdesignservice_container-0-0: ["ossdesign_container", "ossdesign_common", "com_utils", "toolkit"]
    include: ["**/*.py"]
    exclude: ["**/*.bak.*", "**/__pycache__/**", "**/*.pyc"]
    scan_interval_seconds: 600
  ossdesign_web:
    kind: bundle
    root: /opt/cloud/manager/apps/OSSDesignService/webapps/ossdesignwebsite/osmuwebsite_app
    include: ["*.js", "*.css", "*.html"]
    exclude: ["*.bak.*"]
    live_on_replace: true         # 静态资源替换即生效
  k8s_simu:
    kind: source_multi
    root: /usr/k8s_simu/src
    langs: [python, typescript, vue, go]
    exclude: ["**/node_modules/**", "**/.nuxt/**", "**/dist/**", "**/vendor/**", "**/*.bak.*"]
    live_mode: hot_reload         # nuxt dev：保存即生效；Go 部分 live=unknown
    scan_interval_seconds: 600

extra_sources:
  ddl: /opt/cloud/manager/apps/OSSDesignService/bin/create_db_file.sql
  service_conf: /opt/cloud/manager/apps/OSSDesignService/etc/service_config.conf
  restclient: /opt/cloud/manager/apps/OSSDesignService/etc/conf/restclient.json
  platform_routes_glob: /opt/cloud/envs/Product-*/*/build/pathHandler.js   # 仅生成平台接口对照表

security:
  never_store_values_of: ["**/authconf/**", "**/ssl/**", "**/*.key", "**/*.pem", "**/cipher*"]
  redact_patterns: ["(?i)password\\s*[=:]\\s*\\S+", "(?i)secret\\s*[=:]\\s*\\S+", "(?i)token\\s*[=:]\\s*\\S+"]

paths:
  shadow: /opt/cloud/manager/tools/cogagent-kb/shadow
  inbox: /opt/cloud/manager/tools/cogagent-kb/inbox
  outbox: /opt/cloud/manager/tools/cogagent-kb/outbox
```

### 3.3 本地仓库 `kb-factory`（新建，独立 Git 仓库）
```
kb-factory/
├─ AGENTS.md                    # 主说明（OpenCode 读取）
├─ CLAUDE.md                    # 仅一行：@AGENTS.md（Claude Code 读取）
├─ kb.local.yaml                # 本地配置（见 3.4）
├─ pyproject.toml               # requires-python = "==3.12.*"；uv 管理
├─ .python-version              # 3.12
├─ kbcore/                      # 与服务器同一份（服务器从知识包中更新）
├─ scripts/
│   ├─ kb_sync.py               # pull / push
│   ├─ kb_extract.py            # 结构抽取（py / web / k8s_simu）
│   ├─ kb_build_manifest.py     # 前端构建清单 + sourcemap 处理
│   ├─ kb_align_api.py          # 前端调用 ↔ 后端路由 对齐
│   ├─ kb_queue.py              # 卡片任务队列（next / done / status）
│   ├─ kb_card_lint.py          # 卡片格式/锚点/引用校验
│   ├─ kb_pack.py               # 打包知识包
│   └─ deploy_web.py            # 前端一键部署（含知识同步）
├─ cards/
│   ├─ ossdesign/{flow,algorithm,rule,api,page,glossary,external,module}/*.md
│   └─ k8s_simu/{flow,algorithm,api,page,glossary,module}/*.md
├─ state/
│   ├─ queue.sqlite             # 待生成/待更新卡片队列（可断点续做）
│   ├─ structure/               # 抽取产物（json），不入 Git 或用 LFS
│   └─ reports/                 # 从服务器拉回的报告
├─ build/                       # 构建清单、sourcemap、待推送的知识包
├─ .claude/skills/kb-*/SKILL.md # Skills（两种 Agent 通用）
├─ .claude/commands/*.md        # 可选：Claude Code 快捷命令（只写"加载 skill X"）
└─ .opencode/commands/*.md      # 可选：OpenCode 快捷命令（同上）
```

### 3.4 本地 `kb.local.yaml`
```yaml
python_hash_tag: py312
server:
  ssh: ossadm@10.44.228.181          # [待确认] 实际可登录账号；建议用 ossadm 而非 root
  ssh_key: ~/.ssh/id_ed25519
  kb_root: /opt/cloud/manager/tools/cogagent-kb
repos:
  ossdesign:
    path: D:/code/ossdesign           # [待填写]
    py_subdir: <仓库内 pyscript 对应目录>   # [待填写] 与服务器 pyscript 对应
    web_subdir: <前端工程目录>              # [待填写] 含 package.json
    web_build_cmd: npm run build
    web_dist_dir: <构建输出目录>            # [待填写]
    snapshot_branch: server-snapshot
  k8s_simu:
    path: D:/code/k8s_simu            # [待填写]
    server_src: /usr/k8s_simu/src
    snapshot_branch: server-snapshot
deploy:
  web_server_dir: /opt/cloud/manager/apps/OSSDesignService/webapps/ossdesignwebsite/osmuwebsite_app
  keep_bak: 5                          # 服务器保留最近 N 份 .bak
```

---

## 第 4 章 数据格式规范

> 本章是**本地与服务器之间的契约**。任何一端修改格式必须同步升级 `schema_version`。

### 4.1 标识符规则（MUST）
| 对象 | ID 格式 | 示例 |
|---|---|---|
| 目标 | `target` | `ossdesign_py`、`ossdesign_web`、`k8s_simu` |
| 符号 | `<target>:<相对路径>::<限定名>` | `ossdesign_py:ossdesign/interface/designer.py::SiteProjectInfo.create_prj` |
| 路由 | `route:<METHOD>:<path>` | `route:POST:/rest/ossdesign/v1/designer/createPrj` |
| 表 | `table:<表名小写>` | `table:t_site_info` |
| 外部接口 | `ext:<METHOD>:<path>` | `ext:GET:/rest/appcontroller/v2/projects/{product_name}` |
| 卡片 | `<type>.<target>.<slug>` | `flow.ossdesign.create_site`、`alg.ossdesign.spare_analysis`、`fn.ossdesign_py.<sha1(symbol)[:12]>` |

- **禁止用行号作为标识**；行号仅作为展示字段。
- 嵌套函数限定名用 `外层.<locals>.内层`；同名重载（重复定义）追加 `#2`。

### 4.2 AST hash 规范（MUST，本地/服务器一致）
**Python（标准库 `ast`，Python 3.12）**
1. `ast.parse(source, type_comments=False)`；解析失败 → 状态 `BROKEN`。
2. 针对每个 `FunctionDef/AsyncFunctionDef/ClassDef`（类只取类体中非函数语句作为"类头"）：
   - 删除函数/类体首个字符串表达式（docstring）；
   - `ast.dump(node, annotate_fields=True, include_attributes=False)`；
   - `ast_hash = "py312:" + sha256(dump)[:16]`。
   - **dump 包含 `decorator_list`**：路由路径、HTTP 方法、`use_body` 等装饰器参数变化会改变 hash（预期行为——接口契约变化必须触发 MODIFIED）。
   - **函数 hash 包含其嵌套函数/嵌套类的完整体**（嵌套函数同时作为独立符号再算一次自身 hash）。
3. `norm_hash`：在 2 的基础上，仅把**本函数作用域内的参数名与局部变量名**（`ast.arg.arg`、在本函数内被赋值的 `ast.Name(ctx=Store)` 及其后续 Load）按首次出现顺序重命名为 `v0,v1…` 后再 hash。**不重命名**：嵌套函数名、嵌套类名、全局/模块名、属性名（`obj.attr`）、`global/nonlocal` 声明的名字、关键字参数名（`f(x=1)` 中的 `x`）。否则会把实质改动误判为 RENAMED_VARS。
4. 模块级 hash：模块顶层非 def/class 语句（常量、import、全局配置）合成一个伪符号 `<module>`。
5. 文件 hash：`sha256(原始字节)`。

**TS/JS/Vue（tree-sitter，用于 k8s_simu 与本地前端）**
- Vue SFC 先抽 `<script>` 块；遍历语法树输出 `(node.type, 标识符文本/字面量文本)` 序列，跳过 `comment` 节点，sha256 取前 16 位，前缀 `ts1:`。
- Go：tree-sitter-go，前缀 `go1:`，规则同上。

### 4.3 卡片格式（Markdown + YAML frontmatter）
```markdown
---
schema_version: 1
id: alg.ossdesign.spare_analysis
type: algorithm            # fn | api | flow | algorithm | rule | page | module | glossary | external | qa | change
target: ossdesign_py       # 主目标；跨目标卡片写主目标，其余写在 anchors
title: 备件分析（analyzeSpare）计算逻辑
domain: analyze            # 业务域：project_site|hardware|network|import|export|diagram|analyze|verify|container|port_home|k8s_simu|infra
summary: >                 # 1–3 句，检索与预注入使用，≤120 字
  根据站点设备清单按 ... 计算备件数量，向上取整，最小为 1。
keywords: [备件, spare, analyzeSpare, 备件率]
anchors:                   # 卡片依据的代码（用于一致性检测）
  - symbol: ossdesign_py:ossdesign/domain/.../spare.py::SpareAnalyzer.calc
    kind: direct           # direct | transitive
    ast_hash: py312:9f2c1a0b7d3e4411
    lines: [120, 188]      # 仅展示
  - route: route:POST:/rest/ossdesign/v1/designer/analyzeSpare
claims:                    # 可机械核对的事实
  - {kind: constant, symbol: "...::SPARE_RATE", value: "0.05"}
  - {kind: table, value: "t_spare_info"}
  - {kind: config, file: "etc/service_config.conf", key: "listen_port", value_hash: "sha256:..."}
source_version:
  ossdesign_py: shadow:3f9a2c1        # 影子仓库 commit
  ossdesign_web: git:8d1e0aa          # 前端卡片：本地 Git commit
producer: local-commercial            # local-commercial | server-self
model: <模型名>
confidence: high                      # high | medium | low
generated_at: 2026-11-24T10:30:00+08:00
related: [flow.ossdesign.export_lld, api.ossdesign.analyze_spare]
questions:                            # 预生成问句（用于 Q→Q 检索）
  - 备件数量是怎么算的？
  - analyzeSpare 的备件率从哪里来？
---

## 结论
（一句话回答"它做什么/怎么算"）

## 详细
（按卡片类型使用 4.4 的固定小节）

## 出处
- `ossdesign/domain/.../spare.py:120-188` `SpareAnalyzer.calc`
```

**写作规范（MUST）**
- 正文 ≤ 800 字（flow/algorithm 可到 1500 字）；函数卡 ≤ 200 字。
- 只写**代码能证实**的内容；推测必须写"推测："并降 `confidence`。
- 业务名词首次出现时写 `中文名（代码标识符 / 表.字段）`。
- 禁止粘贴大段源码；需要时引用 `文件:行`。

### 4.4 各类型卡片的固定小节
| type | 必备小节 | 生成方 |
|---|---|---|
| `fn` 函数卡 | 功能、输入、输出、副作用（读写表/redis/外部接口/文件）、异常分支、被谁调用（≤5） | 服务器 |
| `api` 接口卡 | 路由/方法、处理函数、参数（来源：body/query/path）、返回、权限、调用的领域服务、前端调用页面 | 脚本骨架 + 服务器模型补全 |
| `flow` 流程卡 | 触发入口（页面/按钮/接口/定时）、步骤（编号，每步注明函数）、状态变化、涉及表、外部接口、异常与补偿、时序图（mermaid sequence，可选） | 本地 |
| `algorithm` 算法卡 | 用途、输入变量表（变量↔代码↔表字段↔单位）、公式/伪代码、**舍入与精度**、边界条件、配置参数来源、**算例（由实际运行代码得到）**、前后端差异 | 本地 |
| `rule` 规则卡 | 规则清单表（编号、条件、阈值、报错码/文案、代码位置） | 本地 |
| `page` 页面卡 | 页面/组件、入口路由、用户操作 → 调用 API、前端校验/计算、展示字段映射 | 本地 |
| `module` 模块卡 | 职责、对外接口、核心类、依赖、子模块 | 本地或服务器 |
| `glossary` 术语表 | 表格：业务名、代码标识符、表.字段、前端文案、含义、**歧义说明** | 本地 |
| `external` 外部接口卡 | 外部系统、路径、方法、调用方函数、用途、失败处理 | 脚本 + 服务器模型 |
| `qa` 问答卡 | 问题、答案、依据卡片、确认人/时间 | cogagent 回流 |
| `change` 变更说明卡 | 相对基线（Git main）的行为差异、涉及卡片 | 服务器（diff）/本地 |

### 4.5 结构抽取产物（`structure.json`，本地与服务器同格式）
```json
{
  "schema_version": 1,
  "target": "ossdesign_py",
  "source_version": "shadow:3f9a2c1",
  "generated_at": "...",
  "symbols": [
    {"id": "...::SiteProjectInfo.create_prj", "kind": "method", "file": "ossdesign/interface/designer.py",
     "lines": [73, 110], "ast_hash": "py312:...", "norm_hash": "py312:...", "loc": 38,
     "decorators": ["rest.post"], "doc": "首行 docstring（可空）"}
  ],
  "calls":   [{"from": "<symbol_id>", "to": "<symbol_id>|unresolved:<name>", "line": 88}],
  "routes":  [{"id": "route:POST:/rest/ossdesign/v1/designer/createPrj", "handler": "<symbol_id>",
              "process": "ossdesignservice-0-0", "opts": {"use_body": true, "use_handler": true}}],
  "db_access": [{"symbol": "<symbol_id>", "table": "t_xxx", "op": "select|insert|update|delete|unknown", "evidence": "sql|orm|mapper"}],
  "externals": [{"symbol": "<symbol_id>", "id": "ext:GET:/rest/appcontroller/v2/projects/{product_name}", "via": "restclient|http_request|uds|redis"}],
  "redis_keys": [{"symbol": "<symbol_id>", "key_pattern": "ossdesign:lock:{site}", "op": "get|set|lock"}],
  "constants": [{"symbol": "<module>@path", "name": "SPARE_RATE", "value": "0.05"}]
}
```
前端（本地）额外产物 `web_calls.json`：
```json
[{"page": "src/views/site/CreateSite.vue", "component": "CreateSite", "action": "onSubmit",
  "method": "POST", "path": "/rest/ossdesign/v1/designer/createSite", "path_raw": "`${BASE}/createSite`",
  "line": 132, "resolved": true}]
```
对齐产物 `api_links.json`：`{web_call → route → handler}`，未对齐项列入 `unmatched`。

### 4.6 前端构建清单（`build_manifest.json`，本地生成）
```json
{
  "schema_version": 1,
  "target": "ossdesign_web",
  "build_id": "20261124-103012-8d1e0aa",
  "git": {"commit": "8d1e0aa...", "dirty": false, "dirty_diff_sha256": null, "branch": "main"},
  "built_at": "2026-11-24T10:30:12+08:00",
  "build_cmd": "npm run build",
  "node_version": "v16.x",
  "outputs": [{"file": "app_main.js", "sha256": "...", "size": 1234567}, {"file": "0.bundle.js", "sha256": "..."}],
  "sourcemaps": [],
  "source_files": [{"path": "src/views/site/CreateSite.vue", "sha256": "..."}],
  "deployed_to": "/opt/cloud/manager/apps/OSSDesignService/webapps/ossdesignwebsite/osmuwebsite_app"
}
```
- **dirty 构建 MUST 记录 `git diff` 并打入知识包**，否则卡片无法对应真实产物；`deploy_web.py` 遇到 dirty 构建**默认醒目告警但不阻断**（贴合现场习惯），`--strict` 时阻断。
- `sourcemaps` 字段为**可选**（S8 后启用，见 7.6），v1.1 起默认为空数组。

### 4.7 知识包（`<build_id>.kbpack.tar.gz`）
```
kbpack/
├─ pack.json            # schema_version, pack_id, created_at, kbcore_version, targets, 前一个 pack_id
├─ cards/**.md          # 全量或增量（pack.json.mode = full|delta；delta 含 deleted 列表）
├─ structure/           # web_calls.json, api_links.json, structure_web.json, glossary.json
├─ manifests/           # build_manifest.json（前端）、k8s_simu 源版本
├─ sourcemaps/          # 可选（S8 后）：前端 hidden sourcemap
├─ web_src_snippets/    # 可选：前端源码按函数切片（get_code 使用），json 行格式
├─ kbcore/              # 可选：kbcore 新版本（服务器自升级）
└─ SHA256SUMS
```
导入规则：校验 SHA256SUMS → schema_version 兼容检查 → delta 依赖的前一个 pack 必须已导入（否则拒绝并在 outbox 报告 `NEED_FULL_PACK`）。

### 4.8 一致性报告（服务器 → 本地，`outbox/drift_<ts>.json`）
```json
{
  "schema_version": 1, "generated_at": "...", "env": "dev",
  "summary": {"files_scanned": 1153, "changed": 17, "cosmetic": 9, "stale_cards": 6, "uncovered": 2, "not_live": 1},
  "targets": {
    "ossdesign_py": {
      "shadow_head": "3f9a2c1",
      "items": [
        {"status": "MODIFIED", "symbol": "...::SpareAnalyzer.calc", "old_hash": "...", "new_hash": "...",
         "diff_ref": "diffs/abc.patch", "cards": ["alg.ossdesign.spare_analysis", "fn.ossdesign_py.1a2b..."],
         "need_local": true},
        {"status": "UNCOVERED", "route": "route:POST:/rest/ossdesign/v1/designer/xxx"},
        {"status": "NOT_LIVE", "file": "ossdesign/...py", "mtime": "...", "process": "ossdesignservice-0-0", "proc_start": "..."}
      ]
    },
    "ossdesign_web": {"status": "JS_NEW_BUILD_NO_PACK", "current_hashes": {"app_main.js": "..."},
                      "suspect_sources": [{"file": "src/...", "func": "..."}]},
    "k8s_simu": {"items": []}
  },
  "claims": [{"card": "alg...", "claim": {"kind": "constant", "name": "SPARE_RATE"}, "expected": "0.05", "actual": "0.06"}]
}
```
`need_local=true` 表示涉及本地负责的卡片类型（flow/algorithm/rule/page/glossary）。

### 4.9 状态枚举（全系统统一）
| 状态 | 含义 | 卡片可用性 |
|---|---|---|
| `FRESH` | 锚点 hash 全部一致 | 直接使用 |
| `COSMETIC` | 仅格式/注释变化 | 直接使用（自动刷新锚点） |
| `MOVED` | 代码移动/改名但 AST 相同 | 直接使用（自动刷新锚点） |
| `RENAMED_VARS` | 仅局部变量改名 | 直接使用 |
| `MODIFIED` | 直接锚点逻辑变化 | 旧卡 + diff 回答，排队更新 |
| `TRANSITIVE` | 下游依赖变化 | 可用，提示"可能过时" |
| `DELETED` | 锚点符号消失 | 不可用 |
| `BROKEN` | 文件语法错误 | 用旧卡，提示 |
| `CLAIM_DRIFT` | 常量/配置/表结构与卡片事实不符 | 旧卡 + 实际值回答 |
| `UNCOVERED` | 新入口无卡片 | — |
| `NOT_LIVE` | 磁盘已改，进程未重启 | 回答需声明"运行中仍为旧逻辑" |
| `JS_OK` / `JS_NEW_BUILD_NO_PACK` / `JS_TAMPERED` | 前端产物与知识包一致 / 新产物无对应包 / 产物 hash 不在任何清单中 | 前端卡片可用 / 提示过时 / 提示人工改动 |

### 4.10 SQLite Schema（服务器 `kb.sqlite`）
```sql
PRAGMA journal_mode=WAL;

CREATE TABLE files(
  target TEXT, path TEXT, size INT, mtime REAL, sha256 TEXT, parse_ok INT,
  shadow_commit TEXT, PRIMARY KEY(target, path));

CREATE TABLE symbols(
  id TEXT PRIMARY KEY, target TEXT, path TEXT, qualname TEXT, kind TEXT,
  line_start INT, line_end INT, loc INT, ast_hash TEXT, norm_hash TEXT,
  source_text TEXT,                -- 当前版本源码（用于 diff 与 get_code）
  card_source_hash TEXT,           -- 生成函数卡时的 ast_hash
  updated_at REAL);
CREATE INDEX idx_sym_path ON symbols(target, path);
CREATE INDEX idx_sym_hash ON symbols(ast_hash);

CREATE TABLE symbol_history(       -- 旧版本源码，按 hash 去重
  ast_hash TEXT PRIMARY KEY, source_text TEXT, first_seen REAL);

CREATE TABLE edges(                -- 统一图：call / route / db / ext / redis / web_call / contains
  src TEXT, dst TEXT, kind TEXT, attrs TEXT, PRIMARY KEY(src, dst, kind));
CREATE INDEX idx_edges_dst ON edges(dst, kind);

CREATE TABLE routes(id TEXT PRIMARY KEY, method TEXT, path TEXT, handler TEXT, process TEXT, opts TEXT);
CREATE TABLE tables_ddl(name TEXT PRIMARY KEY, ddl TEXT, columns TEXT /*json*/, comment TEXT);
CREATE TABLE platform_routes(path TEXT, method TEXT, service TEXT, handler TEXT, PRIMARY KEY(path, method));

CREATE TABLE cards(
  id TEXT PRIMARY KEY, type TEXT, target TEXT, domain TEXT, title TEXT, summary TEXT,
  body TEXT, keywords TEXT, questions TEXT, frontmatter TEXT /*json*/,
  producer TEXT, confidence TEXT, pack_id TEXT, status TEXT, status_detail TEXT,
  generated_at TEXT, updated_at REAL);

CREATE TABLE card_anchors(
  card_id TEXT, ref TEXT /*symbol id / route id / table id*/, kind TEXT /*direct|transitive*/,
  ast_hash TEXT, PRIMARY KEY(card_id, ref));
CREATE INDEX idx_anchor_ref ON card_anchors(ref);

CREATE TABLE card_claims(card_id TEXT, kind TEXT, ref TEXT, expected TEXT, actual TEXT, ok INT);

CREATE VIRTUAL TABLE cards_fts USING fts5(
  id UNINDEXED, title, summary, body, keywords, questions, idents,
  tokenize='unicode61');            -- 中文先经 jieba 分词后以空格拼接写入；idents = 代码标识符拆分结果

CREATE TABLE card_vectors(card_id TEXT, chunk INT, vec BLOB, PRIMARY KEY(card_id, chunk));
-- 若可装 sqlite-vec，则改为 vec0 虚表；否则用 numpy 内存矩阵（规模 <1 万，暴力检索足够）

CREATE TABLE web_bundles(file TEXT PRIMARY KEY, sha256 TEXT, mtime REAL, build_id TEXT, status TEXT);
CREATE TABLE manifests(build_id TEXT PRIMARY KEY, target TEXT, json TEXT, imported_at REAL);
CREATE TABLE packs(pack_id TEXT PRIMARY KEY, mode TEXT, prev TEXT, imported_at REAL, ok INT, msg TEXT);

CREATE TABLE processes(name TEXT PRIMARY KEY, pid INT, start_time REAL, cmdline TEXT, seen_at REAL);
CREATE TABLE live_hashes(process TEXT, path TEXT, sha256 TEXT, baseline TEXT /*proc_start|shadow:<commit>|unknown_before_kb*/,
  PRIMARY KEY(process, path));
CREATE TABLE manual_edits(target TEXT, path TEXT, bak_file TEXT, ts REAL);   -- 来自 *.bak.<ts>

CREATE TABLE jobs(id INTEGER PRIMARY KEY, kind TEXT, ref TEXT, priority INT, status TEXT,
  attempts INT DEFAULT 0, payload TEXT, created REAL, updated REAL);
CREATE TABLE qa_cache(q_norm TEXT PRIMARY KEY, answer TEXT, card_ids TEXT, ok_votes INT, created REAL);
CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT);
```

---

## 第 5 章 服务器端模块规格

### 5.1 运行环境
- **venv**：`/opt/cloud/rtsp/python-27.19.355-euler_arm64/bin/python -m venv /opt/cloud/manager/tools/cogagent-kb/venv`
  - 若平台 Python 缺 `venv`/`ensurepip`：改用 `uv`（aarch64 静态二进制）安装独立 CPython 3.12，**但 AST hash 必须仍为 3.12.x**。
- **依赖分级**（检测核心只用标准库，可在无 venv 时降级运行）：
| 层 | 依赖 | 用途 |
|---|---|---|
| L0（标准库） | `ast, hashlib, sqlite3, json, subprocess, http.server, threading` | 扫描、hash、检测、HTTP API |
| L1 | `jieba`, `pyyaml` | 中文分词、配置 |
| L2 | `tree-sitter`, `tree-sitter-typescript`, `tree-sitter-javascript`, `tree-sitter-go` | k8s_simu 解析（均有 aarch64 wheel） |
| L3 | `onnxruntime` + `tokenizers` + `numpy`（或 `sentence-transformers`/`FlagEmbedding`） | 向量与重排（CPU） |
| L4 | `mcp`（官方 Python SDK） | MCP server |
| 外部 | `git`（系统已有则用；否则用 `dulwich` 纯 Python 实现） | 影子仓库 |
- **离线安装**：服务器若无外网，在同架构机器 `pip download --platform manylinux2014_aarch64 --python-version 3.12 --only-binary=:all: -r requirements.txt -d wheels/`，随知识包或 scp 传入。[待确认服务器是否可访问 pip 源]
- **模型权重**：默认 `bge-small-zh-v1.5`（约 100MB），重排默认关闭。bge-m3（约 2.2GB）在 ARM CPU 上的单条查询耗时**必须实测**（S7 用 50 条查询测 P50/P95），满足 ≤ 300 ms 总检索预算才切换。[待确认服务器内存与核数：`nproc; free -g`]

### 5.2 进程模型
- `kbd`：单进程多线程常驻服务，systemd 托管（若无 systemd 权限，用 `nohup` + cron 保活脚本，参考 cogagent-hud 的 `recover.sh` 方式）。
  - 线程：`scanner`（定时）、`worker×N`（异步 HTTP 调模型）、`importer`、`http_api`、`proc_monitor`、**`db_writer`（唯一写者）**。
- **SQLite 并发纪律（MUST）**：
  - 连接参数：`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;`。
  - **只有 `db_writer` 线程持有写连接**；其他线程（scanner/worker/importer/proc_monitor）只产出"写请求对象"（如 `UpsertCard(card_json)`、`SetStatus(...)`），放入 `queue.Queue`，由 `db_writer` 批量（≤200 条或 ≤500 ms）在一个 `BEGIN IMMEDIATE` 事务中提交。
  - 读操作各线程独立只读连接（`file:kb.sqlite?mode=ro`, `uri=True`），WAL 下不阻塞。
  - 需要"写后读一致"的流程（如导入后立即 drift）使用 writer 返回的 `Future` 等待完成。
  - CLI `kb` 的写命令（import/rebuild）通过 HTTP 调 `kbd` 执行，**不直接写库**；`kbd` 未运行时 CLI 才可直接写（启动时加文件锁 `data/kb.lock` 防止并存）。
  - 向量矩阵在内存中维护，写入由 `db_writer` 落库后发事件通知检索线程增量更新。
- `kb-mcp`：由 cogagent 以 stdio 方式拉起，**无状态**，所有请求转发到 `kbd` 的 HTTP API（127.0.0.1:18790）。这样 MCP 进程随会话启停不影响索引常驻。
- 资源限制：`worker` 并发与 `llm.concurrency` 一致；`nice -n 10`；嵌入计算单独线程池（≤ nproc/2）。

### 5.3 模块：`kbcore.pyast`（Python 结构抽取）
**输入**：文件路径 + 源码；**输出**：4.5 中的 symbols/calls/routes/db_access/externals/redis_keys/constants。

实现要点：
1. **符号**：遍历 AST，维护类/函数栈生成限定名；记录装饰器的源码文本（`ast.unparse(dec)`）。
2. **路由抽取（OSSDesign 专用规则）**：
   - 主进程：装饰器匹配 `rest.(get|post|put|delete|patch)\((?P<path>'[^']+'|"[^"]+")(, *(?P<opts>.*))?\)`，handler = 被装饰的方法；process = `ossdesignservice-0-0`。
   - 接口类通过 `ossdiyservice.py` 的 `application_map` 挂载：解析该字典，记录 `app_key → 类`，写入路由 `opts.app_key`。
   - 容器进程：解析 `ossdesign_container/start_ossdiy_container.py` 中 `/rest/ossdesign/v1/designer/container/` 的注册方式 [待确认，附录 A-1]；按实测写法补规则，process = `ossdesignservice_container-0-0`。
   - `hud_proxy.py`：路由 `/rest/ossdesign/v1/designer/hud/*` 标记 `domain=infra`，不进业务检索默认结果。
   - **自检**（不用 grep 计数，grep 会混入注释/文档字符串/hud 转发表）：
     1. 用 AST 收集所有字符串常量中匹配 `^/rest/ossdesign/v1/designer/` 的值，去重得集合 S；
     2. 路由抽取结果集合 R；输出 `S−R`（被引用但未识别为路由：可能是未识别写法，或是出站调用/前端回调地址）与 `R−S`（理论为空）；
     3. 断言 15 个 `application_map` 接口类中每个类至少识别到 1 条路由；
     4. `S−R` 清单交人工确认一次，确认结果写入 `config: route_selfcheck_allow`，以后只对新增项告警。
3. **调用图**：
   - 解析 `import`/`from import` 建立模块别名表（注意 `sys.path` 根为 `pyscript/` 与 `pyscript/ossdesign/`——`ossdiyservice.py` 用 `from interface.designer import ...`，说明 `pyscript/ossdesign` 也在 path 中 [待确认 `sys.path` 设置]）。
   - `self.method()` → 同类方法；`Class.method()`/`module.func()` → 通过别名表解析；`obj.method()` 无法确定类型时按**方法名在全仓唯一**则连边，否则记 `unresolved:method` 并保留候选列表（≤5）。
   - 目标：已解析边比例 ≥ 70%（在报告中输出）。
4. **DB 访问**：
   - 字符串字面量中匹配 `(?i)\b(select|insert\s+into|update|delete\s+from)\b.*?\b(t_\w+|<表名集合>)\b`；表名集合来自 DDL 的 27 张表（大小写不敏感）。
   - `ossdesign_mapper`、`com_utils/db_helper`、`toolkit/dbhelper.py` 的封装调用：先人工确认封装 API（[待确认]），再加规则，如 `dbhelper.query("t_xxx", ...)`。
5. **外部接口**：
   - 字符串匹配 `/rest/(?!ossdesign/)` 开头的路径 → `ext:`；HTTP 方法从调用函数名推断（`get/post/put/delete`），不能确定记 `ANY`。
   - `restclient.json` 解析服务名 ↔ 地址映射。
   - 平台对照表：解析 `/opt/cloud/envs/Product-*/*/build/pathHandler.js`（格式 `['path','METHOD','file','handler']`），写 `platform_routes`，使 `ext:` 可显示"属于平台 Weave/AppController 的 xxx 功能"。
   - redis：`toolkit/redis_helper` 调用处的 key 字面量/f-string 模板。
6. **常量**：模块级 `NAME = <字面量>`（数字/字符串/小型 tuple/list/dict），以及 `Services/Common/const/constant.py` 全量。
7. 解析失败 → 符号表保留上一版本，`files.parse_ok=0`，状态 `BROKEN`。

### 5.4 模块：`kbcore.shadow`（影子快照）
```bash
# 初始化（每个 target 一次）
git --git-dir=$KB/shadow/ossdesign_py.git init --bare
git --git-dir=$KB/shadow/ossdesign_py.git config core.worktree /opt/cloud/manager/apps/OSSDesignService/pyscript
# info/exclude 写入：*.bak.*  __pycache__/  *.pyc  *.log
# 快照
git --git-dir=... --work-tree=<root> add -A && git ... commit -qm "auto <ISO时间> [<变更文件数>]" --author "kbd <kbd@local>"
```
- **首次初始化 MUST 导入 `.bak` 历史**：扫描 `*.bak.YYYYMMDDHHMMSS`，按时间升序，把每个 bak 内容作为"该文件在该时间点之前的版本"依次提交（commit 时间设为 bak 时间戳，用 `GIT_COMMITTER_DATE`/`GIT_AUTHOR_DATE`），最后提交当前工作区。同时写 `manual_edits` 表。
- 每次快照后输出 `git diff --name-only HEAD~1` 交给 scanner。
- 每日 `git gc --auto`；保留全部历史（代码量小）。
- 影子仓库**只在服务器使用**（审计、diff、旧版本源码、.bak 历史），**不再导出 git bundle 给本地**。
- **供本地同步的导出（v1.1 简化）**：每次扫描发现变化后，在 outbox 写：
  - `snapshot_<target>_<ts>.tar.gz`：本次相对"上次已导出状态"的**变更文件**（新增/修改的原文件，保持相对路径）；
  - `snapshot_<target>_<ts>.manifest.json`：`{base_export_id, export_id, shadow_commit, files:[{path, sha256, op: add|modify|delete}], full_file_list_sha256}`；
  - 首次或本地请求全量时导出 `mode: full`（整个 pyscript 的 tar，约十几 MB）。
  - 本地应用规则见 7.4①。

### 5.5 模块：`kbcore.scanner`（变化感知，v1.1 简化）
- **不使用 inotify / 防抖**。现场是"白天人工随手改"，不是 CI 流水线；定时全量扫描足够且无兼容性风险。
- 每 `scan_interval_seconds`（默认 600 s）全量扫描一次：L1（size+mtime）→ L2（sha256）→ L3（AST），1153 个文件 L1 级 < 2 s。
- **中间态处理**：若某文件在本次扫描中 L3 解析失败（改到一半）→ 记 `BROKEN`，不生成任务，下次扫描再判定。
- **查询时实时校验**（弥补 10 分钟间隔）：`kb_search/kb_get` 对命中卡片的锚点文件做 L1/L2 检查（毫秒级）；若 sha256 已变则当场对该文件做 L3 比对并内嵌 diff，同时向 scanner 投递"优先扫描该文件"事件。
- 手动触发：`kb scan`（CLI）或 `POST /scan`；`deploy_web.py` 推送完成后自动调用一次。
- 前端目录同样按此方式扫描（9 个文件，可忽略开销）。

### 5.6 模块：`kbcore.drift`（一致性检测，核心）
**三级检测流程**
```
L1: (size, mtime) 未变 → 跳过
L2: sha256 未变 → 仅更新 mtime
L3: 重新解析 → 符号级比较：
     对旧符号集 O 与新符号集 N（按 qualname 匹配）：
       qualname ∈ O∩N:
          ast_hash 相同 → 行号变则 MOVED（静默）否则无变化/COSMETIC
          ast_hash 不同, norm_hash 相同 → RENAMED_VARS（静默刷新）
          否则 → MODIFIED
       qualname ∈ O−N:
          若某新符号 ast_hash 与之相同 → MOVED（改名/搬家，更新锚点）
          否则 → DELETED
       qualname ∈ N−O → NEW（若为路由 handler/入口 → UNCOVERED）
```
**卡片状态传播**
1. 对每个变化符号 s：`SELECT card_id FROM card_anchors WHERE ref=s` →
   - kind=direct 且 MODIFIED/DELETED → 卡片 `MODIFIED`/`DELETED`；
   - kind=transitive → `TRANSITIVE`。
2. 沿 `edges(kind='call')` **反向**扩展 2 层：调用了 s 的函数所锚定的 flow/algorithm 卡 → `TRANSITIVE`。
3. COSMETIC/MOVED/RENAMED_VARS → 自动更新 `card_anchors.ast_hash` 与行号，卡片保持 `FRESH`，不产生任务。
4. 生成任务：
   - `fn` 卡 MODIFIED/NEW → `jobs(kind='fn_card', priority=5)`（服务器 worker 处理）；
   - `api`/`external` 卡 → `jobs(kind='api_card', priority=4)`；
   - flow/algorithm/rule/page/glossary → **不在服务器重写**，标记状态并写入 outbox 报告 `need_local=true`；同时服务器生成一张 `change` 卡（基于 diff 的"行为变化说明"，priority=3），供在线回答过渡使用。

**claims 核对**（每次扫描后 + 每日全量）
| kind | 核对方式 |
|---|---|
| constant | 在 `constants` 表中查 name（限定所属模块），比较字面值 |
| table / column | 在 `tables_ddl` 中存在性；DDL 文件 hash 变化时全量核对 |
| route | `routes` 中存在且 handler 一致 |
| config | 读取配置文件对应 key，比较 `value_hash`（敏感文件只比 hash） |
| ext | 外部接口字符串仍被引用 |

**生效检测（NOT_LIVE）——按"内容"而非 mtime 判定**
- `proc_monitor` 每 30 s：遍历 `/proc/*/cmdline`，匹配 `-DNFW=<name>` → 记录 pid 与启动时间（`/proc/<pid>/stat` 第 22 字段 starttime / `CLK_TCK` + `/proc/stat` 的 `btime`）。
- **live 基线**：
  - 检测到进程**新启动**（pid 或 start_time 变化）时，立即对其 `process_roots` 下所有 py 文件计算 sha256，存为 `live_hashes(process, path, sha256)`（1153 文件 < 2 s）。
  - kbd 首次启动时进程早已在运行：取影子仓库中**提交时间 ≤ 进程启动时间的最近一次提交**作为 live 基线；若该时间点前无快照（影子仓库建立晚于进程启动），则基线 = 当前内容，状态记 `live=unknown_before_kb`，不报 NOT_LIVE。
- **判定**：文件当前 sha256 ≠ live 基线 sha256 → `NOT_LIVE`。
  - 这样 `touch`（内容不变）不会误报；`cp -p`（保留旧 mtime 但内容变化）也不会漏报。
  - mtime 只作为 L1 快速筛选，不作为结论依据。
- 进程重启后基线刷新，NOT_LIVE 自动清除。
- 前端（`live_on_replace=true`）不做此检测；k8s_simu Nuxt（`hot_reload`）不做；**k8s_simu Go 部分一律 `live=unknown`，不纳入判定**。

**前端 bundle 检测**
1. 计算目录内 include 文件 sha256（排除 `*.bak.*`）。
2. 与 `manifests` 中所有 `ossdesign_web` 清单的 outputs 比对：
   - 全部命中最新导入的清单 → `JS_OK`（记录 build_id/commit）；
   - 全部命中某个旧清单 → `JS_OK`（但"服务器运行的是旧 build_id"，`env_status` 显示）；
   - 存在未命中文件，且该文件存在对应 `.bak` 时间与 mtime 相近 → `JS_NEW_BUILD_NO_PACK`；
   - 未命中且无法解释 → `JS_TAMPERED`。
3. `JS_NEW_BUILD_NO_PACK` 时（v1.1 默认行为）：只在报告中列出变化的产物文件与时间，**本地据此对比"上次部署 commit..当前 HEAD"的前端源码 diff 来定位受影响页面**（本地有完整源码与 Git，无需 sourcemap）。
4. （可选，S8 后）若启用 sourcemap：把新旧产物美化后 diff，再用旧 sourcemap 映射到源文件/函数，写入报告 `suspect_sources`。仅当出现"服务器上直接改前端产物"的情况较多时才值得做。

### 5.7 模块：`kbcore.ddl`
- 解析 `create_db_file.sql`：`CREATE TABLE` 名称、列（名、类型、默认、非空）、主键、索引、`COMMENT`（若有）。
- 写 `tables_ddl`；为每张表生成 `table` 伪卡片（type=`module`，domain 依据访问它的代码推断），便于检索"某表存什么、谁在写"。
- `get_schema(table)` 返回：列定义 + 读写该表的函数列表（来自 `edges kind='db'`）。

### 5.8 模块：`kbcore.worker`（服务器模型生成卡片）
**任务类型与优先级**
| kind | 优先级 | 输入 | 输出 |
|---|---|---|---|
| `change_card` | 3 | 旧/新源码 diff + 原卡片 | change 卡 |
| `api_card` | 4 | 路由 + handler 源码 + 被调函数的 fn 卡摘要 | api 卡 |
| `fn_card` | 5 | 函数源码（截断 ≤ 300 行）+ 直接被调函数的一行摘要 + 涉及表/外部接口 | fn 卡 |
| `module_card` | 6 | 模块内 fn 卡摘要列表 | module 卡 |
| `qa_gen` | 7 | 卡片 | 3–5 个预生成问句 |

**策略**
- **建卡范围（v1.1，MUST）**：fn 卡只给"精选集合" F 建：
  ```
  F = Reach ∩ ( RefByHigh ∪ FanIn2 ∪ SideEffect ) − Trivial
  Reach      = 从任一路由 handler / 进程入口 / 定时任务入口沿调用边可达（深度 ≤ 6）的函数
  RefByHigh  = 被任一 flow/algorithm/rule/api 卡 anchors 引用的函数
  FanIn2     = 已解析调用边中被 ≥ 2 个不同调用者调用的函数
  SideEffect = 有 db_access / externals / redis_keys 边的函数（副作用函数是回答"写了哪些表"的关键）
  Trivial    = loc < 5、纯 getter/setter、__repr__/__str__、仅转发一行调用的包装函数
  ```
  预计 600–1200 张（S1 完成后用真实调用图计算并写入 env-facts）。其余函数**只进符号索引**（名称、签名、docstring 首行、所在文件），`kb_code` / `kb_trace` 仍可取到。
- 新卡引用了不在 F 中的函数时（RefByHigh 增长），自动补建其 fn 卡。
- **自底向上**：按调用图拓扑序（叶子优先）生成 fn 卡，使上层函数提示中可包含下层摘要；无卡的下层函数用"签名 + docstring 首行"代替。
- **增量（diff 模式）**：已有卡片且 MODIFIED 时，提示词提供"旧卡 + unified diff"，要求只输出变化后的完整卡片正文（fn 卡短，直接全量重写即可；api/module 卡用 diff 模式）。
- **内容寻址缓存**：`cache_key = sha256(prompt_template_version + ast_hash + 依赖摘要hash)`；命中直接复用（代码改回去不再调模型）。
- 输出校验：必须是合法 frontmatter + 必备小节；失败重试 2 次后标记 `jobs.status='failed'`。
- **在线优先**：检测到 cogagent 有活跃会话（broker `/status` 或模型服务队列长度 [待确认]）时 worker 并发降为 2；首次批量放夜间。
- 首次批量：约 600–1200 张 fn 卡 + 全部 api 卡（约 100–200），并发 16，预计 **40–90 分钟**。
- 产出：worker 只产出卡片 JSON，经 `db_writer` 落库（5.2）。
- 提示词模板见附录 B-1、B-2。

### 5.9 模块：`kbcore.importer`（知识包导入）
1. 发现 `inbox/*.kbpack.tar.gz` 且同名 `.sha256` 存在（保证上传完成）→ 校验。
2. 解包至临时目录 → `pack.json` 校验 schema/prev。
3. 卡片 upsert：
   - 同 id 已存在且 `producer=server-self`、新卡 `producer=local-commercial` → **覆盖**（本地优先）；
   - 反之（服务器卡更新于本地卡之后且锚点 hash 更新）→ 保留服务器卡并在报告中提示本地复审。
   - 选择规则见 5.11。
4. 导入 `web_calls/api_links` → `edges(kind='web_call')`；`glossary.json` → 术语表；`build_manifest` → `manifests`；sourcemap/前端源码片段 → `cache/web/<build_id>/`。
5. **导入后立即执行一次 drift 扫描**（锚点 hash 可能已与服务器当前代码不同）。
6. 重建该批卡片的 FTS 与向量。
7. 移入 `inbox/archive/`，写 `packs` 表；结果写 outbox `import_<pack_id>.json`。
8. 若包内含新 `kbcore/` 且版本更高：写入 `kbcore.new/`，下次 `kbd` 重启时切换（不热替换）。

### 5.10 模块：`kbcore.search`（混合检索）
**写入索引时**
- `idents` 字段：从卡片锚点符号、路由、表名中抽取标识符，按 `snake_case`/`camelCase` 拆分并保留原词：`analyzeSpareString → analyze spare string analyzeSpareString`。
- 中文字段先 jieba 分词（加载术语表作为自定义词典），空格连接写入 FTS5。
- **分词一致性（MUST）**：
  - 写入与查询使用**同一个分词函数** `kbcore.textproc.tokenize()`，同一 jieba 版本（requirements 锁定版本号），同一词典。
  - 自定义词典文件 `data/userdict.txt` 由术语表生成，带版本号 `meta.dict_version`。
  - 术语表更新（知识包导入）→ 重新生成词典 → **热加载**（`jieba.Tokenizer` 新实例原子替换）→ 后台重建 FTS（`dict_version` 不一致的行重写）；重建完成前查询同时用新旧两种分词结果召回并合并，避免召回断崖。
- 向量：对 `title + summary + questions` 做一个向量；`body` 按 512 token 切块各一个向量。
- **召回分层**：`kb_search` 默认只召回 `flow/algorithm/rule/api/page/module/glossary/qa/change/external` 卡；**fn 卡与符号索引默认不参与召回**，仅在 ① 显式 `type=fn`、② 高层卡召回得分低于阈值（兜底）、③ 精确匹配到函数名 时出现。避免大量低层文档稀释 top-k。

**查询流程**（`search(query, type?, domain?, target?, k=8)`）
1. 查询预处理：jieba 分词 + 标识符拆分；**术语表扩展**（"冻结金额"→ 追加 `frozen_amt`）；歧义词（如"路由 route"）若术语表标记了多义，按上下文关键词选择义项，否则两个都保留并在结果中提示。
2. 并行召回：FTS5 BM25 top 50、向量 top 50、精确匹配（路由路径/符号名/表名直接命中，权重最高）。
3. RRF 融合（k=60）→ top 30 → 重排（若启用）→ top k。
4. **图扩展**：top 3 中若为 fn/api 卡，附带其所属 flow 卡 id（`related`）。
5. **状态内嵌**：对每个结果查询锚点实时状态（L1/L2 级文件检查，毫秒级），若 MODIFIED 则附 diff（仅变化函数，≤ 60 行）。
6. 过滤：默认排除 `domain=infra`；`type=fn` 卡在有同主题 flow/algorithm 卡时降权（鼓励先看高层卡片）。

### 5.11 卡片选择规则（多来源冲突）
同一主题存在多张卡（如 server-self 的 fn 卡与 local-commercial 的 algorithm 卡）时：
1. 状态优先：`FRESH/COSMETIC/MOVED/RENAMED_VARS` > `TRANSITIVE` > `CLAIM_DRIFT/MODIFIED` > `BROKEN` > `DELETED`。
2. 同状态下：`local-commercial` > `server-self`。
3. 同来源同状态：`generated_at` 新者优先。
4. 结果中 MUST 保留被压制卡片的 id（`alternatives` 字段），以便模型需要时追查。

### 5.12 `kbd` HTTP API（仅 127.0.0.1，供 kb-mcp 与 CLI 使用）
| 方法 路径 | 参数 | 返回 |
|---|---|---|
| `GET /search` | q, type, domain, target, k | 结果列表（见 6.2 返回格式） |
| `GET /card/{id}` | full=0/1 | 卡片 + 状态 + diff |
| `GET /flow` | name 或 route 或 page | 最佳 flow 卡（含步骤）+ 状态 |
| `GET /algorithm` | name | 最佳 algorithm 卡 + 状态 |
| `GET /trace` | ref, direction=up/down/both, depth≤4, kinds | 子图：节点（含一行摘要）+ 边 |
| `GET /code` | ref, context=0..20, version=current/card | 源码片段（py：当前磁盘；web：知识包源码片段） |
| `GET /schema` | table | DDL 列 + 读写函数 |
| `GET /env` | target? | 进程、NOT_LIVE 清单、前端 build_id、知识包版本、最近人工修改 |
| `GET /drift/summary` | — | 各状态计数 + top 问题 |
| `POST /scan` | target? full? | 触发扫描 |
| `POST /qa/feedback` | q, answer, card_ids, ok | 写 qa_cache / 生成 qa 卡 |
| `GET /health` | — | 版本、索引大小、队列长度 |

### 5.13 CLI `kb`
```
kb scan [--target T] [--full]        # 立即检测并打印报告摘要
kb status                            # 等价 /env + /drift/summary
kb import [path]                     # 手动导入知识包
kb rebuild-index                     # 重建 FTS + 向量
kb jobs [--failed] [--retry]         # 查看/重试任务
kb report --out outbox/              # 立即生成 drift 报告与变更文件快照（tar + manifest）
kb card <id>                         # 查看卡片
kb search "<问题>"                   # 命令行检索（调试）
kb eval <evalset.yaml>               # 只评检索 recall（不调模型）
```

---

## 第 6 章 cogagent 集成（OpenCode 机制）

### 6.1 集成方式选型
| 方式 | 采用 | 说明 |
|---|---|---|
| **MCP Server（stdio）** | ✅ 主方案 | 工具定义与语言无关，Python 实现；OpenCode 原生支持；以后其他 Agent 也可复用 |
| `.opencode/tools/*.ts` 自定义工具 | 备选 | 若 cogagent 改造后 MCP 不可用，用 TS 薄封装调用 `kbd` HTTP API |
| Plugin（`.opencode/plugin/*.ts`） | ✅ 用于"预检索" | 在用户消息进入模型前调用 `/search`，把 top 卡片摘要注入上下文 [需确认 cogagent 保留的插件钩子，见 6.4] |
| AGENTS.md 规则 | ✅ | 回答规范、工具使用顺序 |
| Skills | 少量 | 仅低频复杂任务（数值排查、影响分析），避免每次多一轮 |

**配置位置**：cogagent 的 OpenCode 配置文件 [待确认：`/srv/cogagent/users/<user>/.config/opencode/opencode.json` 或全局配置，见附录 A-6]。示例：
```json
{
  "mcp": {
    "ossdesign-kb": {
      "type": "local",
      "command": ["/opt/cloud/manager/tools/cogagent-kb/venv/bin/python", "-m", "kbcore.mcp_server"],
      "environment": {"KBD_URL": "http://127.0.0.1:18790"},
      "enabled": true
    }
  },
  "tools": { "ossdesign-kb_*": true }
}
```
> 若 cogagent 运行在多用户隔离环境（`/srv/cogagent/users`），MCP 配置需写入每个用户 profile 或全局 profile；kb-mcp 只读，无凭据，**允许所有用户共享**。

### 6.2 MCP 工具定义（名称、参数、返回）
> 返回一律为**紧凑 JSON 字符串**；字段名短小；总长度默认 ≤ 6000 字符（可通过参数放宽）。

**① `kb_search`** —— 首选工具
```
参数: query: string（必填，用户问题原文或改写）
      type?: "flow"|"algorithm"|"rule"|"api"|"page"|"fn"|"module"|"glossary"|"any"（默认 any）
      target?: "ossdesign"|"k8s_simu"|"any"
      k?: int（默认 6，最大 12）
返回: {"results":[
        {"id":"alg.ossdesign.spare_analysis","type":"algorithm","title":"...","summary":"...",
         "status":"MODIFIED","live":false,
         "diff":"- rate = 0.05\n+ rate = cfg.SPARE_RATE",
         "src":"ossdesign/domain/.../spare.py:120","related":["flow.ossdesign.export_lld"],
         "alternatives":["fn.ossdesign_py.1a2b3c"]}
      ],
      "env_note":"ossdesignservice-0-0 有 1 个文件改动未生效"}
描述(给模型看): "检索 OSSDesign/k8s_simu 业务知识卡片。回答任何业务流程、计算、接口、表结构问题前先用它。结果已包含一致性状态与代码变更 diff，无需再单独核对。"
```
**② `kb_get`** —— 取完整卡片（可批量）
```
参数: ids: string[]（≤4）
返回: [{"id","type","status","body"(完整正文),"diff"?,"src"}]
```
**③ `kb_flow`** —— 按业务名/接口/页面取流程
```
参数: name?: string | route?: string | page?: string（三选一）
返回: flow 卡完整正文 + 每步函数的状态标记
```
**④ `kb_trace`** —— 调用链/影响面
```
参数: ref: string（符号名/路由路径/表名/页面）
      direction: "down"|"up"|"both"（默认 down）
      depth?: int（默认 2，最大 4）
返回: {"nodes":[{"id","kind","summary(一行)","status"}],"edges":[["a","b","call|db|ext|web_call"]]}
```
**⑤ `kb_code`** —— 必要时核对源码
```
参数: ref: string（符号 id 或 文件:行范围）
      context?: int（默认 0）
返回: {"lang","file","lines","code","version":"current|build:<id>","status"}
限制: 单次 ≤ 200 行；超出返回截断提示
```
**⑥ `kb_schema`** —— 表结构
```
参数: table: string（支持模糊）
返回: {"table","columns":[{"name","type","comment"}],"writers":[...],"readers":[...]}
```
**⑦ `kb_env`** —— 环境与知识库状态
```
参数: target?: string
返回: {"processes":[{"name","pid","start"}],"not_live":[...],"web":{"status","build_id","commit"},
       "pack":{"id","imported_at"},"manual_edits":[{"path","ts"}],"drift":{"stale":6,"uncovered":2}}
```
**⑧ `kb_feedback`**（可选）—— 用户确认答案正确时回流
```
参数: question, answer_summary, card_ids, ok: bool
```

### 6.3 AGENTS.md 规则（cogagent 侧，放在 cogagent 工作目录或全局规则）
```markdown
# OSSDesign 知识库使用规则
1. 回答 OSSDesign / k8s_simu 的业务流程、算法、接口、表结构问题时：
   - 若上下文已有「预检索结果」，优先基于它回答；不足时再调用 kb_search / kb_get。
   - 需要多个信息时，在**同一轮并行**调用多个工具。
   - 禁止直接使用 grep/read 浏览业务源码，除非 kb_* 工具明确无结果；即便如此，先用 kb_code。
2. 结果状态处理：
   - FRESH/MOVED/COSMETIC：直接使用。
   - MODIFIED/CLAIM_DRIFT：以 diff/实际值修正卡片内容后回答，并注明“依据服务器当前代码（卡片待更新）”。
   - NOT_LIVE：必须声明“磁盘代码已修改但服务未重启，当前运行仍为旧逻辑”，并分别说明新旧行为。
   - JS_NEW_BUILD_NO_PACK / JS_TAMPERED：说明前端知识可能过时。
3. 回答格式：先结论（≤5 行），再要点，最后「出处」列出 文件:行 与卡片 id。默认不超过 400 字，用户追问再展开。
4. 计算类问题：给出公式、变量来源（代码变量/表字段/配置）、舍入规则、一个算例。
5. 不确定时明确说明，不要臆造函数名或字段。
```

### 6.4 预检索插件（Plugin）
目的：**用户提问后、模型首轮前**自动检索并注入，常见问题 0 次工具调用即可回答。
```ts
// .opencode/plugin/kb-prefetch.ts   （钩子名以 cogagent 实际 OpenCode 版本为准 [待确认]）
import type { Plugin } from "@opencode-ai/plugin"
export const KbPrefetch: Plugin = async () => ({
  "chat.message": async (input, output) => {           // 或 experimental.chat.system.transform 等等价钩子
    const text = extractUserText(output)               // 取用户最新消息
    if (!looksLikeBusinessQuestion(text)) return       // 简单规则：含业务词/接口名/“怎么算/流程/逻辑”等
    const r = await fetch(`http://127.0.0.1:18790/search?k=5&q=${encodeURIComponent(text)}`).then(r => r.json())
    appendContext(output, renderCompact(r))            // 注入 ≤ 2500 字的“预检索结果”块
  },
})
```
- 若 cogagent 当前版本无合适钩子：退化方案为在 **broker.py**（cogagent-hud，已是请求入口）里，在把用户消息转发给 cogagent 前调用 `/search` 并把结果作为前置上下文拼接。[待确认 broker 的消息转发代码位置]
- 注入内容固定格式（利于前缀缓存）：
```
<kb_prefetch version=1>
[1] alg.ossdesign.spare_analysis | FRESH | 备件分析计算逻辑：……（summary）| src: ...:120
[2] flow.ossdesign.export_lld | MODIFIED(diff 可用 kb_get 查看) | ……
</kb_prefetch>
```

### 6.5 cogagent 侧 Skills（仅 2 个，放 `.opencode/skills/`）
| Skill | 触发 | 内容 |
|---|---|---|
| `ossdesign-number-mismatch` | “算出来的数不对/和预期不一致/页面显示与后台不一致” | 步骤：kb_flow 找链路 → kb_get 算法卡（前后端差异节）→ kb_code 核对舍入/配置 → kb_schema 核对字段 → 给出差异定位 |
| `ossdesign-change-impact` | “改了 X 会影响什么/这个函数被谁用” | 步骤：kb_trace up depth=3 → 汇总受影响的 api/flow/page → 列出需回归的接口 |

### 6.6 模型调用参数建议（cogagent 侧）
- 检索/工具决策轮：关闭或限制 thinking（若模型支持 `reasoning_effort=low`）。
- 系统提示 + AGENTS.md + 工具定义保持稳定，放最前，启用推理服务的前缀缓存。
- 最终回答 `max_tokens` 建议 800。

---

## 第 7 章 本地端（kb-factory、Skills、部署脚本）

### 7.1 本地环境
- Python 3.12（`uv python install 3.12 && uv sync`），**禁止其他版本运行 hash 相关脚本**（脚本启动时断言 `sys.version_info[:2]==(3,12)`）。
- Node（与前端工程一致的版本，用于 `npm run build` 与前端 AST 抽取可选的 Babel 解析）。
- 依赖：`pyyaml jieba tree-sitter tree-sitter-typescript tree-sitter-javascript tree-sitter-go paramiko`（或直接调用系统 `ssh/scp/rsync`；Windows 建议 OpenSSH + `scp`，rsync 可选）。
- Agent：Claude Code 或 OpenCode，在 `kb-factory` 根目录启动。

### 7.2 AGENTS.md（本地，kb-factory 根目录）——核心内容
```markdown
# kb-factory 工作说明（给 Claude Code / OpenCode）
你在维护 OSSDesign 与 k8s_simu 的业务知识库。完整方案见 docs/OSSDesign知识库方案.md。
## 硬性规则
- 一切代码事实以 `server-snapshot` 分支（服务器真实代码）与 build_manifest 记录的前端 commit 为准，不以本地工作区为准。
- 卡片格式严格遵守方案第 4 章；写完必须运行 `python scripts/kb_card_lint.py <文件>`，不通过不得提交。
- 批量任务使用队列：`python scripts/kb_queue.py next --type <t> --n 5` 取任务，完成后 `kb_queue.py done <id>`；每批不超过 5 张，便于中断续做。
- 生成算法卡时必须实际运行代码得到算例（见 skill kb-card-algorithm）。
- 不在卡片中写入密码、密钥、token、IP 以外的敏感信息。
- 优先使用 scripts/ 下的脚本，脚本输出精简 JSON；不要把大文件整体读入上下文。
```

### 7.3 Skills 规范（两种 Agent 通用，MUST）
- 位置：`kb-factory/.claude/skills/<name>/SKILL.md`（OpenCode 自动兼容此路径）。
- frontmatter 仅 `name`、`description`（可选 `metadata`）；`name` 为小写连字符，与目录同名。
- 不使用 `$ARGUMENTS`、`!命令`、`allowed-tools`、`context: fork` 等单平台特性。
- 所有确定性工作调用 `python scripts/xxx.py`（从仓库根目录执行），Skill 只描述步骤、判断标准与产出要求。
- Skill 目录内可放 `reference.md`（模板/示例），SKILL.md 中写"需要时阅读 reference.md"。

### 7.4 Skill 清单与详细规格

#### ① `kb-sync`
```markdown
---
name: kb-sync
description: 与服务器同步 OSSDesign 知识库：拉取服务器 Python/k8s_simu 快照与一致性报告并更新 server-snapshot 分支，或推送知识包。用户提到同步、拉报告、推知识包、服务器改了什么时使用。
---
## 步骤
1. 拉取：`python scripts/kb_sync.py pull`
   - 输出 JSON：新快照 commit 数、报告路径、need_local 条目数、JS 状态。
2. 若有新快照：脚本已自动把变更文件提交到 `server-snapshot` 分支。运行
   `python scripts/kb_sync.py diff-summary` 查看相对 main 的变化（文件级摘要），向用户简述“服务器上未提交的改动”。
3. 若报告中有 need_local 条目：建议执行 skill `kb-update-from-drift`。
4. 推送：`python scripts/kb_sync.py push build/<pack>.kbpack.tar.gz`，等待输出 `import ok`（脚本会轮询服务器 outbox 中 import 结果，超时 120s）。
## 注意
- 不要手动编辑 server-snapshot 分支。
```
`kb_sync.py` 行为：
- `pull`（v1.1 简化，不使用 git bundle）：
  1. `scp ossadm@srv:$KB/outbox/*` → `state/inbox_from_server/`（报告、`snapshot_*.tar.gz` + `.manifest.json`）。
  2. 按 `export_id` 顺序应用快照：校验 `base_export_id == state/last_applied_export_id`，不连续则请求全量（`ssh srv 'kb export --full'` 后重拉）。
  3. 使用**独立 git worktree**（`git worktree add ../ossdesign-snapshot server-snapshot`，首次从 main 创建），把 tar 中文件解到 `<worktree>/<py_subdir>/`，对 `op=delete` 的文件删除；`git add -A && git commit -m "server snapshot <export_id> shadow:<commit>"`。
  4. 校验：worktree 中 `<py_subdir>` 全部文件 sha256 汇总 == manifest `full_file_list_sha256`，不一致则报错并建议全量。
  5. k8s_simu 同理，进 k8s_simu 仓库的 worktree。
  6. 服务器 outbox 中已成功应用的文件由脚本移动到 `outbox/archive/`（ssh 执行），保留 7 天。
- `push`：上传包与 `.sha256`（先传包后传 sha256，保证原子可见），然后轮询 `outbox/import_<pack_id>.json`。
- `diff-summary`：`git diff --stat main..server-snapshot -- <py_subdir>` 精简输出。

#### ② `kb-extract`
```markdown
---
name: kb-extract
description: 抽取 OSSDesign/k8s_simu 的代码结构（符号、调用图、路由、前端API调用、前后端对齐、DDL、外部接口），生成后续写卡所需的结构数据与任务队列。首次建库、服务器代码有较大变化或前端发布前使用。
---
## 步骤
1. `python scripts/kb_extract.py py --ref server-snapshot` → state/structure/structure_py.json
2. `python scripts/kb_extract.py web --ref <build_manifest 的 commit 或 HEAD>` → web_calls.json, structure_web.json
3. `python scripts/kb_align_api.py` → api_links.json；查看输出中的 unmatched：
   - 对前端未解析的拼接路径（resolved=false），打开对应源码位置，判断真实路径，把映射写入 `state/structure/web_path_overrides.yaml`，重跑本步，直到 unmatched 中仅剩确实无后端的调用。
4. `python scripts/kb_queue.py seed` → 根据结构生成卡片任务（见 7.5 优先级）。
5. 向用户报告：路由数、前端调用数、对齐率、未对齐清单、待生成卡片数。
```
**前端 API 调用抽取规则（`kb_extract.py web`）**
1. 先确认框架与 HTTP 封装 [待确认，附录 A-4]：在前端源码中搜索 `axios|fetch(|$http|request(|ajax`，找到项目统一的请求函数（如 `src/utils/request.js` 的 `post(url, data)`）。把封装函数名写入 `kb.local.yaml: web.http_wrappers: [post, get, request]`。
2. tree-sitter 解析 `.js/.ts/.vue(<script>)`：对 `wrapper(urlExpr, ...)`、`axios.post(urlExpr)` 调用，求值 `urlExpr`：
   - 字符串字面量 → 直接；
   - 模板字符串/拼接 → 常量折叠：在同文件/导入的常量模块中查找 `const BASE = '/rest/ossdesign/v1/designer'`，替换后得到路径；含运行时变量的部分替换为 `{var}`；
   - 失败 → `resolved=false`，保留 `path_raw`。
3. 记录调用所在组件、方法名（如 `onSubmit`），以及组件所属路由页（解析前端路由表 `routes` 配置）。
4. 对齐：`method + path` 精确匹配；含 `{var}` 时按段通配匹配；方法未知时仅按路径匹配。

#### ③ `kb-glossary`
```markdown
---
name: kb-glossary
description: 生成或更新 OSSDesign/k8s_simu 业务术语表（业务名词↔代码标识符↔表字段↔前端文案↔歧义说明）。首次建库或出现新业务概念时使用。
---
## 步骤
1. `python scripts/kb_extract.py terms` → 候选词清单（来源：DDL 列名与注释、前端 i18n/文案、常量名、接口名、类名），按频次排序，输出 ≤ 300 条到 state/terms_candidates.json。
2. 分批（每批 50 条）阅读候选及其出现位置样例（脚本提供 `--show <term>`），产出表格行：
   | 业务名 | 英文/代码标识符 | 表.字段 | 前端文案 | 含义（≤40字） | 歧义/同名 |
3. 重点处理多义词：route（网络路由 vs HTTP 路由）、site、node、port、product、container、layout、board、spare 等，明确每个义项的判别关键词。
4. 写入 cards/ossdesign/glossary/glossary.md（单文件，按业务域分节）与 state/structure/glossary.json（供检索扩展与 jieba 词典）。
5. lint 后提交。
```

#### ④ `kb-card-flow`
```markdown
---
name: kb-card-flow
description: 为 OSSDesign/k8s_simu 生成端到端业务流程卡（页面/按钮→接口→接口层→领域层→表/redis/平台接口→返回）。用户要求为某业务流程建卡、或队列中有 flow 任务时使用。
---
## 输入
- 任务：`python scripts/kb_queue.py next --type flow --n 3`（每个任务含入口：页面/路由，及预计算的调用子图 json）
## 步骤（每个任务）
1. `python scripts/kb_extract.py subgraph --entry <route|page> --depth 5` 获取调用子图（含每个节点的服务器 fn 卡摘要，若有）。
2. 只阅读子图中**业务相关**节点源码（跳过日志、通用工具、序列化），优先阅读：handler、领域服务、写库/调外部接口的函数。
3. 按方案 4.4 flow 小节写卡：触发入口、编号步骤（每步标注函数与文件:行）、状态变化、涉及表（读/写）、外部接口、异常与补偿、可选 mermaid 时序图。
4. frontmatter：anchors 列出子图中所有**直接参与**的函数（kind=direct）与其 ast_hash（`python scripts/kb_extract.py hash <symbol>` 获取），以及路由；claims 列出关键常量/表。
5. 生成 5–8 个 questions（用户真实会问的说法，中文为主）。
6. `python scripts/kb_card_lint.py <file>` → 通过后 `kb_queue.py done <id>`。
## 质量标准
- 步骤数 3–15；每一步都能在代码中找到对应函数。
- 不确定处写“推测：”，confidence 降为 medium。
```

#### ⑤ `kb-card-algorithm`
```markdown
---
name: kb-card-algorithm
description: 为 OSSDesign/k8s_simu 的计算逻辑生成算法卡/规则卡（公式、变量↔代码↔字段映射、舍入精度、边界、配置来源、实际运行算例、前后端实现差异）。用户要求解释或沉淀某个计算/规则，或队列中有 algorithm/rule 任务时使用。
---
## 步骤
1. 取任务：`kb_queue.py next --type algorithm --n 2`。
2. 阅读目标函数及其直接依赖（`kb_extract.py subgraph --entry <symbol> --depth 2`），找出：输入、公式、常量与配置来源、舍入（round/ceil/floor/Decimal/int()）、边界判断。
3. 搜索前端是否有同名或同义计算（`python scripts/kb_extract.py web-search --terms <关键词,变量名>`），有则对比差异。
4. **运行算例**：编写最小调用脚本放在 `state/sandbox/<card>.py`，从 server-snapshot 导入函数（`python scripts/kb_sandbox.py run <card>.py`，脚本负责设置 sys.path 与 mock 掉 DB/redis/平台调用），构造 1–2 组典型输入，记录真实输出。无法运行时说明原因并手算，confidence=medium。
5. 按 4.4 algorithm 小节写卡：变量表、公式（LaTeX 或伪代码）、舍入与精度、边界、配置来源、算例（输入→输出）、前后端差异。
6. claims 必须包含公式中的所有常量与配置项。
7. lint → done。
```
- `kb_sandbox.py`：提供 `mock_db()`、`mock_redis()`、`mock_rest()` 上下文管理器；依赖缺失（如 `enginering_com_utils` 平台库）时注入空模块桩。

#### ⑥ `kb-update-from-drift`
```markdown
---
name: kb-update-from-drift
description: 根据服务器一致性报告，只更新受影响的本地负责卡片（flow/algorithm/rule/page/glossary），并基于 diff 修改而非重写。拉取报告后、或用户说“知识库过时/更新卡片”时使用。
---
## 步骤
1. `python scripts/kb_sync.py pull`（若尚未拉取）。
2. `python scripts/kb_queue.py from-report state/reports/<最新>.json` → 生成更新任务（含 diff 与受影响卡片）。
3. 逐个任务：阅读旧卡片 + diff（`kb_queue.py show <id>`），只修改受影响段落与 anchors.ast_hash、claims、source_version；不改动无关内容。
4. JS_NEW_BUILD_NO_PACK：使用报告中的 suspect_sources 定位前端函数，更新相关 page/flow/algorithm 卡。
5. UNCOVERED：为新入口建卡（转交 kb-card-flow 流程）。
6. lint → done → 运行 skill kb-release。
## 成本控制
- 仅改动段落；若某卡 diff 涉及 >50% 内容，才整体重写。
```

#### ⑦ `kb-review`
```markdown
---
name: kb-review
description: 抽检服务器自研模型生成的函数卡/接口卡质量并纠错。定期（每周）或用户质疑服务器卡片质量时使用。
---
## 步骤
1. `python scripts/kb_review.py sample --n 20 --strategy risk`（优先抽：被 flow/algorithm 引用多的、近期修改的、confidence 低的）。卡片从服务器 `kb card` 导出到 state/review/。
2. 对照 server-snapshot 源码核对：功能描述、副作用（表/外部接口）是否正确。
3. 错误卡片：写修正版到 cards/ossdesign/fn/（producer=local-commercial，会覆盖服务器版本）。
4. 输出质量报告：正确率、常见错误类型 → 若某类错误集中，修改服务器提示词模板（附录 B），提交到 kbcore/prompts/ 并随下次知识包下发。
```

#### ⑧ `kb-release`
```markdown
---
name: kb-release
description: 校验全部卡片并打包知识包（增量或全量），可选推送到服务器。生成或更新卡片后、或部署前端时使用。
---
## 步骤
1. `python scripts/kb_card_lint.py --all` 必须 0 错误。
2. `python scripts/kb_pack.py --mode delta`（首次或 schema 变化用 --mode full）→ build/<pack_id>.kbpack.tar.gz
3. 需要推送时执行 skill kb-sync 的推送步骤。
```

### 7.5 卡片任务优先级（`kb_queue.py seed`）
| 优先级 | 任务 | 来源 |
|---|---|---|
| P0 | 术语表 | kb-glossary |
| P1 | 分析类算法卡：analyzeSpare、analyzeSpareString、checkMigrateSite、checkReplaceDiskSite | 路由 |
| P1 | 站点/项目流程卡：createPrj、deletePrj、createSite、deleteSite、expandSite、createHaSite | 路由 |
| P2 | 导出流程卡 + 字段映射规则卡：exportLLD、exportCFGFile、exportEquipmentExcel、exportHardwareInfo、exportCSMFile、exportGradsLayoutTools | 路由 |
| P2 | 导入流程卡：GradsLayout 导入、新容器导入、继承导入 | 路由 |
| P2 | 网络配置/IP 规划算法卡（net_config_mgr、IpPlanning、route_importer） | 符号 |
| P3 | 硬件配置规则卡（board_manage_cbb）、存储配置、端口归属 | 路由 |
| P3 | 校验规则卡（ossdesign_verification 全量规则表） | 模块 |
| P3 | 连线图布局算法卡（svg_generater） | 符号 |
| P3 | 容器方案流程卡（container/*） | 路由 |
| P4 | 前端页面卡（每个主页面一张） | web_calls |
| P4 | 模块卡（每个一级包一张，若服务器未生成） | 目录 |
| P5 | k8s_simu（第 8 章） | — |

### 7.6 前端知识来源与构建清单（v1.1：sourcemap 降级为可选）
- **默认（S5 起）**：前端知识**直接解析本地源码**（tree-sitter，见 kb-extract），不依赖 sourcemap。构建清单只记录 commit、dirty、产物 sha256、源文件 sha256，用于服务器核对"当前部署的是哪个 commit"。
- **不改 `output.filename`**：加 contenthash 会改变 index.html 引用方式，属于前端工程改造，**不纳入本方案**（如团队另行决定，清单逻辑无需改动）。
- **可选（S8 之后，按需）**：若"服务器上直接改前端产物"频繁，再启用 hidden sourcemap：
```js
// webpack 配置（环境变量开关，默认构建不受影响）
devtool: process.env.KB_SOURCEMAP === '1' ? 'hidden-source-map' : <原值>,
```
  构建后把 `*.map` 移到 `build/maps/<build_id>/`，确保待部署目录中无 `.map`。

### 7.7 部署脚本 `deploy_web.py`（新建；替代当前的手工替换）
```
用法: python scripts/deploy_web.py [--strict] [--no-kb] [--dry-run] [--rollback <ts>]
```
流程（每步失败即中止并回显）：
1. **预检**：
   - `git status --porcelain`（web_subdir）非空 → **醒目告警并记录 diff 到清单**，继续（`--strict` 时中止）；
   - ssh 连通；服务器目标目录存在；
   - **同文件系统检查**：`ssh srv "stat -c %d <目标目录> <目标目录>/.."` 两者设备号一致（临时目录建在目标的**父目录**下，保证 `mv` 为同文件系统 rename，才是原子的）。
2. **构建**：`npm run build`（在 web_subdir；启用 sourcemap 时加 `KB_SOURCEMAP=1`）。
3. **清单**：`python scripts/kb_build_manifest.py` → `build/build_manifest.json`。
4. **上传**：`scp` 到 `<目标父目录>/.osmuwebsite_app.kbtmp.<ts>/`；服务器端 `sha256sum -c` 校验。
5. **属主与权限（MUST）**：`chown ossadm:ossgroup` 临时目录内全部文件，`chmod` 与被替换文件一致（`stat -c %a` 读取原权限，新文件默认 640/750 按原值）。若以 ossadm 登录则 chown 为 no-op；若以 root 登录**必须**执行，否则平台进程（ossadm）读取失败。
6. **备份**：对将被替换的每个文件 `cp -p f f.bak.$(date +%Y%m%d%H%M%S)`（沿用现有命名）；清理超出 `keep_bak` 的旧 bak。
7. **替换**：逐个 `mv -f tmp/f 目标/f`（同文件系统 rename，单文件原子）；删除临时目录。
8. **校验**：服务器端重新计算 sha256 与清单比对；检查属主。
9. **知识同步**（除非 `--no-kb`）：`kb_extract.py web`（增量）→ `kb_pack.py --mode delta --include-manifest` → `kb_sync.py push` → `ssh srv 'kb scan --target ossdesign_web'` → `kb_sync.py pull`。
10. **输出**：build_id、commit、dirty 告警、替换文件列表、服务器 JS 状态（应为 `JS_OK`）、提示"浏览器需强制刷新"（文件名无 hash）。
11. **回滚**：`--rollback <ts>` → 用对应 `.bak.<ts>` 以同样的"复制到临时文件→chown→mv"方式恢复。

### 7.8 （可选）后端 Python 部署脚本 `deploy_py.py`
当前 Python 多为服务器上直接修改；若今后从本地发布 Python：上传→备份 `.bak.<ts>`→替换→提示重启（重启命令需按平台方式 [待确认]，**脚本默认不自动重启**）。kbd 会自动检测变化，无需额外同步动作。

---

## 第 8 章 k8s_simu 接入

### 8.1 定位
- 独立系统（与 OSSDesign 无代码引用），作为第二个 target，**全部流程与 OSSDesign Python 一致，但服务器端源码齐全**。
- 服务器源码是真相（dev 模式热更新）；本地独立 Git 仓库。

### 8.2 服务器端
1. 影子仓库：`shadow/k8s_simu.git`，work-tree=`/usr/k8s_simu/src`，exclude：`node_modules/ .nuxt/ dist/ vendor/ *.bak.* tmp/`。
2. 解析：
   - Python（349 个）：同 5.3（路由规则另行确认：Flask/FastAPI/自定义 [待确认，附录 A-5]）。
   - TS/Vue（93 个）：tree-sitter；抽取 Nuxt 页面（`pages/` 目录即路由）、组件、`$axios`/`@kubernetes/client-node` 调用。
   - Go（84 个）：tree-sitter-go；抽取函数、HTTP handler（`http.HandleFunc`/gin/echo 路由）[待确认]。
3. 生效：Nuxt `hot_reload` 模式不做 NOT_LIVE；**Go 部分一律标记 `live=unknown`，不纳入 NOT_LIVE 判定**（避免误报；回答涉及 Go 逻辑时提示"无法确认是否为运行版本"）。
4. 函数卡：服务器 worker 同样处理（提示词按语言切换）。
5. 依赖环境卡：kwok 集群（docker `simulator-cluster`，:2379/:3131）、`/root/.kwok/clusters/kwok` 配置 → 一张 `module` 卡（domain=k8s_simu），由本地编写。

### 8.3 本地端
- `kb-sync pull` 应用 k8s_simu 变更文件快照 → k8s_simu 仓库 `server-snapshot` worktree（路径映射：服务器 `src/` ↔ 仓库内对应目录 [待确认]）。
- 高价值卡片：调度模拟主流程（创建场景 → 写 kwok/etcd → 调度器执行 → 结果展示）、调度算法/打分插件（若有定制）、导入导出（xlsx、yaml）。
- cards 放 `cards/k8s_simu/`，target=`k8s_simu`，检索时可用 `target` 过滤。

---

## 第 9 章 开发顺序、流程与验收

### 9.1 开发流程约定（所有阶段通用）
1. **每阶段开始**：先执行该阶段的"实测确认"项（附录 A），把结果写入 `docs/env-facts.md`，与本方案冲突时以实测为准并更新本方案。
2. **代码仓库**：`kb-factory` 为唯一代码仓库（含 `kbcore`）；服务器部署 = `scripts/deploy_kb_server.py` 把 `kbcore/`、`bin/`、`config.yaml` 推到服务器（不在服务器上直接改代码）。
3. **分支**：`main`（稳定）/ `dev`；每个任务一个短分支，合并前跑测试。
4. **测试**：
   - 单元测试（pytest）：hash 规则、路由抽取、drift 判定、包导入、检索融合；**测试夹具使用从服务器拉取的真实代码片段（脱敏）**。
   - 黄金样例：`tests/golden/`——固定输入代码 → 期望 symbols/routes/hash，保证本地与服务器结果一致（在服务器上也跑一遍）。
   - 评测集：`eval/evalset.yaml`（第 10 章），每阶段结束跑一次并记录到 `eval/history.md`。
5. **完成定义（DoD）**：功能完成 + 单测通过 + 服务器实跑 + 文档更新 + 阶段验收指标达成。
6. **安全红线**：任何阶段不得写入 `/opt/cloud/envs/`、`/usr/k8s_simu`（只读）；不得改平台 Python 的 site-packages；不得重启业务进程。

### 9.2 阶段总览（v1.1：竖切验证优先）

> 原则：**先用 1 周做一条端到端竖切，实测"轮数 / 耗时 / 正确率"，再决定把人力投向基础设施还是卡片质量。** 避免"建了 30 天基础设施才第一次验证效果"。

| 阶段 | 名称 | 位置 | 依赖 | 预计 |
|---|---|---|---|---|
| S0 | 准备与契约（含评测集 + 基线） | 两端 | — | 1–2 天 |
| **PA** | **Phase A 竖切验证**（见 9.2a） | 两端 | S0 | **5–7 天** |
| — | **决策点 D1**（见 9.2a） | — | PA | 0.5 天 |
| S1 | kbcore 核心补全（调用图、db/ext/redis、TS 解析、黄金样例） | 本地开发，服务器验证 | PA | 3 天 |
| S2 | 服务器守护：影子快照 + 定时扫描 + 检测 + 生效 + HTTP API + 单写者 | 服务器 | S1 | 3–4 天 |
| S3 | MCP 工具补全（kb_flow / kb_trace / kb_env）+ AGENTS.md | 服务器 | S2 | 1–2 天 |
| S4 | 服务器 worker：**精选** fn 卡 + api 卡 | 服务器 | S2 | 2 天 |
| S5 | 本地工厂：同步（tar+manifest）+ 前端源码抽取与对齐 + 部署脚本 | 本地 | S1 | 4 天 |
| S6 | 本地高价值卡片：术语表 + P1/P2 卡片 + 知识包 | 本地 | S5 | 5–7 天 |
| S7 | 服务器检索增强：导入 + 向量 + （可选）重排 + 状态内嵌 + 预检索 | 服务器 | S3,S6 | 3–4 天 |
| S8 | 闭环：drift→本地更新、抽检、问答回流、P3/P4 卡片、（可选）sourcemap | 两端 | S7 | 持续 |
| S9 | k8s_simu 接入 | 两端 | S7 | 4–6 天 |

```
S0 ─ PA ─ D1 ─ S1 ─┬─ S2 ─ S3 ─ S4 ─┐
                   └─ S5 ─ S6 ──────┴─ S7 ─ S8
                                          └─ S9
```
D1 的结论可能调整后续顺序（例如卡片质量是瓶颈时，S6 提前、S4 推后）。

### 9.2a Phase A 竖切验证（MUST 最先做）
**目标**：用最少的代码证明"卡片 + 粗粒度工具"能让 cogagent 达到 ≤ 2 轮、≤ 20 s、正确率 ≥ 80%。

| 任务 | 内容 | 不做什么 |
|---|---|---|
| A1 `kbcore.pyast`（精简版） | 只用标准库：符号 + 路由（装饰器 + application_map + 容器进程）+ 调用边（同文件/显式 import 可解析部分） | 不做 db/ext/redis 抽取、不做 norm_hash |
| A2 `kbcore.ddl` | 解析 27 张表 | — |
| A3 索引 | SQLite FTS5：符号/路由/表 + 手工卡片；jieba 分词（两端一致函数） | 不做向量、不做重排、不做守护进程（**一次性脚本建库**） |
| A4 MCP（4 个工具） | `kb_search`、`kb_get`、`kb_code`、`kb_schema`，直接读 SQLite（只读），无 kbd | 不做状态内嵌、不做 diff |
| A5 手工卡片 10 张 | 由本地商用 Agent 按第 4 章格式编写（见下方清单） | — |
| A6 评测 20 题 | 从 S0 评测集中选与 A5 卡片相关的 14 题 + 无卡片覆盖的 6 题（对照组） | — |

**A5 卡片清单**（全部来自已确认存在的路由/模块；S0 实测后可替换为业务方更常问的主题）：
1. flow：创建项目 `createPrj`
2. flow：创建站点 `createSite`
3. flow：扩容站点 `expandSite`
4. flow：创建 HA 站点 `createHaSite`
5. algorithm：备件分析 `analyzeSpare` / `analyzeSpareString`
6. rule：迁移检查 `checkMigrateSite` / 换盘检查 `checkReplaceDiskSite`
7. flow + 字段映射：导出 LLD `exportLLD`
8. flow：GradsLayout 导入（`import_gradslayout.py`）
9. algorithm：IP 规划（`IpPlanning` / `net_config_mgr.py` 中的分配逻辑）
10. glossary：术语表前 50 词（含 route/site/node/port/product/container 歧义）

**A6 测量项**：每题工具轮数、首 token 时间、完整回答时间、输出 token、答案得分（附录 B-4 判分 + 人工复核）。对照组 6 题用于观察"无卡片、仅结构索引"时的表现。

**决策点 D1**：
| 结果 | 结论 | 后续 |
|---|---|---|
| 有卡题：≤2 轮(P90)、≤20 s(P50)、正确率 ≥ 80% | 架构有效 | 按 S1→S9 推进 |
| 轮数/耗时达标，正确率不足 | **瓶颈是卡片质量** | 优先改进卡片模板与 Skill（S6 提前），S4 推后 |
| 轮数不达标 | 工具设计/提示规则问题 | 先调 AGENTS.md、工具返回格式、预检索（S7 的预检索部分提前） |
| 耗时不达标但轮数达标 | prefill 或输出过长 | 压缩注入内容、限制回答长度、检查推理服务前缀缓存 |
| 对照组表现接近有卡题 | 结构索引已足够 | 降低卡片数量目标，重点做 S2 一致性 |

### 9.3 各阶段任务清单与验收

#### S0 准备与契约
任务：
- [ ] 执行附录 A 全部命令，整理 `docs/env-facts.md`（重点：容器进程路由写法、`sys.path`、DB 封装 API、前端框架与请求封装、cogagent 配置位置与插件钩子、模型服务地址、服务器 CPU/内存、是否能 pip）。
- [ ] 建 `kb-factory` 仓库骨架（3.3），提交本方案到 `docs/`。
- [ ] 定稿第 4 章格式（若实测导致变化，更新 schema 并标注版本）。
- [ ] 服务器创建 `/opt/cloud/manager/tools/cogagent-kb/` 目录结构；创建 venv（验证 3.12）。
- [ ] 本地配置免密 ssh（`ossadm@10.44.228.181`），验证 scp 读写 `inbox/outbox`。
- [ ] **评测集 v0**：按 1.2 业务域，每域 3–5 题，共 30–50 题（格式见 10.1），由业务人员给出标准答案要点。
- [ ] **基线测量**：在不接知识库的情况下，用 cogagent 回答 10 道评测题，记录轮数、耗时、正确率（作为对比基线）。
验收：env-facts 完整；目录与 ssh 就绪；评测集与基线数据入库。

#### S1 kbcore 核心补全（在 PA 精简版基础上）
任务：
- [ ] `kbcore.hashing`：4.2 规则（含 decorator、嵌套函数、norm_hash 范围；py312 / ts1 / go1）+ 黄金样例测试。
- [ ] `kbcore.pyast`：补全 calls（别名解析）、db_access（DDL 表名集合 + 封装 API）、externals、redis_keys、constants。
- [ ] `kbcore.platform_routes`：解析平台 pathHandler.js。
- [ ] `kbcore.tsast`（tree-sitter，供本地前端与 k8s_simu）。
- [ ] `kbcore.select_fn`：按 5.8 公式计算精选 fn 集合 F，输出数量写入 env-facts。
- [ ] CLI：`python -m kbcore.extract py <root> -o structure.json`。
- [ ] 在服务器上用平台 Python 3.12 运行抽取，结果与本地对同一份代码的结果 **hash 完全一致**。
验收：
- 路由自检（5.3）：15 个接口类均有路由；`S−R` 清单已人工确认；容器进程路由识别。
- 调用边解析率 ≥ 70%。
- 27 张表全部解析；db_access 覆盖 ≥ 80% 的表。
- 全量抽取耗时 ≤ 60 s（1153 文件）。
- 黄金样例覆盖：仅改注释 / 仅改局部变量名 / 改嵌套函数名 / 改装饰器路径 四种情况判定正确。

#### S2 服务器守护进程
任务：
- [ ] `kbcore.shadow`（含 .bak 历史导入、变更文件 tar + manifest 导出）。
- [ ] `kbcore.scanner`（定时全量扫描 + 查询时实时校验 + 手动触发）。
- [ ] `kbcore.drift`：三级检测、符号级判定、卡片状态传播、claims 核对、NOT_LIVE（内容基线）、前端产物 hash 检测。
- [ ] `kbcore.store`：4.10 schema、迁移脚本、**单写者 `db_writer`**。
- [ ] `kbcore.search` v1：沿用 PA 的 FTS5，加召回分层与精确匹配。
- [ ] `kbd` HTTP API（5.12）与 CLI `kb`（5.13）；PA 的 MCP 改为经 kbd 访问。
- [ ] 保活：systemd unit 或 cron + recover 脚本；日志轮转。
- [ ] outbox 报告生成（4.8）。
验收：
- 在测试副本目录（**不要直接改业务目录**：把 pyscript 复制到 `/tmp/kbtest/` 并把 target 指向它）中：修改函数逻辑 → 下次扫描（或查询时实时校验）状态 MODIFIED；仅改注释 → COSMETIC 且无任务；移动函数 → MOVED；语法错误 → BROKEN。
- NOT_LIVE：对副本文件 `touch`（内容不变）→ **不**报 NOT_LIVE；`cp -p` 覆盖为不同内容 → 报 NOT_LIVE；模拟进程重启 → 清除。
- 前端：对副本 bundle 改一个字节 → `JS_TAMPERED`。
- 并发：scanner + worker + importer 同时运行 30 分钟，无 `database is locked` 错误。
- `kb search "createSite"` 返回对应路由与卡片，≤ 300 ms。
- `.bak` 历史已导入影子仓库，`git log` 可见按时间排列的提交。

#### S3 MCP 工具补全
任务：
- [ ] 在 PA 的 4 个工具基础上补 `kb_flow`、`kb_trace`、`kb_env`（6.2）。
- [ ] cogagent 配置 MCP（6.1），部署 AGENTS.md 规则（6.3）。
- [ ] 跑评测集，对比 S0 基线与 PA 结果。
验收：
- cogagent 能调用全部工具，返回 ≤ 6000 字符。
- 评测集工具轮数（P90）≤ 2。

#### S4 服务器 worker（精选卡）
任务：
- [ ] `kbcore.worker`：任务队列、并发调用、提示词模板（附录 B-1/B-2）、输出校验、内容寻址缓存、拓扑序生成、在线优先降并发。
- [ ] 按精选集合 F 生成 fn 卡（预计 600–1200 张），再跑 api 卡、external 卡、module 卡、qa_gen。
- [ ] 卡片入 FTS 索引；验证 fn 卡默认不进入 `kb_search` 召回。
- [ ] 抽查 30 张（本地 kb-review），记录正确率。
验收：
- F 覆盖率 ≥ 95%；api 卡覆盖全部路由；首次批量 ≤ 90 分钟。
- 抽查正确率 ≥ 80%（副作用描述错误计为错误）。
- 修改一个函数后 20 分钟内其 fn 卡更新完成。
- 评测集 recall@5 不低于 S3（证明低层卡未稀释召回）。

#### S5 本地工厂
任务：
- [ ] `kb_sync.py`（pull：tar+manifest 应用到 server-snapshot worktree；push；diff-summary）。
- [ ] 前端：确认框架/请求封装/路由表；`kb_extract.py web`（**直接解析本地源码**）；`kb_align_api.py`；`web_path_overrides.yaml`。
- [ ] `kb_build_manifest.py`（不含 sourcemap）、`deploy_web.py`（同文件系统检查、chown、原子替换、回滚）。
- [ ] `kb_queue.py`、`kb_card_lint.py`、`kb_pack.py`、`kb_sandbox.py`。
- [ ] Skills：kb-sync、kb-extract、kb-release（先做这 3 个），在 Claude Code 与 OpenCode 中各验证一次能被发现与执行。
- [ ] `deploy_kb_server.py`（推送 kbcore 到服务器并重启 kbd）。
验收：
- `kb-sync pull` 后 `git diff main..server-snapshot` 正确显示服务器未提交改动；manifest 汇总 hash 校验通过。
- 前后端对齐率 ≥ 90%，unmatched 有清单。
- `deploy_web.py --dry-run` 与真实部署各成功一次；部署后文件属主为 `ossadm:ossgroup`、服务器状态 `JS_OK`；回滚可用。
- 两种 Agent 均能运行 3 个 Skill。

#### S6 本地高价值卡片
任务：
- [ ] Skills：kb-glossary、kb-card-flow、kb-card-algorithm（含 sandbox 算例）。
- [ ] 术语表（P0）。
- [ ] P1 全部、P2 全部卡片（约 30–40 张）。
- [ ] `kb-release` 打首个全量知识包并推送。
验收：
- 每张卡 lint 通过；algorithm 卡均有实际运行算例（或说明原因）。
- 评测集中 P1/P2 相关题目由人工判定卡片内容正确率 ≥ 90%。

#### S7 服务器检索增强
任务：
- [ ] `kbcore.importer`（5.9）+ 卡片选择规则（5.11）。
- [ ] 向量（默认 bge-small-zh-v1.5，实测后可换 bge-m3）+ RRF + （可选）重排；术语表扩展、歧义处理、词典热加载。
- [ ] `kb_search` 状态内嵌与 diff 附带；`kb_flow/kb_get` 切换为卡片优先。
- [ ] 预检索插件（6.4）或 broker 注入退化方案。
- [ ] 跑评测集。
验收（**核心里程碑**）：
- recall@5 ≥ 85%；答案正确率 ≥ 85%；工具轮数 ≤ 2（P90）；首 token ≤ 6 s（P50）/ ≤ 10 s（P95）；完整回答 ≤ 20 s（P50）/ ≤ 35 s（P95）。
- 人为修改一个被算法卡引用的常量 → 回答中体现新值并声明"卡片待更新"。

#### S8 闭环与扩充（持续）
- [ ] Skills：kb-update-from-drift、kb-review。
- [ ] 每日：服务器生成报告；本地按需 `kb-sync pull` + 更新。
- [ ] 每周：kb-review 抽检 20 张；评测集回归。
- [ ] 问答回流：`kb_feedback` → qa 卡；qa_cache 命中（相似度阈值 0.92）。
- [ ] P3/P4 卡片逐步补齐；cogagent 侧 2 个 Skill（6.5）。
- [ ] 评测集扩充到 100 题。
- [ ] （可选）前端 hidden sourcemap 与产物 diff 定位（7.6、5.6），仅当服务器上直接改前端产物频繁时启用。

#### S9 k8s_simu 接入
- [ ] 附录 A-5 实测（Python/Go 角色、路由方式、运行方式）。
- [ ] 服务器：target 配置、影子仓库、tree-sitter 解析 TS/Vue/Go、函数卡生成。
- [ ] 本地：变更文件快照 → k8s_simu 仓库 server-snapshot；主流程卡与算法卡。
- [ ] 评测集增加 k8s_simu 题目 15–20 道。
验收：同 S7 指标（k8s_simu 子集）。

### 9.4 交付物清单
| 交付物 | 位置 |
|---|---|
| kb-factory 仓库（kbcore、scripts、skills、cards、tests、eval、docs） | 本地 Git |
| 服务器安装目录 `/opt/cloud/manager/tools/cogagent-kb` | 服务器 |
| cogagent 配置片段（MCP、AGENTS.md、插件） | 服务器 cogagent 配置目录 |
| 前端 webpack sourcemap 开关（小改动） | ossdesign 仓库 |
| 运维手册 `docs/runbook.md`（启动、停止、重建索引、导入、回滚、故障排查） | kb-factory |
| 评测报告 `eval/history.md` | kb-factory |

---

## 第 10 章 评测、运维、安全、风险

### 10.1 评测集格式（`eval/evalset.yaml`）
```yaml
- id: Q001
  domain: analyze
  question: 备件分析里备件数量是怎么计算的？
  expected_cards: [alg.ossdesign.spare_analysis]        # 用于 recall@k
  answer_points:                                        # 判分要点（全部命中=正确，部分=半对）
    - 按 xxx 比例计算
    - 向上取整
    - 最小值 1
  must_cite: ["spare.py"]
- id: Q002
  domain: project_site
  question: 创建站点时后台会写哪些表？
  expected_cards: [flow.ossdesign.create_site]
  answer_points: [t_site_info, t_xxx]
```
- **检索评测**：`kb eval eval/evalset.yaml` → recall@5、MRR（不调模型，秒级）。
- **端到端评测**：脚本通过 cogagent（或 broker 接口）逐题提问，记录工具轮数、总耗时、输出 token；答案由本地商用模型按 answer_points 判分（判分提示词附录 B-4），人工复核 20%。

### 10.2 运维
| 事项 | 做法 |
|---|---|
| 启停 | `systemctl {start,stop,restart} cogagent-kb`（或 `bin/kbctl start|stop`） |
| 健康检查 | `curl 127.0.0.1:18790/health`；cron 每 5 分钟检查，失败自动拉起 |
| 备份 | 每日由 kbd 调用 Python `sqlite3.Connection.backup()` 写 `data/kb.sqlite.bak.<date>`（**不依赖 sqlite3 命令行**），保留 7 份；影子仓库本身即历史 |
| 重建 | `kb rebuild-index`（索引损坏）；`kb scan --full`（状态不可信） |
| 日志 | `logs/kbd.log`（按天轮转，保留 14 天）；worker 失败任务 `kb jobs --failed` |
| 资源 | 监控 kbd RSS（目标 < 3GB 含嵌入模型）、worker 并发对 cogagent 在线推理的影响（在线问答优先：worker 在检测到 cogagent 活跃会话时并发降为 4） |
| 版本 | `kb status` 显示 kbcore 版本、最新 pack、schema_version |

### 10.3 安全
- 全部组件**只读**业务目录；kbd 以 `ossadm` 运行（与业务同用户，保证可读），**不以 root 运行**。
- HTTP API 只绑定 `127.0.0.1`；MCP 只读，无写操作工具。
- 卡片与 symbols.source_text 中执行脱敏（`security.redact_patterns`）；`authconf/ssl/cipher` 目录只记录 hash。
- 知识包传输走 ssh；包内含 SHA256SUMS。
- 前端 sourcemap 只存在于知识包与 `cache/`，**不进入 webapps**。
- hud_proxy 约束保持：知识库不读取 `/srv/cogagent` 凭据目录（MCP 配置除外）。

### 10.4 风险与对策
| 风险 | 影响 | 对策 |
|---|---|---|
| 本地/服务器 Python 版本不一致导致 hash 全变 | 卡片全部误报 stale | hash 前缀 + 启动断言 + 黄金样例双端测试 |
| 容器进程/DB 封装写法特殊，抽取不全 | 流程卡断链 | S0 实测；路由自检比对 grep；未解析调用保留候选 |
| 前端 URL 拼接复杂，对齐率低 | 页面→接口链路缺失 | overrides 文件人工补；kb-extract 中由商用 Agent 辅助判定 |
| 服务器无外网，依赖/模型无法安装 | 向量检索不可用 | 离线 wheel；降级为纯 FTS5（已能覆盖大部分精确问题） |
| ARM CPU 嵌入过慢 | 检索延迟高 | 换小模型；查询向量缓存；关闭重排 |
| worker 占用推理资源影响在线问答 | 用户等待 | 在线优先策略；夜间跑批 |
| 开发人员频繁临时改代码 | 卡片抖动 | 定时扫描（中间态记 BROKEN 不建任务）+ 内容寻址缓存（改回即复用）+ 仅精选 fn 卡自动重写 |
| 服务器模型函数卡质量不足 | 错误信息 | 本地抽检 + 本地卡优先 + 回答带出处 |
| cogagent 改造后插件钩子不同 | 预检索不可用 | broker 注入退化方案 |
| `.bak` 文件堆积 | 扫描噪声 | 统一排除；deploy 脚本保留最近 N 份 |
| 平台升级导致版本目录变化 | 路径失效 | 一律使用软链 `/opt/cloud/manager/apps/OSSDesignService` |

---

## 附录 A 实测确认命令（S0 执行，只读）

**A-1 容器进程路由与主进程框架**
```bash
P=/opt/cloud/manager/apps/OSSDesignService/pyscript
grep -n "container/importsolution\|rest\.\(get\|post\|put\|delete\)\|add_handler\|Application(" $P/ossdesign_container/start_ossdiy_container.py | head -30
sed -n '60,200p' $P/ossdiyservice.py           # 启动、sys.path、application_map 使用方式
grep -rn "@rest\.\(get\|post\|put\|delete\|patch\)" $P --include=*.py | wc -l
grep -rhoE "@rest\.(get|post|put|delete|patch)" $P --include=*.py | sort | uniq -c
python3 - <<'EOF'
import re,glob
s=set()
for f in glob.glob('/opt/cloud/manager/apps/OSSDesignService/pyscript/**/*.py',recursive=True):
    s|=set(re.findall(r"['\"](/rest/ossdesign/v1/designer/[^'\"]+)['\"]",open(f,errors='ignore').read()))
print(len(s))
EOF
```
**A-2 DB / redis / 外部调用封装**
```bash
sed -n '1,80p' $P/com_utils/db_helper/dbhelper.py
sed -n '1,60p' $P/com_utils/db_engine/db_engine.py
ls $P/ossdesign_mapper | head; sed -n '1,60p' $(ls $P/ossdesign_mapper/*.py | head -1)
sed -n '1,60p' $P/toolkit/redis_helper/connect.py
cat /opt/cloud/manager/apps/OSSDesignService/etc/conf/restclient.json | head -50
head -50 /opt/cloud/manager/apps/OSSDesignService/bin/create_db_file.sql
```
**A-3 资源与安装能力**
```bash
nproc; free -g; df -h /opt/cloud
/opt/cloud/rtsp/python-27.19.355-euler_arm64/bin/python -c "import venv, ensurepip, sqlite3; print(sqlite3.sqlite_version)"
/opt/cloud/rtsp/python-27.19.355-euler_arm64/bin/python -c "import sqlite3; c=sqlite3.connect(':memory:'); c.execute('create virtual table t using fts5(x)'); print('fts5 ok')"
which git rsync; git --version
curl -sI https://pypi.org/simple/ | head -1      # 是否可访问外网 pip
```
**A-4 前端（本地执行）**
```bash
cat <web_subdir>/package.json            # 框架与构建配置
ls <web_subdir>; ls <web_subdir>/build <web_subdir>/config 2>/dev/null
grep -rnE "axios|fetch\(|\\\$http|ajax\(" <web_subdir>/src | head -20   # 请求封装
grep -rnE "routes\s*[:=]" <web_subdir>/src | head                       # 前端路由表
```
**A-5 k8s_simu**
```bash
ls /usr/k8s_simu/src; ls /usr/k8s_simu/src/* | head -50
find /usr/k8s_simu/src -name '*.go' -path '*main*' | head; find /usr/k8s_simu/src -name 'go.mod'
grep -rlE "Flask|FastAPI|tornado|django" /usr/k8s_simu/src --include=*.py | head
ps -eo pid,lstart,args | grep -E "k8s_simu|simulator|scheduler" | grep -v grep
docker exec simulator-cluster ps aux 2>/dev/null | head
```
**A-6 cogagent / 模型服务**
```bash
ls /opt/cloud/manager/tools/cogagent-hud/profiles
ps -eo pid,args | grep -E "[c]ogagent" 
ls -la /srv/cogagent/users | head; ls /srv/cogagent/users/*/ 2>/dev/null | head
find /srv/cogagent /var/lib/cogagent-hud -maxdepth 4 -name "opencode.json*" -o -maxdepth 4 -name "AGENTS.md" 2>/dev/null | head
grep -nE "def .*(chat|message|prompt|forward)|/agent/" /opt/cloud/manager/tools/cogagent-hud/broker.py | head -30
ss -lntp | grep -E "python|vllm|sglang|ollama|llama" | head      # 模型服务端口
```

---

## 附录 B 提示词模板

### B-1 服务器 fn 卡（自研模型）
```
你是代码文档工程师。根据给定 Python 函数源码，输出一张“函数卡”。只写代码能证实的内容，禁止臆测。
【函数】{qualname}  文件: {path}:{line_start}-{line_end}
【源码】
{source}
【它直接调用的函数（一行摘要）】
{callee_summaries}
【静态分析已知事实】读写表: {tables}；外部接口: {externals}；redis: {redis}
【输出格式】严格输出以下 Markdown，不要多余文字，总长 ≤ 200 字：
## 功能
（1-2 句）
## 输入
- 参数: 含义
## 输出
（返回值含义；无则写“无”）
## 副作用
（写哪些表/调用哪些外部接口/写文件/发通知；无则写“无”）
## 异常分支
（主要 raise / 错误返回条件；无则写“无”）
```
frontmatter 由程序生成（anchors、ast_hash、producer=server-self 等），模型只产正文。

### B-2 服务器 api 卡
```
根据接口路由信息与处理函数源码，写“接口卡”。≤ 400 字。
【路由】{method} {path}（进程 {process}，opts {opts}）
【处理函数源码】{handler_source}
【被调用函数的函数卡摘要】{fn_summaries}
【前端调用位置】{web_calls}
输出小节：## 用途 ## 参数（来源 body/query/path，字段与含义） ## 返回 ## 处理步骤（3-8 步，标函数名） ## 涉及表与外部接口 ## 错误情况
```

### B-3 change 卡（diff 过渡说明）
```
以下是函数 {qualname} 的代码变更（unified diff）以及变更前的卡片。用 ≤ 150 字说明“行为上改变了什么”（不是代码改了什么），若只是重构无行为变化，写“无行为变化”。
【旧卡片】{old_card}
【diff】{diff}
```

### B-4 评测判分（本地商用模型）
```
给定问题、标准答案要点与待评答案，逐条判断要点是否被正确覆盖（覆盖/部分/未覆盖/矛盾）。
输出 JSON：{"points":[{"point":"...","verdict":"covered|partial|missing|contradict"}],"score":0~1,"hallucination":true/false,"note":"..."}
```

### B-5 本地 flow/algorithm 卡：见 Skill 正文（7.4 ④⑤），模板文件放 `.claude/skills/kb-card-*/reference.md`。

---

## 附录 C 术语
| 术语 | 含义 |
|---|---|
| 卡片（card） | 知识库的最小知识单元，Markdown + frontmatter |
| 锚点（anchor） | 卡片依据的代码符号/路由/表及其 hash |
| claims | 卡片中可机械核对的事实（常量、表、配置） |
| 影子仓库（shadow） | 服务器上为非 Git 目录建立的 bare 仓库，记录未提交改动的历史 |
| server-snapshot | 本地仓库中保存服务器真实代码的分支 |
| 知识包（kbpack） | 本地 → 服务器的卡片与清单打包文件 |
| drift | 知识库与环境代码不一致 |
| NOT_LIVE | 磁盘代码已改、运行进程未加载 |
| 预检索（prefetch） | 模型首轮前自动检索并注入上下文 |
| kbd | 服务器常驻知识库守护进程 |
| kb-mcp | 提供 kb_* 工具给 cogagent 的 MCP 服务 |

---
*文档结束。开发从第 9 章 S0 开始；遇到 [待确认] 先执行附录 A 对应命令。*
