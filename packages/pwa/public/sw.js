self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Student Claw", {
      body: payload.body ?? "",
      data: payload.deepLink ?? "/",
      tag: payload.tag ?? "student-claw-push",
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.openWindow(event.notification.data ?? "/"),
  )
})
