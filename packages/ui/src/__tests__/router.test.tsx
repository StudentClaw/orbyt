import { describe, test, expect } from "vitest"
import { createAppHistory, resolveInitialRouteFromHash } from "../lib/routerHistory"

describe("Router", () => {
  test("uses in-memory routing for file-based Electron builds", () => {
    const history = createAppHistory({ protocol: "file:", hash: "#/chat/workspace-1" })

    expect(history.location.pathname).toBe("/chat/workspace-1")

    history.push("/")
    expect(history.location.pathname).toBe("/")

    history.push("/chat/workspace-1/thread-1")
    expect(history.location.pathname).toBe("/chat/workspace-1/thread-1")
  })

  test("derives the initial route from a file hash when present", () => {
    expect(resolveInitialRouteFromHash("")).toBe("/")
    expect(resolveInitialRouteFromHash("#")).toBe("/")
    expect(resolveInitialRouteFromHash("#/chat")).toBe("/chat")
    expect(resolveInitialRouteFromHash("#/chat/workspace-1/thread-1")).toBe("/chat/workspace-1/thread-1")
    expect(resolveInitialRouteFromHash("#dashboard")).toBe("/")
  })
})
