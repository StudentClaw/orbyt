import { describe, expect, test } from "vitest"
import {
  COMPOSER_FOOTER_COMPACT_BREAKPOINT_PX,
  shouldUseCompactComposerFooter,
} from "@/lib/composerFooterLayout"

describe("composer footer layout", () => {
  test("does not compact when width cannot be measured", () => {
    expect(shouldUseCompactComposerFooter(null)).toBe(false)
    expect(shouldUseCompactComposerFooter(0)).toBe(false)
  })

  test("compacts only below the measured breakpoint", () => {
    expect(shouldUseCompactComposerFooter(COMPOSER_FOOTER_COMPACT_BREAKPOINT_PX - 1)).toBe(true)
    expect(shouldUseCompactComposerFooter(COMPOSER_FOOTER_COMPACT_BREAKPOINT_PX)).toBe(false)
  })
})
