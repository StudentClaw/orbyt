import { useState } from "react"
import type { StudentDna } from "@orbyt/contracts"
import { DNA_TOKENS, MONO, SERIF } from "../dna/tokens"
import { PhaseFooter } from "./PhaseFooter"

interface BusyGridPhaseProps {
  dna: StudentDna
  initialCells?: ReadonlyArray<{ dayOfWeek: number; hourOfDay: number }>
  onSave: (cells: Array<{ dayOfWeek: number; hourOfDay: number }>) => void
  onBack?: () => void
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

export function BusyGridPhase({ dna, initialCells, onSave, onBack }: BusyGridPhaseProps) {
  const T = DNA_TOKENS
  const [cells, setCells] = useState<Set<string>>(() => {
    const set = new Set<string>()
    if (initialCells) {
      for (const c of initialCells) set.add(`${c.dayOfWeek}-${c.hourOfDay}`)
    }
    return set
  })
  const [dragging, setDragging] = useState<"on" | "off" | null>(null)

  const toggle = (d: number, h: number): void => {
    const key = `${d}-${h}`
    setCells((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const handleSave = (): void => {
    const out = Array.from(cells).map((k) => {
      const [d, h] = k.split("-").map(Number)
      return { dayOfWeek: d!, hourOfDay: h! }
    })
    onSave(out)
  }

  return (
    <div style={{ padding: "32px 52px 32px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.15em", color: T.textDim, textTransform: "uppercase", fontFamily: MONO, marginBottom: 14 }}>
        Phase 02 · Weekly rhythm
      </div>
      <h1 style={{ fontFamily: SERIF, fontSize: 44, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "0 0 10px", fontWeight: 400 }}>
        When are you <em style={{ fontStyle: "italic" }}>busy</em>?
      </h1>
      <p style={{ fontSize: 14, color: T.textDim, lineHeight: 1.5, marginBottom: 18, maxWidth: 480 }}>
        Tap the hours claimed by classes, work, or anything else. Orby schedules around them — never into them.
      </p>
      <div
        style={{ display: "grid", gridTemplateColumns: `34px repeat(${DAYS.length}, 1fr)`, gap: 3, marginBottom: 16, userSelect: "none" }}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => setDragging(null)}
      >
        <div />
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, color: T.textDim, fontFamily: MONO, paddingBottom: 2 }}>{d}</div>
        ))}
        {HOURS.map((h) => (
          <div key={h} style={{ display: "contents" }}>
            <div style={{ fontSize: 9, color: T.textFaint, fontFamily: MONO, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 3 }}>{h}</div>
            {DAYS.map((_, d) => {
              const active = cells.has(`${d}-${h}`)
              return (
                <button
                  key={`${d}-${h}`}
                  onMouseDown={() => { setDragging(active ? "off" : "on"); toggle(d, h) }}
                  onMouseEnter={() => {
                    if (dragging === "on" && !active) toggle(d, h)
                    if (dragging === "off" && active) toggle(d, h)
                  }}
                  style={{
                    height: 20,
                    borderRadius: 4,
                    border: "none",
                    cursor: "pointer",
                    background: active
                      ? `linear-gradient(135deg, oklch(0.55 0.2 ${dna.hue}/0.9), oklch(0.5 0.18 ${dna.accentHue}/0.9))`
                      : "rgba(255,255,255,0.04)",
                    boxShadow: active ? `0 0 8px oklch(0.6 0.2 ${dna.hue}/0.35)` : "none",
                    transition: "background 0.12s",
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.textFaint, fontFamily: MONO, marginBottom: 22 }}>
        {cells.size} blocks marked · click-drag to paint
      </div>
      <PhaseFooter dna={dna} onBack={onBack} onContinue={handleSave} />
    </div>
  )
}
