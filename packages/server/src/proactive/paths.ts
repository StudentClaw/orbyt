import { homedir } from "node:os"
import { join, resolve } from "node:path"

const ORBYT_HOME_ENV = "ORBYT_HOME"
const LEGACY_ORBYT_HOME_ENV = "STUDENT_CLAW_HOME"
const DEFAULT_HOME_DIR = ".orbyt"
const PROACTIVE_DIR = "proactive"

export interface ProactivePathsResolverInput {
  readonly env?: NodeJS.ProcessEnv
  readonly home?: () => string
}

export interface ProactivePaths {
  readonly root: string
  readonly soulFile: string
  readonly heartbeatFile: string
  readonly workingBufferFile: string
  readonly sessionsDir: string
  readonly sessionDir: (jobId: string) => string
}

function resolvePathLike(value: string, home: () => string): string {
  const trimmed = value.trim()
  const expanded = trimmed === "~"
    ? home()
    : trimmed.startsWith("~/")
      ? join(home(), trimmed.slice(2))
      : trimmed
  return resolve(expanded)
}

function readHomeOverride(env: NodeJS.ProcessEnv): string | undefined {
  const primary = env[ORBYT_HOME_ENV]?.trim()
  if (primary && primary.length > 0) return primary
  const legacy = env[LEGACY_ORBYT_HOME_ENV]?.trim()
  if (legacy && legacy.length > 0) return legacy
  return undefined
}

export function resolveProactiveRoot(
  input: ProactivePathsResolverInput = {},
): string {
  const env = input.env ?? process.env
  const home = input.home ?? homedir
  const raw = readHomeOverride(env)
  const base = raw && raw.length > 0
    ? resolvePathLike(raw, home)
    : join(home(), DEFAULT_HOME_DIR)
  return join(base, PROACTIVE_DIR)
}

export function createProactivePaths(
  input: ProactivePathsResolverInput = {},
): ProactivePaths {
  const root = resolveProactiveRoot(input)
  return {
    root,
    soulFile: join(root, "SOUL.md"),
    heartbeatFile: join(root, "HEARTBEAT.md"),
    workingBufferFile: join(root, "WORKING_BUFFER.md"),
    sessionsDir: join(root, "sessions"),
    sessionDir: (jobId) => join(root, "sessions", jobId),
  }
}
