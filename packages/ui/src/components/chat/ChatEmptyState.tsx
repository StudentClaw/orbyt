import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"

interface ChatEmptyStateProps {
  readonly onSuggestionClick: (content: string) => void
}

const SUGGESTIONS = [
  "What's due this week?",
  "Plan my study session",
  "Summarize my assignments",
  "Help me get started",
] as const

export function ChatEmptyState({ onSuggestionClick }: ChatEmptyStateProps) {
  return (
    <Empty className="border-0">
      <EmptyHeader>
        <EmptyTitle>Start a conversation</EmptyTitle>
        <EmptyDescription>
          Ask about your assignments, upcoming deadlines, or plan your week.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              onClick={() => onSuggestionClick(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </EmptyContent>
    </Empty>
  )
}
