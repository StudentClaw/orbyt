import { EventEmitter } from "node:events"
import { describe, expect, test } from "bun:test"
import { buildOfficialNotionCliLaunchSpec, runOfficialNotionMcpServer } from "./index.js"

class FakeChildProcess extends EventEmitter {
  killedWith: NodeJS.Signals | null = null

  kill(signal?: NodeJS.Signals): boolean {
    this.killedWith = signal ?? null
    return true
  }
}

describe("Notion MCP stdio wrapper", () => {
  test("launches the official server in stdio mode with inherited credentials env", () => {
    const env = { NOTION_TOKEN: "ntn_12345678901234567890" }
    const launch = buildOfficialNotionCliLaunchSpec(env)

    expect(launch.command).toBe(process.execPath)
    expect(launch.args[0]).toMatch(/@notionhq[/\\]notion-mcp-server[/\\]bin[/\\]cli\.mjs$/)
    expect(launch.args.slice(1)).toEqual(["--transport", "stdio"])
    expect(launch.env).toBe(env)
  })

  test("proxies stdio to the official child process and exits with the child", () => {
    const fakeChild = new FakeChildProcess()
    const spawnCalls: unknown[] = []
    const exitCodes: number[] = []
    const stderrLines: string[] = []

    runOfficialNotionMcpServer({
      env: { NOTION_TOKEN: "ntn_12345678901234567890" },
      spawnImpl: ((command: string, args: string[], options: unknown) => {
        spawnCalls.push({ command, args, options })
        return fakeChild
      }) as never,
      exit: ((code: number): never => {
        exitCodes.push(code)
        throw new Error(`exit:${code}`)
      }) as never,
      stderr: {
        write: (message: string) => {
          stderrLines.push(message)
          return true
        },
      },
    })

    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0]).toMatchObject({
      command: process.execPath,
      args: [expect.stringContaining("@notionhq"), "--transport", "stdio"],
      options: {
        env: { NOTION_TOKEN: "ntn_12345678901234567890" },
        stdio: "inherit",
        shell: false,
      },
    })

    expect(() => {
      fakeChild.emit("exit", 7, null)
    }).toThrow("exit:7")
    expect(exitCodes).toEqual([7])
    expect(stderrLines).toEqual([])
  })
})
