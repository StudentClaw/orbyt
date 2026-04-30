import { useDeferredValue, useEffect, useMemo, useState } from "react"
import {
  Alert02Icon,
  ApiIcon,
  BookOpen02Icon,
  BrainIcon,
  Calendar03Icon,
  CodeIcon,
  Link01Icon,
  PackageIcon,
  SearchIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  IpcChannel,
  type ExtensionAuthField,
  type ExtensionAuthManualTokenSchema,
  type ExtensionRegistryAvailableEntry,
  type ExtensionRegistryEntry,
  type ExtensionRuntimeReadiness,
  type ExtensionToolSummary,
  type PluginAuthStatus,
} from "@orbyt/contracts"
import {
  useRuntimeCanvasSyncProgress,
  useRuntimeBootstrap,
  useSkills,
  type SkillEntry,
} from "@/hooks/useAppRuntime"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"

const MIN_SECRET_LENGTH = 20

type ManagerTab = "plugins" | "mcps" | "skills"
type AuthFormValues = Record<string, string>
type AuthStatusMap = Record<string, PluginAuthStatus | undefined>
type AuthFieldErrorMap = Record<string, Record<string, string>>
type NoAuthExtensionEntry = ExtensionRegistryAvailableEntry & {
  manifest: ExtensionRegistryAvailableEntry["manifest"] & { auth: { type: "none" } }
}
type ReadinessActionKind = "enable" | "disable" | "retry_bridge" | "grant_access" | "retry_plugin"
type ReadinessPanelModel = {
  label: string
  body: string
  actionLabel?: string
  actionKind?: ReadinessActionKind
}

type ConnectionsSectionProps = {
  selectedPluginId?: string | null
  onSelectPlugin?: (pluginId: string) => void
  onBackToRegistry?: () => void
}

function getEntryName(entry: ExtensionRegistryEntry): string {
  return entry.kind === "available" ? entry.manifest.name : entry.displayName
}

function getEntryDescription(entry: ExtensionRegistryEntry): string {
  if (entry.kind === "available") {
    return entry.manifest.description
  }

  return "Manifest validation failed for this plugin."
}

function getEntryVersion(entry: ExtensionRegistryEntry): string {
  return entry.kind === "available" ? entry.manifest.version : "Invalid manifest"
}

function getEntryPluginId(entry: ExtensionRegistryEntry): string {
  return entry.kind === "available" ? entry.manifest.id : entry.pluginId
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
  if (entry.kind === "invalid" || entry.status === "error") return "destructive"
  if (entry.status === "discovered") return "secondary"
  if (entry.status === "active" || entry.status === "ready") return "default"
  return "outline"
}

function getReadinessLabel(readiness: ExtensionRuntimeReadiness): string {
  switch (readiness) {
    case "ready":
      return "Ready"
    case "bridge_starting":
      return "Starting bridge"
    case "bridge_unavailable":
      return "Bridge unavailable"
    case "permission_required":
      return "Permission required"
    case "bridge_crash_loop":
      return "Bridge keeps crashing"
    case "platform_unsupported":
      return "Not available on this platform"
    case "error":
      return "Error"
  }

  return "Unknown"
}

function hasManualTokenAuth(entry: ExtensionRegistryEntry): entry is ExtensionRegistryAvailableEntry & {
  manifest: ExtensionRegistryAvailableEntry["manifest"] & { auth: ExtensionAuthManualTokenSchema }
} {
  return entry.kind === "available" && entry.manifest.auth.type === "manual_token"
}

function hasNoAuthExtension(entry: ExtensionRegistryEntry): entry is NoAuthExtensionEntry {
  return entry.kind === "available" && entry.manifest.auth.type === "none"
}

function buildEmptyAuthValues(auth: ExtensionAuthManualTokenSchema): AuthFormValues {
  return Object.fromEntries(auth.fields.map((field) => [field.key, ""]))
}

function getAuthStatusVariant(status?: PluginAuthStatus): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "secondary"
  if (status.status === "not_configured") return "destructive"
  if (status.status === "error") return "destructive"
  return "default"
}

function getAuthStatusLabel(status?: PluginAuthStatus): string {
  if (!status) return "Loading"
  switch (status.status) {
    case "configured":
      return "Configured"
    case "error":
      return "Error"
    case "not_configured":
      return "Not configured"
  }

  return "Unknown"
}

function getInputType(field: ExtensionAuthField): string {
  if (field.type === "secret") return "password"
  if (field.type === "base_url") return "url"
  return "text"
}

function getReadinessActionLabel(entry: NoAuthExtensionEntry, action: ReadinessActionKind): string {
  switch (action) {
    case "enable":
      return "Enable"
    case "disable":
      return "Disable"
    case "retry_bridge":
      return "Retry bridge"
    case "grant_access":
      return entry.manifest.id === "apple-calendar-mcp" ? "Grant Calendar access" : "Grant access"
    case "retry_plugin":
      return "Retry"
  }
}

function getReadinessPanelModel(entry: NoAuthExtensionEntry): ReadinessPanelModel {
  const name = entry.manifest.name

  if (!entry.enabled) {
    return {
      label: "Disabled",
      body: `${name} is off. Enable it to use its tools.`,
      actionLabel: getReadinessActionLabel(entry, "enable"),
      actionKind: "enable",
    }
  }

  switch (entry.readiness) {
    case "bridge_starting":
      return {
        label: "Starting",
        body: `Orbyt is starting the local bridge for ${name}.`,
      }
    case "bridge_unavailable":
      return {
        label: "Bridge unavailable",
        body: entry.lastError ?? `The local bridge for ${name} did not start. You can retry it.`,
        actionLabel: getReadinessActionLabel(entry, "retry_bridge"),
        actionKind: "retry_bridge",
      }
    case "permission_required":
      return {
        label: "Permission required",
        body: entry.lastError ?? `Grant local permissions in macOS Settings so Orbyt can use ${name}.`,
        actionLabel: getReadinessActionLabel(entry, "grant_access"),
        actionKind: "grant_access",
      }
    case "bridge_crash_loop":
      return {
        label: "Bridge keeps crashing",
        body: entry.lastError ?? `The local bridge for ${name} has repeatedly failed to start. Retry is rate-limited.`,
        actionLabel: getReadinessActionLabel(entry, "retry_bridge"),
        actionKind: "retry_bridge",
      }
    case "ready":
      return {
        label: "Ready",
        body: `${name} tools are available.`,
        actionLabel: getReadinessActionLabel(entry, "disable"),
        actionKind: "disable",
      }
    case "error":
      return {
        label: "Error",
        body: entry.lastError ?? `${name} hit an error. You can retry it.`,
        actionLabel: getReadinessActionLabel(entry, "retry_plugin"),
        actionKind: "retry_plugin",
      }
    case "platform_unsupported":
      return {
        label: "Not available on this platform",
        body: `${name} is not available on this platform.`,
      }
  }

  if (entry.status === "starting") {
    return {
      label: "Starting",
      body: `Orbyt is starting ${name}.`,
    }
  }

  if (entry.status === "ready" || entry.status === "active") {
    return {
      label: "Ready",
      body: `${name} tools are available.`,
      actionLabel: getReadinessActionLabel(entry, "disable"),
      actionKind: "disable",
    }
  }

  return {
    label: "Error",
    body: entry.lastError ?? `${name} is waiting for local runtime readiness.`,
    actionLabel: getReadinessActionLabel(entry, "retry_plugin"),
    actionKind: "retry_plugin",
  }
}

function isValidCanvasBaseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname.length > 0
  } catch {
    return false
  }
}

function validateAuthField(
  field: ExtensionAuthField,
  value: string,
  hasSavedValue: boolean,
): string | null {
  const trimmed = value.trim()
  if (field.required && trimmed.length === 0) {
    if (field.type === "secret" && hasSavedValue) return null
    return `${field.label} is required.`
  }
  if (trimmed.length === 0) return null
  if (field.type === "base_url" && !isValidCanvasBaseUrl(trimmed)) return "Enter a valid HTTPS Canvas URL."
  if (field.type === "secret" && trimmed.length < MIN_SECRET_LENGTH) return `Enter at least ${MIN_SECRET_LENGTH} characters.`
  return null
}

function validateAuthValues(
  auth: ExtensionAuthManualTokenSchema,
  values: AuthFormValues,
  hasSavedValue: Readonly<Record<string, boolean>> = {},
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of auth.fields) {
    const err = validateAuthField(field, values[field.key] ?? "", hasSavedValue[field.key] ?? false)
    if (err) errors[field.key] = err
  }
  return errors
}

function isMcpEntry(entry: ExtensionRegistryEntry): boolean {
  return getEntryPluginId(entry).endsWith("-mcp")
}

function matchesPluginSearch(entry: ExtensionRegistryEntry, query: string): boolean {
  const haystack = [
    getEntryName(entry),
    getEntryDescription(entry),
    getEntryPluginId(entry),
    formatInstallSource(entry),
    entry.kind === "available" ? entry.manifest.author : "",
  ].join(" ").toLowerCase()
  return haystack.includes(query)
}

function matchesSkillSearch(skill: SkillEntry, query: string): boolean {
  return `${skill.name} ${skill.description} ${skill.id}`.toLowerCase().includes(query)
}

function resolvePluginIcon(entry: ExtensionRegistryEntry) {
  const pluginId = getEntryPluginId(entry)

  if (entry.kind === "invalid") return Alert02Icon
  if (pluginId === "canvas-mcp") return BookOpen02Icon
  if (pluginId === "apple-calendar-mcp") return Calendar03Icon
  if (isMcpEntry(entry)) return ApiIcon
  return PackageIcon
}

function getPluginTone(entry: ExtensionRegistryEntry): string {
  if (entry.kind === "invalid") return "bg-destructive/10 text-destructive"
  if (isMcpEntry(entry)) return "bg-primary/10 text-primary"
  return "bg-muted text-foreground"
}

function PluginMark({
  entry,
  className = "size-11 rounded-2xl",
  iconSize = 22,
}: {
  entry: ExtensionRegistryEntry
  className?: string
  iconSize?: number
}) {
  return (
    <div className={`${className} ${getPluginTone(entry)} flex shrink-0 items-center justify-center`}>
      <HugeiconsIcon icon={resolvePluginIcon(entry)} size={iconSize} strokeWidth={1.8} />
    </div>
  )
}

function MetadataBadge({ children }: { children: React.ReactNode }) {
  return <Badge variant="outline" className="bg-transparent">{children}</Badge>
}

function PluginCard({
  entry,
  pendingPluginId,
  authStatus,
  onSelect,
  onToggle,
}: {
  entry: ExtensionRegistryEntry
  pendingPluginId: string | null
  authStatus?: PluginAuthStatus
  onSelect: (pluginId: string) => void
  onToggle: (pluginId: string, enabled: boolean) => void
}) {
  const pluginId = getEntryPluginId(entry)
  const isPending = pendingPluginId === pluginId
  const isInvalid = entry.kind === "invalid"
  const isManualAuth = hasManualTokenAuth(entry)

  return (
    <div
      className="flex h-full flex-col rounded-3xl border border-border/70 bg-card/30 p-4 transition-colors hover:border-border hover:bg-card/50"
      data-testid={`settings-plugin-row-${pluginId}`}
    >
      <div className="flex items-start justify-between gap-3">
        <PluginMark entry={entry} />
        <div
          className="shrink-0"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Switch
            size="sm"
            checked={entry.enabled && entry.kind === "available"}
            disabled={isPending || isInvalid}
            onCheckedChange={(checked) => {
              onToggle(pluginId, checked)
            }}
            aria-label={`${entry.enabled ? "Disable" : "Enable"} ${getEntryName(entry)}`}
          />
        </div>
      </div>

      <button
        type="button"
        className="mt-4 flex flex-1 flex-col items-start rounded-2xl text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60"
        data-testid={`settings-plugin-manage-${pluginId}`}
        onClick={() => onSelect(pluginId)}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-base font-medium text-foreground">{getEntryName(entry)}</p>
          <Badge variant={getStatusBadgeVariant(entry)}>{entry.status}</Badge>
          {entry.kind === "available" && entry.readiness && (
            <MetadataBadge>{getReadinessLabel(entry.readiness)}</MetadataBadge>
          )}
          {isManualAuth && (
            <Badge
              variant={getAuthStatusVariant(authStatus)}
              data-testid={`settings-plugin-card-auth-${pluginId}`}
            >
              {getAuthStatusLabel(authStatus)}
            </Badge>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{getEntryDescription(entry)}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <MetadataBadge>{isMcpEntry(entry) ? "MCP" : "Plugin"}</MetadataBadge>
          <MetadataBadge>{formatInstallSource(entry)}</MetadataBadge>
          <MetadataBadge>v{getEntryVersion(entry)}</MetadataBadge>
          {entry.kind === "available" && <MetadataBadge>{entry.manifest.tools.length} tools</MetadataBadge>}
        </div>

        <p className="mt-auto pt-4 text-xs text-muted-foreground">{pluginId}</p>
      </button>
    </div>
  )
}

function PluginDetailView({
  entry,
  pendingPluginId,
  pendingAuthPluginId,
  pendingClearAuthPluginId,
  pendingSyncPluginId,
  pendingReadinessPluginId,
  isCanvasSyncing,
  authStatus,
  auth,
  values,
  fieldErrors,
  saveError,
  onToggle,
  onSaveAuth,
  onClearAuth,
  onSyncCanvas,
  onRunReadinessAction,
  onChangeAuthField,
}: {
  entry: ExtensionRegistryEntry
  pendingPluginId: string | null
  pendingAuthPluginId: string | null
  pendingClearAuthPluginId: string | null
  pendingSyncPluginId: string | null
  pendingReadinessPluginId: string | null
  isCanvasSyncing: boolean
  authStatus?: PluginAuthStatus
  auth?: ExtensionAuthManualTokenSchema
  values?: AuthFormValues
  fieldErrors: Record<string, string>
  saveError: string | null | undefined
  onToggle: (pluginId: string, enabled: boolean) => void
  onSaveAuth: () => void
  onClearAuth: () => void
  onSyncCanvas: () => void
  onRunReadinessAction: () => void
  onChangeAuthField: (fieldKey: string, nextValue: string) => void
}) {
  const pluginId = getEntryPluginId(entry)
  const isPending = pendingPluginId === pluginId
  const isInvalid = entry.kind === "invalid"
  const isManualAuth = hasManualTokenAuth(entry)
  const isNoAuth = hasNoAuthExtension(entry)
  const readiness = isNoAuth ? getReadinessPanelModel(entry) : null
  const tools = entry.kind === "available" ? entry.manifest.tools : []

  return (
    <div className="space-y-6" data-testid={`settings-plugin-detail-${pluginId}`}>
      <div className="flex flex-col gap-5 rounded-[2rem] border border-border/70 bg-card/30 p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <PluginMark entry={entry} className="size-14 rounded-[1.35rem]" iconSize={28} />
            <div className="min-w-0 space-y-3">
              <div className="space-y-1">
                <h2 className="text-2xl font-semibold tracking-tight">{getEntryName(entry)}</h2>
                <p className="text-sm text-muted-foreground">{getEntryDescription(entry)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={getStatusBadgeVariant(entry)}>{entry.status}</Badge>
                <MetadataBadge>{isMcpEntry(entry) ? "MCP" : "Plugin"}</MetadataBadge>
                <MetadataBadge>{formatInstallSource(entry)}</MetadataBadge>
                <MetadataBadge>v{getEntryVersion(entry)}</MetadataBadge>
                {entry.kind === "available" && entry.readiness && (
                  <MetadataBadge>{getReadinessLabel(entry.readiness)}</MetadataBadge>
                )}
                {entry.kind === "available" && <MetadataBadge>{entry.manifest.tools.length} tools</MetadataBadge>}
                {isManualAuth && <Badge variant={getAuthStatusVariant(authStatus)}>{getAuthStatusLabel(authStatus)}</Badge>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-4xl border border-border/70 bg-background/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">Enabled</span>
              <Switch
                checked={entry.enabled && entry.kind === "available"}
                disabled={isPending || isInvalid}
                onCheckedChange={(checked) => {
                  onToggle(pluginId, checked)
                }}
                aria-label={`${entry.enabled ? "Disable" : "Enable"} ${getEntryName(entry)}`}
              />
            </div>

            {pluginId === "canvas-mcp" && isManualAuth && (
              <Button
                variant="outline"
                disabled={pendingSyncPluginId === pluginId || isCanvasSyncing}
                onClick={onSyncCanvas}
                data-testid={`settings-plugin-sync-${pluginId}`}
              >
                {pendingSyncPluginId === pluginId || isCanvasSyncing ? "Syncing..." : "Sync Now"}
              </Button>
            )}

            {isManualAuth && authStatus?.status === "configured" && (
              <Button
                variant="outline"
                disabled={pendingClearAuthPluginId === pluginId}
                onClick={onClearAuth}
                data-testid={`settings-plugin-auth-disconnect-${pluginId}`}
              >
                {pendingClearAuthPluginId === pluginId ? "Disconnecting..." : "Disconnect"}
              </Button>
            )}

            {isManualAuth && (
              <Button
                disabled={pendingAuthPluginId === pluginId}
                onClick={onSaveAuth}
                data-testid={`settings-plugin-auth-save-${pluginId}`}
              >
                Save credentials
              </Button>
            )}

            {isNoAuth && readiness?.actionKind && readiness.actionLabel && (
              <Button
                variant={readiness.actionKind === "disable" ? "outline" : "default"}
                disabled={pendingReadinessPluginId === pluginId}
                onClick={onRunReadinessAction}
                data-testid={`settings-plugin-readiness-action-${pluginId}`}
              >
                {readiness.actionLabel}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="space-y-4 rounded-3xl border border-border/70 bg-background/30 p-5">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Overview</p>
              <p className="text-sm text-muted-foreground">Core identity, transport, and discovery metadata.</p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Plugin ID</dt>
                <dd className="text-sm text-foreground">{pluginId}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Install source</dt>
                <dd className="text-sm text-foreground">{formatInstallSource(entry)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Version</dt>
                <dd className="text-sm text-foreground">v{getEntryVersion(entry)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Type</dt>
                <dd className="text-sm text-foreground">{isMcpEntry(entry) ? "MCP" : "Plugin"}</dd>
              </div>
              {entry.kind === "available" && (
                <>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Transport</dt>
                    <dd className="text-sm text-foreground">{entry.manifest.transport.type}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Entry</dt>
                    <dd className="truncate text-sm text-foreground">{entry.manifest.transport.entry}</dd>
                  </div>
                </>
              )}
            </dl>
            {entry.kind === "available" && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{entry.manifest.author}</span>
                <span className="text-border">•</span>
                <a
                  href={entry.manifest.homepage}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-foreground hover:text-primary"
                >
                  <HugeiconsIcon icon={Link01Icon} size={14} strokeWidth={2} />
                  <span>Homepage</span>
                </a>
              </div>
            )}
          </section>

          {isInvalid ? (
            <section
              className="space-y-3 rounded-3xl border border-destructive/30 bg-destructive/5 p-5"
              data-testid={`settings-plugin-error-card-${pluginId}`}
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Manifest error</p>
                <p className="text-sm text-muted-foreground">{entry.lastError}</p>
              </div>
              <p className="text-xs text-muted-foreground">{entry.manifestPath}</p>
            </section>
          ) : isNoAuth && readiness ? (
            <section
              className="space-y-4 rounded-3xl border border-border/70 bg-background/30 p-5"
              data-testid={`settings-plugin-readiness-card-${pluginId}`}
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Readiness</p>
                <p
                  className="text-sm text-muted-foreground"
                  data-testid={`settings-plugin-readiness-body-${pluginId}`}
                >
                  {readiness.body}
                </p>
              </div>
              {entry.lastError && (
                <Alert variant="destructive">
                  <AlertTitle>Runtime detail</AlertTitle>
                  <AlertDescription>{entry.lastError}</AlertDescription>
                </Alert>
              )}

              {readiness.actionKind && readiness.actionLabel && (
                <div className="flex justify-end">
                  <Button
                    variant={readiness.actionKind === "disable" ? "outline" : "default"}
                    disabled={pendingReadinessPluginId === pluginId}
                    onClick={onRunReadinessAction}
                    data-testid={`settings-plugin-readiness-action-${pluginId}`}
                  >
                    {readiness.actionLabel}
                  </Button>
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>

      {isManualAuth && values && auth && (
        <section
          className="space-y-4 rounded-[2rem] border border-border/70 bg-card/30 p-6"
          data-testid={`settings-plugin-auth-card-${pluginId}`}
        >
          <div className="space-y-2">
            <p className="text-base font-medium text-foreground">Credentials</p>
            <p className="text-sm text-muted-foreground">{auth.instructions}</p>
            <p className="text-sm text-muted-foreground">Status: {getAuthStatusLabel(authStatus)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {auth.fields.map((field) => {
              const fieldHasSavedSecret = field.type === "secret" && (authStatus?.hasValue?.[field.key] ?? false)
              const placeholder = fieldHasSavedSecret ? "Saved — leave blank to keep current" : field.placeholder
              return (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`${pluginId}-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`${pluginId}-${field.key}`}
                    type={getInputType(field)}
                    placeholder={placeholder}
                    value={values[field.key] ?? ""}
                    onChange={(event) => {
                      onChangeAuthField(field.key, event.target.value)
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
              )
            })}
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
        </section>
      )}

      {entry.kind === "available" && (
        <section
          className="space-y-4 rounded-[2rem] border border-border/70 bg-card/30 p-6"
          data-testid={`settings-plugin-tools-${pluginId}`}
        >
          <div className="space-y-1">
            <p className="text-base font-medium text-foreground">Exposed tools</p>
            <p className="text-sm text-muted-foreground">Tools this plugin contributes to the runtime.</p>
          </div>

          {tools.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {tools.map((tool: ExtensionToolSummary) => (
                <div
                  key={tool.name}
                  className="rounded-3xl border border-border/70 bg-background/30 p-4"
                  data-testid={`settings-plugin-tool-${pluginId}-${tool.name}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <HugeiconsIcon icon={CodeIcon} size={18} strokeWidth={1.8} />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{tool.name}</p>
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty className="rounded-3xl border border-dashed border-border/70 bg-background/20 p-8">
              <EmptyHeader>
                <EmptyTitle>No tools declared</EmptyTitle>
                <EmptyDescription>This plugin is discovered, but its manifest does not currently expose any tools.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      )}
    </div>
  )
}

export function ConnectionsSection({
  selectedPluginId = null,
  onSelectPlugin,
}: ConnectionsSectionProps = {}) {
  const bootstrap = useRuntimeBootstrap()
  const syncProgress = useRuntimeCanvasSyncProgress()
  const skills = useSkills()
  const [registryEntries, setRegistryEntries] = useState<ExtensionRegistryEntry[]>([])
  const [registryState, setRegistryState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [registryError, setRegistryError] = useState<string | null>(null)
  const [pendingPluginId, setPendingPluginId] = useState<string | null>(null)
  const [pendingAuthPluginId, setPendingAuthPluginId] = useState<string | null>(null)
  const [pendingClearAuthPluginId, setPendingClearAuthPluginId] = useState<string | null>(null)
  const [authStatuses, setAuthStatuses] = useState<AuthStatusMap>({})
  const [authForms, setAuthForms] = useState<Record<string, AuthFormValues>>({})
  const [authErrors, setAuthErrors] = useState<Record<string, string | null>>({})
  const [authFieldErrors, setAuthFieldErrors] = useState<AuthFieldErrorMap>({})
  const [pendingSyncPluginId, setPendingSyncPluginId] = useState<string | null>(null)
  const [pendingReadinessPluginId, setPendingReadinessPluginId] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ManagerTab>("plugins")
  const [searchQuery, setSearchQuery] = useState("")

  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase())
  const isCanvasSyncing = syncProgress?.status === "syncing"

  function upsertRegistryEntry(nextEntry: ExtensionRegistryEntry): void {
    setRegistryEntries((current) => {
      const index = current.findIndex((entry) => getEntryPluginId(entry) === getEntryPluginId(nextEntry))
      if (index === -1) return [...current, nextEntry]
      const updated = [...current]
      updated[index] = nextEntry
      return updated
    })
  }

  function patchReadiness(pluginId: string, readiness: ExtensionRuntimeReadiness, lastError?: string): void {
    setRegistryEntries((current) => current.map((entry) => {
      if (entry.kind !== "available" || entry.manifest.id !== pluginId) {
        return entry
      }

      return {
        ...entry,
        readiness,
        lastError,
      }
    }))
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

  useEffect(() => {
    setAuthForms((current) => {
      let changed = false
      const next = { ...current }
      for (const [pluginId, status] of Object.entries(authStatuses)) {
        const savedValues = status?.values
        if (!savedValues) continue
        const formValues = current[pluginId]
        if (!formValues) continue
        const merged: AuthFormValues = { ...formValues }
        let pluginChanged = false
        for (const [key, value] of Object.entries(savedValues)) {
          if (!merged[key] && value) {
            merged[key] = value
            pluginChanged = true
          }
        }
        if (pluginChanged) {
          next[pluginId] = merged
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [authStatuses])

  async function refreshAuthStatus(pluginId: string): Promise<void> {
    if (!window.electronAPI?.invoke) return
    const nextStatus = await window.electronAPI.invoke(IpcChannel.PLUGIN_GET_AUTH_STATUS, { pluginId })
    if (nextStatus) {
      setAuthStatuses((current) => ({ ...current, [pluginId]: nextStatus }))
    }
  }

  async function refreshPlugin(pluginId: string): Promise<void> {
    if (!window.electronAPI?.invoke) return
    const nextEntry = await window.electronAPI.invoke(IpcChannel.PLUGIN_GET_STATUS, { pluginId })
    if (nextEntry) {
      upsertRegistryEntry(nextEntry)
    }
  }

  async function togglePlugin(pluginId: string, enabled: boolean): Promise<void> {
    if (!window.electronAPI?.invoke) {
      setRegistryError("Desktop bridge unavailable for plugin toggle.")
      return
    }

    setPendingPluginId(pluginId)
    setRegistryError(null)

    try {
      const result = await window.electronAPI.invoke(IpcChannel.PLUGIN_SET_ENABLED, { pluginId, enabled })
      await refreshPlugin(pluginId)
      if (!result.ok) {
        setRegistryError(`Failed to ${enabled ? "enable" : "disable"} ${pluginId}: ${result.reason}`)
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
      setAuthErrors((current) => ({ ...current, [entry.manifest.id]: "Desktop bridge unavailable for plugin credentials." }))
      return
    }

    const pluginId = entry.manifest.id
    const values = authForms[pluginId] ?? buildEmptyAuthValues(entry.manifest.auth)
    const hasSavedValue = authStatuses[pluginId]?.hasValue ?? {}
    const localFieldErrors = validateAuthValues(entry.manifest.auth, values, hasSavedValue)
    setAuthFieldErrors((current) => ({ ...current, [pluginId]: localFieldErrors }))

    if (Object.keys(localFieldErrors).length > 0) {
      setAuthErrors((current) => ({ ...current, [pluginId]: "Credentials are incomplete or invalid." }))
      return
    }

    setPendingAuthPluginId(pluginId)
    setAuthErrors((current) => ({ ...current, [pluginId]: null }))

    try {
      const result = await window.electronAPI.invoke(IpcChannel.PLUGIN_SAVE_AUTH, { pluginId, values })
      if (result.ok) {
        await refreshAuthStatus(pluginId)
        setAuthForms((current) => {
          const formValues = current[pluginId] ?? buildEmptyAuthValues(entry.manifest.auth)
          const next: AuthFormValues = { ...formValues }
          for (const field of entry.manifest.auth.fields) {
            if (field.type === "secret") next[field.key] = ""
          }
          return { ...current, [pluginId]: next }
        })
        setAuthFieldErrors((current) => ({ ...current, [pluginId]: {} }))
        return
      }

      setAuthErrors((current) => ({ ...current, [pluginId]: result.error }))
      setAuthFieldErrors((current) => ({ ...current, [pluginId]: result.fieldErrors ?? {} }))
      await refreshAuthStatus(pluginId)
    } catch (error) {
      setAuthErrors((current) => ({ ...current, [pluginId]: error instanceof Error ? error.message : String(error) }))
    } finally {
      setPendingAuthPluginId((current) => (current === pluginId ? null : current))
    }
  }

  async function clearPluginAuth(pluginId: string): Promise<void> {
    if (!window.electronAPI?.invoke) {
      setAuthErrors((current) => ({ ...current, [pluginId]: "Desktop bridge unavailable." }))
      return
    }

    setPendingClearAuthPluginId(pluginId)
    setAuthErrors((current) => ({ ...current, [pluginId]: null }))

    try {
      await window.electronAPI.invoke(IpcChannel.PLUGIN_CLEAR_AUTH, { pluginId })
      setAuthStatuses((current) => ({ ...current, [pluginId]: { pluginId, status: "not_configured" } }))
      const entry = registryEntries.find((e) => getEntryPluginId(e) === pluginId)
      if (entry && hasManualTokenAuth(entry)) {
        setAuthForms((current) => ({ ...current, [pluginId]: buildEmptyAuthValues(entry.manifest.auth) }))
      }
      setAuthFieldErrors((current) => ({ ...current, [pluginId]: {} }))
    } catch (error) {
      setAuthErrors((current) => ({ ...current, [pluginId]: error instanceof Error ? error.message : String(error) }))
    } finally {
      setPendingClearAuthPluginId((current) => (current === pluginId ? null : current))
    }
  }

  async function syncCanvasPlugin(): Promise<void> {
    const pluginId = "canvas-mcp"

    setPendingSyncPluginId(pluginId)
    setSyncError(null)
    try {
      await getPrimaryWsRpcClient().canvas.sync()
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingSyncPluginId(null)
    }
  }

  async function runReadinessAction(entry: NoAuthExtensionEntry): Promise<void> {
    if (!window.electronAPI?.invoke) {
      setRegistryError("Desktop bridge unavailable for extension readiness actions.")
      return
    }

    const pluginId = entry.manifest.id
    const panel = getReadinessPanelModel(entry)
    if (!panel.actionKind) return

    setPendingReadinessPluginId(pluginId)
    setRegistryError(null)

    try {
      if (panel.actionKind === "enable" || panel.actionKind === "disable") {
        await togglePlugin(pluginId, panel.actionKind === "enable")
        return
      }

      if (panel.actionKind === "grant_access") {
        const result = await window.electronAPI.invoke(IpcChannel.PLUGIN_REVEAL_PERMISSION_SETTINGS, { pluginId })
        if (!result?.ok) {
          setRegistryError(`Unable to open permission settings for ${pluginId}.`)
        }
        return
      }

      const retryClass = panel.actionKind === "retry_bridge"
        ? "retry_bridge_start"
        : "retry_plugin_start"
      const result = await window.electronAPI.invoke(IpcChannel.PLUGIN_RETRY, {
        pluginId,
        retryClass,
      })
      await refreshPlugin(pluginId)
      if (!result.ok) {
        setRegistryError(`Failed to retry ${pluginId}: ${result.reason}`)
      }
    } catch (error) {
      setRegistryError(error instanceof Error ? error.message : String(error))
    } finally {
      setPendingReadinessPluginId((current) => (current === pluginId ? null : current))
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
        if (cancelled) return
        setRegistryEntries(entries)
        ensureAuthForms(entries)
        setRegistryState("ready")

        const manualEntries = entries.filter(hasManualTokenAuth)
        const nextStatuses = await Promise.all(
          manualEntries.map(async (entry: ExtensionRegistryAvailableEntry & {
            manifest: ExtensionRegistryAvailableEntry["manifest"] & { auth: ExtensionAuthManualTokenSchema }
          }) => {
            const status = await window.electronAPI!.invoke(IpcChannel.PLUGIN_GET_AUTH_STATUS, { pluginId: entry.manifest.id })
            return [entry.manifest.id, status] as const
          }),
        )

        if (cancelled) return
        setAuthStatuses((current) => ({
          ...current,
          ...(Object.fromEntries(nextStatuses.filter(([, status]) => Boolean(status))) as AuthStatusMap),
        }))
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setRegistryEntries([])
        setRegistryState("error")
        setRegistryError(error instanceof Error ? error.message : String(error))
      })

    return () => {
      cancelled = true
    }
  }, [bootstrap])

  useEffect(() => {
    if (!bootstrap?.featureFlags.pluginSystem || !window.electronAPI?.on) return
    return window.electronAPI.on(IpcChannel.PLUGIN_LIFECYCLE, (payload) => {
      void refreshPlugin(payload.pluginId).catch((error: unknown) => {
        setRegistryError(error instanceof Error ? error.message : String(error))
      })
    })
  }, [bootstrap])

  useEffect(() => {
    if (!bootstrap?.featureFlags.pluginSystem || !window.electronAPI?.on) return
    return window.electronAPI.on(IpcChannel.PLUGIN_READINESS, (payload) => {
      patchReadiness(payload.pluginId, payload.readiness, payload.lastError)
    })
  }, [bootstrap])

  const pluginEntries = bootstrap?.featureFlags.pluginSystem ? registryEntries : []
  const pluginCount = pluginEntries.length
  const mcpCount = pluginEntries.filter(isMcpEntry).length
  const skillCount = skills.length

  const visiblePluginEntries = useMemo(() => {
    const baseEntries = activeTab === "mcps"
      ? pluginEntries.filter(isMcpEntry)
      : pluginEntries

    if (!deferredSearchQuery) return baseEntries
    return baseEntries.filter((entry) => matchesPluginSearch(entry, deferredSearchQuery))
  }, [activeTab, deferredSearchQuery, pluginEntries])

  const visibleSkills = useMemo(() => {
    if (!deferredSearchQuery) return skills
    return skills.filter((skill) => matchesSkillSearch(skill, deferredSearchQuery))
  }, [deferredSearchQuery, skills])

  const selectedEntry = useMemo(
    () => selectedPluginId
      ? pluginEntries.find((entry) => getEntryPluginId(entry) === selectedPluginId) ?? null
      : null,
    [pluginEntries, selectedPluginId],
  )

  return (
    <div className="space-y-6">
      {selectedEntry ? (
        <PluginDetailView
          entry={selectedEntry}
          pendingPluginId={pendingPluginId}
          pendingAuthPluginId={pendingAuthPluginId}
          pendingClearAuthPluginId={pendingClearAuthPluginId}
          pendingSyncPluginId={pendingSyncPluginId}
          pendingReadinessPluginId={pendingReadinessPluginId}
          isCanvasSyncing={isCanvasSyncing}
          authStatus={hasManualTokenAuth(selectedEntry) ? authStatuses[getEntryPluginId(selectedEntry)] : undefined}
          auth={hasManualTokenAuth(selectedEntry) ? selectedEntry.manifest.auth : undefined}
          values={hasManualTokenAuth(selectedEntry) ? (authForms[getEntryPluginId(selectedEntry)] ?? buildEmptyAuthValues(selectedEntry.manifest.auth)) : undefined}
          fieldErrors={authFieldErrors[getEntryPluginId(selectedEntry)] ?? {}}
          saveError={authErrors[getEntryPluginId(selectedEntry)]}
          onToggle={(pluginId, enabled) => {
            void togglePlugin(pluginId, enabled)
          }}
          onSaveAuth={() => {
            if (hasManualTokenAuth(selectedEntry)) {
              void savePluginAuth(selectedEntry)
            }
          }}
          onClearAuth={() => {
            void clearPluginAuth(getEntryPluginId(selectedEntry))
          }}
          onSyncCanvas={() => {
            void syncCanvasPlugin()
          }}
          onRunReadinessAction={() => {
            if (hasNoAuthExtension(selectedEntry)) {
              void runReadinessAction(selectedEntry)
            }
          }}
          onChangeAuthField={(fieldKey, nextValue) => {
            const pluginId = getEntryPluginId(selectedEntry)
            if (!hasManualTokenAuth(selectedEntry)) return

            setAuthForms((current) => ({
              ...current,
              [pluginId]: {
                ...(current[pluginId] ?? buildEmptyAuthValues(selectedEntry.manifest.auth)),
                [fieldKey]: nextValue,
              },
            }))
            setAuthFieldErrors((current) => ({
              ...current,
              [pluginId]: {
                ...(current[pluginId] ?? {}),
                [fieldKey]: "",
              },
            }))
            setAuthErrors((current) => ({ ...current, [pluginId]: null }))
          }}
        />
      ) : (
        <>
          <div className="flex max-w-md flex-col gap-3">
            <div className="relative w-full">
              <HugeiconsIcon
                icon={SearchIcon}
                strokeWidth={2}
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={activeTab === "skills" ? "Search skills" : "Search plugins"}
                className="rounded-4xl pl-10"
                data-testid="settings-plugin-search"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {([
                { id: "plugins", label: "Plugins", count: pluginCount },
                { id: "mcps", label: "MCPs", count: mcpCount },
                { id: "skills", label: "Skills", count: skillCount },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={`settings-plugin-filter-${tab.id}`}
                  className={`inline-flex items-center gap-2 rounded-4xl px-4 py-2 text-sm transition-colors ${
                    activeTab === tab.id
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={activeTab === tab.id ? "text-background/75" : "text-muted-foreground"}>{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          {syncError && (
            <Alert variant="destructive" data-testid="settings-canvas-sync-error">
              <AlertTitle>Canvas sync failed</AlertTitle>
              <AlertDescription>{syncError}</AlertDescription>
            </Alert>
          )}

          {registryError && (
            <Alert variant="destructive" data-testid="settings-plugin-error">
              <AlertTitle>Plugin registry unavailable</AlertTitle>
              <AlertDescription>{registryError}</AlertDescription>
            </Alert>
          )}

          {!bootstrap?.featureFlags.pluginSystem && activeTab !== "skills" && (
            <Alert data-testid="settings-plugin-disabled">
              <AlertTitle>Plugin system disabled</AlertTitle>
              <AlertDescription>The plugin registry stays dark until the desktop feature flag is enabled.</AlertDescription>
            </Alert>
          )}

          {bootstrap?.featureFlags.pluginSystem && registryState === "loading" && activeTab !== "skills" && (
            <Alert data-testid="settings-plugin-loading">
              <AlertTitle>Loading discovered plugins</AlertTitle>
              <AlertDescription>Reading bundled and user manifests from the desktop runtime.</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4" data-testid="settings-plugin-registry">
            {activeTab === "skills" ? (
              visibleSkills.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex h-full flex-col gap-4 rounded-3xl border border-border/70 bg-card/30 p-4"
                      data-testid={`settings-skill-row-${skill.id}`}
                    >
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <HugeiconsIcon icon={BrainIcon} size={22} strokeWidth={1.8} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{skill.name}</p>
                          <MetadataBadge>Skill</MetadataBadge>
                        </div>
                        <p className="text-sm text-muted-foreground">{skill.description}</p>
                      </div>
                      <p className="mt-auto text-xs text-muted-foreground">{skill.id}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty className="rounded-3xl border border-dashed border-border/70 bg-card/20">
                  <EmptyHeader>
                    <EmptyTitle>No skills match this search</EmptyTitle>
                    <EmptyDescription>Try a different name or clear the search field.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )
            ) : visiblePluginEntries.length > 0 ? (
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
                {visiblePluginEntries.map((entry: ExtensionRegistryEntry) => (
                  <PluginCard
                    key={`${entry.installSource}:${getEntryPluginId(entry)}`}
                    entry={entry}
                    pendingPluginId={pendingPluginId}
                    authStatus={hasManualTokenAuth(entry) ? authStatuses[getEntryPluginId(entry)] : undefined}
                    onSelect={(pluginId) => {
                      onSelectPlugin?.(pluginId)
                    }}
                    onToggle={(pluginId, enabled) => {
                      void togglePlugin(pluginId, enabled)
                    }}
                  />
                ))}
              </div>
            ) : (
              <Empty className="rounded-3xl border border-dashed border-border/70 bg-card/20">
                <EmptyHeader>
                  <EmptyTitle>{deferredSearchQuery ? "No matches found" : activeTab === "mcps" ? "No MCPs discovered" : "No plugins discovered"}</EmptyTitle>
                  <EmptyDescription>
                    {deferredSearchQuery
                      ? "Try a different search term or switch filters."
                      : activeTab === "mcps"
                        ? "Bundled and user MCP plugins will appear here when the desktop runtime finds them."
                        : "Bundled and user plugins will appear here when the desktop runtime finds them."}
                  </EmptyDescription>
                </EmptyHeader>
                {deferredSearchQuery && (
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={SearchIcon} size={20} strokeWidth={1.8} />
                  </EmptyMedia>
                )}
              </Empty>
            )}
          </div>
        </>
      )}
    </div>
  )
}
