import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

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
}

export function SkillEditor({ skill, onSave, onDelete }: SkillEditorProps) {
  const [value, setValue] = useState(skill.markdown)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setValue(skill.markdown)
    setError(null)
  }, [skill.id, skill.markdown])

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

      <div className="flex-1">
        <Label htmlFor="skill-markdown" className="sr-only">
          Skill markdown
        </Label>
        <Textarea
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
