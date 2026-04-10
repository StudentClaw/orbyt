import { Spinner } from "@/components/ui/spinner"
import { Badge } from "@/components/ui/badge"
import type { ToolCallInfo } from "@/stores/chatStore"

interface ToolCallIndicatorProps {
  readonly toolCall: ToolCallInfo
}

const TOOL_LABELS: Record<string, string> = {
  "canvas.getCourses": "Fetching courses...",
  "canvas.getCoursework": "Fetching assignments...",
  "canvas.getGrades": "Fetching grades...",
  "canvas.getAnnouncements": "Fetching announcements...",
  "canvas.sync": "Syncing Canvas data...",
  "planner.createPlan": "Creating study plan...",
  "planner.reschedule": "Rescheduling sessions...",
}

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? `Running ${toolName}...`
}

export function ToolCallIndicator({ toolCall }: ToolCallIndicatorProps) {
  const label = getToolLabel(toolCall.toolName)

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
      {toolCall.status === "pending" && <Spinner className="size-3" />}
      {toolCall.status === "complete" && (
        <svg className="size-3 text-green-500" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
        </svg>
      )}
      {toolCall.status === "error" && (
        <Badge variant="destructive" className="text-[10px]">Failed</Badge>
      )}
      <span>{label}</span>
    </div>
  )
}
