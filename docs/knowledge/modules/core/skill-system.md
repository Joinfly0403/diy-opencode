---
id: core/skill-system
title: 技能系统（SKILL.md 发现与注入）
level: L2
layer: core
status: stable
paths:
  - packages/core/src/skill.ts
  - packages/core/src/skill
  - packages/core/src/config/plugin/skill.ts
  - packages/core/src/config/plugin/skill-scan.ts
  - packages/core/src/config/plugin/skill-file.ts
  - packages/core/src/config/plugin/compatibility.ts
  - packages/core/src/tool/plugin/skill.ts
  - packages/schema/src/skill.ts
  - .opencode/skills
symbols:
  - Skill
  - SkillDiscovery
  - SkillInstructions
  - SkillTool
  - SkillScan
  - SkillFile
  - ConfigSkillPlugin
  - ConfigCompatibilityPlugin
  - available
  - toModelOutput
  - prepare
  - isSafeSegment
  - isSafeRelativePath
  - DirectorySource
  - EmbeddedSource
  - UrlSource
  - Plugin
events:
  - skill.updated
config_keys:
  - skills
depends_on:
  - contracts/config-flag
  - core/permission-policy
  - core/plugin-system
related:
  - core/tool-registry
  - core/session-execution
keywords:
  - skill
  - 技能
  - SKILL.md
  - 提示词
  - 发现
  - catalog
  - autoinvoke
tests:
  - packages/core/test/skill.test.ts
  - packages/core/test/config/skill.test.ts
  - packages/core/test/skill-discovery.test.ts
  - packages/core/test/skill/instructions.test.ts
  - packages/core/test/tool-skill.test.ts
source_hash: f16c93485efe65c94517f41a6b5bdc6864b9a31f
---

## 职责

Location 作用域的技能注册表 + 两条发现通道 + 一种注入方式：

- **注册表** `skill.ts`：`State<Data, Editor>` 里两张 map（`skills` / `files`），支持 `transform`/`reload` 重放；任何变更发布 `skill.updated`。
- **本地发现** `config/plugin/skill.ts`（插件 id `opencode.config.skill`）：从配置目录条目推出 `<dir>/skill` 与 `<dir>/skills` 两个目录源，再叠加 config `skills` 里显式写的目录/URL。
- **HTTP 目录** `skill/discovery.ts`：`pull(url)` 取 `<url>/index.json`，按 `version` 下载各技能的 `files` 到 `Global.cache/skills/<hash(url)>/<name>/`，然后把缓存目录当普通目录源读。
- **兼容目录** `config/plugin/compatibility.ts`（插件 id `opencode.config.compatibility`）：把 `config.compatibility()` 给出的 `.claude`/`.agents` 根目录下的 `skills/` 也扫进同一个 `Skill` 注册表。
- **注入** `skill/instructions.ts`：只把 `id/name/description` 做成 `core/skill-guidance` 指令清单编进 system prompt；正文只在模型调用 `skill` 工具时进对话。

## 边界

- **做什么**：发现与解析 `SKILL.md`、维持技能表、按权限裁剪可见性、把技能正文/附带文件渲染成 `<skill_content>` 块。
- **不做什么**：不执行技能里的脚本、不解释指令语义、不沙箱化（技能正文就是提示词）；不解析 AGENTS.md/instructions（那是 `Instructions` / `InstructionDiscovery`）；不写仓库文件，唯一落盘是 HTTP 目录的下载缓存。
- 注册表本身不做授权：列表阶段按 `Permission.evaluate("skill", id, ruleset)` 过滤，调用阶段由叶子工具再 `permission.assert`。

## 入口与调用链

1. 配置加载完成 → `ConfigSkillPlugin` 注册 `Watcher` 订阅、`refresh()` 扫一遍、把结果 `ctx.skill.transform(editor => editor.add(skill))`。
2. `sources()`：配置目录条目（`entry.type === "directory"`，只由系统配置目录、全局配置目录、项目 `.opencode` 产生）→ `<dir>/skill`、`<dir>/skills`；config `skills` 条目里 `http(s)` 走 `UrlSource`，`~/` 展开 home，其余按 `Location.directory` 解析。
   同一份清单还会被 `ConfigCompatibilityPlugin` 补齐 `<claude root>/skills` 与 `<agents root>/skills`（`config.compatibility()` 的 `claude`/`agents` 数组），走 `refresh → ctx.skill.reload()` 同一套流程。
3. `load(source)`：目录源直接扫；URL 源先 `SkillDiscovery.pull` 再扫。每个目录 `SkillScan.scan` → 逐文件 `readFileStringSafe` → `SkillFile.parse` → 收 `Skill.Info`。
4. watcher 事件 → `PubSub.sliding(1)` → `Stream.debounce("100 millis")` → `refresh()` → `ctx.skill.reload()`；`config.updated` 事件重跑同一路径。
5. 每个模型请求：`SessionContext.select` 并发加载 `skillInstructions.load(permissions)`，与 tools/mcp/references/builtins 一起 `Instructions.combine`。
6. 模型调 `skill` 工具 → `Skill.Service.get(id)` → `permission.assert({ action: "skill", save: [id] })` → `Skill.prepare(fs, skill, files)` → `toModelOutput`（含 Base directory 与 `<skill_files>` 抽样）。
7. `read` 工具支持 `skill://<id>/<file>` 虚拟路径（`packages/core/src/tool/plugin/read.ts`），把技能附带文件当只读文件系统暴露。

## 数据与状态

- `Skill.Info` = `id / name / description? / autoinvoke? / path / content`（`packages/schema/src/skill.ts`）。
- `Skill.Data` = `skills: Map<ID, Info>` + `files: Map<ID, Map<file, string>>`；`files` 只在 `add` 显式传了虚拟文件时存在，且剔除 `SKILL.md`、按文件名排序。
- **没有表、没有持久化**：技能表每次进程启动从配置目录重算，改 `SKILL.md` 后 watcher 触发重扫即可；HTTP 目录源是唯一落盘物：`<cache>/skills/<hash>/<name>/` 加版本戳 `.opencode-version`。
- 下载用 staging/backup 双目录 + `rename` 原子替换；`Effect.uninterruptible` 包住换目录那段。

## 关键不变式

- **文件名必须全大写 `SKILL.md`**：`skill-scan.ts` 只按 `child.name === "SKILL.md"` 认目录技能；写成 `skill.md` 会被当成普通 Markdown 文件跳过。
- **id 规则**：`SKILL.md` 取父目录名；根目录下平铺的 `<name>.md` 取文件名。所以「一个技能一个目录、目录名即 id」是约定而非强制解析。
- **frontmatter 只认四个键**：`name` / `description` / `metadata` / `disable-model-invocation`。解析失败返回 `Skipped` 并 `logDebug`，**不抛错、不中断整轮加载**。
- **autoinvoke 优先级**：`metadata["opencode/autoinvoke"]` > `disable-model-invocation`（true → autoinvoke=false）> 未设置。
- **可见性两层**：`description === undefined` 或 `autoinvoke === false` 的技能不进模型清单；被权限 `deny` 的技能连清单都不进。清单只是目录可见性，执行授权仍在叶子的 `permission.assert`。
- **扫描边界**：深度上限 `MAX_DEPTH = 6`，跳过 `.` 开头目录与 `FSUtil.ignoredDirectories`；符号链接会 `stat` 成真实类型。
- **URL 源全有或全无**：技能名必须是单段安全段、每个文件必须是安全相对路径、必须同源、目标必须落在 root 内，且 `files` 必须含 `SKILL.md` 或 `<name>.md`——任一文件不合法则整条技能丢弃。
- **虚拟路径与磁盘路径两套渲染**：`path` 是 `skill://…` 时 base directory 是 URI、文件列表来自内存 map；是磁盘路径时扫 `**/*` 并剔除 `SKILL.md`。两条路都只采样前 10 个文件。
- **磁盘扫描不做 I/O 之外的副作用**：`refresh` 会重跑，transform 里只允许写 editor。

## 扩展点

- **加一个真实技能**：建 `.opencode/skills/<name>/SKILL.md`（frontmatter 至少给 `name` + `description`）。无需改代码；等待 watcher 或重启。
- **加一种技能来源**：`packages/schema/src/skill.ts` 加 `Source` 变体 → `config/plugin/skill.ts` 的 `sources()`（收集）与 `load()`（抓取）分支 → `Skill.Source.equals/key`（去重与日志键）。三处缺一不可。
- **改模型看到的清单**：`skill/instructions.ts` 的 `entries()` / `render()` / `update` 文案（清单有增删时需要 `replaced/added/changed/removed` 四种措辞）。
- **改模型看到的正文包装**：`skill.ts` 的 `toModelOutput` 与 `prepare`（base directory 行、`<skill_files>` 抽样）。
- **Console 侧技能**：`packages/core/src/plugin/provider/opencode.ts` 另走 `/api/v2/skills` 与 `/api/v2/skills/<slug>`，产出 `skill://<slug>/SKILL.md` 的虚拟技能，不经 `SkillDiscovery`。

## 常见改法与坑

- 以为 `.claude/skills` 与 `.opencode/skills` 同源：前者来自 `compatibility.ts`（roots 由 `config.compatibility()` 提供，且 `claude: false` 可关掉），后者来自配置目录条目里的 `skills/` 子目录；两个插件各自 `editor.add`，同 id 后注册的覆盖先注册的。
- 只改 `SKILL.md` 内容却不生效：目标目录此前不存在时，plugin 只 watch 最近的已存在父目录（`firstMissing`），建出目录后才切换到目录 watch——最省事的是重启。
- 技能正文改了但模型清单没变：清单只含 `name/description`，正文变化不产生 `changed` 文案；要让模型看到新正文必须重新调用 `skill` 工具。
- 技能里放几十个参考文件：模型只会看到排序后的 10 个文件名，别指望它知道其余文件存在。
- 在 `transform` 回调里做网络/磁盘 I/O：`State` 会重放 transform，副作用会重复。
- 同名技能：`refresh` 按 `Map.set` 覆盖，按源遍历顺序后者胜；排查先看 `skills rescanned` 日志里的 id 列表。
- HTTP 目录版本号写错：只有 `version` 与 `.opencode-version` 相同才原地补齐缺文件，不同则整目录重下（staging 失败时保留旧版）。

## 代码坐标

| 文件 | 内容 |
| --- | --- |
| `packages/core/src/skill.ts` | `Skill.Service`、State/Editor、`available`、`uri`、`prepare`、`toModelOutput` |
| `packages/core/src/skill/discovery.ts` | HTTP 目录 `pull`、版本缓存、安全段/相对路径校验 |
| `packages/core/src/skill/instructions.ts` | 模型可见清单（`core/skill-guidance`）与增删改文案 |
| `packages/core/src/config/plugin/skill.ts` | 来源收集、watcher 去抖、refresh、注册进 `Skill` |
| `packages/core/src/config/plugin/skill-scan.ts` | 目录扫描（深度 6、忽略点目录） |
| `packages/core/src/config/plugin/skill-file.ts` | frontmatter 解析、id 规则、autoinvoke 推导 |
| `packages/core/src/config/plugin/compatibility.ts` | `.claude`/`.agents` 下 `skills/` 的兼容发现 |
| `packages/core/src/tool/plugin/skill.ts` | `skill` 工具（`codemode: false`）、权限断言、输出 |
| `packages/schema/src/skill.ts` | `Info`/`Source`/`Event` 契约 |
| `.opencode/skills` | 仓库内技能（如 `unit-tests`、`tui-tests`、`sample-skill`） |
| `packages/core/src/tool/plugin/read.ts` | `skill://` 虚拟文件读取 |
