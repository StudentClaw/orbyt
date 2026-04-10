import { useState, useRef, useCallback } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import type { ChatStatus } from "@/stores/chatStore"
import type { ConnectionState } from "@/lib/ws-client"

interface PromptInputProps {
  readonly onSend: (content: string) => void
  readonly onInterrupt: () => void
  readonly status: ChatStatus
  readonly connectionState: ConnectionState
}

export function PromptInput({ onSend, onInterrupt, status, connectionState }: PromptInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isConnected = connectionState === "connected"
  const isStreaming = status === "streaming"
  const canSend = value.trim().length > 0 && !isStreaming && isConnected

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming || !isConnected) return
    onSend(trimmed)
    setValue("")
    textareaRef.current?.focus()
  }, [value, isStreaming, isConnected, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div className="relative flex items-end gap-2 border-t bg-background p-3">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          !isConnected
            ? "Reconnecting..."
            : isStreaming
              ? "Wait for response..."
              : "Ask anything..."
        }
        disabled={!isConnected}
        className="min-h-10 max-h-32 pr-12"
        aria-label="Chat message input"
      />
      <div className="absolute right-5 bottom-5">
        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={onInterrupt}
            aria-label="Stop generating"
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
          </Button>
        ) : (
          <Button
            size="icon-sm"
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
          >
            <svg className="size-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.724 1.053a.5.5 0 0 1 .54-.068l12 6a.5.5 0 0 1 0 .894l-12 6A.5.5 0 0 1 1.5 13.5v-4.379l6.854-1.142L1.5 6.837V2.5a.5.5 0 0 1 .224-.447Z" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  )
}
