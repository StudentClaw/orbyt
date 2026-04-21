import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { ReadinessProgressBar } from "@/components/runtime/ReadinessProgressBar"

interface ChatLoadingStateProps {
  readonly title?: string | null
  readonly detail?: string | null
}

export function ChatLoadingState({
  title = "Preparing Codex",
  detail = "Warming the local Codex runtime for chat.",
}: ChatLoadingStateProps) {
  return (
    <Empty className="border-0" data-testid="chat-loading-state">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{detail}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-xl">
        <ReadinessProgressBar activeStage={2} testId="chat-loading-progress" />
      </EmptyContent>
    </Empty>
  )
}
