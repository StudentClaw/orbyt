import type { DesktopBootstrap } from "@student-claw/contracts"
import { createWsRpcClient, type WsRpcClient } from "./wsRpcClient"
import { startOrchestrationStateSync } from "./orchestrationState"
import { startServerStateSync } from "./serverState"
import { setDesktopBootstrap, setWsConnectionStatus } from "./wsConnectionState"
import { WsTransport } from "./wsTransport"

let primaryTransport: WsTransport | null = null
let primaryClient: WsRpcClient | null = null
let runtimeStartPromise: Promise<void> | null = null

function getPrimaryTransport(url?: string): WsTransport {
  if (!primaryTransport) {
    primaryTransport = new WsTransport(url)
  } else if (url) {
    primaryTransport.setUrl(url)
  }
  return primaryTransport
}

export function getPrimaryWsRpcClient(url?: string): WsRpcClient {
  if (!primaryClient) {
    primaryClient = createWsRpcClient(getPrimaryTransport(url))
  } else if (url) {
    getPrimaryTransport(url)
  }
  return primaryClient
}

async function getRendererBootstrap(): Promise<DesktopBootstrap | null> {
  return window.electronAPI?.getBootstrap?.().catch(() => null) ?? null
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

export function startAppRuntime(): Promise<void> {
  if (runtimeStartPromise) {
    return runtimeStartPromise
  }

  runtimeStartPromise = (async () => {
    const rendererBootstrap = await getRendererBootstrap()
    if (rendererBootstrap) {
      setDesktopBootstrap(rendererBootstrap)
    }

    const client = getPrimaryWsRpcClient(rendererBootstrap?.wsUrl)
    startWsConnectionStateSync(client.transport)

    await client.transport.connect()

    if (!rendererBootstrap) {
      try {
        setDesktopBootstrap(await client.server.getBootstrap())
      } catch {
        // Ignore bootstrap fetch failures. State sync streams may still hydrate later.
      }
    }

    startServerStateSync(client)
    startOrchestrationStateSync(client)
  })()

  return runtimeStartPromise
}
