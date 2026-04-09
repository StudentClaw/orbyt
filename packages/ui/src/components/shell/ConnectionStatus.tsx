import { useWebSocket } from "@/hooks/useWebSocket"

export function ConnectionStatus() {
  const { connectionState, bootstrap } = useWebSocket()

  const colors: Record<string, string> = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500",
    reconnecting: "bg-yellow-500",
    disconnected: "bg-red-500",
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${colors[connectionState] ?? "bg-gray-500"}`} />
      <span className="capitalize">
        {connectionState}
        {bootstrap ? ` · ${bootstrap.platform}` : ""}
      </span>
    </div>
  )
}
