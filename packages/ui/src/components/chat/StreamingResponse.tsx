import { MarkdownContent } from "./MarkdownContent"

interface StreamingResponseProps {
  readonly content: string
  readonly isStreaming: boolean
}

export function StreamingResponse({ content, isStreaming }: StreamingResponseProps) {
  if (!content && isStreaming) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
        <span className="text-sm">Thinking...</span>
      </div>
    )
  }

  return (
    <div>
      <MarkdownContent content={content} />
      {isStreaming && (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground" aria-hidden="true" />
      )}
    </div>
  )
}
