import type { TurnAttachmentInput } from "@orbyt/contracts"
import type { RichComposerSnapshot } from "@/components/chat/RichComposer"

const STORAGE_KEY = "orbyt:chat-composer-drafts:v1"
const STORAGE_VERSION = 1

export type ChatComposerDraft = {
  readonly version: typeof STORAGE_VERSION
  readonly snapshot: RichComposerSnapshot
  readonly attachments: readonly TurnAttachmentInput[]
}

type DraftStorage = {
  readonly version: typeof STORAGE_VERSION
  readonly drafts: Record<string, ChatComposerDraft>
}

function emptyStorage(): DraftStorage {
  return { version: STORAGE_VERSION, drafts: {} }
}

function isDraft(value: unknown): value is ChatComposerDraft {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<ChatComposerDraft>
  return candidate.version === STORAGE_VERSION
    && typeof candidate.snapshot === "object"
    && candidate.snapshot !== null
    && Array.isArray(candidate.snapshot.segments)
    && Array.isArray(candidate.attachments)
}

function readStorage(storage: Storage | null = typeof window === "undefined" ? null : window.localStorage): DraftStorage {
  if (!storage) return emptyStorage()
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return emptyStorage()
    const parsed = JSON.parse(raw) as Partial<DraftStorage>
    if (parsed.version !== STORAGE_VERSION || !parsed.drafts || typeof parsed.drafts !== "object") {
      return emptyStorage()
    }
    const drafts: Record<string, ChatComposerDraft> = {}
    for (const [key, value] of Object.entries(parsed.drafts)) {
      if (isDraft(value)) drafts[key] = value
    }
    return { version: STORAGE_VERSION, drafts }
  } catch {
    return emptyStorage()
  }
}

function writeStorage(
  next: DraftStorage,
  storage: Storage | null = typeof window === "undefined" ? null : window.localStorage,
): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* localStorage may be unavailable or full */
  }
}

export function readChatComposerDraft(draftKey: string | null | undefined): ChatComposerDraft | null {
  if (!draftKey) return null
  return readStorage().drafts[draftKey] ?? null
}

export function writeChatComposerDraft(draftKey: string | null | undefined, draft: ChatComposerDraft): void {
  if (!draftKey) return
  const current = readStorage()
  writeStorage({
    version: STORAGE_VERSION,
    drafts: {
      ...current.drafts,
      [draftKey]: draft,
    },
  })
}

export function clearChatComposerDraft(draftKey: string | null | undefined): void {
  if (!draftKey) return
  const current = readStorage()
  if (!(draftKey in current.drafts)) return
  const { [draftKey]: _removed, ...drafts } = current.drafts
  writeStorage({ version: STORAGE_VERSION, drafts })
}
