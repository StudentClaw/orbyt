import { useEffect, useState } from "react"
import { IpcChannel, type ExtensionRegistryEntry } from "@student-claw/contracts"
import { useRuntimeBootstrap, useRuntimeServerConfig } from "@/hooks/useAppRuntime"
import { DevOnboardingControls } from "@/components/dev/DevOnboardingControls"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function getEntryName(entry: ExtensionRegistryEntry): string {
  return entry.kind === "available" ? entry.manifest.name : entry.displayName
}

function getEntryVersion(entry: ExtensionRegistryEntry): string {
  return entry.kind === "available" ? entry.manifest.version : "Invalid manifest"
}

function getEntryPluginId(entry: ExtensionRegistryEntry): string {
  return entry.kind === "available" ? entry.manifest.id : entry.pluginId
}

function getEntryError(entry: ExtensionRegistryEntry): string | null {
  if (entry.kind === "invalid") {
    return entry.lastError
  }

  return entry.lastError ?? null
}

function formatInstallSource(entry: ExtensionRegistryEntry): string {
  switch (entry.installSource) {
    case "bundled":
      return "Bundled"
    case "user":
      return "User"
    case "system":
      return "System"
  }

  return entry.installSource
}

function getStatusBadgeVariant(entry: ExtensionRegistryEntry): "default" | "secondary" | "destructive" | "outline" {
  if (entry.kind === "invalid" || entry.status === "error") {
    return "destructive"
  }

  if (entry.status === "discovered") {
    return "secondary"
  }

  return "outline"
}

export function SettingsPage() {
  const bootstrap = useRuntimeBootstrap()
  const serverConfig = useRuntimeServerConfig()
  const [registryEntries, setRegistryEntries] = useState<ExtensionRegistryEntry[]>([])
  const [registryState, setRegistryState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [registryError, setRegistryError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!bootstrap?.featureFlags.pluginSystem) {
      setRegistryEntries([])
      setRegistryState("idle")
      setRegistryError(null)
      return () => {
        cancelled = true
      }
    }

    if (!window.electronAPI?.invoke) {
      setRegistryEntries([])
      setRegistryState("error")
      setRegistryError("Desktop bridge unavailable for plugin registry reads.")
      return () => {
        cancelled = true
      }
    }

    setRegistryState("loading")
    setRegistryError(null)

    window.electronAPI.invoke(IpcChannel.PLUGIN_LIST)
      .then((entries) => {
        if (cancelled) {
          return
        }

        setRegistryEntries(entries)
        setRegistryState("ready")
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setRegistryEntries([])
        setRegistryState("error")
        setRegistryError(error instanceof Error ? error.message : String(error))
      })

    return () => {
      cancelled = true
    }
  }, [bootstrap])

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="mt-2 text-muted-foreground">Configure your preferences</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {bootstrap && serverConfig
          ? `${bootstrap.platform} · ${serverConfig.appVersion}`
          : "Waiting for runtime metadata"}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Extension Registry</CardTitle>
          <CardDescription>
            Phase 01 shows discovered bundled and user extensions before install, auth, and lifecycle controls land.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!bootstrap?.featureFlags.pluginSystem && (
            <Alert data-testid="settings-plugin-disabled">
              <AlertTitle>Plugin system disabled</AlertTitle>
              <AlertDescription>
                The plugin registry stays dark until the desktop feature flag is enabled.
              </AlertDescription>
            </Alert>
          )}

          {bootstrap?.featureFlags.pluginSystem && registryState === "loading" && (
            <Alert data-testid="settings-plugin-loading">
              <AlertTitle>Loading discovered extensions</AlertTitle>
              <AlertDescription>
                Reading bundled and user extension manifests from the desktop runtime.
              </AlertDescription>
            </Alert>
          )}

          {bootstrap?.featureFlags.pluginSystem && registryState === "error" && (
            <Alert variant="destructive" data-testid="settings-plugin-error">
              <AlertTitle>Plugin registry unavailable</AlertTitle>
              <AlertDescription>{registryError ?? "Unknown registry failure"}</AlertDescription>
            </Alert>
          )}

          {bootstrap?.featureFlags.pluginSystem && registryState === "ready" && (
            <div className="space-y-3" data-testid="settings-plugin-registry">
              <p className="text-sm text-muted-foreground">
                {registryEntries.length} discovered {registryEntries.length === 1 ? "extension" : "extensions"}
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Extension</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registryEntries.map((entry) => (
                    <TableRow key={`${entry.installSource}:${getEntryPluginId(entry)}`}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{getEntryName(entry)}</span>
                          <span className="font-mono text-xs text-muted-foreground">{getEntryPluginId(entry)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatInstallSource(entry)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(entry)}>
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{getEntryVersion(entry)}</TableCell>
                      <TableCell className="max-w-sm whitespace-normal text-sm text-muted-foreground">
                        {getEntryError(entry) ?? "Valid manifest"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {import.meta.env.DEV && <DevOnboardingControls />}
    </div>
  )
}
