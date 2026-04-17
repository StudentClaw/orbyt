import { useCallback, useEffect, useRef, useState } from "react"
import {
  IpcChannel,
  classifyShellCommandForApproval,
  type ChatModel,
  type ProviderApprovalDecision,
  type ProviderPendingApproval,
  type ThreadAccessMode,
  type TurnAttachmentInput,
} from "@student-claw/contracts"
import { PlusIcon, SquareIcon, XIcon } from "lucide-react"
import { SkillPicker, type SkillPickerEntry } from "@/components/chat/SkillPicker"
import { ChatAttachments } from "@/components/chat/ChatAttachments"
import {
  PromptInput as RegistryPromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
} from "@/components/ai/prompt-input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroupTextarea } from "@/components/ui/input-group"
import type { ChatStatus } from "@/hooks/chat-model"
import type { WsConnectionPhase } from "@/rpc/wsConnectionState"
import { cn } from "@/lib/utils"
import { ModelSelector } from "./ModelSelector"

interface PromptInputProps {
  readonly onSend: (input: {
    content: string
    attachments: readonly TurnAttachmentInput[]
    skillId?: string | null
  }) => void | Promise<void>
  readonly skills?: readonly SkillPickerEntry[]
  readonly onInterrupt: () => void
  readonly status: ChatStatus
  readonly connectionState: WsConnectionPhase
  readonly disabled?: boolean
  readonly disabledReason?: string | null
  readonly availableModels: readonly ChatModel[]
  readonly selectedModel: string
  readonly onModelChange: (model: string) => void
  readonly accessMode: ThreadAccessMode | null
  readonly onAccessModeChange: (accessMode: ThreadAccessMode) => void | Promise<void>
  readonly accessModeUpdatePending?: boolean
  readonly pendingApproval?: ProviderPendingApproval | null
  readonly onRespondToApproval: (decision: ProviderApprovalDecision) => void | Promise<void>
  readonly approvalDecisionPending?: boolean
}

type ComposerAttachment = TurnAttachmentInput & {
  readonly id: string
}

type ApprovalTechnicalDetail = {
  readonly label: string
  readonly value: string
  readonly code: boolean
}

function DefaultPermissionsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="3" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5 6.25h2.5m-2.5 3.5h6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="m8.75 6.25 1.75 1.5-1.75 1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FullAccessIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.75 12.5 3.5v3.4c0 2.87-1.74 4.97-4.5 6.85C5.24 11.87 3.5 9.77 3.5 6.9V3.5L8 1.75Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M8 5.1v3.1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="8" cy="10.8" r=".7" fill="currentColor" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m3.5 8.5 2.5 2.5 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.47 6.97a.75.75 0 0 1 1.06 0L8 9.44l2.47-2.47a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 0-1.06Z" />
    </svg>
  )
}

function ShieldCueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.75 12.5 3.5v3.4c0 2.87-1.74 4.97-4.5 6.85C5.24 11.87 3.5 9.77 3.5 6.9V3.5L8 1.75Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M8 4.75v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="8" cy="10.2" r=".7" fill="currentColor" />
    </svg>
  )
}

function accessModeLabel(accessMode: ThreadAccessMode | null): string {
  return accessMode === "full" ? "Full access" : "Default permissions"
}

function approvalTitle(): string {
  return "Permission needed"
}

function approvalPromptCopy(approval: ProviderPendingApproval): {
  readonly question: string
  readonly detail: string
} {
  if (approval.kind === "command") {
    const classification = classifyShellCommandForApproval(approval.command)
    return {
      question: classification.question,
      detail: classification.detail,
    }
  }

  if (approval.kind === "file-change") {
    return {
      question: "Can I change project files for this step?",
      detail: "This would directly update files in the project.",
    }
  }

  return {
    question: "Can I grant this permission for this step?",
    detail: "This would give the agent extra access for the current task.",
  }
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
  availableModels,
  selectedModel,
  onModelChange,
  accessMode,
  onAccessModeChange,
  accessModeUpdatePending = false,
  pendingApproval = null,
  onRespondToApproval,
  approvalDecisionPending = false,
  skills = [],
}: PromptInputProps) {
  const [value, setValue] = useState("")
  const [attachments, setAttachments] = useState<readonly ComposerAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [fullAccessDialogOpen, setFullAccessDialogOpen] = useState(false)
  const [approvalTechnicalDetailsOpen, setApprovalTechnicalDetailsOpen] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<SkillPickerEntry | null>(null)
  const [showSkillPicker, setShowSkillPicker] = useState(false)
  const [skillFilter, setSkillFilter] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isConnected = connectionState === "connected"
  const isStreaming = status === "streaming"
  const canSend = (value.trim().length > 0 || attachments.length > 0 || selectedSkill !== null) && !isStreaming && isConnected && !disabled
  const canPickAttachments = typeof window !== "undefined" && Boolean(window.electronAPI?.invoke)
  const attachmentControlsDisabled = !canPickAttachments || !isConnected || disabled || isStreaming
  const accessControlDisabled =
    !isConnected
    || !accessMode
    || isStreaming
    || accessModeUpdatePending
    || pendingApproval !== null
    || approvalDecisionPending
  const approvalCopy = pendingApproval ? approvalPromptCopy(pendingApproval) : null
  const technicalDetails = pendingApproval
    ? [
        pendingApproval.command
          ? {
              label: "Command",
              value: pendingApproval.command,
              code: true,
            }
          : null,
        pendingApproval.cwd
          ? {
              label: "Working folder",
              value: pendingApproval.cwd,
              code: false,
            }
          : null,
        pendingApproval.reason
          ? {
              label: "Reason from Codex",
              value: pendingApproval.reason,
              code: false,
            }
          : null,
      ].filter((entry): entry is ApprovalTechnicalDetail => entry !== null)
    : []

  useEffect(() => {
    setApprovalTechnicalDetailsOpen(false)
  }, [pendingApproval?.id])

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

  const handleSkillSelect = useCallback((skill: SkillPickerEntry) => {
    setSelectedSkill(skill)
    setShowSkillPicker(false)
    setSkillFilter("")
    setValue("")
    textareaRef.current?.focus()
  }, [])

  const handleSkillDismiss = useCallback(() => {
    setShowSkillPicker(false)
    setSkillFilter("")
  }, [])

  const handleTextareaChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value
    setValue(text)
    if (text.startsWith("/")) {
      setSkillFilter(text.slice(1))
      setShowSkillPicker(true)
    } else {
      setShowSkillPicker(false)
      setSkillFilter("")
    }
  }, [])

  const handleSubmit = useCallback(async (message: { text: string }) => {
    const text = message.text.trim()
    if ((!text && attachments.length === 0 && !selectedSkill) || isStreaming || !isConnected || disabled) {
      return
    }

    const validatedAttachments = await validateAttachments()
    if (validatedAttachments === null) {
      return
    }

    await onSend({
      content: text,
      attachments: validatedAttachments,
      skillId: selectedSkill?.id ?? null,
    })

    setValue("")
    setAttachments([])
    setAttachmentError(null)
    setSelectedSkill(null)
    textareaRef.current?.focus()
  }, [attachments.length, disabled, isConnected, isStreaming, onSend, selectedSkill, validateAttachments])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        if (!canSend) {
          return
        }
        event.currentTarget.form?.requestSubmit()
      }
    },
    [canSend],
  )

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
    setAttachmentError(null)
  }, [])

  const handleDefaultAccessSelect = useCallback(() => {
    if (accessMode !== "default") {
      void onAccessModeChange("default")
    }
  }, [accessMode, onAccessModeChange])

  const handleConfirmFullAccess = useCallback(async () => {
    await onAccessModeChange("full")
    setFullAccessDialogOpen(false)
  }, [onAccessModeChange])

  return (
    <div className="relative border-t bg-background px-3 py-2.5">
      {pendingApproval && (
        <Alert className="mb-3 rounded-3xl border-amber-500/25 bg-amber-500/6 px-4 py-3">
          <ShieldCueIcon className="mt-0.5 size-4 text-amber-500" />
          <AlertTitle className="text-sm text-foreground">
            {approvalTitle()}
          </AlertTitle>
          <AlertDescription className="space-y-3 pt-1 text-left">
            <div className="space-y-1">
              <p className="text-sm text-foreground">
                {approvalCopy?.question}
              </p>
              <p className="text-xs text-muted-foreground">
                {approvalCopy?.detail}
              </p>
            </div>
            {technicalDetails.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                  onClick={() => setApprovalTechnicalDetailsOpen((current) => !current)}
                >
                  {approvalTechnicalDetailsOpen ? "Hide technical details" : "Show technical details"}
                </button>
                {approvalTechnicalDetailsOpen && (
                  <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2">
                    <div className="space-y-2 text-xs text-muted-foreground">
                      {technicalDetails.map((entry) => (
                        entry.code ? (
                          <div key={`${entry.label}:${entry.value}`} className="space-y-1">
                            <p className="font-medium text-foreground/90">{entry.label}</p>
                            <pre className="overflow-x-auto rounded-2xl border border-border/60 bg-background/90 px-3 py-2 text-xs text-foreground">
                              <code>{entry.value}</code>
                            </pre>
                          </div>
                        ) : (
                          <p key={`${entry.label}:${entry.value}`}>
                            <span className="font-medium text-foreground/90">{entry.label}:</span>{" "}
                            {entry.value}
                          </p>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={approvalDecisionPending}
                onClick={() => void onRespondToApproval("deny")}
              >
                Don&apos;t allow
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={approvalDecisionPending}
                onClick={() => void onRespondToApproval("approve")}
              >
                {approvalDecisionPending ? "Allowing..." : "Allow"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="relative">
        {showSkillPicker && skills.length > 0 && (
          <SkillPicker
            skills={skills}
            filter={skillFilter}
            onSelect={handleSkillSelect}
            onDismiss={handleSkillDismiss}
          />
        )}
      <RegistryPromptInput
        onSubmit={handleSubmit}
        inputGroupClassName={cn(
          "rounded-[2rem] border-border/60 bg-card/85 shadow-sm backdrop-blur-sm dark:bg-card/80",
          disabled && "opacity-70",
        )}
      >
        {attachments.length > 0 && (
          <ChatAttachments
            attachments={attachments}
            onRemove={handleRemoveAttachment}
            className="max-w-full px-4 pt-3"
          />
        )}

        {selectedSkill && (
          <div className="flex items-center gap-1 px-4 pt-2.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              /{selectedSkill.name}
              <button
                type="button"
                aria-label={`Remove ${selectedSkill.name} skill`}
                onClick={() => setSelectedSkill(null)}
                className="ml-0.5 rounded-full opacity-70 hover:opacity-100"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          </div>
        )}

        <InputGroupTextarea
          ref={textareaRef}
          value={value}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          disabled={!isConnected || disabled}
          name="message"
          aria-label="Chat message input"
          placeholder={
            connectionState === "connecting"
              ? "Connecting to Student Claw..."
              : !isConnected
                ? "Reconnecting..."
              : disabled && disabledReason
                ? disabledReason
              : isStreaming
                ? "Wait for response..."
                : "What would you like to know?"
          }
          className={cn(
            "min-h-24 px-4 pb-2.5 text-sm",
            attachments.length > 0 ? "pt-2.5" : "pt-3.5",
          )}
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
                disabled={!isConnected || isStreaming}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={accessControlDisabled}
                    aria-label="Select permissions"
                    className={cn(
                      "h-8 rounded-full border border-border/70 bg-muted/45 px-2.5 text-xs hover:bg-muted/70",
                      accessMode === "full"
                        ? "text-amber-500 hover:text-amber-500"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {accessMode === "full" ? (
                      <FullAccessIcon className="size-3.5" />
                    ) : (
                      <DefaultPermissionsIcon className="size-3.5" />
                    )}
                    <span>{accessModeLabel(accessMode)}</span>
                    <ChevronDownIcon className="size-3.5 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 rounded-3xl p-1.5">
                  <DropdownMenuItem onSelect={handleDefaultAccessSelect} className="rounded-2xl py-2.5">
                    <DefaultPermissionsIcon className="size-4 text-muted-foreground" />
                    <span className="flex-1">Default permissions</span>
                    {accessMode === "default" && <CheckIcon className="size-4 text-foreground" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      if (accessMode !== "full") {
                        setFullAccessDialogOpen(true)
                      }
                    }}
                    className="rounded-2xl py-2.5"
                  >
                    <FullAccessIcon className="size-4 text-amber-500" />
                    <span className="flex-1">Full access</span>
                    {accessMode === "full" && <CheckIcon className="size-4 text-foreground" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PromptInputTools>

            {isStreaming ? (
              <PromptInputButton
                aria-label="Stop generating"
                onClick={onInterrupt}
                className="size-10 rounded-2xl bg-red-600 text-white hover:bg-red-700"
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

      {attachmentError && (
        <p className="mt-2 px-1 text-xs text-destructive">{attachmentError}</p>
      )}

      <AlertDialog open={fullAccessDialogOpen} onOpenChange={setFullAccessDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <div className="mb-2 inline-flex size-12 items-center justify-center rounded-full bg-amber-500/12 text-amber-500">
              <ShieldCueIcon className="size-6" />
            </div>
            <AlertDialogTitle>Enable full access for this thread?</AlertDialogTitle>
            <AlertDialogDescription>
              Commands in this thread will run with full filesystem access and without further
              per-command approval prompts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFullAccessDialogOpen(false)}
              disabled={accessModeUpdatePending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmFullAccess()}
              disabled={accessModeUpdatePending}
              className="bg-amber-500 text-[13px] text-black hover:bg-amber-400"
            >
              {accessModeUpdatePending ? "Switching..." : "Enable full access"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
