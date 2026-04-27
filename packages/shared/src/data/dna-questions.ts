import type { OnboardingAnswers } from "@orbyt/contracts"

export type QuestionId = keyof OnboardingAnswers

export interface QuestionOption {
  v: string
  label: string
  icon: string
}

export type QuestionPhase = "mcq" | "open"
export type QuestionType = "text" | "choice"
export type OrbMood = "idle" | "listening" | "thinking" | "happy" | "curious"

export interface ChoiceQuestion {
  id: QuestionId
  type: "choice"
  orb: OrbMood
  bubbles: string[] | ((ctx: Partial<OnboardingAnswers>) => string[])
  options: QuestionOption[]
  phase: QuestionPhase
}

export interface TextQuestion {
  id: QuestionId
  type: "text"
  orb: OrbMood
  bubbles: string[] | ((ctx: Partial<OnboardingAnswers>) => string[])
  placeholder: string
  multiline?: boolean
  phase: QuestionPhase
}

export type DnaQuestion = ChoiceQuestion | TextQuestion

export const DNA_QUESTIONS: ReadonlyArray<DnaQuestion> = [
  {
    id: "name",
    type: "text",
    orb: "listening",
    bubbles: ["Hi — I'm Orby.", "What's your name?"],
    placeholder: "Your name…",
    phase: "mcq",
  },
  {
    id: "field",
    type: "choice",
    orb: "curious",
    bubbles: (ctx) => [`Nice to meet you, ${ctx.name || "friend"}.`, "What do you study?"],
    options: [
      { v: "stem", label: "STEM / Engineering", icon: "🧪" },
      { v: "humanities", label: "Humanities", icon: "📚" },
      { v: "business", label: "Business", icon: "📊" },
      { v: "arts", label: "Arts & Design", icon: "🎨" },
      { v: "health", label: "Health / Pre-med", icon: "🩺" },
      { v: "mix", label: "A bit of everything", icon: "🌀" },
    ],
    phase: "mcq",
  },
  {
    id: "struggle",
    type: "choice",
    orb: "thinking",
    bubbles: ["What trips you up most?"],
    options: [
      { v: "procrastination", label: "I procrastinate", icon: "⏰" },
      { v: "focus", label: "Can't focus long", icon: "🌀" },
      { v: "overwhelm", label: "Too much to juggle", icon: "🌊" },
      { v: "motivation", label: "Motivation dips", icon: "🔋" },
      { v: "memory", label: "I forget things", icon: "🫠" },
      { v: "stress", label: "Stress gets me", icon: "💭" },
    ],
    phase: "mcq",
  },
  {
    id: "motivation",
    type: "choice",
    orb: "curious",
    bubbles: ["What keeps you going?"],
    options: [
      { v: "grades", label: "Grades & GPA", icon: "📈" },
      { v: "mastery", label: "Love of learning", icon: "✨" },
      { v: "career", label: "Future career", icon: "🎯" },
      { v: "people", label: "Proving people wrong", icon: "🔥" },
      { v: "streak", label: "My streak", icon: "⚡" },
      { v: "curious", label: "Curiosity", icon: "🔭" },
    ],
    phase: "mcq",
  },
  {
    id: "peak",
    type: "choice",
    orb: "happy",
    bubbles: ["When does your brain peak?"],
    options: [
      { v: "dawn", label: "Crack of dawn", icon: "🌅" },
      { v: "morning", label: "Mid-morning", icon: "☀️" },
      { v: "afternoon", label: "After lunch", icon: "🌤" },
      { v: "evening", label: "Evening", icon: "🌆" },
      { v: "night", label: "Night", icon: "🌙" },
      { v: "chaos", label: "Chaos", icon: "🎲" },
    ],
    phase: "mcq",
  },
  {
    id: "style",
    type: "choice",
    orb: "thinking",
    bubbles: ["How do you study best?"],
    options: [
      { v: "alone", label: "Alone in silence", icon: "🧘" },
      { v: "music", label: "Headphones, lo-fi", icon: "🎧" },
      { v: "group", label: "With friends", icon: "👯" },
      { v: "cafe", label: "Café noise", icon: "☕" },
      { v: "visual", label: "Visual notes", icon: "🎨" },
      { v: "doing", label: "By doing", icon: "🛠" },
    ],
    phase: "mcq",
  },
  {
    id: "secretLove",
    type: "text",
    orb: "curious",
    bubbles: ["A class you secretly love — or hate?", "Why?"],
    placeholder: "Organic Chem. The puzzles, not the hours…",
    multiline: true,
    phase: "open",
  },
  {
    id: "wishBetter",
    type: "text",
    orb: "thinking",
    bubbles: ["What do you wish you were better at?"],
    placeholder: "Reading without re-reading three times…",
    multiline: true,
    phase: "open",
  },
  {
    id: "pastHabit",
    type: "text",
    orb: "curious",
    bubbles: ["A study habit that worked — or failed spectacularly?"],
    placeholder: "All-nighters. They ruined finals week…",
    multiline: true,
    phase: "open",
  },
  {
    id: "forWho",
    type: "text",
    orb: "listening",
    bubbles: ["Who are you doing this for?"],
    placeholder: "Me. My family. My future self…",
    multiline: true,
    phase: "open",
  },
  {
    id: "successLook",
    type: "text",
    orb: "happy",
    bubbles: ["What does a successful semester look like?", "Be specific."],
    placeholder: "A- in calc. No 3am panic. Two Saturdays off…",
    multiline: true,
    phase: "open",
  },
]
