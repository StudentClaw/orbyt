import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { ChatStatus } from "@/hooks/chat-model"

interface ErrorBannerProps {
  readonly status: ChatStatus
  readonly error: string | null
  readonly onRetry?: () => void
  readonly onReauth?: () => void
}

export function ErrorBanner({ status, error, onRetry, onReauth }: ErrorBannerProps) {
  if (status === "preparing" || status === "idle" || status === "streaming" || status === "interrupted") {
    return null
  }

  if (status === "offline") {
    return (
      <Alert>
        <AlertTitle>Orbyt is offline</AlertTitle>
        <AlertDescription>
          Connect to the local server before sending another message.
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
