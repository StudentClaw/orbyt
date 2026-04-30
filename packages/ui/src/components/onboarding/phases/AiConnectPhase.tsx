import { useEffect, useState } from "react"
import type { StudentDna } from "@orbyt/contracts"
import { DNA_TOKENS, MONO, SERIF } from "../dna/tokens"
import { PhaseFooter } from "./PhaseFooter"
import { useRuntimeOrchestrationSnapshot } from "@/hooks/useAppRuntime"

interface AiConnectPhaseProps {
  dna: StudentDna
  onConnect: () => Promise<void>
  onContinue: (status: "connected" | "skipped") => void
  onBack?: () => void
}

export function AiConnectPhase({ dna, onConnect, onContinue, onBack }: AiConnectPhaseProps) {
  const T = DNA_TOKENS
  const snapshot = useRuntimeOrchestrationSnapshot()
  const authState = snapshot?.providerRuntime.authState ?? "unknown"
  const providerStatus = snapshot?.providerRuntime.status ?? "idle"
  const lastError = snapshot?.providerRuntime.lastError ?? null

  const [phase, setPhase] = useState<"idle" | "connecting" | "connected" | "error">(
    authState === "authenticated" ? "connected" : "idle",
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (authState === "authenticated") {
      setPhase("connected")
      setErrorMessage(null)
      return
    }
    if (authState === "auth_required" || authState === "expired") {
      if (phase === "connecting") {
        setPhase("error")
        setErrorMessage(lastError?.message ?? "Authentication did not complete.")
      } else if (phase === "connected") {
        setPhase("idle")
        setErrorMessage(null)
      }
      return
    }
    if (phase === "connecting" && (providerStatus === "offline" || providerStatus === "degraded")) {
      setPhase("error")
      setErrorMessage(lastError?.message ?? "Codex runtime is offline.")
    }
  }, [authState, providerStatus, lastError, phase])

  const handleConnect = async (): Promise<void> => {
    setPhase("connecting")
    setErrorMessage(null)
    try {
      await onConnect()
      setPhase("connected")
    } catch (err: unknown) {
      setPhase("error")
      setErrorMessage(err instanceof Error ? err.message : "Sign-in did not complete.")
    }
  }

  return (
    <div style={{ padding: "32px 52px 32px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.15em", color: T.textDim, textTransform: "uppercase", fontFamily: MONO, marginBottom: 14 }}>
        Phase 03 · AI Connection
      </div>
      <h1 style={{ fontFamily: SERIF, fontSize: 58, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 14px", fontWeight: 400 }}>
        Give <em style={{ fontStyle: "italic" }}>Orby</em> a brain.
      </h1>
      <p style={{ fontSize: 15, color: T.textDim, lineHeight: 1.58, marginBottom: 28, maxWidth: 480 }}>
        Connect Codex so Orby can explain concepts, draft study plans, and answer the 2 AM "wait, what?" questions.
      </p>

      <div style={{
        borderRadius: 16,
        padding: 18,
        border: `1px solid ${phase === "connected" ? `oklch(0.6 0.2 ${dna.hue}/0.6)` : T.lineStrong}`,
        background: phase === "connected"
          ? `linear-gradient(135deg, oklch(0.22 0.1 ${dna.hue}/0.5), oklch(0.18 0.08 ${dna.accentHue}/0.3))`
          : "rgba(255,255,255,0.03)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        marginBottom: 20,
        transition: "all 0.4s",
      }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          background: phase === "connected"
            ? `radial-gradient(circle at 35% 30%, oklch(0.9 0.15 ${dna.hue}), oklch(0.5 0.2 ${dna.hue}))`
            : "rgba(255,255,255,0.06)",
          boxShadow: phase === "connected" ? `0 0 24px oklch(0.6 0.22 ${dna.hue}/0.5)` : "none",
        }}>
          {phase === "connected" && <span style={{ color: "white", fontSize: 22 }}>✓</span>}
          {phase === "connecting" && (
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: T.blue, animation: "spin 0.8s linear infinite" }} />
          )}
          {phase === "error" && <span style={{ color: "#F87171", fontSize: 22 }}>!</span>}
          {phase === "idle" && <span style={{ color: T.textDim, fontSize: 22 }}>◎</span>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Codex (ChatGPT)</div>
          <div style={{ fontSize: 12, color: phase === "error" ? "#F87171" : T.textDim }}>
            {phase === "idle" && "Not connected"}
            {phase === "connecting" && "Opening browser window — finish sign-in there…"}
            {phase === "connected" && `Connected as ${dna.name.toLowerCase()}@orbyt`}
            {phase === "error" && (errorMessage ?? "Sign-in did not complete.")}
          </div>
        </div>
        {(phase === "idle" || phase === "error") && (
          <button
            onClick={handleConnect}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "none",
              background: `linear-gradient(135deg, ${T.blue}, ${T.purpleDeep})`,
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {phase === "error" ? "Retry →" : "Connect →"}
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
        {[
          "Chat with your notes, not just about them",
          "Auto-draft a study plan from your syllabus",
          "Private — we never see your conversations",
        ].map((b) => (
          <div key={b} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.textDim }}>
            <div style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: `oklch(0.3 0.15 ${dna.hue}/0.6)`,
              border: `1px solid oklch(0.6 0.2 ${dna.hue}/0.5)`,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              fontSize: 10,
              color: `oklch(0.85 0.2 ${dna.hue})`,
            }}>✓</div>
            {b}
          </div>
        ))}
      </div>

      <PhaseFooter
        dna={dna}
        onBack={onBack}
        onContinue={() => onContinue(phase === "connected" ? "connected" : "skipped")}
        continueLabel={phase === "connected" ? "Continue →" : "Continue without AI →"}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
