import { useRuntimeBootstrap, useRuntimeConnectionStatus } from "@/hooks/useAppRuntime"

export function ConnectionStatus() {
  const connectionStatus = useRuntimeConnectionStatus()
  const bootstrap = useRuntimeBootstrap()

  const colors: Record<string, string> = {
    connected: "bg-green-500",
    connecting: "bg-yellow-500",
    reconnecting: "bg-yellow-500",
    disconnected: "bg-red-500",
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className={`h-2 w-2 rounded-full ${colors[connectionStatus.phase] ?? "bg-gray-500"}`} />
      <span className="capitalize">
        {connectionStatus.phase}
        {bootstrap ? ` · ${bootstrap.platform}` : ""}
      </span>
    </div>
  )
}
