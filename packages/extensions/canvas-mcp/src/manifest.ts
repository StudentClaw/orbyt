import { z } from "zod/v4"

export const CanvasManifestSchema = z.object({
  id: z.literal("canvas-mcp"),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  entry: z.string().min(1),
  permissions: z.array(z.enum(["assignments", "grades", "announcements", "modules", "pages"])).min(1),
  authType: z.literal("manual_token"),
  authInstructions: z.string().min(1),
  requiredCredentials: z.tuple([z.literal("CANVAS_TOKEN"), z.literal("CANVAS_BASE_URL")]),
  author: z.string().min(1),
  homepage: z.string().url(),
})

export type CanvasManifest = z.infer<typeof CanvasManifestSchema>

export const canvasManifest: CanvasManifest = {
  id: "canvas-mcp",
  name: "Canvas Assistant",
  description: "Connects to Canvas coursework, grades, announcements, modules, and pages",
  version: "0.1.0",
  entry: "dist/index.js",
  permissions: ["assignments", "grades", "announcements", "modules", "pages"],
  authType: "manual_token",
  authInstructions:
    "Generate a Canvas access token in Canvas under Settings > Approved Integrations > New Access Token.",
  requiredCredentials: ["CANVAS_TOKEN", "CANVAS_BASE_URL"],
  author: "student-claw",
  homepage: "https://github.com/StudentClaw/student-claw",
}
