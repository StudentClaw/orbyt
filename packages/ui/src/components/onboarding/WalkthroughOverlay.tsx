import { useEffect, useLayoutEffect, useState } from "react"
import type { WalkthroughStep } from "./walkthrough-steps"
import { OrbytMark } from "../runtime/OrbytMark"

interface WalkthroughOverlayProps {
  readonly steps: ReadonlyArray<WalkthroughStep>
  readonly currentStep: number
  readonly onNext: () => void
  readonly onDismiss: () => void
  readonly onBack?: () => void
  readonly glow?: number
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const HOLE_PADDING = 8
const CARD_OFFSET = 16
const CARD_WIDTH = 420
const CARD_HEIGHT = 260

// Tolerance in px when grouping siblings into the same visual "row" by their
// top coordinate (covers sub-pixel layout variance and animation jitter).
const ROW_TOLERANCE_PX = 8

function clampRectToViewport(r: {
  top: number
  left: number
  right: number
  bottom: number
}): Rect | null {
  if (typeof window === "undefined") return null
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.max(HOLE_PADDING, r.left)
  const top = Math.max(HOLE_PADDING, r.top)
  const right = Math.min(vw - HOLE_PADDING, r.right)
  const bottom = Math.min(vh - HOLE_PADDING, r.bottom)
  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)
  if (width <= 0 || height <= 0) return null
  return { top, left, width, height }
}

function readFirstRowRect(rowSelector: string): Rect | null {
  if (typeof document === "undefined") return null
  const els = Array.from(document.querySelectorAll<HTMLElement>(rowSelector))
  if (els.length === 0) return null
  const rects = els.map((el) => el.getBoundingClientRect())
  const minTop = Math.min(...rects.map((r) => r.top))
  const firstRow = rects.filter((r) => r.top - minTop <= ROW_TOLERANCE_PX)
  if (firstRow.length === 0) return null
  return clampRectToViewport({
    top: Math.min(...firstRow.map((r) => r.top)),
    left: Math.min(...firstRow.map((r) => r.left)),
    right: Math.max(...firstRow.map((r) => r.right)),
    bottom: Math.max(...firstRow.map((r) => r.bottom)),
  })
}

function readTargetRect(testId: string): Rect | null {
  if (typeof document === "undefined") return null
  // Special target: the bounding box of the topmost row of plugin cards.
  if (testId === "settings-plugin-first-row") {
    return readFirstRowRect('[data-testid^="settings-plugin-row-"]')
  }
  const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return clampRectToViewport({ top: r.top, left: r.left, right: r.right, bottom: r.bottom })
}

function placeCard(
  rect: Rect,
  placement: WalkthroughStep["placement"],
): { top: number; left: number } {
  const vw = typeof window === "undefined" ? 1200 : window.innerWidth
  const vh = typeof window === "undefined" ? 800 : window.innerHeight
  const clampLeft = (left: number): number =>
    Math.max(16, Math.min(left, vw - CARD_WIDTH - 16))
  const clampTop = (top: number): number =>
    Math.max(16, Math.min(top, vh - CARD_HEIGHT - 16))

  switch (placement) {
    case "bottom":
      return {
        top: clampTop(rect.top + rect.height + CARD_OFFSET),
        left: clampLeft(rect.left + rect.width / 2 - CARD_WIDTH / 2),
      }
    case "top":
      return {
        top: clampTop(rect.top - CARD_OFFSET - CARD_HEIGHT),
        left: clampLeft(rect.left + rect.width / 2 - CARD_WIDTH / 2),
      }
    case "left":
      return {
        top: clampTop(rect.top + rect.height / 2 - CARD_HEIGHT / 2),
        left: clampLeft(rect.left - CARD_WIDTH - CARD_OFFSET),
      }
    case "right":
      return {
        top: clampTop(rect.top + rect.height / 2 - CARD_HEIGHT / 2),
        left: clampLeft(rect.left + rect.width + CARD_OFFSET),
      }
  }
}

export function WalkthroughOverlay({
  steps,
  currentStep,
  onNext,
  onDismiss,
  onBack,
}: WalkthroughOverlayProps) {
  const step = steps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1
  const [rect, setRect] = useState<Rect | null>(null)

  useLayoutEffect(() => {
    if (!step) return
    setRect(readTargetRect(step.targetTestId))
  }, [step])

  // Continuously refresh the rect while a step is active. The previous step
  // may have just navigated to another route (anchor not yet mounted), and
  // the page may also be running entrance animations (e.g. the dashboard
  // header translates ~10px in over 440ms). A one-shot read captures the
  // pre-animation position; this poll keeps the spotlight aligned.
  useEffect(() => {
    if (!step) return
    const POLL_MS = 80
    const id = window.setInterval(() => {
      const next = readTargetRect(step.targetTestId)
      if (!next) return
      setRect((current) => {
        if (
          current &&
          current.top === next.top &&
          current.left === next.left &&
          current.width === next.width &&
          current.height === next.height
        ) {
          return current
        }
        return next
      })
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [step])

  useEffect(() => {
    if (!step) return
    const handleResize = (): void => setRect(readTargetRect(step.targetTestId))
    window.addEventListener("resize", handleResize)
    window.addEventListener("scroll", handleResize, true)
    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("scroll", handleResize, true)
    }
  }, [step])

  if (!step) return null

  const cardPos = rect ? placeCard(rect, step.placement) : null
  const holePadding = HOLE_PADDING

  return (
    <div className="fixed inset-0 z-[100]" data-testid="walkthrough-overlay">
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <defs>
          <mask id="walkthrough-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - holePadding}
                y={rect.top - holePadding}
                width={rect.width + holePadding * 2}
                height={rect.height + holePadding * 2}
                rx={10}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(7,9,15,0.7)"
          mask="url(#walkthrough-mask)"
        />
        {rect && (
          <rect
            x={rect.left - holePadding}
            y={rect.top - holePadding}
            width={rect.width + holePadding * 2}
            height={rect.height + holePadding * 2}
            rx={10}
            fill="none"
            stroke="rgba(96,165,250,0.85)"
            strokeWidth={2}
            style={{
              filter: "drop-shadow(0 0 12px rgba(96,165,250,0.7))",
              animation: "walkthrough-pulse 2.4s ease-in-out infinite",
            }}
          />
        )}
      </svg>

      <div
        data-testid="walkthrough-card"
        style={{
          position: "absolute",
          top: cardPos?.top ?? "50%",
          left: cardPos?.left ?? "50%",
          transform: cardPos ? "none" : "translate(-50%, -50%)",
          width: CARD_WIDTH,
          background: "rgba(13, 17, 32, 0.96)",
          border: "1px solid rgba(96,165,250,0.22)",
          borderRadius: 18,
          padding: "22px 24px",
          boxShadow:
            "0 28px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), 0 0 44px rgba(59,130,246,0.22)",
          color: "#F5F7FB",
          backdropFilter: "blur(14px)",
          transition:
            "top 0.5s cubic-bezier(0.4,0.05,0.2,1), left 0.5s cubic-bezier(0.4,0.05,0.2,1)",
          animation: "walkthrough-card-in 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center">
            <OrbytMark size={40} />
          </div>
          <div className="flex-1">
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Orby · {currentStep + 1} / {steps.length}
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            data-testid="walkthrough-dismiss"
            className="rounded-full px-3 py-1.5 text-xs font-medium transition"
            style={{ color: "rgba(255,255,255,0.6)", background: "rgba(255,255,255,0.06)" }}
          >
            Skip tour
          </button>
        </div>

        <div
          style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", marginBottom: 10, lineHeight: 1.2 }}
        >
          {step.title}
        </div>
        <p
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.78)",
            lineHeight: 1.55,
            margin: "0 0 20px",
          }}
        >
          {step.description}
        </p>

        <div className="flex items-center gap-3">
          <div
            className="flex flex-1 items-center gap-1.5"
            data-testid="walkthrough-progress"
          >
            {steps.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === currentStep ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  background:
                    i <= currentStep ? "rgb(59,130,246)" : "rgba(255,255,255,0.15)",
                  transition: "all 0.4s",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onBack}
            disabled={isFirstStep || !onBack}
            data-testid="walkthrough-back"
            className="rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ color: "rgba(255,255,255,0.7)", background: "transparent" }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            data-testid="walkthrough-next"
            className="rounded-full px-6 py-2 text-sm font-semibold text-white transition"
            style={{
              background: "rgb(59,130,246)",
              boxShadow: "0 4px 18px rgba(59,130,246,0.45)",
            }}
          >
            {isLastStep ? "Got it" : "Next"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes walkthrough-pulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 0.55; }
        }
        @keyframes walkthrough-card-in {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
