import { useEffect, useMemo, useState } from "react"
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

  // Phase 2: any click or key press continues. Delay a beat so the click that
  // dismissed the burst doesn't immediately skip the reveal.
  const [canContinue, setCanContinue] = useState(false)
  useEffect(() => {
    if (phase !== 2) {
      setCanContinue(false)
      return
    }
    const armTimer = setTimeout(() => setCanContinue(true), 1600)
    return () => clearTimeout(armTimer)
  }, [phase])

  useEffect(() => {
    if (phase !== 2 || !canContinue) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault()
        onContinue()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [phase, canContinue, onContinue])

  const shards = useMemo(
    () =>
      Array.from({ length: 64 }).map((_, i) => {
        const angle = (i / 64) * 360 + (Math.random() - 0.5) * 22
        const dist = 220 + Math.random() * 280
        return {
          idx: i,
          angle,
          tx: Math.cos((angle * Math.PI) / 180) * dist,
          ty: Math.sin((angle * Math.PI) / 180) * dist,
          sz: 3 + Math.random() * 9,
          hue: ((h + (Math.random() - 0.5) * 140 + 360) % 360),
          isCircle: i % 3 === 0,
          delay: i * 0.008 + Math.random() * 0.05,
          dur: 0.85 + Math.random() * 0.45,
        }
      }),
    [h],
  )

  const sparkles = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, i) => {
        const angle = Math.random() * 360
        const dist = 80 + Math.random() * 380
        return {
          idx: i,
          tx: Math.cos((angle * Math.PI) / 180) * dist,
          ty: Math.sin((angle * Math.PI) / 180) * dist,
          sz: 2 + Math.random() * 3,
          hue: ((h + (Math.random() - 0.5) * 200 + 360) % 360),
          delay: 0.05 + Math.random() * 0.6,
          dur: 1.0 + Math.random() * 0.6,
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
      <DenseParticles density={100} hue={h} intensity={phase >= 1 ? 1.1 : 0.85} />

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
              fontSize: 70,
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
                    animation: `shard-out ${s.dur}s cubic-bezier(0.22,0.61,0.36,1) forwards`,
                    animationDelay: `${s.delay}s`,
                    willChange: "transform, opacity",
                  }}
                />
              ))}
              {sparkles.map((s) => (
                <div
                  key={`sp-${s.idx}`}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: s.sz,
                    height: s.sz,
                    borderRadius: "50%",
                    background: `oklch(0.95 0.2 ${s.hue})`,
                    boxShadow: `0 0 ${s.sz * 6}px oklch(0.85 0.25 ${s.hue})`,
                    ["--tx" as string]: `${s.tx}px`,
                    ["--ty" as string]: `${s.ty}px`,
                    animation: `sparkle-out ${s.dur}s ease-out forwards`,
                    animationDelay: `${s.delay}s`,
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
                  background: `radial-gradient(circle, white, oklch(0.9 0.25 ${h}) 30%, transparent 70%)`,
                  animation: "flash-out 0.9s ease-out forwards",
                  willChange: "transform, opacity",
                  transform: "translate(-50%,-50%) scale(0.5)",
                }}
              />
              {/* expanding ring (scale-based, GPU friendly) */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 600,
                  height: 600,
                  marginLeft: -300,
                  marginTop: -300,
                  borderRadius: "50%",
                  border: `2px solid oklch(0.85 0.28 ${h})`,
                  animation: "ring-scale 0.9s cubic-bezier(0.22,0.61,0.36,1) forwards",
                  willChange: "transform, opacity",
                  transform: "scale(0.05)",
                }}
              />
              {/* secondary ring */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 600,
                  height: 600,
                  marginLeft: -300,
                  marginTop: -300,
                  borderRadius: "50%",
                  border: `1.5px solid oklch(0.85 0.28 ${ah})`,
                  animation: "ring-scale 1.1s cubic-bezier(0.22,0.61,0.36,1) 0.15s forwards",
                  willChange: "transform, opacity",
                  transform: "scale(0.05)",
                }}
              />
              {/* tertiary ring for extra punch */}
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 600,
                  height: 600,
                  marginLeft: -300,
                  marginTop: -300,
                  borderRadius: "50%",
                  border: `1px solid oklch(0.9 0.22 ${(h + 60) % 360})`,
                  animation: "ring-scale 1.3s cubic-bezier(0.22,0.61,0.36,1) 0.3s forwards",
                  willChange: "transform, opacity",
                  transform: "scale(0.05)",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Phase 2: revealed card */}
      {phase === 2 && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => { if (canContinue) onContinue() }}
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
            cursor: canContinue ? "pointer" : "default",
            outline: "none",
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
              fontSize: 46,
              margin: "0 0 22px",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              animation: "fade-up 0.7s 0.15s backwards",
              willChange: "transform, opacity",
            }}
          >
            Here&apos;s <em style={{ fontStyle: "italic" }}>you</em>, {dna.name}.
          </h1>
          <div style={{ animation: "card-reveal 1s 0.1s cubic-bezier(0.34,1.56,0.64,1) backwards", willChange: "transform, opacity", pointerEvents: "none" }}>
            <RevealDNACard dna={dna} />
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 12,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: `oklch(0.78 0.18 ${h})`,
              fontFamily: MONO,
              opacity: canContinue ? 1 : 0,
              animation: canContinue ? "continue-pulse 2.4s ease-in-out infinite" : "none",
              transition: "opacity 0.6s",
              willChange: "opacity",
            }}
          >
            click anywhere to continue
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-up { from{opacity:0;transform:translate3d(0,16px,0)} to{opacity:1;transform:translate3d(0,0,0)} }
        @keyframes ready-headline {
          from { opacity: 0; transform: translate3d(0,18px,0) scale(0.97); }
          to   { opacity: 1; transform: translate3d(0,0,0) scale(1); }
        }
        @keyframes shard-out {
          0%   { transform: translate(-50%,-50%) scale(0.4); opacity: 1; }
          70%  { opacity: 0.9; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0); opacity: 0; }
        }
        @keyframes sparkle-out {
          0%   { transform: translate(-50%,-50%) scale(0.2); opacity: 0; }
          25%  { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1.4); opacity: 0; }
        }
        @keyframes flash-out {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
          20%  { opacity: 1; transform: translate(-50%,-50%) scale(8); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(20); }
        }
        @keyframes ring-scale {
          0%   { transform: scale(0.05); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes card-reveal {
          from { opacity: 0; transform: scale(0.85) translate3d(0,12px,0); }
          to   { opacity: 1; transform: scale(1) translate3d(0,0,0); }
        }
        @keyframes continue-pulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
