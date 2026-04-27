import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ONBOARDING_STEPS, goToOnboardingStep, resetOnboardingWizardState, resetAllOnboardingState } from "@/rpc/onboardingState"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"
import { IpcChannel } from "@orbyt/contracts"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function DevOnboardingControls() {
  const navigate = useNavigate()
  const [isResetting, setIsResetting] = useState(false)

  const handleSoftReset = async () => {
    setIsResetting(true)
    try {
      await resetOnboardingWizardState(getPrimaryWsRpcClient())
    } finally {
      setIsResetting(false)
    }
    void navigate({ to: "/onboarding" })
  }

  const handleHardReset = async () => {
    setIsResetting(true)
    try {
      await resetAllOnboardingState(getPrimaryWsRpcClient())
      // Also disconnect OAuth and plugin credentials
      await Promise.allSettled([
        window.electronAPI?.invoke(IpcChannel.CODEX_AUTH_LOGOUT),
        window.electronAPI?.invoke(IpcChannel.PLUGIN_CLEAR_AUTH, { pluginId: "canvas-mcp" }),
      ])
    } finally {
      setIsResetting(false)
    }
    void navigate({ to: "/onboarding" })
  }

  const handleJumpToStep = (value: string) => {
    const index = parseInt(value, 10)
    if (isNaN(index)) return
    goToOnboardingStep(index)
    void navigate({ to: "/onboarding" })
  }

  return (
    <div
      className="mt-8 rounded-xl border border-dashed border-yellow-500/50 bg-yellow-500/5 p-4"
      data-testid="dev-onboarding-controls"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-yellow-600 dark:text-yellow-400">
        Developer — Onboarding
      </p>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={isResetting}
          onClick={handleSoftReset}
          data-testid="dev-reset-soft"
        >
          Reset Onboarding Flow
        </Button>
        <p className="self-center text-xs text-muted-foreground">
          Clears wizard state · keeps Canvas token & AI auth
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={isResetting}
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              data-testid="dev-reset-hard"
            >
              Reset All Onboarding
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset everything?</AlertDialogTitle>
              <AlertDialogDescription>
                This clears all onboarding state including your Canvas token and AI auth.
                You will need to re-enter credentials.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleHardReset}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Reset everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p className="self-center text-xs text-muted-foreground">
          Also clears Canvas token & AI auth
        </p>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs text-muted-foreground">Jump to step:</p>
        <Select onValueChange={handleJumpToStep}>
          <SelectTrigger className="w-56" data-testid="dev-jump-step-select">
            <SelectValue placeholder="Select a step..." />
          </SelectTrigger>
          <SelectContent>
            {ONBOARDING_STEPS.map((step, index) => (
              <SelectItem key={step.id} value={String(index)}>
                {index + 1}. {step.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
