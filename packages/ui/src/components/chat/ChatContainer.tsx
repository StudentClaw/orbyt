import { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useChat } from "@/hooks/useChat"
import { useChatModel } from "@/hooks/useChatModel"
import { useChatUiActions, useSkills } from "@/hooks/useAppRuntime"
import { ChatEmptyState } from "./ChatEmptyState"
import { ChatProviderDisconnected } from "./ChatProviderDisconnected"
import { ErrorBanner } from "./ErrorBanner"
import { MessageBubble, SendingPlaceholder } from "./MessageBubble"
import { PromptInput } from "./PromptInput"
import type { ChatSelectionInput } from "@/hooks/useChat"

interface ChatContainerProps {
  readonly variant?: "panel" | "page"
  readonly selection?: ChatSelectionInput
}

export function ChatContainer({ variant = "panel", selection }: ChatContainerProps) {
  const { selectedModel, setSelectedModel, availableModels } = useChatModel()
  const skills = useSkills()
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
    isSending,
  } = useChat({ ...selection, model: selectedModel })
  const { closePanel } = useChatUiActions()

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const title = currentThread?.title ?? currentWorkspace?.name ?? "Chat"
  const detail = currentWorkspace
    ? currentWorkspace.kind === "filesystem"
      ? currentWorkspace.rootPath
      : "Imported legacy chats"
    : "Add or choose a folder to start chatting"

  const scrollToBottom = useCallback(() => {
    const element = scrollContainerRef.current
    if (element) {
      element.scrollTop = element.scrollHeight
    }
    setUserScrolledUp(false)
  }, [])

  const handleScroll = useCallback(() => {
    const element = scrollContainerRef.current
    if (!element) {
      return
    }

    const threshold = 50
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold
    setUserScrolledUp(!atBottom)
  }, [])

  useEffect(() => {
    if (!userScrolledUp) {
      scrollToBottom()
    }
  }, [messages, userScrolledUp, scrollToBottom])

  useEffect(() => {
    const element = scrollContainerRef.current
    if (!element) {
      return
    }

    const observer = new ResizeObserver(() => {
      if (!userScrolledUp) {
        element.scrollTop = element.scrollHeight
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [userScrolledUp])

  const isAuthRequired = status === "auth-expired"

  return (
    <div className={`flex h-full flex-col ${variant === "page" ? "mx-auto max-w-3xl" : ""}`}>
      {variant === "panel" ? (
        <div className="border-b">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <h2 className="font-heading text-base font-medium">{title}</h2>
              <p className="truncate text-xs text-muted-foreground">{detail}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {connectionState !== "connected" ? (
                <span className="text-xs text-muted-foreground">
                  {connectionState === "connecting"
                    ? "Connecting..."
                    : connectionState === "reconnecting"
                      ? "Reconnecting..."
                      : "Disconnected"}
                </span>
              ) : null}
              <Button variant="ghost" size="sm" onClick={closePanel}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!isAuthRequired && status !== "idle" && status !== "streaming" && status !== "interrupted" ? (
        <div className="px-4 pt-3">
          <ErrorBanner status={status} error={error} />
        </div>
      ) : null}

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex h-full flex-col gap-4 overflow-y-auto p-4"
        >
          {isAuthRequired ? (
            <div className="flex min-h-[300px] flex-1 items-center justify-center">
              <ChatProviderDisconnected />
            </div>
          ) : messages.length === 0 && !isSending ? (
            <div className="flex min-h-[300px] flex-1 items-center justify-center">
              <ChatEmptyState onSuggestionClick={(content) => void sendMessage({ content, attachments: [] })} />
            </div>
          ) : messages.length === 0 ? (
            <SendingPlaceholder />
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isSending && messages[messages.length - 1]?.role === "user" ? (
                <SendingPlaceholder />
              ) : null}
            </>
          )}
        </div>

        {userScrolledUp && messages.length > 0 ? (
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
        ) : null}
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
        skills={skills}
      />
    </div>
  )
}
