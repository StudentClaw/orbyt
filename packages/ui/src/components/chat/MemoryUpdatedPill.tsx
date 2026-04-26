import { useEffect, useRef, useState } from "react"
import type { MemoryUpdatedEvent } from "@orbyt/contracts"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"

const DEBOUNCE_MS = 500

/**
 * Inline "Memory updated" row rendered inside the chat thread. Shows once a
 * MEMORY_UPDATED event arrives and stays visible permanently. Rapid bursts are
 * coalesced via a trailing debounce so the indicator appears once per cluster.
 */
export function MemoryUpdatedPill() {
  const [visible, setVisible] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    const handleEvent = (_event: MemoryUpdatedEvent) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        if (!cancelled) setVisible(true)
      }, DEBOUNCE_MS)
    }

    try {
      const client = getPrimaryWsRpcClient()
      unsubscribe = client.memory.onMemoryUpdated(handleEvent)
    } catch {
      // Runtime not started yet — silent no-op.
    }

    return () => {
      cancelled = true
      unsubscribe?.()
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  return (
    <div
      aria-live="polite"
      className={`text-xs text-muted-foreground/60 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      Memory updated
    </div>
  )
}
