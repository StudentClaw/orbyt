import { describe, expect, test } from "bun:test"
import {
  mergeMacUpdateManifests,
  parseMacUpdateManifest,
  serializeMacUpdateManifest,
} from "./merge-mac-update-manifests"

describe("merge-mac-update-manifests", () => {
  test("merges arm64 and x64 files into one stable mac updater manifest", () => {
    const arm64 = parseMacUpdateManifest(`version: 0.1.1
files:
  - url: Orbyt-0.1.1-arm64.zip
    sha512: arm64zip
    size: 11
    blockMapSize: 1
path: Orbyt-0.1.1-arm64.zip
sha512: arm64zip
releaseDate: '2026-04-28T12:00:00.000Z'
`)
    const x64 = parseMacUpdateManifest(`version: 0.1.1
files:
  - url: Orbyt-0.1.1-x64.zip
    sha512: x64zip
    size: 12
    blockMapSize: 2
path: Orbyt-0.1.1-x64.zip
sha512: x64zip
releaseDate: '2026-04-28T12:00:00.000Z'
`)

    const merged = serializeMacUpdateManifest(mergeMacUpdateManifests(arm64, x64))

    expect(merged).toContain("url: Orbyt-0.1.1-arm64.zip")
    expect(merged).toContain("url: Orbyt-0.1.1-x64.zip")
    expect(merged).toContain("path: Orbyt-0.1.1-arm64.zip")
  })

  test("rejects manifests with different versions", () => {
    const first = parseMacUpdateManifest(`version: 0.1.1
files:
  - url: Orbyt-0.1.1-arm64.zip
`)
    const second = parseMacUpdateManifest(`version: 0.1.2
files:
  - url: Orbyt-0.1.2-x64.zip
`)

    expect(() => mergeMacUpdateManifests(first, second)).toThrow("different versions")
  })
})
