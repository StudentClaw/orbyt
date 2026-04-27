import { useMemo, useState } from "react"
import {
  DNA_QUESTIONS,
  buildStudyDna,
  ORBY_MCQ_REACTIONS,
  ORBY_OPEN_REACTIONS,
  type DnaQuestion,
} from "@orbyt/shared"
import type { OnboardingAnswers, StudentDna } from "@orbyt/contracts"
import { OptionCheck } from "../dna/OptionCheck"
import { DenseParticles } from "../dna/DenseParticles"
import { TypingBubbles } from "../dna/TypingBubbles"
import { ReactionBubble } from "../dna/ReactionBubble"
import { DNA_TOKENS, MONO, SERIF } from "../dna/tokens"
import orbytLogo from "@/assets/orbyt-logo.svg"

type TransitionPhase = "idle" | "reacting" | "typing"

interface DnaDiscoveryPhaseProps {
  initialAnswers?: Partial<OnboardingAnswers>
  onAnswersChange: (answers: Partial<OnboardingAnswers>) => void
  onComplete: (answers: OnboardingAnswers) => void
  onLiveDnaChange: (dna: StudentDna) => void
  onAnswerSubmitted?: () => void
  skipName?: boolean
}

export function DnaDiscoveryPhase({
  initialAnswers,
  onAnswersChange,
  onComplete,
  onLiveDnaChange,
  onAnswerSubmitted,
  skipName = false,
}: DnaDiscoveryPhaseProps) {
  const T = DNA_TOKENS
  const activeQuestions = useMemo(
    () => skipName ? DNA_QUESTIONS.filter((q) => q.id !== "name") : DNA_QUESTIONS,
    [skipName],
  )
  const initialIndex = useMemo(() => {
    if (skipName) return 1
    if (!initialAnswers) return 0
    const keys = Object.keys(initialAnswers) as Array<keyof OnboardingAnswers>
    return Math.min(keys.length, activeQuestions.length)
  }, [initialAnswers, skipName, activeQuestions])

  const [step, setStep] = useState(initialIndex)
  const [answers, setAnswersState] = useState<Partial<OnboardingAnswers>>(initialAnswers ?? {})
  const [textInput, setTextInput] = useState("")
  const [pendingChoice, setPendingChoice] = useState<string | null>(null)
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>("idle")
  const [reaction, setReaction] = useState<{ text: string; key: number } | null>(null)

  if (step === 0 && Object.keys(answers).length === 0) {
    return (
      <WelcomeSplit
        questionCount={activeQuestions.length}
        onStart={() => setStep(1)}
      />
    )
  }

  const currentQ: DnaQuestion = activeQuestions[step - 1]!
  const bubbles = typeof currentQ.bubbles === "function" ? currentQ.bubbles(answers) : currentQ.bubbles
  const phaseLabel = currentQ.phase === "open" ? "Open response" : "Multiple choice"
  const dna = buildStudyDna(answers)

  const canContinue =
    transitionPhase === "idle" &&
    (currentQ.type === "choice" ? pendingChoice !== null : textInput.trim().length > 0)

  const goNext = () => {
    if (transitionPhase !== "idle") return
    const value = currentQ.type === "choice" ? pendingChoice! : textInput.trim()
    if (!value) return

    // Determine reaction text
    let reactionText: string
    if (currentQ.type === "choice") {
      reactionText = ORBY_MCQ_REACTIONS[currentQ.id]?.[value] ?? "Got it."
    } else {
      reactionText = ORBY_OPEN_REACTIONS[currentQ.id] ?? "Got it. That tells me a lot."
    }

    // Save answer
    const next = { ...answers, [currentQ.id]: value } as Partial<OnboardingAnswers>
    setAnswersState(next)
    onAnswersChange(next)
    onLiveDnaChange(buildStudyDna(next))
    onAnswerSubmitted?.()

    // Show reaction for 2.8s
    setReaction({ text: reactionText, key: Date.now() })
    setTransitionPhase("reacting")

    setTimeout(() => {
      setPendingChoice(null)
      setTextInput("")
      setReaction(null)

      if (step === activeQuestions.length) {
        onComplete(next as OnboardingAnswers)
        return
      }

      setStep((s) => s + 1)
      setTransitionPhase("typing")
      setTimeout(() => setTransitionPhase("idle"), 1400)
    }, 2800)
  }

  const goBack = () => {
    if (transitionPhase !== "idle") return
    setPendingChoice(null)
    setTextInput("")
    setStep((s) => Math.max(0, s - 1))
  }

  const answered = Object.keys(answers).length

  return (
    <div
      style={{
        padding: "48px 52px 28px",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* background particle layer */}
      <DenseParticles density={130} hue={dna.hue} intensity={0.55} />

      {/* content layer sits above particles */}
      <div style={{ position: "relative", zIndex: 2, display: "contents" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <img src={orbytLogo} alt="Orbyt" style={{ height: 28 }} />
          <ProgressDots total={activeQuestions.length} current={step - 1} hue={dna.hue} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 520 }}>
          <div
            key={`label-${step}`}
            style={{
              fontSize: 10,
              letterSpacing: "0.15em",
              color: T.textFaint,
              textTransform: "uppercase",
              fontFamily: MONO,
              marginBottom: 12,
              animation: "fade-up 0.4s",
              willChange: "transform, opacity",
            }}
          >
            {step} / {activeQuestions.length} · {phaseLabel}
          </div>

          {/* Typing bubbles (character-by-character when typing phase) */}
          <TypingBubbles
            key={`bubbles-${step}`}
            bubbles={bubbles}
            dnaHue={dna.hue}
            isTyping={transitionPhase === "typing"}
            flipSize={currentQ.type === "text"}
          />

          {/* Orby reaction — replaces options during reacting phase */}
          {transitionPhase === "reacting" && reaction && (
            <ReactionBubble
              text={reaction.text}
              dnaHue={dna.hue}
              keyVal={reaction.key}
            />
          )}

          {/* MCQ options — hidden during reaction, fade in after typing */}
          {currentQ.type === "choice" && transitionPhase !== "reacting" && (
            <div
              key={`opts-${step}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 9,
                opacity: transitionPhase === "typing" ? 0 : 1,
                transform: transitionPhase === "typing" ? "translateY(8px)" : "translateY(0)",
                transition: "opacity 0.5s 0.6s, transform 0.5s 0.6s",
                pointerEvents: transitionPhase === "typing" ? "none" : "auto",
              }}
            >
              {currentQ.options.map((opt, i) => {
                const isSelected = pendingChoice !== null ? pendingChoice === opt.v : answers[currentQ.id as keyof typeof answers] === opt.v
                return (
                  <OptionCheck
                    key={opt.v}
                    icon={opt.icon}
                    delay={transitionPhase === "typing" ? 0.7 + i * 0.04 : 0.05 + i * 0.04}
                    selected={isSelected}
                    onClick={() => {
                      if (transitionPhase === "idle") setPendingChoice(opt.v)
                    }}
                    dnaHue={dna.hue}
                  >
                    {opt.label}
                  </OptionCheck>
                )
              })}
            </div>
          )}

          {/* Open-ended textarea — hidden during reaction, fade in after typing */}
          {currentQ.type === "text" && transitionPhase !== "reacting" && (
            <form
              key={`f-${step}`}
              onSubmit={(e) => {
                e.preventDefault()
                goNext()
              }}
              style={{
                opacity: transitionPhase === "typing" ? 0 : 1,
                transform: transitionPhase === "typing" ? "translateY(8px)" : "translateY(0)",
                transition: "opacity 0.5s 0.6s, transform 0.5s 0.6s",
                pointerEvents: transitionPhase === "typing" ? "none" : "auto",
              }}
            >
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    goNext()
                  }
                }}
                placeholder={currentQ.placeholder}
                autoFocus={transitionPhase === "idle"}
                rows={currentQ.multiline ? 4 : 1}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${textInput.trim() ? `oklch(0.7 0.2 ${dna.hue}/0.6)` : T.lineStrong}`,
                  borderRadius: 14,
                  outline: "none",
                  color: T.text,
                  fontSize: 22,
                  fontFamily: SERIF,
                  padding: "14px 16px",
                  resize: "none",
                  lineHeight: 1.4,
                  transition: "border-color 0.3s",
                  boxShadow: textInput.trim() ? `0 0 0 2px oklch(0.6 0.2 ${dna.hue}/0.2)` : "none",
                }}
              />
              <div style={{ marginTop: 8, fontSize: 11, color: T.textFaint, fontFamily: MONO }}>
                {currentQ.multiline ? "↵ to send · Shift+↵ for new line" : "↵ to send"}
              </div>
            </form>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {step > 1 && transitionPhase === "idle" && (
              <button onClick={goBack} style={ghostBtnStyle}>
                ← Back
              </button>
            )}
            <span style={{ fontSize: 12, color: T.textFaint, fontFamily: MONO }}>
              {answered} / {activeQuestions.length} answered
            </span>
          </div>
          <button
            onClick={goNext}
            disabled={!canContinue}
            style={{
              padding: "14px 32px",
              borderRadius: 999,
              border: canContinue ? "none" : `1.5px solid ${T.lineStrong}`,
              background: canContinue
                ? `linear-gradient(135deg, oklch(0.55 0.22 ${dna.hue}), oklch(0.45 0.2 ${dna.accentHue}))`
                : "rgba(255,255,255,0.04)",
              color: canContinue ? "white" : T.textFaint,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: canContinue ? "pointer" : "not-allowed",
              boxShadow: canContinue ? `0 8px 28px oklch(0.5 0.22 ${dna.hue}/0.5)` : "none",
              transition: "all 0.35s",
            }}
          >
            {step === activeQuestions.length ? "Reveal my DNA →" : "Continue →"}
          </button>
        </div>
      </div>

      <style>{`@keyframes fade-up { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  )
}

function WelcomeSplit({ questionCount, onStart }: { questionCount: number; onStart: () => void }) {
  const T = DNA_TOKENS
  return (
    <div
      style={{
        padding: "60px 56px 44px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img src={orbytLogo} alt="Orbyt" style={{ height: 30 }} />
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            color: T.blueSoft,
            textTransform: "uppercase",
            fontFamily: MONO,
            marginBottom: 18,
          }}
        >
          Building your study profile
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 66,
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
            margin: "0 0 24px",
            fontWeight: 400,
          }}
        >
          {questionCount} questions.
          <br />
          <em
            style={{
              fontStyle: "italic",
              background: "linear-gradient(135deg,#60A5FA,#A78BFA)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            One Study DNA.
          </em>
        </h1>
        <p style={{ fontSize: 17, color: T.textDim, lineHeight: 1.6, margin: "0 0 30px", maxWidth: 440 }}>
          Your answers build something alive on the right — revealed at the end. No right or wrong.
        </p>
        <button
          onClick={onStart}
          style={{
            padding: "18px 40px",
            borderRadius: 999,
            border: "none",
            background: `linear-gradient(135deg, ${T.blue}, ${T.purpleDeep})`,
            color: "white",
            fontSize: 18,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            boxShadow: "0 8px 32px rgba(59,130,246,0.45)",
          }}
        >
          Start →
        </button>
      </div>
      <div style={{ fontSize: 12, color: T.textFaint }}>Takes about 3 minutes.</div>
    </div>
  )
}

function ProgressDots({ total, current, hue }: { total: number; current: number; hue: number }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 24 : 6,
            height: 6,
            borderRadius: 3,
            background: i <= current ? `oklch(0.65 0.2 ${hue})` : "rgba(255,255,255,0.15)",
            transition: "all 0.4s",
          }}
        />
      ))}
    </div>
  )
}

const ghostBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: DNA_TOKENS.textDim,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
}
