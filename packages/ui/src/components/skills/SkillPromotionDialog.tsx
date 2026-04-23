import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"

export const CAPABILITY_DESCRIPTIONS: Record<string, string> = {
  "canvas.shared.read": "Read public Canvas data (announcements, modules, syllabus) for your courses.",
  "canvas.self.read": "Read your Canvas data (assignments, grades, submissions).",
  "canvas.files.download": "Download Canvas files locally for offline use.",
  "canvas.student.write": "Submit assignments and post replies on your behalf.",
  "calendar.events.read": "See events on your local calendars.",
  "calendar.events.write": "Create, update, or delete events on your calendars.",
  "calendar.calendars.read": "See the list of calendars you have.",
  "calendar.calendars.write": "Create new calendars.",
}

const HIGH_RISK_CAPABILITIES = new Set([
  "calendar.events.write",
  "calendar.calendars.write",
  "canvas.student.write",
  "canvas.files.download",
])

export type SkillForPromotion = {
  readonly id: string
  readonly name: string
  readonly tier: "curated" | "custom"
  readonly requestedCapabilities: readonly string[]
  readonly grantedCapabilities: readonly string[]
}

interface SkillPromotionDialogProps {
  readonly open: boolean
  readonly skill: SkillForPromotion
  readonly onGrant: (input: { skillId: string; capabilityKey: string }) => Promise<void>
  readonly onRevoke: (input: { skillId: string; capabilityKey: string }) => Promise<void>
  readonly onOpenChange: (open: boolean) => void
  /**
   * When true, the current thread has Full Access enabled so every requested
   * capability is effectively granted regardless of per-skill grants. The
   * dialog shows a banner, renders all toggles as on, and disables editing
   * (returning to Default Permissions is how the user regains fine-grained
   * control).
   */
  readonly fullAccess?: boolean
}

export function SkillPromotionDialog({
  open,
  skill,
  onGrant,
  onRevoke,
  onOpenChange,
  fullAccess = false,
}: SkillPromotionDialogProps) {
  const [ackHighRisk, setAckHighRisk] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const anyHighRisk = useMemo(
    () => skill.requestedCapabilities.some((k) => HIGH_RISK_CAPABILITIES.has(k)),
    [skill.requestedCapabilities],
  )

  const granted = useMemo(() => new Set(skill.grantedCapabilities), [skill.grantedCapabilities])

  const toggle = async (capabilityKey: string) => {
    const isHighRisk = HIGH_RISK_CAPABILITIES.has(capabilityKey)
    const isGranted = granted.has(capabilityKey)
    if (isHighRisk && !isGranted && !ackHighRisk) return
    setPendingKey(capabilityKey)
    setError(null)
    try {
      if (isGranted) {
        await onRevoke({ skillId: skill.id, capabilityKey })
      } else {
        await onGrant({ skillId: skill.id, capabilityKey })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Permissions for {skill.name}</DialogTitle>
          <DialogDescription>
            Grants are persisted locally. Revoke any time. Curated skills may auto-allow low-risk reads.
          </DialogDescription>
        </DialogHeader>

        {fullAccess ? (
          <div
            role="alert"
            className="rounded-md border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
          >
            <p className="font-medium">Full Access is on for this chat</p>
            <p className="mt-1">
              Every requested capability is granted while this chat is in Full Access. Switch back to
              Default Permissions from the composer to manage individual capabilities.
            </p>
          </div>
        ) : anyHighRisk ? (
          <div
            role="alert"
            className="rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          >
            <p className="font-medium">High-risk capabilities detected</p>
            <p className="mt-1">
              This skill can write to your calendar or Canvas account. Grant only if you trust the skill body.
            </p>
            <label className="mt-2 flex items-center gap-2">
              <Checkbox
                checked={ackHighRisk}
                onCheckedChange={(v) => setAckHighRisk(v === true)}
                aria-label="I understand the risks"
              />
              <span>I understand the risks and want to proceed.</span>
            </label>
          </div>
        ) : null}

        <div className="space-y-3 py-2">
          {skill.requestedCapabilities.map((key) => {
            const description = CAPABILITY_DESCRIPTIONS[key] ?? key
            const isGranted = granted.has(key)
            const highRisk = HIGH_RISK_CAPABILITIES.has(key)
            const effectivelyGranted = fullAccess || isGranted
            const disabled =
              fullAccess || pendingKey === key || (highRisk && !isGranted && !ackHighRisk)
            return (
              <div
                key={key}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{key}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch
                  checked={effectivelyGranted}
                  disabled={disabled}
                  onCheckedChange={() => {
                    if (fullAccess) return
                    void toggle(key)
                  }}
                />
              </div>
            )
          })}
        </div>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
