import { useState } from "react"
import type { OnboardingStepProps } from "./OnboardingWizard"
import { setAiAuthStatus } from "@/rpc/onboardingState"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"
import { connectCodexAccount } from "@/lib/codexAuth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type AuthPhase = "idle" | "connecting" | "connected" | "error"

export function AiAuthStep({ onNext }: OnboardingStepProps) {
  const [phase, setPhase] = useState<AuthPhase>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleConnect = async () => {
    setPhase("connecting")
    setErrorMessage(null)

    const result = await connectCodexAccount()

    if (result.status === "connected") {
      setPhase("connected")
    } else {
      setPhase("error")
      setErrorMessage(result.error ?? "Connection failed. Please try again.")
    }
  }

  const handleSkip = () => {
    setAiAuthStatus("skipped")
    void getPrimaryWsRpcClient().onboarding
      .setAiAuth({ status: "skipped" })
      .catch(() => undefined)
    onNext()
  }

  return (
    <Card data-testid="ai-auth-step">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">Connect AI Assistant</CardTitle>
        <CardDescription>
          Sign in with your ChatGPT account to enable AI-powered study assistance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-center">
        <div
          className={`text-sm font-medium ${
            phase === "connected"
              ? "text-green-500"
              : phase === "error"
                ? "text-destructive"
                : phase === "connecting"
                  ? "text-yellow-500"
                  : "text-muted-foreground"
          }`}
          data-testid="ai-auth-status"
        >
          {phase === "idle" && "Not connected"}
          {phase === "connecting" && "Connecting..."}
          {phase === "connected" && "Connected"}
          {phase === "error" && "Connection failed"}
        </div>

        {phase === "connecting" && (
          <p className="text-xs text-muted-foreground">
            A browser window will open for ChatGPT sign-in.
            This may take a moment — please don't close the app.
          </p>
        )}

        {errorMessage && (
          <p className="text-xs text-destructive" data-testid="ai-auth-error">
            {errorMessage}
          </p>
        )}

        <Button
          onClick={handleConnect}
          disabled={phase === "connecting" || phase === "connected"}
          data-testid="ai-auth-connect-btn"
        >
          {phase === "connecting"
            ? "Waiting for sign-in..."
            : phase === "connected"
              ? "Connected"
              : phase === "error"
                ? "Try again"
                : "Connect ChatGPT"}
        </Button>

        {phase !== "connected" && (
          <button
            type="button"
            onClick={handleSkip}
            className="block w-full text-xs text-muted-foreground underline-offset-2 hover:underline"
            data-testid="ai-auth-skip"
          >
            Skip for now
          </button>
        )}
      </CardContent>
    </Card>
  )
}
