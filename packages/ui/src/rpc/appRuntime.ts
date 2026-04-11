import type { DesktopBootstrap } from "@student-claw/contracts"
import { createWsRpcClient, type WsRpcClient } from "./wsRpcClient"
import { startActivityStateSync } from "./activityState"
import { startCanvasStateSync } from "./canvasState"
import { startDashboardStateSync } from "./dashboardState"
import { startPlannerStateSync } from "./plannerState"
import { startOrchestrationStateSync } from "./orchestrationState"
import { startServerStateSync } from "./serverState"
import { setDesktopBootstrap, setWsConnectionStatus } from "./wsConnectionState"
import { hydrateOnboardingStateFromServer, setOnboardingRpcClient } from "./onboardingState"
import { WsTransport } from "./wsTransport"

let primaryTransport: WsTransport | null = null
let primaryClient: WsRpcClient | null = null
let runtimeStartPromise: Promise<void> | null = null
let primaryBootstrap: DesktopBootstrap | null = null

function getStandaloneDevBootstrap(): DesktopBootstrap | null {
  const wsUrl = import.meta.env.VITE_STANDALONE_WS_URL
  const wsAuthToken = import.meta.env.VITE_STANDALONE_WS_AUTH_TOKEN

  if (!wsUrl || !wsAuthToken) {
    return null
  }

  return {
    wsUrl,
    wsAuthToken,
    appVersion: import.meta.env.VITE_STANDALONE_APP_VERSION ?? "0.1.0",
    platform: import.meta.env.VITE_STANDALONE_PLATFORM ?? "web",
  }
}

function getPrimaryTransport(bootstrap?: DesktopBootstrap): WsTransport {
  const nextBootstrap = bootstrap ?? primaryBootstrap
  if (!nextBootstrap) {
    throw new Error("Desktop bootstrap is required before creating the runtime transport")
  }

  if (!primaryTransport) {
    primaryTransport = new WsTransport(nextBootstrap)
  } else if (bootstrap) {
    primaryTransport.setBootstrap(bootstrap)
  }
  return primaryTransport
}

/**
 * Returns the singleton authenticated RPC client for the active desktop bootstrap.
 */
export function getPrimaryWsRpcClient(bootstrap?: DesktopBootstrap): WsRpcClient {
  if (!primaryClient) {
    primaryClient = createWsRpcClient(getPrimaryTransport(bootstrap))
  } else if (bootstrap) {
    getPrimaryTransport(bootstrap)
  }
  return primaryClient
}

async function getRendererBootstrap(): Promise<DesktopBootstrap | null> {
  const electronBootstrap = await (window.electronAPI?.getBootstrap?.().catch(() => null) ?? null)
  return electronBootstrap ?? getStandaloneDevBootstrap()
}

function cacheBootstrap(bootstrap: DesktopBootstrap): void {
  primaryBootstrap = bootstrap
  setDesktopBootstrap(bootstrap)
}

function startWsConnectionStateSync(transport: WsTransport): void {
  transport.onStatusChange((status) => {
    setWsConnectionStatus({
      phase: status.phase,
      wsUrl: status.wsUrl,
      lastSequence: status.lastSequence,
      lastError: status.lastError,
    })
  })
}

/**
 * Starts the renderer runtime and refuses to run without Electron-provided bootstrap data.
 */
export function startAppRuntime(): Promise<void> {
  if (runtimeStartPromise) {
    return runtimeStartPromise
  }

  runtimeStartPromise = (async () => {
    const rendererBootstrap = await getRendererBootstrap()
    if (!rendererBootstrap) {
      throw new Error("Electron bootstrap or standalone dev bootstrap is required to start the app runtime")
    }

    cacheBootstrap(rendererBootstrap)
    const client = getPrimaryWsRpcClient(rendererBootstrap)
    startWsConnectionStateSync(client.transport)
    client.transport.registerBootstrapRefresher(getRendererBootstrap)

    await client.transport.connect()

    setOnboardingRpcClient(client)
    await hydrateOnboardingStateFromServer(client)

    startServerStateSync(client)
    startOrchestrationStateSync(client)
    startCanvasStateSync(client)
    startDashboardStateSync(client)
    startPlannerStateSync(client)
    startActivityStateSync(client)
  })()

  runtimeStartPromise.catch(() => {
    runtimeStartPromise = null
  })

  return runtimeStartPromise
}
