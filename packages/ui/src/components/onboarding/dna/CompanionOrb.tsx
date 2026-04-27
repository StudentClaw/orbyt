import { useMemo } from "react"

export type OrbMood = "idle" | "listening" | "thinking" | "happy" | "curious"

interface CompanionOrbProps {
  size?: number
  mood?: OrbMood
  energy?: number
  hue?: number
  accentHue?: number
  spawn?: boolean
}

const MOOD_CONFIG: Record<OrbMood, { pulse: number; spin: number; rings: number; sparkle: number }> = {
  idle:      { pulse: 1.0, spin: 1.0, rings: 1, sparkle: 0 },
  listening: { pulse: 1.4, spin: 1.4, rings: 2, sparkle: 0 },
  thinking:  { pulse: 0.8, spin: 2.2, rings: 3, sparkle: 1 },
  happy:     { pulse: 1.6, spin: 1.2, rings: 2, sparkle: 1 },
  curious:   { pulse: 1.2, spin: 1.6, rings: 2, sparkle: 0 },
}

export function CompanionOrb({
  size = 160,
  mood = "idle",
  energy = 0.6,
  hue = 220,
  accentHue = 280,
  spawn = false,
}: CompanionOrbProps) {
  const cfg = MOOD_CONFIG[mood]
  const e = 0.3 + energy * 0.7
  const coreSize = size * 0.5

  const rings = useMemo(() => Array.from({ length: cfg.rings }, (_, i) => i), [cfg.rings])

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "grid",
        placeItems: "center",
        animation: spawn ? "orb-spawn 0.8s cubic-bezier(0.34,1.56,0.64,1) backwards" : undefined,
        willChange: spawn ? "transform, opacity" : undefined,
      }}
    >
      <div style={{
        position: "absolute",
        inset: -size * 0.3,
        background: `radial-gradient(circle at 50% 50%, oklch(0.65 0.2 ${hue} / ${0.35 * e}) 0%, transparent 60%)`,
        filter: "blur(20px)",
        animation: `orb-breathe ${3 / cfg.pulse}s ease-in-out infinite`,
        willChange: "transform, opacity",
      }} />

      {rings.map((i) => {
        const ringSize = size * (0.95 + i * 0.18)
        const tiltDeg = -20 + i * 15
        const dur = (8 - i * 1.5) / cfg.spin
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: ringSize,
              height: ringSize * 0.28,
              border: `1.5px solid oklch(0.7 0.18 ${hue + i * 30} / ${0.65 - i * 0.15})`,
              borderRadius: "50%",
              transform: `rotateZ(${tiltDeg}deg)`,
              animation: `orb-spin ${dur}s linear infinite`,
              willChange: "transform",
            }}
          >
            <div style={{
              position: "absolute",
              left: "-4px",
              top: "50%",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: `oklch(0.85 0.2 ${hue + i * 30})`,
              boxShadow: `0 0 12px oklch(0.85 0.2 ${hue + i * 30})`,
              transform: "translateY(-50%)",
            }} />
          </div>
        )
      })}

      <div style={{
        width: coreSize,
        height: coreSize,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, oklch(0.9 0.15 ${hue}) 0%, oklch(0.6 0.22 ${hue}) 55%, oklch(0.35 0.2 ${accentHue}) 100%)`,
        boxShadow: `0 0 40px oklch(0.65 0.2 ${hue} / 0.8), inset -8px -8px 20px oklch(0.3 0.15 ${accentHue} / 0.6)`,
        position: "relative",
        animation: `orb-pulse ${2 / cfg.pulse}s ease-in-out infinite`,
        willChange: "transform",
      }}>
        <div style={{
          position: "absolute",
          top: "12%",
          left: "18%",
          width: "28%",
          height: "22%",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.6)",
          filter: "blur(3px)",
        }} />
      </div>

      {cfg.sparkle > 0 && Array.from({ length: 6 }).map((_, i) => (
        <div
          key={`s-${i}`}
          style={{
            position: "absolute",
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 0 8px white",
            top: `${18 + (i * 13) % 62}%`,
            left: `${12 + (i * 23) % 72}%`,
            animation: `orb-sparkle 1.8s ease-in-out infinite ${i * 0.28}s`,
            willChange: "transform, opacity",
          }}
        />
      ))}

      <style>{`
        @keyframes orb-breathe { 0%,100% { transform: scale(1); opacity: 0.8 } 50% { transform: scale(1.15); opacity: 1 } }
        @keyframes orb-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.05) } }
        @keyframes orb-sparkle { 0%,100% { opacity: 0; transform: scale(0.5) } 50% { opacity: 1; transform: scale(1.2) } }
        @keyframes orb-spawn { 0% { opacity: 0; transform: scale(0.1); filter: blur(16px) } 40% { opacity: 1; filter: blur(0) } 70% { transform: scale(1.12) } 85% { transform: scale(0.96) } 100% { transform: scale(1) } }
        @keyframes orb-spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
