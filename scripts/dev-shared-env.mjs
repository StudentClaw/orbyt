import process from "node:process"

const AUTH_TOKEN_PATTERN = /^[a-f0-9]{64}$/i
const DEFAULT_DEV_PORT = "8787"
const DEFAULT_DEV_WS_AUTH_TOKEN = "d".repeat(64)

function resolvePort(baseEnv) {
  const rawPort = String(baseEnv.PORT ?? DEFAULT_DEV_PORT)
  const port = Number(rawPort)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${rawPort}`)
  }
  return String(port)
}

function resolveWsAuthToken(baseEnv) {
  const explicit = baseEnv.WS_AUTH_TOKEN ?? baseEnv.VITE_STANDALONE_WS_AUTH_TOKEN
  if (!explicit) {
    return DEFAULT_DEV_WS_AUTH_TOKEN
  }

  if (!AUTH_TOKEN_PATTERN.test(explicit)) {
    throw new Error("WS auth token must be a 64-character hex string")
  }

  return explicit
}

export function getSharedDevEnv(baseEnv = process.env) {
  const port = resolvePort(baseEnv)
  const wsAuthToken = resolveWsAuthToken(baseEnv)

  return {
    ...baseEnv,
    PORT: port,
    WS_AUTH_TOKEN: wsAuthToken,
    VITE_STANDALONE_WS_URL: baseEnv.VITE_STANDALONE_WS_URL ?? `ws://127.0.0.1:${port}`,
    VITE_STANDALONE_WS_AUTH_TOKEN: wsAuthToken,
    VITE_STANDALONE_APP_VERSION: baseEnv.VITE_STANDALONE_APP_VERSION ?? "0.1.0",
    VITE_STANDALONE_PLATFORM: baseEnv.VITE_STANDALONE_PLATFORM ?? process.platform,
  }
}

export function waitForExit(label, child) {
  return new Promise((resolve) => {
    child.on("exit", (code, signal) => {
      if (signal) {
        process.stderr.write(`${label} exited from signal ${signal}\n`)
      }

      resolve({ code: code ?? 1 })
    })
    child.on("error", (error) => {
      process.stderr.write(`${label} failed to start: ${String(error)}\n`)
      resolve({ code: 1 })
    })
  })
}

export async function runCommand(command, args, env) {
  const { spawn } = await import("node:child_process")
  const child = spawn(command, args, {
    env,
    stdio: "inherit",
  })

  const result = await waitForExit(command, child)
  if (result.code !== 0) {
    process.exit(result.code)
  }
}
