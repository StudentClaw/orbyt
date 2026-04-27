import { useState } from "react"
import { Button } from "@/components/ui/button"
import { connectCodexAccount } from "@/lib/codexAuth"

type ConnectPhase = "idle" | "connecting" | "connected" | "error"

interface ChatProviderDisconnectedProps {
  readonly onConnected?: () => void
}

export function ChatProviderDisconnected({ onConnected }: ChatProviderDisconnectedProps) {
  const [phase, setPhase] = useState<ConnectPhase>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleConnect = async () => {
    setPhase("connecting")
    setErrorMessage(null)

    const result = await connectCodexAccount()

    if (result.status === "connected") {
      setPhase("connected")
      onConnected?.()
    } else {
      setPhase("error")
      setErrorMessage(result.error ?? "Connection failed. Please try again.")
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center" data-testid="chat-provider-disconnected">
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-semibold">Connect AI Assistant</h2>
        <p className="text-sm text-muted-foreground">
          Sign in with your ChatGPT account to use the AI chat.
        </p>
      </div>

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
        data-testid="chat-provider-status"
      >
        {phase === "idle" && "Not connected"}
        {phase === "connecting" && "Connecting..."}
        {phase === "connected" && "Connected"}
        {phase === "error" && "Connection failed"}
      </div>

      {phase === "connecting" && (
        <p className="max-w-xs text-xs text-muted-foreground">
          A browser window will open for ChatGPT sign-in.
          This may take a moment — please don't close the app.
        </p>
      )}

      {errorMessage && (
        <p className="max-w-xs text-xs text-destructive" data-testid="chat-provider-error">
          {errorMessage}
        </p>
      )}

      <Button
        onClick={() => void handleConnect()}
        disabled={phase === "connecting" || phase === "connected"}
        data-testid="chat-provider-connect-btn"
      >
        {phase === "connecting"
          ? "Waiting for sign-in..."
          : phase === "connected"
            ? "Connected"
            : phase === "error"
              ? "Try again"
              : "Connect ChatGPT"}
      </Button>
    </div>
  )
}
