import { useEffect, useMemo, useState } from "react"
import DOMPurify from "dompurify"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useOrchestrationActions, useRuntimeOrchestrationSnapshot } from "@/hooks/useAppRuntime"
import {
  loadAssignmentDetail,
  useAssignmentDetailEntry,
  type AssignmentDetailEntry,
} from "@/rpc/assignmentDetailState"

interface AssignmentDetailPageProps {
  readonly assignmentId: string
}

type AssignmentQuickActionId =
  | "draft"
  | "plan"
  | "explain"
  | "study"

type AssignmentQuickAction = {
  readonly id: AssignmentQuickActionId
  readonly label: string
}

type AssignmentThreadTarget = {
  readonly threadId: string
  readonly threadTitle: string
  readonly workspaceId: string
  readonly workspaceName: string
}

type AssignmentWorkspaceEntry = {
  readonly workspaceId: string
  readonly workspaceName: string
  readonly threads: readonly AssignmentThreadTarget[]
}

type AssignmentActionTarget =
  | { readonly kind: "thread"; readonly thread: AssignmentThreadTarget }
  | {
      readonly kind: "new-thread"
      readonly workspaceId: string
      readonly workspaceName: string
    }

const QUICK_ACTIONS: ReadonlyArray<AssignmentQuickAction> = [
  { id: "draft", label: "Draft Assignment" },
  { id: "plan", label: "Plan Assignment" },
  { id: "explain", label: "Explain Requirements" },
  { id: "study", label: "Study From This" },
]

function formatDueDate(value?: string): string {
  if (!value) {
    return "No due date"
  }

  const date = new Date(value)
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatSubmissionStatus(value?: string): string | null {
  if (!value) {
    return null
  }

  switch (value.trim().toLowerCase()) {
    case "graded":
      return "Graded"
    case "submitted":
      return "Submitted"
    case "unsubmitted":
    case "not_submitted":
      return "Not submitted"
    default:
      return value
    }
}

function formatGrade(entry: AssignmentDetailEntry): string | null {
  const preview = entry.preview
  if (!preview?.grade) {
    return null
  }
  return preview.grade
}

function courseLabel(entry: AssignmentDetailEntry): string {
  const preview = entry.preview
  if (!preview) {
    return "Canvas assignment"
  }

  return preview.courseName
    ? `${preview.courseCode} · ${preview.courseName}`
    : preview.courseCode
}

function bodyHtml(entry: AssignmentDetailEntry): string | null {
  const raw = entry.detail?.source.description
  if (!raw || raw.trim().length === 0) {
    return null
  }

  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
  })
}

function buildAssignmentActionPrompt(
  actionId: AssignmentQuickActionId,
  entry: AssignmentDetailEntry,
): string {
  const preview = entry.preview
  const body = entry.detail?.source.description?.trim()
  const metadataLines = [
    preview?.title ? `Assignment: ${preview.title}` : null,
    preview?.courseName ? `Course: ${preview.courseName} (${preview.courseCode})` : preview?.courseCode ? `Course: ${preview.courseCode}` : null,
    preview?.effectiveDueAt ? `Due: ${formatDueDate(preview.effectiveDueAt)}` : null,
    preview?.submissionStatus ? `Submission status: ${preview.submissionStatus}` : null,
    preview?.pointsPossible !== undefined ? `Points possible: ${preview.pointsPossible}` : null,
    preview?.grade ? `Grade: ${preview.grade}` : null,
  ].filter(Boolean)

  const promptBody = body && body.length > 0
    ? `Assignment details:\n${body}`
    : "Assignment details were not available from Canvas. Work from the metadata and note any missing context."

  switch (actionId) {
    case "draft":
      return `Help me produce a strong first draft or solution approach for this assignment.\n\n${metadataLines.join("\n")}\n\n${promptBody}`
    case "plan":
      return `Break this assignment into concrete steps and help me plan how to complete it efficiently before the deadline.\n\n${metadataLines.join("\n")}\n\n${promptBody}`
    case "explain":
      return `Explain this assignment in plain language. Tell me what is being asked, what the deliverable likely is, and what I should pay attention to.\n\n${metadataLines.join("\n")}\n\n${promptBody}`
    case "study":
      return `Turn this assignment into a study aid. Extract the concepts, likely knowledge gaps, and a focused review plan I can use to get ready to complete it well.\n\n${metadataLines.join("\n")}\n\n${promptBody}`
  }
}

function AssignmentSummaryHeader({ entry }: { entry: AssignmentDetailEntry }) {
  const preview = entry.preview
  const grade = formatGrade(entry)
  const submissionStatus = formatSubmissionStatus(preview?.submissionStatus)

  return (
    <section className="pagelet p-6" data-testid="assignment-detail-summary">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{courseLabel(entry)}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight" data-testid="assignment-detail-title">
            {preview?.title ?? "Assignment"}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              Due {formatDueDate(preview?.effectiveDueAt)}
            </span>
            {submissionStatus ? (
              <span className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
                {submissionStatus}
              </span>
            ) : null}
            {preview?.pointsPossible !== undefined ? (
              <span className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
                {preview.pointsPossible} pts
              </span>
            ) : null}
            {grade ? (
              <span className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
                Grade {grade}
              </span>
            ) : null}
          </div>
        </div>
        {preview?.htmlUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={preview.htmlUrl} target="_blank" rel="noopener noreferrer">
              Open in Canvas
            </a>
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function AssignmentQuickActions({
  workspaceEntries,
  onAction,
  disabled,
  isForwarding,
}: {
  readonly workspaceEntries: readonly AssignmentWorkspaceEntry[]
  readonly onAction: (actionId: AssignmentQuickActionId, target: AssignmentActionTarget) => void
  readonly disabled: boolean
  readonly isForwarding: boolean
}) {
  const [openActionId, setOpenActionId] = useState<AssignmentQuickActionId | null>(null)
  const canPickTarget = !disabled && !isForwarding && workspaceEntries.length > 0

  return (
    <section className="pagelet p-5" data-testid="assignment-detail-actions">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-2 text-sm font-medium text-muted-foreground">Quick actions</p>
        {QUICK_ACTIONS.map((action) => (
          <Popover
            key={action.id}
            open={openActionId === action.id}
            onOpenChange={(open) => setOpenActionId(open ? action.id : null)}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canPickTarget}
                onClick={() => setOpenActionId(action.id)}
              >
                {action.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[24rem] gap-0 p-0"
              data-testid={`assignment-thread-picker-${action.id}`}
            >
              <PopoverHeader className="px-4 pt-4 pb-2">
                <PopoverTitle>Send to a chat</PopoverTitle>
              </PopoverHeader>
              <Command>
                <CommandInput placeholder="Search chats or folders..." />
                <CommandList>
                  <CommandEmpty>No chats found.</CommandEmpty>
                  {workspaceEntries.map((entry) => (
                    <CommandGroup key={entry.workspaceId} heading={entry.workspaceName}>
                      <CommandItem
                        key={`new-thread-${entry.workspaceId}`}
                        disabled={isForwarding}
                        value={`New chat ${entry.workspaceName}`}
                        data-testid={`assignment-new-thread-${entry.workspaceId}`}
                        onSelect={() => {
                          void onAction(action.id, {
                            kind: "new-thread",
                            workspaceId: entry.workspaceId,
                            workspaceName: entry.workspaceName,
                          })
                          setOpenActionId(null)
                        }}
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium">New chat</span>
                          <span className="truncate text-xs text-muted-foreground">
                            Start a fresh chat in {entry.workspaceName}
                          </span>
                        </span>
                      </CommandItem>
                      {entry.threads.map((target) => (
                        <CommandItem
                          key={target.threadId}
                          disabled={isForwarding}
                          value={`${target.threadTitle} ${target.workspaceName}`}
                          onSelect={() => {
                            void onAction(action.id, { kind: "thread", thread: target })
                            setOpenActionId(null)
                          }}
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm">{target.threadTitle}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {target.workspaceName}
                            </span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ))}
      </div>
      {disabled ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Open a workspace to launch assignment help in chat.
        </p>
      ) : null}
    </section>
  )
}

function AssignmentBodySection({
  entry,
  onRetry,
}: {
  readonly entry: AssignmentDetailEntry
  readonly onRetry: () => void
}) {
  const cleanHtml = useMemo(() => bodyHtml(entry), [entry])

  return (
    <section className="pagelet p-6" data-testid="assignment-detail-body">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Assignment details</h2>
        {entry.status === "error" ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>

      {entry.status === "loading" && !cleanHtml ? (
        <p className="text-sm text-muted-foreground">Loading assignment details…</p>
      ) : null}

      {entry.status === "error" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Assignment details couldn&apos;t be loaded right now.
          </p>
          {entry.error ? (
            <p className="text-sm text-muted-foreground">{entry.error}</p>
          ) : null}
        </div>
      ) : null}

      {entry.status !== "error" && cleanHtml ? (
        <div
          className="prose prose-sm max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      ) : null}

      {entry.status !== "error" && !cleanHtml && entry.status !== "loading" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Full assignment instructions weren&apos;t available from Canvas for this item.
          </p>
          {entry.preview?.htmlUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={entry.preview.htmlUrl} target="_blank" rel="noopener noreferrer">
                Open in Canvas
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export function AssignmentDetailPage({ assignmentId }: AssignmentDetailPageProps) {
  const navigate = useNavigate()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const actions = useOrchestrationActions()
  const entry = useAssignmentDetailEntry(assignmentId)
  const [isForwarding, setIsForwarding] = useState<boolean>(false)
  const workspaceEntries = useMemo<readonly AssignmentWorkspaceEntry[]>(() => {
    if (!snapshot) {
      return []
    }

    const threadsByWorkspace = new Map<string, AssignmentThreadTarget[]>()
    const orderedThreads = [...snapshot.threads].sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    )

    for (const workspace of snapshot.workspaces) {
      threadsByWorkspace.set(workspace.id, [])
    }

    for (const thread of orderedThreads) {
      const bucket = threadsByWorkspace.get(thread.workspaceId)
      if (!bucket) {
        continue
      }
      const workspaceName =
        snapshot.workspaces.find((workspace) => workspace.id === thread.workspaceId)?.name ?? "Folder"
      bucket.push({
        threadId: thread.id,
        threadTitle: thread.title,
        workspaceId: thread.workspaceId,
        workspaceName,
      })
    }

    return snapshot.workspaces.map((workspace) => ({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      threads: threadsByWorkspace.get(workspace.id) ?? [],
    }))
  }, [snapshot])

  useEffect(() => {
    void loadAssignmentDetail(assignmentId)
  }, [assignmentId])

  const handleQuickAction = async (
    actionId: AssignmentQuickActionId,
    target: AssignmentActionTarget,
  ) => {
    const action = QUICK_ACTIONS.find((candidate) => candidate.id === actionId)
    if (!action) {
      return
    }

    setIsForwarding(true)
    try {
      let threadId: string
      let workspaceId: string
      if (target.kind === "new-thread") {
        threadId = await actions.createThread(target.workspaceId, action.label)
        workspaceId = target.workspaceId
      } else {
        threadId = target.thread.threadId
        workspaceId = target.thread.workspaceId
      }

      await actions.sendTurn(
        threadId,
        buildAssignmentActionPrompt(actionId, entry),
        [],
        null,
        null,
      )
      await navigate({
        to: "/chat/$workspaceId/$threadId",
        params: {
          workspaceId,
          threadId,
        },
      })
    } finally {
      setIsForwarding(false)
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-5 p-6 lg:p-8" data-testid="assignment-detail-page">
      <AssignmentSummaryHeader entry={entry} />
      <AssignmentQuickActions
        workspaceEntries={workspaceEntries}
        onAction={handleQuickAction}
        disabled={!snapshot || snapshot.workspaces.length === 0}
        isForwarding={isForwarding}
      />
      <AssignmentBodySection entry={entry} onRetry={() => void loadAssignmentDetail(assignmentId)} />
    </div>
  )
}
