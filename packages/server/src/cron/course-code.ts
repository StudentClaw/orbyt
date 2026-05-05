/**
 * Reduce a Canvas course identifier to the chunk students recognize.
 *
 * Canvas course strings come back like `2025FA_CS38_INTRO_PROGRAMMING`.
 * Only the second underscore-separated segment (`CS38`) is meaningful in
 * student-facing copy. When the input does not have at least two
 * underscores, return it unchanged so we never mangle a clean code.
 */
export function simplifyCourseCode(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0) return raw
  const parts = raw.split("_")
  if (parts.length < 3) return raw
  const second = parts[1]
  if (!second || second.length === 0) return raw
  return second
}
