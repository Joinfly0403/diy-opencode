---
id: services/docs-site
title: 官网与文档站（services/site）
level: L2
layer: services
status: stable
paths:
  - services/site/src
  - services/site/script
  - services/site/DESIGN.md
symbols:
  - mediaUrl
  - sitemapFiles
  - sitemapExclusions
  - track
  - docsRoute
  - docsUrl
  - docsBase
related:
  - contracts/httpapi-protocol
keywords:
  - 文档
  - 官网
  - opencode.ai
  - docs
  - llms.txt
  - 站点
  - cloudflare worker
source_hash: c0c71114d0dd9a214c86123d6425997b12d20898
---

## 职责

`opencode.ai` 站点与 V2 文档（`/docs`）。对 agent 来说它最重要的价值是：**这里是 opencode 面向用户的官方说明**（配置、工具、CLI、console 等），查"某个功能官方怎么描述、有哪些配置项"时比自己猜更可靠。

## 边界

- 独立 Cloudflare Worker 部署（`cloudflare.config.ts`、`script/build.ts`）：**不要在这里加 Wrangler 或 SST**。
- 与产品代码无运行时依赖：站点不改核心行为，只读生成的 `/config.json`、`/openapi.json`、`/tui.json`。
- 重型媒体（视频/音频/zip/3D）不是 Worker 资源，用 `mediaUrl()` 指向 `/files` 桶。

## 入口与调用链

- 公开页面在 `src/routes/*`（含 `[...404]`、`ide`、`desktop`、`devices`、`press`、`changelog`）。
- V2 文档是自包含子应用 `src/docs/`（有自己的 AGENTS.md、样式、构建产物 `/docs/_build`），路由入口 `docsRoute(url, accept, slugs)`。
- 机器可读文件：`/sitemap.xml`（索引 `sitemapFiles`）、`/sitemap-pages.xml`（自动列全部页面路由，排除项写在 `sitemapExclusions`）、`/llms.txt`、`/llms-full.txt`、各页面的 `.md` 版本。
- 分析：`src/lib/funnel.ts` 的 `track(event)` 由 `entry-client.tsx` 与 `src/docs/client.ts` 启动，读 DOM 上的 `data-section` / `data-funnel` / `data-funnel-surface`。

## 数据与状态

- 内容源：`src/docs/content/**`（mdx）、`src/i18n/**`（多语言切片 + stamps）。
- 生成物：`src/lib/media-manifest.json`、`src/lib/settings-defaults.json`、文档搜索索引。
- 旧 URL 兼容集中在 `src/lib/legacy.ts`，每条都注释了存在原因，**不允许新链接指向它们**。

## 关键不变式

- 增删/改名公开页面时，必须同步：`/sitemap.xml`、`llms.txt`、搜索、该页的 `.md` 版本，并跑 `bun test test/sitemap.test.ts`。
- 不要加静态 `public/sitemap.xml`（会盖住生成的那份）。
- 文案规则：**不用冒号**（代码/命令/URL/时间/数据标签例外）；写陈述句不写反问句。
- 分析键（`data-section`、`data-funnel` slug、surface）是报表契约，改名必须同步报表；**绝不发送访客输入的内容**。
- 新增页面要给 `surfaceOf`（`test/funnel.test.ts` 会失败到补上为止）。
- `/config.json`、`/openapi.json`、`/tui.json`、`/v2/install`、`/v2/cli.json`、`/oauth/opencode/client.json`、`/.well-known/apple-app-site-association` 的字节与响应头是对客户端的契约，别动。
- Worker 里不持有 GitHub token。

## 扩展点

- **加一个页面**：`src/routes/<name>.tsx` → 更新导航数据 → 处理 sitemap 排除/动态路由 → 给`data-section` 与 surface → 跑 sitemap/funnel 测试。
- **加一份文档页**：`src/docs/content/<section>/*.mdx` → 更新导航与 `docs-choices.json`/i18n → 看 `src/docs/AGENTS.md`。
- **加一个机器可读文件**：放 `src/routes/*.ts`，并在测试里锁住字节/头。

## 常见改法与坑

- 文档与实现会漂移：站点描述的是**对外行为**，代码细节以 `docs/knowledge/modules` 为准；两者冲突时以代码为准并回改站点。
- `/docs` 没有对应 V2 页时会重定向到 V1 文档，改路由前先看这条回退链。
- 站点样式与文档样式是两套独立产物，跨算改样式会互相污染。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `services/site/src/routes/*` | 页面路由（index、ide、desktop、press、changelog 等） |
| `services/site/src/docs/` | V2 文档子应用（渲染、路由、rehype/remark 插件） |
| `services/site/src/docs/content/**` | 文档正文（mdx） |
| `services/site/src/lib/sitemap.ts` | sitemap 索引、排除项、限额 |
| `services/site/src/lib/funnel.ts` | 分析埋点 |
| `services/site/src/lib/media.ts` | `mediaUrl()` 与媒体桶 |
| `services/site/src/lib/docs.ts` | `/docs` 与 V1 回退 URL |
| `services/site/AGENTS.md`、`DESIGN.md` | 站点规则与设计系统 |
