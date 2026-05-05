import { spawn, type ChildProcess } from "node:child_process"
import { createRequire } from "node:module"

export type NotionCliLaunchSpec = {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
}

export type RunOfficialNotionMcpServerOptions = {
  spawnImpl?: typeof spawn
  env?: NodeJS.ProcessEnv
  exit?: (code: number) => never
  stderr?: Pick<NodeJS.WriteStream, "write">
}

const require = createRequire(import.meta.url)

export function resolveOfficialNotionCliPath(): string {
  return require.resolve("@notionhq/notion-mcp-server/bin/cli.mjs")
}

export function buildOfficialNotionCliLaunchSpec(env: NodeJS.ProcessEnv = process.env): NotionCliLaunchSpec {
  return {
    command: process.execPath,
    args: [resolveOfficialNotionCliPath(), "--transport", "stdio"],
    env,
  }
}

export function runOfficialNotionMcpServer(options: RunOfficialNotionMcpServerOptions = {}): ChildProcess {
  const launch = buildOfficialNotionCliLaunchSpec(options.env ?? process.env)
  const exit = options.exit ?? ((code: number): never => process.exit(code))
  const stderr = options.stderr ?? process.stderr

  const child = (options.spawnImpl ?? spawn)(launch.command, launch.args, {
    env: launch.env,
    stdio: "inherit",
    shell: false,
  })

  child.on("error", (error) => {
    stderr.write(`[notion-mcp] ${error instanceof Error ? error.message : String(error)}\n`)
    exit(1)
  })

  child.on("exit", (code, signal) => {
    if (signal) {
      stderr.write(`[notion-mcp] official server exited from signal ${signal}\n`)
      exit(1)
    }

    exit(code ?? 0)
  })

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      child.kill(signal)
    })
  }

  return child
}

if (import.meta.main) {
  runOfficialNotionMcpServer()
}
