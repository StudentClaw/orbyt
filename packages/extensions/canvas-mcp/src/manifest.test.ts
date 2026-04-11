import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { CanvasManifestSchema, canvasManifest } from "./manifest.js"

describe("canvas manifest", () => {
  test("matches the checked-in manifest.json", () => {
    const manifestPath = resolve(import.meta.dir, "..", "manifest.json")
    const rawManifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    const parsed = CanvasManifestSchema.parse(rawManifest)

    expect(parsed).toEqual(canvasManifest)
  })
})
