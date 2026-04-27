// Root electron-builder configuration.
//
// The production macOS build runs through `bun run dist:electron:mac`, which
// stages the app into a temporary directory and generates an inline config via
// `createMacPackagingConfig` in scripts/build-macos-desktop-artifact.ts. That
// staged config is the source of truth for the shipping `.dmg`.
//
// This file mirrors those settings and is what `electron-builder` would read
// if you invoked it directly against the repo root (without the staging flow).
// Keep the values in sync with `createMacPackagingConfig`.
//
// Signing: when CSC_LINK/CSC_KEY_PASSWORD/APPLE_API_KEY/APPLE_API_KEY_ID/
// APPLE_API_ISSUER are present, electron-builder will sign and notarize.
// Without those env vars the build is unsigned (macOS will warn on first open).

import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import("electron-builder").Configuration} */
export default {
  appId: "com.orbyt.app",
  productName: "Orbyt",
  artifactName: "Orbyt-${version}-${arch}.${ext}",
  directories: {
    output: path.join(repoRoot, "release"),
    buildResources: path.join(repoRoot, "packages", "electron", "build-resources"),
  },
  files: [
    "packages/electron/dist/**/*",
    "packages/electron/package.json",
  ],
  extraResources: [
    {
      from: path.join(repoRoot, "packages", "electron", "dist", "resources", "extensions"),
      to: "extensions",
    },
    {
      from: path.join(repoRoot, "packages", "electron", "dist", "resources", "skills"),
      to: "skills",
    },
  ],
  mac: {
    target: ["dmg", "zip"],
    category: "public.app-category.education",
    icon: path.join(repoRoot, "packages", "electron", "build-resources", "icon.icns"),
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: path.join(repoRoot, "packages", "electron", "build-resources", "entitlements.mac.plist"),
    entitlementsInherit: path.join(repoRoot, "packages", "electron", "build-resources", "entitlements.mac.inherit.plist"),
    extendInfo: {
      NSCalendarsUsageDescription:
        "Orbyt needs calendar access to read class schedules and help plan study sessions, deadlines, and events.",
      NSCalendarsFullAccessUsageDescription:
        "Orbyt needs full calendar access to create and update study sessions, deadlines, and other events you ask it to manage.",
    },
  },
  dmg: {
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
  },
}
