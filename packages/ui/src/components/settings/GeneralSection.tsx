import { useTheme, type Theme } from "@/hooks/useTheme"
import { useRuntimeBootstrap, useRuntimeServerConfig } from "@/hooks/useAppRuntime"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DevOnboardingControls } from "@/components/dev/DevOnboardingControls"

interface ThemeOptionProps {
  mode: Theme
  label: string
  selected: boolean
  onClick: () => void
}

function ThemeOption({ mode, label, selected, onClick }: ThemeOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className={`w-[120px] h-[88px] rounded-xl overflow-hidden border-2 transition-colors ${
          selected ? "border-blue-500" : "border-transparent"
        }`}
      >
        {mode === "light" && (
          <div className="w-full h-full bg-[#f0efed] flex flex-col p-2 gap-1.5">
            <div className="flex justify-end">
              <div className="h-4 w-16 rounded-full bg-[#2a2a2a]" />
            </div>
            <div className="space-y-1">
              <div className="h-2 w-12 rounded bg-[#c0bdb8]" />
              <div className="h-2 w-16 rounded bg-[#c0bdb8]" />
            </div>
            <div className="mt-auto h-6 w-full rounded-md bg-white border border-[#dddbd8]" />
          </div>
        )}
        {mode === "dark" && (
          <div className="w-full h-full bg-[#2a2a2a] flex flex-col p-2 gap-1.5">
            <div className="flex justify-end">
              <div className="h-4 w-16 rounded-full bg-[#1a1a1a]" />
            </div>
            <div className="space-y-1">
              <div className="h-2 w-12 rounded bg-[#444]" />
              <div className="h-2 w-16 rounded bg-[#444]" />
            </div>
            <div className="mt-auto h-6 w-full rounded-md bg-[#3a3a3a] border border-[#444]" />
          </div>
        )}
        {mode === "auto" && (
          <div className="w-full h-full flex">
            <div className="w-1/2 h-full bg-white flex flex-col p-2 gap-1.5 overflow-hidden">
              <div className="space-y-1">
                <div className="h-2 w-8 rounded bg-[#c0bdb8]" />
                <div className="h-2 w-10 rounded bg-[#c0bdb8]" />
              </div>
              <div className="mt-auto h-5 w-full rounded-l-md bg-[#f0efed] border border-[#dddbd8]" />
            </div>
            <div className="w-1/2 h-full bg-[#2a2a2a] flex flex-col p-2 gap-1.5 overflow-hidden">
              <div className="flex justify-end">
                <div className="h-4 w-8 rounded-full bg-[#1a1a1a]" />
              </div>
              <div className="space-y-1">
                <div className="h-2 w-6 rounded bg-[#444]" />
                <div className="h-2 w-8 rounded bg-[#444]" />
              </div>
              <div className="mt-auto h-5 w-full rounded-r-md bg-[#3a3a3a] border border-[#444]" />
            </div>
          </div>
        )}
      </div>
      <span className="text-sm text-muted-foreground">{label}</span>
    </button>
  )
}

export function GeneralSection() {
  const { theme, setTheme } = useTheme()
  const bootstrap = useRuntimeBootstrap()
  const serverConfig = useRuntimeServerConfig()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">General</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {bootstrap && serverConfig
            ? `${bootstrap.platform} · ${serverConfig.appVersion}`
            : "Waiting for runtime metadata"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Color mode</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <ThemeOption mode="light" label="Light" selected={theme === "light"} onClick={() => setTheme("light")} />
            <ThemeOption mode="auto" label="Auto" selected={theme === "auto"} onClick={() => setTheme("auto")} />
            <ThemeOption mode="dark" label="Dark" selected={theme === "dark"} onClick={() => setTheme("dark")} />
          </div>
        </CardContent>
      </Card>

      {import.meta.env.DEV && <DevOnboardingControls />}
    </div>
  )
}
