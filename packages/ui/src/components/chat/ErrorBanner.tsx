import { useState } from "react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { connectCodexAccount } from "@/lib/codexAuth"
import type { ChatStatus } from "@/hooks/chat-model"

interface ErrorBannerProps {
  readonly status: ChatStatus
  readonly error: string | null
  readonly onRetry?: () => void
  readonly onReauth?: () => void
}

export function ErrorBanner({ status, error, onRetry, onReauth }: ErrorBannerProps) {
  const [codexPhase, setCodexPhase] = useState<"idle" | "connecting" | "error">("idle")
  const [codexError, setCodexError] = useState<string | null>(null)

  const handleConnectCodex = async () => {
    setCodexPhase("connecting")
    setCodexError(null)
    const result = await connectCodexAccount()
    if (result.status === "connected") {
      setCodexPhase("idle")
    } else {
      setCodexPhase("error")
      setCodexError(result.error)
    }
  }

  if (status === "preparing" || status === "idle" || status === "streaming" || status === "interrupted") {
    return null
  }

  if (status === "offline") {
    return (
      <Alert>
        <AlertTitle>Orbyt is offline</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>Connect to the local server before sending another message.</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleConnectCodex()}
              disabled={codexPhase === "connecting"}
              data-testid="error-banner-connect-codex"
            >
              {codexPhase === "connecting" ? "Connecting..." : "Connect Codex"}
            </Button>
            {codexPhase === "error" && codexError && (
              <span className="text-xs text-destructive">{codexError}</span>
            )}
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (status === "rate-limited") {
    return (
      <Alert>
        <AlertTitle>Rate limit reached</AlertTitle>
        <AlertDescription>
          Please wait a few minutes before trying again.
        </AlertDescription>
      </Alert>
    )
  }

  if (status === "auth-expired") {
    return (
      <Alert variant="destructive">
        <AlertTitle>Session expired</AlertTitle>
        <AlertDescription className="flex items-center gap-2">
          <span>Your session has expired.</span>
          {onReauth && (
            <Button variant="outline" size="sm" onClick={onReauth}>
              Re-authenticate
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  if (status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription className="flex items-center gap-2">
          <span>{error ?? "An unexpected error occurred."}</span>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
