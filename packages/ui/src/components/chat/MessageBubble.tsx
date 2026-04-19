import { useEffect, useRef, useState } from "react"
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

function UserMessage({ message }: MessageBubbleProps) {
  const hasVisibleContent = message.content.trim().length > 0

  return (
    <div data-testid="user-message-row" className="flex justify-end">
      <div className="flex max-w-[min(32rem,85%)] flex-col items-end gap-2">
        {message.attachments && message.attachments.length > 0 && (
          <ChatAttachments attachments={message.attachments} className="max-w-full" />
        )}
        {hasVisibleContent && (
          <div
            data-testid="user-message-bubble"
            className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-left text-primary-foreground"
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
  const [isThoughtOpen, setIsThoughtOpen] = useState(() => Boolean(message.isStreaming && message.reasoning))
  const [isCopied, setIsCopied] = useState(false)
  const hasPreviewedStreamingThought = useRef(false)
  const copyResetTimeoutRef = useRef<number | null>(null)
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

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current)
      }
    }
  }, [])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setIsCopied(true)

    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current)
    }

    copyResetTimeoutRef.current = window.setTimeout(() => {
      setIsCopied(false)
      copyResetTimeoutRef.current = null
    }, 1000)
  }

  return (
    <div className="flex min-w-0 max-w-[min(42rem,100%)] flex-col gap-3">
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
            <div data-testid="assistant-response" className="text-sm text-foreground">
              {message.isStreaming
                ? <StreamingResponse content={message.content} isStreaming />
                : <MarkdownContent content={message.content} />}
              {hasPending && message.pendingArtifact
                ? <PendingArtifactChip pending={message.pendingArtifact} />
                : null}
            </div>
          )
        : null}
      {!message.isStreaming && hasVisibleContent && (
        <Actions>
          <Action
            label={isCopied ? "Copied" : "Copy response"}
            onClick={() => void handleCopy()}
            className={cn(
              "transition-colors duration-200",
              isCopied && "text-primary hover:text-primary",
            )}
          >
            <span aria-hidden="true" className="relative size-4">
              <CopyIcon
                className={cn(
                  "absolute inset-0 size-4 transition-all duration-200 ease-out",
                  isCopied ? "scale-75 -rotate-12 opacity-0" : "scale-100 rotate-0 opacity-100",
                )}
              />
              <CheckIcon
                className={cn(
                  "absolute inset-0 size-4 transition-all duration-200 ease-out",
                  isCopied ? "scale-100 rotate-0 opacity-100" : "scale-75 rotate-12 opacity-0",
                )}
              />
            </span>
          </Action>
        </Actions>
      )}
    </div>
  )
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") {
    return <UserMessage message={message} />
  }
  return <AssistantMessage message={message} />
}
