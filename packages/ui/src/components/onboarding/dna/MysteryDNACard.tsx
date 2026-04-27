import { useState } from "react"
import type { StudentDna } from "@orbyt/contracts"
import { DNA_TOKENS, MONO, SERIF } from "./tokens"

interface MysteryDNACardProps {
  dna: StudentDna
  onReveal: () => void
}

export function MysteryDNACard({ dna, onReveal }: MysteryDNACardProps) {
  const T = DNA_TOKENS
  const h = dna.hue
  const ah = dna.accentHue
  const [hovered, setHovered] = useState(false)

  const particles = useState(() =>
    Array.from({ length: 30 }).map((_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: 0.8 + Math.random() * 2,
      dur: 1.2 + Math.random() * 2.5,
      delay: -Math.random() * 3,
      hue: ((h + (Math.random() - 0.5) * 100 + 360) % 360),
      idx: i,
    })),
  )[0]

  return (
    <button
      onClick={onReveal}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        all: "unset",
        cursor: "pointer",
        position: "relative",
        width: 320,
        height: 440,
        margin: "0 auto",
        borderRadius: 24,
        display: "grid",
        placeItems: "center",
        background: `linear-gradient(160deg, oklch(0.22 0.1 ${h}/0.92), oklch(0.14 0.06 ${ah}/0.92))`,
        border: `1px solid oklch(0.65 0.22 ${h}/0.5)`,
        boxShadow: hovered
          ? `0 40px 120px oklch(0.18 0.22 ${h}/0.7), 0 0 60px oklch(0.5 0.25 ${h}/0.5), inset 0 1px 0 rgba(255,255,255,0.15)`
          : `0 30px 90px oklch(0.18 0.18 ${h}/0.5), inset 0 1px 0 rgba(255,255,255,0.1)`,
        transform: hovered ? "translateY(-6px) scale(1.025)" : "translateY(0) scale(1)",
        transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        overflow: "hidden",
        animation: "mystery-card-in 0.9s 0.2s cubic-bezier(0.34,1.56,0.64,1) backwards",
      }}
    >
      {/* swirling aura */}
      <div
        style={{
          position: "absolute",
          inset: -60,
          pointerEvents: "none",
          background: `conic-gradient(from 0deg, oklch(0.7 0.28 ${h}/0.3), transparent 45%, oklch(0.7 0.28 ${ah}/0.25), transparent 75%, oklch(0.6 0.22 ${h}/0.2))`,
          animation: "aura-spin-fast 14s linear infinite",
        }}
      />

      {/* twinkling particles */}
      {particles.map((p) => (
        <div
          key={p.idx}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.s,
            height: p.s,
            borderRadius: "50%",
            background: `oklch(0.85 0.22 ${p.hue})`,
            boxShadow: `0 0 ${p.s * 5}px oklch(0.8 0.25 ${p.hue})`,
            animation: `card-twinkle ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}

      {/* big question mark */}
      <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 200,
            lineHeight: 1,
            fontStyle: "italic",
            background: `linear-gradient(135deg, oklch(0.95 0.12 ${h}), oklch(0.78 0.26 ${ah}))`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: hovered ? "brightness(1.15)" : "brightness(1)",
            transition: "filter 0.3s",
            marginBottom: 12,
          }}
        >
          ?
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.4em",
            color: `oklch(0.75 0.2 ${h})`,
            textTransform: "uppercase",
            fontFamily: MONO,
            marginBottom: 4,
          }}
        >
          {hovered ? "click to reveal" : "your student DNA"}
        </div>
        <div
          style={{
            fontSize: 9,
            letterSpacing: "0.25em",
            color: T.textFaint,
            textTransform: "uppercase",
            fontFamily: MONO,
          }}
        >
          sealed · awaiting unlock
        </div>
      </div>

      {/* corner glints */}
      {([[10, 10], [null, 10], [10, null], [null, null]] as Array<[number | null, number | null]>).map(
        (pos, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: pos[1] === 10 ? 14 : "auto",
              bottom: pos[1] === null ? 14 : "auto",
              left: pos[0] === 10 ? 14 : "auto",
              right: pos[0] === null ? 14 : "auto",
              width: 18,
              height: 18,
              border: `1px solid oklch(0.7 0.22 ${h}/0.5)`,
              borderRadius: 3,
              borderRight: i % 2 === 0 ? `1px solid oklch(0.7 0.22 ${h}/0.5)` : "none",
              borderBottom: i < 2 ? `1px solid oklch(0.7 0.22 ${h}/0.5)` : "none",
              borderLeft: i % 2 === 1 ? `1px solid oklch(0.7 0.22 ${h}/0.5)` : "none",
              borderTop: i >= 2 ? `1px solid oklch(0.7 0.22 ${h}/0.5)` : "none",
            }}
          />
        ),
      )}

      <style>{`
        @keyframes mystery-card-in {
          from { opacity: 0; transform: translateY(40px) scale(0.85) rotateY(20deg); filter: blur(20px); }
          to   { opacity: 1; transform: translateY(0) scale(1) rotateY(0); filter: blur(0); }
        }
        @keyframes aura-spin-fast { to { transform: rotate(360deg); } }
        @keyframes card-twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.6); }
          50% { opacity: 1; transform: scale(1.4); }
        }
      `}</style>
    </button>
  )
}
