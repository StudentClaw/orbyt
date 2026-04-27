import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MentionPicker,
  type AssignmentPickerEntry,
  type FilePickerEntry,
} from "@/components/chat/MentionPicker"
import {
  parseMarkdownToMentions,
  serializeMentionToMarkdown,
  type Mention,
} from "@/lib/mentions"
import { AtSign, BookOpen, FileText } from "lucide-react"

export type SkillEditorSkill = {
  readonly id: string
  readonly name: string
  readonly tier: "curated" | "custom"
  readonly editable: boolean
  readonly markdown: string
}

interface SkillEditorProps {
  readonly skill: SkillEditorSkill
  readonly onSave: (input: { skillId: string; markdown: string }) => Promise<void>
  readonly onDelete: (input: { skillId: string }) => Promise<void>
  readonly assignments?: readonly AssignmentPickerEntry[]
  readonly files?: readonly FilePickerEntry[]
  readonly recents?: readonly FilePickerEntry[]
  readonly canReadCanvas?: boolean
  readonly onBrowseFiles?: () => void
  readonly onRequestCanvasAccess?: () => void
  readonly workspaceRoot?: string | null
}

type MentionChip =
  | { readonly kind: "canvas-assignment"; readonly id: string; readonly label: string; readonly url: string }
  | { readonly kind: "file"; readonly path: string; readonly label: string }

function parseMentionChips(markdown: string): readonly MentionChip[] {
  const tokens = parseMarkdownToMentions(markdown)
  return tokens.map((t) => {
    if (t.mention.kind === "canvas-assignment") {
      return {
        kind: "canvas-assignment" as const,
        id: t.mention.id,
        label: t.mention.label,
        url: t.mention.url,
      }
    }
    return {
      kind: "file" as const,
      path: t.mention.path,
      label: t.mention.label,
    }
  })
}

export function SkillEditor({
  skill,
  onSave,
  onDelete,
  assignments = [],
  files = [],
  recents = [],
  canReadCanvas = true,
  onBrowseFiles,
  onRequestCanvasAccess,
  workspaceRoot,
}: SkillEditorProps) {
  const [value, setValue] = useState(skill.markdown)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerFilter, setPickerFilter] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setValue(skill.markdown)
    setError(null)
  }, [skill.id, skill.markdown])

  const chips = useMemo(() => parseMentionChips(value), [value])

  const insertAtCursor = (snippet: string) => {
    const ta = textareaRef.current
    if (!ta) {
      setValue((current) => current + snippet)
      return
    }
    const start = ta.selectionStart ?? value.length
    const end = ta.selectionEnd ?? value.length
    const next = value.slice(0, start) + snippet + value.slice(end)
    setValue(next)
    requestAnimationFrame(() => {
      if (!textareaRef.current) return
      const caret = start + snippet.length
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(caret, caret)
    })
  }

  const insertMention = (mention: Mention) => {
    const md = serializeMentionToMarkdown(mention)
    insertAtCursor(md)
    setShowPicker(false)
    setPickerFilter("")
  }

  const handleSave = async () => {
    if (!skill.editable) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ skillId: skill.id, markdown: value })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!skill.editable) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete({ skillId: skill.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  const dirty = value !== skill.markdown

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">{skill.name}</h3>
          <p className="text-xs text-muted-foreground">{skill.id}</p>
        </div>
        {!skill.editable ? (
          <span className="rounded-full border border-border/60 bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            Read-only (curated)
          </span>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <div
          className="flex flex-wrap gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2 py-2"
          data-testid="skill-editor-mention-chips"
        >
          <span className="self-center text-[11px] uppercase tracking-wide text-muted-foreground">
            References
          </span>
          {chips.map((chip, idx) => (
            <span
              key={`${chip.kind}:${idx}`}
              data-mention-kind={chip.kind}
              data-mention-label={chip.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-background px-2 py-0.5 text-xs"
            >
              {chip.kind === "canvas-assignment" ? (
                <BookOpen className="size-3 text-muted-foreground" />
              ) : (
                <FileText className="size-3 text-muted-foreground" />
              )}
              <span className="truncate text-foreground">{chip.label}</span>
            </span>
          ))}
        </div>
      ) : null}

      {skill.editable ? (
        <div className="flex items-center gap-2">
          <DropdownMenu open={showPicker} onOpenChange={setShowPicker}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                aria-label="Insert mention"
              >
                <AtSign className="mr-1 size-3.5" />
                Insert mention
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-auto max-w-[calc(100vw-2rem)] p-1"
              data-testid="skill-editor-mention-picker"
            >
              <MentionPicker
                filter={pickerFilter}
                assignments={assignments}
                files={files}
                recents={recents}
                canReadCanvas={canReadCanvas}
                workspaceRoot={workspaceRoot}
                onSelectAssignment={(a) =>
                  insertMention({
                    kind: "canvas-assignment",
                    id: a.id,
                    label: a.label,
                    url: a.url,
                  })
                }
                onSelectFile={(f) =>
                  insertMention({ kind: "file", label: f.label, path: f.path })
                }
                onBrowseFiles={() => {
                  setShowPicker(false)
                  onBrowseFiles?.()
                }}
                onRequestCanvasAccess={onRequestCanvasAccess}
              />
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-[11px] text-muted-foreground">
            Inserts a markdown link that Codex will expand via MCP tools.
          </p>
        </div>
      ) : null}

      <div className="flex-1">
        <Label htmlFor="skill-markdown" className="sr-only">
          Skill markdown
        </Label>
        <Textarea
          ref={textareaRef}
          id="skill-markdown"
          aria-label="skill markdown"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          readOnly={!skill.editable}
          className="h-full min-h-[320px] font-mono text-xs"
        />
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        {skill.editable ? (
          <Button variant="ghost" onClick={handleDelete} disabled={deleting} className="text-red-600">
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        ) : null}
        <Button onClick={handleSave} disabled={!skill.editable || saving || !dirty}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  )
}
