import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import type { DesktopBootstrap } from "@student-claw/contracts"

vi.mock("./onboardingState", () => ({
  setOnboardingRpcClient: vi.fn(),
  hydrateOnboardingStateFromServer: vi.fn().mockResolvedValue(undefined),
}))

class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 3
  static instances: MockWebSocket[] = []

  readonly url: string
  readonly protocols: string[]
  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  readonly sent: string[] = []

  constructor(url: string, protocols: string[]) {
    this.url = url
    this.protocols = protocols
    MockWebSocket.instances.push(this)
  }

  send(payload: string): void {
    this.sent.push(payload)
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.()
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }
}

const bootstrap: DesktopBootstrap = {
  wsUrl: "ws://127.0.0.1:8787",
  wsAuthToken: "a".repeat(64),
  appVersion: "0.1.0",
  platform: "test",
}

describe("startAppRuntime", () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.resetModules()
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    Reflect.deleteProperty(window, "electronAPI")
  })

  test("fails closed when Electron bootstrap is unavailable", async () => {
    const { startAppRuntime } = await import("./appRuntime")

    await expect(startAppRuntime()).rejects.toThrow(
      "Electron bootstrap or standalone dev bootstrap is required to start the app runtime",
    )
  })

  test("uses the authenticated bootstrap data when opening the transport", async () => {
    window.electronAPI = {
      getBootstrap: vi.fn().mockResolvedValue(bootstrap),
      codexAuthStart: vi.fn().mockResolvedValue({ status: "connected" as const }),
      invoke: vi.fn(),
      send: vi.fn(),
      on: vi.fn(),
    }

    const { startAppRuntime } = await import("./appRuntime")
    const startPromise = startAppRuntime()
    const socket = await waitForSocket()

    expect(socket.protocols).toEqual([
      "student-claw.v1",
      `auth.${bootstrap.wsAuthToken}`,
    ])

    socket.open()
    await startPromise
  })

  test("uses standalone dev bootstrap env when Electron bootstrap is unavailable", async () => {
    vi.stubEnv("VITE_STANDALONE_WS_URL", bootstrap.wsUrl)
    vi.stubEnv("VITE_STANDALONE_WS_AUTH_TOKEN", bootstrap.wsAuthToken)

    const { startAppRuntime } = await import("./appRuntime")
    const startPromise = startAppRuntime()
    const socket = await waitForSocket()

    expect(socket.protocols).toEqual([
      "student-claw.v1",
      `auth.${bootstrap.wsAuthToken}`,
    ])

    socket.open()
    await startPromise
  })
})

async function waitForSocket(): Promise<MockWebSocket> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const socket = MockWebSocket.instances[0]
    if (socket) {
      return socket
    }
    await Promise.resolve()
  }

  throw new Error("WebSocket was not created")
}
