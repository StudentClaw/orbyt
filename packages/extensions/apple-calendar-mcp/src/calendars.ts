type CalendarRecord = Record<string, unknown>

type CalendarEventUpdate = {
  title?: string
  startDate?: string
  endDate?: string
  location?: string
  notes?: string
}

function formatDate(date: Date | string | null): string | null {
  if (!date) return null

  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const dateStr = date.trim()
  if (dateStr.length === 0) return null

  let parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime()) && dateStr.includes("/")) {
    parsed = new Date(dateStr.replace(/\//g, "-"))
  }
  if (Number.isNaN(parsed.getTime()) && dateStr.includes(" ")) {
    parsed = new Date(dateStr.replace(" ", "T"))
  }

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function getBridgeBaseUrl(): string {
  const configuredUrl = process.env.MAC_API_BRIDGE_URL?.trim()
  if (configuredUrl) return configuredUrl

  const configuredPort = process.env.MAC_API_BRIDGE_PORT?.trim()
  if (configuredPort) return `http://127.0.0.1:${configuredPort}`

  return "http://127.0.0.1:8080"
}

function buildHeaders(): HeadersInit {
  const token = process.env.MAC_API_BRIDGE_TOKEN?.trim()
  return token
    ? {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
    : {
        "Content-Type": "application/json",
      }
}

async function requestBridge<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getBridgeBaseUrl()
  const response = await fetch(new URL(path, baseUrl), {
    ...init,
    headers: {
      ...buildHeaders(),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(`Bridge request failed: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export async function getCalendars(): Promise<CalendarRecord[]> {
  return requestBridge<CalendarRecord[]>("/calendars")
}

export async function getCalendarEvents(calendarId: string): Promise<CalendarRecord[]> {
  return requestBridge<CalendarRecord[]>(`/calendars/${encodeURIComponent(calendarId)}/events`)
}

export async function createCalendar(title: string, color?: string): Promise<CalendarRecord> {
  return requestBridge<CalendarRecord>("/calendars", {
    method: "POST",
    body: JSON.stringify({ title, color }),
  })
}

export async function createCalendarEvent(
  calendarId: string,
  title: string,
  startDate: string,
  endDate: string,
  location?: string,
  notes?: string,
): Promise<CalendarRecord> {
  const formattedStartDate = formatDate(startDate)
  const formattedEndDate = formatDate(endDate)

  if (!formattedStartDate || !formattedEndDate) {
    throw new Error("Invalid date format provided.")
  }

  return requestBridge<CalendarRecord>(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: JSON.stringify({
      title,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      location,
      notes,
    }),
  })
}

export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  updates: CalendarEventUpdate,
): Promise<CalendarRecord> {
  const nextUpdates: CalendarEventUpdate = { ...updates }

  if (typeof nextUpdates.startDate === "string") {
    const formatted = formatDate(nextUpdates.startDate)
    if (!formatted) throw new Error("Invalid start date format provided.")
    nextUpdates.startDate = formatted
  }

  if (typeof nextUpdates.endDate === "string") {
    const formatted = formatDate(nextUpdates.endDate)
    if (!formatted) throw new Error("Invalid end date format provided.")
    nextUpdates.endDate = formatted
  }

  return requestBridge<CalendarRecord>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PUT",
      body: JSON.stringify(nextUpdates),
    },
  )
}

export async function deleteCalendarEvent(calendarId: string, eventId: string): Promise<boolean> {
  await requestBridge<Record<string, unknown>>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  )
  return true
}

export async function deleteCalendar(calendarId: string): Promise<boolean> {
  await requestBridge<Record<string, unknown>>(`/calendars/${encodeURIComponent(calendarId)}`, {
    method: "DELETE",
  })
  return true
}
