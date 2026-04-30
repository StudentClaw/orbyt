import { useEffect, useState } from "react"
import { DNA_TOKENS, MONO, SERIF } from "./tokens"

interface TypingBubblesProps {
  bubbles: string[]
  dnaHue: number
  isTyping: boolean
  flipSize?: boolean
}

export function TypingBubbles({ bubbles, dnaHue, isTyping, flipSize = false }: TypingBubblesProps) {
  const T = DNA_TOKENS
  const [revealed, setRevealed] = useState<number[]>(
    isTyping ? bubbles.map(() => 0) : bubbles.map((b) => b.length),
  )
  const [activeIdx, setActiveIdx] = useState(isTyping ? 0 : bubbles.length)

  useEffect(() => {
    if (!isTyping) {
      setRevealed(bubbles.map((b) => b.length))
      setActiveIdx(bubbles.length)
      return
    }
    setRevealed(bubbles.map(() => 0))
    setActiveIdx(0)

    let bIdx = 0
    let cIdx = 0
    let interval: ReturnType<typeof setInterval>

    const startTyping = () => {
      interval = setInterval(() => {
        if (bIdx >= bubbles.length) {
          clearInterval(interval)
          return
        }
        cIdx++
        setRevealed((r) => {
          const next = [...r]
          next[bIdx] = cIdx
          return next
        })
        if (cIdx >= bubbles[bIdx]!.length) {
          bIdx++
          cIdx = 0
          setActiveIdx(bIdx)
          clearInterval(interval)
          if (bIdx < bubbles.length) {
            setTimeout(startTyping, 220)
          }
        }
      }, 22)
    }

    const t = setTimeout(startTyping, 350)
    return () => {
      clearTimeout(t)
      clearInterval(interval)
    }
  // bubbles identity is stable per step; join is a cheap stable key
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bubbles.join("|"), isTyping])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
      {bubbles.map((b, i) => {
        const isBig = flipSize ? i === 0 : i === bubbles.length - 1
        const text = b.slice(0, revealed[i] ?? 0)
        const isActive = i === activeIdx && (revealed[i] ?? 0) < b.length
        return (
          <div
            key={i}
            style={{
              fontFamily: SERIF,
              fontSize: isBig ? 50 : 24,
              fontStyle: isBig ? "normal" : "italic",
              fontWeight: 400,
              color: isBig ? T.text : "rgba(245,247,251,0.78)",
              lineHeight: 1.1,
              letterSpacing: isBig ? "-0.025em" : "-0.01em",
              minHeight: isBig ? 56 : 30,
            }}
          >
            {text}
            {isActive && (
              <span
                style={{
                  display: "inline-block",
                  width: isBig ? 3 : 2,
                  height: isBig ? 44 : 22,
                  background: `oklch(0.75 0.22 ${dnaHue})`,
                  marginLeft: 3,
                  verticalAlign: "text-bottom",
                  animation: "caret-blink 0.8s steps(2) infinite",
                  boxShadow: `0 0 8px oklch(0.7 0.22 ${dnaHue})`,
                }}
              />
            )}
          </div>
        )
      })}
      <style>{`@keyframes caret-blink { 50% { opacity: 0; } }`}</style>
    </div>
  )
}

// Re-export MONO so callers that need it can import from this file
export { MONO }
