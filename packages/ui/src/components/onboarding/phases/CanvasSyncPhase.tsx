import { useCallback, useEffect, useState } from "react"
import type { StudentDna } from "@orbyt/contracts"
import { IpcChannel } from "@orbyt/contracts"
import { DNA_TOKENS, MONO, SERIF } from "../dna/tokens"
import { PhaseFooter } from "./PhaseFooter"

interface CanvasSyncPhaseProps {
  dna: StudentDna
  onVerify: () => Promise<boolean>
  onSyncBackground: () => void
  onContinue: () => void
  onBack?: () => void
}

const CANVAS_PLUGIN_ID = "canvas-mcp"

type CredentialStage =
  | "loading"
  | "needs_credentials"
  | "saving"
  | "verifying"
  | "verified"
  | "error"

function isValidCanvasBaseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname.length > 0
  } catch {
    return false
  }
}

export function CanvasSyncPhase({ dna, onVerify, onSyncBackground, onContinue, onBack }: CanvasSyncPhaseProps) {
  const T = DNA_TOKENS
  const [stage, setStage] = useState<CredentialStage>("loading")
  const [baseUrl, setBaseUrl] = useState("")
  const [token, setToken] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ baseUrl?: string; token?: string }>({})

  const bridgeAvailable = typeof window !== "undefined" && !!window.electronAPI?.invoke

  const runVerify = useCallback(async (): Promise<void> => {
    setStage("verifying")
    setError(null)
    try {
      const hasData = await onVerify()
      if (hasData) {
        setStage("verified")
      } else {
        setStage("error")
        setError("No courses found. Check your token permissions and try again.")
      }
    } catch {
      setStage("error")
      setError("Could not connect to Canvas. Check your URL and token.")
    }
  }, [onVerify])

  useEffect(() => {
    let cancelled = false
    if (!bridgeAvailable) {
      setStage("needs_credentials")
      return
    }
    void (async () => {
      try {
        const res = await window.electronAPI!.invoke(IpcChannel.PLUGIN_GET_AUTH_STATUS, { pluginId: CANVAS_PLUGIN_ID })
        if (cancelled) return
        const status = (res as { status?: string } | null)?.status
        if (status === "configured") {
          void runVerify()
        } else {
          setStage("needs_credentials")
        }
      } catch {
        if (!cancelled) setStage("needs_credentials")
      }
    })()
    return () => { cancelled = true }
  }, [bridgeAvailable, runVerify])

  const validateAndSave = async (): Promise<void> => {
    const trimmedUrl = baseUrl.trim()
    const trimmedToken = token.trim()
    const errs: { baseUrl?: string; token?: string } = {}
    if (!trimmedUrl) errs.baseUrl = "Canvas base URL is required."
    else if (!isValidCanvasBaseUrl(trimmedUrl)) errs.baseUrl = "Enter a valid HTTPS Canvas URL."
    if (!trimmedToken) errs.token = "Canvas access token is required."
    else if (trimmedToken.length < 16) errs.token = "Enter at least 16 characters."
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    if (!bridgeAvailable) {
      setError("Desktop bridge unavailable for plugin credentials.")
      setStage("error")
      return
    }

    setStage("saving")
    setError(null)
    try {
      const result = await window.electronAPI!.invoke(IpcChannel.PLUGIN_SAVE_AUTH, {
        pluginId: CANVAS_PLUGIN_ID,
        values: { baseUrl: trimmedUrl, token: trimmedToken },
      })
      if (!result?.ok) {
        setError(result?.error ?? "Could not save Canvas credentials.")
        setFieldErrors(result?.fieldErrors ?? {})
        setStage("needs_credentials")
        return
      }
      await runVerify()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStage("needs_credentials")
    }
  }

  const handleContinue = (): void => {
    if (stage === "verified") onSyncBackground()
    onContinue()
  }

  const showForm = stage === "needs_credentials" || stage === "saving"

  return (
    <div style={{ padding: "32px 52px 32px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", overflow: "auto" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.15em", color: T.textDim, textTransform: "uppercase", fontFamily: MONO, marginBottom: 14 }}>
        Phase 04 · Coursework
      </div>
      <h1 style={{ fontFamily: SERIF, fontSize: 58, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 14px", fontWeight: 400 }}>
        Pull in your <em style={{ fontStyle: "italic" }}>universe</em>.
      </h1>
      <p style={{ fontSize: 15, color: T.textDim, lineHeight: 1.58, marginBottom: 22, maxWidth: 480 }}>
        Link Canvas to import every assignment, deadline, and syllabus — no copy-pasting, no missed dates.
      </p>

      {showForm && (
        <CanvasCredsForm
          dna={dna}
          baseUrl={baseUrl}
          token={token}
          fieldErrors={fieldErrors}
          error={error}
          submitting={stage === "saving"}
          onChangeBaseUrl={setBaseUrl}
          onChangeToken={setToken}
          onSubmit={validateAndSave}
        />
      )}

      {!showForm && (
        <CanvasStatusCard
          dna={dna}
          stage={stage}
          error={error}
          onRetry={runVerify}
          onReconfigure={() => {
            setStage("needs_credentials")
            setError(null)
          }}
        />
      )}

      <PhaseFooter
        dna={dna}
        onBack={onBack}
        onContinue={handleContinue}
        continueLabel={stage === "verified" ? "Continue →" : "Skip →"}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function CanvasCredsForm({
  dna,
  baseUrl,
  token,
  fieldErrors,
  error,
  submitting,
  onChangeBaseUrl,
  onChangeToken,
  onSubmit,
}: {
  dna: StudentDna
  baseUrl: string
  token: string
  fieldErrors: { baseUrl?: string; token?: string }
  error: string | null
  submitting: boolean
  onChangeBaseUrl: (v: string) => void
  onChangeToken: (v: string) => void
  onSubmit: () => void
}) {
  const T = DNA_TOKENS
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
      style={{
        borderRadius: 16,
        border: `1px solid ${T.lineStrong}`,
        background: "rgba(255,255,255,0.03)",
        padding: 20,
        marginBottom: 22,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ fontSize: 13, color: T.textDim, lineHeight: 1.5 }}>
        Generate a Canvas access token in Canvas under{" "}
        <span style={{ color: T.text }}>Settings → Approved Integrations → New Access Token.</span>
      </div>

      <CredField
        label="Canvas base URL"
        type="url"
        value={baseUrl}
        placeholder="https://myschool.instructure.com"
        error={fieldErrors.baseUrl}
        onChange={onChangeBaseUrl}
        dnaHue={dna.hue}
        autoFocus
      />
      <CredField
        label="Canvas access token"
        type="password"
        value={token}
        placeholder="Paste your Canvas access token"
        error={fieldErrors.token}
        onChange={onChangeToken}
        dnaHue={dna.hue}
      />

      {error && (
        <div style={{ fontSize: 12, color: "#F87171" }}>{error}</div>
      )}

      <button
        type="submit"
        disabled={submitting}
        data-testid="onboarding-canvas-save"
        style={{
          alignSelf: "flex-start",
          padding: "10px 22px",
          borderRadius: 999,
          border: "none",
          background: `linear-gradient(135deg, ${T.blue}, ${T.purpleDeep})`,
          color: "white",
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: submitting ? "wait" : "pointer",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "Saving…" : "Save credentials →"}
      </button>
    </form>
  )
}

function CredField({
  label,
  type,
  value,
  placeholder,
  error,
  onChange,
  dnaHue,
  autoFocus,
}: {
  label: string
  type: "url" | "password"
  value: string
  placeholder: string
  error?: string
  onChange: (v: string) => void
  dnaHue: number
  autoFocus?: boolean
}) {
  const T = DNA_TOKENS
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: T.textDim, fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${error ? "#F87171" : value.trim() ? `oklch(0.7 0.2 ${dnaHue}/0.5)` : T.lineStrong}`,
          borderRadius: 10,
          color: T.text,
          fontSize: 15,
          fontFamily: "inherit",
          padding: "10px 12px",
          outline: "none",
        }}
      />
      {error && <span style={{ fontSize: 11, color: "#F87171" }}>{error}</span>}
    </label>
  )
}

function CanvasStatusCard({
  dna,
  stage,
  error,
  onRetry,
  onReconfigure,
}: {
  dna: StudentDna
  stage: CredentialStage
  error: string | null
  onRetry: () => void
  onReconfigure: () => void
}) {
  const T = DNA_TOKENS
  const isVerified = stage === "verified"
  const isSpinning = stage === "loading" || stage === "verifying"

  return (
    <div
      style={{
        borderRadius: 16,
        padding: 18,
        border: `1px solid ${isVerified ? `oklch(0.6 0.2 ${dna.hue}/0.6)` : T.lineStrong}`,
        background: isVerified
          ? `linear-gradient(135deg, oklch(0.22 0.1 ${dna.hue}/0.5), oklch(0.18 0.08 ${dna.accentHue}/0.3))`
          : "rgba(255,255,255,0.03)",
        marginBottom: 22,
        transition: "all 0.4s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: isVerified
            ? `radial-gradient(circle at 35% 30%, oklch(0.9 0.15 ${dna.hue}), oklch(0.5 0.2 ${dna.hue}))`
            : "#E03E2F",
          display: "grid",
          placeItems: "center",
          color: "white",
          fontWeight: 800,
          fontSize: 13,
          flexShrink: 0,
          boxShadow: isVerified ? `0 0 24px oklch(0.6 0.22 ${dna.hue}/0.5)` : "none",
          transition: "all 0.4s",
        }}>
          {isSpinning && (
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 0.8s linear infinite" }} />
          )}
          {isVerified && <span style={{ fontSize: 22 }}>✓</span>}
          {stage === "error" && <span style={{ fontSize: 18 }}>LMS</span>}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Canvas</div>
          <div style={{ fontSize: 12, color: stage === "error" ? "#F87171" : T.textDim }}>
            {stage === "loading" && "Checking saved credentials…"}
            {stage === "verifying" && "Verifying your Canvas access…"}
            {stage === "verified" && "Canvas connected — courses are loading in the background"}
            {stage === "error" && (error ?? "Could not verify Canvas access.")}
          </div>
        </div>

        {stage === "error" && (
          <button
            onClick={onRetry}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "none",
              background: `linear-gradient(135deg, ${T.blue}, ${T.purpleDeep})`,
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Retry →
          </button>
        )}
      </div>

      {stage === "error" && (
        <button
          onClick={onReconfigure}
          style={{ marginTop: 10, background: "transparent", border: "none", color: T.textFaint, fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
        >
          Use different credentials
        </button>
      )}
    </div>
  )
}
