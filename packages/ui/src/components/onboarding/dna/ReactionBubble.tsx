import { useEffect, useState } from "react"
import { DNA_TOKENS, MONO, SERIF } from "./tokens"

interface ReactionBubbleProps {
  text: string
  dnaHue: number
  keyVal: number | string
}

export function ReactionBubble({ text, dnaHue, keyVal }: ReactionBubbleProps) {
  const T = DNA_TOKENS
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    setRevealed(0)
    let i = 0
    const id = setInterval(() => {
      i++
      setRevealed(i)
      if (i >= text.length) clearInterval(id)
    }, 28)
    return () => clearInterval(id)
  }, [text, keyVal])

  const shown = text.slice(0, revealed)
  const isTyping = revealed < text.length

  return (
    <div
      key={keyVal}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animation: "reaction-in 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: `oklch(0.78 0.2 ${dnaHue})`,
          fontFamily: MONO,
        }}
      >
        Orby ›
      </div>
      <div
        style={{
          fontFamily: SERIF,
          fontStyle: "italic",
          fontSize: 32,
          color: T.text,
          lineHeight: 1.2,
          letterSpacing: "-0.015em",
          maxWidth: 540,
        }}
      >
        {shown}
        {isTyping && (
          <span
            style={{
              display: "inline-block",
              width: 3,
              height: 30,
              background: `oklch(0.75 0.22 ${dnaHue})`,
              marginLeft: 4,
              verticalAlign: "text-bottom",
              animation: "caret-blink 0.7s steps(2) infinite",
              boxShadow: `0 0 8px oklch(0.7 0.22 ${dnaHue})`,
            }}
          />
        )}
      </div>
      <style>{`
        @keyframes reaction-in {
          from { opacity: 0; transform: translateY(-6px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
        @keyframes caret-blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  )
}
