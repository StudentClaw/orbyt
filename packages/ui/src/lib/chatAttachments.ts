import type {
  OrchestrationTurnAttachment,
  TurnAttachmentInput,
} from "@orbyt/contracts"
import type { AttachmentData } from "@/components/ai/attachments"

const ATTACHED_FILES_HEADER = "Attached files:"
const USER_MESSAGE_HEADER = "User message:"

type AttachmentReference = Pick<TurnAttachmentInput, "path">

export function buildPromptContent(
  content: string,
  attachments: readonly TurnAttachmentInput[],
): string {
  const trimmed = content.trim()
  if (attachments.length === 0) {
    return trimmed
  }

  const lines = [
    ATTACHED_FILES_HEADER,
    ...attachments.map((attachment) => `- ${attachment.path}`),
  ]

  if (trimmed.length > 0) {
    lines.push("", USER_MESSAGE_HEADER, trimmed)
  }

  return lines.join("\n")
}

export function extractDisplayContent(
  input: string,
  attachments: readonly AttachmentReference[],
): string {
  if (attachments.length === 0) {
    return input
  }

  const normalizedInput = input.replace(/\r\n/g, "\n")
  const header = [
    ATTACHED_FILES_HEADER,
    ...attachments.map((attachment) => `- ${attachment.path}`),
  ].join("\n")

  if (!normalizedInput.startsWith(header)) {
    return input
  }

  const remainder = normalizedInput.slice(header.length).replace(/^\n+/, "")
  if (remainder.startsWith(`${USER_MESSAGE_HEADER}\n`)) {
    return remainder.slice(`${USER_MESSAGE_HEADER}\n`.length)
  }

  if (remainder === USER_MESSAGE_HEADER) {
    return ""
  }

  return remainder
}

export function fileUrlFromPath(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/")
  const pathname = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`

  try {
    return new URL(`file://${pathname}`).toString()
  } catch {
    return `file://${pathname}`
  }
}

export function toAttachmentData(
  attachment: OrchestrationTurnAttachment | (TurnAttachmentInput & { id: string }),
): AttachmentData {
  return {
    id: attachment.id,
    type: "file",
    filename: attachment.name,
    mediaType: attachment.mimeType ?? undefined,
    url: attachment.kind === "image" ? fileUrlFromPath(attachment.path) : undefined,
  }
}
