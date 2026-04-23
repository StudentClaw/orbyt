import { describe, expect, test } from "bun:test"
import { createId, noop, sleepMs } from "./index.js"

describe("@orbyt/shared-runtime", () => {
  test("creates prefixed ids", () => {
    expect(createId("thread")).toStartWith("thread_")
  })

  test("sleep resolves and noop is callable", async () => {
    noop()
    await expect(sleepMs(1)).resolves.toBeUndefined()
  })
})
