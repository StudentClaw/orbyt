import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { FolderOpen, FileText, BookOpen } from "lucide-react"
import { FilePathTree, scopePathToRoot } from "./FilePathTree"

export type AssignmentPickerEntry = {
  readonly id: string
  readonly label: string
  readonly url: string
  readonly referenceKind?: "canvas-assignment" | "canvas-coursework"
  readonly sourceType?: "assignment" | "module" | "page" | "announcement"
  readonly courseCode?: string
  readonly dueAt?: string | null
}

export type FilePickerEntry = {
  readonly path: string
  readonly label: string
  readonly mimeType?: string | null
  readonly sizeBytes?: number | null
  readonly kind?: "file" | "directory"
}

export interface MentionPickerHandle {
  moveHighlight: (delta: number) => void
  selectHighlighted: () => void
  hasHighlight: () => boolean
}

export interface MentionPickerProps {
  readonly filter: string
  readonly assignments: readonly AssignmentPickerEntry[]
  readonly files: readonly FilePickerEntry[]
  readonly recents: readonly FilePickerEntry[]
  readonly canReadCanvas: boolean
  readonly onSelectAssignment: (a: AssignmentPickerEntry) => void
  readonly onSelectFile: (f: FilePickerEntry) => void
  readonly onBrowseFiles: () => void
  readonly onRequestCanvasAccess?: () => void
  /** Absolute path to the workspace root. Scopes file row paths and the tree preview. */
  readonly workspaceRoot?: string | null
}

type PickerValue =
  | { kind: "assignment"; entry: AssignmentPickerEntry }
  | { kind: "file"; entry: FilePickerEntry }
  | { kind: "browse" }

const ASSIGNMENT_LIMIT = 8
const FILE_LIMIT = 12

function includesCaseInsensitive(value: string | null | undefined, q: string): boolean {
  return (value ?? "").toLowerCase().includes(q)
}

function filterAssignments(
  assignments: readonly AssignmentPickerEntry[],
  filter: string,
): readonly AssignmentPickerEntry[] {
  const q = filter.trim().toLowerCase()
  if (q === "") return assignments.slice(0, ASSIGNMENT_LIMIT)
  return assignments
    .filter((a) => (
      includesCaseInsensitive(a.label, q)
      || includesCaseInsensitive(a.courseCode, q)
    ))
    .slice(0, ASSIGNMENT_LIMIT)
}

function filterFiles(
  files: readonly FilePickerEntry[],
  filter: string,
): readonly FilePickerEntry[] {
  const q = filter.trim().toLowerCase()
  if (q === "") return files.slice(0, FILE_LIMIT)
  return files
    .filter((f) => includesCaseInsensitive(f.label, q))
    .slice(0, FILE_LIMIT)
}

function dedupeFiles(
  first: readonly FilePickerEntry[],
  second: readonly FilePickerEntry[],
): readonly FilePickerEntry[] {
  const seen = new Set(first.map((f) => f.path))
  return [...first, ...second.filter((f) => !seen.has(f.path))]
}

function displayPath(path: string, root: string | null | undefined): string {
  const scoped = scopePathToRoot(path, root)
  return scoped || path
}

export const MentionPicker = forwardRef<MentionPickerHandle, MentionPickerProps>(
  function MentionPicker(props, ref) {
    const {
      filter,
      assignments,
      files,
      recents,
      canReadCanvas,
      onSelectAssignment,
      onSelectFile,
      onBrowseFiles,
      onRequestCanvasAccess,
      workspaceRoot,
    } = props

    const safeAssignments = assignments ?? []
    const safeFiles = files ?? []
    const safeRecents = recents ?? []

    const visibleAssignments = useMemo(
      () => filterAssignments(safeAssignments, filter),
      [safeAssignments, filter],
    )

    const visibleFiles = useMemo(() => {
      const q = filter.trim().toLowerCase()
      if (q === "") {
        return dedupeFiles(safeRecents, safeFiles).slice(0, FILE_LIMIT)
      }
      return filterFiles(safeFiles, filter)
    }, [safeRecents, safeFiles, filter])

    const rows = useMemo<readonly PickerValue[]>(() => {
      return [
        ...(canReadCanvas
          ? visibleAssignments.map<PickerValue>((entry) => ({
              kind: "assignment",
              entry,
            }))
          : []),
        ...visibleFiles.map<PickerValue>((entry) => ({ kind: "file", entry })),
        { kind: "browse" },
      ]
    }, [canReadCanvas, visibleAssignments, visibleFiles])

    const [activeIndex, setActiveIndex] = useState(0)
    const [engaged, setEngaged] = useState(false)
    const itemRefs = useRef<Array<HTMLDivElement | null>>([])

    useEffect(() => {
      setActiveIndex((prev) => {
        if (rows.length === 0) return 0
        return Math.min(prev, rows.length - 1)
      })
      setEngaged(false)
    }, [rows.length, filter])

    useEffect(() => {
      const el = itemRefs.current[activeIndex]
      if (el) {
        el.scrollIntoView({ block: "nearest" })
      }
    }, [activeIndex])

    const engageAt = useCallback((idx: number) => {
      setActiveIndex(idx)
      setEngaged(true)
    }, [])

    const selectRow = useCallback(
      (value: PickerValue) => {
        if (value.kind === "assignment") onSelectAssignment(value.entry)
        else if (value.kind === "file") onSelectFile(value.entry)
        else if (value.kind === "browse") onBrowseFiles()
      },
      [onSelectAssignment, onSelectFile, onBrowseFiles],
    )

    useImperativeHandle(
      ref,
      () => ({
        moveHighlight: (delta: number) => {
          setActiveIndex((prev) => {
            if (rows.length === 0) return 0
            return (prev + delta + rows.length) % rows.length
          })
          setEngaged(true)
        },
        selectHighlighted: () => {
          const row = rows[activeIndex]
          if (row) selectRow(row)
        },
        hasHighlight: () => rows.length > 0,
      }),
      [rows, activeIndex, selectRow],
    )

    const hoveredRow = engaged ? rows[activeIndex] : undefined
    const hoveredFile = hoveredRow?.kind === "file" ? hoveredRow.entry : null

    const assignmentRowStart = 0
    const assignmentCount = canReadCanvas ? visibleAssignments.length : 0
    const fileRowStart = assignmentRowStart + assignmentCount
    const browseRowIndex = fileRowStart + visibleFiles.length

    return (
      <div
        className="flex items-start gap-2"
        data-testid="mention-picker-root"
      >
        <div className="w-[360px] shrink-0 overflow-hidden rounded-xl">
          <div
            role="listbox"
            aria-label="Mention picker"
            className="no-scrollbar relative flex max-h-[320px] flex-col gap-1 overflow-y-auto overscroll-contain p-1 text-sm text-popover-foreground"
            data-slot="mention-picker-list"
          >
            <SectionLabel icon={<BookOpen className="size-3" />}>
              Canvas
            </SectionLabel>

            {!canReadCanvas ? (
              <div className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground">
                <span>Canvas access is off for this thread.</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    onRequestCanvasAccess?.()
                  }}
                  className="rounded-md border px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-accent"
                >
                  Grant access
                </button>
              </div>
            ) : visibleAssignments.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                {filter.trim() === ""
                  ? "No upcoming Canvas items"
                  : "No Canvas items match"}
              </div>
            ) : (
              visibleAssignments.map((a, idx) => {
                const rowIdx = assignmentRowStart + idx
                return (
                  <AssignmentRow
                    key={`assignment:${a.id}`}
                    entry={a}
                    active={activeIndex === rowIdx}
                    onHover={() => engageAt(rowIdx)}
                    onSelect={() => selectRow({ kind: "assignment", entry: a })}
                    elRef={(el) => {
                      itemRefs.current[rowIdx] = el
                    }}
                  />
                )
              })
            )}

            <div className="-mx-1 my-1 h-px bg-border/40" role="separator" />

            <SectionLabel icon={<FileText className="size-3" />}>
              Files &amp; Folders
            </SectionLabel>

            {visibleFiles.length === 0 && filter.trim() !== "" ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                No files match
              </div>
            ) : null}

            {visibleFiles.map((f, idx) => {
              const rowIdx = fileRowStart + idx
              return (
                <FileRow
                  key={`file:${f.path}`}
                  entry={f}
                  workspaceRoot={workspaceRoot}
                  active={activeIndex === rowIdx}
                  onHover={() => engageAt(rowIdx)}
                  onSelect={() => selectRow({ kind: "file", entry: f })}
                  elRef={(el) => {
                    itemRefs.current[rowIdx] = el
                  }}
                />
              )
            })}

            <BrowseRow
              active={activeIndex === browseRowIndex}
              onHover={() => engageAt(browseRowIndex)}
              onSelect={() => selectRow({ kind: "browse" })}
              elRef={(el) => {
                itemRefs.current[browseRowIndex] = el
              }}
            />
          </div>
        </div>

        {hoveredFile ? (
          <div
            className="hidden animate-in fade-in-0 slide-in-from-left-1 duration-150 md:block"
            data-testid="mention-picker-preview"
          >
            <FilePathTree
              path={hoveredFile.path}
              workspaceRoot={workspaceRoot}
            />
          </div>
        ) : null}
      </div>
    )
  },
)

function SectionLabel({
  children,
  icon,
}: {
  children: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 px-2 pt-1 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </div>
  )
}

const rowBaseClass =
  "relative flex w-full cursor-default items-center gap-2 rounded-xl px-2 py-2 text-sm outline-hidden select-none transition-colors"
const rowActiveClass = "bg-accent text-accent-foreground"

function AssignmentRow({
  entry,
  active,
  onHover,
  onSelect,
  elRef,
}: {
  entry: AssignmentPickerEntry
  active: boolean
  onHover: () => void
  onSelect: () => void
  elRef: (el: HTMLDivElement | null) => void
}) {
  return (
    <div
      ref={elRef}
      role="option"
      aria-selected={active}
      data-slot="combobox-item"
      data-mention-kind={entry.referenceKind ?? "canvas-assignment"}
      data-mention-id={entry.id}
      data-mention-label={entry.label}
      data-highlighted={active ? "" : undefined}
      className={cn(rowBaseClass, "items-start", active && rowActiveClass)}
      onMouseEnter={onHover}
      onMouseMove={onHover}
      onPointerMove={onHover}
      onClick={(e) => {
        e.preventDefault()
        onSelect()
      }}
    >
      <BookOpen className="mt-0.5 size-4 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {entry.label}
          </span>
          {entry.courseCode ? (
            <Badge variant="secondary" className="text-[10px]">
              {entry.courseCode}
            </Badge>
          ) : null}
          {entry.sourceType && entry.sourceType !== "assignment" ? (
            <Badge variant="outline" className="text-[10px] capitalize">
              {entry.sourceType}
            </Badge>
          ) : null}
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {entry.url}
        </span>
      </div>
    </div>
  )
}

function FileRow({
  entry,
  workspaceRoot,
  active,
  onHover,
  onSelect,
  elRef,
}: {
  entry: FilePickerEntry
  workspaceRoot: string | null | undefined
  active: boolean
  onHover: () => void
  onSelect: () => void
  elRef: (el: HTMLDivElement | null) => void
}) {
  const shown = useMemo(
    () => displayPath(entry.path, workspaceRoot),
    [entry.path, workspaceRoot],
  )
  return (
    <div
      ref={elRef}
      role="option"
      aria-selected={active}
      data-slot="combobox-item"
      data-mention-kind="file"
      data-mention-path={entry.path}
      data-mention-label={entry.label}
      data-highlighted={active ? "" : undefined}
      className={cn(rowBaseClass, active && rowActiveClass)}
      onMouseEnter={onHover}
      onMouseMove={onHover}
      onPointerMove={onHover}
      onClick={(e) => {
        e.preventDefault()
        onSelect()
      }}
    >
      <FileText
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-colors",
          active && "text-accent-foreground",
        )}
      />
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-sm font-medium text-foreground">
          {entry.label}
        </span>
        <span
          className="truncate text-[11px] text-muted-foreground/80"
          data-testid="file-row-path"
        >
          {shown}
        </span>
      </div>
    </div>
  )
}

function BrowseRow({
  active,
  onHover,
  onSelect,
  elRef,
}: {
  active: boolean
  onHover: () => void
  onSelect: () => void
  elRef: (el: HTMLDivElement | null) => void
}) {
  return (
    <div
      ref={elRef}
      role="option"
      aria-selected={active}
      data-slot="combobox-item"
      data-mention-kind="browse"
      data-highlighted={active ? "" : undefined}
      className={cn(rowBaseClass, active && rowActiveClass)}
      onMouseEnter={onHover}
      onMouseMove={onHover}
      onPointerMove={onHover}
      onClick={(e) => {
        e.preventDefault()
        onSelect()
      }}
    >
      <FolderOpen className="size-4 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">
        Browse files...
      </span>
    </div>
  )
}
