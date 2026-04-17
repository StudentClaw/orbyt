import { useRef, useEffect, useState, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useChat } from "@/hooks/useChat"
import { useChatModel } from "@/hooks/useChatModel"
import { useChatUiActions, useOrchestrationActions, useSkills } from "@/hooks/useAppRuntime"
import { ChatEmptyState } from "./ChatEmptyState"
import { ChatProviderDisconnected } from "./ChatProviderDisconnected"
import { ErrorBanner } from "./ErrorBanner"
import { MessageBubble } from "./MessageBubble"
import { PromptInput } from "./PromptInput"
import type { ChatSelectionInput } from "@/hooks/useChat"

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}

interface ChatContainerProps {
  readonly variant?: "panel" | "page"
  readonly selection?: ChatSelectionInput
}

export function ChatContainer({ variant = "panel", selection }: ChatContainerProps) {
  const navigate = useNavigate()
  const { selectedModel, setSelectedModel, availableModels } = useChatModel()
  const { renameThread, deleteThread } = useOrchestrationActions()
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
  } = useChat({ ...selection, model: selectedModel })
  const { closePanel, selectChatTarget } = useChatUiActions()

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const [isEditingHeaderTitle, setIsEditingHeaderTitle] = useState(false)
  const [headerTitleDraft, setHeaderTitleDraft] = useState("")
  const [headerActionPending, setHeaderActionPending] = useState<"rename" | "delete" | null>(null)
  const [headerActionError, setHeaderActionError] = useState<string | null>(null)

  const headerTitle = currentThread?.title ?? currentWorkspace?.name ?? "New chat"

  const scrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
    setUserScrolledUp(false)
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const threshold = 50
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    setUserScrolledUp(!atBottom)
  }, [])

  useEffect(() => {
    if (!userScrolledUp) scrollToBottom()
  }, [messages, userScrolledUp, scrollToBottom])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      if (!userScrolledUp) {
        el.scrollTop = el.scrollHeight
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [userScrolledUp])

  useEffect(() => {
    if (!currentThread) {
      setIsEditingHeaderTitle(false)
      setHeaderTitleDraft("")
      return
    }

    if (!isEditingHeaderTitle) {
      setHeaderTitleDraft(currentThread.title)
    }
  }, [currentThread, isEditingHeaderTitle])

  useEffect(() => {
    setHeaderActionError(null)
  }, [currentThread?.id])

  const startHeaderRename = useCallback(() => {
    if (!currentThread || headerActionPending) {
      return
    }

    setHeaderActionError(null)
    setHeaderTitleDraft(currentThread.title)
    setIsEditingHeaderTitle(true)
  }, [currentThread, headerActionPending])

  const cancelHeaderRename = useCallback(() => {
    setIsEditingHeaderTitle(false)
    setHeaderTitleDraft(currentThread?.title ?? "")
  }, [currentThread?.title])

  const commitHeaderRename = useCallback(async () => {
    if (!currentThread || headerActionPending) {
      return
    }

    const normalizedTitle = headerTitleDraft.trim()
    if (normalizedTitle.length === 0 || normalizedTitle === currentThread.title) {
      cancelHeaderRename()
      return
    }

    setHeaderActionError(null)
    setHeaderActionPending("rename")
    try {
      await renameThread(currentThread.id, normalizedTitle)
      setIsEditingHeaderTitle(false)
    } catch (error) {
      setHeaderActionError(getErrorMessage(error, "Failed to rename the chat. Try again."))
    } finally {
      setHeaderActionPending(null)
    }
  }, [cancelHeaderRename, currentThread, headerActionPending, headerTitleDraft, renameThread])

  const handleDeleteCurrentThread = useCallback(async () => {
    if (!currentThread || headerActionPending) {
      return
    }

    const confirmed = window.confirm(
      `Delete "${currentThread.title}" and remove its message history from Student Claw?`,
    )
    if (!confirmed) {
      return
    }

    setHeaderActionError(null)
    setHeaderActionPending("delete")
    try {
      await deleteThread(currentThread.id)
      setIsEditingHeaderTitle(false)

      if (variant === "page") {
        if (currentWorkspace) {
          await navigate({
            to: "/chat/$workspaceId",
            params: { workspaceId: currentWorkspace.id },
          })
        } else {
          await navigate({ to: "/chat" })
        }
        return
      }

      selectChatTarget(currentWorkspace?.id ?? null, null)
    } catch (error) {
      setHeaderActionError(getErrorMessage(error, "Failed to delete the chat. Try again."))
    } finally {
      setHeaderActionPending(null)
    }
  }, [
    currentThread,
    currentWorkspace,
    deleteThread,
    headerActionPending,
    navigate,
    selectChatTarget,
    variant,
  ])

  const isAuthRequired = status === "auth-expired"

  return (
    <div className={`flex h-full flex-col ${variant === "page" ? "mx-auto max-w-3xl" : ""}`}>
      <div className="border-b">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-1">
            {isEditingHeaderTitle && currentThread ? (
              <form
                className="min-w-0"
                onSubmit={(event) => {
                  event.preventDefault()
                  void commitHeaderRename()
                }}
              >
                <Input
                  value={headerTitleDraft}
                  onChange={(event) => setHeaderTitleDraft(event.target.value)}
                  autoFocus
                  disabled={headerActionPending !== null}
                  aria-label={`Rename ${currentThread.title}`}
                  className="h-9 min-w-[220px] max-w-full font-heading text-base"
                  onBlur={() => void commitHeaderRename()}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault()
                      cancelHeaderRename()
                    }
                  }}
                />
              </form>
            ) : (
              <>
                <h2
                  className={`min-w-0 truncate font-heading text-base font-medium ${
                    currentThread ? "cursor-text" : ""
                  }`}
                  title={headerTitle}
                  onDoubleClick={currentThread ? startHeaderRename : undefined}
                >
                  {headerTitle}
                </h2>
                {currentThread && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                        aria-label={`Open actions for ${currentThread.title}`}
                        disabled={headerActionPending !== null}
                      >
                        <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onSelect={startHeaderRename}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => void handleDeleteCurrentThread()}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
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
            {variant === "panel" && (
              <Button variant="ghost" size="sm" onClick={closePanel}>
                Close
              </Button>
            )}
          </div>
        </div>
        {headerActionError && (
          <p className="px-4 pb-3 text-xs text-destructive">{headerActionError}</p>
        )}
      </div>

      {!isAuthRequired && status !== "idle" && status !== "streaming" && status !== "interrupted" && (
        <div className="px-4 pt-3">
          <ErrorBanner
            status={status}
            error={error}
          />
        </div>
      )}

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
        </div>

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
        skills={skills}
      />
    </div>
  )
}
