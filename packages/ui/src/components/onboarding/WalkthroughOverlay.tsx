import { useEffect, useLayoutEffect, useState } from "react"
import type { WalkthroughStep } from "./walkthrough-steps"
import { Button } from "@/components/ui/button"

interface WalkthroughOverlayProps {
  readonly steps: ReadonlyArray<WalkthroughStep>
  readonly currentStep: number
  readonly onNext: () => void
  readonly onDismiss: () => void
}

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const HOLE_PADDING = 8
const CARD_OFFSET = 14
const CARD_WIDTH = 320

function readTargetRect(testId: string): Rect | null {
  if (typeof document === "undefined") return null
  const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function placeCard(rect: Rect, placement: WalkthroughStep["placement"]): { top: number; left: number } {
  const vw = typeof window === "undefined" ? 1200 : window.innerWidth
  const vh = typeof window === "undefined" ? 800 : window.innerHeight
  switch (placement) {
    case "bottom":
      return {
        top: Math.min(rect.top + rect.height + CARD_OFFSET, vh - 220),
        left: Math.max(16, Math.min(rect.left + rect.width / 2 - CARD_WIDTH / 2, vw - CARD_WIDTH - 16)),
      }
    case "top":
      return {
        top: Math.max(16, rect.top - CARD_OFFSET - 180),
        left: Math.max(16, Math.min(rect.left + rect.width / 2 - CARD_WIDTH / 2, vw - CARD_WIDTH - 16)),
      }
    case "left":
      return {
        top: Math.max(16, rect.top + rect.height / 2 - 90),
        left: Math.max(16, rect.left - CARD_WIDTH - CARD_OFFSET),
      }
    case "right":
      return {
        top: Math.max(16, rect.top + rect.height / 2 - 90),
        left: Math.min(rect.left + rect.width + CARD_OFFSET, vw - CARD_WIDTH - 16),
      }
  }
}

export function WalkthroughOverlay({
  steps,
  currentStep,
  onNext,
  onDismiss,
}: WalkthroughOverlayProps) {
  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1
  const [rect, setRect] = useState<Rect | null>(null)

  useLayoutEffect(() => {
    if (!step) return
    setRect(readTargetRect(step.targetTestId))
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
    <div className="fixed inset-0 z-50" data-testid="walkthrough-overlay">
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
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
        <rect width="100%" height="100%" fill="rgba(7,9,15,0.7)" mask="url(#walkthrough-mask)" />
        {rect && (
          <rect
            x={rect.left - holePadding}
            y={rect.top - holePadding}
            width={rect.width + holePadding * 2}
            height={rect.height + holePadding * 2}
            rx={10}
            fill="none"
            stroke="rgba(96,165,250,0.9)"
            strokeWidth={2}
            style={{ filter: "drop-shadow(0 0 12px rgba(96,165,250,0.8))" }}
          />
        )}
      </svg>
      <div
        style={{
          position: "absolute",
          top: cardPos?.top ?? "50%",
          left: cardPos?.left ?? "50%",
          transform: cardPos ? "none" : "translate(-50%, -50%)",
          width: CARD_WIDTH,
          background: "rgba(18,24,39,0.96)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14,
          padding: 18,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          color: "#F5F7FB",
        }}
      >
        <div className="mb-1 flex items-center justify-between">
          <div style={{ fontSize: 15, fontWeight: 600 }}>{step.title}</div>
          <span style={{ fontSize: 11, color: "#9AA4B8", fontFamily: "'JetBrains Mono', monospace" }}>
            {currentStep + 1} / {steps.length}
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#9AA4B8", lineHeight: 1.5, margin: "8px 0 14px" }}>
          {step.description}
        </p>
        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={onDismiss} data-testid="walkthrough-dismiss">
            Skip tour
          </Button>
          <Button size="sm" onClick={onNext} data-testid="walkthrough-next">
            {isLastStep ? "Got it" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  )
}
