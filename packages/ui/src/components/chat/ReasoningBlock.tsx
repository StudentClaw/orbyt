import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { MarkdownContent } from "./MarkdownContent"

interface ReasoningBlockProps {
  readonly reasoning: string
}

export function ReasoningBlock({ reasoning }: ReasoningBlockProps) {
  return (
    <Collapsible className="mb-2">
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Badge variant="outline" className="text-[10px]">Thinking</Badge>
        <span>View reasoning</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
        <MarkdownContent content={reasoning} />
      </CollapsibleContent>
    </Collapsible>
  )
}
