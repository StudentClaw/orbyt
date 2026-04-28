import type {
  ProviderApprovalDecision,
  ProviderPendingApproval,
  ProviderRuntimeEvent,
  ThreadAccessMode,
} from "@orbyt/contracts"

// ============================================================================
// Shared error class
// ============================================================================

export class ProviderRuntimeFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = "ProviderRuntimeFailure"
  }
}

// ============================================================================
// Types
// ============================================================================

export type AgentMessagePhase = "commentary" | "final_answer" | "unknown"

export type ProviderMcpToolCallEvent = Extract<
  ProviderRuntimeEvent,
  { readonly type: "provider.mcpToolCall" }
>

export type CodexMcpToolCallSnapshot = {
  readonly itemId: string
  readonly serverName: string
  readonly toolName: string
  readonly args: unknown
  readonly status: "inProgress" | "completed" | "failed"
  readonly error?: string
}

export type ActiveTurn = {
  readonly localThreadId: string
  readonly localTurnId: string
  readonly providerThreadId: string
  providerTurnId: string | null
  readonly onToken: (token: string, index: number) => Promise<void>
  readonly onReasoning: (token: string, index: number) => Promise<void>
  readonly onCompleted: () => Promise<void>
  readonly onInterrupted: () => Promise<void>
  readonly onError: (error: ProviderRuntimeFailure) => Promise<void>
  readonly onMcpToolCall: (event: ProviderMcpToolCallEvent) => Promise<void>
  readonly onApprovalRequest: (approval: ProviderPendingApproval) => Promise<void>
  readonly agentMessagePhases: Map<string, AgentMessagePhase>
  readonly emittedTextLengths: Map<string, number>
  readonly mcpToolCalls: Map<string, Omit<CodexMcpToolCallSnapshot, "status" | "error">>
  tokenIndex: number
  reasoningIndex: number
  lastReasoningItemId: string | null
}

export type ActiveTurnLocator = Pick<ActiveTurn, "localThreadId" | "localTurnId">

export type PendingApprovalEntry = {
  readonly requestId: string | number
  readonly method:
    | "item/commandExecution/requestApproval"
    | "item/fileChange/requestApproval"
    | "item/permissions/requestApproval"
  readonly approval: ProviderPendingApproval
  readonly rawParams: unknown
}

// ============================================================================
// Constants
// ============================================================================

export const ORBYT_GATEWAY_TOKEN_ENV = "ORBYT_GATEWAY_BEARER_TOKEN"

// ============================================================================
// Type guards and readers
// ============================================================================

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

export function readErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  const error = value.error
  if (!isRecord(error) || typeof error.message !== "string") return undefined
  return error.message
}

export function readString(target: unknown, key: string): string | undefined {
  if (!isRecord(target)) return undefined
  const value = target[key]
  return typeof value === "string" ? value : undefined
}

// ============================================================================
// Item type classification
// ============================================================================

function normalizeCodexItemType(itemType: string): string {
  return itemType.replace(/[^a-z]/gi, "").toLowerCase()
}

export function isReasoningItemType(itemType: string | null | undefined): boolean {
  if (!itemType) {
    return false
  }

  const normalizedItemType = normalizeCodexItemType(itemType)
  return normalizedItemType.includes("reasoning") || normalizedItemType.includes("thinking")
}

export function normalizeAgentMessagePhase(
  phase: string | null | undefined,
): AgentMessagePhase {
  if (phase === "commentary" || phase === "final_answer") {
    return phase
  }

  return "unknown"
}

export function shouldTreatAgentMessageAsReasoning(
  phase: string | null | undefined,
): boolean {
  return normalizeAgentMessagePhase(phase) === "commentary"
}

// ============================================================================
// Params readers
// ============================================================================

export function readReasoningItemState(params: unknown): {
  readonly itemId: string | null
  readonly reasoningState: boolean | null
  readonly text: string | null
} {
  const item = isRecord(params) ? params.item : null
  const itemId = readString(item, "id") ?? readString(params, "itemId") ?? null
  const itemType =
    readString(item, "type")
    ?? readString(params, "itemType")
    ?? readString(params, "type")

  const summary = isRecord(item) && Array.isArray(item.summary)
    ? item.summary.filter((entry): entry is string => typeof entry === "string").join("")
    : ""
  const content = isRecord(item) && Array.isArray(item.content)
    ? item.content.filter((entry): entry is string => typeof entry === "string").join("")
    : ""

  return {
    itemId,
    reasoningState: itemType ? isReasoningItemType(itemType) : null,
    text: content || summary || null,
  }
}

export function readAgentMessageState(params: unknown): {
  readonly itemId: string | null
  readonly phase: AgentMessagePhase
  readonly text: string | null
} {
  const item = isRecord(params) ? params.item : null
  const itemId = readString(item, "id") ?? readString(params, "itemId") ?? null
  const phase =
    normalizeAgentMessagePhase(
      readString(item, "phase")
      ?? readString(params, "phase"),
    )
  const text = readString(item, "text") ?? null

  return {
    itemId,
    phase,
    text,
  }
}

// ============================================================================
// Token emission helpers
// ============================================================================

function recordEmittedTextLength(
  activeTurn: ActiveTurn,
  itemId: string,
  emittedLength: number,
): void {
  const currentLength = activeTurn.emittedTextLengths.get(itemId) ?? 0
  activeTurn.emittedTextLengths.set(itemId, currentLength + emittedLength)
}

async function emitReasoningParagraphSeparator(
  activeTurn: ActiveTurn,
  itemId: string | null,
): Promise<void> {
  if (
    itemId !== null
    && activeTurn.lastReasoningItemId !== null
    && activeTurn.lastReasoningItemId !== itemId
  ) {
    const sepIndex = activeTurn.reasoningIndex
    activeTurn.reasoningIndex += 1
    await activeTurn.onReasoning("\n\n", sepIndex)
  }

  if (itemId !== null) {
    activeTurn.lastReasoningItemId = itemId
  }
}

export async function emitTextByPhase(
  activeTurn: ActiveTurn,
  itemId: string | null,
  text: string,
  phase: AgentMessagePhase,
): Promise<void> {
  if (!text) {
    return
  }

  if (shouldTreatAgentMessageAsReasoning(phase)) {
    await emitReasoningParagraphSeparator(activeTurn, itemId)
    const nextIndex = activeTurn.reasoningIndex
    activeTurn.reasoningIndex += 1
    await activeTurn.onReasoning(text, nextIndex)
  } else {
    const nextIndex = activeTurn.tokenIndex
    activeTurn.tokenIndex += 1
    await activeTurn.onToken(text, nextIndex)
  }

  if (itemId) {
    recordEmittedTextLength(activeTurn, itemId, text.length)
  }
}

export async function emitReasoningText(
  activeTurn: ActiveTurn,
  itemId: string | null,
  text: string,
): Promise<void> {
  if (!text) {
    return
  }

  await emitReasoningParagraphSeparator(activeTurn, itemId)

  const nextIndex = activeTurn.reasoningIndex
  activeTurn.reasoningIndex += 1
  await activeTurn.onReasoning(text, nextIndex)

  if (itemId) {
    recordEmittedTextLength(activeTurn, itemId, text.length)
  }
}

// ============================================================================
// Turn lookup
// ============================================================================

export function findActiveTurnByProviderIds(
  activeProviderTurns: ReadonlyMap<string, ActiveTurn>,
  providerThreadId: string | null,
  providerTurnId: string | null,
): ActiveTurn | null {
  // Active turns are keyed by localTurnId, so we always scan. There are rarely
  // more than a handful of active turns; the O(n) cost is negligible and lets
  // us correlate notifications that arrive before the `turn/start` response
  // has populated `providerTurnId`.
  if (providerTurnId) {
    for (const entry of activeProviderTurns.values()) {
      if (entry.providerTurnId === providerTurnId) {
        return entry
      }
    }
  }

  if (!providerThreadId) {
    return null
  }

  // Fall back to matching by thread. Prefer a turn that has no providerTurnId
  // yet (the one still awaiting its `turn/start` response) so early
  // notifications adopt the correct registration.
  let threadMatch: ActiveTurn | null = null
  for (const entry of activeProviderTurns.values()) {
    if (entry.providerThreadId !== providerThreadId) continue
    if (!entry.providerTurnId) {
      return entry
    }
    threadMatch = threadMatch ?? entry
  }
  return threadMatch
}

// ============================================================================
// Approval handling
// ============================================================================

function simplifyApprovalDecisionChoices(
  value: unknown,
): ReadonlyArray<ProviderApprovalDecision> {
  if (!Array.isArray(value)) {
    return ["approve", "deny"]
  }

  const decisions = new Set<ProviderApprovalDecision>()
  for (const entry of value) {
    if (entry === "accept" || entry === "acceptForSession") {
      decisions.add("approve")
      continue
    }
    if (entry === "decline" || entry === "cancel") {
      decisions.add("deny")
      continue
    }
    if (isRecord(entry)) {
      if ("acceptWithExecpolicyAmendment" in entry || "applyNetworkPolicyAmendment" in entry) {
        decisions.add("approve")
      }
    }
  }

  if (decisions.size === 0) {
    return ["approve", "deny"]
  }

  return Array.from(decisions)
}

function deriveCommandArgv0(command: string | null): string | null {
  if (!command) return null
  const trimmed = command.trim()
  if (trimmed.length === 0) return null
  // First whitespace-delimited token; strip a leading path so e.g. /usr/bin/curl
  // shares a sticky decision with `curl` invoked from PATH.
  const head = trimmed.split(/\s+/, 1)[0] ?? ""
  const slashIdx = head.lastIndexOf("/")
  return slashIdx >= 0 ? head.slice(slashIdx + 1) : head
}

function deriveServerFromPermissionKey(key: string): string | null {
  // Codex sends permission keys like `mcp_servers.<server>.<tool>` (gateway
  // namespace hop) or `<server>.<tool>` (direct). Pull the server segment.
  const parts = key.split(".")
  if (parts.length >= 3 && parts[0] === "mcp_servers" && parts[1]) {
    return parts[1]
  }
  if (parts.length >= 2 && parts[0]) {
    return parts[0]
  }
  return null
}

function deriveServerFromToolName(toolName: string): string | null {
  // Gateway-namespaced names: "canvas.list_courses" → server "canvas".
  const dotIndex = toolName.indexOf(".")
  if (dotIndex > 0) {
    return toolName.slice(0, dotIndex)
  }
  return null
}

function derivePermissionToolKey(params: unknown): {
  toolKey: string | null
  toolLabel: string | null
} {
  if (!isRecord(params)) {
    return { toolKey: null, toolLabel: null }
  }

  // Per-server identity: one approval covers every tool exposed by the same
  // MCP server, since they share the same trust boundary anyway. Tighten to
  // per-tool later if needed.
  const explicitServer = readString(params, "serverName") ?? readString(params, "server")
  if (explicitServer) {
    return { toolKey: `mcp:${explicitServer}`, toolLabel: explicitServer }
  }

  const toolName = readString(params, "toolName") ?? readString(params, "tool")
  if (toolName) {
    const namespacedServer = deriveServerFromToolName(toolName)
    if (namespacedServer) {
      return { toolKey: `mcp:${namespacedServer}`, toolLabel: namespacedServer }
    }
  }

  // Codex >= 0.120 sends per-tool permission keys (e.g.
  // `mcp_servers.orbyt.canvas.list_courses`). Pull the server segment so the
  // sticky decision applies to every tool of that server.
  if (isRecord(params.permissions) && !Array.isArray(params.permissions)) {
    const keys = Object.keys(params.permissions)
    const servers = new Set<string>()
    for (const key of keys) {
      const server = deriveServerFromPermissionKey(key)
      if (server) servers.add(server)
    }
    if (servers.size === 1) {
      const [server] = Array.from(servers)
      return { toolKey: `mcp:${server}`, toolLabel: server ?? null }
    }
    if (keys.length > 0) {
      // Multi-server (rare): fall back to a stable fingerprint so distinct
      // sets stay distinct.
      const sorted = [...keys].sort()
      return {
        toolKey: `perm:${sorted.join("|")}`,
        toolLabel: keys.length === 1 ? keys[0]! : `${keys.length} permissions`,
      }
    }
  }

  const itemId = readString(params, "itemId")
  return itemId ? { toolKey: `perm:${itemId}`, toolLabel: itemId } : { toolKey: null, toolLabel: null }
}

function deriveApprovalToolMeta(
  method: PendingApprovalEntry["method"],
  params: unknown,
): { toolKey: string | null; toolLabel: string | null } {
  if (method === "item/commandExecution/requestApproval") {
    const command = readString(params, "command") ?? null
    const argv0 = deriveCommandArgv0(command)
    if (argv0) {
      return { toolKey: `cmd:${argv0}`, toolLabel: argv0 }
    }
    return { toolKey: null, toolLabel: null }
  }

  if (method === "item/fileChange/requestApproval") {
    const path = readString(params, "path") ?? readString(params, "filePath")
    if (path) {
      return { toolKey: `file:${path}`, toolLabel: path }
    }
    return { toolKey: null, toolLabel: null }
  }

  return derivePermissionToolKey(params)
}

export function mapPendingApprovalEntry(
  requestId: string | number,
  method:
    | "item/commandExecution/requestApproval"
    | "item/fileChange/requestApproval"
    | "item/permissions/requestApproval",
  params: unknown,
  activeTurn: ActiveTurn | null,
): PendingApprovalEntry {
  const approvalRequestId = String(requestId)
  const itemId = readString(params, "itemId") ?? approvalRequestId
  const reason = readString(params, "reason") ?? null
  const { toolKey, toolLabel } = deriveApprovalToolMeta(method, params)

  const localThreadId = activeTurn?.localThreadId ?? readString(params, "threadId") ?? ""
  const localTurnId = activeTurn?.localTurnId ?? readString(params, "turnId") ?? ""

  const approval: ProviderPendingApproval = {
    id: approvalRequestId,
    threadId: localThreadId as ProviderPendingApproval["threadId"],
    turnId: localTurnId as ProviderPendingApproval["turnId"],
    kind:
      method === "item/commandExecution/requestApproval"
        ? "command"
        : method === "item/fileChange/requestApproval"
          ? "file-change"
          : "permissions",
    itemId,
    approvalId: readString(params, "approvalId") ?? null,
    reason,
    command:
      method === "item/commandExecution/requestApproval"
        ? (readString(params, "command") ?? null)
        : null,
    cwd:
      method === "item/commandExecution/requestApproval"
        ? (readString(params, "cwd") ?? null)
        : null,
    availableDecisions:
      method === "item/commandExecution/requestApproval"
        ? simplifyApprovalDecisionChoices(isRecord(params) ? params.availableDecisions : null)
        : ["approve", "deny"],
    toolKey,
    toolLabel,
  }

  return {
    requestId,
    method,
    approval,
    rawParams: params,
  }
}

// ============================================================================
// MCP tool call event mapping
// ============================================================================

function readMcpToolCallItem(item: unknown): CodexMcpToolCallSnapshot | null {
  if (!isRecord(item) || item.type !== "mcpToolCall") {
    return null
  }

  const itemId = readString(item, "id")
  const serverName = readString(item, "server")
  const toolName = readString(item, "tool")
  const status = readString(item, "status")
  if (
    !itemId
    || !serverName
    || !toolName
    || (status !== "inProgress" && status !== "completed" && status !== "failed")
  ) {
    return null
  }

  const error =
    isRecord(item.error) && typeof item.error.message === "string"
      ? item.error.message
      : undefined

  return {
    itemId,
    serverName,
    toolName,
    args: "arguments" in item ? item.arguments : {},
    status,
    error,
  }
}

export function mapCodexMcpToolCallStartedEvent(
  params: unknown,
  activeTurn: ActiveTurnLocator,
): ProviderMcpToolCallEvent | null {
  const item = isRecord(params) ? params.item : null
  const mcpToolCall = readMcpToolCallItem(item)
  if (!mcpToolCall) {
    return null
  }

  const event: ProviderMcpToolCallEvent = {
    type: "provider.mcpToolCall",
    threadId: activeTurn.localThreadId as never,
    turnId: activeTurn.localTurnId as never,
    itemId: mcpToolCall.itemId,
    serverName: mcpToolCall.serverName,
    toolName: mcpToolCall.toolName,
    args: mcpToolCall.args,
    status: "pending",
  }

  return event
}

export function mapCodexMcpToolCallProgressEvent(
  params: unknown,
  activeTurn: ActiveTurnLocator,
  snapshot?: Omit<CodexMcpToolCallSnapshot, "status" | "error">,
): ProviderMcpToolCallEvent | null {
  const itemId = readString(params, "itemId")
  const message = readString(params, "message")
  if (!itemId || !message) {
    return null
  }

  const serverName = snapshot?.serverName ?? readString(params, "serverName") ?? "orbyt"
  const toolName = snapshot?.toolName ?? readString(params, "toolName") ?? "unknown"
  const args =
    snapshot?.args ?? (isRecord(params) && "arguments" in params ? params.arguments : {})

  const event: ProviderMcpToolCallEvent = {
    type: "provider.mcpToolCall",
    threadId: activeTurn.localThreadId as never,
    turnId: activeTurn.localTurnId as never,
    itemId,
    serverName,
    toolName,
    args,
    status: "pending",
    message,
  }

  return event
}

export function mapCodexMcpToolCallCompletedEvent(
  params: unknown,
  activeTurn: ActiveTurnLocator,
  snapshot?: Omit<CodexMcpToolCallSnapshot, "status" | "error">,
): ProviderMcpToolCallEvent | null {
  const item = isRecord(params) ? params.item : null
  const mcpToolCall = readMcpToolCallItem(item)
  if (!mcpToolCall) {
    return null
  }

  const event: ProviderMcpToolCallEvent = {
    type: "provider.mcpToolCall",
    threadId: activeTurn.localThreadId as never,
    turnId: activeTurn.localTurnId as never,
    itemId: mcpToolCall.itemId,
    serverName: snapshot?.serverName ?? mcpToolCall.serverName,
    toolName: snapshot?.toolName ?? mcpToolCall.toolName,
    args: snapshot?.args ?? mcpToolCall.args,
    status: mcpToolCall.status === "failed" ? "error" : "complete",
    error: mcpToolCall.error,
  }

  return event
}

// ============================================================================
// Auth and session helpers
// ============================================================================

export function readAuthFailure(stdout: string, stderr: string): ProviderRuntimeFailure | null {
  const output = `${stdout}\n${stderr}`.toLowerCase()
  if (output.includes("logged in")) {
    return null
  }

  if (
    output.includes("not logged in")
    || output.includes("authentication required")
    || output.includes("login required")
  ) {
    return new ProviderRuntimeFailure(
      "codex_auth_required",
      "Codex CLI is not authenticated. Start the login flow and retry.",
      false,
    )
  }

  return null
}

export function normalizeSessionCwd(cwd: string | null | undefined): string | null {
  if (typeof cwd !== "string") {
    return null
  }

  const normalized = cwd.trim()
  return normalized.length > 0 ? normalized : null
}

export function getThreadStartPolicy(_accessMode: ThreadAccessMode): {
  approvalPolicy: "untrusted" | "never" | "on-request"
  sandbox: "workspace-write" | "danger-full-access"
} {
  // Permission system removed: every thread runs with full access. The
  // accessMode argument is retained so existing call sites compile, but the
  // returned policy never depends on it.
  return {
    approvalPolicy: "never",
    sandbox: "danger-full-access",
  }
}

// Builds the accept reply for `item/permissions/requestApproval`. Echoing
// back the requested permissions with the requested scope mirrors a user
// picking "Allow". An empty `permissions` map would be read by Codex as a
// denial — surfacing to the AI as `user rejected MCP tool call` — so when
// the params don't contain anything actionable we fall back to a wildcard.
export function buildPermissionApprovalReply(
  params: unknown,
  options: { scope?: "turn" | "always" } = {},
): {
  permissions: Record<string, unknown>
  scope: "turn" | "always"
} {
  const scope = options.scope ?? "always"
  const candidate =
    isRecord(params) && isRecord(params.permissions) ? params.permissions : null
  // `isRecord` treats arrays as records (typeof "object"); guard against
  // arrays explicitly so an array-shaped payload doesn't get echoed back.
  const requestedPermissions =
    candidate && !Array.isArray(candidate) ? candidate : null

  if (requestedPermissions && Object.keys(requestedPermissions).length > 0) {
    return { permissions: requestedPermissions, scope }
  }

  // Fallback: Codex treats `permissions: {}` as denial. A wildcard tells
  // Codex the user accepted whatever was being requested.
  return { permissions: { "*": "always" }, scope }
}

// ============================================================================
// Codex app-server configuration
// ============================================================================

export function buildCodexAppServerArgs(config: {
  readonly pluginGatewayMcpServerName: string
  readonly pluginGatewayMcpUrl?: string
}): string[] {
  const args = ["app-server"]

  if (!config.pluginGatewayMcpUrl) {
    return args
  }

  const quotedServerName = JSON.stringify(config.pluginGatewayMcpServerName)

  args.push(
    "-c",
    `mcp_servers.${quotedServerName}.url="${config.pluginGatewayMcpUrl}"`,
    "-c",
    `mcp_servers.${quotedServerName}.bearer_token_env_var="${ORBYT_GATEWAY_TOKEN_ENV}"`,
  )

  return args
}

export function buildInitializeParams() {
  return {
    clientInfo: {
      name: "orbyt",
      title: "Orbyt",
      version: "0.1.0",
    },
    capabilities: {
      experimentalApi: true,
    },
  } as const
}
