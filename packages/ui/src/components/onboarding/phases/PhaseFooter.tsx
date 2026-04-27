import type { StudentDna } from "@orbyt/contracts"
import { DNA_TOKENS } from "../dna/tokens"

interface PhaseFooterProps {
  dna: StudentDna
  onContinue: () => void
  onBack?: () => void
  continueLabel?: string
  continueDisabled?: boolean
}

export function PhaseFooter({
  dna,
  onContinue,
  onBack,
  continueLabel = "Continue →",
  continueDisabled = false,
}: PhaseFooterProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
      {onBack && (
        <button
          onClick={onBack}
          data-testid="onboarding-back"
          style={{
            background: "transparent",
            border: `1px solid ${DNA_TOKENS.lineStrong}`,
            color: DNA_TOKENS.textDim,
            padding: "13px 22px",
            borderRadius: 999,
            cursor: "pointer",
            fontSize: 14,
            fontFamily: "inherit",
          }}
        >
          ← Back
        </button>
      )}
      <button
        onClick={onContinue}
        disabled={continueDisabled}
        style={{
          padding: "14px 32px",
          borderRadius: 999,
          border: continueDisabled ? `1px solid ${DNA_TOKENS.lineStrong}` : "none",
          background: continueDisabled
            ? "rgba(255,255,255,0.04)"
            : `linear-gradient(135deg, oklch(0.55 0.22 ${dna.hue}), oklch(0.45 0.2 ${dna.accentHue}))`,
          color: continueDisabled ? DNA_TOKENS.textFaint : "white",
          fontSize: 16,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: continueDisabled ? "not-allowed" : "pointer",
          boxShadow: continueDisabled ? "none" : `0 8px 28px oklch(0.5 0.22 ${dna.hue}/0.5)`,
        }}
      >
        {continueLabel}
      </button>
    </div>
  )
}
