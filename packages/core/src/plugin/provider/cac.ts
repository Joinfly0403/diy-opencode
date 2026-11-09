import { define } from "@opencode/plugin/effect/plugin"
import { Effect, Schema } from "effect"
import { readFileSync } from "node:fs"
import { Model } from "../../model.js"
import { Provider } from "../../provider.js"

/**
 * CAC (CodeAgentCLI) provider.
 *
 * Endpoints, client id and version headers live in the admin-owned configuration file
 * (default /etc/cogagent/cac.json) so the repository carries no internal hostnames.
 * The access token and the discovered model list arrive from the launcher through the
 * environment, which ptrace_scope=1 keeps unreadable to other same-uid processes.
 */
const PROVIDER_ID = Provider.ID.make("cac")
const PACKAGE = "@opencode/ai/providers/openai-compatible"
const CONFIG_PATH = process.env.COGAGENT_CAC_CONFIG ?? "/etc/cogagent/cac.json"

export const Config = Schema.Struct({
  apiBase: Schema.String,
  authBase: Schema.String,
  clientId: Schema.String,
  clientVersion: Schema.optional(Schema.String),
  pluginVersion: Schema.optional(Schema.String),
  kernelVersion: Schema.optional(Schema.String),
  agentType: Schema.optional(Schema.String),
  rootBase: Schema.optional(Schema.String),
  snapengine: Schema.Struct({ yellow: Schema.String, green: Schema.String }),
})
export type Config = typeof Config.Type

export const Token = Schema.Struct({
  accessToken: Schema.String,
  account: Schema.optional(Schema.String),
  area: Schema.optional(Schema.String),
  region: Schema.optional(Schema.String),
  department: Schema.optional(Schema.String),
  expiresAt: Schema.optional(Schema.Number),
})
export type Token = typeof Token.Type

export const RemoteModel = Schema.Struct({
  id: Schema.String,
  name: Schema.optional(Schema.String),
  context: Schema.optional(Schema.Number),
})
export type RemoteModel = typeof RemoteModel.Type

export function parseConfig(text: string): Config | undefined {
  try {
    const value = Schema.decodeUnknownSync(Config)(JSON.parse(text))
    return value
  } catch {
    return undefined
  }
}

export function parseToken(text: string): Token | undefined {
  try {
    return Schema.decodeUnknownSync(Token)(JSON.parse(text))
  } catch {
    return undefined
  }
}

export function parseModels(text: string): readonly RemoteModel[] {
  try {
    return Schema.decodeUnknownSync(Schema.Array(RemoteModel))(JSON.parse(text))
  } catch {
    return []
  }
}

export function baseURL(input: { config: Config; token: Token }): string {
  return (input.token.area === "yellow" ? input.config.snapengine.yellow : input.config.snapengine.green).replace(/\/+$/, "")
}

export function headers(input: { config: Config; token: Token }): Record<string, string> {
  const config = input.config
  const token = input.token
  return {
    "x-auth-token": token.accessToken,
    "x-codeagent-request-kind": "main_conversation",
    "x-error-propagation": "true",
    "app-id": config.clientId,
    "plugin-version": config.pluginVersion ?? "",
    "kernel-version": config.kernelVersion ?? "",
    "x-agent-client-version": config.clientVersion ?? "",
    "x-agent-user-account": token.account ?? "",
    "x-agent-user-department": token.department ?? "",
  }
}

export function models(input: { models: readonly RemoteModel[] }): Model.Info[] {
  return input.models.map((item) => {
    const id = Model.ID.make(item.id)
    const base = Model.Info.default(PROVIDER_ID, id)
    return {
      ...base,
      name: item.name ?? item.id,
      package: PACKAGE,
      capabilities: { ...base.capabilities, tools: true },
      limit: { ...base.limit, context: item.context && item.context > 0 ? item.context : base.limit.context },
    }
  })
}

function readFile(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8")
  } catch {
    return undefined
  }
}

function readToken(): Token | undefined {
  const fromEnv = process.env.COGAGENT_CAC_TOKEN
  if (fromEnv) return parseToken(fromEnv)
  const fromFd = readFile("/dev/fd/3")
  if (fromFd) return parseToken(fromFd)
  return undefined
}

export const CACPlugin = define({
  id: "opencode.provider.cac",
  effect: Effect.fn(function* (ctx) {
    const configText = readFile(CONFIG_PATH)
    if (!configText) return
    const config = parseConfig(configText)
    if (!config) return
    const token = readToken()
    if (!token) return
    const remote = parseModels(process.env.COGAGENT_CAC_MODELS ?? "[]")
    if (remote.length === 0) return

    yield* ctx.provider.transform((providers) => {
      providers.add({
        info: {
          id: PROVIDER_ID,
          name: "CAC CodeAgent",
          activation: "enabled",
          package: PACKAGE,
          settings: {
            baseURL: baseURL({ config, token }),
            provider: "cac",
            apiKey: token.accessToken,
          },
          headers: headers({ config, token }),
        },
        models: models({ models: remote }),
      })
    })
  }),
})
