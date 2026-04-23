import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { parseExtensionManifestSync } from "@orbyt/contracts"
import { z } from "zod"
import * as bridgeCalendars from "./calendars.js"

const appleCalendarToolInventory = [
  {
    name: "getCalendars",
    description: "List all available Apple calendars.",
  },
  {
    name: "getCalendarEvents",
    description: "Get events from a specific Apple calendar.",
  },
  {
    name: "createCalendar",
    description: "Create a new Apple calendar.",
  },
  {
    name: "createCalendarEvent",
    description: "Create a new event in an Apple calendar.",
  },
  {
    name: "updateCalendarEvent",
    description: "Update an existing event in an Apple calendar.",
  },
  {
    name: "deleteCalendarEvent",
    description: "Delete an event from an Apple calendar.",
  },
  {
    name: "deleteCalendar",
    description: "Delete an Apple calendar.",
  },
] as const

export const appleCalendarManifest = parseExtensionManifestSync({
  id: "apple-calendar-mcp",
  name: "Apple Calendar",
  description: "Bundled Apple Calendar tools for reading and editing local macOS calendars.",
  version: "1.0.0",
  transport: {
    type: "local_stdio",
    entry: "dist/index.js",
  },
  permissions: [
    "local_os.calendar.read",
    "local_os.calendar.write",
  ],
  auth: {
    type: "none",
  },
  tools: [...appleCalendarToolInventory],
  author: "orbyt",
  homepage: "https://github.com/Orbyt/orbyt",
})

const appleCalendarInstructions = [
  "Use the Apple Calendar tools to inspect or modify the local macOS Calendar database.",
  "These tools preserve the upstream camelCase tool names for compatibility with the vendored source.",
  "Bridge lifecycle, readiness, and OS permission handling are managed by Orbyt outside this MCP process.",
].join(" ")

type AppleCalendarBridgeClient = typeof bridgeCalendars

type AppleCalendarServerOptions = {
  calendars?: AppleCalendarBridgeClient
}

function successText(payload: Record<string, unknown>) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload),
      },
    ],
    isError: false,
  }
}

function errorText(message: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message }),
      },
    ],
    isError: true,
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function createAppleCalendarMcpServer(options: AppleCalendarServerOptions = {}): McpServer {
  const calendars = options.calendars ?? bridgeCalendars
  const server = new McpServer(
    {
      name: appleCalendarManifest.id,
      version: appleCalendarManifest.version,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: appleCalendarInstructions,
    },
  )

  server.registerTool(
    "getCalendars",
    {
      title: "Get calendars",
      description: "List all available Apple calendars.",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async () => {
      try {
        return successText({ calendars: await calendars.getCalendars() })
      } catch (error) {
        return errorText(toErrorMessage(error, "Failed to get calendars."))
      }
    },
  )

  server.registerTool(
    "getCalendarEvents",
    {
      title: "Get calendar events",
      description: "Get events from a specific Apple calendar.",
      inputSchema: {
        calendarId: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
      },
    },
    async ({ calendarId }) => {
      try {
        return successText({ events: await calendars.getCalendarEvents(calendarId) })
      } catch (error) {
        return errorText(toErrorMessage(error, `Failed to get events from calendar ${calendarId}.`))
      }
    },
  )

  server.registerTool(
    "createCalendar",
    {
      title: "Create calendar",
      description: "Create a new Apple calendar.",
      inputSchema: {
        title: z.string(),
        color: z.string().optional(),
      },
    },
    async ({ title, color }) => {
      try {
        return successText({
          success: true,
          calendar: await calendars.createCalendar(title, color),
        })
      } catch (error) {
        return errorText(toErrorMessage(error, `Failed to create calendar ${title}.`))
      }
    },
  )

  server.registerTool(
    "createCalendarEvent",
    {
      title: "Create calendar event",
      description: "Create a new event in an Apple calendar.",
      inputSchema: {
        calendarId: z.string(),
        title: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        location: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    async ({ calendarId, title, startDate, endDate, location, notes }) => {
      try {
        return successText({
          success: true,
          event: await calendars.createCalendarEvent(calendarId, title, startDate, endDate, location, notes),
        })
      } catch (error) {
        return errorText(toErrorMessage(error, `Failed to create event ${title}.`))
      }
    },
  )

  server.registerTool(
    "updateCalendarEvent",
    {
      title: "Update calendar event",
      description: "Update an existing event in an Apple calendar.",
      inputSchema: {
        calendarId: z.string(),
        eventId: z.string(),
        title: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        location: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    async ({ calendarId, eventId, title, startDate, endDate, location, notes }) => {
      try {
        return successText({
          success: true,
          event: await calendars.updateCalendarEvent(calendarId, eventId, {
            title,
            startDate,
            endDate,
            location,
            notes,
          }),
        })
      } catch (error) {
        return errorText(toErrorMessage(error, `Failed to update event ${eventId}.`))
      }
    },
  )

  server.registerTool(
    "deleteCalendarEvent",
    {
      title: "Delete calendar event",
      description: "Delete an event from an Apple calendar.",
      inputSchema: {
        calendarId: z.string(),
        eventId: z.string(),
      },
    },
    async ({ calendarId, eventId }) => {
      try {
        return successText({
          success: await calendars.deleteCalendarEvent(calendarId, eventId),
        })
      } catch (error) {
        return errorText(toErrorMessage(error, `Failed to delete event ${eventId}.`))
      }
    },
  )

  server.registerTool(
    "deleteCalendar",
    {
      title: "Delete calendar",
      description: "Delete an Apple calendar.",
      inputSchema: {
        calendarId: z.string(),
      },
    },
    async ({ calendarId }) => {
      try {
        return successText({
          success: await calendars.deleteCalendar(calendarId),
        })
      } catch (error) {
        return errorText(toErrorMessage(error, `Failed to delete calendar ${calendarId}.`))
      }
    },
  )

  return server
}

export async function runAppleCalendarMcpServer(): Promise<void> {
  const server = createAppleCalendarMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
