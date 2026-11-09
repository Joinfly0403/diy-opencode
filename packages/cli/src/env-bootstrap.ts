export * as EnvBootstrap from "./env-bootstrap.js"

/**
 * P2 兼容桥：把 COGAGENT_<NAME> 镜像到 OPENCODE_<NAME>（仅当旧名未设置时）。
 * 这样 350+ 处历史读取点立即可用新名，同时旧名继续生效，
 * 后续把读取点逐个改成 Env.read 后即可删除本文件。
 */
const PREFIX = "OPENCODE_"

export function mirror(): void {
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("COGAGENT_") || value === undefined) continue
    const legacy = PREFIX + key.slice("COGAGENT_".length)
    if (process.env[legacy] === undefined) process.env[legacy] = value
  }
}
