import { useEffect, useMemo, useState } from "react"
import type { RuntimeStartupState } from "@/rpc/runtimeStartupState"

interface AppStartupScreenProps {
  readonly state: RuntimeStartupState
  readonly onRetry: () => void
}

const TOKENS = {
  bg: "#0A0E1A",
  text: "#F5F7FB",
  textDim: "#9AA4B8",
  textFaint: "#5C6678",
  blueSoft: "#60A5FA",
  line: "rgba(255,255,255,0.08)",
} as const

const STAGE_LABEL = "Connecting to Orbyt"

const STAGE_MESSAGES: ReadonlyArray<string> = [
  "Knocking on the door…",
  "Handshake in progress…",
  "Verifying it's really you…",
  "Picking up where we left off…",
  "Rehydrating your conversations…",
  "Dusting off yesterday's threads…",
  "Wrangling assignments into orbit…",
  "Filing the ones due tomorrow first…",
  "Pretending we didn't see the late ones…",
]

function resolveProgress(state: RuntimeStartupState): number {
  if (state.phase === "bootstrapping") return 0.1
  if (state.phase === "connecting") return 0.25
  if (state.phase === "ready") return 1
  // hydrating: nudge further along when canvas data is being fetched
  const haystack = `${state.label} ${state.detail}`.toLowerCase()
  if (haystack.includes("course") || haystack.includes("canvas")) return 0.8
  return 0.55
}

const Starfield = () => {
  const stars = useMemo(
    () =>
      Array.from({ length: 95 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: Math.random() * 1.6 + 0.3,
        op: Math.random() * 0.5 + 0.15,
        tw: 2.5 + Math.random() * 5,
        dl: Math.random() * 5,
      })),
    [],
  )
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {stars.map((s) => (
        <div
          key={s.id}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.s,
            height: s.s,
            borderRadius: "50%",
            background: "white",
            opacity: s.op,
            boxShadow: s.s > 1.2 ? `0 0 ${s.s * 3}px rgba(255,255,255,0.5)` : "none",
            animation: `sf-twinkle ${s.tw}s ease-in-out ${s.dl}s infinite`,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 28% 38%, rgba(59,130,246,0.07), transparent 52%), radial-gradient(ellipse at 72% 72%, rgba(99,102,241,0.05), transparent 58%)",
        }}
      />
    </div>
  )
}

interface OrbProps {
  readonly expanded: boolean
}

const Orb = ({ expanded }: OrbProps) => {
  const S = 128
  return (
    <div
      style={{
        width: S,
        height: S,
        position: "relative",
        display: "grid",
        placeItems: "center",
        transform: expanded ? "scale(11)" : "scale(1)",
        opacity: expanded ? 0 : 1,
        filter: expanded ? "blur(28px)" : "none",
        transition:
          "transform 1.3s cubic-bezier(0.65,0,0.35,1), opacity 1.3s ease-out, filter 1.3s ease-out",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -S * 0.45,
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.65 0.2 235 / 0.3) 0%, transparent 60%)",
          filter: "blur(26px)",
          animation: "orb-breathe 4.5s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: S,
          height: S * 0.3,
          border: "1.5px solid oklch(0.7 0.18 235 / 0.6)",
          borderRadius: "50%",
          animation: "orb-r0 14s linear infinite",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -3,
            top: "50%",
            transform: "translateY(-50%)",
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "oklch(0.88 0.2 235)",
            boxShadow: "0 0 12px oklch(0.85 0.2 235)",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          width: S * 1.2,
          height: S * 0.36,
          border: "1px solid oklch(0.7 0.18 220 / 0.3)",
          borderRadius: "50%",
          animation: "orb-r1 22s linear infinite",
        }}
      />
      <div
        style={{
          width: S * 0.42,
          height: S * 0.42,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 30%, oklch(0.92 0.13 235) 0%, oklch(0.6 0.22 235) 55%, oklch(0.32 0.2 270) 100%)",
          boxShadow:
            "0 0 30px oklch(0.65 0.2 235 / 0.7), inset -6px -6px 16px oklch(0.3 0.15 270 / 0.6)",
          position: "relative",
          animation: "orb-pulse 3.4s ease-in-out infinite",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "12%",
            left: "18%",
            width: "28%",
            height: "22%",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.55)",
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background:
              "conic-gradient(from 0deg, transparent, oklch(0.95 0.05 235 / 0.14), transparent 50%, oklch(0.4 0.15 270 / 0.22), transparent)",
            animation: "orb-surf 11s linear infinite",
            mixBlendMode: "overlay",
          }}
        />
      </div>
    </div>
  )
}

interface StatusLineProps {
  readonly messages: ReadonlyArray<string>
  readonly intervalMs?: number
}

const StatusLine = ({ messages, intervalMs = 1500 }: StatusLineProps) => {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
    if (messages.length <= 1) return
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), intervalMs)
    return () => clearInterval(t)
  }, [messages, intervalMs])

  return (
    <div style={{ position: "relative", height: 28, overflow: "visible" }}>
      {messages.map((m, i) => (
        <div
          key={`${m}-${i}`}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform:
              i === idx
                ? "translate(-50%, -50%)"
                : i < idx
                  ? "translate(-50%, calc(-50% - 12px))"
                  : "translate(-50%, calc(-50% + 12px))",
            display: "block",
            textAlign: "center",
            fontSize: 14,
            color: TOKENS.textDim,
            fontStyle: "italic",
            opacity: i === idx ? 1 : 0,
            transition: "opacity 0.45s, transform 0.45s cubic-bezier(0.34,1.56,0.64,1)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {m}
        </div>
      ))}
    </div>
  )
}

interface ProgressRailProps {
  readonly label: string
  readonly progress: number
  readonly complete: boolean
}

const ProgressRail = ({ label, progress, complete }: ProgressRailProps) => {
  const fill = complete ? 1 : Math.max(0.05, Math.min(progress, 0.95))
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        width: "100%",
        maxWidth: 560,
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          flexShrink: 0,
          background: "oklch(0.78 0.18 235)",
          boxShadow: "0 0 16px oklch(0.78 0.2 235 / 0.9)",
          transform: complete ? "scale(1)" : "scale(1.3)",
          transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
          animation: complete ? "none" : "seg-dot-pulse 1.4s ease-in-out infinite",
        }}
      />
      <div
        style={{
          fontSize: 16,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 0.6,
          flexShrink: 0,
          color: TOKENS.text,
          transition: "color 0.4s",
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          height: 5,
          borderRadius: 99,
          background: "rgba(255,255,255,0.07)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 99,
            background: complete
              ? "oklch(0.78 0.18 235)"
              : "linear-gradient(90deg, oklch(0.78 0.18 235), oklch(0.65 0.18 235))",
            width: `${fill * 100}%`,
            transition: "width 0.6s cubic-bezier(0.65,0,0.35,1)",
            boxShadow: "0 0 10px oklch(0.78 0.2 235 / 0.7)",
          }}
        />
        {!complete && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 99,
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
              animation: "rail-shimmer 2s linear infinite",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      <div
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          opacity: complete ? 1 : 0,
          transform: complete ? "scale(1)" : "scale(0.5)",
          transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6.5L5 9.5L10 3.5"
            stroke="oklch(0.85 0.18 235)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  )
}

const KEYFRAMES = `
  @keyframes sf-twinkle { 0%,100% { opacity: inherit; transform: scale(1); } 50% { opacity: 1; transform: scale(1.3); } }
  @keyframes orb-breathe { 0%,100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.12); opacity: 1; } }
  @keyframes orb-pulse   { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
  @keyframes orb-surf    { to { transform: rotate(360deg); } }
  @keyframes orb-r0 { from { transform: rotateZ(-25deg) rotate(0deg); } to { transform: rotateZ(-25deg) rotate(360deg); } }
  @keyframes orb-r1 { from { transform: rotateZ(15deg) rotate(0deg); }  to { transform: rotateZ(15deg) rotate(-360deg); } }
  @keyframes seg-dot-pulse { 0%,100% { box-shadow: 0 0 12px oklch(0.78 0.2 235 / 0.9); } 50% { box-shadow: 0 0 20px oklch(0.78 0.2 235); } }
  @keyframes rail-shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  @keyframes glow-well { 0%,100% { transform: scale(0.94); } 50% { transform: scale(1.07); } }
  @keyframes dot-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
  @keyframes startup-bloom {
    0%   { opacity: 0; transform: scale(0.4); }
    30%  { opacity: 1; }
    100% { opacity: 0; transform: scale(1.6); }
  }
`

export function AppStartupScreen({ state, onRetry }: AppStartupScreenProps) {
  const progress = resolveProgress(state)
  const isError = state.phase === "error"
  const isReady = state.phase === "ready"
  const headline = isError ? state.label : "Getting everything ready"
  const detail = isError ? (state.error ?? state.detail) : null

  return (
    <div
      data-testid="app-startup-screen"
      style={{
        position: "fixed",
        inset: 0,
        background: TOKENS.bg,
        color: TOKENS.text,
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        zIndex: 100,
      }}
    >
      <style>{KEYFRAMES}</style>
      <Starfield />

      {/* top-left brand */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 32,
          zIndex: 5,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: TOKENS.textFaint,
          opacity: isReady ? 0 : 0.55,
          transition: "opacity 0.5s",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 40 40" fill="none">
          <ellipse
            cx="20"
            cy="22"
            rx="18"
            ry="5"
            stroke={TOKENS.blueSoft}
            strokeWidth="2.5"
            transform="rotate(-25 20 22)"
            fill="none"
            opacity="0.85"
          />
          <circle cx="20" cy="20" r="8" fill={TOKENS.blueSoft} />
        </svg>
        Orbyt
      </div>

      {/* top-right status indicator */}
      <div
        style={{
          position: "absolute",
          top: 32,
          right: 32,
          zIndex: 5,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: isError ? "#fca5a5" : TOKENS.textFaint,
          opacity: isReady ? 0 : 1,
          transition: "opacity 0.4s",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: isError ? "#ef4444" : TOKENS.blueSoft,
            boxShadow: `0 0 8px ${isError ? "#ef4444" : TOKENS.blueSoft}`,
            animation: isError ? "none" : "dot-blink 1.5s ease-in-out infinite",
          }}
        />
        {isError ? "error" : "loading"}
      </div>

      {/* center orb */}
      <div style={{ flex: 1, display: "grid", placeItems: "center", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(96,165,250,0.14), transparent 65%)",
            filter: "blur(6px)",
            animation: "glow-well 3.6s ease-in-out infinite",
            opacity: isReady ? 0 : 1,
            transition: "opacity 0.5s",
          }}
        />
        <Orb expanded={isReady} />
      </div>

      {/* bottom panel */}
      <div
        style={{
          padding: "0 52px 52px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
          opacity: isReady ? 0 : 1,
          transform: isReady ? "translateY(10px)" : "translateY(0)",
          transition: "opacity 0.45s, transform 0.45s",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 27,
              fontWeight: 400,
              color: TOKENS.text,
              marginBottom: 10,
              letterSpacing: -0.3,
            }}
          >
            {headline}
          </div>
          {isError ? (
            <div style={{ fontSize: 14, color: TOKENS.textDim, fontStyle: "italic" }}>
              {detail ?? "The local runtime did not finish booting."}
            </div>
          ) : (
            <StatusLine messages={STAGE_MESSAGES} intervalMs={1500} />
          )}
        </div>

        {isError ? (
          <button
            type="button"
            onClick={onRetry}
            data-testid="app-startup-retry"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${TOKENS.line}`,
              color: TOKENS.text,
              padding: "10px 22px",
              borderRadius: 999,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            ↺ Retry
          </button>
        ) : (
          <ProgressRail label={STAGE_LABEL} progress={progress} complete={isReady} />
        )}
      </div>

      {/* bloom on reveal */}
      {isReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 50% 50%, rgba(96,165,250,0.55), transparent 60%)",
            animation: "startup-bloom 1.3s ease-out forwards",
          }}
        />
      )}
    </div>
  )
}
