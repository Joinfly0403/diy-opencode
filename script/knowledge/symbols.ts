import fs from "node:fs"
import path from "node:path"
import { GENERATED, ROOT, SOURCE_EXTENSIONS, readText, toPosix, walk, writeJson } from "./lib.ts"

const PATTERNS = [
  /export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/g,
  /export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from/g,
  /export\s*\{([^}]*)\}/g,
]

export function buildSymbols(options: { write?: boolean } = {}) {
  const byFile = new Map<string, string[]>()
  const bySymbol = new Map<string, string[]>()
  for (const file of sourceFiles()) {
    const names = extract(file)
    if (names.length === 0) continue
    const sorted = [...new Set(names)].sort()
    byFile.set(file, sorted)
    for (const name of sorted) bySymbol.set(name, [...(bySymbol.get(name) ?? []), file])
  }
  if (options.write !== false)
    writeJson(path.join(GENERATED, "symbols.json"), {
      byFile: Object.fromEntries(byFile),
      bySymbol: Object.fromEntries(bySymbol),
    })
  return { byFile: Object.fromEntries(byFile), bySymbol: Object.fromEntries(bySymbol) }
}

function sourceFiles() {
  const roots = ["packages", "services", "sdks"].map((group) => path.join(ROOT, group))
  return roots
    .filter((root) => fs.existsSync(root))
    .flatMap((root) => walk(root))
    .filter((file) => SOURCE_EXTENSIONS.includes(path.extname(file)))
    .map((file) => toPosix(path.relative(ROOT, file)))
}

function extract(file: string) {
  const text = readText(path.join(ROOT, file))
  const names: string[] = []
  for (const pattern of PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match = regex.exec(text)
    while (match) {
      if (match[1].includes(",") || match[1].includes(" as ")) {
        for (const part of match[1].split(",")) {
          const name = part.trim().split(/\s+as\s+/).pop()?.trim()
          if (name && /^[A-Za-z_$][\w$]*$/.test(name)) names.push(name)
        }
      } else if (match[1]) {
        names.push(match[1].trim())
      }
      match = regex.exec(text)
    }
  }
  return names
}
