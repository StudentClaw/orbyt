import { useEffect, useState } from "react"
import { IpcChannel, type ExtensionRegistryEntry } from "@student-claw/contracts"
import { useRuntimeBootstrap, useRuntimeServerConfig } from "@/hooks/useAppRuntime"
import { DevOnboardingControls } from "@/components/dev/DevOnboardingControls"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

function canStart(entry: ExtensionRegistryEntry): boolean {
  return entry.kind === "available"
    && (entry.status === "discovered" || entry.status === "stopped" || entry.status === "error")
}

function canStop(entry: ExtensionRegistryEntry): boolean {
  return entry.kind === "available"
    && (entry.status === "starting" || entry.status === "ready" || entry.status === "active")
}

function canRetry(entry: ExtensionRegistryEntry): boolean {
  return entry.kind === "available" && entry.status === "error"
}

export function SettingsPage() {
  const bootstrap = useRuntimeBootstrap()
  const serverConfig = useRuntimeServerConfig()
  const [registryEntries, setRegistryEntries] = useState<ExtensionRegistryEntry[]>([])
  const [registryState, setRegistryState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [registryError, setRegistryError] = useState<string | null>(null)
  const [pendingPluginId, setPendingPluginId] = useState<string | null>(null)

  function upsertRegistryEntry(nextEntry: ExtensionRegistryEntry): void {
    setRegistryEntries((current) => {
      const index = current.findIndex((entry) => getEntryPluginId(entry) === getEntryPluginId(nextEntry))
      if (index === -1) {
        return [...current, nextEntry]
      }

      const updated = [...current]
      updated[index] = nextEntry
      return updated
    })
  }

  async function refreshPlugin(pluginId: string): Promise<void> {
    if (!window.electronAPI?.invoke) {
      return
    }

    const nextEntry = await window.electronAPI.invoke(IpcChannel.PLUGIN_GET_STATUS, { pluginId })
    if (nextEntry) {
      upsertRegistryEntry(nextEntry)
    }
  }

  async function runLifecycleAction(
    channel: typeof IpcChannel.PLUGIN_START | typeof IpcChannel.PLUGIN_STOP | typeof IpcChannel.PLUGIN_RETRY,
    pluginId: string,
  ): Promise<void> {
    if (!window.electronAPI?.invoke) {
      setRegistryError("Desktop bridge unavailable for plugin lifecycle actions.")
      return
    }

    setPendingPluginId(pluginId)
    setRegistryError(null)

    try {
      const result = await window.electronAPI.invoke(channel, { pluginId })
      await refreshPlugin(pluginId)

      if (!result.ok) {
        setRegistryError(`Plugin action failed for ${pluginId}: ${result.reason}`)
      }
    } catch (error) {
      setRegistryError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingPluginId((current) => (current === pluginId ? null : current))
    }
  }

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

  useEffect(() => {
    if (!bootstrap?.featureFlags.pluginSystem || !window.electronAPI?.on) {
      return
    }

    return window.electronAPI.on(IpcChannel.PLUGIN_LIFECYCLE, (payload) => {
      void refreshPlugin(payload.pluginId).catch((error: unknown) => {
        setRegistryError(error instanceof Error ? error.message : String(error))
      })
    })
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
            Phase 02 validates the local plugin lifecycle for bundled extensions before gateway routing and auth arrive.
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
                    {import.meta.env.DEV && <TableHead>Lifecycle</TableHead>}
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
                      {import.meta.env.DEV && (
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {canStart(entry) && (
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={pendingPluginId === getEntryPluginId(entry)}
                                onClick={() => {
                                  void runLifecycleAction(IpcChannel.PLUGIN_START, getEntryPluginId(entry))
                                }}
                              >
                                Start
                              </Button>
                            )}
                            {canStop(entry) && (
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={pendingPluginId === getEntryPluginId(entry)}
                                onClick={() => {
                                  void runLifecycleAction(IpcChannel.PLUGIN_STOP, getEntryPluginId(entry))
                                }}
                              >
                                Stop
                              </Button>
                            )}
                            {canRetry(entry) && (
                              <Button
                                size="xs"
                                disabled={pendingPluginId === getEntryPluginId(entry)}
                                onClick={() => {
                                  void runLifecycleAction(IpcChannel.PLUGIN_RETRY, getEntryPluginId(entry))
                                }}
                              >
                                Retry
                              </Button>
                            )}
                            {entry.kind === "invalid" && (
                              <span className="text-xs text-muted-foreground">Manifest invalid</span>
                            )}
                          </div>
                        </TableCell>
                      )}
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
