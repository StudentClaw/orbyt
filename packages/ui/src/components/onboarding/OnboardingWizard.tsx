import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import type { OnboardingAnswers, StudentDna } from "@orbyt/contracts"
import { buildStudyDna } from "@orbyt/shared"
import {
  ONBOARDING_STEPS,
  advanceOnboardingStep,
  classifyDnaThroughServer,
  completeOnboarding,
  goToOnboardingStep,
  persistOnboardingState,
  setAiAuthStatus,
  setAnswers,
  setDna,
  useOnboardingState,
} from "@/rpc/onboardingState"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"
import { DnaDiscoveryPhase } from "./phases/DnaDiscoveryPhase"
import { CinematicReveal } from "./dna/CinematicReveal"
import { ActiveHoursPhase } from "./phases/ActiveHoursPhase"
import { BusyGridPhase } from "./phases/BusyGridPhase"
import { AiConnectPhase } from "./phases/AiConnectPhase"
import { CanvasSyncPhase } from "./phases/CanvasSyncPhase"
import { LaunchPhase } from "./phases/LaunchPhase"
import { MysteryNebula } from "./dna/MysteryNebula"
import { DNACard } from "./dna/DNACard"
import { DNA_TOKENS, MONO } from "./dna/tokens"

type WizardPhase =
  | "dna-discovery"
  | "cinematic-reveal"
  | "active-hours"
  | "busy-grid"
  | "ai-connect"
  | "canvas-sync"
  | "launch"

export function OnboardingWizard() {
  const state = useOnboardingState()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<WizardPhase>(() => {
    const stepDef = ONBOARDING_STEPS[state.currentStep]
    return (stepDef?.id as WizardPhase) ?? "dna-discovery"
  })
  const [burstKey, setBurstKey] = useState(0)
  const aiConnectInFlight = useRef(false)

  const liveAnswers = state.answers
  const liveDna: StudentDna = useMemo(
    () => state.dna ?? buildStudyDna(liveAnswers),
    [state.dna, liveAnswers],
  )

  useEffect(() => {
    persistOnboardingState()
  }, [state])

  const advanceAndGo = (next: WizardPhase): void => {
    advanceOnboardingStep()
    setPhase(next)
  }

  const POST_PHASE_ORDER: ReadonlyArray<WizardPhase> = ["active-hours", "busy-grid", "ai-connect", "canvas-sync", "launch"]
  const goBack = (): void => {
    const idx = POST_PHASE_ORDER.indexOf(phase)
    if (idx > 0) {
      const prev = POST_PHASE_ORDER[idx - 1]!
      setPhase(prev)
      const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === prev)
      if (stepIndex >= 0) goToOnboardingStep(stepIndex)
    }
  }

  const handleAnswersComplete = async (final: OnboardingAnswers): Promise<void> => {
    setAnswers(final)
    setPhase("cinematic-reveal")
    const rpc = getPrimaryWsRpcClient()
    void rpc.onboarding.setAnswers({ answers: final }).catch(() => undefined)
    const dna = await classifyDnaThroughServer(final)
    if (dna) setDna(dna)
  }

  const handleRevealContinue = (): void => {
    advanceAndGo("active-hours")
  }

  const handleHoursSave = ({ startHour, endHour }: { startHour: number; endHour: number }): void => {
    const studyTimes = Array.from({ length: endHour - startHour }, (_, i) =>
      `${String(startHour + i).padStart(2, "0")}:00`,
    )
    void getPrimaryWsRpcClient().onboarding.setPreferences({ studyTimes }).catch(() => undefined)
    advanceAndGo("busy-grid")
  }

  const handleBusySave = (cells: Array<{ dayOfWeek: number; hourOfDay: number }>): void => {
    void getPrimaryWsRpcClient().onboarding.setRoutines({ cells }).catch(() => undefined)
    advanceAndGo("ai-connect")
  }

  const handleAiConnect = async (): Promise<void> => {
    if (aiConnectInFlight.current) return
    const electronAPI = window.electronAPI
    if (!electronAPI?.codexAuthStart) {
      throw new Error("Desktop bridge unavailable. Please run Orbyt as a desktop app to sign in.")
    }

    aiConnectInFlight.current = true
    try {
      const result = await electronAPI.codexAuthStart()
      if (result.status !== "connected") {
        throw new Error(result.error ?? "Sign-in did not complete.")
      }

      setAiAuthStatus("connected")
      const client = getPrimaryWsRpcClient()
      // Best-effort: OAuth itself succeeded, so don't fail the user-visible flow
      // if persistence or runtime reload errors. The runtime reconnects on retry.
      await Promise.allSettled([
        client.onboarding.setAiAuth({ status: "connected", provider: "codex" }),
        client.provider.retryInitialize(),
      ])
    } finally {
      aiConnectInFlight.current = false
    }
  }

  const handleAiContinue = (status: "connected" | "skipped"): void => {
    setAiAuthStatus(status)
    void getPrimaryWsRpcClient().onboarding.setAiAuth({
      status,
      provider: status === "connected" ? "codex" : null,
    }).catch(() => undefined)
    advanceAndGo("canvas-sync")
  }

  const handleCanvasVerify = async (): Promise<boolean> => {
    try {
      const courses = await getPrimaryWsRpcClient().canvas.listCourses()
      return courses.length > 0
    } catch {
      return false
    }
  }

  const handleCanvasStartBackgroundSync = (): void => {
    void getPrimaryWsRpcClient().canvas.sync().catch(() => undefined)
  }

  const handleCanvasContinue = (): void => {
    advanceAndGo("launch")
  }

  const finishOnboarding = (tour: boolean): void => {
    completeOnboarding()
    persistOnboardingState()
    if (tour) {
      try { sessionStorage.setItem("orbyt:pending-tour", "1") } catch { /* ignore */ }
    }
    navigate({ to: "/" })
  }

  const left = (() => {
    switch (phase) {
      case "dna-discovery":
        return (
          <DnaDiscoveryPhase
            initialAnswers={liveAnswers}
            onAnswersChange={(a) => setAnswers(a)}
            onLiveDnaChange={(d) => setDna(d)}
            onComplete={handleAnswersComplete}
            onAnswerSubmitted={() => setBurstKey((k) => k + 1)}
          />
        )
      case "cinematic-reveal":
        return <CinematicReveal dna={liveDna} onContinue={handleRevealContinue} />
      case "active-hours":
        return <ActiveHoursPhase dna={liveDna} onSave={handleHoursSave} />
      case "busy-grid":
        return <BusyGridPhase dna={liveDna} onSave={handleBusySave} onBack={goBack} />
      case "ai-connect":
        return (
          <AiConnectPhase
            dna={liveDna}
            status={state.aiAuthStatus}
            onConnect={handleAiConnect}
            onContinue={handleAiContinue}
            onBack={goBack}
          />
        )
      case "canvas-sync":
        return (
          <CanvasSyncPhase
            dna={liveDna}
            onVerify={handleCanvasVerify}
            onSyncBackground={handleCanvasStartBackgroundSync}
            onContinue={handleCanvasContinue}
            onBack={goBack}
          />
        )
      case "launch":
        return (
          <LaunchPhase
            dna={liveDna}
            onTour={() => finishOnboarding(true)}
            onSkipTour={() => finishOnboarding(false)}
          />
        )
    }
  })()

  const showNebula = phase === "dna-discovery"
  const answeredCount = Object.keys(liveAnswers).length
  const phaseLabel = ONBOARDING_STEPS.find((s) => s.id === phase)?.label ?? "Study DNA"

  return (
    <div
      data-testid="onboarding-wizard"
      style={{
        width: "100%",
        height: "100vh",
        background: `radial-gradient(ellipse at 20% 50%, oklch(0.22 0.12 ${liveDna.hue}/0.38), transparent 60%), ${DNA_TOKENS.bg}`,
        color: DNA_TOKENS.text,
        display: "grid",
        gridTemplateColumns: phase === "cinematic-reveal" ? "1fr" : "1.15fr 1fr",
        overflow: "hidden",
        transition: "background 1s",
      }}
    >
      <div style={{ position: "relative", overflow: "hidden" }}>{left}</div>
      {phase !== "cinematic-reveal" && (
        <div style={{
          display: "grid",
          placeItems: "center",
          background: `linear-gradient(160deg, oklch(0.17 0.05 ${liveDna.hue}/0.58), oklch(0.12 0.03 ${liveDna.accentHue}/0.58))`,
          borderLeft: `1px solid ${DNA_TOKENS.line}`,
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ position: "relative", zIndex: 2 }}>
            {showNebula
              ? <MysteryNebula answered={answeredCount} total={11} hue={liveDna.hue} accentHue={liveDna.accentHue} burstKey={burstKey} />
              : <DNACard dna={liveDna} answeredCount={answeredCount} large showStats />}
          </div>
          <div style={{
            position: "absolute",
            bottom: 28,
            fontSize: 10,
            color: DNA_TOKENS.textFaint,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontFamily: MONO,
          }}>
            {phaseLabel}
          </div>
        </div>
      )}
    </div>
  )
}
