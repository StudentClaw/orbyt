import { useRuntimeOrchestrationSnapshot, useRuntimeServerConfig } from "@/hooks/useAppRuntime"

export function DashboardPage() {
  const snapshot = useRuntimeOrchestrationSnapshot()
  const serverConfig = useRuntimeServerConfig()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Your learning overview</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {serverConfig
          ? `Protocol ${serverConfig.protocolVersion} · ${snapshot?.threads.length ?? 0} active thread(s)`
          : "Waiting for runtime config"}
      </p>
    </div>
  )
}
