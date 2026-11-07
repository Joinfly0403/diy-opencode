import fs from "node:fs"
import path from "node:path"
import { GENERATED } from "./lib.ts"
import { buildInventory } from "./inventory.ts"
import { buildSymbols } from "./symbols.ts"
import { coverageByDirectory, verifyCards } from "./verify.ts"
import { buildIndex } from "./index.ts"

const bless = process.argv.includes("--bless")
const inventory = buildInventory()
const { byFile, bySymbol } = buildSymbols()
const report = verifyCards({ bless })
const indexLines = buildIndex(report)

fs.mkdirSync(GENERATED, { recursive: true })
fs.writeFileSync(
  path.join(GENERATED, "coverage.md"),
  [
    "# 覆盖率报告",
    "",
    `- 源文件：${report.coverage.covered}/${report.coverage.total} 已归属卡片`,
    `- 卡片数：${report.cards}`,
    `- 错误：${report.errors.length}，警告：${report.warnings.length}`,
    "",
    "| 目录 | 源文件 | 未归属 |",
    "| --- | --- | --- |",
    ...coverageByDirectory(report).map((bucket) => `| ${bucket.dir} | ${bucket.total} | ${bucket.orphans} |`),
    "",
    "## 未归属文件",
    "",
    ...report.coverage.orphans.map((file) => `- ${file}`),
    "",
  ].join("\n"),
)

const files = Object.keys(byFile).length
console.log(`inventory: ${Object.values(inventory.groups).flat().length} 个包/服务`)
console.log(`symbols: ${Object.keys(bySymbol).length} 个导出符号 / ${files} 个文件`)
console.log(`cards: ${report.cards}，index: ${indexLines} 行`)
console.log(`coverage: ${report.coverage.covered}/${report.coverage.total} 源文件已归属卡片`)
for (const warning of report.warnings) console.log("warn  " + warning)
for (const error of report.errors) console.log("error " + error)
if (report.errors.length > 0) process.exitCode = 1
