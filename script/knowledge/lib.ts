// Shared helpers for the docs/knowledge tooling.
// Zero dependencies: runs on Bun, and on Node >= 22.6 via native type stripping.
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export const ROOT = findRoot()

export const KNOWLEDGE = path.join(ROOT, "docs", "knowledge")
export const MODULES = path.join(KNOWLEDGE, "modules")
export const GENERATED = path.join(KNOWLEDGE, "_generated")

export const SOURCE_EXTENSIONS = [".ts", ".tsx"]

function findRoot() {
  let dir = path.resolve(import.meta.dirname)
  while (true) {
    if (fs.existsSync(path.join(dir, "bunfig.toml")) && fs.existsSync(path.join(dir, "packages"))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error("could not locate the repository root from " + import.meta.dirname)
    dir = parent
  }
}

export function toPosix(value: string) {
  return value.split(path.sep).join("/")
}

export function walk(dir: string) {
  const out: string[] = []
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) break
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      out.push(full)
    }
  }
  return out
}

export function readText(file: string) {
  return fs.readFileSync(file, "utf8")
}

export function lineCount(text: string) {
  return text.length === 0 ? 0 : text.split("\n").length
}

// Minimal YAML frontmatter: scalar values and "- item" lists, no nesting, no anchors.
export function parseFrontmatter(text: string) {
  const lines = text.split(/\r?\n/)
  if (lines[0] !== "---") return { data: {}, body: text, bodyLine: 1 }
  const data: Record<string, string | string[]> = {}
  let cursor = 1
  let current: string | undefined
  while (cursor < lines.length && lines[cursor] !== "---") {
    const line = lines[cursor]
    cursor += 1
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue
    const listItem = line.match(/^\s+- (.*)$/)
    if (listItem && current) {
      const existing = data[current]
      const value = unquote(listItem[1])
      data[current] = Array.isArray(existing) ? [...existing, value] : [value]
      continue
    }
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!pair) continue
    current = pair[1]
    const raw = pair[2].trim()
    data[current] = raw === "" ? [] : unquote(raw)
  }
  return { data, body: lines.slice(cursor + 1).join("\n"), bodyLine: cursor + 2 }
}

function unquote(value: string) {
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1)
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1)
  return trimmed
}

export type Card = {
  id: string
  file: string
  title: string
  level: string
  layer: string
  status: string
  paths: string[]
  symbols: string[]
  dependsOn: string[]
  related: string[]
  keywords: string[]
  events: string[]
  configKeys: string[]
  tables: string[]
  entryCli: string[]
  entryHttp: string[]
  tests: string[]
  sourceHash: string
  body: string
}

function asList(value: string | string[] | undefined) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export function readCards() {
  if (!fs.existsSync(MODULES)) return [] as Card[]
  const files = walk(MODULES).filter((file) => file.endsWith(".md"))
  return files
    .map((file) => {
      const text = readText(file)
      const { data, body } = parseFrontmatter(text)
      const id = String(data.id ?? "")
      return {
        id,
        file: toPosix(path.relative(ROOT, file)),
        title: String(data.title ?? id),
        level: String(data.level ?? "L2"),
        layer: String(data.layer ?? id.split("/")[0]),
        status: String(data.status ?? "draft"),
        paths: asList(data.paths),
        symbols: asList(data.symbols),
        dependsOn: asList(data.depends_on),
        related: asList(data.related),
        keywords: asList(data.keywords),
        events: asList(data.events),
        configKeys: asList(data.config_keys),
        tables: asList(data.tables),
        entryCli: asList(data.entry_cli),
        entryHttp: asList(data.entry_http),
        tests: asList(data.tests),
        sourceHash: String(data.source_hash ?? ""),
        body,
      } satisfies Card
    })
    .filter((card) => card.id !== "")
    .sort((a, b) => a.id.localeCompare(b.id))
}

function globToRegex(glob: string) {
  const escaped = glob.replace(/[.+^$${}()|[\]\\]/g, "\\$&")
  const withDoubleStar = escaped.replace(/\*\*\//g, "\u0000").replace(/\*\*/g, "\u0001")
  const withStar = withDoubleStar.replace(/\*/g, "[^/]*")
  const restored = withStar.replace(/\u0000/g, "(?:.*/)?").replace(/\u0001/g, ".*")
  return new RegExp("^" + restored + "$")
}

export function expand(pattern: string) {
  const target = toPosix(pattern).replace(/^\/+/, "").replace(/\/$/, "")
  const absolute = path.join(ROOT, target)
  if (!target.includes("*")) {
    if (!fs.existsSync(absolute)) return [] as string[]
    if (fs.statSync(absolute).isFile()) return [target]
    return walk(absolute).map((file) => toPosix(path.relative(ROOT, file)))
  }
  const base = baseDirectory(target)
  if (!fs.existsSync(path.join(ROOT, base))) return [] as string[]
  const regex = globToRegex(target)
  return walk(path.join(ROOT, base))
    .map((file) => toPosix(path.relative(ROOT, file)))
    .filter((file) => regex.test(file))
}

function baseDirectory(pattern: string) {
  const cut = pattern.search(/\*/)
  const head = cut === -1 ? pattern : pattern.slice(0, cut)
  const slash = head.lastIndexOf("/")
  return slash === -1 ? "." : head.slice(0, slash)
}

export function hashFiles(files: string[]) {
  const hash = crypto.createHash("sha1")
  for (const file of [...files].sort()) {
    hash.update(file)
    hash.update("\u0000")
    hash.update(readText(path.join(ROOT, file)))
    hash.update("\u0000")
  }
  return hash.digest("hex")
}

export function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n")
}

export function writeText(file: string, value: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, value)
}
