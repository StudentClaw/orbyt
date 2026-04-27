export type ComposerTriggerKind = "slash" | "at"

export type ComposerTrigger = {
  readonly kind: ComposerTriggerKind
  readonly filter: string
}

function lastTokenStart(text: string): number {
  let index = text.length - 1
  while (index >= 0 && !/\s/.test(text[index] ?? "")) {
    index -= 1
  }
  return index + 1
}

export function detectComposerTrigger(textBeforeCursor: string): ComposerTrigger | null {
  const tokenStart = lastTokenStart(textBeforeCursor)
  const token = textBeforeCursor.slice(tokenStart)
  if (token.startsWith("@")) {
    return {
      kind: "at",
      filter: token.slice(1),
    }
  }
  if (token.startsWith("/")) {
    return {
      kind: "slash",
      filter: token.slice(1),
    }
  }
  return null
}

export function replaceTextRange(
  text: string,
  rangeStart: number,
  rangeEnd: number,
  replacement: string,
): { readonly text: string; readonly cursor: number } {
  const safeStart = Math.max(0, Math.min(text.length, rangeStart))
  const safeEnd = Math.max(safeStart, Math.min(text.length, rangeEnd))
  return {
    text: `${text.slice(0, safeStart)}${replacement}${text.slice(safeEnd)}`,
    cursor: safeStart + replacement.length,
  }
}
