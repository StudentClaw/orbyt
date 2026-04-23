# macOS Signing Runbook

Last updated: 2026-04-20

This runbook is the operational closeout for Phase 03b. It assumes the repo
already contains the signed packaging path and that the remaining work is
machine setup, Apple credentials, and evidence capture.

## 1. Prepare This Mac

Install full Xcode, then point `xcode-select` at it:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -version
```

Run the repo preflight:

```bash
bun run check:electron:mac:signed
```

The preflight must report:

- full Xcode selected
- all five signing env vars present
- readable local signing assets where applicable

## 2. Create Apple Signing Assets

From Apple Developer:

- create or confirm a **Developer ID Application** certificate
- export it from Keychain Access as a `.p12` file with a password

From App Store Connect:

- create an API key for notarization
- download the `.p8` file
- record the key ID and issuer ID

## 3. Export Local Signing Variables

For the first local proof, use local file paths:

```bash
export CSC_LINK=/absolute/path/to/DeveloperIDApplication.p12
export CSC_KEY_PASSWORD='your-p12-password'
export APPLE_API_KEY=/absolute/path/to/AuthKey_ABC123DEF4.p8
export APPLE_API_KEY_ID='ABC123DEF4'
export APPLE_API_ISSUER='12345678-1234-1234-1234-123456789012'
```

Then rerun:

```bash
bun run check:electron:mac:signed
```

## 4. Local arm64 Signed Proof

Build the Apple Silicon signed artifact first:

```bash
bun run dist:electron:mac:signed --arch arm64
```

Then verify the generated `.app`:

```bash
bun run verify:electron:mac --release-dir /absolute/path/to/release --verbose
```

Evidence to capture:

- `codesign --verify --deep --strict --verbose=2` output
- `spctl --assess --type execute` output
- `xcrun stapler validate` output
- helper path:
  `Contents/Resources/extensions/apple-calendar-mcp/bridge/CalendarAPIBridge`
- confirmation the helper is outside `app.asar`

## 5. Manual Smoke

On macOS 13+:

1. launch the signed app
2. enable Apple Calendar
3. capture the Orbyt-branded Calendar permission prompt
4. grant permission
5. confirm readiness reaches `Ready`
6. confirm one Apple Calendar tool call succeeds
7. confirm quitting the app leaves no orphaned bridge process

If the permission prompt is missing or the copy is wrong, Phase 03b stays open.

## 6. CI Mirror

Use the same secret contract in CI:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

CI should run the same command:

```bash
bun run dist:electron:mac:signed --arch arm64
```

CI should persist the same evidence as the local proof run.

## 7. x64 Follow-Up

After arm64 is proven, repeat for Intel:

```bash
bun run dist:electron:mac:signed --arch x64
```

Then rerun the same verification commands on the produced `x64` app bundle.
