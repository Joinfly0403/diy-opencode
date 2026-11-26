# 文档地图

> 先看哪份，取决于你要做什么。

## 全仓理解

| 文档 | 内容 | 状态 |
|---|---|---|
| [cogagent-hud-manual.md](cogagent-hud-manual.md) | **独立技术手册（自包含）**：cogagent 本体 + cogagent-hud-bundle，只写已实现/已变更内容 | 现行 |
| [cogagent-changes.md](cogagent-changes.md) | **本仓库自 opencode 基线以来的开发内容**：Linux-only 收敛、品牌改名、CAC 登录与安装、权限 bypass、TUI 中文化/重绘、Provider 精简、HUD、知识库、工程约定 | 现行（主文档） |
| [architecture.md](architecture.md) | 上游骨架参考（包分层、会话链路、Server/协议等），**不是本仓库开发内容** | 参考 |
| [knowledge/index.md](knowledge/index.md) | 模块检索索引（42 张卡，覆盖 1684 个源文件），按分层/目录/符号定位代码 | 由 `bun run knowledge` 生成 |
| [knowledge/README.md](knowledge/README.md) | 知识库自身的使用与维护说明 | 现行 |

## HUD（OSSDesign 悬浮助手 + 接口录制/回放）

| 文档 | 内容 | 状态 |
|---|---|---|
| [design/hud-implementation.md](design/hud-implementation.md) | **实现技术文档**：组件数据流、数据模型、动作 DSL、占位符、录制/执行流程、接口、安装、排障、已知缺口 | 现行 |
| [../script/hud/README.md](../script/hud/README.md) | 安装 / 使用 / 排障 | 现行 |
| [../script/hud/SYNC.md](../script/hud/SYNC.md) | 服务器 ↔ 仓库同步流程 | 现行 |
| [design/hud-actions-toolbar.md](design/hud-actions-toolbar.md) | 早期设计稿（动作用途、工具栏、AI 协作） | **部分过时**（顶部有差异说明） |
| [hud-integration-design.md](hud-integration-design.md) | 早期开发规格书 v6（CDP/UI 自动化方向） | **历史** |
| [hud-handover.md](hud-handover.md) | 现场恢复手册（重装后恢复 broker/桥） | 恢复步骤有效 |
| [hud-m0-checklist.md](hud-m0-checklist.md) | M0 阶段清单 | 历史 |

## 其它

| 文档 | 内容 |
|---|---|
| [design/ossdesign-kb-plan-v1.1.md](design/ossdesign-kb-plan-v1.1.md) | OSSDesign 知识库方案（面向 OSSDesign 源码，不在本仓） |
| [design/ccloud-hud-cron.md](design/ccloud-hud-cron.md) | ccloud 定时任务与 HUD 的边界方案 |
| [design/cdp-browser-control.md](design/cdp-browser-control.md) | CDP 跨标签控制草稿（未提交入库） |
| `upstream/` | 上游同步相关记录 |

## 维护约定

- 改代码后：`bun run knowledge`（模块卡 stale 复核后 `--bless`）。
- 改 HUD 行为后：同步 `design/hud-implementation.md` 与 `script/hud/README.md`。
- 新增设计稿放 `docs/design/`，并在本文件登记状态（现行 / 过时 / 历史）。
