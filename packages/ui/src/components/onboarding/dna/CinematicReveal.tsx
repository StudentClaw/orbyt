import { useMemo, useState } from "react"
import type { StudentDna } from "@orbyt/contracts"
import { RevealDNACard } from "./RevealDNACard"
import { DenseParticles } from "./DenseParticles"
import { MysteryDNACard } from "./MysteryDNACard"
import { DNA_TOKENS, MONO, SERIF } from "./tokens"

interface CinematicRevealProps {
  dna: StudentDna
  onContinue: () => void
}

type Phase = 0 | 1 | 2

export function CinematicReveal({ dna, onContinue }: CinematicRevealProps) {
  const T = DNA_TOKENS
  const [phase, setPhase] = useState<Phase>(0)
  const { hue: h, accentHue: ah } = dna

  const handleReveal = () => {
    setPhase(1)
    setTimeout(() => setPhase(2), 900)
  }

  const shards = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => {
        const angle = (i / 28) * 360 + (Math.random() - 0.5) * 15
        const dist = 200 + Math.random() * 180
        return {
          idx: i,
          angle,
          tx: Math.cos((angle * Math.PI) / 180) * dist,
          ty: Math.sin((angle * Math.PI) / 180) * dist,
          sz: 4 + Math.random() * 8,
          hue: ((h + (Math.random() - 0.5) * 120 + 360) % 360),
          isCircle: i % 3 === 0,
        }
      }),
    [h],
  )

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: `radial-gradient(ellipse at 50% 35%, oklch(0.24 0.16 ${h}/0.7), transparent 65%), ${T.bg}`,
        display: "grid",
        placeItems: "center",
        transition: "background 1s",
      }}
    >
      <DenseParticles density={180} hue={h} intensity={phase >= 1 ? 1.4 : 1} />

      {/* Phase 0 + 1: headline + mystery card */}
      {phase < 2 && (
        <div
          style={{
            position: "relative",
            zIndex: 2,
            textAlign: "center",
            padding: "0 40px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.4em",
              color: `oklch(0.78 0.2 ${h})`,
              textTransform: "uppercase",
              fontFamily: MONO,
              marginBottom: 14,
              animation: "fade-up 0.7s backwards",
              willChange: "transform, opacity",
            }}
          >
            ✦ Profile complete ✦
          </div>

          <h1
            style={{
              fontFamily: SERIF,
              fontSize: 60,
              margin: "0 0 36px",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              animation: "ready-headline 0.9s 0.15s backwards",
              willChange: "transform, opacity",
            }}
          >
            Your{" "}
            <em
              style={{
                fontStyle: "italic",
                background: `linear-gradient(135deg, oklch(0.92 0.18 ${h}), oklch(0.78 0.26 ${ah}))`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Student DNA
            </em>{" "}
            is ready.
          </h1>

          {phase === 0 && (
            <>
              <MysteryDNACard dna={dna} onReveal={handleReveal} />
              <div
                style={{
                  marginTop: 28,
                  fontSize: 13,
                  color: T.textDim,
                  fontStyle: "italic",
                  fontFamily: SERIF,
                  animation: "fade-up 0.7s 0.6s backwards",
                  willChange: "transform, opacity",
                }}
              >
                Tap the card to unlock who you are, {dna.name}.
              </div>
            </>
          )}

          {/* Phase 1: shatter burst */}
          {phase === 1 && (
            <div style={{ position: "relative", width: 320, height: 440, margin: "0 auto" }}>
              {shards.map((s) => (
                <div
                  key={s.idx}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: s.sz,
                    height: s.sz,
                    borderRadius: s.isCircle ? "50%" : 1,
                    background: `oklch(0.85 0.25 ${s.hue})`,
                    boxShadow: `0 0 ${s.sz * 3}px oklch(0.8 0.25 ${s.hue})`,
                    ["--tx" as string]: `${s.tx}px`,
                    ["--ty" as string]: `${s.ty}px`,
                    animation: `shard-out 0.9s cubic-bezier(0.22,0.61,0.36,1) forwards`,
                    animationDelay: `${s.idx * 0.012}s`,
                    willChange: "transform, opacity",
                  }}
                />
              ))}
              {/* central flash */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  transform: "translate(-50%,-50%)",
                  background: `radial-gradient(circle, white, oklch(0.9 0.25 ${h}) 30%, transparent 70%)`,
                  animation: "flash-out 0.9s ease-out forwards",
                  willChange: "transform, opacity",
                }}
              />
              {/* expanding ring */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  transform: "translate(-50%,-50%)",
                  border: `2px solid oklch(0.85 0.28 ${h})`,
                  animation: "ring-out 0.9s cubic-bezier(0.22,0.61,0.36,1) forwards",
                  willChange: "transform, opacity",
                }}
              />
              {/* secondary ring */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  transform: "translate(-50%,-50%)",
                  border: `1.5px solid oklch(0.85 0.28 ${ah})`,
                  animation: "ring-out 1.1s cubic-bezier(0.22,0.61,0.36,1) 0.15s forwards",
                  willChange: "transform, opacity",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Phase 2: revealed card */}
      {phase === 2 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "40px",
            overflow: "auto",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.4em",
              color: `oklch(0.78 0.2 ${h})`,
              textTransform: "uppercase",
              fontFamily: MONO,
              marginBottom: 12,
              animation: "fade-up 0.6s backwards",
              willChange: "transform, opacity",
            }}
          >
            ✦ Unlocked ✦
          </div>
          <h1
            style={{
              fontFamily: SERIF,
              fontSize: 38,
              margin: "0 0 22px",
              fontWeight: 400,
              lineHeight: 1.05,
              animation: "fade-up 0.7s 0.15s backwards",
              willChange: "transform, opacity",
            }}
          >
            Here&apos;s <em style={{ fontStyle: "italic" }}>you</em>, {dna.name}.
          </h1>
          <div style={{ animation: "card-reveal 1s 0.1s cubic-bezier(0.34,1.56,0.64,1) backwards", willChange: "transform, opacity" }}>
            <RevealDNACard dna={dna} />
          </div>
          <div style={{ marginTop: 24, animation: "fade-up 0.7s 1.6s backwards", willChange: "transform, opacity" }}>
            <button
              onClick={onContinue}
              style={{
                padding: "14px 36px",
                borderRadius: 999,
                border: "none",
                background: `linear-gradient(135deg, oklch(0.55 0.22 ${h}), oklch(0.45 0.2 ${ah}))`,
                color: "white",
                fontSize: 16,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                boxShadow: `0 8px 28px oklch(0.5 0.22 ${h}/0.5)`,
              }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ready-headline {
          from { opacity: 0; transform: translateY(20px); filter: blur(12px); }
          to   { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes shard-out {
          0%   { transform: translate(-50%,-50%) scale(0.4); opacity: 1; }
          70%  { opacity: 0.9; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0); opacity: 0; }
        }
        @keyframes flash-out {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
          20%  { opacity: 1; transform: translate(-50%,-50%) scale(8); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(20); }
        }
        @keyframes ring-out {
          0%   { width: 30px; height: 30px; opacity: 1; border-width: 2px; }
          100% { width: 600px; height: 600px; opacity: 0; border-width: 0.5px; }
        }
        @keyframes card-reveal {
          from { opacity: 0; transform: scale(0.7) rotateY(20deg); filter: blur(20px); }
          to   { opacity: 1; transform: scale(1) rotateY(0); filter: blur(0); }
        }
      `}</style>
    </div>
  )
}
