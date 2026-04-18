import { completePhonePairing } from "./pwa.js"

function getSessionUrl(): string | null {
  const url = new URL(window.location.href)
  const pathMatch = url.pathname.match(/\/pair\/([^/]+)$/)
  if (pathMatch) {
    return `${url.origin}/api/pairing-sessions/${pathMatch[1]}`
  }

  const sessionId = url.searchParams.get("session")
  return sessionId ? `${url.origin}/api/pairing-sessions/${sessionId}` : null
}

async function subscribe(vapidPublicKey: string) {
  const registration = await navigator.serviceWorker.register("/sw.js")
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.from(atob(vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0)),
  })

  const json = subscription.toJSON() as {
    endpoint: string
    expirationTime: number | null
    keys: { p256dh: string; auth: string }
  }

  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: json.keys,
  }
}

async function render(): Promise<void> {
  const root = document.getElementById("app")
  if (!root) {
    return
  }

  const sessionUrl = getSessionUrl()
  if (!sessionUrl) {
    root.innerHTML = "<p>Missing pairing session.</p>"
    return
  }

  root.innerHTML = `
    <section style="font-family: sans-serif; max-width: 32rem; margin: 0 auto; padding: 2rem;">
      <h1>Link Your Phone</h1>
      <p>Install this app on your Home Screen on iPhone before enabling notifications.</p>
      <button id="pair-button" type="button">Enable Notifications</button>
      <p id="status" style="margin-top: 1rem;"></p>
    </section>
  `

  const status = document.getElementById("status")
  const button = document.getElementById("pair-button")

  button?.addEventListener("click", () => {
    void completePhonePairing({
      sessionUrl,
      userAgent: navigator.userAgent,
      isStandalone: window.matchMedia("(display-mode: standalone)").matches,
      fetchImpl: fetch,
      requestPermission: () => Notification.requestPermission(),
      subscribe,
    }).then((result) => {
      if (status) {
        status.textContent = result.status === "paired"
          ? "Phone paired. You can return to Student Claw on desktop."
          : result.status === "install_required"
            ? "Add this app to your Home Screen first on iPhone."
            : "Notification permission was denied."
      }
    })
  })
}

void render()
