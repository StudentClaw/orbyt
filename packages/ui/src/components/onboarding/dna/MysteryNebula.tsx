import { useEffect, useMemo, useState } from "react"
import { MONO } from "./tokens"

interface MysteryNebulaProps {
  answered: number
  total: number
  hue: number
  accentHue: number
  burstKey?: number
}

const RINGS = [
  { r: 132, n: 18, dur: 26, minProg: 0.00, pSize: 3 },
  { r: 110, n: 22, dur: 18, minProg: 0.10, pSize: 2.6 },
  { r: 88,  n: 20, dur: 13, minProg: 0.22, pSize: 2.2 },
  { r: 68,  n: 18, dur: 9,  minProg: 0.38, pSize: 1.8 },
  { r: 50,  n: 14, dur: 6,  minProg: 0.55, pSize: 1.5 },
  { r: 34,  n: 10, dur: 4,  minProg: 0.72, pSize: 1.2 },
]

export function MysteryNebula({ answered, total, hue, accentHue, burstKey = 0 }: MysteryNebulaProps) {
  const progress = total > 0 ? answered / total : 0
  const [shockKey, setShockKey] = useState(0)
  const h = hue
  const ah = accentHue

  useEffect(() => {
    if (answered > 0) setShockKey((k) => k + 1)
  }, [answered])

  const heatHue = h + (1 - progress) * 60
  const coreLight = 0.45 + progress * 0.35
  const coreSat = 0.18 + progress * 0.12

  const blobs = [
    { size: 190, x: 0,   y: 0,   blobHue: h,             blur: 60, dur: 24, minProg: 0 },
    { size: 130, x: 48,  y: -28, blobHue: ah,             blur: 44, dur: 16, minProg: 0.10 },
    { size: 110, x: -42, y: 32,  blobHue: (h + 55) % 360, blur: 38, dur: 19, minProg: 0.22 },
    { size: 90,  x: 28,  y: 48,  blobHue: (ah + 45) % 360, blur: 30, dur: 13, minProg: 0.40 },
    { size: 150, x: -28, y: -42, blobHue: (h + 110) % 360, blur: 52, dur: 28, minProg: 0.55 },
    { size: 70,  x: 52,  y: 18,  blobHue: (h + 175) % 360, blur: 26, dur: 11, minProg: 0.68 },
    { size: 100, x: -48, y: -12, blobHue: (ah + 75) % 360, blur: 38, dur: 21, minProg: 0.82 },
  ]

  const label =
    progress === 0 ? "awaiting matter…"
    : progress < 0.2 ? "collecting mass"
    : progress < 0.4 ? "disk forming"
    : progress < 0.6 ? "gravity pulling"
    : progress < 0.8 ? "pressure building"
    : progress < 1   ? "ignition imminent"
    : "star forged"

  const burstSeed = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, i) => ({
        angle: (i / 24) * 360 + (Math.random() - 0.5) * 15,
        dist: 80 + Math.random() * 120,
        size: 1.5 + Math.random() * 3,
        dur: 0.7 + Math.random() * 0.5,
        bHue: ((h + (Math.random() - 0.5) * 120 + 360) % 360),
        idx: i,
      })),
    // Re-seed on each answer burst
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstKey, h],
  )

  return (
    <div
      style={{
        position: "relative",
        width: 340,
        height: 340,
        display: "grid",
        placeItems: "center",
      }}
    >
      {/* burst particles on each answer */}
      {burstKey > 0 && (
        <div key={burstKey} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {burstSeed.map((b) => {
            const tx = Math.cos((b.angle * Math.PI) / 180) * b.dist
            const ty = Math.sin((b.angle * Math.PI) / 180) * b.dist
            return (
              <div
                key={b.idx}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: b.size,
                  height: b.size,
                  borderRadius: "50%",
                  background: `oklch(0.85 0.25 ${b.bHue})`,
                  boxShadow: `0 0 ${b.size * 5}px oklch(0.8 0.25 ${b.bHue})`,
                  animation: `burst-${b.idx % 8} ${b.dur}s cubic-bezier(0.22,0.61,0.36,1) forwards`,
                  ["--tx" as string]: `${tx}px`,
                  ["--ty" as string]: `${ty}px`,
                }}
              />
            )
          })}
        </div>
      )}

      {/* background blobs */}
      {blobs.map((b, i) => {
        const op =
          progress <= b.minProg
            ? 0
            : Math.min(1, (progress - b.minProg) / 0.25) * (0.32 + i * 0.04)
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: b.size,
              height: b.size * 0.82,
              borderRadius: "50%",
              background: `oklch(${0.5 + progress * 0.15} 0.22 ${b.blobHue})`,
              filter: `blur(${b.blur}px)`,
              opacity: op,
              animation: `nebula-drift-${i} ${b.dur}s ease-in-out infinite ${i % 2 ? "alternate-reverse" : "alternate"}`,
              transition: "opacity 1.6s ease, background 2s ease",
              pointerEvents: "none",
            }}
          />
        )
      })}

      {/* accretion disk rings */}
      {RINGS.map((ring, ri) => {
        const ringOpacity = Math.max(0, Math.min(1, (progress - ring.minProg) / 0.2))
        if (ringOpacity === 0) return null
        return (
          <div
            key={`ring-${ri}`}
            style={{
              position: "absolute",
              width: ring.r * 2,
              height: ring.r * 0.38,
              borderRadius: "50%",
              border: `${1 + (5 - ri) * 0.3}px solid oklch(${0.6 + ri * 0.04} 0.22 ${(h + ri * 25) % 360} / ${0.15 + ringOpacity * 0.35})`,
              boxShadow: `0 0 ${4 + ri * 3}px oklch(0.65 0.22 ${(h + ri * 25) % 360} / ${ringOpacity * 0.4})`,
              animation: `disk-spin-${ri % 5} ${ring.dur}s linear infinite ${ri % 2 ? "reverse" : ""}`,
              opacity: ringOpacity,
              transition: "opacity 1s ease",
            }}
          >
            {Array.from({ length: ring.n }).map((_, pi) => {
              const angle = (pi / ring.n) * 360
              return (
                <div
                  key={pi}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: ring.pSize + (pi % 3) * 0.5,
                    height: ring.pSize + (pi % 3) * 0.5,
                    borderRadius: "50%",
                    background: `oklch(${0.8 + (pi % 3) * 0.05} 0.28 ${(h + angle * 0.4) % 360})`,
                    boxShadow: `0 0 ${ring.pSize * 4}px oklch(0.75 0.25 ${(h + angle * 0.4) % 360})`,
                    transform: `rotate(${angle}deg) translateX(${ring.r - 2}px) translate(-50%,-50%)`,
                    animation: `particle-twinkle 1.${pi % 4}s ease-in-out infinite ${pi * 0.1}s`,
                    opacity: 0.6 + (pi % 3) * 0.13,
                  }}
                />
              )
            })}
          </div>
        )
      })}

      {/* polar jets */}
      {progress > 0.45 && (
        <>
          {([-1, 1] as const).map((dir) => (
            <div
              key={dir}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 5 + progress * 3,
                height: `${Math.round(20 + progress * 80)}px`,
                transform: `translate(-50%, ${dir === -1 ? "-100%" : "0%"})`,
                background:
                  dir === -1
                    ? `linear-gradient(to top, oklch(0.85 0.28 ${h}), oklch(0.75 0.22 ${ah} / 0.5), transparent)`
                    : `linear-gradient(to bottom, oklch(0.85 0.28 ${h}), oklch(0.75 0.22 ${ah} / 0.5), transparent)`,
                filter: "blur(4px)",
                opacity: Math.min(1, (progress - 0.45) / 0.2),
                animation: "jet-pulse 2s ease-in-out infinite",
                transition: "height 1s ease, opacity 1s ease, width 0.8s ease",
                borderRadius: "50% 50% 0 0",
              }}
            />
          ))}
        </>
      )}

      {/* primary shockwave on answer */}
      <div
        key={shockKey}
        style={{
          position: "absolute",
          width: 12,
          height: 12,
          borderRadius: "50%",
          border: `2px solid oklch(0.82 0.28 ${h} / 0.9)`,
          boxShadow: `0 0 12px oklch(0.75 0.25 ${h})`,
          animation: shockKey > 0 ? "shockwave 0.9s cubic-bezier(0.22,0.61,0.36,1) forwards" : "none",
          pointerEvents: "none",
        }}
      />

      {/* secondary inner shockwave */}
      <div
        key={`s2-${shockKey}`}
        style={{
          position: "absolute",
          width: 8,
          height: 8,
          borderRadius: "50%",
          border: `1.5px solid oklch(0.85 0.28 ${ah} / 0.8)`,
          animation: shockKey > 0 ? "shockwave2 1.1s cubic-bezier(0.22,0.61,0.36,1) 0.15s forwards" : "none",
          pointerEvents: "none",
        }}
      />

      {/* core */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          width: 42 + progress * 26,
          height: 42 + progress * 26,
          borderRadius: "50%",
          background: `radial-gradient(circle at 38% 32%,
            oklch(${Math.min(0.98, coreLight + 0.35)} ${Math.max(0, coreSat - 0.1)} ${heatHue + 30}),
            oklch(${coreLight} ${coreSat} ${heatHue}) 50%,
            oklch(${coreLight - 0.15} ${coreSat + 0.05} ${ah}) 100%
          )`,
          boxShadow: `
            0 0 ${16 + progress * 50}px oklch(${coreLight} 0.28 ${heatHue} / ${0.5 + progress * 0.45}),
            0 0 ${40 + progress * 80}px oklch(0.5 0.2 ${h} / ${0.2 + progress * 0.3}),
            inset -4px -4px 12px oklch(0.3 0.15 ${ah} / 0.5)
          `,
          animation: "nebula-core-pulse 2s ease-in-out infinite",
          transition: "all 1.2s ease",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "14%",
            left: "18%",
            width: "32%",
            height: "26%",
            borderRadius: "50%",
            background: `rgba(255,255,255,${0.4 + progress * 0.3})`,
            filter: "blur(3px)",
          }}
        />
      </div>

      {/* progress ring */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          transform: "rotate(-90deg)",
        }}
      >
        <circle cx="170" cy="170" r="155" fill="none" stroke={`oklch(0.65 0.2 ${h} / 0.1)`} strokeWidth="1" />
        <circle
          cx="170"
          cy="170"
          r="155"
          fill="none"
          stroke={`oklch(${0.7 + progress * 0.15} 0.26 ${heatHue} / ${0.4 + progress * 0.45})`}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 155}`}
          strokeDashoffset={`${2 * Math.PI * 155 * (1 - progress)}`}
          style={{ transition: "stroke-dashoffset 0.8s ease, stroke 1.8s ease" }}
        />
      </svg>

      <div
        style={{
          position: "absolute",
          bottom: -30,
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: "0.28em",
          color: `oklch(${0.55 + progress * 0.25} 0.22 ${heatHue} / 0.9)`,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          transition: "color 1.5s",
          animation: "status-breathe 2s ease-in-out infinite",
        }}
      >
        {label}
      </div>

      <style>{`
        @keyframes nebula-drift-0 { 0%{transform:translate(0,0)} 100%{transform:translate(16px,-14px)} }
        @keyframes nebula-drift-1 { 0%{transform:translate(48px,-28px)} 100%{transform:translate(36px,10px)} }
        @keyframes nebula-drift-2 { 0%{transform:translate(-42px,32px)} 100%{transform:translate(-30px,18px)} }
        @keyframes nebula-drift-3 { 0%{transform:translate(28px,48px)} 100%{transform:translate(40px,30px)} }
        @keyframes nebula-drift-4 { 0%{transform:translate(-28px,-42px)} 100%{transform:translate(-14px,-58px)} }
        @keyframes nebula-drift-5 { 0%{transform:translate(52px,18px)} 100%{transform:translate(40px,30px)} }
        @keyframes nebula-drift-6 { 0%{transform:translate(-48px,-12px)} 100%{transform:translate(-36px,4px)} }
        @keyframes disk-spin-0 { to{transform:rotate(360deg)} }
        @keyframes disk-spin-1 { to{transform:rotate(-360deg)} }
        @keyframes disk-spin-2 { to{transform:rotate(360deg) scaleY(0.9)} }
        @keyframes disk-spin-3 { to{transform:rotate(-360deg) scaleY(0.85)} }
        @keyframes disk-spin-4 { to{transform:rotate(360deg) scaleY(0.8)} }
        @keyframes particle-twinkle {
          0%,100%{opacity:0.5;transform:scale(1)}
          50%{opacity:1;transform:scale(1.7)}
        }
        @keyframes jet-pulse {
          0%,100%{opacity:0.7;filter:blur(4px)}
          50%{opacity:1;filter:blur(2px)}
        }
        @keyframes shockwave {
          0% { width:12px;height:12px;opacity:0.95;border-width:2px }
          100% { width:320px;height:320px;opacity:0;border-width:0.5px }
        }
        @keyframes shockwave2 {
          0% { width:8px;height:8px;opacity:0.7;border-width:1.5px }
          100% { width:200px;height:200px;opacity:0;border-width:0.4px }
        }
        @keyframes nebula-core-pulse {
          0%,100%{transform:scale(1)} 50%{transform:scale(1.07)}
        }
        @keyframes status-breathe {
          0%,100%{opacity:0.7} 50%{opacity:1}
        }
        ${Array.from({ length: 8 })
          .map((_, i) => {
            const a = (i / 8) * 360 + i * 37
            const dist = 100 + i * 15
            const tx = Math.cos((a * Math.PI) / 180) * dist
            const ty = Math.sin((a * Math.PI) / 180) * dist
            return `@keyframes burst-${i} {
              0%   { transform: translate(-50%,-50%) scale(0.4); opacity: 1; }
              70%  { opacity: 0.9; }
              100% { transform: translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0); opacity: 0; }
            }`
          })
          .join("")}
      `}</style>
    </div>
  )
}
