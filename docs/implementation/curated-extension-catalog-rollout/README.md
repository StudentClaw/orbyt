# Curated Extension Catalog Rollout

Last updated: 2026-04-18

This docs package is the implementation source of truth for adding first-party
curated extensions beyond Canvas to Orbyt.

Apple Calendar is the canary extension for this rollout. It is the first
non-Canvas extension that should prove the full bundled-curated path:

- vendored into the monorepo
- shipped in the bundled catalog
- managed by the existing Electron Main plugin runtime
- surfaced in Settings with readiness-aware UX

This rollout does not introduce a new plugin architecture. The runtime remains
the existing Orbyt Electron Main plugin system documented in
[docs/implementation/mcp-plugin-system/](../mcp-plugin-system/README.md).

## How To Use These Plans

1. Start with [GLOSSARY.md](GLOSSARY.md) for status, shared vocabulary, and handoff notes.
2. Work phases in order unless a later phase explicitly says it can begin in parallel.
3. Before implementation, review [PLAN.md](../../../PLAN.md), the predecessor plugin-system rollout, and the relevant product or architecture docs.
4. Do not mark a phase complete until its verification gates are green and the glossary handoff log is updated.

## Phase Order

- [Phase 00 - Source Ingestion And Rollout Scaffold](phase-00-source-ingestion-and-rollout-scaffold.md)
- [Phase 01 - Apple Calendar Extension Vendoring](phase-01-apple-calendar-extension-vendoring.md)
- [Phase 02 - Swift Bridge Lifecycle And Permissions](phase-02-swift-bridge-lifecycle-and-permissions.md)
- [Phase 03 - Bundled Catalog And Build Integration](phase-03-bundled-catalog-and-build-integration.md)
- [Phase 03b - macOS Packaging And Signing](phase-03b-macos-packaging-and-signing.md)
- [Phase 04 - Runtime Readiness And Settings UX](phase-04-runtime-readiness-and-settings-ux.md)
- [Phase 05 - Packaged Runtime And Hardening](phase-05-packaged-runtime-and-hardening.md)
- [Phase 06 - Curated Extension Template And Next Plugins](phase-06-curated-extension-template-and-next-plugins.md)

## Planning Principles For This Rollout

- Apple Calendar is the canary, not a one-off exception.
- Curated extensions remain local-first bundled plugins in v1. The MCP transport is always `local_stdio`; a curated extension may additionally own a non-MCP helper runtime (the "bridge") that speaks whatever protocol it needs to local OS APIs. MCP transport and bridge transport are distinct.
- Orbyt owns any required local helper runtime when a curated extension depends on one. The MCP child never spawns or supervises the bridge.
- Vendored extensions must be normalized to Orbyt conventions instead of executed from ad hoc external tarballs.
- Remote downloadable catalogs, marketplace-style distribution, and end-user-installed third-party MCP servers remain out of scope for this rollout (see "What This Rollout Does Not Cover" below).

## Contract Changes Landed By This Rollout

This rollout extends `packages/contracts/src/schemas/extension.ts` with the following additions. Each addition is owned by the phase listed.

- `ExtensionRuntimeReadiness` (Phase 02):
  - union of `ready`, `bridge_starting`, `bridge_unavailable`, `permission_required`, `bridge_crash_loop`, `platform_unsupported`, `error`
  - carried alongside `ExtensionLifecycleStatus` on the registry entry, not replacing it
  - emitted on the plugin lifecycle event bus as a readiness event distinct from lifecycle events
- `ExtensionTransport.env` (Phase 02):
  - optional `env: Record<string, string>` on the transport
  - source-of-truth is the bridge manager (or any runtime owner), which merges runtime-derived values before spawn
  - the manifest never hard-codes ports, tokens, or machine-specific values
- Settings auth-form suppression contract (Phase 04):
  - when `manifest.auth.type === "none"` the Settings UI must not render the credential form
  - it must instead render a readiness panel driven by `ExtensionRuntimeReadiness`
- Handoff Entry Template gains a `Contract changes` field (Phase 00 / GLOSSARY) because Phases 02 and 04 touch `packages/contracts/`.

Any change to this list requires a glossary update in the same branch.

## What This Rollout Does Not Cover

The curated catalog rollout covers first-party, in-repo, bundled extensions. It does not cover:

- end-user installation of arbitrary third-party MCP servers (pasting a command, URL, or npm spec)
- remote discoverable catalogs or marketplace semantics
- auto-update of user-installed MCP packages
- generic sandboxing posture for untrusted extension code beyond what the existing plugin runtime already provides

The generic user-installable MCP flow lives in the predecessor rollout at [docs/implementation/mcp-plugin-system/](../mcp-plugin-system/README.md), specifically Phase 05 (installation and extension management) and Phase 07 (hardening and packaged runtime). When those two rollouts disagree, this rollout wins for curated bundled extensions and the predecessor rollout wins for user-installed extensions.

## Deliverables Across The Full Rollout

- A monorepo-native vendoring path for Apple Calendar under `packages/extensions/apple-calendar-mcp/`
- A Orbyt-owned Swift bridge lifecycle for Apple Calendar, including ephemeral port allocation, per-session shared-secret auth, and readiness-aware startup ordering
- Bundled-catalog and packaging rules for curated extensions that ship with the app
- macOS packaging, codesigning, notarization, and entitlement rules for curated extensions that ship a native helper binary
- Runtime-readiness and Settings UX guidance for extensions that depend on local OS permissions, including an auth-form suppression contract for no-credential extensions
- A locked manifest vocabulary for `permissions` and a house rule for tool naming
- A reusable curated-extension template for future bundled integrations such as Notion, Google Docs, Gmail, and Discord
