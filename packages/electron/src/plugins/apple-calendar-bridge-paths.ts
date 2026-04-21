import path from "node:path"

export const APPLE_CALENDAR_PLUGIN_ID = "apple-calendar-mcp"
export const APPLE_BRIDGE_BINARY_NAME = "CalendarAPIBridge"

export function resolvePackagedAppleCalendarBridgeDir(resourcesRoot: string): string {
  return path.join(resourcesRoot, "extensions", APPLE_CALENDAR_PLUGIN_ID, "bridge")
}

export function resolvePackagedAppleCalendarBridgePaths(resourcesRoot: string) {
  const bridgeDir = resolvePackagedAppleCalendarBridgeDir(resourcesRoot)
  return {
    bridgeDir,
    executablePath: path.join(bridgeDir, APPLE_BRIDGE_BINARY_NAME),
    versionPath: path.join(bridgeDir, "version.json"),
  }
}

export function resolvePackagedAppleCalendarBridgePathsFromApp(appPath: string) {
  return resolvePackagedAppleCalendarBridgePaths(path.join(appPath, "Contents", "Resources"))
}
