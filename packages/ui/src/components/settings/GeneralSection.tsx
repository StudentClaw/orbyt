import { useEffect, useState } from "react"
import { IpcChannel, type DesktopUpdateMode, type DesktopUpdateState } from "@orbyt/contracts"
import { useTheme, type Theme } from "@/hooks/useTheme"
import { useRuntimeBootstrap, useRuntimeServerConfig } from "@/hooks/useAppRuntime"
import { waitForPrimaryWsRpcClient } from "@/rpc/appRuntime"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  const [memoryGraphPath, setMemoryGraphPath] = useState("")
  const [draftPath, setDraftPath] = useState("")
  const [pathMode, setPathMode] = useState<"default" | "custom">("default")
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading")
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [pickerState, setPickerState] = useState<"idle" | "opening">("idle")
  const [codexLogoutState, setCodexLogoutState] = useState<"idle" | "pending" | "done" | "error">("idle")
  const [codexConnectState, setCodexConnectState] = useState<"idle" | "connecting" | "connected" | "error">("idle")
  const [updateState, setUpdateState] = useState<DesktopUpdateState | null>(null)
  const [updateActionState, setUpdateActionState] = useState<"idle" | "pending" | "error">("idle")

  useEffect(() => {
    let cancelled = false

    void waitForPrimaryWsRpcClient()
      .then(async (client) => {
        const aiAuthPromise = typeof client.onboarding.getAiAuth === "function"
          ? client.onboarding.getAiAuth().catch(() => null)
          : Promise.resolve(null)
        const [preferences, aiAuth] = await Promise.all([
          client.onboarding.getPreferences(),
          aiAuthPromise,
        ])
        return { preferences, aiAuth }
      })
      .then(({ preferences, aiAuth }) => {
        if (cancelled) return
        setMemoryGraphPath(preferences.memoryGraphPath)
        setDraftPath(preferences.memoryGraphPath)
        setPathMode(preferences.memoryGraphPathMode)
        setLoadState("ready")
        const codexConnected = aiAuth?.status === "connected" && aiAuth.provider === "codex"
        if (!codexConnected) {
          setCodexLogoutState("done")
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState("error")
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!window.electronAPI?.invoke) {
      return () => {}
    }

    void window.electronAPI.invoke(IpcChannel.APP_UPDATE_GET_STATE)
      .then((state) => {
        if (!cancelled) {
          setUpdateState(state)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUpdateActionState("error")
        }
      })

    const unsubscribe = window.electronAPI.on?.(IpcChannel.APP_UPDATE_STATE, (state) => {
      setUpdateState(state)
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const hasDraftChanges = draftPath.trim() !== memoryGraphPath

  async function saveMemoryGraphPath(nextPath: string | null) {
    setSaveState("saving")
    try {
      const client = await waitForPrimaryWsRpcClient()
      const preferences = await client.onboarding.setPreferences({ memoryGraphPath: nextPath })
      setMemoryGraphPath(preferences.memoryGraphPath)
      setDraftPath(preferences.memoryGraphPath)
      setPathMode(preferences.memoryGraphPathMode)
      setLoadState("ready")
      setSaveState("saved")
    } catch {
      setSaveState("error")
    }
  }

  async function disconnectCodex() {
    if (!window.electronAPI?.invoke) {
      setCodexLogoutState("error")
      return
    }
    setCodexLogoutState("pending")
    try {
      const result = await window.electronAPI.invoke(IpcChannel.CODEX_AUTH_LOGOUT)
      if (!result?.ok) {
        setCodexLogoutState("error")
        return
      }
      // Kill the running codex process and mark auth_required — do NOT reinitialize,
      // since re-init can succeed via macOS Keychain even with auth.json deleted.
      try {
        const client = await waitForPrimaryWsRpcClient()
        await Promise.allSettled([
          client.onboarding.setAiAuth({ status: "skipped", provider: null }),
          client.provider.disconnectProvider(),
        ])
      } catch {
        // Logout itself succeeded; runtime state will reflect auth_required.
      }
      setCodexLogoutState("done")
    } catch {
      setCodexLogoutState("error")
    }
  }

  async function connectCodex() {
    if (!window.electronAPI?.codexAuthStart) {
      setCodexConnectState("error")
      return
    }
    setCodexConnectState("connecting")
    try {
      const result = await window.electronAPI.codexAuthStart()
      if (result?.status !== "connected") {
        setCodexConnectState("error")
        return
      }
      try {
        const client = await waitForPrimaryWsRpcClient()
        await Promise.allSettled([
          client.onboarding.setAiAuth({ status: "connected", provider: "codex" }),
          client.provider.retryInitialize(),
        ])
      } catch {
        // Auth succeeded; runtime state will catch up.
      }
      setCodexConnectState("connected")
      setCodexLogoutState("idle")
    } catch {
      setCodexConnectState("error")
    }
  }

  async function setDesktopUpdateMode(mode: DesktopUpdateMode) {
    if (!window.electronAPI?.invoke) {
      setUpdateActionState("error")
      return
    }

    setUpdateActionState("pending")
    try {
      const result = await window.electronAPI.invoke(IpcChannel.APP_UPDATE_SET_MODE, { mode })
      setUpdateState(result.state)
      setUpdateActionState("idle")
    } catch {
      setUpdateActionState("error")
    }
  }

  async function checkForDesktopUpdate() {
    if (!window.electronAPI?.invoke) {
      setUpdateActionState("error")
      return
    }

    setUpdateActionState("pending")
    try {
      const result = await window.electronAPI.invoke(IpcChannel.APP_UPDATE_CHECK)
      setUpdateState(result.state)
      setUpdateActionState("idle")
    } catch {
      setUpdateActionState("error")
    }
  }

  async function downloadDesktopUpdate() {
    if (!window.electronAPI?.invoke) {
      setUpdateActionState("error")
      return
    }

    setUpdateActionState("pending")
    try {
      const result = await window.electronAPI.invoke(IpcChannel.APP_UPDATE_DOWNLOAD)
      setUpdateState(result.state)
      setUpdateActionState("idle")
    } catch {
      setUpdateActionState("error")
    }
  }

  async function installDesktopUpdate() {
    if (!window.electronAPI?.invoke) {
      setUpdateActionState("error")
      return
    }

    setUpdateActionState("pending")
    try {
      const result = await window.electronAPI.invoke(IpcChannel.APP_UPDATE_INSTALL)
      setUpdateState(result.state)
      setUpdateActionState("idle")
    } catch {
      setUpdateActionState("error")
    }
  }

  async function browseForMemoryGraphPath() {
    if (!window.electronAPI?.invoke) {
      setSaveState("error")
      return
    }

    setPickerState("opening")
    try {
      const selected = await window.electronAPI.invoke(IpcChannel.FILE_OPEN_DIALOG, {
        directory: true,
      })

      if (typeof selected === "string" && selected.length > 0) {
        setDraftPath(selected)
        setSaveState("idle")
      }
    } catch {
      setSaveState("error")
    } finally {
      setPickerState("idle")
    }
  }

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

      <Card data-testid="settings-desktop-updates-card">
        <CardHeader>
          <CardTitle>Updates</CardTitle>
          <CardDescription>
            {updateState
              ? `Orbyt ${updateState.currentVersion}`
              : "Loading desktop update status"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Update install mode">
            <Button
              type="button"
              variant={updateState?.mode === "automatic" ? "default" : "outline"}
              onClick={() => void setDesktopUpdateMode("automatic")}
              disabled={!updateState || updateActionState === "pending"}
              data-testid="settings-updates-mode-automatic"
            >
              Automatic
            </Button>
            <Button
              type="button"
              variant={updateState?.mode === "prompt" ? "default" : "outline"}
              onClick={() => void setDesktopUpdateMode("prompt")}
              disabled={!updateState || updateActionState === "pending"}
              data-testid="settings-updates-mode-prompt"
            >
              Prompt
            </Button>
          </div>

          <p className="text-sm text-muted-foreground" data-testid="settings-updates-status">
            {updateState
              ? updateState.message
                ?? (updateState.enabled ? "Orbyt will check for stable updates in the background." : "Desktop updates are disabled.")
              : "Waiting for desktop bridge."}
          </p>

          {updateState?.status === "downloading" && typeof updateState.downloadPercent === "number" && (
            <p className="text-sm text-muted-foreground" data-testid="settings-updates-progress">
              Downloading {Math.round(updateState.downloadPercent)}%
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void checkForDesktopUpdate()}
              disabled={!updateState?.enabled || updateActionState === "pending" || updateState.status === "checking" || updateState.status === "downloading"}
              data-testid="settings-updates-check"
            >
              {updateState?.status === "checking" ? "Checking..." : "Check for Updates"}
            </Button>
            {updateState?.status === "available" && updateState.mode === "prompt" && (
              <Button
                type="button"
                onClick={() => void downloadDesktopUpdate()}
                disabled={updateActionState === "pending"}
                data-testid="settings-updates-download"
              >
                Download Update
              </Button>
            )}
            {updateState?.status === "downloaded" && updateState.mode === "prompt" && (
              <Button
                type="button"
                onClick={() => void installDesktopUpdate()}
                disabled={updateActionState === "pending"}
                data-testid="settings-updates-install"
              >
                Restart and Install
              </Button>
            )}
          </div>

          {updateActionState === "error" && (
            <p className="text-sm text-destructive" data-testid="settings-updates-error">
              Desktop update controls are unavailable.
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="settings-memory-graph-card">
        <CardHeader>
          <CardTitle>Memory Graph</CardTitle>
          <CardDescription>
            Choose where Orbyt writes it's knowledge of you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="memory-graph-path">Graph folder</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="memory-graph-path"
                value={draftPath}
                readOnly
                disabled={loadState === "loading" || saveState === "saving"}
                placeholder="Loading memory graph path"
                data-testid="settings-memory-graph-path"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void browseForMemoryGraphPath()}
                disabled={loadState !== "ready" || saveState === "saving" || pickerState === "opening"}
                data-testid="settings-memory-graph-browse"
              >
                {pickerState === "opening" ? "Opening..." : "Browse..."}
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground" data-testid="settings-memory-graph-mode">
            {loadState === "loading"
              ? "Loading your current graph location."
              : loadState === "error"
                ? "Could not load the current graph location."
                : pathMode === "default"
                  ? "Using the default Documents location."
                  : "Using a custom graph location."}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void saveMemoryGraphPath(draftPath)}
              disabled={loadState !== "ready" || saveState === "saving" || draftPath.trim().length === 0 || !hasDraftChanges}
              data-testid="settings-memory-graph-save"
            >
              {saveState === "saving" ? "Saving..." : "Save Location"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void saveMemoryGraphPath(null)}
              disabled={loadState !== "ready" || saveState === "saving" || pathMode === "default"}
              data-testid="settings-memory-graph-reset"
            >
              Use Default
            </Button>
          </div>

          {saveState === "saved" && (
            <p className="text-sm text-muted-foreground" data-testid="settings-memory-graph-status">
              Memory graph location updated.
            </p>
          )}
          {saveState === "error" && (
            <p className="text-sm text-destructive" data-testid="settings-memory-graph-status">
              Could not save the memory graph location.
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="settings-codex-auth-card">
        <CardHeader>
          <CardTitle>Codex (OpenAI)</CardTitle>
          <CardDescription>
            Connect or disconnect your OpenAI Codex account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {codexLogoutState === "done" ? (
              <Button
                type="button"
                onClick={() => void connectCodex()}
                disabled={codexConnectState === "connecting"}
                data-testid="settings-codex-connect"
              >
                {codexConnectState === "connecting" ? "Connecting..." : "Connect Codex"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => void disconnectCodex()}
                disabled={codexLogoutState === "pending"}
                data-testid="settings-codex-disconnect"
              >
                {codexLogoutState === "pending" ? "Disconnecting..." : "Disconnect Codex"}
              </Button>
            )}
          </div>
          {codexLogoutState === "done" && codexConnectState === "idle" && (
            <p className="text-sm text-muted-foreground" data-testid="settings-codex-status">
              Disconnected. Connect a new account above.
            </p>
          )}
          {codexConnectState === "connected" && (
            <p className="text-sm text-muted-foreground" data-testid="settings-codex-status">
              Connected successfully.
            </p>
          )}
          {codexConnectState === "error" && (
            <p className="text-sm text-destructive" data-testid="settings-codex-status">
              Sign-in did not complete. Try again.
            </p>
          )}
          {codexLogoutState === "error" && (
            <p className="text-sm text-destructive" data-testid="settings-codex-disconnect-status">
              Failed to disconnect. Desktop bridge may be unavailable.
            </p>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
