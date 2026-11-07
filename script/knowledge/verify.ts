import fs from "node:fs"
import path from "node:path"
import {
  MODULES,
  ROOT,
  SOURCE_EXTENSIONS,
  type Card,
  expand,
  hashFiles,
  parseFrontmatter,
  readCards,
  readText,
  toPosix,
  walk,
  writeText,
} from "./lib.ts"
import { buildSymbols } from "./symbols.ts"

const REQUIRED = ["id", "title", "level", "layer", "paths"]

const EXCLUDED_DIRECTORIES = ["node_modules", "test", "tests", "e2e", "generated", "fixtures", "__snapshots__"]
const EXCLUDED_SUFFIXES = [".test.ts", ".test.tsx", ".gen.ts", ".d.ts"]
const COVERAGE_ROOTS = ["packages", "services", "sdks"]

export type Report = {
  cards: number
  errors: string[]
  warnings: string[]
  stale: string[]
  coverage: { total: number; covered: number; orphans: string[] }
}

export function verifyCards(options: { bless?: boolean } = {}) {
  const cards = readCards()
  const { bySymbol } = buildSymbols()
  const errors: string[] = []
  const warnings: string[] = []
  const stale: string[] = []
  const ids = new Set(cards.map((card) => card.id))

  for (const card of cards) {
    for (const key of REQUIRED) {
      if (card[key as keyof Card] === undefined || card[key as keyof Card] === "") errors.push(`${card.file}: 缺少必填字段 ${key}`)
    }
    if (!card.file.endsWith(`modules/${card.id}.md`)) errors.push(`${card.file}: 文件路径与 id 不一致（应为 modules/${card.id}.md）`)
    for (const dependency of [...card.dependsOn, ...card.related]) {
      if (!ids.has(dependency)) errors.push(`${card.id}: 引用了不存在的卡片 ${dependency}`)
    }
  }

  const duplicated = cards.map((card) => card.id).filter((id, index, all) => all.indexOf(id) !== index)
  for (const id of new Set(duplicated)) errors.push(`重复的卡片 id: ${id}`)

  const covered = new Set<string>()
  for (const card of cards) {
    const expanded = card.paths.flatMap((pattern) => expand(pattern))
    if (expanded.length === 0) {
      errors.push(`${card.id}: paths 没有匹配到任何文件（${card.paths.join(", ")}）`)
      continue
    }
    for (const file of expanded) covered.add(file)
    const missing = card.symbols.filter((symbol) => !(bySymbol[symbol] ?? []).some((file) => expanded.includes(file)))
    for (const symbol of missing) errors.push(`${card.id}: 符号锚点失效（${symbol} 不在该卡的 paths 里导出）`)
    const hash = hashFiles(expanded)
    if (options.bless) {
      card.sourceHash = hash
      bless(card, hash)
      continue
    }
    if (card.sourceHash === "") warnings.push(`${card.id}: 缺少 source_hash（跑 node script/knowledge/verify.ts --bless）`)
    if (card.sourceHash !== "" && card.sourceHash !== hash) stale.push(card.id)
  }

  const sources = coverageSources()
  const orphans = sources.filter((file) => !covered.has(file))
  for (const id of stale) errors.push(`${id}: 代码已变（source_hash 不一致），需要复核该卡后用 --bless 重新盖章`)

  return {
    cards: cards.length,
    errors,
    warnings,
    stale,
    coverage: { total: sources.length, covered: sources.length - orphans.length, orphans },
  } satisfies Report
}

function coverageSources() {
  return COVERAGE_ROOTS.filter((group) => fs.existsSync(path.join(ROOT, group)))
    .flatMap((group) => walk(path.join(ROOT, group)))
    .map((file) => toPosix(path.relative(ROOT, file)))
    .filter((file) => SOURCE_EXTENSIONS.includes(path.extname(file)))
    .filter((file) => file.includes("/src/"))
    .filter((file) => !EXCLUDED_SUFFIXES.some((suffix) => file.endsWith(suffix)))
    .filter((file) => !file.split("/").some((segment) => EXCLUDED_DIRECTORIES.includes(segment)))
}

function bless(card: Card, hash: string) {
  const absolute = path.join(ROOT, card.file)
  const text = readText(absolute)
  const lines = text.split(/\r?\n/)
  const end = lines.indexOf("---", 1)
  if (end === -1) return
  const stamped = lines.map((line, index) => (index > 0 && index < end && line.startsWith("source_hash:")) ? `source_hash: ${hash}` : line)
  if (!stamped.slice(0, end).some((line) => line.startsWith("source_hash:"))) stamped.splice(end, 0, `source_hash: ${hash}`)
  writeText(absolute, stamped.join("\n"))
}

export function coverageByDirectory(report: Report) {
  const buckets = new Map<string, { total: number; orphans: number }>()
  const orphanSet = new Set(report.coverage.orphans)
  for (const file of coverageSources()) {
    const key = file.split("/").slice(0, 2).join("/")
    const bucket = buckets.get(key) ?? { total: 0, orphans: 0 }
    bucket.total += 1
    if (orphanSet.has(file)) bucket.orphans += 1
    buckets.set(key, bucket)
  }
  return [...buckets.entries()]
    .map(([dir, value]) => ({ dir, ...value }))
    .sort((a, b) => b.orphans - a.orphans)
}

export function cardFiles() {
  return walk(MODULES).filter((file) => file.endsWith(".md"))
}

export function relative(file: string) {
  return toPosix(path.relative(ROOT, file))
}

export function frontmatterOf(file: string) {
  return parseFrontmatter(readText(file))
}
