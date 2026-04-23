import { getPrimaryWsRpcClient } from "@/rpc/appRuntime"
import {
  completeOnboarding,
  persistOnboardingState,
  setAiAuthStatus,
} from "@/rpc/onboardingState"

const DESKTOP_BRIDGE_UNAVAILABLE_MESSAGE =
  "Desktop bridge unavailable. Please make sure you're running Orbyt as a desktop app."

export type CodexConnectResult =
  | { readonly status: "connected" }
  | { readonly status: "failed"; readonly error: string }

export async function connectCodexAccount(): Promise<CodexConnectResult> {
  if (!window.electronAPI?.codexAuthStart) {
    return {
      status: "failed",
      error: DESKTOP_BRIDGE_UNAVAILABLE_MESSAGE,
    }
  }

  const result = await window.electronAPI.codexAuthStart()
  if (result.status !== "connected") {
    return {
      status: "failed",
      error: result.error ?? "Connection failed. Please try again.",
    }
  }

  setAiAuthStatus("connected")
  completeOnboarding()
  persistOnboardingState()

  try {
    const client = getPrimaryWsRpcClient()
    await Promise.allSettled([
      client.onboarding.setAiAuth({ status: "connected", provider: "codex" }),
      client.provider.retryInitialize(),
    ])
  } catch {
    // The login itself succeeded; runtime re-initialization can catch up after reconnect.
  }

  return { status: "connected" }
}
