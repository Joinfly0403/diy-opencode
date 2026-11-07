import fs from "node:fs"
import path from "node:path"
import { GENERATED, ROOT, SOURCE_EXTENSIONS, lineCount, readText, toPosix, walk, writeJson } from "./lib.ts"

type Entry = {
  name: string
  dir: string
  files: number
  sourceFiles: number
  loc: number
  packageName: string | null
  directories: { name: string; files: number; loc: number }[]
}

const GROUPS = ["packages", "services", "sdks"]

export function buildInventory() {
  const entries: Entry[] = []
  for (const group of GROUPS) {
    const base = path.join(ROOT, group)
    if (!fs.existsSync(base)) continue
    for (const child of fs.readdirSync(base, { withFileTypes: true })) {
      if (!child.isDirectory()) continue
      const dir = path.join(base, child.name)
      entries.push(summarize(group + "/" + child.name, dir))
    }
  }
  const inventory = {
    generatedAt: new Date().toISOString(),
    commit: currentCommit(),
    groups: Object.fromEntries(GROUPS.map((group) => [group, entries.filter((entry) => entry.dir.startsWith(group + "/"))])),
  }
  writeJson(path.join(GENERATED, "inventory.json"), inventory)
  return inventory
}

function summarize(dir: string, absolute: string): Entry {
  const files = walk(absolute)
  const sourceFiles = files.filter((file) => SOURCE_EXTENSIONS.includes(path.extname(file)))
  const loc = sourceFiles.reduce((total, file) => total + lineCount(readText(file)), 0)
  const directories = fs
    .readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const nested = walk(path.join(absolute, entry.name)).filter((file) => SOURCE_EXTENSIONS.includes(path.extname(file)))
      return { name: entry.name, files: nested.length, loc: nested.reduce((total, file) => total + lineCount(readText(file)), 0) }
    })
    .filter((entry) => entry.files > 0)
    .sort((a, b) => b.loc - a.loc)
  return {
    name: path.basename(dir),
    dir: toPosix(path.relative(ROOT, absolute)),
    files: files.length,
    sourceFiles: sourceFiles.length,
    loc,
    packageName: readPackageName(absolute),
    directories,
  }
}

function readPackageName(absolute: string) {
  const file = path.join(absolute, "package.json")
  if (!fs.existsSync(file)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
    return typeof parsed.name === "string" ? parsed.name : null
  } catch {
    return null
  }
}

function currentCommit() {
  try {
    return fs.readFileSync(path.join(ROOT, ".git", "HEAD"), "utf8").trim()
  } catch {
    return null
  }
}
