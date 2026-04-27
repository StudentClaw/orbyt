import { beforeEach, describe, expect, test, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import type { RuntimeStartupState } from "../rpc/runtimeStartupState"

const appMocks = vi.hoisted(() => ({
  startupState: {
    phase: "bootstrapping",
    label: "Starting Orbyt",
    detail: "Connecting to Orbyt",
    error: null,
  } as RuntimeStartupState,
  hydrationComplete: true,
  onboardingComplete: true,
  startAppRuntime: vi.fn().mockResolvedValue(undefined),
  routerNavigate: vi.fn(),
  routerPathname: "/",
}))

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => undefined,
}))

vi.mock("../hooks/useAppRuntime", () => ({
  useRuntimeStartupState: () => appMocks.startupState,
  useIsServerHydrationComplete: () => appMocks.hydrationComplete,
  useIsOnboardingComplete: () => appMocks.onboardingComplete,
}))

vi.mock("../rpc/appRuntime", () => ({
  startAppRuntime: appMocks.startAppRuntime,
}))

vi.mock("@tanstack/react-router", () => ({
  RouterProvider: () => <div data-testid="app-router">Router ready</div>,
}))

vi.mock("../components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="tooltip-provider">{children}</div>
  ),
}))

vi.mock("../router", () => ({
  router: {
    get state() {
      return { location: { pathname: appMocks.routerPathname } }
    },
    navigate: appMocks.routerNavigate,
  },
}))

import App from "../App"

describe("App", () => {
  beforeEach(() => {
    appMocks.startAppRuntime.mockClear()
    appMocks.routerNavigate.mockClear()
    appMocks.startupState = {
      phase: "bootstrapping",
      label: "Starting Orbyt",
      detail: "Connecting to Orbyt",
      error: null,
    }
    appMocks.hydrationComplete = true
    appMocks.onboardingComplete = true
    appMocks.routerPathname = "/"
  })

  test("renders the startup screen before the runtime is ready", () => {
    render(<App />)

    expect(screen.getByTestId("app-startup-screen")).toBeDefined()
    expect(screen.queryByTestId("app-router")).toBeNull()
    expect(appMocks.startAppRuntime).toHaveBeenCalledTimes(1)
  })

  test("renders the router once startup is ready", () => {
    appMocks.startupState = {
      phase: "ready",
      label: "Orbyt ready",
      detail: "",
      error: null,
    }

    render(<App />)

    expect(screen.getByTestId("app-router")).toBeDefined()
    expect(screen.queryByTestId("app-startup-screen")).toBeNull()
  })

  test("retries startup from the error screen", () => {
    appMocks.startupState = {
      phase: "error",
      label: "Orbyt couldn't start",
      detail: "Retry the local runtime startup.",
      error: "boom",
    }

    render(<App />)
    fireEvent.click(screen.getByTestId("app-startup-retry"))

    expect(appMocks.startAppRuntime).toHaveBeenCalledTimes(2)
  })
})
