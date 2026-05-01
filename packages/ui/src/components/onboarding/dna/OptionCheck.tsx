import type { ReactNode } from "react"
import {
  BarChart3,
  BatteryLow,
  BookOpen,
  BrainCog,
  Clock,
  CloudRain,
  CloudSun,
  Coffee,
  Dices,
  FlaskConical,
  Flame,
  Headphones,
  Moon,
  Palette,
  PenTool,
  Shuffle,
  Sparkles,
  Stethoscope,
  Sun,
  Sunrise,
  Sunset,
  Target,
  Telescope,
  TrendingUp,
  User,
  Users,
  Waves,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { DNA_TOKENS } from "./tokens"

const ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  BatteryLow,
  BookOpen,
  BrainCog,
  Clock,
  CloudRain,
  CloudSun,
  Coffee,
  Dices,
  FlaskConical,
  Flame,
  Headphones,
  Moon,
  Palette,
  PenTool,
  Shuffle,
  Sparkles,
  Stethoscope,
  Sun,
  Sunrise,
  Sunset,
  Target,
  Telescope,
  TrendingUp,
  User,
  Users,
  Waves,
  Wind,
  Wrench,
  Zap,
}

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
  const Icon = icon ? ICON_MAP[icon] : undefined
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 14,
        padding: "16px 20px",
        borderRadius: 14,
        border: `1.5px solid ${selected ? `oklch(0.7 0.2 ${dnaHue} / 0.6)` : T.lineStrong}`,
        background: selected
          ? `linear-gradient(135deg, oklch(0.25 0.12 ${dnaHue} / 0.5), oklch(0.18 0.08 ${(dnaHue + 60) % 360} / 0.3))`
          : "rgba(255,255,255,0.025)",
        color: T.text,
        fontSize: 16,
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
      {Icon && (
        <span style={{
          width: 36,
          height: 36,
          display: "grid",
          placeItems: "center",
          background: selected
            ? `linear-gradient(135deg, oklch(0.55 0.22 ${dnaHue} / 0.7), oklch(0.4 0.18 ${(dnaHue + 60) % 360} / 0.5))`
            : "rgba(255,255,255,0.05)",
          border: selected
            ? `1px solid oklch(0.75 0.22 ${dnaHue} / 0.6)`
            : "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          color: selected ? `oklch(0.95 0.1 ${dnaHue})` : "rgba(255,255,255,0.85)",
          transition: "all 0.25s",
          boxShadow: selected ? `0 0 14px oklch(0.6 0.22 ${dnaHue} / 0.45)` : "none",
        }}>
          <Icon size={18} strokeWidth={2.1} />
        </span>
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
