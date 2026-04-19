export function normalizeLatex(input: string): string {
  if (input.length === 0) {
    return input
  }

  let result = ""
  let i = 0
  const n = input.length

  while (i < n) {
    if (isFenceStart(input, i)) {
      const fence = input.slice(i, i + 3)
      const fenceEnd = findFenceEnd(input, i + 3, fence)
      result += input.slice(i, fenceEnd)
      i = fenceEnd
      continue
    }

    if (input[i] === "`") {
      const inlineEnd = findInlineCodeEnd(input, i + 1)
      result += input.slice(i, inlineEnd)
      i = inlineEnd
      continue
    }

    if (input[i] === "\\" && i + 1 < n) {
      const next = input[i + 1]
      if (next === "[") {
        const closeIdx = findClosingBracket(input, i + 2, "\\]")
        if (closeIdx !== -1) {
          const body = input.slice(i + 2, closeIdx)
          result += `$$${body}$$`
          i = closeIdx + 2
          continue
        }
      } else if (next === "(") {
        const closeIdx = findClosingBracket(input, i + 2, "\\)")
        if (closeIdx !== -1) {
          const body = input.slice(i + 2, closeIdx)
          result += `$${body}$`
          i = closeIdx + 2
          continue
        }
      }
    }

    result += input[i]
    i += 1
  }

  return result
}

function isFenceStart(input: string, idx: number): boolean {
  if (input[idx] !== "`" || input[idx + 1] !== "`" || input[idx + 2] !== "`") {
    return false
  }
  return idx === 0 || input[idx - 1] === "\n"
}

function findFenceEnd(input: string, from: number, fence: string): number {
  const n = input.length
  let i = from
  while (i < n) {
    if (input[i] === "\n") {
      if (input[i + 1] === fence[0] && input[i + 2] === fence[1] && input[i + 3] === fence[2]) {
        return i + 4
      }
    }
    i += 1
  }
  return n
}

function findInlineCodeEnd(input: string, from: number): number {
  const n = input.length
  let i = from
  while (i < n) {
    if (input[i] === "\n") {
      return i
    }
    if (input[i] === "`") {
      return i + 1
    }
    i += 1
  }
  return n
}

function findClosingBracket(input: string, from: number, close: string): number {
  const n = input.length
  let i = from
  while (i < n - 1) {
    if (input[i] === close[0] && input[i + 1] === close[1]) {
      return i
    }
    i += 1
  }
  return -1
}
