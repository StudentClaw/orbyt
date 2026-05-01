import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const wizardMocks = vi.hoisted(() => ({
  currentStep: 3, // ai-connect
  aiAuthStatus: "pending" as "pending" | "connected" | "skipped",
  setAiAuthStatus: vi.fn(),
  advanceStep: vi.fn(),
  goToStep: vi.fn(),
  completeOnboarding: vi.fn(),
  persistState: vi.fn(),
  setAnswers: vi.fn(),
  setDna: vi.fn(),
  classifyDnaThroughServer: vi.fn(async () => null),
}))

const rpcMocks = vi.hoisted(() => ({
  setAiAuth: vi.fn(async () => undefined),
  retryInitialize: vi.fn(async () => ({ started: true })),
  canvasSync: vi.fn(async () => undefined),
  setPreferences: vi.fn(async () => undefined),
  setRoutines: vi.fn(async () => undefined),
  setOnboardingAnswers: vi.fn(async () => undefined),
}))

vi.mock("@/rpc/onboardingState", () => ({
  ONBOARDING_STEPS: [
    { id: "dna-discovery", label: "Study DNA", required: true },
    { id: "active-hours", label: "Active Hours", required: false },
    { id: "busy-grid", label: "Weekly Rhythm", required: false },
    { id: "ai-connect", label: "AI Connect", required: false },
    { id: "canvas-sync", label: "Canvas", required: false },
    { id: "launch", label: "Launch", required: false },
  ],
  useOnboardingState: () => ({
    currentStep: wizardMocks.currentStep,
    aiAuthStatus: wizardMocks.aiAuthStatus,
    answers: {},
    dna: null,
    steps: [],
    overallStatus: "in_progress",
  }),
  advanceOnboardingStep: wizardMocks.advanceStep,
  goToOnboardingStep: wizardMocks.goToStep,
  completeOnboarding: wizardMocks.completeOnboarding,
  persistOnboardingState: wizardMocks.persistState,
  setAiAuthStatus: wizardMocks.setAiAuthStatus,
  setAnswers: wizardMocks.setAnswers,
  setDna: wizardMocks.setDna,
  classifyDnaThroughServer: wizardMocks.classifyDnaThroughServer,
}))

vi.mock("@/rpc/appRuntime", () => ({
  getPrimaryWsRpcClient: () => ({
    canvas: { sync: rpcMocks.canvasSync },
    onboarding: {
      setAiAuth: rpcMocks.setAiAuth,
      setAnswers: rpcMocks.setOnboardingAnswers,
      setPreferences: rpcMocks.setPreferences,
      setRoutines: rpcMocks.setRoutines,
    },
    provider: {
      retryInitialize: rpcMocks.retryInitialize,
    },
  }),
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useRuntimeOrchestrationSnapshot: () => ({
    providerRuntime: {
      authState: "auth_required",
      status: "auth_required",
      lastError: null,
    },
  }),
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}))

import { OnboardingWizard } from "../components/onboarding/OnboardingWizard"

describe("OnboardingWizard — Codex OAuth flow", () => {
  beforeEach(() => {
    wizardMocks.aiAuthStatus = "pending"
    Object.values(wizardMocks).forEach((value) => {
      if (typeof value === "function" && "mockClear" in value) {
        (value as ReturnType<typeof vi.fn>).mockClear()
      }
    })
    Object.values(rpcMocks).forEach((value) => {
      if (typeof value === "function" && "mockClear" in value) {
        (value as ReturnType<typeof vi.fn>).mockClear()
      }
    })
    window.electronAPI = {
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      getBootstrap: vi.fn().mockResolvedValue(null),
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn().mockReturnValue(() => {}),
    }
  })

  test("renders the AI connect phase with a Connect button", () => {
    render(<OnboardingWizard />)
    expect(screen.getByText(/Give/)).toBeDefined()
    expect(screen.getByRole("button", { name: /Connect/ })).toBeDefined()
  })

  test("clicking Connect opens the OAuth browser flow via codexAuthStart", async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    await user.click(screen.getByRole("button", { name: /Connect/ }))
    expect(window.electronAPI!.codexAuthStart).toHaveBeenCalledOnce()
  })

  test("after successful OAuth, persists status and re-initializes the runtime", async () => {
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    rpcMocks.retryInitialize.mockClear()
    await user.click(screen.getByRole("button", { name: /Connect/ }))

    expect(wizardMocks.setAiAuthStatus).toHaveBeenCalledWith("connected")
    expect(rpcMocks.setAiAuth).toHaveBeenCalledWith({
      status: "connected",
      provider: "codex",
    })
    expect(rpcMocks.retryInitialize).toHaveBeenCalledOnce()
  })

  test("does not persist connected status when OAuth fails and surfaces the error", async () => {
    window.electronAPI!.codexAuthStart = vi.fn().mockResolvedValue({
      status: "failed" as const,
      error: "Codex login failed",
    })
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    rpcMocks.retryInitialize.mockClear()
    await user.click(screen.getByRole("button", { name: /Connect/ }))

    expect(wizardMocks.setAiAuthStatus).not.toHaveBeenCalled()
    expect(rpcMocks.setAiAuth).not.toHaveBeenCalled()
    expect(rpcMocks.retryInitialize).not.toHaveBeenCalled()
    expect(screen.getByText(/Codex login failed/)).toBeDefined()
  })

  test("surfaces a clear error when the desktop bridge is unavailable", async () => {
    Reflect.deleteProperty(window, "electronAPI")
    const user = userEvent.setup()
    render(<OnboardingWizard />)
    await user.click(screen.getByRole("button", { name: /Connect/ }))

    expect(wizardMocks.setAiAuthStatus).not.toHaveBeenCalled()
    expect(rpcMocks.setAiAuth).not.toHaveBeenCalled()
    expect(screen.getByText(/Desktop bridge unavailable/)).toBeDefined()
  })

  test("ignores rapid double-clicks by gating concurrent OAuth flows", async () => {
    let resolveAuth: (value: { status: "connected" }) => void = () => {}
    window.electronAPI!.codexAuthStart = vi.fn(
      () => new Promise<{ status: "connected" }>((resolve) => {
        resolveAuth = resolve
      }),
    )
    const user = userEvent.setup()
    render(<OnboardingWizard />)

    const button = screen.getByRole("button", { name: /Connect/ })
    await user.click(button)
    // Second click during the in-flight promise must not spawn a second OAuth.
    await user.click(button)
    resolveAuth({ status: "connected" })

    expect(window.electronAPI!.codexAuthStart).toHaveBeenCalledTimes(1)
  })
})
