import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  IpcChannel,
  type ChatModel,
  type ProviderApprovalDecision,
  type ProviderPendingApproval,
  type ThreadAccessMode,
  type TurnAttachmentInput,
  type TurnReferenceInput,
} from "@orbyt/contracts"
import { MoreHorizontalIcon, PlusIcon, SquareIcon } from "lucide-react"
import { toast } from "sonner"
import { RichComposer, type RichComposerHandle } from "@/components/chat/RichComposer"
import { filterSkills, type SkillPickerEntry } from "@/components/chat/SkillPicker"
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ChatStatus } from "@/hooks/chat-model"
import type { WsConnectionPhase } from "@/rpc/wsConnectionState"
import { cn } from "@/lib/utils"
import {
  clearChatComposerDraft,
  readChatComposerDraft,
  writeChatComposerDraft,
} from "@/lib/chatComposerDrafts"
import { shouldUseCompactComposerFooter } from "@/lib/composerFooterLayout"
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
  readonly draftKey?: string | null
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

type SlashCommandItem =
  | {
      readonly kind: "command"
      readonly id: "model"
      readonly name: string
      readonly description: string
    }
  | {
      readonly kind: "skill"
      readonly skill: SkillPickerEntry
    }

const BUILT_IN_SLASH_COMMANDS: readonly Extract<SlashCommandItem, { kind: "command" }>[] = [
  {
    kind: "command",
    id: "model",
    name: "model",
    description: "Open the model selector",
  },
]

function filterSlashItems(
  skills: readonly SkillPickerEntry[],
  filter: string,
): readonly SlashCommandItem[] {
  const q = filter.trim().toLowerCase()
  const commands = q === ""
    ? BUILT_IN_SLASH_COMMANDS
    : BUILT_IN_SLASH_COMMANDS.filter((command) => command.name.includes(q) || command.description.toLowerCase().includes(q))
  return [
    ...commands,
    ...filterSkills(skills, filter).map((skill) => ({ kind: "skill" as const, skill })),
  ]
}

function findBuiltInSlashCommand(input: string): Extract<SlashCommandItem, { kind: "command" }> | null {
  const commandName = input.trim().match(/^\/([a-z-]+)$/)?.[1]
  if (!commandName) return null
  return BUILT_IN_SLASH_COMMANDS.find((command) => command.name === commandName) ?? null
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
      } else {
        reject(new Error("Unable to read pasted file."))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read pasted file."))
    reader.readAsDataURL(file)
  })
}

function SlashCommandPicker({
  items,
  highlightedIndex,
  fullAccess,
  onHighlightChange,
  onSelect,
  onForkSkill,
  onManageSkillPermissions,
}: {
  readonly items: readonly SlashCommandItem[]
  readonly highlightedIndex: number
  readonly fullAccess: boolean
  readonly onHighlightChange: (index: number) => void
  readonly onSelect: (item: SlashCommandItem) => void
  readonly onForkSkill?: (skill: SkillPickerEntry) => void
  readonly onManageSkillPermissions?: (skill: SkillPickerEntry) => void
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl p-1">
      {items.length === 0 ? (
        <div className="px-3 py-4 text-xs text-muted-foreground">No commands found</div>
      ) : null}
      {items.map((item, index) => {
        const isHighlighted = index === highlightedIndex
        if (item.kind === "command") {
          return (
            <button
              key={`command:${item.id}`}
              type="button"
              className={cn(
                "flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm",
                isHighlighted && "bg-accent text-accent-foreground",
              )}
              onMouseEnter={() => onHighlightChange(index)}
              onClick={() => onSelect(item)}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium text-foreground">/{item.name}</span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{item.description}</span>
              </span>
            </button>
          )
        }

        const rawMissing = item.skill.missingCapabilities ?? []
        const missing = fullAccess ? [] : rawMissing
        return (
          <div
            key={`skill:${item.skill.id}`}
            className={cn(
              "flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm",
              isHighlighted && "bg-accent text-accent-foreground",
            )}
            onMouseEnter={() => onHighlightChange(index)}
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => onSelect(item)}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-foreground">/{item.skill.name}</span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{item.skill.description}</span>
              </span>
            </button>
            {missing.length > 0 && onManageSkillPermissions ? (
              <button
                type="button"
                className="mt-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-500/10"
                onClick={() => onManageSkillPermissions(item.skill)}
              >
                Needs {missing.length}
              </button>
            ) : null}
            {onForkSkill ? (
              <button
                type="button"
                className="mt-0.5 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => onForkSkill(item.skill)}
              >
                Fork
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
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
  draftKey = null,
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
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [compactControlsOpen, setCompactControlsOpen] = useState(false)
  const [footerCompact, setFooterCompact] = useState(false)
  const dragCounterRef = useRef(0)
  const composerRef = useRef<RichComposerHandle>(null)
  const mentionPickerRef = useRef<MentionPickerHandle>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratingDraftRef = useRef(false)

  const isConnected = connectionState === "connected"
  const stopPending = status === "interrupting" || interruptPending
  const showStopButton = status === "streaming" || status === "queued" || stopPending
  const waitingForTurn = status === "streaming" || status === "queued" || stopPending
  const canSend = (!isComposerEmpty || attachments.length > 0) && !waitingForTurn && isConnected && !disabled
  const canPickAttachments = typeof window !== "undefined" && Boolean(window.electronAPI?.invoke)
  const attachmentControlsDisabled = !canPickAttachments || !isConnected || disabled || waitingForTurn
  const canDropFiles = !attachmentControlsDisabled && Boolean(typeof window !== "undefined" && window.electronAPI?.getPathForFile)

  useLayoutEffect(() => {
    const footer = footerRef.current
    if (!footer) return
    const updateCompactState = () => {
      setFooterCompact(shouldUseCompactComposerFooter(footer.clientWidth))
    }
    updateCompactState()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(updateCompactState)
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (showSkillPicker || showMentionPicker) {
      composerRef.current?.focus()
    }
  }, [showMentionPicker, showSkillPicker])

  useEffect(() => {
    hydratingDraftRef.current = true
    const draft = readChatComposerDraft(draftKey)
    composerRef.current?.setSnapshot(draft?.snapshot ?? { segments: [] })
    setAttachments(draft?.attachments.map(toComposerAttachment) ?? [])
    setAttachmentError(null)
    window.setTimeout(() => {
      hydratingDraftRef.current = false
    }, 0)
  }, [draftKey])

  const scheduleDraftSave = useCallback(() => {
    if (!draftKey || hydratingDraftRef.current) return
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current)
    }
    draftSaveTimerRef.current = setTimeout(() => {
      const snapshot = composerRef.current?.getSnapshot() ?? { segments: [] }
      if ((composerRef.current?.isEmpty() ?? true) && attachments.length === 0) {
        clearChatComposerDraft(draftKey)
        return
      }
      writeChatComposerDraft(draftKey, {
        version: 1,
        snapshot,
        attachments: stripComposerAttachmentIds(attachments),
      })
    }, 250)
  }, [attachments, draftKey])

  useEffect(() => {
    scheduleDraftSave()
  }, [attachments, scheduleDraftSave])

  useEffect(() => {
    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current)
      }
    }
  }, [])

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

  const visibleSlashItems = useMemo(
    () => filterSlashItems(skills, skillFilter),
    [skills, skillFilter],
  )

  useEffect(() => {
    setHighlightedSkillIndex((current) => {
      if (visibleSlashItems.length === 0) return 0
      if (current >= visibleSlashItems.length) return 0
      return current
    })
  }, [visibleSlashItems.length, skillFilter])

  const handleSkillDismiss = useCallback(() => {
    setShowSkillPicker(false)
    setSkillFilter("")
    setHighlightedSkillIndex(0)
    composerRef.current?.focus()
  }, [])

  const handleSlashCommandSelect = useCallback((item: SlashCommandItem) => {
    if (item.kind === "skill") {
      composerRef.current?.insertSkill(item.skill)
      setShowSkillPicker(false)
      setSkillFilter("")
      setHighlightedSkillIndex(0)
      return
    }

    composerRef.current?.replaceTriggerWithText("")
    setShowSkillPicker(false)
    setSkillFilter("")
    setHighlightedSkillIndex(0)
    if (item.id === "model") {
      if (footerCompact) {
        setCompactControlsOpen(true)
        window.requestAnimationFrame(() => setModelSelectorOpen(true))
      } else {
        setModelSelectorOpen(true)
      }
    }
  }, [footerCompact])

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
        referenceKind: entry.referenceKind,
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

  const handleContentChange = useCallback((empty: boolean) => {
    setIsComposerEmpty(empty)
    scheduleDraftSave()
  }, [scheduleDraftSave])

  const handleActualSubmit = useCallback(async () => {
    const text = composerRef.current?.getText() ?? ""
    const builtInCommand = findBuiltInSlashCommand(text)
    if (builtInCommand) {
      composerRef.current?.setSnapshot({ segments: [] })
      handleSlashCommandSelect(builtInCommand)
      return
    }

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
      clearChatComposerDraft(draftKey)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message."
      console.error("Failed to send chat message", error)
      toast.error(message)
    }
  }, [attachments.length, disabled, draftKey, handleSlashCommandSelect, isConnected, onSend, validateAttachments, waitingForTurn])

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

      if (visibleSlashItems.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault()
          setHighlightedSkillIndex((current) => (current + 1) % visibleSlashItems.length)
          return
        }
        if (event.key === "ArrowUp") {
          event.preventDefault()
          setHighlightedSkillIndex(
            (current) => (current - 1 + visibleSlashItems.length) % visibleSlashItems.length,
          )
          return
        }
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()
        const selected = visibleSlashItems[highlightedSkillIndex]
        if (selected) {
          handleSlashCommandSelect(selected)
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
    [showSkillPicker, showMentionPicker, visibleSlashItems, highlightedSkillIndex, handleSlashCommandSelect, handleSkillDismiss, handleMentionDismiss],
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

  const handleComposerPaste = useCallback(async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) return
    event.preventDefault()

    if (!isConnected || disabled || waitingForTurn) {
      return
    }

    const paths: string[] = []
    const staged: TurnAttachmentInput[] = []
    const getPathForFile = window.electronAPI?.getPathForFile

    for (const file of files) {
      const filePath = getPathForFile?.(file) ?? ""
      if (filePath) {
        paths.push(filePath)
        continue
      }

      if (!file.type.startsWith("image/")) {
        setAttachmentError("Pasted files without a local path must be images.")
        continue
      }

      if (!window.electronAPI?.invoke) {
        setAttachmentError("Pasted image attachments are only available in the desktop app.")
        continue
      }

      try {
        const dataUrl = await readFileAsDataUrl(file)
        const attachment = await window.electronAPI.invoke(IpcChannel.FILE_STAGE_PASTED_ATTACHMENT, {
          name: file.name || "pasted-image.png",
          mimeType: file.type || "image/png",
          dataUrl,
        })
        if (attachment) {
          staged.push(attachment)
        }
      } catch (error) {
        setAttachmentError(error instanceof Error ? error.message : "Pasted image could not be attached.")
      }
    }

    const metadata = paths.length > 0 ? await resolveAttachmentMetadata(paths) : []
    const incoming = [...metadata, ...staged]
    if (incoming.length === 0) return
    setAttachments((current) => mergeComposerAttachments(current, incoming.map(toComposerAttachment)))
    setAttachmentError(metadata.length === paths.length ? null : "Some pasted files could not be attached.")
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
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault()
                  handleSkillDismiss()
                  return
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  setHighlightedSkillIndex((current) => (
                    visibleSlashItems.length === 0 ? 0 : (current + 1) % visibleSlashItems.length
                  ))
                  return
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault()
                  setHighlightedSkillIndex((current) => (
                    visibleSlashItems.length === 0
                      ? 0
                      : (current - 1 + visibleSlashItems.length) % visibleSlashItems.length
                  ))
                  return
                }
                if (event.key === "Enter" || event.key === "Tab") {
                  event.preventDefault()
                  const selected = visibleSlashItems[highlightedSkillIndex]
                  if (selected) {
                    handleSlashCommandSelect(selected)
                  }
                }
              }}
              onOpenAutoFocus={(e) => e.preventDefault()}
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
              <SlashCommandPicker
                items={visibleSlashItems}
                highlightedIndex={highlightedSkillIndex}
                onHighlightChange={setHighlightedSkillIndex}
                fullAccess={true}
                onSelect={handleSlashCommandSelect}
                onForkSkill={onForkSkill ? (skill) => {
                  setShowSkillPicker(false)
                  onForkSkill(skill)
                } : undefined}
                onManageSkillPermissions={onManageSkillPermissions ? (skill) => {
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
              onKeyDown={(event) => {
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
                  event.preventDefault()
                  mentionPickerRef.current?.selectHighlighted()
                }
              }}
              onOpenAutoFocus={(e) => e.preventDefault()}
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
              onContentChange={handleContentChange}
              onSkillTrigger={handleSkillTrigger}
              onMentionTrigger={handleMentionTrigger}
              onSubmit={handleComposerSubmit}
              onKeyDown={handleComposerKeyDown}
              onPaste={(event) => { void handleComposerPaste(event) }}
            />

            <PromptInputFooter className="flex-col items-stretch gap-2.5 pt-0">
              <div ref={footerRef} className="flex items-center justify-between gap-3">
                <PromptInputTools className="gap-1.5">
                  <PromptInputButton
                    aria-label="Add attachments"
                    disabled={attachmentControlsDisabled}
                    onClick={() => void handleAddAttachments()}
                    className="rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <PlusIcon className="size-4" />
                  </PromptInputButton>

                  {!footerCompact ? (
                    <ModelSelector
                      models={availableModels}
                      selectedModel={selectedModel}
                      onModelChange={onModelChange}
                      disabled={!isConnected || waitingForTurn}
                      open={modelSelectorOpen}
                      onOpenChange={setModelSelectorOpen}
                    />
                  ) : null}

                  {footerCompact ? (
                    <DropdownMenu open={compactControlsOpen} onOpenChange={setCompactControlsOpen}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="More composer controls"
                          className="rounded-full text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-72 rounded-3xl p-2">
                        <div className="px-1 py-1">
                          <ModelSelector
                            models={availableModels}
                            selectedModel={selectedModel}
                            onModelChange={onModelChange}
                            disabled={!isConnected || waitingForTurn}
                            open={modelSelectorOpen}
                            onOpenChange={setModelSelectorOpen}
                          />
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
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
