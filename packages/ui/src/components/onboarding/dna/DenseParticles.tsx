import { useMemo } from "react"

interface DenseParticlesProps {
  density?: number
  hue: number
  intensity?: number
}

export function DenseParticles({ density = 140, hue = 220, intensity = 1 }: DenseParticlesProps) {
  const particles = useMemo(
    () =>
      Array.from({ length: density }).map((_, i) => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 0.6 + Math.random() * 2.4,
        dur: 6 + Math.random() * 18,
        delay: -Math.random() * 20,
        drift: 30 + Math.random() * 90,
        angle: Math.random() * 360,
        hueShift: (Math.random() - 0.5) * 80,
        twinkle: 1 + Math.random() * 2.5,
        opacity: 0.25 + Math.random() * 0.6,
        layer: Math.floor(Math.random() * 3),
        idx: i,
      })),
    // density is stable after mount; intentionally omit from deps to avoid re-seeding on intensity/hue changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [density],
  )

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", willChange: "transform", transform: "translateZ(0)" }}>
      {particles.map((p) => {
        const tx = Math.cos((p.angle * Math.PI) / 180) * p.drift
        const ty = Math.sin((p.angle * Math.PI) / 180) * p.drift
        const ph = (hue + p.hueShift + 360) % 360
        const sz = p.size * (0.7 + p.layer * 0.3)
        return (
          <div
            key={p.idx}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: sz,
              height: sz,
              borderRadius: "50%",
              background: `oklch(${0.75 + p.layer * 0.07} 0.22 ${ph})`,
              boxShadow: `0 0 ${sz * 4}px oklch(0.7 0.22 ${ph} / 0.7)`,
              opacity: p.opacity * intensity,
              animation: `dp-drift-${p.idx % 12} ${p.dur}s ease-in-out ${p.delay}s infinite alternate, dp-twinkle ${p.twinkle}s ease-in-out ${p.delay}s infinite`,
              willChange: "transform, opacity",
              ["--tx" as string]: `${tx}px`,
              ["--ty" as string]: `${ty}px`,
            }}
          />
        )
      })}
      <style>{`
        @keyframes dp-twinkle {
          0%, 100% { transform: scale(0.6); filter: brightness(0.8); }
          50% { transform: scale(1.3); filter: brightness(1.4); }
        }
        ${Array.from({ length: 12 })
          .map((_, i) => {
            const a = (i / 12) * 360
            const tx = Math.cos((a * Math.PI) / 180) * 60
            const ty = Math.sin((a * Math.PI) / 180) * 60
            return `@keyframes dp-drift-${i} { from { translate: 0 0; } to { translate: ${tx}px ${ty}px; } }`
          })
          .join("")}
      `}</style>
    </div>
  )
}
