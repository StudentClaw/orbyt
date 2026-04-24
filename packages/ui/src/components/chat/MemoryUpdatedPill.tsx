import { useEffect, useRef, useState } from "react"
import type { MemoryUpdatedEvent } from "@orbyt/contracts"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"

const DEBOUNCE_MS = 500
const VISIBLE_MS = 3000

/**
 * Inline "Memory updated" pill rendered inside the chat thread. Subscribes to
 * server-side MEMORY_UPDATED push events and shows a liquid-glass chip that
 * fades out after a short window. Rapid bursts are coalesced via a trailing
 * debounce so the pill shows once per cluster of events, not once per event.
 */
export function MemoryUpdatedPill() {
  const [visible, setVisible] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    const show = () => {
      setVisible(true)
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setVisible(false), VISIBLE_MS)
    }

    const handleEvent = (_event: MemoryUpdatedEvent) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        if (!cancelled) show()
      }, DEBOUNCE_MS)
    }

    try {
      const client = getPrimaryWsRpcClient()
      unsubscribe = client.memory.onMemoryUpdated(handleEvent)
    } catch {
      // Runtime not started yet — silent no-op; the component will simply not
      // render until the next mount after bootstrap completes.
    }

    return () => {
      cancelled = true
      unsubscribe?.()
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none flex justify-center transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="rounded-full border border-white/10 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur-xl shadow-sm">
        Memory updated
      </div>
    </div>
  )
}
