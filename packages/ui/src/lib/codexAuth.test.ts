import { beforeEach, describe, expect, test, vi } from "vitest"

const onboardingMocks = vi.hoisted(() => ({
  completeOnboarding: vi.fn(),
  persistOnboardingState: vi.fn(),
  setAiAuthStatus: vi.fn(),
}))

const clientMocks = vi.hoisted(() => ({
  retryInitialize: vi.fn().mockResolvedValue({ started: true }),
  setAiAuth: vi.fn().mockResolvedValue({}),
}))

vi.mock("@/rpc/onboardingState", () => onboardingMocks)

vi.mock("@/rpc/appRuntime", () => ({
  getPrimaryWsRpcClient: () => ({
    onboarding: {
      setAiAuth: clientMocks.setAiAuth,
    },
    provider: {
      retryInitialize: clientMocks.retryInitialize,
    },
  }),
}))

import { connectCodexAccount } from "./codexAuth"

describe("connectCodexAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.electronAPI = {
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      getBootstrap: vi.fn().mockResolvedValue(null),
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn().mockReturnValue(() => {}),
    }
  })

  test("persists a successful Codex login into onboarding and runtime state", async () => {
    const result = await connectCodexAccount()

    expect(result).toEqual({ status: "connected" })
    expect(onboardingMocks.setAiAuthStatus).toHaveBeenCalledWith("connected")
    expect(onboardingMocks.completeOnboarding).toHaveBeenCalledOnce()
    expect(onboardingMocks.persistOnboardingState).toHaveBeenCalledOnce()
    expect(clientMocks.setAiAuth).toHaveBeenCalledWith({ status: "connected", provider: "codex" })
    expect(clientMocks.retryInitialize).toHaveBeenCalledOnce()
  })

  test("surfaces a desktop bridge error before attempting login", async () => {
    Reflect.deleteProperty(window, "electronAPI")

    const result = await connectCodexAccount()

    expect(result.status).toBe("failed")
    expect(result).toMatchObject({
      error: expect.stringContaining("Desktop bridge unavailable"),
    })
  })

  test("returns the codex login error when auth fails", async () => {
    window.electronAPI!.codexAuthStart = vi.fn().mockResolvedValue({
      status: "failed" as const,
      error: "Codex login failed",
    })

    const result = await connectCodexAccount()

    expect(result).toEqual({
      status: "failed",
      error: "Codex login failed",
    })
    expect(clientMocks.retryInitialize).not.toHaveBeenCalled()
  })
})
