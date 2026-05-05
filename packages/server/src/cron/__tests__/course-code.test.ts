import { describe, test, expect } from "bun:test"
import { simplifyCourseCode } from "../course-code.js"

describe("simplifyCourseCode", () => {
  test("returns the segment between the first and second underscore", () => {
    expect(simplifyCourseCode("2025FA_CS38_INTRO_PROGRAMMING")).toBe("CS38")
  })

  test("handles long suffixes with extra underscores", () => {
    expect(simplifyCourseCode("2026SP_PHYS4B_LAB_SECTION_3_HONORS")).toBe(
      "PHYS4B",
    )
  })

  test("returns input unchanged when there are fewer than two underscores", () => {
    expect(simplifyCourseCode("CS38")).toBe("CS38")
    expect(simplifyCourseCode("MATH_201")).toBe("MATH_201")
  })

  test("returns input unchanged when the middle segment is empty", () => {
    expect(simplifyCourseCode("__SUFFIX")).toBe("__SUFFIX")
  })

  test("empty input passes through", () => {
    expect(simplifyCourseCode("")).toBe("")
  })
})
