import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import type { SkillPickerEntry } from "./SkillPicker"
import type {
  TurnAttachmentInput,
  TurnReferenceInput,
} from "@orbyt/contracts"
import { cn } from "@/lib/utils"
import { detectComposerTrigger } from "@/lib/composerTrigger"

type CanvasReferenceKind = "canvas-assignment" | "canvas-coursework"

export type MentionKind = CanvasReferenceKind | "file"

export interface AssignmentMentionInput {
  readonly id: string
  readonly label: string
  readonly url: string
  readonly referenceKind?: CanvasReferenceKind
}

export interface FileMentionInput {
  readonly path: string
  readonly label: string
  readonly mimeType?: string | null
  readonly sizeBytes?: number | null
  readonly kind?: "image" | "file"
}

export type RichComposerSnapshotSegment =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "skill"; readonly id: string; readonly name: string }
  | {
      readonly type: "canvas-assignment"
      readonly id: string
      readonly label: string
      readonly url: string
      readonly referenceKind?: CanvasReferenceKind
    }
  | {
      readonly type: "file"
      readonly path: string
      readonly label: string
      readonly mimeType?: string | null
      readonly sizeBytes?: number | null
      readonly kind?: "image" | "file"
    }

export type RichComposerSnapshot = {
  readonly segments: readonly RichComposerSnapshotSegment[]
}

export interface RichComposerHandle {
  focus: () => void
  clear: () => void
  getSnapshot: () => RichComposerSnapshot
  setSnapshot: (snapshot: RichComposerSnapshot) => void
  replaceTriggerWithText: (text: string) => void
  getText: () => string
  getSkillId: () => string | null
  isEmpty: () => boolean
  insertSkill: (skill: SkillPickerEntry) => void
  insertAssignment: (assignment: AssignmentMentionInput) => void
  insertFile: (file: FileMentionInput) => void
  getReferences: () => readonly TurnReferenceInput[]
  getAttachments: () => readonly TurnAttachmentInput[]
}

interface RichComposerProps {
  placeholder?: string
  disabled?: boolean
  className?: string
  onContentChange?: (isEmpty: boolean) => void
  onSkillTrigger?: (filter: string, show: boolean) => void
  onMentionTrigger?: (filter: string, show: boolean, kind?: MentionKind) => void
  onSubmit?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void
}

type ExtractedContent = {
  readonly text: string
  readonly skillId: string | null
  readonly references: readonly TurnReferenceInput[]
  readonly attachments: readonly TurnAttachmentInput[]
}

type TextCursor = {
  readonly node: Text
  readonly offset: number
}

function lastTextDescendant(node: Node | null | undefined): Text | null {
  if (!node) return null
  if (node.nodeType === Node.TEXT_NODE) return node as Text
  for (let child = node.lastChild; child; child = child.previousSibling) {
    const text = lastTextDescendant(child)
    if (text) return text
  }
  return null
}

function firstTextDescendant(node: Node | null | undefined): Text | null {
  if (!node) return null
  if (node.nodeType === Node.TEXT_NODE) return node as Text
  for (let child = node.firstChild; child; child = child.nextSibling) {
    const text = firstTextDescendant(child)
    if (text) return text
  }
  return null
}

function getTextCursor(root: HTMLDivElement, range: Range): TextCursor | null {
  if (!root.contains(range.startContainer)) return null
  if (range.startContainer.nodeType === Node.TEXT_NODE) {
    return {
      node: range.startContainer as Text,
      offset: range.startOffset,
    }
  }

  const before = lastTextDescendant(range.startContainer.childNodes.item(range.startOffset - 1))
  if (before) {
    return {
      node: before,
      offset: before.textContent?.length ?? 0,
    }
  }

  const after = firstTextDescendant(range.startContainer.childNodes.item(range.startOffset))
  if (after) {
    return {
      node: after,
      offset: 0,
    }
  }

  return null
}

function parseIntOrNull(value: string | undefined): number | null {
  if (!value) return null
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

function extractContent(div: HTMLDivElement | null): ExtractedContent {
  if (!div) {
    return { text: "", skillId: null, references: [], attachments: [] }
  }
  let text = ""
  let skillId: string | null = null
  const references: TurnReferenceInput[] = []
  const attachments: TurnAttachmentInput[] = []

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += (node.textContent ?? "").replace(/\u200B/g, "")
      return
    }
    if (!(node instanceof HTMLElement)) return

    if (node.dataset.skillId) {
      if (!skillId) skillId = node.dataset.skillId
      return
    }
    if (
      node.dataset.mentionKind === "canvas-assignment"
      || node.dataset.mentionKind === "canvas-coursework"
    ) {
      const referenceId = node.dataset.referenceId ?? ""
      const label = node.dataset.label ?? ""
      const url = node.dataset.url ?? ""
      if (referenceId && label) {
        references.push({
          kind: node.dataset.mentionKind,
          id: referenceId,
          label,
          url: url || null,
        })
      }
      return
    }
    if (node.dataset.mentionKind === "file") {
      const path = node.dataset.path ?? ""
      const label = node.dataset.label ?? ""
      const mimeType = node.dataset.mimeType ?? null
      const sizeBytes = parseIntOrNull(node.dataset.sizeBytes)
      const kind =
        (node.dataset.fileKind === "image" ? "image" : "file") as "image" | "file"
      if (path && label) {
        attachments.push({
          path,
          name: label,
          mimeType: mimeType || null,
          sizeBytes,
          kind,
        })
      }
      return
    }
    if (node.tagName === "BR") {
      text += "\n"
    } else if ((node.tagName === "DIV" || node.tagName === "P") && text.length > 0) {
      text += "\n"
    }
    for (const child of node.childNodes) walk(child)
  }

  walk(div)
  return { text: text.trim(), skillId, references, attachments }
}

function snapshotFromDom(div: HTMLDivElement | null): RichComposerSnapshot {
  if (!div) return { segments: [] }
  const segments: RichComposerSnapshotSegment[] = []
  const pushText = (value: string) => {
    const text = value.replace(/\u200B/g, "")
    if (!text) return
    const previous = segments.at(-1)
    if (previous?.type === "text") {
      segments[segments.length - 1] = { type: "text", text: previous.text + text }
      return
    }
    segments.push({ type: "text", text })
  }

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent ?? "")
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.dataset.skillId) {
      segments.push({
        type: "skill",
        id: node.dataset.skillId,
        name: node.dataset.skillName ?? node.textContent?.replace(/^\/|×$/g, "") ?? "skill",
      })
      return
    }
    if (
      node.dataset.mentionKind === "canvas-assignment"
      || node.dataset.mentionKind === "canvas-coursework"
    ) {
      const id = node.dataset.referenceId ?? ""
      const label = node.dataset.label ?? ""
      if (id && label) {
        segments.push({
          type: "canvas-assignment",
          id,
          label,
          url: node.dataset.url ?? "",
          ...(node.dataset.mentionKind === "canvas-coursework"
            ? { referenceKind: node.dataset.mentionKind }
            : {}),
        })
      }
      return
    }
    if (node.dataset.mentionKind === "file") {
      const filePath = node.dataset.path ?? ""
      const label = node.dataset.label ?? ""
      if (filePath && label) {
        segments.push({
          type: "file",
          path: filePath,
          label,
          mimeType: node.dataset.mimeType ?? null,
          sizeBytes: parseIntOrNull(node.dataset.sizeBytes),
          kind: node.dataset.fileKind === "image" ? "image" : "file",
        })
      }
      return
    }
    if (node.tagName === "BR") {
      pushText("\n")
      return
    }
    if ((node.tagName === "DIV" || node.tagName === "P") && segments.length > 0) {
      pushText("\n")
    }
    for (const child of node.childNodes) walk(child)
  }

  for (const child of div.childNodes) walk(child)
  return { segments }
}

function computeIsEmpty(div: HTMLDivElement | null): boolean {
  if (!div) return true
  const { text, skillId, references, attachments } = extractContent(div)
  return !text && !skillId && references.length === 0 && attachments.length === 0
}

function buildSkillChip(skill: SkillPickerEntry): HTMLElement {
  const chip = document.createElement("span")
  chip.contentEditable = "false"
  chip.dataset.skillId = skill.id
  chip.dataset.skillName = skill.name
  chip.className =
    "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary mx-0.5 align-middle select-none"
  chip.setAttribute("aria-label", `Skill: ${skill.name}`)

  const label = document.createElement("span")
  label.textContent = `/${skill.name}`
  chip.appendChild(label)

  const xBtn = buildRemoveButton(`Remove ${skill.name} skill`)
  chip.appendChild(xBtn)

  return chip
}

function buildRemoveButton(ariaLabel: string): HTMLButtonElement {
  const xBtn = document.createElement("button")
  xBtn.type = "button"
  xBtn.dataset.removeChip = "true"
  xBtn.className = "ml-0.5 opacity-60 hover:opacity-100 leading-none"
  xBtn.setAttribute("aria-label", ariaLabel)
  xBtn.textContent = "×"
  return xBtn
}

function buildAssignmentChip(assignment: AssignmentMentionInput): HTMLElement {
  const chip = document.createElement("span")
  chip.contentEditable = "false"
  chip.dataset.mentionKind = assignment.referenceKind ?? "canvas-assignment"
  chip.dataset.referenceId = assignment.id
  chip.dataset.label = assignment.label
  chip.dataset.url = assignment.url
  chip.className =
    "inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 mx-0.5 align-middle select-none"
  chip.setAttribute("aria-label", `Canvas item: ${assignment.label}`)

  const labelEl = document.createElement("span")
  labelEl.textContent = `@${assignment.label}`
  chip.appendChild(labelEl)

  chip.appendChild(buildRemoveButton(`Remove ${assignment.label} Canvas item`))
  return chip
}

function buildFileChip(file: FileMentionInput): HTMLElement {
  const chip = document.createElement("span")
  chip.contentEditable = "false"
  chip.dataset.mentionKind = "file"
  chip.dataset.path = file.path
  chip.dataset.label = file.label
  if (file.mimeType != null) chip.dataset.mimeType = file.mimeType
  if (file.sizeBytes != null) chip.dataset.sizeBytes = String(file.sizeBytes)
  chip.dataset.fileKind = file.kind ?? "file"
  chip.className =
    "inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300 mx-0.5 align-middle select-none"
  chip.setAttribute("aria-label", `File: ${file.label}`)

  const labelEl = document.createElement("span")
  labelEl.textContent = `@${file.label}`
  chip.appendChild(labelEl)

  chip.appendChild(buildRemoveButton(`Remove ${file.label} file`))
  return chip
}

type TriggerRef =
  | {
      readonly kind: "slash"
      readonly node: Text
      readonly offset: number
    }
  | {
      readonly kind: "at"
      readonly node: Text
      readonly offset: number
    }

export const RichComposer = forwardRef<RichComposerHandle, RichComposerProps>(
  function RichComposer(
    {
      placeholder,
      disabled,
      className,
      onContentChange,
      onSkillTrigger,
      onMentionTrigger,
      onSubmit,
      onKeyDown,
      onPaste,
    },
    ref,
  ) {
    const divRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<TriggerRef | null>(null)
    const [showPlaceholder, setShowPlaceholder] = useState(true)

    const syncState = () => {
      const div = divRef.current
      const empty = computeIsEmpty(div)
      setShowPlaceholder(empty)
      onContentChange?.(empty)
    }

    const appendChip = (chip: HTMLElement) => {
      const div = divRef.current
      if (!div) return
      div.appendChild(chip)
      const spacer = document.createTextNode("\u200B")
      div.appendChild(spacer)
      const sel = window.getSelection()
      const range = document.createRange()
      range.setStart(spacer, 1)
      range.collapse(true)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }

    const insertChipAtTrigger = (chip: HTMLElement) => {
      const div = divRef.current
      if (!div) return false
      const info = triggerRef.current
      if (!info) {
        appendChip(chip)
        return true
      }
      const sel = window.getSelection()
      if (!sel?.rangeCount) {
        appendChip(chip)
        return true
      }

      const { node, offset } = info
      const range = sel.getRangeAt(0)
      const cursorOffset = range.startContainer === node
        ? range.startOffset
        : (node.textContent ?? "").length
      const beforeText = (node.textContent ?? "").slice(0, offset)
      const afterText = (node.textContent ?? "").slice(cursorOffset)

      const frag = document.createDocumentFragment()
      if (beforeText) frag.appendChild(document.createTextNode(beforeText))
      frag.appendChild(chip)
      const spacer = document.createTextNode("\u200B")
      frag.appendChild(spacer)
      if (afterText) frag.appendChild(document.createTextNode(afterText))

      node.replaceWith(frag)

      const newRange = document.createRange()
      newRange.setStart(spacer, 1)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
      return true
    }

    const replaceTriggerWithText = (replacement: string) => {
      const info = triggerRef.current
      const sel = window.getSelection()
      if (!info || !sel?.rangeCount) return false
      const { node, offset } = info
      const range = sel.getRangeAt(0)
      const cursorOffset = range.startContainer === node
        ? range.startOffset
        : (node.textContent ?? "").length
      const beforeText = (node.textContent ?? "").slice(0, offset)
      const afterText = (node.textContent ?? "").slice(cursorOffset)
      const nextText = document.createTextNode(`${beforeText}${replacement}${afterText}`)
      node.replaceWith(nextText)
      const nextRange = document.createRange()
      nextRange.setStart(nextText, beforeText.length + replacement.length)
      nextRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(nextRange)
      triggerRef.current = null
      syncState()
      onSkillTrigger?.("", false)
      onMentionTrigger?.("", false)
      return true
    }

    const applySnapshot = (snapshot: RichComposerSnapshot) => {
      const div = divRef.current
      if (!div) return
      div.innerHTML = ""
      for (const segment of snapshot.segments) {
        if (segment.type === "text") {
          div.appendChild(document.createTextNode(segment.text))
        } else if (segment.type === "skill") {
          div.appendChild(buildSkillChip({
            id: segment.id,
            name: segment.name,
            description: "",
          } as SkillPickerEntry))
          div.appendChild(document.createTextNode("\u200B"))
        } else if (segment.type === "canvas-assignment") {
          div.appendChild(buildAssignmentChip({
            id: segment.id,
            label: segment.label,
            url: segment.url,
            referenceKind: segment.referenceKind,
          }))
          div.appendChild(document.createTextNode("\u200B"))
        } else {
          div.appendChild(buildFileChip(segment))
          div.appendChild(document.createTextNode("\u200B"))
        }
      }
      triggerRef.current = null
      syncState()
      onSkillTrigger?.("", false)
      onMentionTrigger?.("", false)
    }

    useImperativeHandle(ref, () => ({
      focus() {
        divRef.current?.focus()
      },
      clear() {
        const div = divRef.current
        if (!div) return
        div.innerHTML = ""
        triggerRef.current = null
        setShowPlaceholder(true)
        onContentChange?.(true)
        onSkillTrigger?.("", false)
        onMentionTrigger?.("", false)
      },
      getSnapshot() {
        return snapshotFromDom(divRef.current)
      },
      setSnapshot(snapshot: RichComposerSnapshot) {
        applySnapshot(snapshot)
      },
      replaceTriggerWithText(text: string) {
        replaceTriggerWithText(text)
      },
      getText() {
        return extractContent(divRef.current).text
      },
      getSkillId() {
        return extractContent(divRef.current).skillId
      },
      isEmpty() {
        return computeIsEmpty(divRef.current)
      },
      getReferences() {
        return extractContent(divRef.current).references
      },
      getAttachments() {
        return extractContent(divRef.current).attachments
      },
      insertSkill(skill: SkillPickerEntry) {
        const div = divRef.current
        if (!div) return
        insertChipAtTrigger(buildSkillChip(skill))
        triggerRef.current = null
        syncState()
        onSkillTrigger?.("", false)
        onMentionTrigger?.("", false)
        div.focus()
      },
      insertAssignment(assignment: AssignmentMentionInput) {
        const div = divRef.current
        if (!div) return
        insertChipAtTrigger(buildAssignmentChip(assignment))
        triggerRef.current = null
        syncState()
        onSkillTrigger?.("", false)
        onMentionTrigger?.("", false)
        div.focus()
      },
      insertFile(file: FileMentionInput) {
        const div = divRef.current
        if (!div) return
        insertChipAtTrigger(buildFileChip(file))
        triggerRef.current = null
        syncState()
        onSkillTrigger?.("", false)
        onMentionTrigger?.("", false)
        div.focus()
      },
    }))

    const clearTriggers = () => {
      triggerRef.current = null
      onSkillTrigger?.("", false)
      onMentionTrigger?.("", false)
    }

    const handleInput = () => {
      const div = divRef.current
      if (!div) return

      if (div.innerHTML === "<br>") div.innerHTML = ""

      syncState()

      const sel = window.getSelection()
      if (!sel?.rangeCount) {
        clearTriggers()
        return
      }

      const range = sel.getRangeAt(0)
      const cursor = getTextCursor(div, range)
      if (!cursor) {
        clearTriggers()
        return
      }

      const textBeforeCursor = (cursor.node.textContent ?? "").slice(0, cursor.offset)
      const trigger = detectComposerTrigger(textBeforeCursor)
      if (trigger) {
        const offset = textBeforeCursor.length - trigger.filter.length - 1
        triggerRef.current = { kind: trigger.kind, node: cursor.node, offset }
        if (trigger.kind === "at") {
          onSkillTrigger?.("", false)
          onMentionTrigger?.(trigger.filter, true)
          return
        }
        onMentionTrigger?.("", false)
        onSkillTrigger?.(trigger.filter, true)
        return
      }

      clearTriggers()
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e)
      if (e.defaultPrevented) return

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        onSubmit?.()
      }
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      onPaste?.(e)
      if (e.defaultPrevented) return
      e.preventDefault()
      const text = e.clipboardData.getData("text/plain")
      document.execCommand("insertText", false, text)
    }

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement
      if (target.closest("[data-remove-chip]")) {
        const chip = target.closest(
          "[data-skill-id], [data-mention-kind]",
        ) as HTMLElement | null
        if (chip) {
          const next = chip.nextSibling
          if (next?.nodeType === Node.TEXT_NODE && next.textContent === "\u200B") {
            next.remove()
          }
          chip.remove()
          syncState()
        }
      }
    }

    return (
      <div className="relative w-full flex-1">
        <div
          ref={divRef}
          contentEditable={disabled ? false : true}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Chat message input"
          aria-disabled={disabled ? "true" : "false"}
          data-placeholder={placeholder}
          className={cn(
            "min-h-20 w-full cursor-text break-words whitespace-pre-wrap text-sm outline-none",
            disabled && "pointer-events-none opacity-50",
            className,
          )}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onClick={handleClick}
        />
        {showPlaceholder && (
          <span
            className={cn(
              "pointer-events-none absolute left-0 top-0 select-none text-sm text-muted-foreground",
              className,
            )}
            aria-hidden="true"
          >
            {placeholder}
          </span>
        )}
      </div>
    )
  },
)
