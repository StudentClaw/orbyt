const FALLBACK_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

// FNV-1a-ish string hash; stable across renders, no crypto needed.
function hash(id: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

/**
 * Resolve an accent color for a course. Prefers the Canvas-provided color,
 * otherwise deterministically picks a chart color from the palette so each
 * course reads as visually distinct without collapsing to grayscale.
 */
export function courseAccentColor(courseId: string, courseColor?: string): string {
  if (courseColor) return courseColor
  return FALLBACK_PALETTE[hash(courseId) % FALLBACK_PALETTE.length]
}
