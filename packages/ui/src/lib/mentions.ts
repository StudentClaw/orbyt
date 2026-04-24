import type {
  TurnAttachmentInput,
  TurnReferenceInput,
} from "@orbyt/contracts"

export type AssignmentMention = {
  readonly kind: "canvas-assignment"
  readonly id: string
  readonly label: string
  readonly url: string
}

export type FileMention = {
  readonly kind: "file"
  readonly label: string
  readonly path: string
}

export type Mention = AssignmentMention | FileMention

export type MentionToken = {
  readonly mention: Mention
  readonly startOffset: number
  readonly endOffset: number
}

const CANVAS_ASSIGNMENT_URL_RE =
  /^https?:\/\/[^\s]+\/courses\/(\d+)\/assignments\/(\d+)(?:[/?#].*)?$/i

const FILE_URL_RE = /^file:\/\/(\/[^\s]*)$/i

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g

export function serializeMentionToMarkdown(mention: Mention): string {
  if (mention.kind === "canvas-assignment") {
    return `[${mention.label}](${mention.url})`
  }
  const normalized = mention.path.replace(/\\/g, "/")
  const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`
  return `[${mention.label}](file://${prefixed})`
}

function tryParseAssignmentUrl(url: string): { id: string } | null {
  const match = CANVAS_ASSIGNMENT_URL_RE.exec(url)
  if (!match) return null
  const [, courseId, assignmentId] = match as unknown as [string, string, string]
  return { id: `canvas-course:${courseId}:assignment:${assignmentId}` }
}

function tryParseFileUrl(url: string): { path: string } | null {
  const match = FILE_URL_RE.exec(url)
  if (!match) return null
  const [, pathname] = match as unknown as [string, string]
  return { path: pathname }
}

export function parseMarkdownToMentions(markdown: string): readonly MentionToken[] {
  const results: MentionToken[] = []
  MARKDOWN_LINK_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MARKDOWN_LINK_RE.exec(markdown)) !== null) {
    const [full, label, url] = match as unknown as [string, string, string]
    const assignment = tryParseAssignmentUrl(url)
    if (assignment) {
      results.push({
        mention: {
          kind: "canvas-assignment",
          id: assignment.id,
          label,
          url,
        },
        startOffset: match.index,
        endOffset: match.index + full.length,
      })
      continue
    }
    const file = tryParseFileUrl(url)
    if (file) {
      results.push({
        mention: {
          kind: "file",
          label,
          path: file.path,
        },
        startOffset: match.index,
        endOffset: match.index + full.length,
      })
      continue
    }
  }
  return results
}

export type MentionMarkdownPart =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "mention"; readonly mention: Mention }

export function serializeMarkdownWithMentions(
  parts: readonly MentionMarkdownPart[],
): string {
  return parts
    .map((part) =>
      part.kind === "text" ? part.text : serializeMentionToMarkdown(part.mention),
    )
    .join("")
}

export function mentionToTurnReference(
  mention: AssignmentMention,
): TurnReferenceInput {
  return {
    kind: "canvas-assignment",
    id: mention.id,
    label: mention.label,
    url: mention.url,
  }
}

export function mentionToTurnAttachment(
  mention: FileMention,
): Pick<TurnAttachmentInput, "path" | "name"> {
  return {
    path: mention.path,
    name: mention.label,
  }
}
