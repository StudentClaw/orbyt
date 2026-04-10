import { randomBytes } from "node:crypto"
import { spawn } from "node:child_process"
import process from "node:process"

const port = process.env.PORT ?? "8787"
const wsAuthToken = randomBytes(32).toString("hex")
const sharedEnv = {
  ...process.env,
  PORT: port,
  WS_AUTH_TOKEN: wsAuthToken,
  VITE_STANDALONE_WS_URL: `ws://127.0.0.1:${port}`,
  VITE_STANDALONE_WS_AUTH_TOKEN: wsAuthToken,
  VITE_STANDALONE_APP_VERSION: "0.1.0",
  VITE_STANDALONE_PLATFORM: process.platform,
}

let shuttingDown = false
let requestedExitCode = 0

await runCommand("bun", ["run", "build:shared"], process.env)

process.stdout.write(`Standalone dev bootstrap ready at ws://127.0.0.1:${port}\n`)

const server = spawn("bun", ["--cwd", "packages/server", "dev"], {
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
  waitForExit("server", server),
  waitForExit("ui", ui),
])

shutdown("SIGTERM")
process.exitCode = shuttingDown ? requestedExitCode : result.code

async function runCommand(command, args, env) {
  const child = spawn(command, args, {
    env,
    stdio: "inherit",
  })

  const result = await waitForExit(command, child)
  if (result.code !== 0) {
    process.exit(result.code)
  }
}

function waitForExit(label, child) {
  return new Promise((resolve) => {
    child.on("exit", (code, signal) => {
      if (signal && !shuttingDown) {
        process.stderr.write(`${label} exited from signal ${signal}\n`)
      }

      resolve({ code: shuttingDown ? requestedExitCode : (code ?? 1) })
    })
    child.on("error", (error) => {
      process.stderr.write(`${label} failed to start: ${String(error)}\n`)
      resolve({ code: 1 })
    })
  })
}
