import type {
  ArtifactKind,
  ChatArtifact,
  ParseArtifactsResult,
  PendingArtifact,
} from "./types"
import { artifactSentinel } from "./types"

const TAG_NAME = "artifact"
const OPEN_PREFIX = `<${TAG_NAME}`
const CLOSE_TAG = `</${TAG_NAME}>`
const KNOWN_KINDS: ReadonlySet<string> = new Set<ArtifactKind>([
  "code",
  "markdown",
  "html",
  "svg",
  "text",
])

const CLOSED_TAG_REGEX = /<artifact\b([^>]*)>([\s\S]*?)<\/artifact>/g

export function parseArtifacts(
  input: string,
  messageId: string,
): ParseArtifactsResult {
  if (input.length === 0) {
    return { cleanedContent: "", artifacts: [], pendingArtifact: null }
  }

  const artifacts: ChatArtifact[] = []
  let index = 0
  let cleaned = ""
  let cursor = 0

  for (const match of input.matchAll(CLOSED_TAG_REGEX)) {
    const matchStart = match.index ?? 0
    const [whole, attrBlob, body] = match
    cleaned += input.slice(cursor, matchStart)

    const attrs = parseAttributes(attrBlob ?? "")
    const id = attrs.id ?? `${messageId}:artifact:${index}`
    const kind = coerceKind(attrs.kind)
    const title = attrs.title ?? attrs.filename ?? "Untitled artifact"
    const content = stripSurroundingNewlines(body ?? "")

    artifacts.push({
      id,
      messageId,
      kind,
      title,
      filename: attrs.filename,
      language: attrs.language,
      content,
    })

    const sentinel = `\n\n${artifactSentinel(id)}\n\n`
    cleaned += sentinel

    cursor = matchStart + whole.length
    index += 1
  }

  cleaned += input.slice(cursor)

  const pendingScan = extractPending(cleaned, messageId, index)
  return {
    cleanedContent: pendingScan.cleaned,
    artifacts,
    pendingArtifact: pendingScan.pending,
  }
}

interface PendingScanResult {
  readonly cleaned: string
  readonly pending: PendingArtifact | null
}

function extractPending(
  cleaned: string,
  _messageId: string,
  _startIndex: number,
): PendingScanResult {
  const openIdx = findUnmatchedOpen(cleaned)
  if (openIdx === -1) {
    return { cleaned: truncateTornOpen(cleaned), pending: null }
  }

  const afterOpenPrefix = openIdx + OPEN_PREFIX.length
  if (afterOpenPrefix >= cleaned.length) {
    return { cleaned: cleaned.slice(0, openIdx), pending: null }
  }

  const nextChar = cleaned[afterOpenPrefix]
  const isBoundary = nextChar === " " || nextChar === ">" || nextChar === "\t" || nextChar === "\n"
  if (!isBoundary) {
    return { cleaned: cleaned.slice(0, openIdx), pending: null }
  }

  const closeAngle = cleaned.indexOf(">", afterOpenPrefix)
  if (closeAngle === -1) {
    return { cleaned: cleaned.slice(0, openIdx), pending: null }
  }

  const attrBlob = cleaned.slice(afterOpenPrefix, closeAngle)
  const body = cleaned.slice(closeAngle + 1)
  const attrs = parseAttributes(attrBlob)

  const pending: PendingArtifact = {
    kind: attrs.kind ? coerceKind(attrs.kind) : undefined,
    title: attrs.title ?? attrs.filename,
    language: attrs.language,
    filename: attrs.filename,
    bytesSoFar: body.length,
  }

  return { cleaned: cleaned.slice(0, openIdx), pending }
}

function findUnmatchedOpen(text: string): number {
  let from = 0
  while (from < text.length) {
    const idx = text.indexOf(OPEN_PREFIX, from)
    if (idx === -1) {
      return -1
    }
    const closeIdx = text.indexOf(CLOSE_TAG, idx)
    if (closeIdx === -1) {
      return idx
    }
    from = closeIdx + CLOSE_TAG.length
  }
  return -1
}

function truncateTornOpen(text: string): string {
  const lastLt = text.lastIndexOf("<")
  if (lastLt === -1) {
    return text
  }
  const tail = text.slice(lastLt + 1)
  if (OPEN_PREFIX.slice(1).startsWith(tail)) {
    return text.slice(0, lastLt)
  }
  return text
}

interface Attributes {
  id?: string
  kind?: string
  title?: string
  filename?: string
  language?: string
}

const ATTR_REGEX = /(\w+)\s*=\s*"([^"]*)"/g

function parseAttributes(blob: string): Attributes {
  const out: Attributes = {}
  for (const match of blob.matchAll(ATTR_REGEX)) {
    const [, rawName, rawValue] = match
    const name = rawName?.toLowerCase()
    if (!name || rawValue === undefined) continue
    switch (name) {
      case "id":
        out.id = rawValue
        break
      case "kind":
      case "type":
        out.kind = rawValue
        break
      case "title":
        out.title = rawValue
        break
      case "filename":
      case "name":
        out.filename = rawValue
        break
      case "language":
      case "lang":
        out.language = rawValue
        break
    }
  }
  return out
}

function coerceKind(value: string | undefined): ArtifactKind {
  if (!value) return "text"
  const lower = value.toLowerCase()
  if (KNOWN_KINDS.has(lower)) {
    return lower as ArtifactKind
  }
  if (lower === "md") return "markdown"
  if (lower === "source" || lower === "script" || lower === "code-block") return "code"
  return "code"
}

function stripSurroundingNewlines(s: string): string {
  return s.replace(/^\n+/, "").replace(/\n+$/, "")
}
