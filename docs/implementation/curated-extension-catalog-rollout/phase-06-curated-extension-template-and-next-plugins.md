# Phase 06 - Curated Extension Template And Next Plugins

Last updated: 2026-04-21

## Orientation Note

- Target feature: turn the Apple Calendar canary into the canonical intake template for future curated bundled extensions
- Key dependencies: all prior phases in this rollout, especially the Phase 03b packaging rules and the Phase 05 packaged-runtime hardening bar
- Constraints and boundaries:
  - keep the template grounded in the existing Orbyt plugin runtime and current curated packages
  - do not expand into a remote marketplace or arbitrary third-party install flow in this phase
  - treat Apple Calendar as the proving example, not a permanent one-off
- Acceptance criteria for this increment:
  - minimum requirements for future curated extensions are explicit
  - the bridge-manager decision rule is explicit
  - packaging, manifest normalization, and verification checklists are explicit
  - one completed canary example exists
  - future candidates end with a clear bundle-versus-defer recommendation

## Beginning

### Objective

Turn the Apple Calendar canary into a reusable operator guide so future curated
extensions can be evaluated and prepared without rediscovering ownership,
packaging, readiness, and support rules from scratch.

### Current State

- Apple Calendar is the canary bundled-curated extension beyond Canvas.
- The repo already has two useful package-shape references: `template-mcp` for a simple bundled server and Apple Calendar for a bridge-backed local-runtime integration.
- Orbyt wants more curated integrations over time, including Notion, Google Docs/Sheets, Gmail, and Discord.
- Without a shared intake checklist, each future extension will re-open packaging, auth, readiness, and support questions.

### Out Of Scope

- implementation of the next curated extension
- remote installer or catalog implementation
- arbitrary third-party MCP support
- changing the underlying plugin runtime architecture

### Acceptance Criteria

- minimum requirements for future curated extensions are explicit
- the bridge-manager rule is explicit
- packaging checklist is explicit
- manifest normalization checklist is explicit
- verification checklist is explicit
- bundle-versus-defer decision tree is explicit
- Apple Calendar is documented as the completed canary example
- Notion receives a full recommendation entry
- Google Docs/Sheets and Gmail receive shorter recommendation entries

## Middle

### Operator Workflow

Use [curated-extension-template-checklist.md](curated-extension-template-checklist.md)
as the fill-in artifact for any future curated extension review.

1. Start with the checklist and fill the candidate summary.
2. Confirm the package shape and manifest normalization rules.
3. Decide whether the candidate needs a bridge manager.
4. Decide whether it is safe to bundle now or should defer.
5. Record the verification bar before any implementation work starts.

### Minimum Requirements For Future Curated Extensions

Every future curated bundled extension should have:

- a monorepo-native package under `packages/extensions/<plugin-id>/`
- a checked-in `manifest.json` aligned with Orbyt contracts
- if vendored, a `Vendored From` section in the package `README.md` recording upstream Git URL, commit SHA, license, and attribution
- explicit build output under `dist/`
- root workspace build, typecheck, and test participation
- runtime ownership by the existing Electron Main plugin system
- clear support ownership and product-facing expectations
- a tool-naming decision that matches the house rule: vendored preserves upstream names, first-party-authored uses `snake_case`

### Bridge-Manager Decision Rule

Add a dedicated bridge manager only when the extension depends on a helper
runtime outside the MCP child itself, especially when that helper:

- accesses local OS APIs
- needs its own health check or retry loop
- must be packaged outside `asar`
- requires permission bootstrap independent of plugin auth

If any of those conditions apply, the extension inherits:

- the Phase 02 bridge lifecycle contract
- the Phase 03b macOS packaging contract when the helper is a native binary
- the Phase 04 readiness-panel contract when `manifest.auth.type === "none"`
- the Phase 05 observability and degraded-runtime contract

If none of those conditions apply, keep the extension as a standard `local_stdio`
plugin owned directly by the existing runtime. Do not add a bridge manager for
credential-only or fully remote extensions.

### Packaging And Staging Checklist

- packaged assets live in the bundled catalog
- executable helper assets live outside `asar` when necessary
- dev and packaged path resolution are both explicit
- platform gating is explicit when the extension is OS-specific
- runtime degradation is explicit for missing helper assets or unsupported hosts
- for native helpers on macOS, Phase 03b applies in full: `Info.plist` usage strings, per-arch helper packaging, codesign, notarization, hardened-runtime entitlements, and release verification evidence

### Manifest Normalization Checklist

Base future curated manifests on the shape already proven by `template-mcp` and
Apple Calendar:

- Orbyt `id`
- Orbyt-facing `name`
- `transport.type === "local_stdio"` with checked-in `transport.entry`
- `transport.env` omitted from the manifest and populated only at spawn time by the runtime owner
- `auth.type === "none"` unless the extension genuinely needs user-supplied credentials
- explicit tool inventory
- vendored tool names preserved as upstream authored them; first-party-authored tools use `snake_case`
- `permissions` drawn from the locked glossary vocabulary
- `author` and `homepage` normalized to Orbyt ownership expectations
- upstream attribution recorded in `README.md`, not in manifest-specific free-form fields

### Verification Checklist

Reuse the same four-part gate pattern from this rollout:

- unit
- integration
- manual smoke
- failure path

No future curated extension should skip the failure-path gate, especially when
it has helper-runtime, platform-specific, or credentialed behavior.

For bridge-backed extensions, the minimum failure-path coverage is:

- `bridge_unavailable`
- `permission_required` when the helper touches local OS permissions
- `bridge_crash_loop`

Phase 05 observability also carries forward:

- readiness transitions emit structured events
- MCP stderr and helper stderr are both attributable
- packaged builds retain a local diagnostics surface even without a visible debug UI

### Bundle Now Versus Defer

Bundle the extension in the app when:

- Orbyt is willing to own the support surface
- the runtime shape is stable enough to package reliably
- the integration has broad enough product value
- auth, permissions, and failure recovery can be explained clearly

Defer the extension when:

- it depends on a shared auth/session strategy that is not yet standardized
- support burden is still unclear
- the packaged-runtime contract is still too bespoke
- the extension is niche enough that a future remote-catalog path is a better fit

### Worked Canary Example: Apple Calendar

Apple Calendar is the reference example for a bridge-backed local-runtime
curated extension:

- Package shape: vendored package under `packages/extensions/apple-calendar-mcp/` with checked-in manifest, build output, and package README
- Vendoring: `README.md` records upstream Git URL, pinned commit, license, and attribution
- Tool naming: upstream camelCase tool names are intentionally preserved
- Auth/readiness: `manifest.auth.type === "none"` so Settings uses the readiness panel instead of a credential form
- Bridge-manager decision: required, because the Swift helper owns local EventKit access, health checks, permission bootstrap, and packaged native-runtime concerns
- Packaging: helper binary must live outside `asar`; packaged verification follows the Phase 03b and Phase 05 rules
- Platform gating: hidden on non-macOS and unsupported macOS versions during normal discovery
- Verification: must satisfy bridge lifecycle, permission bootstrap, packaged smoke, restart persistence, and degraded failure-path evidence

Apple Calendar should remain the canary reference until the first remote-service
curated extension clears the same checklist without a bridge manager.

### Future Candidate Recommendations

#### Notion

Recommendation: `bundle next` once curated auth packaging is ready through the
existing managed-auth path.

- Auth model: integration token or equivalent managed credential flow
- Bridge manager: no
- Packaging shape: standard bundled `local_stdio` MCP server
- Support burden: medium
- Why it fits: repo docs already identify an official Notion MCP and Orbyt’s plugin system already treats Notion as a first-class plugin category
- Main dependency before implementation: shared curated-auth packaging expectations should be applied consistently, not redefined inside a Notion-specific phase

#### Google Docs/Sheets

Recommendation: `defer until shared Google auth/session strategy is standardized`.

- Auth model: shared Google account/session handling
- Bridge manager: no
- Packaging shape: straightforward bundled `local_stdio` server once auth is settled
- Support burden: medium to high because scopes and account-selection rules should be shared across Google integrations

Treat Docs and Sheets as one Google Workspace document candidate for planning
purposes. Do not solve Google auth separately for each product.

#### Gmail

Recommendation: `defer after Google Docs/Sheets`.

- Auth model: same shared Google auth/session dependency as Docs/Sheets
- Bridge manager: no
- Packaging shape: straightforward once auth exists
- Support burden: higher than document tools because outbound actions need clearer confirmation and recovery rules

#### Discord

Recommendation: `defer to a later wave`.

- The current repo evidence for Discord is much thinner than for Notion and Google.
- Do not commit to bundling Discord until product demand and support ownership are clearer.

### Primary Directories

- `docs/implementation/curated-extension-catalog-rollout/`
- `docs/implementation/mcp-plugin-system/`
- `packages/extensions/`

### Verification Gates

- Unit:
  - template and checklist doc consistency review
- Integration:
  - checklist rules map cleanly to `template-mcp`, Apple Calendar, and the packaged-runtime hardening docs
- Manual smoke:
  - reviewer can apply the checklist to Notion and reach a clear recommendation without reopening basic packaging or bridge questions
- Failure path:
  - if the template still leaves auth ownership, bridge ownership, packaging, or platform gating ambiguous, this phase remains open

### Evidence To Capture

- one completed checklist example using Apple Calendar
- one full recommendation example using Notion
- one grouped recommendation entry covering Google Docs/Sheets
- one recommendation entry for Gmail

## End

### Done When

- Orbyt has a reusable bundled-curated extension template grounded in the Apple Calendar canary
- future extension planning can start from a checklist instead of rediscovering ownership, packaging, and readiness rules
- the checklist reflects the final packaged-runtime evidence from Phase 03b and Phase 05 before this phase is marked complete

### Handoff To The Next Implementation Step

The next implementation step after this phase is a product decision:

- queue Notion as the next curated candidate once shared curated-auth packaging is ready
- keep Google Docs/Sheets and Gmail deferred behind shared Google auth/session work
- revisit Discord only if stronger product demand or ownership emerges

### Risks To Carry Forward

- if the template is too abstract, future extensions will still become bespoke
- if shared auth dependencies stay implicit, teams will solve them per integration and fragment the bundled catalog
- if the final Phase 03b and Phase 05 evidence is not folded back into the checklist, the template will understate the real hardening bar

### First Recommended Next Step

Use the checklist artifact in this phase to re-run Apple Calendar as the canary
and then apply it to Notion before starting the next curated implementation.
