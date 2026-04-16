import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    <Card data-testid="chat-provider-disconnected">
      <CardHeader className="text-center">
        <CardTitle className="text-lg">Connect AI Assistant</CardTitle>
        <CardDescription>
          Sign in with your ChatGPT account to use the AI chat.
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
          data-testid="chat-provider-status"
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
          <p className="text-xs text-destructive" data-testid="chat-provider-error">
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
      </CardContent>
    </Card>
  )
}
