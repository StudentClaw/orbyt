import { useCallback, useEffect, useMemo, useState } from "react"
import DOMPurify from "dompurify"
import { useNavigate } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { Archive, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  useOrchestrationActions,
  useRuntimeOrchestrationSnapshot,
  useSkills,
  type SkillEntry,
} from "@/hooks/useAppRuntime"
import { waitForPrimaryWsRpcClient } from "@/rpc/appRuntime"
import { removeArchivedAssignmentFromCanvasState } from "@/rpc/canvasState"
import {
  loadAssignmentDetail,
  removeAssignmentDetailEntry,
  useAssignmentDetailEntry,
  type AssignmentDetailEntry,
} from "@/rpc/assignmentDetailState"

interface AssignmentDetailPageProps {
  readonly assignmentId: string
}

const ASSIGNMENT_VISIBLE_SKILL_IDS_KEY = "orbyt:assignment-visible-skill-ids"
const MAX_VISIBLE_SKILLS = 4

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

function readStoredVisibleSkillIds(): string[] | undefined {
  if (typeof window === "undefined") {
    return undefined
  }

  try {
    const raw = window.localStorage.getItem(ASSIGNMENT_VISIBLE_SKILL_IDS_KEY)
    if (raw === null) {
      return undefined
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return undefined
    }

    return parsed.filter((value): value is string => typeof value === "string")
  } catch {
    return undefined
  }
}

function writeStoredVisibleSkillIds(ids: readonly string[]): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(ASSIGNMENT_VISIBLE_SKILL_IDS_KEY, JSON.stringify([...ids]))
  } catch {
    // Ignore quota / private mode failures.
  }
}

function sortSkillsStable(skills: readonly SkillEntry[]): SkillEntry[] {
  return [...skills].sort((left, right) => {
    const byName = left.name.localeCompare(right.name)
    if (byName !== 0) {
      return byName
    }
    return left.id.localeCompare(right.id)
  })
}

function defaultVisibleSkillIds(sortedSkills: readonly SkillEntry[]): readonly string[] {
  return sortedSkills.slice(0, MAX_VISIBLE_SKILLS).map((skill) => skill.id)
}

function resolveVisibleSkillIds(
  sortedSkills: readonly SkillEntry[],
  skillById: ReadonlyMap<string, SkillEntry>,
  stored: string[] | undefined,
): readonly string[] {
  if (stored === undefined) {
    return defaultVisibleSkillIds(sortedSkills)
  }

  const filtered = stored.filter((id) => skillById.has(id)).slice(0, MAX_VISIBLE_SKILLS)
  if (filtered.length === 0) {
    return defaultVisibleSkillIds(sortedSkills)
  }

  return filtered
}

function skillDisplayName(skill: SkillEntry): string {
  return skill.name
}

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
    case "pending_review":
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

function buildAssignmentSkillContextMessage(entry: AssignmentDetailEntry): string {
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

  const promptBody =
    body && body.length > 0
      ? `Assignment details:\n${body}`
      : "Assignment details were not available from Canvas. Work from the metadata and note any missing context."

  return `Here is the assignment I am working on. Use this context together with your skill instructions.\n\n${metadataLines.join("\n")}\n\n${promptBody}`
}

function AssignmentSendToChatCommand({
  workspaceEntries,
  isForwarding,
  panelTestId,
  onPick,
}: {
  readonly workspaceEntries: readonly AssignmentWorkspaceEntry[]
  readonly isForwarding: boolean
  readonly panelTestId?: string
  readonly onPick: (target: AssignmentActionTarget) => void
}) {
  return (
    <>
      <PopoverHeader className="px-4 pt-4 pb-2">
        <PopoverTitle>Send to a chat</PopoverTitle>
      </PopoverHeader>
      <Command data-testid={panelTestId}>
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
                className="my-1 rounded-md border border-dashed border-muted-foreground/25 bg-muted/30 aria-selected:border-primary/40 aria-selected:bg-muted/50"
                onSelect={() => {
                  onPick({
                    kind: "new-thread",
                    workspaceId: entry.workspaceId,
                    workspaceName: entry.workspaceName,
                  })
                }}
              >
                <span className="flex min-w-0 flex-1 items-start gap-2.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                    <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold text-foreground">New chat</span>
                    <span className="truncate text-xs text-muted-foreground">
                      Start a fresh chat in {entry.workspaceName}
                    </span>
                  </span>
                </span>
              </CommandItem>
              {entry.threads.map((target) => (
                <CommandItem
                  key={target.threadId}
                  disabled={isForwarding}
                  value={`${target.threadTitle} ${target.workspaceName}`}
                  onSelect={() => {
                    onPick({ kind: "thread", thread: target })
                  }}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm">{target.threadTitle}</span>
                    <span className="truncate text-xs text-muted-foreground">{target.workspaceName}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </>
  )
}

function AssignmentSummaryHeader({
  entry,
  isArchiving,
  onArchive,
}: {
  readonly entry: AssignmentDetailEntry
  readonly isArchiving: boolean
  readonly onArchive: () => void
}) {
  const preview = entry.preview
  const grade = formatGrade(entry)
  const submissionStatus = formatSubmissionStatus(preview?.submissionStatus)
  const metaPillClass =
    "inline-flex items-center rounded-full border border-border/70 bg-muted/15 px-3 py-1 text-xs font-medium text-muted-foreground"

  return (
    <section className="pagelet px-4 py-4 sm:px-5 sm:py-4" data-testid="assignment-detail-summary">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-relaxed text-muted-foreground sm:text-sm">{courseLabel(entry)}</p>
          <h1
            className="mt-1.5 text-xl font-semibold tracking-tight text-foreground sm:mt-2 sm:text-2xl"
            data-testid="assignment-detail-title"
          >
            {preview?.title ?? "Assignment"}
          </h1>
          <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4">
            <span className={metaPillClass}>Due {formatDueDate(preview?.effectiveDueAt)}</span>
            {submissionStatus ? <span className={metaPillClass}>{submissionStatus}</span> : null}
            {preview?.pointsPossible !== undefined ? (
              <span className={metaPillClass}>{preview.pointsPossible} pts</span>
            ) : null}
            {grade ? <span className={metaPillClass}>Grade {grade}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-border/70 px-3.5 font-medium text-muted-foreground hover:border-destructive/25 hover:bg-destructive/10 hover:text-destructive"
            disabled={isArchiving}
            onClick={onArchive}
          >
            <Archive className="mr-1.5 size-3.5" aria-hidden="true" />
            {isArchiving ? "Archiving..." : "Archive"}
          </Button>
          {preview?.htmlUrl ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-border/70 px-3.5 font-medium hover:border-primary/25 hover:bg-muted/30"
            >
              <a href={preview.htmlUrl} target="_blank" rel="noopener noreferrer">
                Open in Canvas
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function AssignmentSkillsEditDialog({
  open,
  onOpenChange,
  sortedSkills,
  initialSelectedIds,
  onSave,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly sortedSkills: readonly SkillEntry[]
  readonly initialSelectedIds: readonly string[]
  readonly onSave: (ids: readonly string[]) => void
}) {
  const [draftIds, setDraftIds] = useState<Set<string>>(() => new Set(initialSelectedIds))

  useEffect(() => {
    if (open) {
      setDraftIds(new Set(initialSelectedIds))
    }
  }, [open, initialSelectedIds])

  const toggle = useCallback((skillId: string, nextChecked: boolean) => {
    setDraftIds((current) => {
      const next = new Set(current)
      if (nextChecked) {
        if (next.size >= MAX_VISIBLE_SKILLS) {
          return current
        }
        next.add(skillId)
      } else {
        next.delete(skillId)
      }
      return next
    })
  }, [])

  const atMax = draftIds.size >= MAX_VISIBLE_SKILLS

  const handleSave = useCallback(() => {
    const ordered = sortedSkills.filter((skill) => draftIds.has(skill.id)).map((skill) => skill.id)
    onSave(ordered)
    onOpenChange(false)
  }, [draftIds, onOpenChange, onSave, sortedSkills])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skills on assignment page</DialogTitle>
          <DialogDescription>
            Choose up to {MAX_VISIBLE_SKILLS} skills to show as shortcuts. Your skill instructions are applied when you
            send to chat.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(24rem,50vh)] space-y-3 overflow-y-auto pr-1">
          {atMax ? (
            <p className="text-xs text-muted-foreground">Maximum {MAX_VISIBLE_SKILLS} skills selected. Uncheck one to pick another.</p>
          ) : null}
          {sortedSkills.map((skill) => {
            const checked = draftIds.has(skill.id)
            const disableUnchecked = !checked && atMax
            return (
              <div key={skill.id} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                <Checkbox
                  id={`assignment-skill-pick-${skill.id}`}
                  checked={checked}
                  disabled={disableUnchecked}
                  onCheckedChange={(value) => toggle(skill.id, value === true)}
                />
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`assignment-skill-pick-${skill.id}`} className="cursor-pointer font-medium leading-snug">
                    {skillDisplayName(skill)}
                  </Label>
                  {skill.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">{skill.description}</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssignmentSkillLaunchers({
  visibleSkills,
  sortedSkills,
  workspaceEntries,
  onAction,
  disabled,
  isForwarding,
  onOpenEdit,
  editDisabled,
}: {
  readonly visibleSkills: readonly SkillEntry[]
  readonly sortedSkills: readonly SkillEntry[]
  readonly workspaceEntries: readonly AssignmentWorkspaceEntry[]
  readonly onAction: (skillId: string, target: AssignmentActionTarget) => void
  readonly disabled: boolean
  readonly isForwarding: boolean
  readonly onOpenEdit: () => void
  readonly editDisabled: boolean
}) {
  const [openSkillId, setOpenSkillId] = useState<string | null>(null)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [explorePhase, setExplorePhase] = useState<"pick-skill" | "send">("pick-skill")
  const [exploreSkillId, setExploreSkillId] = useState<string | null>(null)
  const comboboxAnchorRef = useComboboxAnchor()
  const canPickTarget = !disabled && !isForwarding && workspaceEntries.length > 0

  const closeExplore = useCallback(() => {
    setExploreOpen(false)
    setExplorePhase("pick-skill")
    setExploreSkillId(null)
  }, [])

  const openPinned = useCallback((skillId: string | null) => {
    if (skillId !== null) {
      setExploreOpen(false)
      setExplorePhase("pick-skill")
      setExploreSkillId(null)
    }
    setOpenSkillId(skillId)
  }, [])

  const openExplore = useCallback(() => {
    setOpenSkillId(null)
    setExplorePhase("pick-skill")
    setExploreSkillId(null)
    setExploreOpen(true)
  }, [])

  const exploreSkill = exploreSkillId
    ? sortedSkills.find((skill) => skill.id === exploreSkillId) ?? null
    : null

  return (
    <section className="pagelet px-4 py-4 sm:px-5 sm:py-4" data-testid="assignment-detail-actions">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2">
          <span className="shrink-0 text-sm font-medium text-muted-foreground">Skills</span>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {visibleSkills.map((skill) => (
              <Popover
                key={skill.id}
                open={openSkillId === skill.id}
                onOpenChange={(open) => openPinned(open ? skill.id : null)}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canPickTarget}
                    data-testid={`assignment-skill-${skill.id}`}
                    className="h-8 rounded-full border-border/70 bg-muted/15 px-3.5 font-medium text-foreground/90 shadow-none transition-colors hover:border-primary/25 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/25"
                    onClick={() => openPinned(skill.id)}
                  >
                    {skillDisplayName(skill)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[24rem] gap-0 p-0" data-testid={`assignment-thread-picker-${skill.id}`}>
                  <AssignmentSendToChatCommand
                    workspaceEntries={workspaceEntries}
                    isForwarding={isForwarding}
                    panelTestId={`assignment-thread-picker-command-${skill.id}`}
                    onPick={(target) => {
                      void onAction(skill.id, target)
                      openPinned(null)
                    }}
                  />
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
        <Popover
          open={exploreOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeExplore()
            }
          }}
        >
          <PopoverAnchor asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              disabled={!canPickTarget}
              data-testid="assignment-skill-search-trigger"
              aria-label="Search skills"
              title="Search skills"
              onClick={() => openExplore()}
              className="size-8 shrink-0 rounded-full border-primary/25 text-primary hover:border-primary/40 hover:bg-primary/10 disabled:text-muted-foreground"
            >
              <HugeiconsIcon icon={Search01Icon} strokeWidth={2} className="size-4" />
            </Button>
          </PopoverAnchor>
          <PopoverContent align="end" className="w-[24rem] gap-0 p-0" data-testid="assignment-skill-search-popover">
            {explorePhase === "pick-skill" ? (
              <div className="p-3">
                <p className="mb-2 text-sm font-medium text-foreground">Find a skill</p>
                <Combobox
                  key={`${explorePhase}-${exploreSkillId ?? "none"}`}
                  onValueChange={(next) => {
                    if (next !== null && typeof next === "string") {
                      setExploreSkillId(next)
                      setExplorePhase("send")
                    }
                  }}
                >
                  <div ref={comboboxAnchorRef}>
                    <ComboboxInput placeholder="Search skills…" showTrigger={false} className="w-full min-w-0" />
                  </div>
                  <ComboboxContent anchor={comboboxAnchorRef} side="bottom" align="start" className="min-w-[min(20rem,var(--anchor-width))]">
                    <ComboboxList>
                      <ComboboxEmpty>No matching skills.</ComboboxEmpty>
                      {sortedSkills.map((skill) => (
                        <ComboboxItem key={skill.id} value={skill.id} data-testid={`assignment-skill-combobox-${skill.id}`}>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate font-medium text-foreground">{skillDisplayName(skill)}</span>
                            {skill.description ? (
                              <span className="truncate text-xs text-muted-foreground">{skill.description}</span>
                            ) : (
                              <span className="truncate text-xs text-muted-foreground">{skill.id}</span>
                            )}
                          </div>
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
            ) : exploreSkill ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-2 border-b border-border/70 bg-muted/20 px-3 py-2.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 text-muted-foreground hover:text-primary"
                    onClick={() => {
                      setExplorePhase("pick-skill")
                      setExploreSkillId(null)
                    }}
                  >
                    Back
                  </Button>
                  <span className="min-w-0 truncate text-sm font-medium text-foreground/90">{skillDisplayName(exploreSkill)}</span>
                </div>
                <AssignmentSendToChatCommand
                  workspaceEntries={workspaceEntries}
                  isForwarding={isForwarding}
                  panelTestId="assignment-thread-picker-explore"
                  onPick={(target) => {
                    void onAction(exploreSkill.id, target)
                    closeExplore()
                  }}
                />
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-sm text-muted-foreground hover:text-primary"
          disabled={editDisabled}
          aria-label="Edit skills on assignment page"
          onClick={onOpenEdit}
        >
          Edit
        </Button>
        </div>
      </div>
      {disabled ? (
        <p className="mt-3 text-sm text-muted-foreground">Open a workspace to launch assignment help in chat.</p>
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
          <p className="text-sm text-muted-foreground">Assignment details couldn&apos;t be loaded right now.</p>
          {entry.error ? <p className="text-sm text-muted-foreground">{entry.error}</p> : null}
        </div>
      ) : null}

      {entry.status !== "error" && cleanHtml ? (
        <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: cleanHtml }} />
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
  const allSkills = useSkills()
  const entry = useAssignmentDetailEntry(assignmentId)
  const [isForwarding, setIsForwarding] = useState<boolean>(false)
  const [isArchiving, setIsArchiving] = useState<boolean>(false)
  const [savedVisibleSkillIds, setSavedVisibleSkillIds] = useState<string[] | undefined>(() => readStoredVisibleSkillIds())
  const [editOpen, setEditOpen] = useState(false)

  const sortedSkills = useMemo(() => sortSkillsStable(allSkills), [allSkills])
  const skillById = useMemo(() => new Map(allSkills.map((skill) => [skill.id, skill])), [allSkills])

  const visibleSkillIds = useMemo(
    () => resolveVisibleSkillIds(sortedSkills, skillById, savedVisibleSkillIds),
    [sortedSkills, skillById, savedVisibleSkillIds],
  )

  const visibleSkills = useMemo(
    () => visibleSkillIds.map((id) => skillById.get(id)).filter((skill): skill is SkillEntry => skill !== undefined),
    [visibleSkillIds, skillById],
  )

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

  const handleSaveVisibleSkills = useCallback((ids: readonly string[]) => {
    writeStoredVisibleSkillIds(ids)
    setSavedVisibleSkillIds([...ids])
  }, [])

  const handleSkillAction = async (skillId: string, target: AssignmentActionTarget) => {
    const skill = skillById.get(skillId)
    if (!skill) {
      return
    }

    setIsForwarding(true)
    try {
      let threadId: string
      let workspaceId: string
      if (target.kind === "new-thread") {
        threadId = await actions.createThread(target.workspaceId, skill.name)
        workspaceId = target.workspaceId
      } else {
        threadId = target.thread.threadId
        workspaceId = target.thread.workspaceId
      }

      await actions.sendTurn(threadId, buildAssignmentSkillContextMessage(entry), [], null, skillId)
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

  const handleArchive = useCallback(async () => {
    if (isArchiving) return

    setIsArchiving(true)
    try {
      const client = await waitForPrimaryWsRpcClient()
      await client.canvas.archiveAssignment(assignmentId)
      removeArchivedAssignmentFromCanvasState(assignmentId)
      removeAssignmentDetailEntry(assignmentId)
      toast.success("Assignment archived")
      await navigate({ to: "/" })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to archive assignment.")
    } finally {
      setIsArchiving(false)
    }
  }, [assignmentId, isArchiving, navigate])

  const stripDisabled = !snapshot || snapshot.workspaces.length === 0
  const noSkillsInstalled = allSkills.length === 0

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-5 p-6 lg:p-8" data-testid="assignment-detail-page">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 -ml-2 rounded-full px-2.5 text-muted-foreground hover:text-foreground"
          onClick={() => void navigate({ to: "/" })}
          data-testid="assignment-detail-back"
        >
          <ArrowLeft className="mr-1.5 size-4" aria-hidden="true" />
          Back to dashboard
        </Button>
      </div>
      <AssignmentSummaryHeader entry={entry} isArchiving={isArchiving} onArchive={handleArchive} />
      {noSkillsInstalled ? (
        <section className="pagelet p-5" data-testid="assignment-detail-actions">
          <p className="text-sm text-muted-foreground">
            No skills are installed yet. Open Settings → Connections → Skills to discover skills, then return here to
            pin shortcuts.
          </p>
        </section>
      ) : (
        <>
          <AssignmentSkillsEditDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            sortedSkills={sortedSkills}
            initialSelectedIds={visibleSkillIds}
            onSave={handleSaveVisibleSkills}
          />
          <AssignmentSkillLaunchers
            visibleSkills={visibleSkills}
            sortedSkills={sortedSkills}
            workspaceEntries={workspaceEntries}
            onAction={handleSkillAction}
            disabled={stripDisabled}
            isForwarding={isForwarding}
            onOpenEdit={() => setEditOpen(true)}
            editDisabled={noSkillsInstalled}
          />
        </>
      )}
      <AssignmentBodySection entry={entry} onRetry={() => void loadAssignmentDetail(assignmentId)} />
    </div>
  )
}
