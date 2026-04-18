export type ShellCommandApprovalCategory =
  | "safe-project-inspection"
  | "safe-git-read"
  | "safe-direct-check"
  | "safe-package-script"
  | "delete"
  | "move-or-replace"
  | "file-change"
  | "file-permissions"
  | "package-install"
  | "git-write"
  | "network"
  | "advanced"
  | "unknown"

export type ShellCommandApprovalClassification = {
  readonly rawCommand: string
  readonly tokens: readonly string[]
  readonly category: ShellCommandApprovalCategory
  readonly autoApprove: boolean
  readonly question: string
  readonly detail: string
}

const SAFE_PACKAGE_MANAGER_SCRIPTS = new Set([
  "build",
  "check",
  "lint",
  "test",
  "typecheck",
])

const SAFE_PROJECT_INSPECTION_COMMANDS = new Set([
  "pwd",
  "ls",
  "rg",
  "grep",
  "cat",
  "head",
  "tail",
  "wc",
  "stat",
  "file",
  "tree",
  "which",
  "pdfinfo",
])

const SHELL_WRAPPER_EXECUTABLES = new Set(["sh", "bash", "zsh"])
const VERSION_FLAGS = new Set(["-v", "-V", "--version"])
const WATCH_FLAGS = new Set(["--watch", "-w", "watch"])

type ParsedShellCommand = {
  readonly tokens: readonly string[]
  readonly hasComplexSyntax: boolean
}

function tokenizeShellLikeCommand(command: string): ParsedShellCommand {
  const tokens: string[] = []
  let current = ""
  let quote: "'" | "\"" | null = null
  let escaping = false
  let hasComplexSyntax = false

  const pushCurrent = () => {
    if (current.length > 0) {
      tokens.push(current)
      current = ""
    }
  }

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index]

    if (escaping) {
      current += char
      escaping = false
      continue
    }

    if (quote === "'") {
      if (char === "'") {
        quote = null
      } else {
        current += char
      }
      continue
    }

    if (quote === "\"") {
      if (char === "\"") {
        quote = null
        continue
      }
      if (char === "\\") {
        escaping = true
        continue
      }
      current += char
      continue
    }

    if (char === "'" || char === "\"") {
      quote = char
      continue
    }

    if (char === "\\") {
      escaping = true
      continue
    }

    if (char !== undefined && /\s/.test(char)) {
      pushCurrent()
      continue
    }

    if (
      char === ";"
      || char === "|"
      || char === "&"
      || char === ">"
      || char === "<"
      || char === "`"
      || char === "("
      || char === ")"
      || char === "$"
    ) {
      hasComplexSyntax = true
    }

    current += char
  }

  if (escaping || quote !== null) {
    hasComplexSyntax = true
  }

  pushCurrent()

  return {
    tokens,
    hasComplexSyntax,
  }
}

function isFlag(token: string): boolean {
  return token.startsWith("-") && token !== "-"
}

function countTargets(tokens: readonly string[]): number {
  return tokens.slice(1).filter((token) => token !== "--" && !isFlag(token)).length
}

function hasAnyToken(tokens: readonly string[], values: readonly string[]): boolean {
  return tokens.some((token) => values.includes(token))
}

function hasAnyFlag(tokens: readonly string[], values: ReadonlySet<string>): boolean {
  return tokens.some((token) => values.has(token))
}

function usesPathLikeExecutable(token: string | undefined): boolean {
  if (!token) {
    return false
  }

  return token.includes("/") || token.includes("\\")
}

function getExecutableBasename(token: string | undefined): string | null {
  if (!token) {
    return null
  }

  const parts = token.split(/[/\\]/)
  const basename = parts.at(-1)?.trim() ?? ""
  return basename.length > 0 ? basename : null
}

function splitUnquotedPipeline(command: string): readonly string[] | null {
  const segments: string[] = []
  let current = ""
  let quote: "'" | "\"" | null = null
  let escaping = false
  let sawPipeline = false

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index]
    const next = command[index + 1]

    if (escaping) {
      current += char
      escaping = false
      continue
    }

    if (char === "\\") {
      current += char
      escaping = true
      continue
    }

    if (quote === "'") {
      current += char
      if (char === "'") {
        quote = null
      }
      continue
    }

    if (quote === "\"") {
      current += char
      if (char === "\"") {
        quote = null
      }
      continue
    }

    if (char === "'" || char === "\"") {
      current += char
      quote = char
      continue
    }

    if (char === "|") {
      if (next === "|" || next === "&") {
        return null
      }

      const trimmed = current.trim()
      if (trimmed.length === 0) {
        return null
      }

      sawPipeline = true
      segments.push(trimmed)
      current = ""
      continue
    }

    current += char
  }

  if (escaping || quote !== null) {
    return null
  }

  const finalSegment = current.trim()
  if (!sawPipeline || finalSegment.length === 0) {
    return null
  }

  segments.push(finalSegment)
  return segments
}

function readShellWrappedInnerCommand(tokens: readonly string[]): string | null {
  const executable = getExecutableBasename(tokens[0])
  if (!executable || !SHELL_WRAPPER_EXECUTABLES.has(executable)) {
    return null
  }

  const args = tokens.slice(1)
  let commandIndex = -1

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "-c" || arg === "-lc" || arg === "-cl") {
      commandIndex = index + 1
      break
    }

    if (
      arg === "-l"
      || arg === "--login"
      || arg === "-i"
      || arg === "--interactive"
    ) {
      continue
    }

    return null
  }

  if (commandIndex < 0 || commandIndex !== args.length - 1) {
    return null
  }

  const innerCommand = args[commandIndex]?.trim() ?? ""
  return innerCommand.length > 0 ? innerCommand : null
}

function makeClassification(
  rawCommand: string,
  tokens: readonly string[],
  category: ShellCommandApprovalCategory,
  autoApprove: boolean,
  question: string,
  detail: string,
): ShellCommandApprovalClassification {
  return {
    rawCommand,
    tokens,
    category,
    autoApprove,
    question,
    detail,
  }
}

function classifyPackageManagerCommand(
  rawCommand: string,
  tokens: readonly string[],
): ShellCommandApprovalClassification | null {
  const executable = tokens[0]
  const args = tokens.slice(1)
  if (!executable || !["bun", "npm", "pnpm", "yarn"].includes(executable)) {
    return null
  }

  if (args.length === 0) {
    return null
  }

  if (hasAnyFlag(args, VERSION_FLAGS)) {
    return makeClassification(
      rawCommand,
      tokens,
      "safe-project-inspection",
      true,
      "Can I check which tools are installed?",
      "This only checks local tool versions.",
    )
  }

  if (
    (executable === "bun" && (args[0] === "install" || args[0] === "add"))
    || (executable === "npm" && ["install", "ci", "add", "update"].includes(args[0]!))
    || (executable === "pnpm" && ["install", "add", "update"].includes(args[0]!))
    || (executable === "yarn" && ["install", "add", "upgrade"].includes(args[0]!))
  ) {
    return makeClassification(
      rawCommand,
      tokens,
      "package-install",
      false,
      "Can I install new packages for this project?",
      "This may change project dependencies.",
    )
  }

  const scriptName =
    executable === "bun"
      ? args[0] === "test"
        ? "test"
        : args[0] === "run"
          ? args[1] ?? null
          : null
      : executable === "npm"
        ? args[0] === "test"
          ? "test"
          : args[0] === "run"
            ? args[1] ?? null
            : null
        : args[0] === "run"
          ? args[1] ?? null
          : args[0] ?? null

  const scriptArgs =
    executable === "bun"
      ? args[0] === "test"
        ? args.slice(1)
        : args[0] === "run"
          ? args.slice(2)
          : []
      : executable === "npm"
        ? args[0] === "test"
          ? args.slice(1)
          : args[0] === "run"
            ? args.slice(2)
            : []
        : args[0] === "run"
          ? args.slice(2)
          : args.slice(1)

  if (
    scriptName
    && SAFE_PACKAGE_MANAGER_SCRIPTS.has(scriptName)
    && !hasAnyFlag(scriptArgs, WATCH_FLAGS)
  ) {
    return makeClassification(
      rawCommand,
      tokens,
      "safe-package-script",
      true,
      "Can I run this project check?",
      "This stays within the project and runs a normal test, build, lint, or typecheck command.",
    )
  }

  return null
}

function classifyGitCommand(
  rawCommand: string,
  tokens: readonly string[],
): ShellCommandApprovalClassification | null {
  if (tokens[0] !== "git") {
    return null
  }

  const subcommand = tokens[1]
  if (!subcommand) {
    return makeClassification(
      rawCommand,
      tokens,
      "advanced",
      false,
      "Can I run a more advanced command that may change project files?",
      "I could not confidently classify this git command as harmless.",
    )
  }

  if (["status", "diff", "log", "show", "rev-parse", "ls-files"].includes(subcommand)) {
    return makeClassification(
      rawCommand,
      tokens,
      "safe-git-read",
      true,
      "Can I inspect git status and history?",
      "This only reads version control information.",
    )
  }

  if (subcommand === "branch" && tokens.slice(2).every((token) => token === "--show-current")) {
    return makeClassification(
      rawCommand,
      tokens,
      "safe-git-read",
      true,
      "Can I inspect git status and history?",
      "This only reads version control information.",
    )
  }

  if (["clone", "fetch", "pull", "push"].includes(subcommand)) {
    return makeClassification(
      rawCommand,
      tokens,
      "network",
      false,
      "Can I connect to the internet for this step?",
      "This would send or download data.",
    )
  }

  return makeClassification(
    rawCommand,
    tokens,
    "git-write",
    false,
    "Can I change git history or create a commit?",
    "This affects version control for the project.",
  )
}

function classifyDirectCommand(
  rawCommand: string,
  tokens: readonly string[],
): ShellCommandApprovalClassification {
  const executable = tokens[0]
  if (!executable) {
    return makeClassification(
      rawCommand,
      tokens,
      "unknown",
      false,
      "Can I run a more advanced command that may change project files?",
      "I could not confidently classify this command as harmless.",
    )
  }

  if (usesPathLikeExecutable(executable) || /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(executable)) {
    return makeClassification(
      rawCommand,
      tokens,
      "advanced",
      false,
      "Can I run a more advanced command that may change project files?",
      "I could not confidently classify this command as harmless.",
    )
  }

  if (SAFE_PROJECT_INSPECTION_COMMANDS.has(executable)) {
    return makeClassification(
      rawCommand,
      tokens,
      "safe-project-inspection",
      true,
      "Can I inspect the project?",
      "This only reads local files and folders.",
    )
  }

  if (executable === "pdftotext") {
    const targets = tokens.slice(1).filter((token) => token !== "--" && !isFlag(token))
    if (targets.length >= 2 && targets.at(-1) === "-") {
      return makeClassification(
        rawCommand,
        tokens,
        "safe-project-inspection",
        true,
        "Can I inspect the project?",
        "This only reads a local PDF and streams extracted text to standard output.",
      )
    }

    return makeClassification(
      rawCommand,
      tokens,
      "file-change",
      false,
      "Can I change files from the command line?",
      "This may create or replace extracted text files.",
    )
  }

  if (executable === "find") {
    if (hasAnyToken(tokens, ["-delete", "-exec", "-execdir", "-ok", "-okdir"])) {
      const targetCount = countTargets(tokens)
      return makeClassification(
        rawCommand,
        tokens,
        "delete",
        false,
        targetCount > 1 ? "Can I delete these items?" : "Can I delete this item?",
        "This would remove data from the project.",
      )
    }

    return makeClassification(
      rawCommand,
      tokens,
      "safe-project-inspection",
      true,
      "Can I inspect the project?",
      "This only reads local files and folders.",
    )
  }

  if (executable === "sed") {
    if (hasAnyToken(tokens, ["-i", "--in-place"])) {
      return makeClassification(
        rawCommand,
        tokens,
        "file-change",
        false,
        "Can I change files from the command line?",
        "This step would directly modify files in the project.",
      )
    }

    return makeClassification(
      rawCommand,
      tokens,
      "safe-project-inspection",
      true,
      "Can I inspect the project?",
      "This only reads local files and folders.",
    )
  }

  if (executable === "rm" || executable === "rmdir") {
    const targetCount = countTargets(tokens)
    return makeClassification(
      rawCommand,
      tokens,
      "delete",
      false,
      targetCount > 1 ? "Can I delete these items?" : "Can I delete this item?",
      "This would remove data from the project.",
    )
  }

  if (executable === "mv" || executable === "cp") {
    return makeClassification(
      rawCommand,
      tokens,
      "move-or-replace",
      false,
      "Can I move or replace a file?",
      "This would change files in the project.",
    )
  }

  if (["mkdir", "touch", "ln"].includes(executable)) {
    return makeClassification(
      rawCommand,
      tokens,
      "file-change",
      false,
      "Can I change files from the command line?",
      "This step would directly modify files in the project.",
    )
  }

  if (["chmod", "chown"].includes(executable)) {
    return makeClassification(
      rawCommand,
      tokens,
      "file-permissions",
      false,
      "Can I change file permissions?",
      "This would change who can access or run files.",
    )
  }

  if (["curl", "wget", "ssh", "scp", "ping"].includes(executable)) {
    return makeClassification(
      rawCommand,
      tokens,
      "network",
      false,
      "Can I connect to the internet for this step?",
      "This would send or download data.",
    )
  }

  if (
    executable === "python"
    || executable === "python3"
    || executable === "node"
  ) {
    if (hasAnyFlag(tokens.slice(1), VERSION_FLAGS)) {
      return makeClassification(
        rawCommand,
        tokens,
        "safe-project-inspection",
        true,
        "Can I check which tools are installed?",
        "This only checks local tool versions.",
      )
    }
  }

  if (executable === "tsc" && !hasAnyFlag(tokens.slice(1), WATCH_FLAGS)) {
    return makeClassification(
      rawCommand,
      tokens,
      "safe-direct-check",
      true,
      "Can I run a code check?",
      "This runs a normal project verification command.",
    )
  }

  if (executable === "eslint" && !hasAnyToken(tokens, ["--fix"])) {
    return makeClassification(
      rawCommand,
      tokens,
      "safe-direct-check",
      true,
      "Can I run a code check?",
      "This runs a normal project verification command.",
    )
  }

  if (
    executable === "prettier"
    && !hasAnyToken(tokens, ["--write"])
    && hasAnyToken(tokens, ["--check", "--list-different"])
  ) {
    return makeClassification(
      rawCommand,
      tokens,
      "safe-direct-check",
      true,
      "Can I run a code check?",
      "This runs a normal project verification command.",
    )
  }

  if (
    (executable === "vitest" || executable === "jest")
    && !hasAnyFlag(tokens.slice(1), WATCH_FLAGS)
  ) {
    return makeClassification(
      rawCommand,
      tokens,
      "safe-direct-check",
      true,
      "Can I run a code check?",
      "This runs a normal project verification command.",
    )
  }

  return makeClassification(
    rawCommand,
    tokens,
    "advanced",
    false,
    "Can I run a more advanced command that may change project files?",
    "I could not confidently classify this command as harmless.",
  )
}

function classifyWrappedShellCommand(
  rawCommand: string,
  tokens: readonly string[],
): ShellCommandApprovalClassification | null {
  const innerCommand = readShellWrappedInnerCommand(tokens)
  if (!innerCommand) {
    return null
  }

  const innerClassification = classifyShellCommandForApproval(innerCommand)
  return makeClassification(
    rawCommand,
    tokens,
    innerClassification.category,
    innerClassification.autoApprove,
    innerClassification.question,
    innerClassification.detail,
  )
}

export function classifyShellCommandForApproval(
  command: string | null | undefined,
): ShellCommandApprovalClassification {
  const rawCommand = command?.trim() ?? ""
  if (!rawCommand) {
    return makeClassification(
      "",
      [],
      "unknown",
      false,
      "Can I run a more advanced command that may change project files?",
      "I could not confidently classify this command as harmless.",
    )
  }

  const pipelineSegments = splitUnquotedPipeline(rawCommand)
  if (pipelineSegments) {
    const classifications = pipelineSegments.map((segment) =>
      classifyShellCommandForApproval(segment),
    )
    const firstDenied = classifications.find((classification) => !classification.autoApprove)
    if (firstDenied) {
      return makeClassification(
        rawCommand,
        pipelineSegments,
        firstDenied.category,
        false,
        firstDenied.question,
        firstDenied.detail,
      )
    }

    const firstAllowed = classifications[0]!
    return makeClassification(
      rawCommand,
      pipelineSegments,
      firstAllowed.category,
      true,
      firstAllowed.question,
      firstAllowed.detail,
    )
  }

  const parsed = tokenizeShellLikeCommand(rawCommand)
  if (parsed.tokens.length === 0 || parsed.hasComplexSyntax) {
    return makeClassification(
      rawCommand,
      parsed.tokens,
      "advanced",
      false,
      "Can I run a more advanced command that may change project files?",
      "I could not confidently classify this command as harmless.",
    )
  }

  return (
    classifyWrappedShellCommand(rawCommand, parsed.tokens)
    ?? classifyPackageManagerCommand(rawCommand, parsed.tokens)
    ?? classifyGitCommand(rawCommand, parsed.tokens)
    ?? classifyDirectCommand(rawCommand, parsed.tokens)
  )
}

export function shouldAutoApproveShellCommand(
  command: string | null | undefined,
): boolean {
  return classifyShellCommandForApproval(command).autoApprove
}
