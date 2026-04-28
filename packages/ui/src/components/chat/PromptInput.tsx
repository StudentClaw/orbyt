import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  IpcChannel,
  type ChatModel,
  type ProviderApprovalDecision,
  type ProviderPendingApproval,
  type ThreadAccessMode,
  type TurnAttachmentInput,
  type TurnReferenceInput,
} from "@orbyt/contracts"
import { PlusIcon, SquareIcon } from "lucide-react"
import { toast } from "sonner"
import { RichComposer, type RichComposerHandle } from "@/components/chat/RichComposer"
import { SkillPicker, filterSkills, type SkillPickerEntry } from "@/components/chat/SkillPicker"
import {
  MentionPicker,
  type AssignmentPickerEntry,
  type FilePickerEntry,
  type MentionPickerHandle,
} from "@/components/chat/MentionPicker"
import { ChatAttachments } from "@/components/chat/ChatAttachments"
import {
  type PromptInputMessage,
  PromptInput as RegistryPromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
} from "@/components/ai/prompt-input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ChatStatus } from "@/hooks/chat-model"
import type { WsConnectionPhase } from "@/rpc/wsConnectionState"
import { cn } from "@/lib/utils"
import { ModelSelector } from "./ModelSelector"

interface PromptInputProps {
  readonly onSend: (input: {
    content: string
    attachments: readonly TurnAttachmentInput[]
    references: readonly TurnReferenceInput[]
    skillId?: string | null
  }) => void | Promise<void>
  readonly skills?: readonly SkillPickerEntry[]
  readonly assignments?: readonly AssignmentPickerEntry[]
  readonly canReadCanvas?: boolean
  readonly workspaceRoot?: string | null
  readonly onRequestCanvasAccess?: () => void
  readonly onForkSkill?: (skill: SkillPickerEntry) => void
  readonly onManageSkillPermissions?: (skill: SkillPickerEntry) => void
  readonly onInterrupt: () => void
  readonly status: ChatStatus
  readonly connectionState: WsConnectionPhase
  readonly disabled?: boolean
  readonly disabledReason?: string | null
  readonly loading?: boolean
  readonly loadingLabel?: string | null
  readonly loadingDetail?: string | null
  readonly availableModels: readonly ChatModel[]
  readonly selectedModel: string
  readonly onModelChange: (model: string) => void
  readonly accessMode: ThreadAccessMode | null
  readonly onAccessModeChange: (accessMode: ThreadAccessMode) => void | Promise<void>
  readonly accessModeUpdatePending?: boolean
  readonly pendingApproval?: ProviderPendingApproval | null
  readonly onRespondToApproval: (
    decision: ProviderApprovalDecision,
    options?: { rememberDecision?: boolean },
  ) => void | Promise<void>
  readonly approvalDecisionPending?: boolean
  readonly interruptPending?: boolean
  readonly interruptError?: string | null
}

type ComposerAttachment = TurnAttachmentInput & {
  readonly id: string
}

function toComposerAttachment(attachment: TurnAttachmentInput): ComposerAttachment {
  return {
    ...attachment,
    id: attachment.path,
  }
}

function mergeComposerAttachments(
  current: readonly ComposerAttachment[],
  incoming: readonly ComposerAttachment[],
): ComposerAttachment[] {
  const byPath = new Map(current.map((attachment) => [attachment.path, attachment]))
  for (const attachment of incoming) {
    byPath.set(attachment.path, attachment)
  }

  return Array.from(byPath.values())
}

function stripComposerAttachmentIds(
  attachments: readonly ComposerAttachment[],
): TurnAttachmentInput[] {
  return attachments.map(({ id: _id, ...attachment }) => attachment)
}

export function PromptInput({
  onSend,
  onInterrupt,
  status,
  connectionState,
  disabled = false,
  disabledReason = null,
  loading = false,
  loadingLabel = null,
  loadingDetail = null,
  availableModels,
  selectedModel,
  onModelChange,
  // Permission system removed: every thread runs with full access. The
  // approval/access-mode props are accepted to keep the public component API
  // stable for existing callers but are intentionally unused.
  accessMode: _accessMode,
  onAccessModeChange: _onAccessModeChange,
  accessModeUpdatePending: _accessModeUpdatePending = false,
  pendingApproval: _pendingApproval = null,
  onRespondToApproval: _onRespondToApproval,
  approvalDecisionPending: _approvalDecisionPending = false,
  interruptPending = false,
  interruptError = null,
  skills = [],
  assignments = [],
  canReadCanvas = true,
  workspaceRoot = null,
  onRequestCanvasAccess,
  onForkSkill,
  onManageSkillPermissions,
}: PromptInputProps) {
  const [isComposerEmpty, setIsComposerEmpty] = useState(true)
  const [attachments, setAttachments] = useState<readonly ComposerAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [showSkillPicker, setShowSkillPicker] = useState(false)
  const [skillFilter, setSkillFilter] = useState("")
  const [highlightedSkillIndex, setHighlightedSkillIndex] = useState(0)
  const [showMentionPicker, setShowMentionPicker] = useState(false)
  const [mentionFilter, setMentionFilter] = useState("")
  const [mentionFiles, setMentionFiles] = useState<readonly FilePickerEntry[]>([])
  const [mentionRecents, setMentionRecents] = useState<readonly FilePickerEntry[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const composerRef = useRef<RichComposerHandle>(null)
  const mentionPickerRef = useRef<MentionPickerHandle>(null)

  const isConnected = connectionState === "connected"
  const stopPending = status === "interrupting" || interruptPending
  const showStopButton = status === "streaming" || status === "queued" || stopPending
  const waitingForTurn = status === "streaming" || status === "queued" || stopPending
  const canSend = (!isComposerEmpty || attachments.length > 0) && !waitingForTurn && isConnected && !disabled
  const canPickAttachments = typeof window !== "undefined" && Boolean(window.electronAPI?.invoke)
  const attachmentControlsDisabled = !canPickAttachments || !isConnected || disabled || waitingForTurn
  const canDropFiles = !attachmentControlsDisabled && Boolean(typeof window !== "undefined" && window.electronAPI?.getPathForFile)

  const resolveAttachmentMetadata = useCallback(async (paths: readonly string[]) => {
    if (!window.electronAPI?.invoke) {
      setAttachmentError("Attachments are only available in the desktop app.")
      return []
    }

    return window.electronAPI.invoke(IpcChannel.FILE_GET_ATTACHMENT_METADATA, { paths })
  }, [])

  const handleAddAttachments = useCallback(async () => {
    if (!window.electronAPI?.invoke) {
      setAttachmentError("Attachments are only available in the desktop app.")
      return
    }

    const selectedPaths = await window.electronAPI.invoke(IpcChannel.FILE_SELECT_ATTACHMENTS)
    if (!selectedPaths || selectedPaths.length === 0) {
      return
    }

    const metadata = await resolveAttachmentMetadata(selectedPaths)
    if (metadata.length === 0) {
      setAttachmentError("Selected files could not be attached.")
      return
    }

    if (metadata.length !== selectedPaths.length) {
      setAttachmentError("Some selected files could not be attached.")
    } else {
      setAttachmentError(null)
    }

    setAttachments((current) => mergeComposerAttachments(current, metadata.map(toComposerAttachment)))
  }, [resolveAttachmentMetadata])

  const validateAttachments = useCallback(async () => {
    if (attachments.length === 0) {
      return [] as TurnAttachmentInput[]
    }

    const metadata = await resolveAttachmentMetadata(attachments.map((attachment) => attachment.path))
    if (metadata.length !== attachments.length) {
      setAttachmentError("Some attached files are no longer available. Remove them to send.")
      return null
    }

    const refreshedAttachments = metadata.map(toComposerAttachment)
    setAttachments(refreshedAttachments)
    setAttachmentError(null)
    return stripComposerAttachmentIds(refreshedAttachments)
  }, [attachments, resolveAttachmentMetadata])

  const visibleSkills = useMemo(
    () => filterSkills(skills, skillFilter),
    [skills, skillFilter],
  )

  useEffect(() => {
    setHighlightedSkillIndex((current) => {
      if (visibleSkills.length === 0) return 0
      if (current >= visibleSkills.length) return 0
      return current
    })
  }, [visibleSkills.length, skillFilter])

  const handleSkillDismiss = useCallback(() => {
    setShowSkillPicker(false)
    setSkillFilter("")
    setHighlightedSkillIndex(0)
    composerRef.current?.focus()
  }, [])

  const handleSkillSelect = useCallback((skill: SkillPickerEntry) => {
    composerRef.current?.insertSkill(skill)
    setShowSkillPicker(false)
    setSkillFilter("")
    setHighlightedSkillIndex(0)
  }, [])

  const handleSkillTrigger = useCallback((filter: string, show: boolean) => {
    setShowSkillPicker(show)
    setSkillFilter(show ? filter : "")
    if (show) {
      setHighlightedSkillIndex(0)
    }
  }, [])

  const runMentionFileSearch = useCallback(
    async (query: string) => {
      if (!window.electronAPI?.invoke || !workspaceRoot) return
      try {
        const results = await window.electronAPI.invoke(
          IpcChannel.FILE_SEARCH_WORKSPACE,
          { workspaceRoot, query },
        )
        const entries: FilePickerEntry[] = results.map((result) => ({
          path: result.path,
          label: result.name,
          mimeType: result.mimeType ?? null,
          sizeBytes: result.sizeBytes ?? null,
          kind: "file",
        }))
        setMentionFiles(entries)
        if (query.trim() === "") {
          setMentionRecents(entries.slice(0, 6))
        }
      } catch {
        /* swallow; empty results are acceptable */
      }
    },
    [workspaceRoot],
  )

  const handleMentionTrigger = useCallback(
    (filter: string, show: boolean) => {
      setShowMentionPicker(show)
      setMentionFilter(show ? filter : "")
      if (show) {
        void runMentionFileSearch(filter)
      }
    },
    [runMentionFileSearch],
  )

  const handleMentionDismiss = useCallback(() => {
    setShowMentionPicker(false)
    setMentionFilter("")
    composerRef.current?.focus()
  }, [])

  const handleSelectAssignment = useCallback(
    (entry: AssignmentPickerEntry) => {
      composerRef.current?.insertAssignment({
        id: entry.id,
        label: entry.label,
        url: entry.url,
      })
      setShowMentionPicker(false)
      setMentionFilter("")
    },
    [],
  )

  const handleSelectFile = useCallback(
    async (entry: FilePickerEntry) => {
      composerRef.current?.insertFile({
        label: entry.label,
        path: entry.path,
        mimeType: entry.mimeType ?? null,
        sizeBytes: entry.sizeBytes ?? null,
        kind: entry.kind === "directory" ? "file" : (entry.kind ?? "file"),
      })
      setShowMentionPicker(false)
      setMentionFilter("")

      const metadata = await resolveAttachmentMetadata([entry.path])
      if (metadata.length === 0) {
        setAttachmentError("Selected file could not be attached.")
        return
      }
      setAttachments((current) =>
        mergeComposerAttachments(current, metadata.map(toComposerAttachment)),
      )
      setAttachmentError(null)
    },
    [resolveAttachmentMetadata],
  )

  const handleBrowseFiles = useCallback(async () => {
    setShowMentionPicker(false)
    setMentionFilter("")
    await handleAddAttachments()
  }, [handleAddAttachments])

  const handleActualSubmit = useCallback(async () => {
    const text = composerRef.current?.getText() ?? ""
    const skillId = composerRef.current?.getSkillId() ?? null
    const references = composerRef.current?.getReferences() ?? []
    if (
      (!text && attachments.length === 0 && !skillId && references.length === 0)
      || waitingForTurn
      || !isConnected
      || disabled
    ) {
      return
    }

    const validatedAttachments = await validateAttachments()
    if (validatedAttachments === null) {
      return
    }

    try {
      await onSend({
        content: text,
        attachments: validatedAttachments,
        references,
        ...(skillId ? { skillId } : {}),
      })

      composerRef.current?.clear()
      setAttachments([])
      setAttachmentError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message."
      console.error("Failed to send chat message", error)
      toast.error(message)
    }
  }, [attachments.length, disabled, isConnected, onSend, validateAttachments, waitingForTurn])

  const handleSubmit = useCallback(async (_message: PromptInputMessage) => {
    await handleActualSubmit()
  }, [handleActualSubmit])

  const handleComposerSubmit = useCallback(() => {
    if (!canSend) {
      return
    }

    void handleActualSubmit()
  }, [canSend, handleActualSubmit])

  const handleComposerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (showMentionPicker) {
        if (event.key === "Escape") {
          event.preventDefault()
          handleMentionDismiss()
          return
        }
        if (event.key === "ArrowDown") {
          event.preventDefault()
          mentionPickerRef.current?.moveHighlight(1)
          return
        }
        if (event.key === "ArrowUp") {
          event.preventDefault()
          mentionPickerRef.current?.moveHighlight(-1)
          return
        }
        if (event.key === "Enter" || event.key === "Tab") {
          if (mentionPickerRef.current?.hasHighlight()) {
            event.preventDefault()
            mentionPickerRef.current.selectHighlighted()
            return
          }
        }
      }

      if (!showSkillPicker) return

      if (visibleSkills.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault()
          setHighlightedSkillIndex((current) => (current + 1) % visibleSkills.length)
          return
        }
        if (event.key === "ArrowUp") {
          event.preventDefault()
          setHighlightedSkillIndex(
            (current) => (current - 1 + visibleSkills.length) % visibleSkills.length,
          )
          return
        }
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()
        const selected = visibleSkills[highlightedSkillIndex]
        if (selected) {
          composerRef.current?.insertSkill(selected)
          setShowSkillPicker(false)
          setSkillFilter("")
          setHighlightedSkillIndex(0)
        } else {
          handleSkillDismiss()
        }
        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        handleSkillDismiss()
      }
    },
    [showSkillPicker, showMentionPicker, visibleSkills, highlightedSkillIndex, handleSkillDismiss, handleMentionDismiss],
  )

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
    setAttachmentError(null)
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files") || !canDropFiles) return
    dragCounterRef.current++
    setIsDragOver(true)
  }, [canDropFiles])

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files") && canDropFiles) {
      e.preventDefault()
    }
  }, [canDropFiles])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    dragCounterRef.current = 0
    setIsDragOver(false)

    if (!e.dataTransfer.types.includes("Files")) return
    e.preventDefault()
    e.stopPropagation()

    const getPathForFile = window.electronAPI?.getPathForFile
    if (!getPathForFile || !isConnected || disabled || waitingForTurn) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const paths = files.map(file => getPathForFile(file)).filter(Boolean)
    if (paths.length === 0) return

    const metadata = await resolveAttachmentMetadata(paths)
    if (metadata.length === 0) {
      setAttachmentError("Dropped files could not be attached.")
      return
    }

    if (metadata.length !== paths.length) {
      setAttachmentError("Some dropped files could not be attached.")
    } else {
      setAttachmentError(null)
    }

    setAttachments(current => mergeComposerAttachments(current, metadata.map(toComposerAttachment)))
  }, [disabled, isConnected, resolveAttachmentMetadata, waitingForTurn])

  return (
    <div className="relative border-t bg-background px-3 py-2.5">
      {(
        <div
          className="relative"
          data-testid="composer-area"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={(e) => { void handleDrop(e) }}
        >
          {loading ? (
            <div
              data-testid="composer-loading-overlay"
              className="absolute inset-0 z-40 flex items-center justify-center rounded-[2rem] bg-background/75 backdrop-blur-sm"
            >
              <div className="w-full rounded-[1.5rem] border border-border/70 bg-card/95 px-4 py-3 shadow-sm">
                <div
                  role="progressbar"
                  aria-label="Runtime readiness progress"
                  aria-valuetext={loadingLabel ?? "Preparing"}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
                </div>
                <p className="mt-3 text-sm font-medium text-foreground">
                  {loadingLabel ?? "Preparing"}
                </p>
                {loadingDetail ? (
                  <p className="mt-1 text-xs text-muted-foreground">{loadingDetail}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {isDragOver && (
            <div
              data-testid="drag-drop-overlay"
              className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-[2rem] border-2 border-dashed border-primary/60 bg-primary/8"
              aria-hidden="true"
            >
              <span className="text-sm font-medium text-primary">Drop files here</span>
            </div>
          )}
          <DropdownMenu
            open={showSkillPicker}
            onOpenChange={(open) => {
              if (!open) {
                handleSkillDismiss()
              }
            }}
            modal={false}
          >
            <DropdownMenuTrigger asChild>
              <span
                aria-hidden="true"
                tabIndex={-1}
                className="pointer-events-none absolute left-3 right-3 top-0 block h-0"
                data-testid="skill-picker-anchor"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              sideOffset={8}
              onCloseAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => {
                const target = e.target as Element | null
                if (!target) return
                if (target.closest('[data-testid="composer-area"]')) {
                  e.preventDefault()
                  return
                }
                if (target.closest('[data-slot="dropdown-menu-content"]')) {
                  e.preventDefault()
                }
              }}
              className="w-(--radix-dropdown-menu-trigger-width) min-w-[280px] p-1"
              data-testid="skill-picker-content"
            >
              <SkillPicker
                skills={skills}
                filter={skillFilter}
                highlightedIndex={highlightedSkillIndex}
                onHighlightChange={setHighlightedSkillIndex}
                fullAccess={true}
                onSelect={handleSkillSelect}
                onFork={onForkSkill ? (skill) => {
                  setShowSkillPicker(false)
                  onForkSkill(skill)
                } : undefined}
                onManagePermissions={onManageSkillPermissions ? (skill) => {
                  setShowSkillPicker(false)
                  onManageSkillPermissions(skill)
                } : undefined}
              />
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu
            open={showMentionPicker}
            onOpenChange={(open) => {
              if (!open) {
                handleMentionDismiss()
              }
            }}
            modal={false}
          >
            <DropdownMenuTrigger asChild>
              <span
                aria-hidden="true"
                tabIndex={-1}
                className="pointer-events-none absolute left-3 right-3 top-0 block h-0"
                data-testid="mention-picker-anchor"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              sideOffset={8}
              onCloseAutoFocus={(e) => e.preventDefault()}
              onInteractOutside={(e) => {
                const target = e.target as Element | null
                if (!target) return
                if (target.closest('[data-testid="composer-area"]')) {
                  e.preventDefault()
                  return
                }
                if (target.closest('[data-slot="dropdown-menu-content"]')) {
                  e.preventDefault()
                }
              }}
              className="w-auto max-w-[calc(100vw-2rem)] p-1"
              data-testid="mention-picker-content"
            >
              <MentionPicker
                ref={mentionPickerRef}
                filter={mentionFilter}
                assignments={assignments}
                files={mentionFiles}
                recents={mentionRecents}
                canReadCanvas={canReadCanvas}
                onSelectAssignment={handleSelectAssignment}
                onSelectFile={(entry) => void handleSelectFile(entry)}
                onBrowseFiles={() => void handleBrowseFiles()}
                onRequestCanvasAccess={onRequestCanvasAccess}
                workspaceRoot={workspaceRoot}
              />
            </DropdownMenuContent>
          </DropdownMenu>

          <RegistryPromptInput
            onSubmit={handleSubmit}
            inputGroupClassName={cn(
              "h-auto rounded-[2rem] border-border/60 bg-card/85 shadow-sm backdrop-blur-sm dark:bg-card/80",
              disabled && "opacity-70",
            )}
          >
            {attachments.length > 0 ? (
              <ChatAttachments
                attachments={attachments}
                onRemove={handleRemoveAttachment}
                className="w-full px-4 pt-3"
              />
            ) : null}

            <RichComposer
              ref={composerRef}
              disabled={!isConnected || disabled}
              placeholder={
                connectionState === "connecting"
                  ? "Connecting to Orbyt..."
                  : !isConnected
                    ? "Reconnecting..."
                  : disabled && disabledReason
                    ? disabledReason
                  : waitingForTurn
                    ? "Wait for response..."
                    : "What would you like to know?"
              }
              className={cn("px-4 pb-2.5", attachments.length > 0 ? "pt-2.5" : "pt-3.5")}
              onContentChange={setIsComposerEmpty}
              onSkillTrigger={handleSkillTrigger}
              onMentionTrigger={handleMentionTrigger}
              onSubmit={handleComposerSubmit}
              onKeyDown={handleComposerKeyDown}
            />

            <PromptInputFooter className="flex-col items-stretch gap-2.5 pt-0">
              <div className="flex items-center justify-between gap-3">
                <PromptInputTools className="gap-1.5">
                  <PromptInputButton
                    aria-label="Add attachments"
                    disabled={attachmentControlsDisabled}
                    onClick={() => void handleAddAttachments()}
                    className="rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <PlusIcon className="size-4" />
                  </PromptInputButton>

                  <ModelSelector
                    models={availableModels}
                    selectedModel={selectedModel}
                    onModelChange={onModelChange}
                    disabled={!isConnected || waitingForTurn}
                  />

                </PromptInputTools>

                {showStopButton ? (
                  <PromptInputButton
                    aria-label={stopPending ? "Stopping…" : "Stop generating"}
                    disabled={stopPending}
                    data-pending={stopPending ? "true" : undefined}
                    onClick={stopPending ? undefined : onInterrupt}
                    className="size-10 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    <SquareIcon className="size-4 fill-current" />
                  </PromptInputButton>
                ) : (
                  <PromptInputSubmit
                    aria-label="Send message"
                    disabled={!canSend}
                    className="size-10 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90"
                  />
                )}
              </div>
            </PromptInputFooter>
          </RegistryPromptInput>
        </div>
      )}

      {attachmentError ? (
        <p className="mt-2 px-1 text-xs text-destructive">{attachmentError}</p>
      ) : null}

      {stopPending ? (
        <p
          data-testid="interrupt-pending-hint"
          className="mt-2 px-1 text-xs text-muted-foreground"
        >
          Stopping current response...
        </p>
      ) : null}

      {interruptError ? (
        <p
          data-testid="interrupt-error"
          role="alert"
          className="mt-2 px-1 text-xs text-destructive"
        >
          {interruptError}
        </p>
      ) : null}
    </div>
  )
}
