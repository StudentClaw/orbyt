import { useEffect, useMemo, useRef, useState } from "react"
import type { RuntimeStartupState } from "@/rpc/runtimeStartupState"
import { OrbytMark } from "./OrbytMark"

interface AppStartupScreenProps {
  readonly state: RuntimeStartupState
  readonly onRetry: () => void
  readonly dismissing?: boolean
  readonly fadeDurationMs?: number
}

const TOKENS = {
  bg: "#01040a",
  text: "#F5F7FB",
  textDim: "#9AA4B8",
  textFaint: "#5C6678",
  blueSoft: "#60A5FA",
  line: "rgba(255,255,255,0.08)",
} as const

const STAGE_MESSAGES: ReadonlyArray<string> = [
  "Connecting to Orbyt…",
  "Picking up where we left off…",
  "Wrangling assignments into orbit…",
  "Filing the ones due tomorrow first…",
  "Pretending we didn't see the late ones…",
  "Aligning the stars…",
]

const Starfield = () => {
  const stars = useMemo(
    () =>
      Array.from({ length: 38 }, (_, i) => ({
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

interface ParticleFieldProps {
  readonly count?: number
  readonly paused?: boolean
}

const ParticleField = ({ count = 120, paused = false }: ParticleFieldProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let W = 0
    let H = 0
    let cx = 0
    let cy = 0
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      W = Math.max(1, r.width)
      H = Math.max(1, r.height)
      cx = W / 2
      cy = H / 2
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = "#050912"
      ctx.fillRect(0, 0, W, H)
    }
    resize()
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(resize)
      ro.observe(canvas)
    }
    window.addEventListener("resize", resize)

    const palette: ReadonlyArray<readonly [number, number, number]> = [
      [116, 176, 255],
      [0, 110, 254],
      [0, 66, 152],
      [180, 210, 255],
      [255, 255, 255],
    ]

    const TAU = Math.PI * 2
    const particles = Array.from({ length: count }, () => {
      const ringBias = Math.random()
      const baseR = 70 + Math.pow(ringBias, 0.7) * 280
      const cIdx = Math.random() < 0.06 ? 4 : Math.floor(Math.random() * 3)
      const [r, g, b] = palette[cIdx]
      return {
        a: Math.random() * TAU,
        rBase: baseR,
        rJitter: 4 + Math.random() * 14,
        rPhase: Math.random() * TAU,
        rSpeed: 0.4 + Math.random() * 0.9,
        w: (0.06 + 0.18 / Math.sqrt(baseR / 80)) * 0.55,
        size: 0.4 + Math.pow(Math.random(), 2) * 2.2,
        rgb: [r, g, b] as const,
        alpha: 0.25 + Math.random() * 0.55,
        twPhase: Math.random() * TAU,
        twSpeed: 0.6 + Math.random() * 1.6,
        squashY: 0.62,
        trail: Math.random() < 0.18,
        prevX: 0,
        prevY: 0,
      }
    })

    let t0 = performance.now()
    const cosT = Math.cos(-0.42)
    const sinT = Math.sin(-0.42)

    const step = (now: number) => {
      if (pausedRef.current) {
        t0 = now
        rafRef.current = requestAnimationFrame(step)
        return
      }
      const dt = Math.min(0.05, (now - t0) / 1000)
      t0 = now

      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = "rgba(1, 4, 10, 0.28)"
      ctx.fillRect(0, 0, W, H)

      ctx.globalCompositeOperation = "lighter"

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.a += p.w * dt
        p.rPhase += p.rSpeed * dt

        const r = p.rBase + Math.sin(p.rPhase) * p.rJitter
        const lx = Math.cos(p.a) * r
        const ly = Math.sin(p.a) * r * p.squashY
        const x = cx + lx * cosT - ly * sinT
        const y = cy + lx * sinT + ly * cosT

        p.twPhase += p.twSpeed * dt
        const tw = 0.65 + 0.35 * Math.sin(p.twPhase)
        const a = p.alpha * tw

        const [r0, g0, b0] = p.rgb

        if (p.trail && p.prevX !== 0) {
          ctx.strokeStyle = `rgba(${r0},${g0},${b0},${a * 0.35})`
          ctx.lineWidth = p.size * 0.9
          ctx.lineCap = "round"
          ctx.beginPath()
          ctx.moveTo(p.prevX, p.prevY)
          ctx.lineTo(x, y)
          ctx.stroke()
        }

        const glow = ctx.createRadialGradient(x, y, 0, x, y, p.size * 4)
        glow.addColorStop(0, `rgba(${r0},${g0},${b0},${a})`)
        glow.addColorStop(0.4, `rgba(${r0},${g0},${b0},${a * 0.35})`)
        glow.addColorStop(1, `rgba(${r0},${g0},${b0},0)`)
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(x, y, p.size * 4, 0, TAU)
        ctx.fill()

        ctx.fillStyle = `rgba(${r0},${g0},${b0},${Math.min(1, a * 1.5)})`
        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, TAU)
        ctx.fill()

        p.prevX = x
        p.prevY = y
      }

      rafRef.current = requestAnimationFrame(step)
    }
    step(performance.now())

    return () => {
      cancelAnimationFrame(rafRef.current)
      if (ro) ro.disconnect()
      window.removeEventListener("resize", resize)
    }
  }, [count])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
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

const KEYFRAMES = `
  @keyframes sf-twinkle { 0%,100% { opacity: inherit; transform: scale(1); } 50% { opacity: 1; transform: scale(1.3); } }
  @keyframes orbyt-bob      { 0%,100% { translate: 0 0px; } 50% { translate: 0 8px; } }
  @keyframes orbyt-breathe  { 0%,100% { scale: 1; } 50% { scale: 1.035; } }
  @keyframes orbyt-twinkle  {
    0%, 100% { scale: 1;    opacity: 1;   }
    45%      { scale: 0.5;  opacity: 0.5; }
    50%      { scale: 0.35; opacity: 0.3; }
    55%      { scale: 0.5;  opacity: 0.5; }
  }
  @keyframes glow-well { 0%,100% { transform: scale(0.94); } 50% { transform: scale(1.07); } }
  @keyframes dot-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
  @keyframes loader-shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }
  @keyframes startup-bloom {
    0%   { opacity: 0; transform: scale(0.4); }
    30%  { opacity: 1; }
    100% { opacity: 0; transform: scale(1.6); }
  }
`

export function AppStartupScreen({
  state,
  onRetry,
  dismissing = false,
  fadeDurationMs = 600,
}: AppStartupScreenProps) {
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
        opacity: dismissing ? 0 : 1,
        transition: `opacity ${fadeDurationMs}ms ease-out`,
        pointerEvents: dismissing ? "none" : "auto",
      }}
    >
      <style>{KEYFRAMES}</style>
      <Starfield />

      {/* top-left wordmark */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 28,
          zIndex: 5,
          opacity: isReady ? 0 : 0.72,
          transition: "opacity 0.5s",
        }}
      >
        <svg
          width="90"
          height="31"
          viewBox="0 0 350 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M46.592 95.104C39.5094 95.104 33.1094 93.9093 27.392 91.52C21.6747 89.0453 16.768 85.6747 12.672 81.408C8.66134 77.1413 5.54667 72.192 3.328 66.56C1.10934 60.928 0 54.912 0 48.512C0 42.1973 1.10934 36.224 3.328 30.592C5.54667 24.96 8.66134 20.0107 12.672 15.744C16.768 11.4773 21.6747 8.14933 27.392 5.75999C33.1094 3.37066 39.5094 2.17599 46.592 2.17599C53.6747 2.17599 60.0747 3.37066 65.792 5.75999C71.5094 8.14933 76.3734 11.4773 80.384 15.744C84.48 20.0107 87.6374 24.96 89.856 30.592C92.0747 36.224 93.184 42.24 93.184 48.64C93.184 54.9547 92.0747 60.928 89.856 66.56C87.6374 72.192 84.48 77.1413 80.384 81.408C76.3734 85.6747 71.5094 89.0453 65.792 91.52C60.0747 93.9093 53.6747 95.104 46.592 95.104ZM46.592 84.224C51.456 84.224 55.9787 83.328 60.16 81.536C64.3414 79.744 67.968 77.2267 71.04 73.984C74.1974 70.7413 76.6294 66.9867 78.336 62.72C80.0427 58.368 80.896 53.632 80.896 48.512C80.896 43.4773 80.0427 38.784 78.336 34.432C76.6294 30.08 74.24 26.3253 71.168 23.168C68.096 19.9253 64.4267 17.4507 60.16 15.744C55.9787 13.952 51.456 13.056 46.592 13.056C41.6427 13.056 37.0774 13.952 32.896 15.744C28.7147 17.4507 25.088 19.9253 22.016 23.168C18.944 26.3253 16.5547 30.08 14.848 34.432C13.1414 38.784 12.288 43.52 12.288 48.64C12.288 53.6747 13.1414 58.368 14.848 62.72C16.5547 66.9867 18.944 70.7413 22.016 73.984C25.088 77.2267 28.7147 79.744 32.896 81.536C37.0774 83.328 41.6427 84.224 46.592 84.224ZM107.459 93.44V46.72C107.459 40.9173 109.08 36.3947 112.323 33.152C115.651 29.824 120.216 28.16 126.019 28.16H139.459V38.272H128.195C125.379 38.272 123.16 39.0827 121.539 40.704C120.003 42.3253 119.235 44.5867 119.235 47.488V93.44H107.459ZM183.367 94.976C177.052 94.976 171.378 93.6107 166.343 90.88C161.308 88.1493 157.298 84.224 154.311 79.104C151.41 73.8987 149.959 67.6693 149.959 60.416V0H161.735V39.808H161.991C163.442 37.1627 165.319 34.8587 167.623 32.896C170.012 30.9333 172.7 29.3973 175.687 28.288C178.759 27.1787 181.959 26.624 185.287 26.624C191.346 26.624 196.764 27.9893 201.543 30.72C206.322 33.4507 210.076 37.3333 212.807 42.368C215.623 47.3173 217.031 53.2053 217.031 60.032C217.031 65.408 216.178 70.272 214.471 74.624C212.85 78.8907 210.546 82.56 207.559 85.632C204.572 88.704 201.031 91.0507 196.935 92.672C192.839 94.208 188.316 94.976 183.367 94.976ZM183.367 84.864C187.378 84.864 191.004 83.8827 194.247 81.92C197.575 79.9573 200.22 77.184 202.183 73.6C204.146 70.016 205.127 65.7493 205.127 60.8C205.127 56.0213 204.146 51.84 202.183 48.256C200.306 44.672 197.746 41.856 194.503 39.808C191.26 37.76 187.591 36.736 183.495 36.736C179.484 36.736 175.815 37.7173 172.487 39.68C169.244 41.6427 166.642 44.4587 164.679 48.128C162.802 51.712 161.863 55.9787 161.863 60.928C161.863 65.792 162.802 70.016 164.679 73.6C166.642 77.184 169.244 79.9573 172.487 81.92C175.815 83.8827 179.442 84.864 183.367 84.864ZM256.797 119.424V94.464C252.018 93.7813 247.752 92.2027 243.997 89.728C240.328 87.168 237.426 83.8827 235.293 79.872C233.16 75.776 232.093 71.1253 232.093 65.92V28.16H243.997V65.792C243.997 69.7173 244.85 73.1307 246.557 76.032C248.264 78.848 250.525 81.024 253.341 82.56C256.242 84.096 259.314 84.864 262.557 84.864C265.885 84.864 268.957 84.096 271.773 82.56C274.674 81.024 276.978 78.848 278.685 76.032C280.477 73.1307 281.373 69.7173 281.373 65.792V28.16H293.149V65.92C293.149 71.1253 292.082 75.7333 289.949 79.744C287.901 83.7547 285 87.04 281.245 89.6C277.576 92.0747 273.352 93.696 268.573 94.464V119.424H256.797ZM334.115 93.44C328.312 93.44 323.747 91.776 320.419 88.448C317.176 85.12 315.555 80.5973 315.555 74.88V11.776H327.331V74.112C327.331 76.928 328.099 79.1893 329.635 80.896C331.256 82.5173 333.475 83.328 336.291 83.328H349.475V93.44H334.115ZM304.291 38.272V28.16H349.731V38.272H304.291Z"
            fill="white"
          />
        </svg>
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

      {/* center stage — particles + logo */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          paddingTop: "6%",
          paddingBottom: "2%",
          minHeight: 0,
        }}
      >
        <ParticleField count={120} paused={isReady || isError} />

        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse 180% 130% at 50% 44%, rgba(6,16,38,0.6) 0%, rgba(3,8,20,0.35) 45%, transparent 75%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(0,110,254,0.22) 0%, rgba(0,110,254,0.14) 22%, rgba(0,110,254,0.07) 44%, rgba(0,110,254,0.025) 65%, transparent 82%)",
            filter: "blur(14px)",
            animation: "glow-well 4.4s ease-in-out infinite",
            opacity: isReady ? 0 : 1,
            transition: "opacity 0.5s",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 2 }}>
          <OrbytMark size={180} expanded={isReady} />
        </div>
      </div>

      {/* bottom panel */}
      <div
        style={{
          padding: "0 52px 48px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          opacity: isReady ? 0 : 1,
          transform: isReady ? "translateY(10px)" : "translateY(0)",
          transition: "opacity 0.45s, transform 0.45s",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 30,
              fontWeight: 400,
              color: TOKENS.text,
              marginBottom: 14,
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
            <StatusLine messages={STAGE_MESSAGES} intervalMs={1400} />
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
          <div
            style={{
              width: 240,
              height: 2,
              borderRadius: 99,
              background: "rgba(255,255,255,0.07)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: "40%",
                background:
                  "linear-gradient(90deg, transparent, #74B0FF, #006EFE, transparent)",
                animation: "loader-shimmer 1.8s ease-in-out infinite",
                boxShadow: "0 0 10px rgba(0,110,254,0.55)",
              }}
            />
          </div>
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
