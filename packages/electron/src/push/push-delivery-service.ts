import { Notification } from "electron"

export type PushDeliveryPayload = {
  readonly title: string
  readonly body: string
  readonly deepLink?: string
  readonly tag?: string
}

export type PushDeliveryResult = {
  readonly ok: boolean
}

type NotificationFactory = (options: { title: string; body: string }) => {
  show: () => void
}

export class PushDeliveryService {
  constructor(
    private readonly notificationFactory: NotificationFactory = (options) =>
      new Notification(options),
    private readonly isSupported: () => boolean = () => Notification.isSupported(),
  ) {}

  async send(payload: PushDeliveryPayload): Promise<PushDeliveryResult> {
    if (!this.isSupported()) {
      return { ok: false }
    }

    try {
      this.notificationFactory({ title: payload.title, body: payload.body }).show()
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }
}
