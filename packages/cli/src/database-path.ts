import path from "node:path"
import { Env } from "@opencode/util/env"
import { OPENCODE_CHANNEL } from "./version"

export function databasePath(data: string) {
  const filename =
    Env.read("DB") ??
    (["latest", "dev", "beta", "next", "prod"].includes(OPENCODE_CHANNEL) ||
    Env.read("DISABLE_CHANNEL_DB") === "1" ||
    Env.read("DISABLE_CHANNEL_DB") === "true"
      ? "cogagent.db"
      : `cogagent-${OPENCODE_CHANNEL.replace(/[^a-zA-Z0-9._-]/g, "-")}.db`)
  return filename === ":memory:" ? filename : path.resolve(data, filename)
}
