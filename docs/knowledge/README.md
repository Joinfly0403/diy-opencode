# docs/knowledge —— 模块检索卡

给 **AI agent** 用的代码仓检索层：把 110 万行 TS 切成"功能模块"颗粒的卡片，每张卡用**代码坐标**锚定一处真实实现，并写清职责、边界、调用链、不变式、扩展点和坑。

人只需要看 `index.md`（能力树 + 索引）就能知道仓库长什么样；要干活时把卡片喂给 agent，agent 按坐标定点读文件，不要整仓 grep。

## 目录结构

| 路径 | 内容 | 是否入库 |
| --- | --- | --- |
| `index.md` | 生成物：能力树、按目录/事件/配置键/端点/符号的索引、覆盖率 | 入库（生成） |
| `modules/<layer>/<name>.md` | 卡片正文（本目录的主体） | 入库 |
| `_generated/inventory.json` | 每个包/服务的文件数、LOC、子目录分布 | 不入库 |
| `_generated/symbols.json` | 每个文件导出的符号、符号 → 文件反查 | 不入库 |
| `_generated/coverage.md` | 覆盖率报告 + 未归属文件清单 | 不入库 |

## 怎么用它检索

1. 打开 `index.md`：先看能力树（L0 骨架 / L1 核心能力 / L2 能力面）。
2. 用三种索引定位：按目录（改了哪个目录）、按事件名、按配置键、按 HTTP 端点、按导出符号。
3. 读 1–3 张卡的"职责 / 边界 / 代码坐标"，然后只读坐标里列的文件。
4. 卡里没有的内容，再回落到 grep / 类型跳转。

## 卡片格式

frontmatter（机器可读，脚本校验）：

```yaml
---
id: core/session-execution        # 必须等于 modules/ 下的相对路径
title: 会话执行                    # 中文标题
level: L1                        # L0 骨架 / L1 核心能力 / L2 能力面
layer: core                      # id 前缀
status: stable                   # stable / draft
paths:                           # 归属声明：目录、文件或 glob；覆盖率与漂移检测的依据
  - packages/core/src/session
symbols:                         # 锚点：这些名字必须仍由 paths 内的文件 export
  - Session
entry_cli:    [run, serve]       # 可选的入口坐标
entry_http:   ["POST /api/..."]
events:       [session.inbox.enqueued]
config_keys:  [experimental.*]
tables:       [session_inbox]
tests:        [packages/core/test/session]
depends_on:   [core/location-instance]
related:      [core/tool-registry]
keywords:     [会话, inbox, steer]
source_hash:  <build --bless 自动写入>
---
```

正文固定小节（顺序不变）：`职责 / 边界 / 入口与调用链 / 数据与状态 / 关键不变式 / 扩展点 / 常见改法与坑 / 代码坐标`。

写作纪律：
- 每个断言都要有代码依据（注释、AGENTS.md、类型定义）；不确定就写"（待确认）"。
- AGENTS.md 里的硬约束要抄进"关键不变式"——那是这张卡最值钱的部分。
- 不贴大段代码，只给"文件 → 内容"的坐标表。

## 命令

```bash
bun script/knowledge/build.ts            # 生成 inventory/symbols/index/coverage 并校验全部卡片
bun script/knowledge/build.ts --bless    # 复核完卡片后重新盖章 source_hash
node script/knowledge/build.ts           # 没装 bun 时用 node（Node >= 22.6，原生类型剥离）
node script/knowledge/check-card.ts <id> # 单卡自检：paths 命中、符号锚点、引用完整
```

`build.ts` 在有错误（锚点失效、引用缺失、路径无命中、hash 漂移）时以非零码退出，可直接接 CI。

## 漂移（文档腐烂）怎么处理

- 每张卡在 frontmatter 里存 `source_hash`＝其 `paths` 命中的全部文件的哈希。
- 代码一改，`build.ts` 会把该卡列为 stale（错误退出），提示"复核后用 --bless 盖章"。
- 所以：**改代码 → 跑 build → 看 stale 列表 → 只改受影响的卡 → --bless**。verify 保证"锚点还在、文件都有人认领"，不保证"话说得对"，语义仍靠复核。

## 机器事实（_generated）

- `inventory.json`：38 个包/服务的文件数、LOC、子目录分布（判断"这块多大、该不该单独成卡"）。
- `symbols.json`：导出符号索引，卡片的 symbols 锚点就是拿它校验的。
- `coverage.md`：未归属任何卡片的源文件，按目录聚合——新代码没写卡时会在这里冒出来。

覆盖率只统计**产品源码**：`packages/**/src/**`、`services/**/src/**`、`sdks/**/src/**` 下的 `.ts/.tsx`，排除 `*.test.ts`、`*.gen.ts`、`*.d.ts` 与 `test/ tests/ e2e/ component-tests/ perf/ script/ dev/ generated/ fixtures/` 这类构建与测试目录。所以"覆盖率不到 100%"通常意味着某块 `src/` 还没人认领，而不是脚本没算进去。

## 加一张新卡

1. 在 `modules/<layer>/` 下建 `<name>.md`，frontmatter 的 `id` 与路径一致。
2. `node script/knowledge/check-card.ts <id>` 自检。
3. `bun script/knowledge/build.ts --bless` 盖章并重建索引。
4. 提交时把卡片与 `index.md` 一起带上。
