# Curated Extension Template Checklist

Last updated: 2026-04-21

Use this checklist before starting implementation for any future curated bundled
extension. Fill every section. If any required answer is unknown, the candidate
is not ready to start implementation.

## Candidate Summary

- Candidate name:
- Proposed plugin id:
- Primary user value:
- Upstream source or implementation origin:
- Decision:
  - `bundle next`
  - `defer until dependency is resolved`
  - `later wave`
- Blocking dependency, if deferred:

## Package And Ownership

- [ ] Package will live under `packages/extensions/<plugin-id>/`
- [ ] `manifest.json` will be checked in
- [ ] Build output will land in `dist/`
- [ ] Root build, typecheck, and test scripts will include the package
- [ ] Student Claw ownership and support expectations are explicit
- [ ] If vendored, `README.md` will include `Vendored From` with upstream URL, pinned commit, license, and attribution

## Manifest Normalization

- [ ] `id` and `name` are normalized to Student Claw conventions
- [ ] `transport.type === "local_stdio"`
- [ ] `transport.entry` points at checked-in build output
- [ ] `transport.env` is omitted from the manifest and injected only at runtime
- [ ] `auth.type` is set intentionally:
  - `none` for readiness-driven local integrations
  - credentialed for managed-auth remote integrations
- [ ] Tool inventory is explicit
- [ ] Tool naming follows the house rule:
  - vendored keeps upstream names
  - first-party-authored uses `snake_case`
- [ ] `permissions` use the locked glossary vocabulary
- [ ] `author` and `homepage` match Student Claw ownership expectations

## Auth And Readiness

- Auth shape:
- Settings surface:
  - readiness panel
  - credential form
  - hybrid
- Expected readiness states:
- User recovery actions for degraded states:

## Bridge-Manager Decision

- Does the candidate need a helper runtime outside the MCP child?
- If yes, why:
  - local OS API access
  - separate health check or retry loop
  - packaging outside `asar`
  - permission bootstrap
  - other:
- Bridge-manager decision:
  - `required`
  - `not required`
- If required, inherited contracts:
  - [ ] Phase 02 bridge lifecycle
  - [ ] Phase 03b native-helper packaging rules
  - [ ] Phase 04 readiness-panel behavior
  - [ ] Phase 05 diagnostics and degraded-runtime behavior

## Packaging And Staging

- [ ] Bundled assets will be staged into the app catalog
- [ ] Executable helper assets will live outside `asar` if needed
- [ ] Dev and packaged path resolution are both explicit
- [ ] Platform gating is explicit if the extension is OS-specific
- [ ] Packaged degraded behavior is defined for missing assets or unsupported hosts
- [ ] If a native macOS helper exists, release verification must include codesign, notarization, and hardened-runtime checks

## Verification Plan

- Unit coverage:
- Integration coverage:
- Manual smoke:
- Failure path:
- Required observability fields:
  - `pluginId`
  - `source`
  - `readiness`
  - `lifecycleStatus`
  - `retryClass`
  - `correlationId`

## Recommendation Summary

- Final recommendation:
- Why now or why not now:
- Main risks:
- First prerequisite before implementation begins:
