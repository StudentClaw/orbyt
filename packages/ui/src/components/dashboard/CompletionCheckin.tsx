import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

export interface CheckinResult {
  readonly status: "completed" | "skipped" | "partial"
  readonly note?: string
}

interface CompletionCheckinProps {
  readonly sessionTitle: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onComplete: (result: CheckinResult) => void
}

export function CompletionCheckin({
  sessionTitle,
  open,
  onOpenChange,
  onComplete,
}: CompletionCheckinProps) {
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState("")

  function handleYes() {
    onComplete({ status: "completed" })
    resetState()
  }

  function handleNo() {
    onComplete({ status: "skipped" })
    resetState()
  }

  function handlePartialSubmit() {
    onComplete({ status: "partial", note })
    resetState()
  }

  function resetState() {
    setShowNote(false)
    setNote("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="checkin-dialog">
        <DialogHeader>
          <DialogTitle data-testid="checkin-title">Session Check-in</DialogTitle>
          <DialogDescription>
            Did you complete <strong>{sessionTitle}</strong>?
          </DialogDescription>
        </DialogHeader>

        {!showNote ? (
          <div className="flex gap-2" data-testid="checkin-actions">
            <Button
              variant="default"
              data-testid="checkin-yes"
              onClick={handleYes}
            >
              Yes
            </Button>
            <Button
              variant="outline"
              data-testid="checkin-no"
              onClick={handleNo}
            >
              No
            </Button>
            <Button
              variant="outline"
              data-testid="checkin-partial"
              onClick={() => setShowNote(true)}
            >
              Yes, but...
            </Button>
          </div>
        ) : (
          <div className="space-y-3" data-testid="checkin-note-form">
            <Textarea
              placeholder="What happened?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-testid="checkin-note-input"
            />
            <Button
              data-testid="checkin-note-submit"
              onClick={handlePartialSubmit}
            >
              Submit
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
