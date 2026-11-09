#!/usr/bin/env bun
/**
 * Linux 单文件编译。原 packages/cli/script/build.ts 在裁剪时被移除，
 * 这里保留最小路径：solid 转译插件 + 原生资源嵌入 + 交叉编译。
 *
 * 用法（在仓库根）：
 *   TARGET=bun-linux-arm64 bun packages/cli/script/build-linux.ts
 *   TARGET=bun-linux-x64   bun packages/cli/script/build-linux.ts
 *
 * 前置：构建机已安装目标平台原生包
 *   bun install --os="*" --cpu="*" --libc="*"
 */
import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"
import { createHash } from "node:crypto"
import { discoverPluginRuntimeSpecifiers, pluginRuntimeLoaderCode } from "@opencode/plugin/runtime-modules"
import type { BunPlugin } from "bun"
import path from "node:path"

const dir = path.resolve(import.meta.dirname, "..")
const root = path.resolve(dir, "../..")
const target = process.env.TARGET ?? "bun-linux-arm64"
const outfile = process.env.OUTFILE ?? path.join(root, "dist", "cogagent-" + target.replace("bun-", ""))

// Bun 会在这条 sideEffects-free 模块里丢掉 `export * from "ws"`，导致编译后 NodeWS 的具名导出全空。
const wsReexportPlugin: BunPlugin = {
  name: "ws-named-reexports",
  setup(build) {
    build.onLoad({ filter: /platform-node-shared[/\\]dist[/\\]NodeWS\.js$/ }, () => ({
      contents:
        'export { createWebSocketStream, extension, Receiver, Sender, subprotocol, WebSocket, WebSocketServer } from "ws"',
      loader: "js",
    }))
  },
}

// 编译后二进制里没有 node_modules，插件的运行时模块必须在构建期解析成静态表。
const pluginRuntimeEntries = discoverPluginRuntimeSpecifiers()
const pluginRuntimeSource = [
  "export const resolveHostPackageRoots = () => []",
  "const modules = {",
  ...[...pluginRuntimeEntries.keys()].map(
    (specifier) => "  " + JSON.stringify(specifier) + ": " + pluginRuntimeLoaderCode(specifier, pluginRuntimeEntries) + ",",
  ),
  "}",
  "export const loadRuntimeModules = () => modules",
].join("\n")
const pluginRuntimePlugin: BunPlugin = {
  name: "plugin-runtime-static",
  setup(build) {
    build.onLoad({ filter: /plugin[/\\]src[/\\]runtime-modules\.ts$/ }, () => ({
      contents: pluginRuntimeSource,
      loader: "ts",
    }))
  },
}

// 编译后的服务子进程会在运行时解析 @opencode/pty-<platform>，而 $bunfs 里没有 node_modules，
// 所以把目标平台的 pty 二进制在构建期嵌进去（找不到就退化成 stub）。
const ptyTarget = target.replace("bun-", "").split("-")
const ptySpec = "@opencode/pty-" + ptyTarget[0] + "-" + ptyTarget[1] + "-" + (ptyTarget[2] === "musl" ? "musl" : "gnu")
const ptyPlugin: BunPlugin = {
  name: "pty-binary",
  setup(build) {
    build.onLoad({ filter: /persistent-pty[/\\]pty-binding\.ts$/ }, async () => {
      try {
        const pkgFile = Bun.resolveSync(ptySpec + "/package.json", dir)
        const pkg = await Bun.file(pkgFile).json()
        const bin = path.join(path.dirname(pkgFile), "bin", "opencode-pty")
        const bytes = new Uint8Array(await Bun.file(bin).arrayBuffer())
        const sha256 = createHash("sha256").update(bytes).digest("hex")
        return {
          loader: "js",
          contents:
            "import file from " + JSON.stringify(bin.replaceAll("\\", "/")) +
            ' with { type: "file" }\nexport default { path: file, version: ' +
            JSON.stringify(pkg.version) + ", sha256: " + JSON.stringify(sha256) + " }",
        }
      } catch {
        return { loader: "js", contents: "export default undefined" }
      }
    })
  },
}

const result = await Bun.build({
  entrypoints: [path.join(dir, "src/index.ts")],
  target: "bun",
  compile: { target, outfile },
  plugins: [createSolidTransformPlugin(), wsReexportPlugin, pluginRuntimePlugin, ptyPlugin],
  define: {
    "process.env.OPENCODE_CLI_NAME": JSON.stringify("cogagent"),
  },
  throw: false,
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

console.log("built " + outfile)
