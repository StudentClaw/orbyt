import type { PushPairingCompletion, WebPushSubscriptionRecord } from "@orbyt/contracts"

export function detectPhonePlatform(userAgent: string): "ios" | "android" | "unknown" {
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return "ios"
  }

  if (/android/i.test(userAgent)) {
    return "android"
  }

  return "unknown"
}

export function requiresStandaloneInstall(userAgent: string, isStandalone: boolean): boolean {
  return detectPhonePlatform(userAgent) === "ios" && !isStandalone
}

export async function completePhonePairing(options: {
  readonly sessionUrl: string
  readonly userAgent: string
  readonly isStandalone: boolean
  readonly fetchImpl: typeof fetch
  readonly requestPermission: () => Promise<NotificationPermission>
  readonly subscribe: (vapidPublicKey: string) => Promise<WebPushSubscriptionRecord>
}): Promise<{ status: "install_required" | "permission_denied" | "paired" }> {
  if (requiresStandaloneInstall(options.userAgent, options.isStandalone)) {
    return { status: "install_required" }
  }

  const sessionResponse = await options.fetchImpl(options.sessionUrl)
  const session = await sessionResponse.json() as { vapidPublicKey: string }
  const permission = await options.requestPermission()

  if (permission !== "granted") {
    return { status: "permission_denied" }
  }

  const completion: PushPairingCompletion = {
    platform: detectPhonePlatform(options.userAgent),
    subscription: await options.subscribe(session.vapidPublicKey),
  }

  await options.fetchImpl(`${options.sessionUrl}/complete`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(completion),
  })

  return { status: "paired" }
}
