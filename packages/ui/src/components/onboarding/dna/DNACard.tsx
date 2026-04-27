import type { StudentDna } from "@orbyt/contracts"
import { CompanionOrb } from "./CompanionOrb"
import { DNA_TOKENS, MONO, SERIF } from "./tokens"

interface DNACardProps {
  dna: StudentDna
  answeredCount: number
  large?: boolean
  showStats?: boolean
}

export function DNACard({ dna, answeredCount, large = false, showStats = false }: DNACardProps) {
  const T = DNA_TOKENS
  const W = large ? 420 : 370
  const { hue, accentHue } = dna
  const isReady = answeredCount >= 3

  return (
    <div style={{
      width: W,
      borderRadius: 22,
      background: `linear-gradient(160deg, oklch(0.2 0.08 ${hue}/0.9), oklch(0.14 0.06 ${accentHue}/0.9))`,
      border: `1px solid oklch(0.65 0.2 ${hue}/0.35)`,
      boxShadow: `0 28px 70px oklch(0.18 0.15 ${hue}/0.42), inset 0 1px 0 rgba(255,255,255,0.1)`,
      padding: 26,
      position: "relative",
      clipPath: "inset(0 round 22px)",
      transition: "border-color 0.8s, box-shadow 0.8s",
    }}>
      <div style={{
        position: "absolute",
        inset: -40,
        pointerEvents: "none",
        background: `conic-gradient(from 0deg, oklch(0.7 0.25 ${hue}/0.18), transparent 60%, oklch(0.7 0.25 ${accentHue}/0.18), transparent)`,
        animation: "aura-spin 30s linear infinite",
      }} />
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 9,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: T.textDim,
        fontFamily: MONO,
        marginBottom: 20,
        position: "relative",
        zIndex: 1,
      }}>
        <span>Orbyt · Study DNA</span>
        {dna.isRare && <span style={{ color: `oklch(0.85 0.2 ${hue})` }}>✦ {dna.rarity}</span>}
      </div>
      <div style={{ display: "grid", placeItems: "center", marginBottom: 16, position: "relative", zIndex: 1 }}>
        <CompanionOrb size={large ? 140 : 110} mood={answeredCount >= 6 ? "happy" : "thinking"} energy={0.4 + answeredCount / 14} hue={hue} accentHue={accentHue} spawn />
      </div>
      <div style={{ textAlign: "center", marginBottom: 18, position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 10, color: T.textFaint, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 4 }}>
          {isReady ? "You are" : "Decoding…"}
        </div>
        <div style={{
          fontFamily: SERIF,
          fontSize: large ? 44 : 34,
          fontWeight: 400,
          lineHeight: 1,
          background: `linear-gradient(135deg, oklch(0.95 0.1 ${hue}), oklch(0.8 0.22 ${accentHue}))`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          opacity: isReady ? 1 : 0.25,
          filter: isReady ? "none" : "blur(8px)",
          transition: "all 0.6s",
        }}>
          {isReady ? dna.trait : "???"}
        </div>
        {isReady && large && (
          <div style={{ fontSize: 12, color: T.textDim, fontStyle: "italic", marginTop: 6, lineHeight: 1.4 }}>
            "{dna.tagline}"
          </div>
        )}
      </div>
      {showStats && dna.stats && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14, position: "relative", zIndex: 1 }}>
          {Object.entries(dna.stats).map(([k, v]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "80px 1fr 26px", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, color: T.textDim, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</span>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${v}%`, height: "100%", background: `linear-gradient(90deg, oklch(0.6 0.22 ${hue}), oklch(0.75 0.2 ${accentHue}))` }} />
              </div>
              <span style={{ fontSize: 9, color: T.textDim, textAlign: "right", fontFamily: MONO }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 1,
        background: "rgba(255,255,255,0.06)",
        borderRadius: 10,
        overflow: "hidden",
        position: "relative",
        zIndex: 1,
      }}>
        {[["Peak", dna.peak], ["Drive", dna.motivation], ["Mode", dna.style]].map(([k, v]) => (
          <div key={k} style={{ background: "rgba(10,14,26,0.78)", padding: "8px 10px" }}>
            <div style={{ fontSize: 8, color: T.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 10, fontWeight: 600 }}>{v}</div>
          </div>
        ))}
      </div>
      <style>{`@keyframes aura-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
