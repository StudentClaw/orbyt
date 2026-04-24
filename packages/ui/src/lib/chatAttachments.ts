import type {
  OrchestrationTurnAttachment,
  TurnAttachmentInput,
  TurnReferenceInput,
} from "@orbyt/contracts"
import type { AttachmentData } from "@/components/ai/attachments"

const ATTACHED_FILES_HEADER = "Attached files:"
const REFERENCED_ASSIGNMENTS_HEADER = "Referenced Canvas assignments:"
const USER_MESSAGE_HEADER = "User message:"

type AttachmentReference = Pick<TurnAttachmentInput, "path">

type ReferenceView = Pick<TurnReferenceInput, "kind" | "id" | "label" | "url">

function formatReferenceLine(reference: ReferenceView): string {
  const segments = [`assignment_id=${reference.id}`]
  if (reference.url) {
    segments.push(`url=${reference.url}`)
  }
  return `- "${reference.label}" (${segments.join(", ")})`
}

function buildReferencesBlock(references: readonly ReferenceView[]): string {
  return [
    REFERENCED_ASSIGNMENTS_HEADER,
    ...references.map((reference) => formatReferenceLine(reference)),
  ].join("\n")
}

function buildAttachmentsBlock(
  attachments: readonly AttachmentReference[],
): string {
  return [
    ATTACHED_FILES_HEADER,
    ...attachments.map((attachment) => `- ${attachment.path}`),
  ].join("\n")
}

export function buildPromptContent(
  content: string,
  attachments: readonly TurnAttachmentInput[],
  references: readonly TurnReferenceInput[] = [],
): string {
  const trimmed = content.trim()
  if (attachments.length === 0 && references.length === 0) {
    return trimmed
  }

  const blocks: string[] = []
  if (references.length > 0) {
    blocks.push(buildReferencesBlock(references))
  }
  if (attachments.length > 0) {
    blocks.push(buildAttachmentsBlock(attachments))
  }

  let output = blocks.join("\n\n")
  if (trimmed.length > 0) {
    output = `${output}\n\n${USER_MESSAGE_HEADER}\n${trimmed}`
  }
  return output
}

function stripBlock(input: string, block: string): string | null {
  if (!input.startsWith(block)) {
    return null
  }
  return input.slice(block.length).replace(/^\n+/, "")
}

export function extractDisplayContent(
  input: string,
  attachments: readonly AttachmentReference[],
  references: readonly ReferenceView[] = [],
): string {
  if (attachments.length === 0 && references.length === 0) {
    return input
  }

  const normalizedInput = input.replace(/\r\n/g, "\n")
  let remainder = normalizedInput

  if (references.length > 0) {
    const stripped = stripBlock(remainder, buildReferencesBlock(references))
    if (stripped === null) {
      return input
    }
    remainder = stripped
  }

  if (attachments.length > 0) {
    const stripped = stripBlock(remainder, buildAttachmentsBlock(attachments))
    if (stripped === null) {
      return input
    }
    remainder = stripped
  }

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
