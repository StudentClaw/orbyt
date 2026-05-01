import type { StudentDna } from "@orbyt/contracts"
import { CompanionOrb } from "./CompanionOrb"
import { DNA_TOKENS, MONO, SERIF } from "./tokens"

interface RevealDNACardProps {
  dna: StudentDna
}

export function RevealDNACard({ dna }: RevealDNACardProps) {
  const T = DNA_TOKENS
  const { hue, accentHue } = dna
  const W = 400

  return (
    <div style={{
      width: W,
      borderRadius: 24,
      margin: "0 auto",
      background: `linear-gradient(160deg, oklch(0.2 0.09 ${hue}/0.92), oklch(0.14 0.06 ${accentHue}/0.92))`,
      border: `1px solid oklch(0.65 0.22 ${hue}/0.4)`,
      boxShadow: `0 30px 90px oklch(0.18 0.18 ${hue}/0.5), inset 0 1px 0 rgba(255,255,255,0.1)`,
      padding: "28px 28px 24px",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute",
        inset: -40,
        pointerEvents: "none",
        background: `conic-gradient(from 0deg, oklch(0.7 0.28 ${hue}/0.22), transparent 55%, oklch(0.7 0.28 ${accentHue}/0.18), transparent)`,
        animation: "aura-spin 28s linear infinite",
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
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
        }}>
          <span>Orbyt · Study DNA</span>
          {dna.isRare && (
            <span style={{ color: `oklch(0.85 0.2 ${hue})`, letterSpacing: "0.3em" }}>
              ✦ {dna.rarity}
            </span>
          )}
        </div>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 16 }}>
          <CompanionOrb size={110} mood="happy" energy={1} hue={hue} accentHue={accentHue} spawn />
        </div>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{
            fontFamily: SERIF,
            fontSize: 40,
            fontWeight: 400,
            lineHeight: 1,
            background: `linear-gradient(135deg, oklch(0.95 0.12 ${hue}), oklch(0.82 0.24 ${accentHue}))`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "trait-glow 2s 0.4s backwards",
          }}>
            {dna.trait}
          </div>
          <div style={{ fontSize: 12, color: T.textDim, fontStyle: "italic", marginTop: 6, lineHeight: 1.4 }}>
            "{dna.tagline}"
          </div>
        </div>
        {dna.stats && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
            {Object.entries(dna.stats).map(([k, v], i) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "80px 1fr 26px", alignItems: "center", gap: 8, animation: `meta-in 0.5s ${0.5 + i * 0.09}s backwards` }}>
                <span style={{ fontSize: 9, color: T.textDim, fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {k}
                </span>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    width: `${v}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, oklch(0.6 0.22 ${hue}), oklch(0.75 0.2 ${accentHue}))`,
                    boxShadow: `0 0 6px oklch(0.65 0.22 ${hue}/0.5)`,
                    animation: `stat-fill 1.4s cubic-bezier(0.22,1,0.36,1) ${0.5 + i * 0.08}s backwards`,
                  }} />
                </div>
                <span style={{ fontSize: 9, color: T.textDim, textAlign: "right", fontFamily: MONO }}>
                  {v}
                </span>
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
          marginBottom: 14,
        }}>
          {[["Peak", dna.peak], ["Drive", dna.motivation], ["Mode", dna.style]].map(([k, v]) => (
            <div key={k} style={{ background: "rgba(10,14,26,0.78)", padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: T.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: 10, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
        {dna.orbytAdapts && (
          <div style={{ fontSize: 10, color: T.textDim, lineHeight: 1.5, borderLeft: `2px solid oklch(0.65 0.22 ${hue})`, padding: "2px 0 2px 10px" }}>
            <span style={{ color: `oklch(0.85 0.2 ${hue})`, fontFamily: MONO, fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", display: "block", marginBottom: 3 }}>
              Orbyt adapts ↓
            </span>
            {dna.orbytAdapts}
          </div>
        )}
      </div>
      <style>{`
        @keyframes aura-spin { to { transform: rotate(360deg) } }
        @keyframes stat-fill { from { width: 0 !important } }
        @keyframes trait-glow {
          0%   { filter: brightness(2.5) blur(8px); letter-spacing: 0.05em; }
          50%  { filter: brightness(1.6) blur(0); letter-spacing: -0.015em; }
          100% { filter: brightness(1) blur(0); letter-spacing: -0.015em; }
        }
        @keyframes meta-in {
          from { opacity: 0; transform: translateY(8px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
      `}</style>
    </div>
  )
}
