import type { DesktopBootstrap } from "@orbyt/contracts"
import { IpcChannel } from "@orbyt/contracts"
import { createWsRpcClient, type WsRpcClient } from "./wsRpcClient"
import { startActivityStateSync } from "./activityState"
import { startCanvasStateSync, loadCanvasData } from "./canvasState"
import { startDashboardStateSync } from "./dashboardState"
import { startPlannerStateSync } from "./plannerState"
import {
  getOrchestrationSnapshot,
  isOrchestrationStartupReady,
  resolveOrchestrationStartupCopy,
  startOrchestrationStateSync,
} from "./orchestrationState"
import { setRuntimeStartupState } from "./runtimeStartupState"
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
    featureFlags: {
      pluginSystem: false,
    },
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

/**
 * Waits for the renderer runtime to finish bootstrapping before returning the shared RPC client.
 */
export async function waitForPrimaryWsRpcClient(): Promise<WsRpcClient> {
  if (!primaryBootstrap) {
    await startAppRuntime()
  }

  return getPrimaryWsRpcClient()
}

async function getRendererBootstrap(): Promise<DesktopBootstrap | null> {
  const electronBootstrap = await (window.electronAPI?.getBootstrap?.().catch(() => null) ?? null)
  return electronBootstrap ?? getStandaloneDevBootstrap()
}

const CANVAS_PLUGIN_ID = "canvas-mcp"

async function triggerCanvasSyncIfConfigured(client: WsRpcClient): Promise<void> {
  const invoke = window.electronAPI?.invoke
  if (!invoke) return

  try {
    const result = await invoke(IpcChannel.PLUGIN_GET_AUTH_STATUS, { pluginId: CANVAS_PLUGIN_ID })
    if (result?.status !== "configured") return
    await client.canvas.sync()
  } catch {
    // Best-effort: a failed app-open sync should never block startup or surface to the user;
    // the cron-driven sync will still run on its normal cadence.
  }
}

function cacheBootstrap(bootstrap: DesktopBootstrap): void {
  primaryBootstrap = bootstrap
  setDesktopBootstrap(bootstrap)
}

function startWsConnectionStateSync(transport: WsTransport): () => void {
  return transport.onStatusChange((status) => {
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

  setRuntimeStartupState({
    phase: "bootstrapping",
    label: "Starting Orbyt",
    detail: "Connecting to Orbyt",
    error: null,
  })

  runtimeStartPromise = (async () => {
    const cleanups: Array<() => void> = []

    try {
      const rendererBootstrap = await getRendererBootstrap()
      if (!rendererBootstrap) {
        throw new Error("Electron bootstrap or standalone dev bootstrap is required to start the app runtime")
      }

      cacheBootstrap(rendererBootstrap)
      setRuntimeStartupState({
        phase: "connecting",
        label: "Starting Orbyt",
        detail: "Connecting to Orbyt",
        error: null,
      })

      const client = getPrimaryWsRpcClient(rendererBootstrap)
      cleanups.push(startWsConnectionStateSync(client.transport))
      client.transport.registerBootstrapRefresher(getRendererBootstrap)

      await client.transport.connect()

      setRuntimeStartupState({
        phase: "hydrating",
        label: "Loading your workspace",
        detail: "Loading Orbyt settings",
        error: null,
      })

      setOnboardingRpcClient(client)
      await hydrateOnboardingStateFromServer(client)

      const orchestrationSync = startOrchestrationStateSync(client)
      cleanups.push(orchestrationSync.stop)
      cleanups.push(startServerStateSync(client))
      cleanups.push(startCanvasStateSync(client))
      cleanups.push(startDashboardStateSync(client))
      cleanups.push(startPlannerStateSync(client))
      cleanups.push(startActivityStateSync(client))

      setRuntimeStartupState({
        phase: "hydrating",
        label: "Loading your workspace",
        detail: "Loading chat state",
        error: null,
      })

      await orchestrationSync.initialSnapshotReady

      const currentSnapshot = getOrchestrationSnapshot()
      if (!isOrchestrationStartupReady(currentSnapshot)) {
        const startupCopy = resolveOrchestrationStartupCopy(currentSnapshot)
        setRuntimeStartupState({
          phase: "hydrating",
          label: startupCopy.label,
          detail: startupCopy.detail,
          error: null,
        })
      }

      await orchestrationSync.startupReady

      setRuntimeStartupState({
        phase: "hydrating",
        label: "Loading your courses",
        detail: "Fetching Canvas data",
        error: null,
      })

      try {
        await loadCanvasData(client)
      } catch {
        // Canvas data failure is non-fatal — proceed with empty atoms
      }

      setRuntimeStartupState({
        phase: "ready",
        label: "Orbyt ready",
        detail: "",
        error: null,
      })

      void triggerCanvasSyncIfConfigured(client)
    } catch (error: unknown) {
      for (const cleanup of cleanups.reverse()) {
        cleanup()
      }

      const message = error instanceof Error ? error.message : "Failed to start Orbyt."

      setRuntimeStartupState({
        phase: "error",
        label: "Orbyt couldn't start",
        detail: "Retry the local runtime startup.",
        error: message,
      })

      throw error
    }
  })()

  runtimeStartPromise.catch(() => {
    runtimeStartPromise = null
  })

  return runtimeStartPromise
}
