# Phase 04 - Credentials And Auth UX

Last updated: 2026-04-11

## Orientation Note

- Target feature: secure credential storage, plugin-scoped secret delivery, and auth form rendering in Settings or onboarding
- Key dependencies: Phase 03 routed tool path, Electron `safeStorage`, current onboarding and settings surfaces
- Constraints and boundaries:
  - do not build the full install manager yet
  - use mock or template auth before real Canvas validation becomes mandatory
  - secrets must never be injected through shared logs or global env
- Acceptance criteria for this increment:
  - auth schema can render UI fields
  - credentials are encrypted at rest
  - credentials are delivered only to the owning runtime
  - invalid auth is recoverable

## Beginning

### Objective

Solve secrets and auth before real integrations depend on them.

### Current State

- Canvas runtime already expects a post-start credential message, which is a good foundation.
- Onboarding documentation already assumes Canvas credentials come through the UI.
- Settings currently has no extension management or auth forms.

### Out Of Scope

- real Canvas tool execution
- full bundled install UX
- packaged runtime details

### Acceptance Criteria

- A plugin can declare an auth schema that renders into UI controls.
- Credentials are stored through Electron Main using encrypted storage.
- A plugin runtime receives credentials only after startup and only for its own scope.
- Auth failures surface typed errors and a clear recovery path.

## Middle

### Implementation Slices

1. Create a vault service in Electron Main.
2. Define auth schema rendering primitives for:
   - manual token
   - base URL
   - plain text secret field
3. Add Settings or onboarding form rendering for extension auth.
4. Validate and save credentials through IPC.
5. Deliver secrets through a scoped runtime handshake after plugin startup.

### Primary Directories

- `packages/electron/src/plugins/`
- `packages/electron/src/ipc/`
- `packages/ui/src/pages/`
- `packages/ui/src/components/`
- `packages/extensions/canvas-mcp/src/`

### Verification Gates

- Unit:
  - vault round-trip for one extension credential record
  - auth schema to form-field rendering test
- Integration:
  - plugin starts, receives mock credentials, and confirms readiness
- Manual smoke:
  - user can save credentials in UI and see auth state persist after restart
- Failure path:
  - invalid credentials do not poison startup and can be replaced

### Evidence To Capture

- auth form screenshot
- one saved-credential restart test
- one invalid-credential recovery test

## End

### Done When

- extension auth state is real and recoverable
- plugin secrets are encrypted and plugin-scoped

### Handoff To Next Phase

Phase 05 can now treat install and enable flows as product-facing because auth and readiness state have somewhere to land.

### Risks To Carry Forward

- if auth schema is too ad hoc, each extension will create bespoke UI debt
- if secrets leak into logs during validation or handshake, trust in the entire system is compromised

### First Recommended Next Step

Start [Phase 05 - Installation And Extension Management](phase-05-installation-and-extension-management.md).
