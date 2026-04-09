import { useEffect, useMemo, useState } from "react"
import { Schema } from "@effect/schema"
import {
  OrchestrationDomainEvent,
  OrchestrationSnapshot,
  ProviderRuntimeEvent,
  type OrchestrationThread,
  type OrchestrationTurn,
} from "@student-claw/contracts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useWebSocket } from "@/hooks/useWebSocket"

function applyTurnEvent(
  current: OrchestrationSnapshot | null,
  turn: OrchestrationTurn,
): OrchestrationSnapshot | null {
  if (!current) return current
  const turns = current.turns.filter((entry) => entry.id !== turn.id).concat(turn)
  const nextStatus: OrchestrationThread["status"] =
    turn.status === "completed"
      ? "completed"
      : turn.status === "interrupted"
        ? "interrupted"
        : "streaming"
  const threads = current.threads.map((thread) =>
    thread.id === turn.threadId
      ? {
          ...thread,
          status: nextStatus,
          currentTurnId: turn.status === "completed" || turn.status === "interrupted" ? null : turn.id,
        }
      : thread,
  )
  return { ...current, turns, threads }
}

export function ChatPage() {
  const { bootstrap, client, connectionState, subscribe } = useWebSocket()
  const [snapshot, setSnapshot] = useState<OrchestrationSnapshot | null>(null)
  const [input, setInput] = useState("")
  const [threadId, setThreadId] = useState<string | null>(null)
  const [providerLog, setProviderLog] = useState<string[]>([])

  useEffect(() => {
    if (!client || connectionState !== "connected") return

    let cancelled = false
    void client.getSnapshot<OrchestrationSnapshot>().then((value) => {
      if (!cancelled) {
        const decoded = Schema.decodeUnknownSync(OrchestrationSnapshot)(value)
        setSnapshot(decoded)
        setThreadId((current) => current ?? decoded.threads.at(-1)?.id ?? null)
      }
    }).catch(() => undefined)

    const unsubDomain = subscribe("orchestration.domain", (push) => {
      const event = Schema.decodeUnknownSync(OrchestrationDomainEvent)(push.data)
      setSnapshot((current) => {
        if (event.type === "thread.created") {
          return current
            ? { ...current, threads: [...current.threads, event.thread], lastSequence: push.sequence }
            : {
                threads: [event.thread],
                turns: [],
                providerStatus: "idle",
                ready: true,
                lastSequence: push.sequence,
              }
        }
        return applyTurnEvent(
          current ? { ...current, lastSequence: push.sequence } : current,
          event.turn,
        )
      })
      if (event.type === "thread.created") {
        setThreadId(event.thread.id)
      }
    })

    const unsubRuntime = subscribe("provider.runtime", (push) => {
      const event = Schema.decodeUnknownSync(ProviderRuntimeEvent)(push.data)
      setProviderLog((current) => [`${event.type}`, ...current].slice(0, 8))
    })

    return () => {
      cancelled = true
      unsubDomain()
      unsubRuntime()
    }
  }, [client, connectionState, subscribe])

  const currentThread = useMemo<OrchestrationThread | null>(() => {
    if (!snapshot) return null
    return snapshot.threads.find((entry) => entry.id === threadId) ?? snapshot.threads.at(-1) ?? null
  }, [snapshot, threadId])

  const currentTurn = useMemo(() => {
    if (!snapshot || !currentThread?.currentTurnId) return snapshot?.turns.at(-1) ?? null
    return snapshot.turns.find((entry) => entry.id === currentThread.currentTurnId) ?? null
  }, [currentThread, snapshot])

  const handleCreateThread = async () => {
    if (!client) return
    const next = await client.createThread("Stub orchestration demo")
    setThreadId(next.threadId)
  }

  const handleSend = async () => {
    if (!client || !input.trim()) return

    let targetThreadId = threadId
    if (!targetThreadId) {
      const created = await client.createThread("Stub orchestration demo")
      targetThreadId = created.threadId
      setThreadId(created.threadId)
    }

    await client.sendTurn(targetThreadId, input.trim())
    setInput("")
  }

  const handleInterrupt = async () => {
    if (!client || !threadId) return
    await client.interruptTurn(threadId)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Chat</h1>
        <p className="text-muted-foreground">
          Proof slice for the new orchestration runtime.
        </p>
        <p className="text-sm text-muted-foreground">
          {connectionState} {bootstrap ? `· ${bootstrap.wsUrl}` : ""}
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
            <Button onClick={() => void handleSend()} disabled={!client || !input.trim()}>
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
              {providerLog.length > 0 ? providerLog.map((entry) => (
                <div key={entry} className="rounded-md border px-3 py-2 text-sm">
                  {entry}
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
