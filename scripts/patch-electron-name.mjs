#!/usr/bin/env node
// Patches the local Electron binary's Info.plist so the macOS dock shows
// "Student Claw" instead of "Electron" during development.
import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(import.meta.url), "../../")

const plistCandidates = [
  resolve(root, "node_modules/.bun/electron@41.2.0/node_modules/electron/dist/Electron.app/Contents/Info.plist"),
  resolve(root, "node_modules/electron/dist/Electron.app/Contents/Info.plist"),
]

const plist = plistCandidates.find(existsSync)
if (!plist) {
  console.warn("[patch-electron-name] Could not find Electron.app Info.plist — skipping patch")
  process.exit(0)
}

const pb = (cmd) => execSync(`/usr/libexec/PlistBuddy -c "${cmd}" "${plist}"`, { stdio: "pipe" })
const APP_NAME = "Student Claw"
const APP_BUNDLE_ID = "com.studentclaw.dev"

try {
  pb(`Set :CFBundleName '${APP_NAME}'`)
  pb(`Set :CFBundleDisplayName '${APP_NAME}'`)
  pb(`Set :CFBundleIdentifier '${APP_BUNDLE_ID}'`)
  console.log("[patch-electron-name] Patched Info.plist ->", plist)
} catch (e) {
  console.warn("[patch-electron-name] PlistBuddy failed:", e.message)
}
