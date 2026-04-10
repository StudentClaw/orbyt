import { useState } from "react"
import type { OnboardingStepProps } from "./OnboardingWizard"
import { setAiAuthStatus } from "@/rpc/onboardingState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type AuthPhase = "pending" | "connecting" | "connected" | "skipped"

export function AiAuthStep({ onNext }: OnboardingStepProps) {
  const [phase, setPhase] = useState<AuthPhase>("pending")

  const handleConnect = () => {
    setPhase("connecting")
    // Simulate OAuth flow — in production this triggers a real OAuth redirect
    setTimeout(() => {
      setPhase("connected")
      setAiAuthStatus("connected")
    }, 1500)
  }

  const handleSkip = () => {
    setPhase("skipped")
    setAiAuthStatus("skipped")
    onNext()
  }

  const statusColors: Record<AuthPhase, string> = {
    pending: "text-muted-foreground",
    connecting: "text-yellow-500",
    connected: "text-green-500",
    skipped: "text-orange-500",
  }

  const statusLabels: Record<AuthPhase, string> = {
    pending: "Not connected",
    connecting: "Connecting...",
    connected: "Connected",
    skipped: "Skipped",
  }

  return (
    <Card data-testid="ai-auth-step">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">Connect AI Assistant</CardTitle>
        <CardDescription>
          Connect your ChatGPT account to enable AI-powered study assistance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-center">
        <div
          className={`text-sm font-medium ${statusColors[phase]}`}
          data-testid="ai-auth-status"
        >
          {statusLabels[phase]}
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={handleConnect}
            disabled={phase === "connecting" || phase === "connected"}
            data-testid="ai-auth-connect-btn"
          >
            {phase === "connecting" ? "Connecting..." : "Connect ChatGPT"}
          </Button>

          <button
            type="button"
            className="text-sm text-muted-foreground underline hover:text-foreground"
            onClick={handleSkip}
            data-testid="ai-auth-skip"
          >
            Skip for now (AI features will be limited)
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
