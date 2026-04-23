import { useState } from "react"
import type { OnboardingStepProps } from "./OnboardingWizard"
import { setCanvasTokenValidated } from "@/rpc/onboardingState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type ValidationStatus = "idle" | "valid" | "invalid"

const MIN_TOKEN_LENGTH = 20

function validateCanvasUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === "https:" && parsed.hostname.length > 0
  } catch {
    return false
  }
}

function validateCanvasToken(token: string): boolean {
  return token.trim().length >= MIN_TOKEN_LENGTH
}

export function CanvasCredentialStep({ onNext: _onNext }: OnboardingStepProps) {
  const [url, setUrl] = useState("")
  const [token, setToken] = useState("")
  const [status, setStatus] = useState<ValidationStatus>("idle")

  const handleValidate = () => {
    const urlValid = validateCanvasUrl(url)
    const tokenValid = validateCanvasToken(token)

    if (urlValid && tokenValid) {
      setStatus("valid")
      setCanvasTokenValidated(true)
    } else {
      setStatus("invalid")
      setCanvasTokenValidated(false)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2" data-testid="canvas-step">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to find your Canvas token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-inside list-decimal space-y-2">
            <li>Log in to your Canvas LMS</li>
            <li>Go to Account &gt; Settings</li>
            <li>Scroll to "Approved Integrations"</li>
            <li>Click "+ New Access Token"</li>
            <li>Enter "Orbyt" as the purpose</li>
            <li>Copy the generated token</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connect Canvas</CardTitle>
          <CardDescription>
            Enter your institution URL and access token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="canvas-url">Institution URL</Label>
            <Input
              id="canvas-url"
              type="url"
              placeholder="https://myschool.instructure.com"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setStatus("idle")
              }}
              data-testid="canvas-url-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="canvas-token">Access Token</Label>
            <Textarea
              id="canvas-token"
              placeholder="Paste your Canvas access token here"
              value={token}
              onChange={(e) => {
                setToken(e.target.value)
                setStatus("idle")
              }}
              rows={3}
              data-testid="canvas-token-input"
            />
          </div>
          <Button
            onClick={handleValidate}
            data-testid="canvas-validate-btn"
          >
            Validate
          </Button>
          {status !== "idle" && (
            <p
              className={`text-sm ${status === "valid" ? "text-green-500" : "text-destructive"}`}
              data-testid="canvas-validation-status"
            >
              {status === "valid"
                ? "Credentials validated successfully"
                : "Invalid URL or token. URL must be a valid HTTPS Canvas URL and token must be at least 20 characters."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
