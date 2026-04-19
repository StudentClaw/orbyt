import { describe, expect, it } from "vitest"
import { normalizeLatex } from "@/lib/markdown/normalizeLatex"

describe("normalizeLatex", () => {
  it("rewrites display-math \\[...\\] to $$...$$", () => {
    const input = "Use Faraday's law.\n\\[ B(t)=\\mu_0\\frac{N_s}{L}I(t) \\]\nNext"
    expect(normalizeLatex(input)).toBe(
      "Use Faraday's law.\n$$ B(t)=\\mu_0\\frac{N_s}{L}I(t) $$\nNext",
    )
  })

  it("rewrites inline-math \\(...\\) to $...$", () => {
    expect(normalizeLatex("value is \\(\\omega=2\\pi f\\) here")).toBe(
      "value is $\\omega=2\\pi f$ here",
    )
  })

  it("leaves plain dollar math untouched", () => {
    const s = "inline $x^2$ and $$y=mx+b$$"
    expect(normalizeLatex(s)).toBe(s)
  })

  it("does not rewrite inside a fenced code block", () => {
    const s = "```\n\\[ not-math \\]\n```\nafter"
    expect(normalizeLatex(s)).toBe(s)
  })

  it("does not rewrite inside inline code", () => {
    const s = "use `\\[x\\]` literally"
    expect(normalizeLatex(s)).toBe(s)
  })

  it("leaves an unterminated \\[ alone", () => {
    const s = "start \\[ no close"
    expect(normalizeLatex(s)).toBe(s)
  })

  it("handles multiple display-math blocks", () => {
    const s = "\\[ a \\]\nand\n\\[ b \\]"
    expect(normalizeLatex(s)).toBe("$$ a $$\nand\n$$ b $$")
  })
})
