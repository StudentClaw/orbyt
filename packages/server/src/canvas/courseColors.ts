export const COURSE_COLOR_PALETTE = [
  "oklch(0.68 0.16 18)",
  "oklch(0.72 0.15 42)",
  "oklch(0.78 0.13 78)",
  "oklch(0.72 0.12 145)",
  "oklch(0.68 0.11 195)",
  "oklch(0.63 0.18 255)",
  "oklch(0.66 0.16 310)",
  "oklch(0.72 0.08 25)",
] as const

export function pickRandomCourseColor(random: () => number = Math.random): string {
  const index = Math.floor(random() * COURSE_COLOR_PALETTE.length)
  return COURSE_COLOR_PALETTE[index] ?? COURSE_COLOR_PALETTE[0]
}
