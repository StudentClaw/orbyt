import { useEffect, useState } from "react"
import {
  IpcChannel,
  type ExtensionAuthField,
  type ExtensionAuthManualTokenSchema,
  type ExtensionRegistryAvailableEntry,
  type ExtensionRegistryEntry,
  type PluginAuthStatus,
} from "@student-claw/contracts"
import { useRuntimeBootstrap, useRuntimeServerConfig } from "@/hooks/useAppRuntime"
import { DevOnboardingControls } from "@/components/dev/DevOnboardingControls"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const MIN_SECRET_LENGTH = 20

type AuthFormValues = Record<string, string>
type AuthStatusMap = Record<string, PluginAuthStatus | undefined>
type AuthFieldErrorMap = Record<string, Record<string, string>>

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

function hasManualTokenAuth(entry: ExtensionRegistryEntry): entry is ExtensionRegistryAvailableEntry & {
  manifest: ExtensionRegistryAvailableEntry["manifest"] & { auth: ExtensionAuthManualTokenSchema }
} {
  return entry.kind === "available" && entry.manifest.auth.type === "manual_token"
}

function buildEmptyAuthValues(auth: ExtensionAuthManualTokenSchema): AuthFormValues {
  return Object.fromEntries(auth.fields.map((field) => [field.key, ""]))
}

function getAuthStatusVariant(status?: PluginAuthStatus): "default" | "secondary" | "destructive" | "outline" {
  if (!status || status.status === "not_configured") {
    return "secondary"
  }

  if (status.status === "error") {
    return "destructive"
  }

  return "default"
}

function getAuthStatusLabel(status?: PluginAuthStatus): string {
  if (!status) {
    return "Loading"
  }

  switch (status.status) {
    case "configured":
      return "Configured"
    case "error":
      return "Error"
    case "not_configured":
      return "Not configured"
  }
}

function getInputType(field: ExtensionAuthField): string {
  if (field.type === "secret") {
    return "password"
  }

  if (field.type === "base_url") {
    return "url"
  }

  return "text"
}

function validateAuthField(field: ExtensionAuthField, value: string): string | null {
  const trimmed = value.trim()

  if (field.required && trimmed.length === 0) {
    return `${field.label} is required.`
  }

  if (trimmed.length === 0) {
    return null
  }

  if (field.type === "base_url" && !isValidCanvasBaseUrl(trimmed)) {
    return "Enter a valid HTTPS Canvas URL."
  }

  if (field.type === "secret" && trimmed.length < MIN_SECRET_LENGTH) {
    return `Enter at least ${MIN_SECRET_LENGTH} characters.`
  }

  return null
}

function validateAuthValues(auth: ExtensionAuthManualTokenSchema, values: AuthFormValues): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  for (const field of auth.fields) {
    const error = validateAuthField(field, values[field.key] ?? "")
    if (error) {
      fieldErrors[field.key] = error
    }
  }

  return fieldErrors
}

export function SettingsPage() {
  const bootstrap = useRuntimeBootstrap()
  const serverConfig = useRuntimeServerConfig()
  const [registryEntries, setRegistryEntries] = useState<ExtensionRegistryEntry[]>([])
  const [registryState, setRegistryState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [registryError, setRegistryError] = useState<string | null>(null)
  const [pendingPluginId, setPendingPluginId] = useState<string | null>(null)
  const [pendingAuthPluginId, setPendingAuthPluginId] = useState<string | null>(null)
  const [authStatuses, setAuthStatuses] = useState<AuthStatusMap>({})
  const [authForms, setAuthForms] = useState<Record<string, AuthFormValues>>({})
  const [authErrors, setAuthErrors] = useState<Record<string, string | null>>({})
  const [authFieldErrors, setAuthFieldErrors] = useState<AuthFieldErrorMap>({})

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

  function ensureAuthForms(entries: ExtensionRegistryEntry[]): void {
    setAuthForms((current) => {
      const next = { ...current }
      for (const entry of entries) {
        if (!hasManualTokenAuth(entry)) {
          continue
        }

        if (!next[entry.manifest.id]) {
          next[entry.manifest.id] = buildEmptyAuthValues(entry.manifest.auth)
        }
      }
      return next
    })
  }

  async function refreshAuthStatus(pluginId: string): Promise<void> {
    if (!window.electronAPI?.invoke) {
      return
    }

    const nextStatus = await window.electronAPI.invoke(IpcChannel.PLUGIN_GET_AUTH_STATUS, { pluginId })
    if (nextStatus) {
      setAuthStatuses((current) => ({
        ...current,
        [pluginId]: nextStatus,
      }))
    }
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

  async function savePluginAuth(
    entry: ExtensionRegistryAvailableEntry & { manifest: ExtensionRegistryAvailableEntry["manifest"] & { auth: ExtensionAuthManualTokenSchema } },
  ): Promise<void> {
    if (!window.electronAPI?.invoke) {
      setAuthErrors((current) => ({
        ...current,
        [entry.manifest.id]: "Desktop bridge unavailable for plugin credentials.",
      }))
      return
    }

    const pluginId = entry.manifest.id
    const values = authForms[pluginId] ?? buildEmptyAuthValues(entry.manifest.auth)
    const localFieldErrors = validateAuthValues(entry.manifest.auth, values)

    setAuthFieldErrors((current) => ({
      ...current,
      [pluginId]: localFieldErrors,
    }))

    if (Object.keys(localFieldErrors).length > 0) {
      setAuthErrors((current) => ({
        ...current,
        [pluginId]: "Credentials are incomplete or invalid.",
      }))
      return
    }

    setPendingAuthPluginId(pluginId)
    setAuthErrors((current) => ({
      ...current,
      [pluginId]: null,
    }))

    try {
      const result = await window.electronAPI.invoke(IpcChannel.PLUGIN_SAVE_AUTH, { pluginId, values })
      if (result.ok) {
        setAuthStatuses((current) => ({
          ...current,
          [pluginId]: {
            pluginId,
            status: result.status,
          },
        }))
        setAuthFieldErrors((current) => ({
          ...current,
          [pluginId]: {},
        }))
        return
      }

      setAuthErrors((current) => ({
        ...current,
        [pluginId]: result.error,
      }))
      setAuthFieldErrors((current) => ({
        ...current,
        [pluginId]: result.fieldErrors ?? {},
      }))
      await refreshAuthStatus(pluginId)
    } catch (error) {
      setAuthErrors((current) => ({
        ...current,
        [pluginId]: error instanceof Error ? error.message : String(error),
      }))
    } finally {
      setPendingAuthPluginId((current) => (current === pluginId ? null : current))
    }
  }

  useEffect(() => {
    let cancelled = false

    if (!bootstrap?.featureFlags.pluginSystem) {
      setRegistryEntries([])
      setRegistryState("idle")
      setRegistryError(null)
      setAuthStatuses({})
      setAuthErrors({})
      setAuthFieldErrors({})
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
      .then(async (entries) => {
        if (cancelled) {
          return
        }

        setRegistryEntries(entries)
        ensureAuthForms(entries)
        setRegistryState("ready")

        const manualEntries = entries.filter(hasManualTokenAuth)
        const nextStatuses = await Promise.all(
          manualEntries.map(async (entry) => {
            const status = await window.electronAPI!.invoke(IpcChannel.PLUGIN_GET_AUTH_STATUS, {
              pluginId: entry.manifest.id,
            })
            return [entry.manifest.id, status] as const
          }),
        )

        if (cancelled) {
          return
        }

        setAuthStatuses((current) => ({
          ...current,
          ...(Object.fromEntries(nextStatuses.filter(([, status]) => Boolean(status))) as AuthStatusMap),
        }))
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

  const manualAuthEntries = registryEntries.filter(hasManualTokenAuth)

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
            Phase 04 keeps extension lifecycle and credential setup in one place while plugin auth becomes real.
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

      {bootstrap?.featureFlags.pluginSystem && manualAuthEntries.length > 0 && (
        <div className="space-y-4" data-testid="settings-plugin-auth">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Extension Credentials</h2>
            <p className="text-sm text-muted-foreground">
              Credentials are saved through Electron Main and delivered only to the owning plugin runtime after start.
            </p>
          </div>

          {manualAuthEntries.map((entry) => {
            const pluginId = entry.manifest.id
            const auth = entry.manifest.auth
            const authStatus = authStatuses[pluginId]
            const values = authForms[pluginId] ?? buildEmptyAuthValues(auth)
            const fieldErrors = authFieldErrors[pluginId] ?? {}
            const saveError = authErrors[pluginId]

            return (
              <Card key={pluginId} data-testid={`settings-plugin-auth-card-${pluginId}`}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle>{entry.manifest.name}</CardTitle>
                      <CardDescription>{auth.instructions}</CardDescription>
                    </div>
                    <Badge variant={getAuthStatusVariant(authStatus)}>
                      {getAuthStatusLabel(authStatus)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {auth.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={`${pluginId}-${field.key}`}>{field.label}</Label>
                        <Input
                          id={`${pluginId}-${field.key}`}
                          type={getInputType(field)}
                          placeholder={field.placeholder}
                          value={values[field.key] ?? ""}
                          onChange={(event) => {
                            const nextValue = event.target.value
                            setAuthForms((current) => ({
                              ...current,
                              [pluginId]: {
                                ...(current[pluginId] ?? buildEmptyAuthValues(auth)),
                                [field.key]: nextValue,
                              },
                            }))
                            setAuthFieldErrors((current) => ({
                              ...current,
                              [pluginId]: {
                                ...(current[pluginId] ?? {}),
                                [field.key]: "",
                              },
                            }))
                            setAuthErrors((current) => ({
                              ...current,
                              [pluginId]: null,
                            }))
                          }}
                          data-testid={`settings-plugin-auth-input-${pluginId}-${field.key}`}
                        />
                        {fieldErrors[field.key] && (
                          <p
                            className="text-sm text-destructive"
                            data-testid={`settings-plugin-auth-field-error-${pluginId}-${field.key}`}
                          >
                            {fieldErrors[field.key]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {authStatus?.error && (
                    <Alert variant="destructive" data-testid={`settings-plugin-auth-status-error-${pluginId}`}>
                      <AlertTitle>Credential state error</AlertTitle>
                      <AlertDescription>{authStatus.error}</AlertDescription>
                    </Alert>
                  )}

                  {saveError && (
                    <Alert variant="destructive" data-testid={`settings-plugin-auth-save-error-${pluginId}`}>
                      <AlertTitle>Unable to save credentials</AlertTitle>
                      <AlertDescription>{saveError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Status: {getAuthStatusLabel(authStatus)}
                    </p>
                    <Button
                      disabled={pendingAuthPluginId === pluginId}
                      onClick={() => {
                        void savePluginAuth(entry)
                      }}
                      data-testid={`settings-plugin-auth-save-${pluginId}`}
                    >
                      Save credentials
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {import.meta.env.DEV && <DevOnboardingControls />}
    </div>
  )
}
function isValidCanvasBaseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname.length > 0
  } catch {
    return false
  }
}
