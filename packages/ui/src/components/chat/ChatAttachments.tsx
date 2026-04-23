import type {
  OrchestrationTurnAttachment,
  TurnAttachmentInput,
} from "@orbyt/contracts"
import {
  Attachment,
  Attachments,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  type AttachmentVariant,
} from "@/components/ai/attachments"
import { cn } from "@/lib/utils"
import { toAttachmentData } from "@/lib/chatAttachments"

type ChatAttachment = OrchestrationTurnAttachment | (TurnAttachmentInput & { id: string })

interface ChatAttachmentsProps {
  readonly attachments: readonly ChatAttachment[]
  readonly variant?: AttachmentVariant
  readonly onRemove?: (attachmentId: string) => void
  readonly className?: string
}

export function ChatAttachments({
  attachments,
  variant = "inline",
  onRemove,
  className,
}: ChatAttachmentsProps) {
  if (attachments.length === 0) {
    return null
  }

  return (
    <Attachments
      variant={variant}
      className={cn(
        variant === "inline" ? "justify-start" : "",
        className,
      )}
    >
      {attachments.map((attachment) => (
        <Attachment
          key={attachment.id}
          data={toAttachmentData(attachment)}
          onRemove={onRemove ? () => onRemove(attachment.id) : undefined}
        >
          <AttachmentPreview />
          {variant !== "grid" && <AttachmentInfo />}
          {onRemove && <AttachmentRemove />}
        </Attachment>
      ))}
    </Attachments>
  )
}
