import { useRuntimeBootstrap, useRuntimeServerConfig } from "@/hooks/useAppRuntime"
import { DevOnboardingControls } from "@/components/dev/DevOnboardingControls"

export function SettingsPage() {
  const bootstrap = useRuntimeBootstrap()
  const serverConfig = useRuntimeServerConfig()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-2 text-muted-foreground">Configure your preferences</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {bootstrap && serverConfig
          ? `${bootstrap.platform} · ${serverConfig.appVersion}`
          : "Waiting for runtime metadata"}
      </p>

      {import.meta.env.DEV && <DevOnboardingControls />}
    </div>
  )
}
