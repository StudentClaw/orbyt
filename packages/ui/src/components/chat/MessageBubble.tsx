import { useEffect, useRef, useState, type FocusEvent } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import type { ChatMessage } from "@/hooks/chat-model"
import { Actions, Action } from "@/components/ai/actions"
import { cn } from "@/lib/utils"
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "./ChainOfThought"
import { MarkdownContent } from "./MarkdownContent"
import { StreamingResponse } from "./StreamingResponse"
import { ToolCallIndicator } from "./ToolCallIndicator"
import { ChatAttachments } from "./ChatAttachments"
import { PendingArtifactChip } from "./ArtifactChip"
import { useArtifactContextOptional } from "@/context/ArtifactContext"

interface MessageBubbleProps {
  readonly message: ChatMessage
}

const CHAIN_OF_THOUGHT_PREVIEW_MS = 1000
const MESSAGE_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
})

export function formatMessageTimestamp(timestamp: number): string {
  return MESSAGE_TIMESTAMP_FORMATTER.format(new Date(timestamp))
}

function QueuedPlaceholder() {
  return (
    <div
      data-testid="assistant-queued-placeholder"
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <span className="inline-flex size-1.5 animate-pulse rounded-full bg-sky-500" aria-hidden="true" />
      <span>Queued…</span>
    </div>
  )
}

function SendingPlaceholder() {
  return (
    <div
      data-testid="assistant-sending-placeholder"
      className="flex min-w-0 max-w-[min(42rem,100%)] flex-col gap-3"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="inline-flex size-1.5 animate-pulse rounded-full bg-sky-500" aria-hidden="true" />
        <span>Sending…</span>
      </div>
    </div>
  )
}

export { SendingPlaceholder }

function CopyActionIcon({ copied }: { readonly copied: boolean }) {
  return (
    <span aria-hidden="true" className="relative size-4">
      <CopyIcon
        className={cn(
          "absolute inset-0 size-4 transition-all duration-200 ease-out",
          copied ? "scale-75 -rotate-12 opacity-0" : "scale-100 rotate-0 opacity-100",
        )}
      />
      <CheckIcon
        className={cn(
          "absolute inset-0 size-4 transition-all duration-200 ease-out",
          copied ? "scale-100 rotate-0 opacity-100" : "scale-75 rotate-12 opacity-0",
        )}
      />
    </span>
  )
}

function useCopyAction(copyText: string) {
  const [isCopied, setIsCopied] = useState(false)
  const copyResetTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText)
    setIsCopied(true)

    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current)
    }

    copyResetTimeoutRef.current = window.setTimeout(() => {
      setIsCopied(false)
      copyResetTimeoutRef.current = null
    }, 1000)
  }

  return { isCopied, handleCopy }
}

function useFooterVisibility() {
  const [isVisible, setIsVisible] = useState(false)

  const showFooter = () => {
    setIsVisible(true)
  }

  const hideFooter = () => {
    setIsVisible(false)
  }

  const handleBlurCapture = (event: FocusEvent<HTMLElement>) => {
    const nextFocused = event.relatedTarget
    if (nextFocused instanceof Node && event.currentTarget.contains(nextFocused)) {
      return
    }

    setIsVisible(false)
  }

  return {
    isVisible,
    visibilityProps: {
      onMouseEnter: showFooter,
      onMouseLeave: hideFooter,
      onFocusCapture: showFooter,
      onBlurCapture: handleBlurCapture,
    },
  }
}

interface MessageFooterProps {
  readonly align: "start" | "end"
  readonly copied: boolean
  readonly copyLabel: string
  readonly onCopy: () => Promise<void>
  readonly testId: string
  readonly timestamp: number
  readonly visible: boolean
}

function MessageFooter({
  align,
  copied,
  copyLabel,
  onCopy,
  testId,
  timestamp,
  visible,
}: MessageFooterProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex min-h-7 items-center",
        align === "end" ? "justify-end self-end" : "justify-start",
      )}
    >
      <div
        aria-hidden={!visible}
        className={cn(
          "flex items-center gap-1 text-xs text-muted-foreground transition-opacity duration-150",
          visible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <span>{formatMessageTimestamp(timestamp)}</span>
        <Actions className="gap-0">
          <Action
            label={copied ? "Copied" : copyLabel}
            onClick={() => void onCopy()}
            disabled={!visible}
            tabIndex={visible ? undefined : -1}
            className={cn(
              "size-7 p-1 transition-colors duration-200",
              copied && "text-primary hover:text-primary",
            )}
          >
            <CopyActionIcon copied={copied} />
          </Action>
        </Actions>
      </div>
    </div>
  )
}

function UserMessage({ message }: MessageBubbleProps) {
  const hasVisibleContent = message.content.trim().length > 0
  const { isCopied, handleCopy } = useCopyAction(message.content)
  const { isVisible, visibilityProps } = useFooterVisibility()

  return (
    <div
      data-testid="user-message-row"
      className="flex justify-end"
      {...visibilityProps}
    >
      <div className="flex max-w-[min(32rem,85%)] flex-col items-end gap-2">
        {message.attachments && message.attachments.length > 0 && (
          <ChatAttachments attachments={message.attachments} className="max-w-full" />
        )}
        {hasVisibleContent && (
          <div className="flex flex-col items-end gap-1">
            <div
              data-testid="user-message-bubble"
              className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-left text-white"
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
            <MessageFooter
              align="end"
              copied={isCopied}
              copyLabel="Copy message"
              onCopy={handleCopy}
              testId="user-message-footer"
              timestamp={message.timestamp}
              visible={isVisible}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function AssistantMessage({ message }: MessageBubbleProps) {
  const hasVisibleContent = message.content.trim().length > 0
  const hasArtifacts = (message.artifacts?.length ?? 0) > 0
  const hasPending = Boolean(message.pendingArtifact)
  const shouldRenderMainResponse =
    hasVisibleContent
    || hasArtifacts
    || hasPending
    || (message.isStreaming && !message.reasoning)
    || (message.isQueued && !message.reasoning)
  const [isThoughtOpen, setIsThoughtOpen] = useState(() => Boolean(message.isStreaming && message.reasoning))
  const { isCopied, handleCopy } = useCopyAction(message.content)
  const { isVisible, visibilityProps } = useFooterVisibility()
  const hasPreviewedStreamingThought = useRef(false)
  const artifactCtx = useArtifactContextOptional()

  useEffect(() => {
    if (!artifactCtx || !message.artifacts || message.artifacts.length === 0) return
    artifactCtx.registerArtifacts(message.artifacts)
  }, [artifactCtx, message.artifacts])

  useEffect(() => {
    if (!message.isStreaming || !message.reasoning || hasPreviewedStreamingThought.current) {
      return
    }

    hasPreviewedStreamingThought.current = true
    setIsThoughtOpen(true)

    const collapseTimer = window.setTimeout(() => {
      setIsThoughtOpen(false)
    }, CHAIN_OF_THOUGHT_PREVIEW_MS)

    return () => {
      window.clearTimeout(collapseTimer)
    }
  }, [message.isStreaming, message.reasoning])

  return (
    <div
      data-testid="assistant-message-row"
      className="flex min-w-0 max-w-[min(42rem,100%)] flex-col gap-3"
      {...visibilityProps}
    >
      {message.reasoning && (
        <ChainOfThought
          data-testid="assistant-thought-row"
          open={isThoughtOpen}
          onOpenChange={setIsThoughtOpen}
        >
          <ChainOfThoughtHeader>
            {message.isStreaming ? "Thinking" : "Chain of Thought"}
          </ChainOfThoughtHeader>
          <ChainOfThoughtContent>
            <ChainOfThoughtStep
              label={(
                <div className="text-xs leading-6 text-muted-foreground">
                  <MarkdownContent content={message.reasoning} />
                </div>
              )}
              status={message.isStreaming ? "active" : "complete"}
            />
          </ChainOfThoughtContent>
        </ChainOfThought>
      )}
      {message.toolCalls?.map((toolCall, i) => (
        <div key={i}>
          <ToolCallIndicator toolCall={toolCall} />
        </div>
      ))}
      {shouldRenderMainResponse
        ? (
            <div className="flex flex-col gap-1">
              <div data-testid="assistant-response" className="text-sm text-foreground">
                {message.isQueued && !hasVisibleContent && !hasArtifacts && !hasPending
                  ? <QueuedPlaceholder />
                  : message.isStreaming
                    ? <StreamingResponse content={message.content} isStreaming />
                    : <MarkdownContent content={message.content} />}
                {hasPending && message.pendingArtifact
                  ? <PendingArtifactChip pending={message.pendingArtifact} />
                  : null}
              </div>
              {!message.isStreaming && hasVisibleContent && (
                <MessageFooter
                  align="start"
                  copied={isCopied}
                  copyLabel="Copy response"
                  onCopy={handleCopy}
                  testId="assistant-message-footer"
                  timestamp={message.timestamp}
                  visible={isVisible}
                />
              )}
            </div>
          )
        : null}
    </div>
  )
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") {
    return <UserMessage message={message} />
  }
  return <AssistantMessage message={message} />
}
