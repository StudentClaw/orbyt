import * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useBlocker } from "@tanstack/react-router"
import type { OnboardingAnswers, StudentDna } from "@orbyt/contracts"
import { buildStudyDna } from "@orbyt/shared"
import { waitForPrimaryWsRpcClient } from "@/rpc/appRuntime"
import { useWsConnectionStatus } from "@/rpc/wsConnectionState"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DNACard } from "@/components/onboarding/dna/DNACard"
import { MysteryNebula } from "@/components/onboarding/dna/MysteryNebula"
import { DnaDiscoveryPhase } from "@/components/onboarding/phases/DnaDiscoveryPhase"
import { CinematicReveal } from "@/components/onboarding/dna/CinematicReveal"
import { DNA_TOKENS, MONO } from "@/components/onboarding/dna/tokens"

type LoadState = "loading" | "ready" | "error"
type SaveState = "idle" | "saving" | "error"
type RetakePhase = "off" | "quiz" | "reveal"
type ConfirmState = "hidden" | "confirming"

interface Baseline {
  name: string
  startHour: number
  endHour: number
  cells: ReadonlyArray<string>
}

function setsMatch(a: Set<string>, b: ReadonlyArray<string>): boolean {
  if (a.size !== b.length) return false
  for (const k of b) if (!a.has(k)) return false
  return true
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const GRID_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
const SLIDER_MIN = 4
const SLIDER_MAX = 26
const SLIDER_LABEL_HOURS = [6, 9, 12, 15, 18, 21, 24]

const DEFAULT_HUE = 240
const DEFAULT_ACCENT_HUE = 280

function fmtSliderHour(h: number): string {
  const norm = h % 24
  const suffix = norm < 12 || norm === 0 ? "AM" : "PM"
  const display = norm === 0 ? 12 : norm > 12 ? norm - 12 : norm
  return `${display}:00 ${suffix}`
}

function fmtShort(h: number): string {
  return fmtSliderHour(h).split(" ")[0]!
}

function deriveActiveWindow(studyTimes: ReadonlyArray<string>): { startHour: number; endHour: number } {
  if (studyTimes.length === 0) return { startHour: 7, endHour: 23 }
  const hours = studyTimes
    .map((t) => Number(t.split(":")[0]))
    .filter((h) => Number.isFinite(h))
    .sort((a, b) => a - b)
  if (hours.length === 0) return { startHour: 7, endHour: 23 }
  return { startHour: hours[0]!, endHour: hours[hours.length - 1]! + 1 }
}

function buildStudyTimes(startHour: number, endHour: number): ReadonlyArray<string> {
  const span = Math.max(0, endHour - startHour)
  return Array.from({ length: span }, (_, i) => `${String(startHour + i).padStart(2, "0")}:00`)
}

export function StudyProfileSection() {
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [name, setName] = useState("")
  const [dna, setDnaState] = useState<StudentDna | null>(null)
  const [answers, setAnswersState] = useState<OnboardingAnswers | null>(null)
  const [startHour, setStartHour] = useState(7)
  const [endHour, setEndHour] = useState(23)
  const [cells, setCells] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState<"on" | "off" | null>(null)
  const [sliderDrag, setSliderDrag] = useState<"start" | "end" | null>(null)
  const [retake, setRetake] = useState<RetakePhase>("off")
  const [retakeDna, setRetakeDna] = useState<StudentDna | null>(null)
  const [baseline, setBaseline] = useState<Baseline | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const wsStatus = useWsConnectionStatus()

  const isDirty = useMemo(() => {
    if (!baseline) return false
    if (name !== baseline.name) return true
    if (startHour !== baseline.startHour) return true
    if (endHour !== baseline.endHour) return true
    if (!setsMatch(cells, baseline.cells)) return true
    return false
  }, [baseline, name, startHour, endHour, cells])

  const hue = dna?.hue ?? DEFAULT_HUE
  const accentHue = dna?.accentHue ?? DEFAULT_ACCENT_HUE

  useEffect(() => {
    let cancelled = false

    void waitForPrimaryWsRpcClient()
      .then((client) => Promise.all([
        client.onboarding.getDna(),
        client.onboarding.getPreferences(),
        client.onboarding.getRoutines(),
      ]))
      .then(([dnaResult, prefs, routines]) => {
        if (cancelled) return
        const loadedName = dnaResult.answers?.name ?? ""
        if (dnaResult.answers) {
          setAnswersState(dnaResult.answers)
          setName(loadedName)
        }
        setDnaState(dnaResult.dna)
        const window = deriveActiveWindow(prefs.studyTimes)
        setStartHour(window.startHour)
        setEndHour(window.endHour)
        const cellKeys = routines.cells.map((c) => `${c.dayOfWeek}-${c.hourOfDay}`)
        setCells(new Set(cellKeys))
        setBaseline({
          name: loadedName,
          startHour: window.startHour,
          endHour: window.endHour,
          cells: cellKeys,
        })
        setLoadState("ready")
      })
      .catch(() => {
        if (!cancelled) setLoadState("error")
      })

    return () => { cancelled = true }
  }, [])

  async function handleSave(): Promise<boolean> {
    if (!isDirty) return true
    setSaveState("saving")
    try {
      const client = await waitForPrimaryWsRpcClient()
      const ops: Array<Promise<unknown>> = []
      if (answers && answers.name !== name) {
        const nextAnswers: OnboardingAnswers = { ...answers, name }
        setAnswersState(nextAnswers)
        ops.push(client.onboarding.setAnswers({ answers: nextAnswers }))
      }
      if (!baseline || baseline.startHour !== startHour || baseline.endHour !== endHour) {
        ops.push(client.onboarding.setPreferences({ studyTimes: [...buildStudyTimes(startHour, endHour)] }))
      }
      if (!baseline || !setsMatch(cells, baseline.cells)) {
        const out = Array.from(cells).map((k) => {
          const [day, hour] = k.split("-").map(Number)
          return { dayOfWeek: day!, hourOfDay: hour! }
        })
        ops.push(client.onboarding.setRoutines({ cells: out }))
      }
      await Promise.all(ops)
      setBaseline({
        name,
        startHour,
        endHour,
        cells: Array.from(cells),
      })
      setSaveState("idle")
      return true
    } catch {
      setSaveState("error")
      return false
    }
  }

  function handleDiscard() {
    if (!baseline) return
    setName(baseline.name)
    setStartHour(baseline.startHour)
    setEndHour(baseline.endHour)
    setCells(new Set(baseline.cells))
    setSaveState("idle")
  }

  const pct = (h: number): number => ((h - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100

  const getHFromMouse = useCallback((clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return SLIDER_MIN
    const raw = ((clientX - rect.left) / rect.width) * (SLIDER_MAX - SLIDER_MIN) + SLIDER_MIN
    return Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, Math.round(raw)))
  }, [])

  const onSliderMove = useCallback((e: MouseEvent) => {
    if (!sliderDrag) return
    const h = getHFromMouse(e.clientX)
    if (sliderDrag === "start") {
      setStartHour(Math.min(h, endHour - 1))
    } else {
      setEndHour(Math.max(h, startHour + 1))
    }
  }, [sliderDrag, startHour, endHour, getHFromMouse])

  const onSliderUp = useCallback(() => {
    if (sliderDrag) setSliderDrag(null)
  }, [sliderDrag])

  useEffect(() => {
    window.addEventListener("mousemove", onSliderMove)
    window.addEventListener("mouseup", onSliderUp)
    return () => {
      window.removeEventListener("mousemove", onSliderMove)
      window.removeEventListener("mouseup", onSliderUp)
    }
  }, [onSliderMove, onSliderUp])

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  const blocker = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
  })

  function toggleCell(d: number, h: number) {
    setCells((prev) => {
      const next = new Set(prev)
      const key = `${d}-${h}`
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleRetakeComplete(final: OnboardingAnswers) {
    setAnswersState(final)
    try {
      const client = await waitForPrimaryWsRpcClient()
      await client.onboarding.setAnswers({ answers: final }).catch(() => undefined)
      const result = await client.onboarding.classifyDna({ answers: final })
      setDnaState(result.dna)
      setRetakeDna(result.dna)
      setRetake("reveal")
    } catch {
      setRetake("off")
    }
  }

  function startRetake() {
    setRetake("quiz")
  }

  function closeRetake() {
    setRetake("off")
    setRetakeDna(null)
  }

  if (loadState === "loading") {
    const isOffline = wsStatus.phase === "reconnecting" || wsStatus.phase === "disconnected"
    if (isOffline) {
      return (
        <div data-testid="study-profile-waiting" className="rounded-xl border border-border bg-muted/30 p-6">
          <p className="font-medium">
            {wsStatus.phase === "reconnecting" ? "Reconnecting to the local service…" : "Not connected to the local service."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your study profile will load as soon as the connection is restored.
          </p>
        </div>
      )
    }
    return (
      <div data-testid="study-profile-loading" className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (loadState === "error") {
    return (
      <div data-testid="study-profile-error" className="rounded-xl border border-destructive p-6 text-destructive">
        <p className="font-medium">Could not load your study profile.</p>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
      </div>
    )
  }

  const accentSurface = `linear-gradient(160deg, oklch(0.65 0.18 ${hue}/0.06), oklch(0.65 0.18 ${accentHue}/0.04))`
  const accentBorder = `oklch(0.6 0.18 ${hue}/0.18)`

  return (
    <div data-testid="study-profile-content" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Study Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your identity, study DNA, and rhythm. Save your changes when you're done.
        </p>
      </div>

      <Card
        data-testid="sp-dna-card"
        style={{ background: accentSurface, borderColor: accentBorder }}
      >
        <CardHeader>
          <CardTitle>Your Study DNA</CardTitle>
          <CardDescription>
            {dna
              ? <span data-testid="study-profile-archetype">{dna.trait} · {dna.rarity} · {dna.tagline}</span>
              : "Take the quiz to generate your archetype."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {dna ? (
            <DNACard dna={dna} answeredCount={11} large showStats />
          ) : (
            <p className="text-sm text-muted-foreground">No DNA yet — take the quiz to see your archetype.</p>
          )}
          <Button
            type="button"
            onClick={startRetake}
            data-testid="sp-retake-quiz"
          >
            {dna ? "Retake DNA quiz" : "Take DNA quiz"}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="sp-name-card">
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>The name Orby uses when nudging, planning, and celebrating wins.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-w-md">
            <Label htmlFor="sp-name">Name</Label>
            <Input
              id="sp-name"
              data-testid="sp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="sp-active-hours-card">
        <CardHeader>
          <CardTitle>Active Hours</CardTitle>
          <CardDescription>Drag the handles to mark when you're awake. Orby only schedules inside this window.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Day begins", value: fmtSliderHour(startHour), pillHue: hue },
              { label: "Day ends", value: fmtSliderHour(endHour), pillHue: accentHue },
            ].map((pill) => (
              <div
                key={pill.label}
                className="rounded-xl border px-4 py-3"
                style={{
                  background: `oklch(0.65 0.18 ${pill.pillHue}/0.07)`,
                  borderColor: `oklch(0.6 0.18 ${pill.pillHue}/0.25)`,
                }}
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground" style={{ fontFamily: MONO }}>
                  {pill.label}
                </div>
                <div className="mt-1 text-2xl" style={{ color: `oklch(0.55 0.18 ${pill.pillHue})` }}>
                  {pill.value}
                </div>
              </div>
            ))}
          </div>

          <div className="select-none">
            <div
              ref={trackRef}
              data-testid="sp-active-hours-track"
              className="relative h-2 cursor-pointer rounded-full bg-muted"
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  borderRadius: 9999,
                  left: `${pct(startHour)}%`,
                  width: `${pct(endHour) - pct(startHour)}%`,
                  background: `linear-gradient(90deg, oklch(0.6 0.22 ${hue}), oklch(0.65 0.2 ${accentHue}))`,
                  transition: sliderDrag ? "none" : "all 0.2s",
                }}
              />
              {([
                { which: "start" as const, val: startHour, handleHue: hue },
                { which: "end" as const, val: endHour, handleHue: accentHue },
              ]).map(({ which, val, handleHue }) => (
                <div
                  key={which}
                  data-testid={`sp-active-hours-handle-${which}`}
                  onMouseDown={(e) => { e.preventDefault(); setSliderDrag(which) }}
                  style={{
                    position: "absolute",
                    left: `${pct(val)}%`,
                    top: "50%",
                    transform: "translate(-50%,-50%)",
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 35% 30%, oklch(0.9 0.15 ${handleHue}), oklch(0.55 0.22 ${handleHue}))`,
                    boxShadow: `0 2px 8px oklch(0.5 0.18 ${handleHue}/0.5)`,
                    cursor: "ew-resize",
                    zIndex: 2,
                    transition: sliderDrag === which ? "none" : "left 0.2s",
                    border: "2px solid var(--background)",
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between">
              {SLIDER_LABEL_HOURS.map((h) => (
                <div key={h} className="min-w-[28px] text-center text-[10px] text-muted-foreground" style={{ fontFamily: MONO }}>
                  {fmtShort(h)}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground" style={{ fontFamily: MONO }}>
            Active window: {Math.max(0, endHour - startHour)} hours · {fmtSliderHour(startHour)} → {fmtSliderHour(endHour)}
          </p>
        </CardContent>
      </Card>

      <Card data-testid="sp-routines-card">
        <CardHeader>
          <CardTitle>Weekly Routines</CardTitle>
          <CardDescription>Tap or drag the hours claimed by classes, work, or anything else. Orby schedules around them.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            data-testid="sp-routines-grid"
            className="select-none"
            style={{
              display: "grid",
              gridTemplateColumns: `34px repeat(${DAYS.length}, 1fr)`,
              gap: 3,
            }}
            onMouseUp={() => setDragging(null)}
            onMouseLeave={() => setDragging(null)}
          >
            <div />
            {DAYS.map((d) => (
              <div key={d} className="pb-1 text-center text-[10px] text-muted-foreground" style={{ fontFamily: MONO }}>
                {d}
              </div>
            ))}
            {GRID_HOURS.map((h) => (
              <div key={h} style={{ display: "contents" }}>
                <div className="flex items-center justify-end pr-1 text-[9px] text-muted-foreground" style={{ fontFamily: MONO }}>
                  {h}
                </div>
                {DAYS.map((_, d) => {
                  const active = cells.has(`${d}-${h}`)
                  return (
                    <button
                      key={`${d}-${h}`}
                      type="button"
                      data-testid={`sp-routine-cell-${d}-${h}`}
                      data-active={active}
                      onMouseDown={() => { setDragging(active ? "off" : "on"); toggleCell(d, h) }}
                      onMouseEnter={() => {
                        if (dragging === "on" && !active) toggleCell(d, h)
                        if (dragging === "off" && active) toggleCell(d, h)
                      }}
                      style={{
                        height: 22,
                        borderRadius: 4,
                        border: "none",
                        cursor: "pointer",
                        background: active
                          ? `linear-gradient(135deg, oklch(0.55 0.2 ${hue}/0.85), oklch(0.5 0.18 ${accentHue}/0.85))`
                          : "var(--muted)",
                        transition: "background 0.12s",
                      }}
                      aria-label={`${DAYS[d]} ${h}:00`}
                    />
                  )
                })}
              </div>
            ))}
          </div>

          <p className="mt-3 text-xs text-muted-foreground" style={{ fontFamily: MONO }}>
            {cells.size} blocks marked · click-drag to paint
          </p>
        </CardContent>
      </Card>

      <div
        data-testid="sp-save-bar"
        data-visible={isDirty || saveState === "saving" || saveState === "error"}
        aria-hidden={!(isDirty || saveState === "saving" || saveState === "error")}
        className="sticky bottom-0 z-10 -mx-2 mt-2 flex items-center justify-between gap-3 rounded-xl border bg-background/85 px-4 py-3 backdrop-blur transition-all duration-300 ease-out data-[visible=false]:pointer-events-none data-[visible=false]:translate-y-2 data-[visible=false]:opacity-0 data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100"
      >
        <p className="text-xs text-muted-foreground" style={{ fontFamily: MONO }}>
          {saveState === "saving"
            ? "Saving…"
            : saveState === "error"
            ? "Couldn't save. Try again."
            : isDirty
            ? "You have unsaved changes."
            : "All changes saved."}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            data-testid="sp-discard"
            onClick={handleDiscard}
            disabled={!isDirty || saveState === "saving"}
          >
            Discard
          </Button>
          <Button
            type="button"
            data-testid="sp-save"
            onClick={() => { void handleSave() }}
            disabled={!isDirty || saveState === "saving"}
          >
            {saveState === "saving" ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {blocker.status === "blocked" && (
        <LeaveConfirm
          onSave={async () => {
            const ok = await handleSave()
            if (ok) blocker.proceed()
          }}
          onDiscard={() => {
            handleDiscard()
            blocker.proceed()
          }}
          onCancel={() => blocker.reset()}
          saving={saveState === "saving"}
        />
      )}

      {retake !== "off" && (
        <RetakeOverlay
          phase={retake}
          existingName={name}
          revealDna={retakeDna}
          onComplete={handleRetakeComplete}
          onClose={closeRetake}
        />
      )}
    </div>
  )
}

function LeaveConfirm({
  onSave,
  onDiscard,
  onCancel,
  saving,
}: {
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
  saving: boolean
}) {
  return (
    <div
      data-testid="sp-leave-confirm"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "oklch(0.14 0.01 240)",
          border: `1px solid ${DNA_TOKENS.line}`,
          borderRadius: 20,
          padding: "32px 36px",
          maxWidth: 380,
          textAlign: "center",
          color: DNA_TOKENS.text,
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 600, margin: "0 0 10px" }}>Save your changes?</p>
        <p style={{ fontSize: 14, color: DNA_TOKENS.textDim, margin: "0 0 24px", lineHeight: 1.6 }}>
          You have unsaved edits to your study profile. Save them before leaving, or discard to revert.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            data-testid="sp-leave-cancel"
            onClick={onCancel}
            disabled={saving}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: `1px solid ${DNA_TOKENS.line}`,
              background: "rgba(255,255,255,0.06)",
              color: DNA_TOKENS.text,
              fontSize: 14,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            Stay
          </button>
          <button
            type="button"
            data-testid="sp-leave-discard"
            onClick={onDiscard}
            disabled={saving}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: "none",
              background: "rgba(239,68,68,0.18)",
              color: "#fca5a5",
              fontSize: 14,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            Discard
          </button>
          <button
            type="button"
            data-testid="sp-leave-save"
            onClick={onSave}
            disabled={saving}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: "none",
              background: "oklch(0.6 0.18 250)",
              color: "white",
              fontSize: 14,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {saving ? "Saving…" : "Save & leave"}
          </button>
        </div>
      </div>
    </div>
  )
}

function RetakeOverlay({
  phase,
  existingName,
  revealDna,
  onComplete,
  onClose,
}: {
  phase: Exclude<RetakePhase, "off">
  existingName: string
  revealDna: StudentDna | null
  onComplete: (answers: OnboardingAnswers) => void
  onClose: () => void
}) {
  const [confirm, setConfirm] = useState<ConfirmState>("hidden")
  const [liveDna, setLiveDna] = useState<StudentDna>(() => buildStudyDna({}))
  const [answeredCount, setAnsweredCount] = useState(0)
  const [burstKey, setBurstKey] = useState(0)

  const displayDna = phase === "reveal" && revealDna ? revealDna : liveDna

  function requestClose() {
    if (phase === "reveal") {
      onClose()
    } else {
      setConfirm("confirming")
    }
  }

  return (
    <div
      data-testid="sp-retake-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: `radial-gradient(ellipse at 20% 50%, oklch(0.22 0.12 ${displayDna.hue}/0.38), transparent 60%), ${DNA_TOKENS.bg}`,
        color: DNA_TOKENS.text,
        display: "grid",
        gridTemplateColumns: phase === "reveal" ? "1fr" : "1.15fr 1fr",
        overflow: "hidden",
        transition: "background 1s",
        WebkitAppRegion: "no-drag",
      } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={requestClose}
        data-testid="sp-retake-close"
        style={{
          position: "absolute",
          top: 16,
          right: 20,
          zIndex: 60,
          background: "rgba(255,255,255,0.06)",
          color: DNA_TOKENS.text,
          border: `1px solid ${DNA_TOKENS.line}`,
          borderRadius: 999,
          padding: "8px 14px",
          fontSize: 12,
          fontFamily: MONO,
          cursor: "pointer",
        }}
      >
        Close
      </button>

      {confirm === "confirming" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 70,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "oklch(0.14 0.01 240)",
              border: `1px solid ${DNA_TOKENS.line}`,
              borderRadius: 20,
              padding: "36px 40px",
              maxWidth: 360,
              textAlign: "center",
              color: DNA_TOKENS.text,
            }}
          >
            <p style={{ fontSize: 18, fontWeight: 600, margin: "0 0 10px" }}>Quit the quiz?</p>
            <p style={{ fontSize: 14, color: DNA_TOKENS.textDim, margin: "0 0 28px", lineHeight: 1.6 }}>
              You'll lose your progress — your current DNA won't change.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setConfirm("hidden")}
                style={{
                  padding: "10px 22px",
                  borderRadius: 999,
                  border: `1px solid ${DNA_TOKENS.line}`,
                  background: "rgba(255,255,255,0.06)",
                  color: DNA_TOKENS.text,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "10px 22px",
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(239,68,68,0.18)",
                  color: "#fca5a5",
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Quit anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left panel — quiz or cinematic reveal */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        {phase === "quiz" && (
          <DnaDiscoveryPhase
            initialAnswers={{ name: existingName }}
            skipName
            onAnswersChange={(a) => setAnsweredCount(Object.keys(a).length)}
            onLiveDnaChange={setLiveDna}
            onAnswerSubmitted={() => setBurstKey((k) => k + 1)}
            onComplete={onComplete}
          />
        )}
        {phase === "reveal" && revealDna && (
          <CinematicReveal dna={revealDna} onContinue={onClose} />
        )}
      </div>

      {/* Right panel — nebula, hidden during reveal */}
      {phase === "quiz" && (
        <div style={{
          display: "grid",
          placeItems: "center",
          background: `linear-gradient(160deg, oklch(0.17 0.05 ${displayDna.hue}/0.58), oklch(0.12 0.03 ${displayDna.accentHue}/0.58))`,
          borderLeft: `1px solid ${DNA_TOKENS.line}`,
          position: "relative",
          overflow: "hidden",
        }}>
          <MysteryNebula
            answered={answeredCount}
            total={11}
            hue={displayDna.hue}
            accentHue={displayDna.accentHue}
            burstKey={burstKey}
          />
        </div>
      )}
    </div>
  )
}
