import path from "node:path"
import { KNOWLEDGE, readCards, writeText } from "./lib.ts"
import { type Report, coverageByDirectory } from "./verify.ts"

const LEVEL_TITLES: Record<string, string> = {
  L0: "L0 骨架层（进程 / 契约 / 存储）",
  L1: "L1 核心能力（会话 / 工具 / 权限 / 模型 / 插件）",
  L2: "L2 能力面（客户端 / 界面 / 扩展 / 周边）",
}

export function buildIndex(report: Report) {
  const cards = readCards()
  const lines: string[] = []
  lines.push("# opencode 模块检索索引")
  lines.push("")
  lines.push("> 由 build.ts 生成，不要手改。卡片正文在 modules/ 下，机器事实在 _generated/ 下。")
  lines.push(">")
  lines.push("> 卡片数 " + report.cards + "；源文件覆盖 " + report.coverage.covered + "/" + report.coverage.total + "。检索顺序：本索引 → 1~3 张卡 → 卡内坐标。")
  lines.push("")

  for (const level of ["L0", "L1", "L2"]) {
    const group = cards.filter((card) => card.level === level)
    if (group.length === 0) continue
    lines.push("## " + (LEVEL_TITLES[level] ?? level))
    lines.push("")
    for (const card of group) {
      const keywords = card.keywords.length > 0 ? " ｜ " + card.keywords.join("、") : ""
      lines.push("- " + ref(card) + " — " + card.title + keywords)
    }
    lines.push("")
  }

  lines.push("## 按目录找")
  lines.push("")
  for (const group of groupBy(cards)) {
    lines.push("- " + group[0] + " → " + group[1].map((card) => ref(card)).join("、"))
  }
  lines.push("")

  const events = cards.flatMap((card) => card.events.map((name) => ({ key: name, card })))
  if (events.length > 0) {
    lines.push("## 按事件找")
    lines.push("")
    for (const item of events.sort((a, b) => a.key.localeCompare(b.key))) lines.push("- " + tick(item.key) + " → " + ref(item.card))
    lines.push("")
  }

  const configKeys = cards.flatMap((card) => card.configKeys.map((key) => ({ key, card })))
  if (configKeys.length > 0) {
    lines.push("## 按配置键找")
    lines.push("")
    for (const item of configKeys.sort((a, b) => a.key.localeCompare(b.key))) lines.push("- " + tick(item.key) + " → " + ref(item.card))
    lines.push("")
  }

  const endpoints = cards.flatMap((card) => card.entryHttp.map((endpoint) => ({ key: endpoint, card })))
  if (endpoints.length > 0) {
    lines.push("## 按 HTTP 端点找")
    lines.push("")
    for (const item of endpoints.sort((a, b) => a.key.localeCompare(b.key))) lines.push("- " + tick(item.key) + " → " + ref(item.card))
    lines.push("")
  }

  lines.push("## 按符号找")
  lines.push("")
  for (const card of cards.filter((card) => card.symbols.length > 0)) {
    lines.push("- " + card.symbols.map((symbol) => tick(symbol)).join("、") + " → " + ref(card))
  }
  lines.push("")

  lines.push("## 覆盖率")
  lines.push("")
  lines.push("| 目录 | 源文件 | 未归属 |")
  lines.push("| --- | --- | --- |")
  for (const bucket of coverageByDirectory(report).slice(0, 30)) {
    lines.push("| " + tick(bucket.dir) + " | " + bucket.total + " | " + bucket.orphans + " |")
  }
  lines.push("")

  writeText(path.join(KNOWLEDGE, "index.md"), lines.join("\n") + "\n")
  return lines.length
}

function ref(card: { id: string; file: string }) {
  return "[" + card.id + "](" + card.file.replace("docs/knowledge/", "") + ")"
}

function tick(value: string) {
  return "`" + value + "`"
}

function groupBy(cards: { paths: string[]; id: string; file: string }[]) {
  const map = new Map<string, { paths: string[]; id: string; file: string }[]>()
  for (const card of cards) {
    for (const dir of new Set(card.paths.map((pattern) => pattern.split("/").slice(0, 2).join("/")))) {
      map.set(dir, [...(map.get(dir) ?? []), card])
    }
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
}
