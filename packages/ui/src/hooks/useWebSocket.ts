import { useEffect, useRef, useState, useCallback } from "react"
import {
  WsClient,
  type ConnectionState,
  type ClientMessagePayload,
  type ServerEventMessage,
} from "@/lib/ws-client"

let sharedClient: WsClient | null = null

function getWsUrl(): string {
  return "ws://localhost:8787"
}

export function useWebSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
  const clientRef = useRef<WsClient | null>(null)

  useEffect(() => {
    if (!sharedClient) {
      sharedClient = new WsClient(getWsUrl())
    }
    clientRef.current = sharedClient

    const unsubState = sharedClient.onStateChange(setConnectionState)
    sharedClient.connect()

    // Resolve actual port from Electron if available
    if (typeof window !== "undefined" && window.electronAPI) {
      window.electronAPI.invoke("app:get-server-port").then((port) => {
        if (typeof port === "number" && sharedClient) {
          sharedClient.disconnect()
          sharedClient = new WsClient(`ws://localhost:${port}`)
          clientRef.current = sharedClient
          sharedClient.onStateChange(setConnectionState)
          sharedClient.connect()
        }
      }).catch(() => {
        // Fallback to default port
      })
    }

    return () => {
      unsubState()
    }
  }, [])

  const send = useCallback((message: ClientMessagePayload) => {
    clientRef.current?.send(message)
  }, [])

  const subscribe = useCallback(
    (event: string, callback: (evt: ServerEventMessage) => void) => {
      return clientRef.current?.subscribe(event, callback) ?? (() => {})
    },
    [],
  )

  return { connectionState, send, subscribe }
}
