import { useRef, useEffect, useState, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useChatStore } from "@/stores/chatStore"
import { useChat } from "@/hooks/useChat"
import { MessageBubble } from "./MessageBubble"
import { ChatEmptyState } from "./ChatEmptyState"
import { ErrorBanner } from "./ErrorBanner"
import { PromptInput } from "./PromptInput"

interface ChatContainerProps {
  readonly variant?: "panel" | "page"
}

export function ChatContainer({ variant = "panel" }: ChatContainerProps) {
  const messages = useChatStore((s) => s.messages)
  const status = useChatStore((s) => s.status)
  const error = useChatStore((s) => s.error)
  const { sendMessage, interrupt, connectionState } = useChat()

  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    setUserScrolledUp(false)
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const threshold = 50
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    if (!atBottom) {
      setUserScrolledUp(true)
    } else {
      setUserScrolledUp(false)
    }
  }, [])

  // Auto-scroll on new messages/streaming updates when user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUp) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, userScrolledUp])

  const handleRetry = useCallback(() => {
    useChatStore.getState().setStatus("idle")
    useChatStore.getState().setError(null)
  }, [])

  return (
    <div className={`flex flex-col h-full ${variant === "page" ? "max-w-3xl mx-auto" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-heading text-base font-medium">Chat</h2>
        {connectionState !== "connected" && (
          <span className="text-xs text-muted-foreground">
            {connectionState === "connecting" || connectionState === "reconnecting"
              ? "Reconnecting..."
              : "Disconnected"}
          </span>
        )}
      </div>

      {/* Error banner */}
      {status !== "idle" && status !== "streaming" && status !== "interrupted" && (
        <div className="px-4 pt-3">
          <ErrorBanner
            status={status}
            error={error}
            onRetry={handleRetry}
          />
        </div>
      )}

      {/* Message area */}
      <div className="relative flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex flex-col gap-4 p-4 h-full"
          >
            {messages.length === 0 ? (
              <div className="flex flex-1 items-center justify-center h-full min-h-[300px]">
                <ChatEmptyState onSuggestionClick={sendMessage} />
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
            <div ref={bottomRef} aria-hidden="true" />
          </div>
        </ScrollArea>

        {/* Scroll to bottom button */}
        {userScrolledUp && messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="absolute bottom-2 left-1/2 -translate-x-1/2 shadow-md"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
          >
            <svg className="mr-1 size-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 11.5a.5.5 0 0 1-.354-.146l-4-4a.5.5 0 1 1 .708-.708L8 10.293l3.646-3.647a.5.5 0 0 1 .708.708l-4 4A.5.5 0 0 1 8 11.5Z" />
            </svg>
            New messages
          </Button>
        )}
      </div>

      {/* Input */}
      <PromptInput
        onSend={sendMessage}
        onInterrupt={interrupt}
        status={status}
        connectionState={connectionState}
      />
    </div>
  )
}
