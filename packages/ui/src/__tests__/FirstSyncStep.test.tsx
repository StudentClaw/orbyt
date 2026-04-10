import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const syncMocks = vi.hoisted(() => ({
  syncProgress: null as { courseId: string; progress: number; status: string } | null,
  syncFn: vi.fn(() => Promise.resolve()),
}))

vi.mock("@/hooks/useAppRuntime", () => ({
  useRuntimeCanvasSyncProgress: () => syncMocks.syncProgress,
}))

vi.mock("@/rpc/appRuntime", () => ({
  getPrimaryWsRpcClient: () => ({
    canvas: { sync: syncMocks.syncFn },
  }),
}))

import { FirstSyncStep } from "../components/onboarding/FirstSyncStep"

describe("FirstSyncStep", () => {
  const defaultProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
  }

  beforeEach(() => {
    syncMocks.syncProgress = null
    syncMocks.syncFn.mockClear()
    defaultProps.onNext = vi.fn()
  })

  test("renders the first sync step", () => {
    render(<FirstSyncStep {...defaultProps} />)
    expect(screen.getByTestId("first-sync-step")).toBeDefined()
  })

  test("triggers sync on mount", () => {
    render(<FirstSyncStep {...defaultProps} />)
    expect(syncMocks.syncFn).toHaveBeenCalledOnce()
  })

  test("shows progress when sync is in progress", () => {
    syncMocks.syncProgress = { courseId: "c1", progress: 50, status: "syncing" }
    render(<FirstSyncStep {...defaultProps} />)
    expect(screen.getByTestId("sync-progress-bar")).toBeDefined()
  })

  test("shows summary when sync is done", () => {
    syncMocks.syncProgress = { courseId: "c1", progress: 100, status: "done" }
    render(<FirstSyncStep {...defaultProps} />)
    expect(screen.getByTestId("sync-summary")).toBeDefined()
  })
})
