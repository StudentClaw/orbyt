# Release Updates and CI/CD

This repo ships desktop updates through GitHub Releases and `electron-updater`.
The production updater is stable-only: use plain versions like `1.2.3` for real rollouts.
Prerelease versions such as `1.2.3-beta.1` can be published as GitHub prereleases, but the desktop app will ignore them as update candidates.

## CI on Every Push

`.github/workflows/ci.yml` runs on pull requests, pushes to `main`, and manual dispatches.

The required job:

1. Checks out the repo.
2. Installs Bun from the version in `package.json`.
3. Runs `bun install --frozen-lockfile`.
4. Runs `bun run typecheck`.
5. Runs `bun run build`.
6. Verifies the Electron bundle output exists at:
   - `packages/electron/dist/main/main.js`
   - `packages/electron/dist/preload/preload.mjs`
   - `packages/electron/dist/renderer`

The advisory job runs lint and tests with `continue-on-error: true`. It is useful signal, but it does not block the workflow.

## Prepare a Stable Update

Start from a clean branch based on the latest `main`.

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c release/v1.2.3
```

Bump the app version to the exact stable version you plan to ship.
At minimum, update the root `package.json` version because the macOS packaging script stages that version into the Electron app.

```bash
bun pm pkg set version=1.2.3
bun install
```

Run local verification before merging.

```bash
bun run typecheck
bun run build
bun run test
```

Commit, push, and merge through the normal review path.

```bash
git add package.json bun.lock
git commit -m "Release v1.2.3"
git push -u origin release/v1.2.3
```

After the release commit is on `main`, create and push a matching stable tag.

```bash
git switch main
git pull --ff-only origin main
git tag v1.2.3
git push origin v1.2.3
```

You can also run the Release workflow manually with `workflow_dispatch`, but the checked-out code still needs to contain the matching app version.

## Release Workflow

`.github/workflows/release.yml` runs when a tag matching `v*.*.*` is pushed, or when manually dispatched with a version.

The workflow has three jobs:

1. `preflight`
   - Resolves the release version and tag.
   - Marks plain `x.y.z` versions as stable releases and prerelease-looking versions as prereleases.
   - Runs `bun install --frozen-lockfile`.
   - Runs `bun run typecheck`.
   - Finds the previous release tag for generated release notes.

2. `build`
   - Runs twice on macOS, once for `arm64` and once for `x64`.
   - Installs dependencies.
   - Runs `scripts/build-macos-desktop-artifact.ts`.
   - Builds the app, bundled extensions, bundled skills, Apple Calendar bridge, DMG, ZIP, blockmap, and update manifest files.
   - Uploads each architecture's release assets.

3. `release`
   - Downloads both macOS artifact sets.
   - Merges the `arm64` and `x64` update manifests into one `latest-mac.yml`.
   - Verifies `latest-mac.yml`, ZIP files, and blockmaps are present.
   - Publishes a GitHub Release with the DMG, ZIP, blockmap, manifest, and build log assets.

## Signing and Notarization

The macOS build signs and notarizes only when all of these GitHub Actions secrets are present:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

If any are missing, the workflow builds unsigned artifacts. Use signed and notarized artifacts for production desktop releases.

## How Users Receive Updates

The Electron main process registers stable auto-updates from `packages/electron/src/updater/desktop-updater.ts`.

Updates are enabled only when all of these are true:

- The app is a packaged production build.
- The platform is macOS.
- `ORBYT_DISABLE_AUTO_UPDATE` is not set to `1`.
- The packaged app includes an update feed, normally from the GitHub publish config generated during packaging.

The updater uses the `latest` channel and rejects prerelease versions. A valid stable update version looks like `1.2.3`.

Once the app is running:

1. It waits 30 seconds after startup.
2. It checks GitHub Releases for the newest stable update.
3. It checks again every 4 hours while the app remains open.
4. In `automatic` mode, it downloads an available update and installs it when the user quits Orbyt.
5. In `prompt` mode, it shows update state in Settings and waits for the user to download or install.

Users can also go to Settings, General, Desktop updates to:

- Check for updates.
- Switch between automatic and prompt mode.
- Download an available update.
- Restart to install a downloaded update.

## Troubleshooting

If users do not see an update:

- Confirm the GitHub Release is published, not draft.
- Confirm the version is stable, for example `1.2.3`.
- Confirm the Release includes `latest-mac.yml`, ZIP files, and blockmaps.
- Confirm the app was built from code whose root `package.json` version is lower than the release version.
- Confirm the app is a packaged macOS build, not a dev run.
- Confirm `ORBYT_DISABLE_AUTO_UPDATE` is not set.

If the Release workflow fails:

- Check `preflight` first for version or typecheck failures.
- Check each macOS architecture build for signing, notarization, or packaging errors.
- Check the release job for missing ZIP, blockmap, or manifest assets.
- Download the uploaded build logs from the failed workflow run for the detailed packaging command output.
