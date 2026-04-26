import { spawn } from "node:child_process"
import process from "node:process"
import { getSharedDevEnv, runCommand, waitForExit } from "./dev-shared-env.mjs"

const sharedEnv = getSharedDevEnv(process.env)

let shuttingDown = false
let requestedExitCode = 0

await runCommand("bun", ["run", "build:shared"], process.env)

process.stdout.write(`Standalone dev bootstrap ready at ${sharedEnv.VITE_STANDALONE_WS_URL}\n`)

const server = spawn("bun", ["--watch", "packages/server/src/index.ts"], {
  env: sharedEnv,
  stdio: "inherit",
})

const ui = spawn("bun", ["--cwd", "packages/ui", "dev"], {
  env: sharedEnv,
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
  if (!ui.killed) {
    ui.kill(signal)
  }
}

process.on("SIGINT", () => {
  requestedExitCode = 0
  shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  requestedExitCode = 0
  shutdown("SIGTERM")
})

const result = await Promise.race([
  waitForExitWithShutdown("server", server),
  waitForExitWithShutdown("ui", ui),
])

shutdown("SIGTERM")
process.exitCode = shuttingDown ? requestedExitCode : result.code

function waitForExitWithShutdown(label, child) {
  return waitForExit(label, child).then((result) => ({
    code: shuttingDown ? requestedExitCode : result.code,
  }))
}
