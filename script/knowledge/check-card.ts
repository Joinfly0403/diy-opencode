import { expand, hashFiles, readCards } from "./lib.ts"
import { buildSymbols } from "./symbols.ts"

const id = process.argv[2]
if (!id) {
  console.log("usage: node script/knowledge/check-card.ts <card-id>")
  process.exit(2)
}

const cards = readCards()
const card = cards.find((item) => item.id === id)
if (!card) {
  console.log("找不到卡片 " + id + "（文件应为 docs/knowledge/modules/" + id + ".md）")
  process.exit(1)
}

const problems: string[] = []
const expanded = card.paths.flatMap((pattern) => expand(pattern))
if (expanded.length === 0) problems.push("paths 没有匹配到文件：" + card.paths.join(", "))

const { bySymbol } = buildSymbols({ write: false })
for (const symbol of card.symbols) {
  const hit = (bySymbol[symbol] ?? []).some((file) => expanded.includes(file))
  if (!hit) problems.push("符号锚点失效：" + symbol + " 未在该卡 paths 内的文件导出")
}

const ids = new Set(cards.map((item) => item.id))
for (const dependency of [...card.dependsOn, ...card.related]) {
  if (!ids.has(dependency)) problems.push("引用了不存在的卡片：" + dependency)
}

console.log("卡片 " + card.id + "：" + expanded.length + " 个文件，" + card.symbols.length + " 个符号锚点")
console.log("source_hash: " + hashFiles(expanded))
for (const problem of problems) console.log("problem " + problem)
if (problems.length > 0) process.exitCode = 1
