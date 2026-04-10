import { useMemo, useState } from "react"
import {
  type OrchestrationSnapshot,
  type OrchestrationThread,
  type ProviderRuntimeEvent,
} from "@student-claw/contracts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useOrchestrationActions,
  useRuntimeBootstrap,
  useRuntimeConnectionStatus,
  useRuntimeOrchestrationSnapshot,
  useRuntimeProviderEvents,
} from "@/hooks/useAppRuntime"

export function resolveCurrentThread(
  snapshot: ReturnType<typeof useRuntimeOrchestrationSnapshot>,
  threadId: string | null,
): OrchestrationThread | null {
  if (!snapshot) {
    return null
  }

  return snapshot.threads.find((entry) => entry.id === threadId) ?? snapshot.threads.at(-1) ?? null
}

function formatProviderStatus(status: OrchestrationSnapshot["providerStatus"]): string {
  return status.replace(/_/g, " ")
}

export function resolveProviderGuidance(snapshot: OrchestrationSnapshot | null): {
  readonly title: string
  readonly detail: string | null
  readonly showRetry: boolean
  readonly showAuth: boolean
} | null {
  if (!snapshot) {
    return null
  }

  const { providerRuntime } = snapshot
  const errorMessage = providerRuntime.lastError?.message ?? null

  if (providerRuntime.authState === "auth_required" || providerRuntime.status === "auth_required") {
    return {
      title: "Codex login required",
      detail: errorMessage ?? "Finish the Codex login flow, then retry the runtime.",
      showRetry: false,
      showAuth: true,
    }
  }

  if (providerRuntime.status === "degraded") {
    return {
      title: "Codex runtime degraded",
      detail: errorMessage ?? "The runtime hit an internal error. Retry initialization to reconnect it.",
      showRetry: true,
      showAuth: false,
    }
  }

  if (providerRuntime.status === "offline") {
    return {
      title: "Codex runtime offline",
      detail: errorMessage ?? "The runtime is not connected yet. Retry initialization to start it again.",
      showRetry: true,
      showAuth: false,
    }
  }

  if (providerRuntime.status === "rate_limited") {
    return {
      title: "Codex rate limited",
      detail: errorMessage ?? "Codex reported a rate limit. Retrying may help after a short wait.",
      showRetry: true,
      showAuth: false,
    }
  }

  return null
}

export function formatProviderEventLabel(event: ProviderRuntimeEvent): string {
  switch (event.type) {
    case "provider.stateChanged":
      return event.state.lastError
        ? `State changed to ${formatProviderStatus(event.state.status)}: ${event.state.lastError.code}`
        : `State changed to ${formatProviderStatus(event.state.status)}`
    case "provider.turnStarted":
      return `Turn started: ${event.turnId}`
    case "provider.token":
      return `Token ${event.index + 1}: ${event.token}`
    case "provider.turnCompleted":
      return `Turn completed: ${event.turnId}`
    case "provider.turnInterrupted":
      return `Turn interrupted: ${event.turnId}`
  }
}

export function ChatPage() {
  const bootstrap = useRuntimeBootstrap()
  const connectionStatus = useRuntimeConnectionStatus()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const providerEvents = useRuntimeProviderEvents()
  const actions = useOrchestrationActions()
  const [input, setInput] = useState("")
  const [threadId, setThreadId] = useState<string | null>(null)
  const [recoveryAction, setRecoveryAction] = useState<"retry" | "auth" | null>(null)

  const currentThread = useMemo<OrchestrationThread | null>(() => {
    return resolveCurrentThread(snapshot, threadId)
  }, [snapshot, threadId])

  const currentTurn = useMemo(() => {
    if (!snapshot || !currentThread?.currentTurnId) {
      return snapshot?.turns.at(-1) ?? null
    }
    return snapshot.turns.find((entry) => entry.id === currentThread.currentTurnId) ?? null
  }, [currentThread, snapshot])

  const providerGuidance = useMemo(() => resolveProviderGuidance(snapshot), [snapshot])

  const handleCreateThread = async () => {
    const nextThreadId = await actions.createThread("Codex orchestration demo")
    setThreadId(nextThreadId)
  }

  const handleSend = async () => {
    if (!input.trim()) {
      return
    }

    let targetThreadId = threadId
    if (!targetThreadId) {
      targetThreadId = await actions.createThread("Codex orchestration demo")
      setThreadId(targetThreadId)
    }

    await actions.sendTurn(targetThreadId, input.trim())
    setInput("")
  }

  const handleInterrupt = async () => {
    const activeThreadId = currentThread?.id ?? threadId
    if (!activeThreadId) {
      return
    }

    await actions.interruptTurn(activeThreadId)
  }

  const handleRetryProviderInitialize = async () => {
    setRecoveryAction("retry")
    try {
      await actions.retryProviderInitialize()
    } finally {
      setRecoveryAction(null)
    }
  }

  const handleStartProviderAuth = async () => {
    setRecoveryAction("auth")
    try {
      await actions.startProviderAuth()
    } finally {
      setRecoveryAction(null)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Chat</h1>
        <p className="text-muted-foreground">
          Codex-backed proof slice for the orchestration runtime.
        </p>
        <p className="text-sm text-muted-foreground">
          {connectionStatus.phase}
          {snapshot ? ` · provider ${formatProviderStatus(snapshot.providerStatus)}` : ""}
          {bootstrap ? ` · ${bootstrap.wsUrl}` : ""}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button onClick={() => void handleCreateThread()} variant="outline">
              {threadId ? "New thread" : "Create thread"}
            </Button>
            <Button
              onClick={() => void handleInterrupt()}
              variant="secondary"
              disabled={!currentThread || currentThread.status !== "streaming"}
            >
              Interrupt
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Active thread</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentThread ? `${currentThread.title} · ${currentThread.status}` : "No thread yet"}
            </p>
            <div className="mt-4 min-h-40 whitespace-pre-wrap text-sm">
              {currentTurn?.output || providerGuidance?.detail || "Send a turn to watch Codex stream tokens here."}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Codex to prove the runtime works"
            />
            <Button
              onClick={() => void handleSend()}
              disabled={
                !input.trim()
                || connectionStatus.phase !== "connected"
                || snapshot?.providerRuntime.authState === "auth_required"
              }
            >
              Send
            </Button>
          </div>
        </section>

        <aside className="space-y-4 rounded-xl border p-4">
          {providerGuidance ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">{providerGuidance.title}</p>
              {providerGuidance.detail ? (
                <p className="mt-1 text-sm text-muted-foreground">{providerGuidance.detail}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {providerGuidance.showRetry ? (
                  <Button
                    onClick={() => void handleRetryProviderInitialize()}
                    variant="outline"
                    disabled={recoveryAction !== null}
                  >
                    {recoveryAction === "retry" ? "Retrying..." : "Retry runtime"}
                  </Button>
                ) : null}
                {providerGuidance.showAuth ? (
                  <Button
                    onClick={() => void handleStartProviderAuth()}
                    variant="secondary"
                    disabled={recoveryAction !== null}
                  >
                    {recoveryAction === "auth" ? "Opening..." : "Connect Codex"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div>
            <p className="text-sm font-medium">Snapshot</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {snapshot
                ? `${snapshot.threads.length} thread(s), ${snapshot.turns.length} turn(s), provider ${snapshot.providerStatus}`
                : "Waiting for snapshot"}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium">Provider runtime</p>
            <div className="mt-2 space-y-2">
              {providerEvents.length > 0 ? providerEvents.map((event, index) => (
                <div key={`${event.type}-${index}`} className="rounded-md border px-3 py-2 text-sm">
                  {formatProviderEventLabel(event)}
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">No provider events yet.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
