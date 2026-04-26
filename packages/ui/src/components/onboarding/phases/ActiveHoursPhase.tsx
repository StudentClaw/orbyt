import { useCallback, useEffect, useRef, useState } from "react"
import type { StudentDna } from "@orbyt/contracts"
import { DNA_TOKENS, MONO, SERIF } from "../dna/tokens"
import { PhaseFooter } from "./PhaseFooter"

interface ActiveHoursPhaseProps {
  dna: StudentDna
  initialStart?: number
  initialEnd?: number
  onSave: (params: { startHour: number; endHour: number }) => void
  onBack?: () => void
}

const MIN = 4
const MAX = 26

function fmt(h: number): string {
  const norm = h % 24
  const suffix = norm < 12 || norm === 0 ? "AM" : "PM"
  const display = norm === 0 ? 12 : norm > 12 ? norm - 12 : norm
  return `${display}:00 ${suffix}`
}

export function ActiveHoursPhase({ dna, initialStart = 7, initialEnd = 23, onSave, onBack }: ActiveHoursPhaseProps) {
  const T = DNA_TOKENS
  const [startH, setStartH] = useState(initialStart)
  const [endH, setEndH] = useState(initialEnd)
  const [dragging, setDragging] = useState<"start" | "end" | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)

  const pct = (h: number): number => ((h - MIN) / (MAX - MIN)) * 100

  const getHFromMouse = useCallback((clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return MIN
    const raw = ((clientX - rect.left) / rect.width) * (MAX - MIN) + MIN
    return Math.max(MIN, Math.min(MAX, Math.round(raw)))
  }, [])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return
    const h = getHFromMouse(e.clientX)
    if (dragging === "start") setStartH(Math.min(h, endH - 1))
    if (dragging === "end") setEndH(Math.max(h, startH + 1))
  }, [dragging, startH, endH, getHFromMouse])

  const onMouseUp = useCallback(() => setDragging(null), [])

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  const labelHours = [6, 9, 12, 15, 18, 21, 24]

  return (
    <div style={{ padding: "32px 52px 32px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.15em", color: T.textDim, textTransform: "uppercase", fontFamily: MONO, marginBottom: 14 }}>
        Phase 01 · Active Hours
      </div>
      <h1 style={{ fontFamily: SERIF, fontSize: 46, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 10px", fontWeight: 400 }}>
        When is your <em style={{ fontStyle: "italic" }}>day</em>?
      </h1>
      <p style={{ fontSize: 15, color: T.textDim, lineHeight: 1.55, marginBottom: 32, maxWidth: 480 }}>
        Drag the handles to mark when you're awake and on. Orby only schedules inside your active window — never outside it.
      </p>

      <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Day begins", value: fmt(startH), hue: dna.hue },
          { label: "Day ends", value: fmt(endH), hue: dna.accentHue },
        ].map((pill) => (
          <div key={pill.label} style={{
            flex: 1,
            padding: "14px 18px",
            borderRadius: 14,
            background: `oklch(0.2 0.08 ${pill.hue}/0.4)`,
            border: `1px solid oklch(0.65 0.2 ${pill.hue}/0.4)`,
          }}>
            <div style={{ fontSize: 10, color: T.textDim, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: MONO, marginBottom: 4 }}>{pill.label}</div>
            <div style={{ fontFamily: SERIF, fontSize: 28, color: `oklch(0.9 0.18 ${pill.hue})` }}>{pill.value}</div>
          </div>
        ))}
      </div>

      <div style={{ position: "relative", marginBottom: 10, userSelect: "none" }}>
        <div ref={trackRef} style={{ position: "relative", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.07)", cursor: "pointer" }}>
          <div style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            borderRadius: 4,
            left: `${pct(startH)}%`,
            width: `${pct(endH) - pct(startH)}%`,
            background: `linear-gradient(90deg, oklch(0.6 0.22 ${dna.hue}), oklch(0.65 0.2 ${dna.accentHue}))`,
            boxShadow: `0 0 12px oklch(0.55 0.22 ${dna.hue}/0.5)`,
            transition: dragging ? "none" : "all 0.2s",
          }} />
          {([
            { which: "start" as const, val: startH, hue: dna.hue },
            { which: "end" as const, val: endH, hue: dna.accentHue },
          ]).map(({ which, val, hue }) => (
            <div
              key={which}
              onMouseDown={(e) => { e.preventDefault(); setDragging(which) }}
              style={{
                position: "absolute",
                left: `${pct(val)}%`,
                top: "50%",
                transform: "translate(-50%,-50%)",
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 30%, oklch(0.9 0.15 ${hue}), oklch(0.6 0.22 ${hue}))`,
                boxShadow: `0 0 16px oklch(0.6 0.22 ${hue}/0.7)`,
                cursor: "ew-resize",
                zIndex: 2,
                transition: dragging === which ? "none" : "left 0.2s",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          {labelHours.map((h) => (
            <div key={h} style={{ fontSize: 9, color: T.textFaint, fontFamily: MONO, textAlign: "center", minWidth: 28 }}>
              {fmt(h).split(" ")[0]}
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: T.textFaint, fontFamily: MONO, marginBottom: 28 }}>
        Active window: {endH - startH} hours · {fmt(startH)} → {fmt(endH)}
      </div>

      <PhaseFooter dna={dna} onBack={onBack} onContinue={() => onSave({ startHour: startH, endHour: endH })} />
    </div>
  )
}
