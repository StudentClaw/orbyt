import { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useChat } from "@/hooks/useChat"
import { useChatModel } from "@/hooks/useChatModel"
import { useChatUiActions } from "@/hooks/useAppRuntime"
import { ChatEmptyState } from "./ChatEmptyState"
import { ChatProviderDisconnected } from "./ChatProviderDisconnected"
import { ErrorBanner } from "./ErrorBanner"
import { MessageBubble } from "./MessageBubble"
import { PromptInput } from "./PromptInput"
import type { ChatSelectionInput } from "@/hooks/useChat"

interface ChatContainerProps {
  readonly variant?: "panel" | "page"
  readonly selection?: ChatSelectionInput
}

export function ChatContainer({ variant = "panel", selection }: ChatContainerProps) {
  const { selectedModel, setSelectedModel, availableModels } = useChatModel()
  const {
    messages,
    status,
    error,
    currentThread,
    currentWorkspace,
    sendMessage,
    interrupt,
    setThreadAccessMode,
    respondToApproval,
    currentPendingApproval,
    accessModeMutationPending,
    approvalDecisionPending,
    connectionState,
    inputDisabled,
    inputDisabledReason,
  } = useChat({ ...selection, model: selectedModel })
  const { closePanel } = useChatUiActions()

  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const title = currentThread?.title ?? currentWorkspace?.name ?? "Chat"
  const detail = currentWorkspace
    ? currentWorkspace.kind === "filesystem"
      ? currentWorkspace.rootPath
      : "Imported legacy chats"
    : "Add or choose a folder to start chatting"

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    setUserScrolledUp(false)
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) {
      return
    }

    const threshold = 50
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    setUserScrolledUp(!atBottom)
  }, [])

  useEffect(() => {
    if (!userScrolledUp) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, userScrolledUp])

  const isAuthRequired = status === "auth-expired"

  return (
    <div className={`flex h-full flex-col ${variant === "page" ? "mx-auto max-w-3xl" : ""}`}>
      {variant === "panel" ? (
        <div className="border-b">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <h2 className="font-heading text-base font-medium">
                {title}
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                {detail}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {connectionState !== "connected" && (
                <span className="text-xs text-muted-foreground">
                  {connectionState === "connecting"
                    ? "Connecting..."
                    : connectionState === "reconnecting"
                      ? "Reconnecting..."
                      : "Disconnected"}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={closePanel}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!isAuthRequired && status !== "idle" && status !== "streaming" && status !== "interrupted" && (
        <div className="px-4 pt-3">
          <ErrorBanner
            status={status}
            error={error}
          />
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex h-full flex-col gap-4 p-4"
          >
            {isAuthRequired ? (
              <div className="flex min-h-[300px] flex-1 items-center justify-center">
                <ChatProviderDisconnected />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-[300px] flex-1 items-center justify-center">
                <ChatEmptyState onSuggestionClick={(content) => void sendMessage({ content, attachments: [] })} />
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </>
            )}
            <div ref={bottomRef} aria-hidden="true" />
          </div>
        </ScrollArea>

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

      <PromptInput
        onSend={sendMessage}
        onInterrupt={() => void interrupt()}
        status={status}
        connectionState={connectionState}
        disabled={inputDisabled}
        disabledReason={inputDisabledReason}
        availableModels={availableModels}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        accessMode={currentThread?.accessMode ?? null}
        onAccessModeChange={(accessMode) => void setThreadAccessMode(accessMode)}
        accessModeUpdatePending={accessModeMutationPending}
        pendingApproval={currentPendingApproval}
        onRespondToApproval={(decision) => void respondToApproval(decision)}
        approvalDecisionPending={approvalDecisionPending}
      />
    </div>
  )
}
