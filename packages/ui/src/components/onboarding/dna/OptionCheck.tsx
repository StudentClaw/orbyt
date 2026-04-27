import type { ReactNode } from "react"
import { DNA_TOKENS } from "./tokens"

interface OptionCheckProps {
  selected: boolean
  onClick: () => void
  icon?: string
  delay?: number
  dnaHue?: number
  children: ReactNode
}

export function OptionCheck({ selected, onClick, icon, delay = 0, dnaHue = 220, children }: OptionCheckProps) {
  const T = DNA_TOKENS
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        borderRadius: 14,
        border: `1.5px solid ${selected ? `oklch(0.7 0.2 ${dnaHue} / 0.6)` : T.lineStrong}`,
        background: selected
          ? `linear-gradient(135deg, oklch(0.25 0.12 ${dnaHue} / 0.5), oklch(0.18 0.08 ${(dnaHue + 60) % 360} / 0.3))`
          : "rgba(255,255,255,0.025)",
        color: T.text,
        fontSize: 15,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transform: selected ? "translateX(4px)" : "translateX(0)",
        boxShadow: selected ? `0 8px 32px oklch(0.55 0.2 ${dnaHue} / 0.25), inset 0 1px 0 rgba(255,255,255,0.08)` : "none",
        animation: `opt-in 0.45s cubic-bezier(0.34,1.56,0.64,1) ${delay}s backwards`,
      }}
    >
      {icon && (
        <span style={{
          fontSize: 20,
          width: 32,
          height: 32,
          display: "grid",
          placeItems: "center",
          background: selected ? `oklch(0.3 0.15 ${dnaHue} / 0.6)` : "rgba(255,255,255,0.04)",
          borderRadius: 10,
        }}>{icon}</span>
      )}
      <span style={{ lineHeight: 1.3 }}>{children}</span>
      <span style={{ width: 24, height: 24, position: "relative", display: "grid", placeItems: "center" }}>
        <span style={{
          position: "absolute",
          inset: 0,
          border: `1.5px solid ${selected ? `oklch(0.75 0.2 ${dnaHue})` : "rgba(255,255,255,0.2)"}`,
          borderRadius: "50%",
          transform: "rotateZ(-25deg) scaleY(0.9)",
          boxShadow: selected ? `0 0 12px oklch(0.7 0.22 ${dnaHue} / 0.7)` : "none",
        }} />
        <span style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: selected
            ? `radial-gradient(circle at 35% 30%, oklch(0.9 0.15 ${dnaHue}), oklch(0.6 0.22 ${dnaHue}) 60%, oklch(0.35 0.2 ${(dnaHue + 60) % 360}))`
            : "transparent",
          border: selected ? "none" : "1.5px solid rgba(255,255,255,0.18)",
          transform: selected ? "scale(1)" : "scale(0.85)",
          transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          position: "relative",
          boxShadow: selected ? `0 0 10px oklch(0.7 0.22 ${dnaHue})` : "none",
        }}>
          {selected && (
            <svg viewBox="0 0 14 14" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <path d="M3 7.5 L6 10 L11 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          )}
        </span>
      </span>
      <style>{`@keyframes opt-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </button>
  )
}
