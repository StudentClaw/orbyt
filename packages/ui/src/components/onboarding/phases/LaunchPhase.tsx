import type { StudentDna } from "@orbyt/contracts"
import { DNA_TOKENS, MONO, SERIF } from "../dna/tokens"

interface LaunchPhaseProps {
  dna: StudentDna
  onTour: () => void
  onSkipTour: () => void
}

const FEATURES = [
  "Adaptive schedule ✓",
  "AI tutor ✓",
  "Canvas synced ✓",
  "Gentle nudges ✓",
]

export function LaunchPhase({ dna, onTour, onSkipTour }: LaunchPhaseProps) {
  const T = DNA_TOKENS
  const { hue, accentHue } = dna

  return (
    <div style={{ padding: "32px 52px 32px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.2em", color: `oklch(0.85 0.18 ${hue})`, textTransform: "uppercase", fontFamily: MONO, marginBottom: 16 }}>
        ✦ Launch ready
      </div>
      <h1 style={{ fontFamily: SERIF, fontSize: 78, lineHeight: 0.98, letterSpacing: "-0.03em", margin: "0 0 18px", fontWeight: 400 }}>
        Orbyt is<br />
        <em style={{
          fontStyle: "italic",
          background: `linear-gradient(135deg, oklch(0.9 0.18 ${hue}), oklch(0.75 0.22 ${accentHue}))`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          yours now
        </em>, {dna.name}.
      </h1>
      <p style={{ fontSize: 16, color: T.textDim, lineHeight: 1.55, marginBottom: 26, maxWidth: 460 }}>
        Let's draft your first week. Orby adapts as you go — miss a session, ace a test, panic at 2 AM. It'll learn about you.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 32, flexWrap: "wrap" }}>
        {FEATURES.map((t) => (
          <div key={t} style={{
            fontSize: 11,
            padding: "4px 11px",
            borderRadius: 999,
            border: `1px solid oklch(0.6 0.2 ${hue}/0.4)`,
            background: `oklch(0.25 0.12 ${hue}/0.3)`,
            color: T.text,
            fontFamily: MONO,
          }}>
            {t}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={onTour}
          data-testid="onboarding-tour-dashboard"
          style={{
            flex: 1,
            padding: "16px 24px",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            background: `linear-gradient(135deg, oklch(0.55 0.22 ${hue}), oklch(0.45 0.2 ${accentHue}))`,
            color: "white",
            fontSize: 16,
            fontWeight: 700,
            fontFamily: "inherit",
            boxShadow: `0 8px 28px oklch(0.5 0.22 ${hue}/0.5), inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}
        >
          Tour Dashboard →
        </button>
        <button
          onClick={onSkipTour}
          data-testid="onboarding-skip-tour"
          style={{
            flex: 1,
            padding: "16px 24px",
            borderRadius: 999,
            border: `1.5px solid oklch(0.55 0.15 ${hue}/0.5)`,
            cursor: "pointer",
            background: `oklch(0.2 0.06 ${hue}/0.3)`,
            color: T.textDim,
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          Skip Tour
        </button>
      </div>
    </div>
  )
}
