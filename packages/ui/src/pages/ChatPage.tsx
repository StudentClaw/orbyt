import { useMemo, useState } from "react"
import { type OrchestrationThread } from "@student-claw/contracts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useOrchestrationActions,
  useRuntimeBootstrap,
  useRuntimeConnectionStatus,
  useRuntimeOrchestrationSnapshot,
  useRuntimeProviderEvents,
} from "@/hooks/useAppRuntime"

export function ChatPage() {
  const bootstrap = useRuntimeBootstrap()
  const connectionStatus = useRuntimeConnectionStatus()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const providerEvents = useRuntimeProviderEvents()
  const actions = useOrchestrationActions()
  const [input, setInput] = useState("")
  const [threadId, setThreadId] = useState<string | null>(null)

  const currentThread = useMemo<OrchestrationThread | null>(() => {
    if (!snapshot) {
      return null
    }
    return snapshot.threads.find((entry) => entry.id === threadId) ?? snapshot.threads.at(-1) ?? null
  }, [snapshot, threadId])

  const currentTurn = useMemo(() => {
    if (!snapshot || !currentThread?.currentTurnId) {
      return snapshot?.turns.at(-1) ?? null
    }
    return snapshot.turns.find((entry) => entry.id === currentThread.currentTurnId) ?? null
  }, [currentThread, snapshot])

  const handleCreateThread = async () => {
    const nextThreadId = await actions.createThread("Stub orchestration demo")
    setThreadId(nextThreadId)
  }

  const handleSend = async () => {
    if (!input.trim()) {
      return
    }

    let targetThreadId = threadId
    if (!targetThreadId) {
      targetThreadId = await actions.createThread("Stub orchestration demo")
      setThreadId(targetThreadId)
    }

    await actions.sendTurn(targetThreadId, input.trim())
    setInput("")
  }

  const handleInterrupt = async () => {
    if (!threadId) {
      return
    }

    await actions.interruptTurn(threadId)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Chat</h1>
        <p className="text-muted-foreground">
          Proof slice for the new orchestration runtime.
        </p>
        <p className="text-sm text-muted-foreground">
          {connectionStatus.phase} {bootstrap ? `· ${bootstrap.wsUrl}` : ""}
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
              {currentTurn?.output || "Send a turn to watch the stub provider stream tokens here."}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask the stub provider to prove the runtime works"
            />
            <Button
              onClick={() => void handleSend()}
              disabled={!input.trim() || connectionStatus.phase !== "connected"}
            >
              Send
            </Button>
          </div>
        </section>

        <aside className="space-y-4 rounded-xl border p-4">
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
                  {event.type}
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
