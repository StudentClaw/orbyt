import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"
import type { ChatMessage } from "@/hooks/chat-model"
import { MarkdownContent } from "./MarkdownContent"
import { StreamingResponse } from "./StreamingResponse"
import { ReasoningBlock } from "./ReasoningBlock"
import { ToolCallIndicator } from "./ToolCallIndicator"

interface MessageBubbleProps {
  readonly message: ChatMessage
}

function UserMessage({ message }: MessageBubbleProps) {
  return (
    <div className="flex items-start gap-3 justify-end">
      <div className="flex flex-col items-end gap-1 max-w-[80%]">
        <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
        </span>
      </div>
      <Avatar size="sm">
        <AvatarFallback>You</AvatarFallback>
      </Avatar>
    </div>
  )
}

function AssistantMessage({ message }: MessageBubbleProps) {
  return (
    <div className="flex items-start gap-3">
      <Avatar size="sm">
        <AvatarFallback className="bg-primary/10 text-primary">SC</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1 max-w-[80%]">
        <div className="rounded-2xl rounded-tl-sm bg-card px-4 py-2.5 text-card-foreground border">
          {message.reasoning && <ReasoningBlock reasoning={message.reasoning} />}
          {message.toolCalls?.map((toolCall, i) => (
            <div key={i} className="mb-2">
              <ToolCallIndicator toolCall={toolCall} />
            </div>
          ))}
          {message.isStreaming ? (
            <StreamingResponse content={message.content} isStreaming />
          ) : (
            <div className="text-sm">
              <MarkdownContent content={message.content} />
            </div>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
        </span>
      </div>
    </div>
  )
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.role === "user") {
    return <UserMessage message={message} />
  }
  return <AssistantMessage message={message} />
}
