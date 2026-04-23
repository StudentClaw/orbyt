import webPush from "web-push"
import type { WebPushSubscriptionRecord } from "@orbyt/contracts"
import type { PushStore } from "./push-store.js"

type WebPushLike = {
  readonly setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void
  readonly sendNotification: (
    subscription: WebPushSubscriptionRecord,
    payload: string,
  ) => Promise<unknown>
}

export type PushDeliveryPayload = {
  readonly title: string
  readonly body: string
  readonly deepLink?: string
  readonly tag?: string
}

export type PushDeliveryResult = {
  readonly ok: boolean
  readonly unlinkedDevice: boolean
}

export class PushDeliveryService {
  constructor(
    private readonly store: PushStore,
    private readonly webPushClient: WebPushLike = webPush,
  ) {}

  async send(payload: PushDeliveryPayload): Promise<PushDeliveryResult> {
    const subscription = this.store.getLinkedSubscription()
    if (!subscription) {
      return { ok: false, unlinkedDevice: false }
    }

    const vapidKeys = this.store.getVapidKeys()
    this.webPushClient.setVapidDetails(
      "mailto:support@orbyt.local",
      vapidKeys.publicKey,
      vapidKeys.privateKey,
    )

    try {
      await this.webPushClient.sendNotification(subscription, JSON.stringify(payload))
      return { ok: true, unlinkedDevice: false }
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : null

      if (statusCode === 404 || statusCode === 410) {
        this.store.unlinkDevice()
        return { ok: false, unlinkedDevice: true }
      }

      return { ok: false, unlinkedDevice: false }
    }
  }

  async sendTestPush(): Promise<{ ok: boolean }> {
    const result = await this.send({
      title: "Phone notifications linked",
      body: "Orbyt can now send push notifications to this phone.",
      tag: "orbyt-test",
    })

    return { ok: result.ok }
  }
}
