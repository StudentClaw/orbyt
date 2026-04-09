import { useRuntimeProviderEvents } from "@/hooks/useAppRuntime"

export function ActivityPage() {
  const providerEvents = useRuntimeProviderEvents()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Activity</h1>
      <p className="mt-2 text-muted-foreground">Recent updates and notifications</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {providerEvents.length > 0
          ? `Recent runtime signal: ${providerEvents[0]!.type}`
          : "No runtime activity yet"}
      </p>
    </div>
  )
}
