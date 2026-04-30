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
      { v: "stem", label: "STEM / Engineering", icon: "FlaskConical" },
      { v: "humanities", label: "Humanities", icon: "BookOpen" },
      { v: "business", label: "Business", icon: "BarChart3" },
      { v: "arts", label: "Arts & Design", icon: "Palette" },
      { v: "health", label: "Health / Pre-med", icon: "Stethoscope" },
      { v: "mix", label: "A bit of everything", icon: "Shuffle" },
    ],
    phase: "mcq",
  },
  {
    id: "struggle",
    type: "choice",
    orb: "thinking",
    bubbles: ["What trips you up most?"],
    options: [
      { v: "procrastination", label: "I procrastinate", icon: "Clock" },
      { v: "focus", label: "Can't focus long", icon: "Wind" },
      { v: "overwhelm", label: "Too much to juggle", icon: "Waves" },
      { v: "motivation", label: "Motivation dips", icon: "BatteryLow" },
      { v: "memory", label: "I forget things", icon: "BrainCog" },
      { v: "stress", label: "Stress gets me", icon: "CloudRain" },
    ],
    phase: "mcq",
  },
  {
    id: "motivation",
    type: "choice",
    orb: "curious",
    bubbles: ["What keeps you going?"],
    options: [
      { v: "grades", label: "Grades & GPA", icon: "TrendingUp" },
      { v: "mastery", label: "Love of learning", icon: "Sparkles" },
      { v: "career", label: "Future career", icon: "Target" },
      { v: "people", label: "Proving people wrong", icon: "Flame" },
      { v: "streak", label: "My streak", icon: "Zap" },
      { v: "curious", label: "Curiosity", icon: "Telescope" },
    ],
    phase: "mcq",
  },
  {
    id: "peak",
    type: "choice",
    orb: "happy",
    bubbles: ["When does your brain peak?"],
    options: [
      { v: "dawn", label: "Crack of dawn", icon: "Sunrise" },
      { v: "morning", label: "Mid-morning", icon: "Sun" },
      { v: "afternoon", label: "After lunch", icon: "CloudSun" },
      { v: "evening", label: "Evening", icon: "Sunset" },
      { v: "night", label: "Night", icon: "Moon" },
      { v: "chaos", label: "Chaos", icon: "Dices" },
    ],
    phase: "mcq",
  },
  {
    id: "style",
    type: "choice",
    orb: "thinking",
    bubbles: ["How do you study best?"],
    options: [
      { v: "alone", label: "Alone in silence", icon: "User" },
      { v: "music", label: "Headphones, lo-fi", icon: "Headphones" },
      { v: "group", label: "With friends", icon: "Users" },
      { v: "cafe", label: "Café noise", icon: "Coffee" },
      { v: "visual", label: "Visual notes", icon: "PenTool" },
      { v: "doing", label: "By doing", icon: "Wrench" },
    ],
    phase: "mcq",
  },
  {
    id: "secretLove",
    type: "text",
    orb: "curious",
    bubbles: ["A class you secretly hate?", "Why?"],
    placeholder: "Organic Chem. The hours, the rote memorization…",
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
    bubbles: ["A study habit that works for you?"],
    placeholder: "Pomodoros with my phone in another room…",
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
