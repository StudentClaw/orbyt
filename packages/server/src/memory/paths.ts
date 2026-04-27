import { homedir } from "node:os"
import { join, resolve } from "node:path"
import {
  DAILY_DIR,
  GRAPH_DIR,
  MEMORIZE_STATE_FILENAME,
  MEMORY_ROOT_FILENAME,
  type ScaffoldBranch,
  WEEKLY_DIR,
} from "@orbyt/contracts"

const ORBYT_HOME_ENV = "ORBYT_HOME"
const DEFAULT_HOME_DIR = ".orbyt"
const DEFAULT_GRAPH_DIR = "Orbyt Memory Graph"
const DOCUMENTS_DIR = "Documents"
const MEMORY_DIR = "memory"
const COURSES_DIR = "courses"
const PLAYBOOKS_DIR = "playbooks"
const SCHOOL_BRANCH: ScaffoldBranch = "school"

export interface MemoryPathsResolverInput {
  readonly env?: NodeJS.ProcessEnv
  readonly graphDirOverride?: string | null
  readonly home?: () => string
}

export interface MemoryPaths {
  readonly root: string
  readonly memoryFile: string
  readonly stateFile: string
  readonly errorLog: string
  readonly dailyDir: string
  readonly weeklyDir: string
  readonly graphDir: string
  readonly schoolDir: string
  readonly coursesDir: string
  readonly playbooksDir: string
  readonly branchIndex: (branch: ScaffoldBranch) => string
  readonly dailyFile: (isoDate: string) => string
  readonly weeklyFile: (isoWeek: string) => string
  readonly courseDir: (slug: string) => string
  readonly courseIndex: (slug: string) => string
  readonly playbookFile: (slug: string) => string
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const ISO_WEEK_PATTERN = /^\d{4}-W\d{2}$/
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function assertIsoDate(value: string): void {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`Invalid daily date, expected YYYY-MM-DD: ${value}`)
  }
}

function assertIsoWeek(value: string): void {
  if (!ISO_WEEK_PATTERN.test(value)) {
    throw new Error(`Invalid ISO week, expected YYYY-Www: ${value}`)
  }
}

function assertSlug(value: string): void {
  if (!SLUG_PATTERN.test(value)) {
    throw new Error(`Invalid slug, expected kebab-case: ${value}`)
  }
}

function resolvePathLike(
  value: string,
  home: () => string,
): string {
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
  if (primary && primary.length > 0) {
    return primary
  }
  return undefined
}

export function resolveMemoryRoot(
  input: MemoryPathsResolverInput = {},
): string {
  const env = input.env ?? process.env
  const home = input.home ?? homedir
  const raw = readHomeOverride(env)
  const base = raw && raw.length > 0
    ? resolvePathLike(raw, home)
    : join(home(), DEFAULT_HOME_DIR)
  return join(base, MEMORY_DIR)
}

export function resolveDefaultMemoryGraphDir(
  input: MemoryPathsResolverInput = {},
): string {
  const env = input.env ?? process.env
  const home = input.home ?? homedir
  const raw = readHomeOverride(env)

  if (raw && raw.length > 0) {
    return join(resolvePathLike(raw, home), MEMORY_DIR, GRAPH_DIR)
  }

  return join(home(), DOCUMENTS_DIR, DEFAULT_GRAPH_DIR)
}

export function resolveMemoryGraphDir(
  input: MemoryPathsResolverInput = {},
): string {
  const home = input.home ?? homedir
  const override = input.graphDirOverride?.trim()
  if (override && override.length > 0) {
    return resolvePathLike(override, home)
  }
  return resolveDefaultMemoryGraphDir(input)
}

export function createMemoryPaths(
  input: MemoryPathsResolverInput = {},
): MemoryPaths {
  const root = resolveMemoryRoot(input)
  const graphDir = resolveMemoryGraphDir(input)
  const schoolDir = join(graphDir, SCHOOL_BRANCH)
  const coursesDir = join(schoolDir, COURSES_DIR)
  const playbooksDir = join(schoolDir, PLAYBOOKS_DIR)

  return {
    root,
    memoryFile: join(root, MEMORY_ROOT_FILENAME),
    stateFile: join(root, MEMORIZE_STATE_FILENAME),
    errorLog: join(root, "memorize-error.log"),
    dailyDir: join(root, DAILY_DIR),
    weeklyDir: join(root, WEEKLY_DIR),
    graphDir,
    schoolDir,
    coursesDir,
    playbooksDir,
    branchIndex: (branch) => join(graphDir, branch, "index.md"),
    dailyFile: (isoDate) => {
      assertIsoDate(isoDate)
      return join(root, DAILY_DIR, `${isoDate}.md`)
    },
    weeklyFile: (isoWeek) => {
      assertIsoWeek(isoWeek)
      return join(root, WEEKLY_DIR, `${isoWeek}.md`)
    },
    courseDir: (slug) => {
      assertSlug(slug)
      return join(coursesDir, slug)
    },
    courseIndex: (slug) => {
      assertSlug(slug)
      return join(coursesDir, slug, "index.md")
    },
    playbookFile: (slug) => {
      assertSlug(slug)
      return join(playbooksDir, `${slug}.md`)
    },
  }
}
