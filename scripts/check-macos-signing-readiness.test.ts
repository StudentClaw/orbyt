import { describe, expect, test } from "bun:test"
import {
  assessAppleSigningAsset,
  assessMacSigningReadiness,
  type AppleSigningAssetName,
} from "./check-macos-signing-readiness"

function asset(name: AppleSigningAssetName, value: string | undefined) {
  return assessAppleSigningAsset(name, value, {
    exists: (candidate) => candidate === "/tmp/cert.p12" || candidate === "/tmp/AuthKey_TEST.p8",
  })
}

describe("check-macos-signing-readiness", () => {
  test("accepts local file assets and inline Apple API keys", () => {
    expect(asset("CSC_LINK", "/tmp/cert.p12")).toMatchObject({
      ok: true,
      source: "path",
    })

    expect(asset("APPLE_API_KEY", "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----")).toMatchObject({
      ok: true,
      source: "inline",
    })
  })

  test("flags missing or unreadable signing assets", () => {
    expect(asset("CSC_LINK", undefined)).toMatchObject({
      ok: false,
      reason: "missing",
    })

    expect(asset("APPLE_API_KEY", "/tmp/missing.p8")).toMatchObject({
      ok: false,
      reason: "unreadable_path",
    })
  })

  test("requires full Xcode and all signing assets for signed readiness", () => {
    const readiness = assessMacSigningReadiness({
      env: {
        CSC_LINK: "/tmp/cert.p12",
        CSC_KEY_PASSWORD: "secret",
        APPLE_API_KEY: "/tmp/AuthKey_TEST.p8",
        APPLE_API_KEY_ID: "ABC123DEF4",
        APPLE_API_ISSUER: "12345678-1234-1234-1234-123456789012",
      },
      exists: (candidate) => candidate === "/tmp/cert.p12" || candidate === "/tmp/AuthKey_TEST.p8",
      probeXcode: () => ({
        ok: true,
        developerDir: "/Applications/Xcode.app/Contents/Developer",
        version: "Xcode 17.0",
      }),
    })

    expect(readiness.ready).toBe(true)
    expect(readiness.failures).toEqual([])
  })

  test("reports Command Line Tools and missing secrets as blockers", () => {
    const readiness = assessMacSigningReadiness({
      env: {
        CSC_LINK: "/tmp/cert.p12",
      },
      exists: (candidate) => candidate === "/tmp/cert.p12",
      probeXcode: () => ({
        ok: false,
        developerDir: "/Library/Developer/CommandLineTools",
        error: "xcodebuild requires full Xcode",
      }),
    })

    expect(readiness.ready).toBe(false)
    expect(readiness.failures).toContain("Full Xcode is required for signed macOS packaging.")
    expect(readiness.failures).toContain("Missing required signing variables: CSC_KEY_PASSWORD, APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER")
  })
})
