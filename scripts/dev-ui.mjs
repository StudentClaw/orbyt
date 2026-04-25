import { spawn } from "node:child_process"
import process from "node:process"
import { getSharedDevEnv, runCommand, waitForExit } from "./dev-shared-env.mjs"

const env = getSharedDevEnv(process.env)
let shuttingDown = false

await runCommand("bun", ["run", "build:shared"], process.env)
process.stdout.write(`Local UI bootstrap targeting ${env.VITE_STANDALONE_WS_URL}\n`)

const ui = spawn("bun", ["--cwd", "packages/ui", "dev"], {
  env,
  stdio: "inherit",
})

const shutdown = (signal = "SIGTERM") => {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  if (!ui.killed) {
    ui.kill(signal)
  }
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

const result = await waitForExit("ui", ui)
process.exitCode = shuttingDown ? 0 : result.code
