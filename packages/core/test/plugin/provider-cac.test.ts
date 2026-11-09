import { describe, expect, test } from "bun:test"
import {
  baseURL,
  headers,
  models,
  parseConfig,
  parseModels,
  parseToken,
} from "../../src/plugin/provider/cac.js"

const config = parseConfig(
  JSON.stringify({
    apiBase: "https://api.example.test",
    authBase: "https://auth.example.test",
    clientId: "client-id",
    clientVersion: "1.0.0",
    pluginVersion: "plugin-1",
    kernelVersion: "kernel-1",
    snapengine: {
      yellow: "https://yellow.example.test/api/v2",
      green: "https://green.example.test/api/v2/",
    },
  }),
)

const token = parseToken(
  JSON.stringify({
    accessToken: "token-value",
    account: "user1",
    region: "y",
    area: "yellow",
    department: "000/111",
  }),
)

describe("cac provider", () => {
  test("parses a valid config", () => {
    expect(config?.apiBase).toBe("https://api.example.test")
  })

  test("rejects a config without snapengine", () => {
    expect(parseConfig(JSON.stringify({ apiBase: "x", authBase: "y", clientId: "z" }))).toBeUndefined()
  })

  test("parses a valid token", () => {
    expect(token?.accessToken).toBe("token-value")
    expect(token?.area).toBe("yellow")
  })

  test("rejects a token without accessToken", () => {
    expect(parseToken(JSON.stringify({ account: "user1" }))).toBeUndefined()
  })

  test("parses a model list and ignores malformed entries", () => {
    expect(parseModels(JSON.stringify([{ id: "a" }, { id: "b", name: "B", context: 1000 }]))).toHaveLength(2)
    expect(parseModels(JSON.stringify([{ nope: true }]))).toHaveLength(0)
    expect(parseModels("not json")).toHaveLength(0)
  })

  test("selects the area endpoint and trims trailing slashes", () => {
    if (!config || !token) throw new Error("fixtures did not parse")
    expect(baseURL({ config, token })).toBe("https://yellow.example.test/api/v2")
    expect(baseURL({ config, token: { ...token, area: "green" } })).toBe("https://green.example.test/api/v2")
    expect(baseURL({ config, token: { ...token, area: undefined } })).toBe("https://green.example.test/api/v2")
  })

  test("builds the request headers", () => {
    if (!config || !token) throw new Error("fixtures did not parse")
    const value = headers({ config, token })
    expect(value["x-auth-token"]).toBe("token-value")
    expect(value["app-id"]).toBe("client-id")
    expect(value["plugin-version"]).toBe("plugin-1")
    expect(value["x-agent-user-account"]).toBe("user1")
    expect(value["x-agent-user-department"]).toBe("000/111")
    expect(value["x-codeagent-request-kind"]).toBe("main_conversation")
  })

  test("builds models with the provider package and tool support", () => {
    const built = models({ models: [{ id: "m1", name: "M1", context: 128_000 }, { id: "m2" }] })
    expect(built).toHaveLength(2)
    expect(built[0]?.package).toBe("@opencode/ai/providers/openai-compatible")
    expect(String(built[0]?.providerID)).toBe("cac")
    expect(built[0]?.capabilities.tools).toBe(true)
    expect(built[0]?.limit.context).toBe(128_000)
    expect(built[1]?.limit.context ?? 0).toBeGreaterThan(0)
  })
})
