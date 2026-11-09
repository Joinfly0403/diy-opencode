export * as Env from "./env.js"

const warned = new Set<string>()

/**
 * 读取品牌环境变量：优先 COGAGENT_<name>，回落到 OPENCODE_<name>（旧名，命中时告警一次）。
 * P2 第一阶段保留旧名兼容，后续版本删除回落分支。
 */
export function read(name: string): string | undefined {
  const current = process.env["COGAGENT_" + name]
  if (current !== undefined) return current
  const legacy = process.env["OPENCODE_" + name]
  if (legacy !== undefined && !warned.has(name)) {
    warned.add(name)
    console.warn("[cogagent] OPENCODE_" + name + " 已废弃，请改用 COGAGENT_" + name)
  }
  return legacy
}
