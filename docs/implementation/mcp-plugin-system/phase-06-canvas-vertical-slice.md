# Phase 06 - Canvas Vertical Slice

Last updated: 2026-04-11

## Orientation Note

- Target feature: prove the architecture with one real extension by running a real Canvas tool through the full path
- Key dependencies: Phases 00 through 05, `packages/extensions/canvas-mcp`, onboarding and settings auth surfaces
- Constraints and boundaries:
  - start with one real read path
  - prefer `get_courses` first, then widen to additional Canvas tools
  - keep sync orchestration and broader planner work out of this phase unless the read path is already stable
- Acceptance criteria for this increment:
  - user can enter Canvas credentials in UI
  - Canvas plugin starts with real credentials
  - one real Canvas tool succeeds through the full routed path
  - invalid URL or token is handled cleanly

## Beginning

### Objective

Replace the fake plugin with one production integration to prove the architecture is real.

### Current State

- Canvas package already contains a real MCP server skeleton, manifest, client, and runtime credential shape.
- The remaining work is wiring that package into the new extension runtime and validating one real tool path.

### Out Of Scope

- full server-side Canvas sync engine
- planner integration
- dashboard hydration beyond what is required to validate the plugin runtime

### Acceptance Criteria

- Canvas extension can be installed or enabled from the app.
- User can save `baseUrl` and `token` in UI.
- Plugin receives credentials through the secure handshake.
- `get_courses` returns real data through the routed path.
- Bad token and bad URL produce recoverable UI states.

## Middle

### Implementation Slices

1. Promote Canvas manifest to the shared extension contract shape.
2. Render the Canvas auth form in Settings or onboarding.
3. Validate credentials with a real Canvas probe.
4. Start Canvas plugin and verify readiness.
5. Route `get_courses`.
6. Add a second tool only after `get_courses` is stable.

### Primary Directories

- `packages/extensions/canvas-mcp/`
- `packages/electron/src/plugins/`
- `packages/ui/src/pages/`
- `packages/ui/src/components/onboarding/`
- `packages/server/src/mcp/`

### Verification Gates

- Unit:
  - Canvas auth payload validation tests
  - manifest compatibility tests
- Integration:
  - route one real `get_courses` call end to end
- Manual smoke:
  - user enters valid credentials and sees real course data
- Failure path:
  - bad token and bad base URL both surface typed, friendly, recoverable states

### Evidence To Capture

- successful `get_courses` response sample
- one invalid-token screenshot or error log
- one restart test proving auth persistence

## End

### Done When

- Canvas is running as a real installable extension through the shared runtime
- one production tool is stable enough to act as the proof point for the architecture

### Handoff To Next Phase

Phase 07 should focus on operational quality, not new product behavior, unless the Canvas slice is still unstable.

### Risks To Carry Forward

- if this phase introduces Canvas-specific shortcuts into shared runtime code, future extensions will be harder to add
- if UI validation and runtime validation disagree, users will see confusing auth states

### First Recommended Next Step

Start [Phase 07 - Hardening And Packaged Runtime](phase-07-hardening-and-packaged-runtime.md).
