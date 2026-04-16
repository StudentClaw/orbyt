import { useEffect, useState } from "react"
import {
  IpcChannel,
  type ExtensionAuthField,
  type ExtensionAuthManualTokenSchema,
  type ExtensionRegistryAvailableEntry,
  type ExtensionRegistryEntry,
  type PluginAuthStatus,
  type ProviderRuntimeState,
} from "@student-claw/contracts"
import {
  useOrchestrationActions,
  useRuntimeBootstrap,
  useRuntimeOrchestrationSnapshot,
} from "@/hooks/useAppRuntime"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { connectCodexAccount } from "@/lib/codexAuth"

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
  return entry.kind === "invalid" ? entry.lastError : (entry.lastError ?? null)
}
function formatInstallSource(entry: ExtensionRegistryEntry): string {
  switch (entry.installSource) {
    case "bundled": return "Bundled"
    case "user": return "User"
    case "system": return "System"
  }
  return entry.installSource
}
function getStatusBadgeVariant(entry: ExtensionRegistryEntry): "default" | "secondary" | "destructive" | "outline" {
  if (entry.kind === "invalid" || entry.status === "error") return "destructive"
  if (entry.status === "discovered") return "secondary"
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
  return Object.fromEntries(auth.fields.map((f) => [f.key, ""]))
}
function getAuthStatusVariant(status?: PluginAuthStatus): "default" | "secondary" | "destructive" | "outline" {
  if (!status || status.status === "not_configured") return "secondary"
  if (status.status === "error") return "destructive"
  return "default"
}
function getAuthStatusLabel(status?: PluginAuthStatus): string {
  if (!status) return "Loading"
  switch (status.status) {
    case "configured": return "Configured"
    case "error": return "Error"
    case "not_configured": return "Not configured"
  }
}
function getInputType(field: ExtensionAuthField): string {
  if (field.type === "secret") return "password"
  if (field.type === "base_url") return "url"
  return "text"
}
function isValidCanvasBaseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname.length > 0
  } catch { return false }
}
function validateAuthField(field: ExtensionAuthField, value: string): string | null {
  const trimmed = value.trim()
  if (field.required && trimmed.length === 0) return `${field.label} is required.`
  if (trimmed.length === 0) return null
  if (field.type === "base_url" && !isValidCanvasBaseUrl(trimmed)) return "Enter a valid HTTPS Canvas URL."
  if (field.type === "secret" && trimmed.length < MIN_SECRET_LENGTH) return `Enter at least ${MIN_SECRET_LENGTH} characters.`
  return null
}
function validateAuthValues(auth: ExtensionAuthManualTokenSchema, values: AuthFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of auth.fields) {
    const err = validateAuthField(field, values[field.key] ?? "")
    if (err) errors[field.key] = err
  }
  return errors
}
function getCodexStatusBadgeVariant(runtime: ProviderRuntimeState | null): "default" | "secondary" | "destructive" | "outline" {
  if (!runtime) return "secondary"
  if (runtime.authState === "authenticated") return "default"
  if (runtime.authState === "auth_required" || runtime.authState === "expired") return "destructive"
  if (runtime.status === "degraded" || runtime.status === "rate_limited") return "destructive"
  return "secondary"
}
function getCodexStatusLabel(runtime: ProviderRuntimeState | null): string {
  if (!runtime) return "Checking runtime"
  if (runtime.authState === "authenticated") {
    if (runtime.status === "initializing") return "Connecting"
    if (runtime.status === "degraded") return "Degraded"
    if (runtime.status === "rate_limited") return "Rate limited"
    return "Connected"
  }
  if (runtime.authState === "expired") return "Session expired"
  if (runtime.authState === "auth_required" || runtime.status === "auth_required") return "Sign-in required"
  if (runtime.status === "initializing") return "Initializing"
  return "Not connected"
}
function getCodexStatusDescription(runtime: ProviderRuntimeState | null): string {
  if (!runtime) return "Waiting for the local runtime to report Codex availability."
  if (runtime.authState === "authenticated") return runtime.lastError?.message ?? "Codex is authenticated and available to the chat runtime."
  if (runtime.lastError?.message) return runtime.lastError.message
  if (runtime.authState === "expired") return "Your Codex session expired. Sign in again to restore chat access."
  return "Codex is not authenticated in this app runtime yet."
}

export function ConnectionsSection() {
  const bootstrap = useRuntimeBootstrap()
  const snapshot = useRuntimeOrchestrationSnapshot()
  const orchestrationActions = useOrchestrationActions()
  const [registryEntries, setRegistryEntries] = useState<ExtensionRegistryEntry[]>([])
  const [registryState, setRegistryState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [registryError, setRegistryError] = useState<string | null>(null)
  const [pendingPluginId, setPendingPluginId] = useState<string | null>(null)
  const [pendingAuthPluginId, setPendingAuthPluginId] = useState<string | null>(null)
  const [pendingCodexAction, setPendingCodexAction] = useState<"connect" | "retry" | null>(null)
  const [codexActionError, setCodexActionError] = useState<string | null>(null)
  const [authStatuses, setAuthStatuses] = useState<AuthStatusMap>({})
  const [authForms, setAuthForms] = useState<Record<string, AuthFormValues>>({})
  const [authErrors, setAuthErrors] = useState<Record<string, string | null>>({})
  const [authFieldErrors, setAuthFieldErrors] = useState<AuthFieldErrorMap>({})

  const providerRuntime = snapshot?.providerRuntime ?? null
  const codexNeedsAuth =
    !providerRuntime
    || providerRuntime.authState === "unknown"
    || providerRuntime.authState === "auth_required"
    || providerRuntime.authState === "expired"
    || providerRuntime.status === "auth_required"
  const codexCanRetry =
    providerRuntime !== null
    && !codexNeedsAuth
    && (providerRuntime.status === "offline" || providerRuntime.status === "degraded" || providerRuntime.status === "rate_limited")

  function upsertRegistryEntry(nextEntry: ExtensionRegistryEntry): void {
    setRegistryEntries((current) => {
      const index = current.findIndex((e) => getEntryPluginId(e) === getEntryPluginId(nextEntry))
      if (index === -1) return [...current, nextEntry]
      const updated = [...current]
      updated[index] = nextEntry
      return updated
    })
  }

  function ensureAuthForms(entries: ExtensionRegistryEntry[]): void {
    setAuthForms((current) => {
      const next = { ...current }
      for (const entry of entries) {
        if (!hasManualTokenAuth(entry)) continue
        if (!next[entry.manifest.id]) next[entry.manifest.id] = buildEmptyAuthValues(entry.manifest.auth)
      }
      return next
    })
  }

  async function refreshAuthStatus(pluginId: string): Promise<void> {
    if (!window.electronAPI?.invoke) return
    const nextStatus = await window.electronAPI.invoke(IpcChannel.PLUGIN_GET_AUTH_STATUS, { pluginId })
    if (nextStatus) setAuthStatuses((c) => ({ ...c, [pluginId]: nextStatus }))
  }

  async function refreshPlugin(pluginId: string): Promise<void> {
    if (!window.electronAPI?.invoke) return
    const nextEntry = await window.electronAPI.invoke(IpcChannel.PLUGIN_GET_STATUS, { pluginId })
    if (nextEntry) upsertRegistryEntry(nextEntry)
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
      if (!result.ok) setRegistryError(`Plugin action failed for ${pluginId}: ${result.reason}`)
    } catch (error) {
      setRegistryError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingPluginId((c) => (c === pluginId ? null : c))
    }
  }

  async function savePluginAuth(
    entry: ExtensionRegistryAvailableEntry & { manifest: ExtensionRegistryAvailableEntry["manifest"] & { auth: ExtensionAuthManualTokenSchema } },
  ): Promise<void> {
    if (!window.electronAPI?.invoke) {
      setAuthErrors((c) => ({ ...c, [entry.manifest.id]: "Desktop bridge unavailable for plugin credentials." }))
      return
    }
    const pluginId = entry.manifest.id
    const values = authForms[pluginId] ?? buildEmptyAuthValues(entry.manifest.auth)
    const localFieldErrors = validateAuthValues(entry.manifest.auth, values)
    setAuthFieldErrors((c) => ({ ...c, [pluginId]: localFieldErrors }))
    if (Object.keys(localFieldErrors).length > 0) {
      setAuthErrors((c) => ({ ...c, [pluginId]: "Credentials are incomplete or invalid." }))
      return
    }
    setPendingAuthPluginId(pluginId)
    setAuthErrors((c) => ({ ...c, [pluginId]: null }))
    try {
      const result = await window.electronAPI.invoke(IpcChannel.PLUGIN_SAVE_AUTH, { pluginId, values })
      if (result.ok) {
        setAuthStatuses((c) => ({ ...c, [pluginId]: { pluginId, status: result.status } }))
        setAuthFieldErrors((c) => ({ ...c, [pluginId]: {} }))
        return
      }
      setAuthErrors((c) => ({ ...c, [pluginId]: result.error }))
      setAuthFieldErrors((c) => ({ ...c, [pluginId]: result.fieldErrors ?? {} }))
      await refreshAuthStatus(pluginId)
    } catch (error) {
      setAuthErrors((c) => ({ ...c, [pluginId]: error instanceof Error ? error.message : String(error) }))
    } finally {
      setPendingAuthPluginId((c) => (c === pluginId ? null : c))
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
      return () => { cancelled = true }
    }
    if (!window.electronAPI?.invoke) {
      setRegistryEntries([])
      setRegistryState("error")
      setRegistryError("Desktop bridge unavailable for plugin registry reads.")
      return () => { cancelled = true }
    }
    setRegistryState("loading")
    setRegistryError(null)
    window.electronAPI.invoke(IpcChannel.PLUGIN_LIST)
      .then(async (entries) => {
        if (cancelled) return
        setRegistryEntries(entries)
        ensureAuthForms(entries)
        setRegistryState("ready")
        const manualEntries = entries.filter(hasManualTokenAuth)
        const nextStatuses = await Promise.all(
          manualEntries.map(async (entry) => {
            const status = await window.electronAPI!.invoke(IpcChannel.PLUGIN_GET_AUTH_STATUS, { pluginId: entry.manifest.id })
            return [entry.manifest.id, status] as const
          }),
        )
        if (cancelled) return
        setAuthStatuses((c) => ({
          ...c,
          ...(Object.fromEntries(nextStatuses.filter(([, s]) => Boolean(s))) as AuthStatusMap),
        }))
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setRegistryEntries([])
        setRegistryState("error")
        setRegistryError(error instanceof Error ? error.message : String(error))
      })
    return () => { cancelled = true }
  }, [bootstrap])

  useEffect(() => {
    if (!bootstrap?.featureFlags.pluginSystem || !window.electronAPI?.on) return
    return window.electronAPI.on(IpcChannel.PLUGIN_LIFECYCLE, (payload) => {
      void refreshPlugin(payload.pluginId).catch((error: unknown) => {
        setRegistryError(error instanceof Error ? error.message : String(error))
      })
    })
  }, [bootstrap])

  const manualAuthEntries = registryEntries.filter(hasManualTokenAuth)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Connections</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manage AI provider and extension connections.</p>
      </div>

      <Card data-testid="settings-codex-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Codex Connection</CardTitle>
              <CardDescription>This is the account and runtime used by Student Claw chat.</CardDescription>
            </div>
            <Badge variant={getCodexStatusBadgeVariant(providerRuntime)} data-testid="settings-codex-status">
              {pendingCodexAction === "connect" ? "Connecting" : pendingCodexAction === "retry" ? "Retrying" : getCodexStatusLabel(providerRuntime)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {pendingCodexAction === "connect"
              ? "Finishing the Codex login flow and reloading the local runtime."
              : pendingCodexAction === "retry"
                ? "Retrying the local Codex runtime."
                : getCodexStatusDescription(providerRuntime)}
          </p>
          {providerRuntime && (
            <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
              <div data-testid="settings-codex-auth-state">
                <span className="font-medium text-foreground">Auth state:</span> {providerRuntime.authState}
              </div>
              <div data-testid="settings-codex-runtime-state">
                <span className="font-medium text-foreground">Runtime state:</span> {providerRuntime.status}
              </div>
            </div>
          )}
          {codexActionError && (
            <Alert variant="destructive" data-testid="settings-codex-error">
              <AlertTitle>Codex connection failed</AlertTitle>
              <AlertDescription>{codexActionError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            {codexNeedsAuth && (
              <Button
                disabled={pendingCodexAction !== null}
                onClick={() => {
                  setPendingCodexAction("connect")
                  setCodexActionError(null)
                  void connectCodexAccount()
                    .then((result) => {
                      if (result.status !== "connected") setCodexActionError(result.error)
                    })
                    .catch((error) => { setCodexActionError(error instanceof Error ? error.message : String(error)) })
                    .finally(() => { setPendingCodexAction(null) })
                }}
                data-testid="settings-codex-connect"
              >
                Connect Codex
              </Button>
            )}
            {codexCanRetry && (
              <Button
                variant="outline"
                disabled={pendingCodexAction !== null}
                onClick={() => {
                  setPendingCodexAction("retry")
                  setCodexActionError(null)
                  Promise.resolve(orchestrationActions.retryProviderInitialize())
                    .catch((error) => { setCodexActionError(error instanceof Error ? error.message : String(error)) })
                    .finally(() => { setPendingCodexAction(null) })
                }}
                data-testid="settings-codex-retry"
              >
                Retry Runtime
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
              <AlertDescription>The plugin registry stays dark until the desktop feature flag is enabled.</AlertDescription>
            </Alert>
          )}
          {bootstrap?.featureFlags.pluginSystem && registryState === "loading" && (
            <Alert data-testid="settings-plugin-loading">
              <AlertTitle>Loading discovered extensions</AlertTitle>
              <AlertDescription>Reading bundled and user extension manifests from the desktop runtime.</AlertDescription>
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
                      <TableCell><Badge variant={getStatusBadgeVariant(entry)}>{entry.status}</Badge></TableCell>
                      <TableCell>{getEntryVersion(entry)}</TableCell>
                      <TableCell className="max-w-sm whitespace-normal text-sm text-muted-foreground">
                        {getEntryError(entry) ?? "Valid manifest"}
                      </TableCell>
                      {import.meta.env.DEV && (
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {canStart(entry) && (
                              <Button size="xs" variant="outline" disabled={pendingPluginId === getEntryPluginId(entry)} onClick={() => { void runLifecycleAction(IpcChannel.PLUGIN_START, getEntryPluginId(entry)) }}>Start</Button>
                            )}
                            {canStop(entry) && (
                              <Button size="xs" variant="outline" disabled={pendingPluginId === getEntryPluginId(entry)} onClick={() => { void runLifecycleAction(IpcChannel.PLUGIN_STOP, getEntryPluginId(entry)) }}>Stop</Button>
                            )}
                            {canRetry(entry) && (
                              <Button size="xs" disabled={pendingPluginId === getEntryPluginId(entry)} onClick={() => { void runLifecycleAction(IpcChannel.PLUGIN_RETRY, getEntryPluginId(entry)) }}>Retry</Button>
                            )}
                            {entry.kind === "invalid" && <span className="text-xs text-muted-foreground">Manifest invalid</span>}
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
                    <Badge variant={getAuthStatusVariant(authStatus)}>{getAuthStatusLabel(authStatus)}</Badge>
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
                            setAuthForms((c) => ({ ...c, [pluginId]: { ...(c[pluginId] ?? buildEmptyAuthValues(auth)), [field.key]: nextValue } }))
                            setAuthFieldErrors((c) => ({ ...c, [pluginId]: { ...(c[pluginId] ?? {}), [field.key]: "" } }))
                            setAuthErrors((c) => ({ ...c, [pluginId]: null }))
                          }}
                          data-testid={`settings-plugin-auth-input-${pluginId}-${field.key}`}
                        />
                        {fieldErrors[field.key] && (
                          <p className="text-sm text-destructive" data-testid={`settings-plugin-auth-field-error-${pluginId}-${field.key}`}>
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
                    <p className="text-sm text-muted-foreground">Status: {getAuthStatusLabel(authStatus)}</p>
                    <Button disabled={pendingAuthPluginId === pluginId} onClick={() => { void savePluginAuth(entry) }} data-testid={`settings-plugin-auth-save-${pluginId}`}>
                      Save credentials
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
