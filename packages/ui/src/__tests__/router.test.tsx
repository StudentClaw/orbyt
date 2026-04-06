import { describe, test, expect } from "vitest"
import { router } from "../router"

describe("Router", () => {
  test("router is defined", () => {
    expect(router).toBeDefined()
  })

  test("router has all expected routes", () => {
    const routes = router.routeTree.children
    const paths = routes?.map((r: any) => r.path ?? r.options?.path) ?? []
    // TanStack Router stores child paths without leading slash (except root)
    expect(paths).toContain("/")
    expect(paths).toContain("chat")
    expect(paths).toContain("onboarding")
    expect(paths).toContain("settings")
    expect(paths).toContain("activity")
  })
})
