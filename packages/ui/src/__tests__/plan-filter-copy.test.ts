import { describe, expect, test } from "vitest"
import { getPlanFilterCopy } from "../components/dashboard/plan-filter-copy"

describe("getPlanFilterCopy", () => {
  test("returns planning labels for dashboard filters", () => {
    expect(getPlanFilterCopy("today").planLabel).toBe("Plan my day")
    expect(getPlanFilterCopy("thisWeek").planLabel).toBe("Plan my week")
    expect(getPlanFilterCopy("upcoming").planLabel).toBe("Plan my upcoming work")
    expect(getPlanFilterCopy("overdue").planLabel).toBe("Plan my overdue work")
    expect(getPlanFilterCopy("submitted").planLabel).toBe("Plan my submitted work")
  })
})
