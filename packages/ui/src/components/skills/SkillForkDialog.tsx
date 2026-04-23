import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type SkillForkPayload = {
  readonly sourceSlug: string
  readonly targetSlug: string
  readonly displayName?: string
}

interface SkillForkDialogProps {
  readonly open: boolean
  readonly sourceSlug: string
  readonly sourceName: string
  readonly sourceVersion: string
  readonly onConfirm: (payload: SkillForkPayload) => Promise<void>
  readonly onOpenChange: (open: boolean) => void
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function SkillForkDialog({
  open,
  sourceSlug,
  sourceName,
  sourceVersion,
  onConfirm,
  onOpenChange,
}: SkillForkDialogProps) {
  const defaultSlug = useMemo(() => `${sourceSlug}-fork`, [sourceSlug])
  const [targetSlug, setTargetSlug] = useState(defaultSlug)
  const [displayName, setDisplayName] = useState(`${sourceName} (Fork)`)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTargetSlug(defaultSlug)
      setDisplayName(`${sourceName} (Fork)`)
      setServerError(null)
    }
  }, [open, defaultSlug, sourceName])

  const slugValid = SLUG_RE.test(targetSlug)

  const handleConfirm = async () => {
    if (!slugValid) return
    setSubmitting(true)
    try {
      await onConfirm({
        sourceSlug,
        targetSlug,
        displayName: displayName.trim() || undefined,
      })
      onOpenChange(false)
    } catch (error) {
      setServerError(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fork {sourceName}</DialogTitle>
          <DialogDescription>
            Fork creates an editable copy under your skills directory. The copy inherits the body but not
            the curated trust level — it will be tagged as custom and{" "}
            <span className="font-medium">forkedFrom: {sourceSlug}@{sourceVersion}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="fork-slug">Slug</Label>
            <Input
              id="fork-slug"
              value={targetSlug}
              onChange={(e) => setTargetSlug(e.target.value)}
              autoFocus
            />
            {!slugValid ? (
              <p className="text-xs text-red-600">
                Slug must be lowercase letters, numbers, and dashes only (e.g. my-plan).
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fork-display-name">Display name</Label>
            <Input
              id="fork-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          {serverError ? <p className="text-xs text-red-600">{serverError}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!slugValid || submitting}>
            {submitting ? "Creating…" : "Create fork"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
