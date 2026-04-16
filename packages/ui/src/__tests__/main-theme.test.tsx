import { beforeEach, describe, expect, test, vi } from "vitest"

const renderSpy = vi.hoisted(() => vi.fn())
const createRootSpy = vi.hoisted(() => vi.fn(() => ({ render: renderSpy })))

vi.mock("react-dom/client", () => ({
  createRoot: createRootSpy,
}))

vi.mock("../App", () => ({
  default: () => <div data-testid="app-root" />,
}))

describe("main theme bootstrap", () => {
  beforeEach(() => {
    vi.resetModules()
    createRootSpy.mockClear()
    renderSpy.mockClear()
    document.documentElement.className = ""
    document.body.innerHTML = '<div id="root"></div>'
    window.localStorage.clear()
  })

  test("applies the saved dark theme before the app renders", async () => {
    window.localStorage.setItem("sc-theme", "dark")
    renderSpy.mockImplementationOnce(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    })

    await import("../main")

    expect(createRootSpy).toHaveBeenCalledWith(document.getElementById("root"))
    expect(renderSpy).toHaveBeenCalledOnce()
  })
})
