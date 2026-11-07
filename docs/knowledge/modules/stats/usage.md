---
id: stats/usage
title: 使用统计与成本归属（stats）
level: L1
layer: stats
status: stable
paths:
  - packages/stats/core/src
  - packages/stats/core/migrations
  - packages/stats/server/src
  - packages/stats/app/src
  - packages/stats/README.md
  - packages/stats/AGENTS.md
  - infra/stats.ts
symbols:
  - StatSync
  - Database
  - AppConfig
  - Runtime
  - R2Sql
  - Inference
  - ModelStat
  - ProviderStat
  - GeoStat
  - RetentionStat
  - Stat
  - StatsHome
  - syncStats
  - planStatsSync
  - syncStatPeriod
  - syncRetentionCohort
  - deterministicFailureAsResult
  - StatsSyncPlan
  - buildPeriodStatsQueries
  - buildPeriodRetentionQuery
  - hiddenStatModels
  - statPeriods
  - retentionPeriods
  - periodKeyFor
  - isoWeekId
  - normalizeTier
  - rankBy
  - chunks
  - modelStat
  - providerStat
  - geoStat
  - modelRetention
  - getStatsHomeData
  - getStatsLabData
  - getStatsModelData
  - setStatsPageCacheHeaders
  - runStatsEffect
  - StatsSyncWorkflow
  - HISTORY_SCHEDULE
  - instanceId
  - skipReason
  - recentInstanceIds
events:
  - generation.completed
config_keys:
  - DATABASE_URL
  - PUBLIC_URL
  - StatsHiddenModels
  - StatsSyncConfig.dataset
tables:
  - model_stat
  - provider_stat
  - geo_stat
  - model_retention
tests:
  - packages/stats/core/src/stat-sync.test.ts
  - packages/stats/core/src/sync-range.test.ts
  - packages/stats/core/src/domain/stat.test.ts
  - packages/stats/core/src/domain/inference.test.ts
  - packages/stats/server/src/cron.test.ts
  - packages/stats/server/src/schedule.test.ts
depends_on:
  - contracts/events-db
related:
  - infra/misc-packages
  - services/docs-site
  - desktop/main
keywords:
  - 使用统计
  - 成本
  - token
  - 聚合
  - R2 SQL
  - PlanetScale
  - Workflow
  - 留存
  - 排行榜
  - 灰度
source_hash: 29b2688f4007126b12ee5725bfa50f398308bc83
---

## 职责

把生产事件湖里的用量聚合成公开统计站点数据：**core（查询/聚合/写库）+ server（定时与 Workflow）+ app（SolidStart 站点）**。

| 子包 | 内容 |
| --- | --- |
| `core` | Effect 服务与配置、Drizzle MySQL schema/迁移、R2 SQL 查询构建（`domain/inference.ts`）、同步逻辑（`stat-sync.ts`/`sync-range.ts`）、读模型（`domain/home.ts` 等） |
| `server` | `StatsSyncWorkflow`（Cloudflare Workflow，一个 step 一个周期）、`StatsSyncCron`（每小时 + 每日历史）、本地 `sync.ts` |
| `app` | SolidStart 站点（`/data` 前缀），排行榜/市场/地理/留存页面 + JSON/Markdown 变体 |

部署由 `infra/stats.ts` 组装：PlanetScale 分支与链接（`StatsDatabase`）、SolidStart Worker 与 `/data*`、`/<locale>/data*` 路由、`R2Sql`/`StatsSyncConfig`/`StatsHiddenModels` 链接、Workflow 与 Cron。

## 边界

- **不采集**：数据源是共享生产湖（`Resource.R2Sql`：bucket `platform-<stage>-lake`、namespace `inference`、table `generation`）。写入方是云端推理网关，**不在本模块**（待确认具体目录/服务）。
- **不存原始事件**：只落聚合行（`model_stat`/`provider_stat`/`geo_stat`/`model_retention`），不保留逐请求明细。
- **app 不读湖**：站点只读 MySQL；SQL 只出现在 `core`。
- **不做计费**：成本是事件里带回来的 microcents 聚合（`total_cost_microcents` 等），本模块不做定价与账单（计费属 console）。
- 与 `services/site`（官网/文档）无关，只是共用域名路由。

## 入口与调用链

1. **事件源**：湖里 `event_type = 'generation.completed'`、`source IN ('inference','inference-legacy')`（以 `LIVE_SOURCE_START = 2026-08-11T10:57:48.186Z` 为界互斥，避免历史回填与实时流重复计数）、`product IN ('go','go-plus')`、`attempts > 0`（只统计真正路由到上游的请求）。
2. **plan**：`planStatsSync(now, { history })` 先算 `syncRange` 的时间窗，再一次性固定 `CatalogSnapshot`（模型目录），保证后续每个 step 的 model→provider 归一化一致；plan 跨 Workflow step 边界，所以全是纯 JSON（`StatsSyncPlan`）。
3. **每 (grain, period) 一个 step**：`buildPeriodStatsQueries` 生成两条 R2 SQL（`usage` 与 `geo` 分开，避免把 distinct 用户/会话的高成本聚合与高基数地理维度混在一条）→ `syncStatPeriod` 归一化/聚合 → 写 `model_stat`/`provider_stat`/`geo_stat`（`chunks` 分块，`UPSERT_CHUNK_SIZE = 500`；先删本 period 再插）。`rankBy`/`rankRowsWithMarketShare` 在**同一 (grain, period_key)** 内排名。
4. **每留存 cohort 一个 step**：`buildPeriodRetentionQuery` 用"活动周 + 回访周"定义 cohort；用户当周请求 ≥10 且主模型占比 ≥80% 才算 eligible（`primary_models`），回访周出现过即 retained；写 `model_retention`。
5. **调度**：`StatsSyncCron` 在 `5 * * * *`（当前 ISO 周 + 最近一个完整 cohort，instance id `stats-hourly-YYYY-MM-DDTHH`）与 `20 3 * * *`（56 天展示窗口其余部分，`stats-history-YYYY-MM-DD`）触发；触发前检查本槽位 id 与同类最近 id（小时看前 5 个、历史看前 2 天），有 queued/running/waiting/paused 就跳过。
6. **展示**：`app/src/lib/page-data.ts` 调 `getStatsHomeData`/`getStatsLabData`/`getStatsModelData` → 页面；`setStatsPageCacheHeaders` 打 `public, max-age=60, s-maxage=300, must-revalidate` 并补 `Vary`（`Accept`/`Accept-Language`/`Cookie`/`LOCALE_HEADER`）。

## 数据与状态

- **R2 SQL（源）**：单次最多 10,000 行、请求超时 10 分钟；`queryR2SqlPages` 做游标分页；`R2SqlQueryError` 带 `requestId/status/code/rowLimit`，`isDeterministicR2SqlError`（400/401/403/超行数）决定"不重试"。
- **MySQL（PlanetScale，`DATABASE_URL` 或 `Resource.StatsDatabase.url`）**：
  - `model_stat` / `provider_stat` / `geo_stat`：共同维度 `grain`(day|week)、`period_key`、`dataset`、`tier`、`client`、`source` + 指标列（sessions/requests/unique_users/各类 token/三类 cost_microcents/延迟 p50/p95/ttfb/输出 TPS/success·error·sample）+ `rank_by_*`；
  - `model_retention`：`cohort_date` + `dataset`/`tier` + provider/model + `eligible_users`/`retained_users`；
  - 排行口径由索引 `idx_leaderboard_tokens`/`idx_provider_leaderboard_tokens`/`idx_country_map_tokens` 等支撑。
- **时间窗**（`sync-range.ts`）：数据从 2026-05-28（首个完整日）起；增量只重算当前 ISO 周（含 2h lookback）与最近留存 cohort（16 天回看）；历史 pass 覆盖 56 天展示窗口的其余部分，两者周期不重叠，因此可并行。
- **dataset/tier**：`StatsSyncConfig.dataset = "zen"`；tier 归一为 `Go`/`Free`（`DATA_SITE_TIERS`），`normalizeTier` 兜住大小写差异。
- **缓存**：页面 60s 浏览器 / 300s 共享；Worker 无自定义域，响应绕过 Cloudflare 缓存直达浏览器（`infra/stats.ts` 注释）。

## 关键不变式

- **事件表 append-only ⇒ 已完成周期不再变**：所以增量不回补（历史 pass 负责归一化变化与退役维度清理）。
- **一个 step 只写一个 (grain, period_key) 或一个 cohort**：排序、upsert、delete 都必须留在这个 scope 内，否则无法单独重试；失败一个 period 不阻断其它，但整个 run 以报错结束。
- **确定性失败不重试**：400/401/403 与超行数重试只是重复花 R2 SQL 的钱；只有非确定性错误才允许 Workflow 的 2 次指数退避。
- **未知/未路由请求不计**：`attempts > 0` 是防止"任何被请求过的模型名都变成公开页面"的关键条件。
- **隐藏与排除在 SQL 层**：`hiddenStatModels()`（来自 `StatsHiddenModels` 秘密）与 `EXCLUDED_MODELS`/`STEALTH_MODELS` 在查询里过滤，不要在页面/读模型里补。
- **模型/厂商归一化唯一入口**：`statModel`/`statProvider`（别名、作者规则、名称长度上限），否则同一模型会裂成多行。
- **调度双写**：`server/src/schedule.ts` 的 cron 表达式与 `infra/stats.ts` 的 `schedules` 必须一致（注释已标注）。
- **同 URL 多表现**：HTML/JSON/Markdown 靠 `Accept` 区分，改缓存头必须保留 `Vary`。

## 扩展点

- **新维度/新指标**：`domain/inference.ts` 加 query family → 对应 `domain/<x>.ts` 的 aggregate + repo（`rowsFromAggregates`）→ `database/schema.ts` 加列 + drizzle 迁移 → `stat-sync.ts` 接线 → 页面/读模型。
- **新周期粒度**：`StatGrain` + `statPeriods`/`periodKeyFor`，注意所有唯一索引都含 `grain`+`period_key`。
- **新展示页**：`app/src/routes/` 加路由 + `lib/page-data.ts` 的 loader（复用 `getStats*`），并决定是否进 sitemap/compare 目录。
- **手工触发一次同步**：`bunx wrangler workflows trigger <name> '{"history":true}' --id stats-history-YYYY-MM-DD`（id 要沿用 Cron 约定，否则同类定时任务不会避让）；本地单次跑：`bun sst shell --stage=<stage> -- bun run --cwd packages/stats/server sync`。

## 常见改法与坑

- 把 `usage` 与 `geo` 合成一条查询会同时放大 distinct 用户与地理基数，R2 SQL 费用与 10k 行上限都容易炸。
- `upsert` 的 `unique_users` 在旧 stage 可能缺列：`isMissingUniqueUsersColumn`/`omitUniqueUsers` 是兼容路径，别直接删。
- 本地开发：`bun dev:stats`（仓库根）起站点；`sst dev` 另提供 `StatsSync` 命令。
- 灰度/预估：README 说一小时 run 约 15–25 分钟、历史 2–3.5 小时，是"部署后实测前"的估计，不要当 SLA。
- 单位是 microcents（不是 cents）：页面/文档里换算是 `/1e8`（待确认展示层具体换算位置，见 `app/src/lib/format.ts`）。
- 改 `infra/stats.ts` 的路由前缀（`/data`、`/<locale>/data`）会影响站点唯一入口——Worker 没有自定义域。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/stats/core/src/domain/inference.ts` | R2 SQL 生成：usage/geo/retention 三类查询与源表过滤 |
| `packages/stats/core/src/stat-sync.ts` | plan / 单周期 / 单 cohort 同步与错误分类 |
| `packages/stats/core/src/sync-range.ts` | 增量与历史时间窗 |
| `packages/stats/core/src/r2-sql.ts` | R2 SQL 客户端、分页、错误模型 |
| `packages/stats/core/src/database/schema.ts`、`migrations/` | MySQL 表与迁移 |
| `packages/stats/core/src/domain/stat.ts` | 周期键、归一化、分块 upsert、排名、市场份额 |
| `packages/stats/core/src/domain/home.ts` | 站点读模型（home/lab/model/compare） |
| `packages/stats/core/src/domain/model-normalization.ts` | 模型别名/作者规则/排除表 |
| `packages/stats/server/src/workflow.ts` | `StatsSyncWorkflow` step 编排 |
| `packages/stats/server/src/cron.ts`、`schedule.ts` | 调度、instance id、避让判断 |
| `packages/stats/app/src/lib/page-data.ts`、`routes/stats-cache.ts` | 页面 loader 与缓存头 |
| `infra/stats.ts` | PlanetScale、R2 SQL、Workflow/Cron、站点路由 |
