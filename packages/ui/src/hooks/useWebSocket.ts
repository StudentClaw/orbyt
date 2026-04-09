import { useEffect, useRef, useState, useCallback } from "react"
import {
  WsClient,
  type ConnectionState,
} from "@/lib/ws-client"
import type { DesktopBootstrap } from "@student-claw/contracts"

let sharedClient: WsClient | null = null

export function useWebSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
  const [bootstrap, setBootstrap] = useState<DesktopBootstrap | null>(null)
  const clientRef = useRef<WsClient | null>(null)

  useEffect(() => {
    if (!sharedClient) {
      sharedClient = new WsClient("ws://127.0.0.1:8787")
    }
    clientRef.current = sharedClient

    const unsubState = sharedClient.onStateChange(setConnectionState)

    void (async () => {
      const rendererBootstrap = await window.electronAPI?.getBootstrap?.().catch(() => null)
      if (rendererBootstrap && sharedClient) {
        sharedClient.setUrl(rendererBootstrap.wsUrl)
      }
      sharedClient?.connect()
      if (sharedClient) {
        try {
          setBootstrap(await sharedClient.getBootstrap())
        } catch {
          if (rendererBootstrap) {
            setBootstrap(rendererBootstrap)
          }
        }
      }
    })()

    return () => {
      unsubState()
    }
  }, [])

  const subscribe = useCallback(
    (event: string, callback: Parameters<WsClient["subscribe"]>[1]) => {
      return clientRef.current?.subscribe(event, callback) ?? (() => {})
    },
    [],
  )

  return { connectionState, bootstrap, client: clientRef.current, subscribe }
}
