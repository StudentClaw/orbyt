import { spawn } from "node:child_process"
import process from "node:process"
import { getSharedDevEnv, runCommand, waitForExit } from "./dev-shared-env.mjs"

const env = getSharedDevEnv(process.env)
let shuttingDown = false

await runCommand("bun", ["run", "build:shared"], process.env)
process.stdout.write(`Local server bootstrap ready at ${env.VITE_STANDALONE_WS_URL}\n`)

const server = spawn("bun", ["--watch", "packages/server/src/index.ts"], {
  env,
  stdio: "inherit",
})

const shutdown = (signal = "SIGTERM") => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  if (!server.killed) {
    server.kill(signal)
  }
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

const result = await waitForExit("server", server)
process.exitCode = shuttingDown ? 0 : result.code
