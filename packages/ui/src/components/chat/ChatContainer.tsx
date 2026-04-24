import { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useChat } from "@/hooks/useChat"
import { useChatModel } from "@/hooks/useChatModel"
import { useChatUiActions, useSkillsState, type SkillEntry } from "@/hooks/useAppRuntime"
import { ChatEmptyState } from "./ChatEmptyState"
import { ChatProviderDisconnected } from "./ChatProviderDisconnected"
import { ErrorBanner } from "./ErrorBanner"
import { MemoryUpdatedPill } from "./MemoryUpdatedPill"
import { MessageBubble, SendingPlaceholder } from "./MessageBubble"
import { PromptInput } from "./PromptInput"
import { SkillForkDialog } from "@/components/skills/SkillForkDialog"
import { SkillPromotionDialog } from "@/components/skills/SkillPromotionDialog"
import { waitForPrimaryWsRpcClient } from "@/rpc/appRuntime"
import type { ChatSelectionInput } from "@/hooks/useChat"
import type { SkillPickerEntry } from "./SkillPicker"
import type { SkillId } from "@orbyt/contracts"

type DialogState =
  | { readonly kind: "none" }
  | { readonly kind: "fork"; readonly skill: SkillPickerEntry }
  | { readonly kind: "promotion"; readonly skillId: string }

interface ChatContainerProps {
  readonly variant?: "panel" | "page"
  readonly selection?: ChatSelectionInput
}

export function ChatContainer({ variant = "panel", selection }: ChatContainerProps) {
  const { selectedModel, setSelectedModel, availableModels } = useChatModel()
  const { skills, refresh: refreshSkills } = useSkillsState()
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" })

  const openFork = useCallback((skill: SkillPickerEntry) => {
    setDialog({ kind: "fork", skill })
  }, [])

  const openPromotion = useCallback((skill: SkillPickerEntry) => {
    setDialog({ kind: "promotion", skillId: skill.id })
  }, [])

  const closeDialog = useCallback(() => setDialog({ kind: "none" }), [])

  const handleFork = useCallback(
    async (payload: { sourceSlug: string; targetSlug: string; displayName?: string }) => {
      const client = await waitForPrimaryWsRpcClient()
      await client.skills.fork({
        sourceSlug: payload.sourceSlug as SkillId,
        targetSlug: payload.targetSlug as SkillId,
        displayName: payload.displayName,
      })
      await refreshSkills()
    },
    [refreshSkills],
  )

  const handleGrant = useCallback(
    async (input: { skillId: string; capabilityKey: string }) => {
      const client = await waitForPrimaryWsRpcClient()
      await client.skills.grantCapability({
        skillId: input.skillId as SkillId,
        capabilityKey: input.capabilityKey,
      })
      await refreshSkills()
    },
    [refreshSkills],
  )

  const handleRevoke = useCallback(
    async (input: { skillId: string; capabilityKey: string }) => {
      const client = await waitForPrimaryWsRpcClient()
      await client.skills.revokeCapability({
        skillId: input.skillId as SkillId,
        capabilityKey: input.capabilityKey,
      })
      await refreshSkills()
    },
    [refreshSkills],
  )

  const activePromotionSkill =
    dialog.kind === "promotion"
      ? (skills.find((s) => s.id === dialog.skillId) as SkillEntry | undefined)
      : undefined
  const {
    messages,
    status,
    error,
    preparingLabel,
    preparingDetail,
    currentThread,
    currentWorkspace,
    sendMessage,
    interrupt,
    setThreadAccessMode,
    respondToApproval,
    currentPendingApproval,
    accessModeMutationPending,
    approvalDecisionPending,
    connectionState,
    inputDisabled,
    inputDisabledReason,
    isSending,
    interruptPending,
    interruptError,
  } = useChat({ ...selection, model: selectedModel })
  const { closePanel } = useChatUiActions()

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const title = currentThread?.title ?? currentWorkspace?.name ?? "Chat"
  const detail = currentWorkspace
    ? currentWorkspace.kind === "filesystem"
      ? currentWorkspace.rootPath
      : "Imported legacy chats"
    : "Add or choose a folder to start chatting"

  const scrollToBottom = useCallback(() => {
    const element = scrollContainerRef.current
    if (element) {
      element.scrollTop = element.scrollHeight
    }
    setUserScrolledUp(false)
  }, [])

  const handleScroll = useCallback(() => {
    const element = scrollContainerRef.current
    if (!element) {
      return
    }

    const threshold = 50
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold
    setUserScrolledUp(!atBottom)
  }, [])

  useEffect(() => {
    if (!userScrolledUp) {
      scrollToBottom()
    }
  }, [messages, userScrolledUp, scrollToBottom])

  useEffect(() => {
    const element = scrollContainerRef.current
    if (!element) {
      return
    }

    const observer = new ResizeObserver(() => {
      if (!userScrolledUp) {
        element.scrollTop = element.scrollHeight
      }
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [userScrolledUp])

  const isAuthRequired = status === "auth-expired"
  const isPreparing = status === "preparing"

  return (
    <div className={`flex h-full flex-col ${variant === "page" ? "mx-auto max-w-3xl" : ""}`}>
      {variant === "panel" ? (
        <div className="border-b">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <h2 className="font-heading text-base font-medium">{title}</h2>
              <p className="truncate text-xs text-muted-foreground">{detail}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {connectionState !== "connected" ? (
                <span className="text-xs text-muted-foreground">
                  {connectionState === "connecting"
                    ? "Connecting..."
                    : connectionState === "reconnecting"
                      ? "Reconnecting..."
                      : "Disconnected"}
                </span>
              ) : null}
              <Button variant="ghost" size="sm" onClick={closePanel}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!isPreparing && !isAuthRequired && status !== "idle" && status !== "streaming" && status !== "interrupting" && status !== "queued" && status !== "interrupted" ? (
        <div className="px-4 pt-3">
          <ErrorBanner status={status} error={error} />
        </div>
      ) : null}

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex h-full flex-col gap-4 overflow-y-auto p-4"
        >
          {isAuthRequired ? (
            <div className="flex min-h-[300px] flex-1 items-center justify-center">
              <ChatProviderDisconnected />
            </div>
          ) : messages.length === 0 && !isSending ? (
            <div className="flex min-h-[300px] flex-1 items-center justify-center">
              <ChatEmptyState
                disabled={isPreparing}
                onSuggestionClick={(content) => void sendMessage({ content, attachments: [] })}
              />
            </div>
          ) : messages.length === 0 ? (
            <SendingPlaceholder />
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isSending && messages[messages.length - 1]?.role === "user" ? (
                <SendingPlaceholder />
              ) : null}
              <MemoryUpdatedPill />
            </>
          )}
        </div>

        {userScrolledUp && messages.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="absolute bottom-2 left-1/2 -translate-x-1/2 shadow-md"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
          >
            <svg className="mr-1 size-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 11.5a.5.5 0 0 1-.354-.146l-4-4a.5.5 0 1 1 .708-.708L8 10.293l3.646-3.647a.5.5 0 0 1 .708.708l-4 4A.5.5 0 0 1 8 11.5Z" />
            </svg>
            New messages
          </Button>
        ) : null}
      </div>

      <PromptInput
        onSend={sendMessage}
        onInterrupt={() => void interrupt()}
        status={status}
        connectionState={connectionState}
        disabled={inputDisabled}
        disabledReason={inputDisabledReason}
        loading={isPreparing}
        loadingLabel={preparingLabel}
        loadingDetail={preparingDetail}
        availableModels={availableModels}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        accessMode={currentThread?.accessMode ?? null}
        onAccessModeChange={(accessMode) => void setThreadAccessMode(accessMode)}
        accessModeUpdatePending={accessModeMutationPending}
        pendingApproval={currentPendingApproval}
        onRespondToApproval={(decision) => void respondToApproval(decision)}
        approvalDecisionPending={approvalDecisionPending}
        interruptPending={interruptPending}
        interruptError={interruptError}
        skills={skills}
        onForkSkill={openFork}
        onManageSkillPermissions={openPromotion}
      />

      {dialog.kind === "fork" ? (
        <SkillForkDialog
          open
          sourceSlug={dialog.skill.id}
          sourceName={dialog.skill.name}
          sourceVersion={
            (skills.find((s) => s.id === dialog.skill.id) as SkillEntry | undefined)?.version ?? "0.0.0"
          }
          onConfirm={handleFork}
          onOpenChange={(open) => {
            if (!open) closeDialog()
          }}
        />
      ) : null}

      {dialog.kind === "promotion" && activePromotionSkill ? (
        <SkillPromotionDialog
          open
          skill={{
            id: activePromotionSkill.id,
            name: activePromotionSkill.name,
            tier: activePromotionSkill.tier ?? "curated",
            requestedCapabilities: activePromotionSkill.requestedCapabilities ?? [],
            grantedCapabilities: activePromotionSkill.grantedCapabilities ?? [],
          }}
          fullAccess={currentThread?.accessMode === "full"}
          onGrant={handleGrant}
          onRevoke={handleRevoke}
          onOpenChange={(open) => {
            if (!open) closeDialog()
          }}
        />
      ) : null}
    </div>
  )
}
