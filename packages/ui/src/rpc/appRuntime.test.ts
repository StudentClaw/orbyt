import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { DesktopBootstrap } from "@orbyt/contracts"

const transportMocks = vi.hoisted(() => {
  class MockWsTransport {
    static instances: MockWsTransport[] = []

    readonly bootstrapRefresher = vi.fn()
    bootstrap: Pick<DesktopBootstrap, "wsUrl" | "wsAuthToken">
    private readonly listeners = new Set<(status: {
      phase: "connecting" | "connected" | "disconnected" | "reconnecting"
      wsUrl: string
      lastSequence: number
      lastError: string | null
    }) => void>()
    private status: {
      phase: "connecting" | "connected" | "disconnected" | "reconnecting"
      wsUrl: string
      lastSequence: number
      lastError: string | null
    }

    constructor(bootstrap: Pick<DesktopBootstrap, "wsUrl" | "wsAuthToken">) {
      this.bootstrap = bootstrap
      this.status = {
        phase: "disconnected",
        wsUrl: bootstrap.wsUrl,
        lastSequence: 0,
        lastError: null,
      }
      MockWsTransport.instances.push(this)
    }

    setBootstrap(bootstrap: Pick<DesktopBootstrap, "wsUrl" | "wsAuthToken">): void {
      this.bootstrap = bootstrap
      this.status = {
        ...this.status,
        wsUrl: bootstrap.wsUrl,
      }
    }

    onStatusChange(
      listener: (status: {
        phase: "connecting" | "connected" | "disconnected" | "reconnecting"
        wsUrl: string
        lastSequence: number
        lastError: string | null
      }) => void,
      immediate = true,
    ): () => void {
      this.listeners.add(listener)
      if (immediate) {
        listener(this.status)
      }
      return () => {
        this.listeners.delete(listener)
      }
    }

    registerBootstrapRefresher(fn: () => Promise<Pick<DesktopBootstrap, "wsUrl" | "wsAuthToken"> | null>): void {
      this.bootstrapRefresher(fn)
    }

    async connect(): Promise<void> {
      this.status = {
        ...this.status,
        phase: "connected",
        lastError: null,
      }
      for (const listener of this.listeners) {
        listener(this.status)
      }
    }
  }

  return {
    MockWsTransport,
  }
})

const runtimeSyncMocks = vi.hoisted(() => {
  let resolveInitialSnapshot: (() => void) | null = null
  let rejectInitialSnapshot: ((error: Error) => void) | null = null
  let resolveStartupReady: (() => void) | null = null
  let rejectStartupReady: ((error: Error) => void) | null = null

  return {
    fakeClient: null as { transport: InstanceType<typeof transportMocks.MockWsTransport> } | null,
    createWsRpcClient: vi.fn((transport: InstanceType<typeof transportMocks.MockWsTransport>) => {
      const client = { transport }
      runtimeSyncMocks.fakeClient = client
      return client
    }),
    startServerStateSync: vi.fn(() => () => undefined),
    startCanvasStateSync: vi.fn(() => () => undefined),
    loadCanvasData: vi.fn().mockResolvedValue(undefined),
    startDashboardStateSync: vi.fn(() => () => undefined),
    startPlannerStateSync: vi.fn(() => () => undefined),
    startActivityStateSync: vi.fn(() => () => undefined),
    startOrchestrationStateSync: vi.fn(() => ({
      stop: () => undefined,
      initialSnapshotReady: new Promise<void>((resolve, reject) => {
        resolveInitialSnapshot = resolve
        rejectInitialSnapshot = reject
      }),
      startupReady: new Promise<void>((resolve, reject) => {
        resolveStartupReady = resolve
        rejectStartupReady = reject
      }),
    })),
    resolveInitialSnapshot: () => {
      resolveInitialSnapshot?.()
    },
    rejectInitialSnapshot: (error: Error) => {
      rejectInitialSnapshot?.(error)
    },
    resolveStartupReady: () => {
      resolveStartupReady?.()
    },
    rejectStartupReady: (error: Error) => {
      rejectStartupReady?.(error)
    },
    reset() {
      runtimeSyncMocks.fakeClient = null
      runtimeSyncMocks.createWsRpcClient.mockClear()
      runtimeSyncMocks.startServerStateSync.mockClear()
      runtimeSyncMocks.startCanvasStateSync.mockClear()
      runtimeSyncMocks.loadCanvasData.mockClear()
      runtimeSyncMocks.startDashboardStateSync.mockClear()
      runtimeSyncMocks.startPlannerStateSync.mockClear()
      runtimeSyncMocks.startActivityStateSync.mockClear()
      runtimeSyncMocks.startOrchestrationStateSync.mockClear()
      resolveInitialSnapshot = null
      rejectInitialSnapshot = null
      resolveStartupReady = null
      rejectStartupReady = null
      transportMocks.MockWsTransport.instances = []
    },
  }
})

vi.mock("./wsTransport", () => ({
  WsTransport: transportMocks.MockWsTransport,
}))

vi.mock("./wsRpcClient", () => ({
  createWsRpcClient: runtimeSyncMocks.createWsRpcClient,
}))

vi.mock("./onboardingState", () => ({
  setOnboardingRpcClient: vi.fn(),
  hydrateOnboardingStateFromServer: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("./orchestrationState", () => ({
  startOrchestrationStateSync: runtimeSyncMocks.startOrchestrationStateSync,
  getOrchestrationSnapshot: vi.fn(() => null),
  isOrchestrationStartupReady: vi.fn(() => false),
  resolveOrchestrationStartupCopy: vi.fn(() => ({
    label: "Preparing Codex",
    detail: "Finishing Codex startup before chat can send messages.",
  })),
}))

vi.mock("./serverState", () => ({
  startServerStateSync: runtimeSyncMocks.startServerStateSync,
}))

vi.mock("./canvasState", () => ({
  startCanvasStateSync: runtimeSyncMocks.startCanvasStateSync,
  loadCanvasData: runtimeSyncMocks.loadCanvasData,
}))

vi.mock("./dashboardState", () => ({
  startDashboardStateSync: runtimeSyncMocks.startDashboardStateSync,
}))

vi.mock("./plannerState", () => ({
  startPlannerStateSync: runtimeSyncMocks.startPlannerStateSync,
}))

vi.mock("./activityState", () => ({
  startActivityStateSync: runtimeSyncMocks.startActivityStateSync,
}))

const bootstrap: DesktopBootstrap = {
  wsUrl: "ws://127.0.0.1:8787",
  wsAuthToken: "a".repeat(64),
  appVersion: "0.1.0",
  platform: "test",
  featureFlags: {
    pluginSystem: false,
  },
}

describe("startAppRuntime", () => {
  beforeEach(() => {
    vi.resetModules()
    runtimeSyncMocks.reset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    Reflect.deleteProperty(window, "electronAPI")
  })

  test("fails closed when Electron bootstrap is unavailable", async () => {
    const { startAppRuntime } = await import("./appRuntime")

    await expect(startAppRuntime()).rejects.toThrow(
      "Electron bootstrap or standalone dev bootstrap is required to start the app runtime",
    )
  })

  test("uses the authenticated bootstrap data when creating the transport", async () => {
    window.electronAPI = {
      getBootstrap: vi.fn().mockResolvedValue(bootstrap),
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
    }

    const { startAppRuntime } = await import("./appRuntime")
    const startPromise = startAppRuntime()
    const transport = await waitForTransport()

    expect(transport.bootstrap).toMatchObject({
      wsUrl: bootstrap.wsUrl,
      wsAuthToken: bootstrap.wsAuthToken,
    })

    await waitForOrchestrationStartup()
    runtimeSyncMocks.resolveInitialSnapshot()
    runtimeSyncMocks.resolveStartupReady()
    await startPromise
  })

  test("uses standalone dev bootstrap env when Electron bootstrap is unavailable", async () => {
    vi.stubEnv("VITE_STANDALONE_WS_URL", bootstrap.wsUrl)
    vi.stubEnv("VITE_STANDALONE_WS_AUTH_TOKEN", bootstrap.wsAuthToken)

    const { startAppRuntime } = await import("./appRuntime")
    const startPromise = startAppRuntime()
    const transport = await waitForTransport()

    expect(transport.bootstrap).toMatchObject({
      wsUrl: bootstrap.wsUrl,
      wsAuthToken: bootstrap.wsAuthToken,
    })

    await waitForOrchestrationStartup()
    runtimeSyncMocks.resolveInitialSnapshot()
    runtimeSyncMocks.resolveStartupReady()
    await startPromise
  })

  test("waits for runtime startup before returning the shared rpc client", async () => {
    window.electronAPI = {
      getBootstrap: vi.fn().mockResolvedValue(bootstrap),
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
    }

    const { getPrimaryWsRpcClient, waitForPrimaryWsRpcClient } = await import("./appRuntime")
    const clientPromise = waitForPrimaryWsRpcClient()

    await waitForOrchestrationStartup()
    runtimeSyncMocks.resolveInitialSnapshot()
    runtimeSyncMocks.resolveStartupReady()

    const client = await clientPromise
    expect(client).toBe(getPrimaryWsRpcClient())
  })

  test("stays in startup hydration until orchestration startup is send-ready", async () => {
    window.electronAPI = {
      getBootstrap: vi.fn().mockResolvedValue(bootstrap),
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
    }

    const { startAppRuntime } = await import("./appRuntime")
    const { getRuntimeStartupState } = await import("./runtimeStartupState")

    const startPromise = startAppRuntime()
    await waitForOrchestrationStartup()

    expect(getRuntimeStartupState()).toMatchObject({
      phase: "hydrating",
      detail: "Loading chat state",
    })

    let settled = false
    void startPromise.then(() => {
      settled = true
    })
    await Promise.resolve()

    expect(settled).toBe(false)

    runtimeSyncMocks.resolveInitialSnapshot()
    await Promise.resolve()

    expect(settled).toBe(false)
    expect(getRuntimeStartupState()).toMatchObject({
      phase: "hydrating",
      label: "Preparing Codex",
      detail: "Finishing Codex startup before chat can send messages.",
    })

    runtimeSyncMocks.resolveStartupReady()
    await startPromise

    expect(getRuntimeStartupState().phase).toBe("ready")
  })

  test("stores a retryable startup error when the initial snapshot load fails", async () => {
    window.electronAPI = {
      getBootstrap: vi.fn().mockResolvedValue(bootstrap),
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
    }

    const { startAppRuntime } = await import("./appRuntime")
    const { getRuntimeStartupState } = await import("./runtimeStartupState")

    const startPromise = startAppRuntime()
    await waitForOrchestrationStartup()
    runtimeSyncMocks.rejectInitialSnapshot(new Error("snapshot failed"))

    await expect(startPromise).rejects.toThrow("snapshot failed")
    expect(getRuntimeStartupState()).toMatchObject({
      phase: "error",
      error: "snapshot failed",
    })
  })
})

async function waitForTransport(): Promise<InstanceType<typeof transportMocks.MockWsTransport>> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const transport = transportMocks.MockWsTransport.instances[0]
    if (transport) {
      return transport
    }
    await Promise.resolve()
  }

  throw new Error("Transport was not created")
}

async function waitForOrchestrationStartup(): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (runtimeSyncMocks.startOrchestrationStateSync.mock.calls.length > 0) {
      return
    }
    await Promise.resolve()
  }

  throw new Error("Orchestration startup was not started")
}
