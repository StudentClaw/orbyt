import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import type { SkillPickerEntry } from "./SkillPicker"
import { cn } from "@/lib/utils"

export interface RichComposerHandle {
  focus: () => void
  clear: () => void
  getText: () => string
  getSkillId: () => string | null
  isEmpty: () => boolean
  insertSkill: (skill: SkillPickerEntry) => void
}

interface RichComposerProps {
  placeholder?: string
  disabled?: boolean
  className?: string
  onContentChange?: (isEmpty: boolean) => void
  onSkillTrigger?: (filter: string, show: boolean) => void
  onSubmit?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
}

function extractContent(div: HTMLDivElement | null): { text: string; skillId: string | null } {
  if (!div) return { text: "", skillId: null }
  let text = ""
  let skillId: string | null = null

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += (node.textContent ?? "").replace(/\u200B/g, "")
    } else if (node instanceof HTMLElement) {
      if (node.dataset.skillId) {
        if (!skillId) skillId = node.dataset.skillId
        return
      }
      if (node.tagName === "BR") {
        text += "\n"
      } else if ((node.tagName === "DIV" || node.tagName === "P") && text.length > 0) {
        text += "\n"
      }
      for (const child of node.childNodes) walk(child)
    }
  }

  walk(div)
  return { text: text.trim(), skillId }
}

function computeIsEmpty(div: HTMLDivElement | null): boolean {
  if (!div) return true
  const { text, skillId } = extractContent(div)
  return !text && !skillId
}

function buildChip(skill: SkillPickerEntry): HTMLElement {
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

  const xBtn = document.createElement("button")
  xBtn.type = "button"
  xBtn.dataset.removeChip = "true"
  xBtn.className = "ml-0.5 opacity-60 hover:opacity-100 leading-none"
  xBtn.setAttribute("aria-label", `Remove ${skill.name} skill`)
  xBtn.textContent = "×"
  chip.appendChild(xBtn)

  return chip
}

export const RichComposer = forwardRef<RichComposerHandle, RichComposerProps>(
  function RichComposer(
    { placeholder, disabled, className, onContentChange, onSkillTrigger, onSubmit, onKeyDown },
    ref,
  ) {
    const divRef = useRef<HTMLDivElement>(null)
    const slashRef = useRef<{ node: Text; offset: number } | null>(null)
    const [showPlaceholder, setShowPlaceholder] = useState(true)

    useImperativeHandle(ref, () => ({
      focus() {
        divRef.current?.focus()
      },
      clear() {
        const div = divRef.current
        if (!div) return
        div.innerHTML = ""
        slashRef.current = null
        setShowPlaceholder(true)
        onContentChange?.(true)
        onSkillTrigger?.("", false)
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
      insertSkill(skill: SkillPickerEntry) {
        const div = divRef.current
        if (!div) return

        const slashInfo = slashRef.current
        const sel = window.getSelection()

        if (slashInfo && sel?.rangeCount) {
          const { node, offset: slashOffset } = slashInfo
          const cursorOffset = sel.getRangeAt(0).startOffset
          const beforeText = (node.textContent ?? "").slice(0, slashOffset)
          const afterText = (node.textContent ?? "").slice(cursorOffset)

          const chip = buildChip(skill)
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
        }

        slashRef.current = null
        const empty = computeIsEmpty(div)
        setShowPlaceholder(empty)
        onContentChange?.(empty)
        onSkillTrigger?.("", false)
        div.focus()
      },
    }))

    const handleInput = () => {
      const div = divRef.current
      if (!div) return

      if (div.innerHTML === "<br>") div.innerHTML = ""

      const empty = computeIsEmpty(div)
      setShowPlaceholder(empty)
      onContentChange?.(empty)

      const sel = window.getSelection()
      if (!sel?.rangeCount) {
        slashRef.current = null
        onSkillTrigger?.("", false)
        return
      }

      const range = sel.getRangeAt(0)
      const container = range.startContainer

      if (container.nodeType !== Node.TEXT_NODE) {
        slashRef.current = null
        onSkillTrigger?.("", false)
        return
      }

      const textBeforeCursor = (container.textContent ?? "").slice(0, range.startOffset)
      const lastSlash = textBeforeCursor.lastIndexOf("/")

      if (lastSlash !== -1) {
        const fragment = textBeforeCursor.slice(lastSlash + 1)
        if (!fragment.includes(" ") && !fragment.includes("\n")) {
          slashRef.current = { node: container as Text, offset: lastSlash }
          onSkillTrigger?.(fragment, true)
          return
        }
      }

      slashRef.current = null
      onSkillTrigger?.("", false)
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
      e.preventDefault()
      const text = e.clipboardData.getData("text/plain")
      document.execCommand("insertText", false, text)
    }

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement
      if (target.closest("[data-remove-chip]")) {
        const chip = target.closest("[data-skill-id]") as HTMLElement | null
        if (chip) {
          const next = chip.nextSibling
          if (next?.nodeType === Node.TEXT_NODE && next.textContent === "\u200B") {
            next.remove()
          }
          chip.remove()
          const div = divRef.current
          const empty = computeIsEmpty(div)
          setShowPlaceholder(empty)
          onContentChange?.(empty)
        }
      }
    }

    return (
      <div className="relative w-full flex-1">
        <div
          ref={divRef}
          contentEditable={disabled ? false : true}
          disabled={disabled || undefined}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Chat message input"
          aria-disabled={disabled ? "true" : "false"}
          placeholder={placeholder}
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
