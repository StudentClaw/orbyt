# Feature Conflict Resolution Checklist

Use this as an execution checklist while reviewing feature specs and applying architecture updates.

## Execution Status

- [x] Naming and terminology normalization pass completed across feature + architecture docs.
- [x] Checklist run complete for all feature files (01-10).

## Resolution Policy (locked for this pass)

- [x] Feature specs are canonical for v1 behavior.
- [x] When feature specs conflict with each other, prefer explicit "Resolved", "Locked v1", or tighter-scope onboarding/security constraints.
- [x] Architecture docs must scaffold and support the resolved feature set.

## Per-Feature Review Checklist

### 01 - `01-ai-harness.md`
- [x] Reviewed dependencies, auth, context assembly, and tool routing.
- [x] Conflict found: auth includes API key fallback, while onboarding requires ChatGPT subscription OAuth-only.
- [x] Resolution: v1 auth is ChatGPT OAuth-only; API key fallback deferred.
- [x] Architecture impact logged in `docs/architecture/05-external-services.md` and `docs/architecture/03-local-server.md`.

### 02 - `02-canvas-integration.md`
- [x] Reviewed cache-first reads, server-owned sync, typed change events, and MCP boundaries.
- [x] Conflict found: plugin ownership can be read as plugin-owned sync, but spec also says server owns scheduling/diffing.
- [x] Resolution: Canvas MCP handles service-specific fetch/normalize; Local Server owns scheduling, caching, diffing, and fan-out.
- [x] Architecture impact logged in `docs/architecture/03-local-server.md` and `docs/architecture/05-external-services.md`.

### 03 - `03-skill-system.md`
- [x] Reviewed skill tiers, capability requests, and server policy gate.
- [x] Conflict found: UI-level activation can imply authority; policy gate requires server-side enforcement.
- [x] Resolution: markdown skills declare intent only; all sensitive capability checks enforced server-side.
- [x] Architecture impact logged in `docs/architecture/03-local-server.md` and `docs/architecture/01-shared-contracts.md`.

### 04 - `04-memory-system.md`
- [x] Reviewed mem0 partitioning, projection model, and profile compiler responsibilities.
- [x] Conflict found: file-system dependence wording can imply many writable markdown stores.
- [x] Resolution: mem0 is source of truth; markdown files are limited to `soul/SOUL.md` and generated `MEMORY.md`.
- [x] Architecture impact logged in `docs/architecture/03-local-server.md` and `docs/architecture/01-shared-contracts.md`.

### 05 - `05-plugin-system.md`
- [x] Reviewed hub-and-spoke model, utility process isolation, and local vault boundaries.
- [x] Conflict found: some architecture references implied server-local MCP ownership.
- [x] Resolution: Electron Main hosts plugin orchestrator; Local Server uses a typed gateway to request tool execution and tool inventory.
- [x] Architecture impact logged in `docs/architecture/02-electron-shell.md` and `docs/architecture/03-local-server.md`.

### 06 - `06-dashboard.md`
- [x] Reviewed section order, priority model inputs, and check-in behavior.
- [x] Conflict found: UI transport statements elsewhere implied WebSocket-only, while dashboard flow relies on preload IPC bridge patterns.
- [x] Resolution: UI uses both typed IPC (desktop shell integration) and WebSocket streams (real-time domain events); no direct renderer network/filesystem.
- [x] Architecture impact logged in `docs/architecture/04-react-ui.md` and `docs/architecture/01-shared-contracts.md`.

### 07 - `07-file-system.md`
- [x] Reviewed local-only storage, metadata index, viewer matrix, and AI file context.
- [x] Conflict found: plugin sandbox language elsewhere implied broad filesystem denial while file workflows require controlled access.
- [x] Resolution: renderer remains blocked; Local Server file service is authority; plugins are denied broad filesystem access and only receive scoped data through tool contracts.
- [x] Architecture impact logged in `docs/architecture/05-external-services.md` and `docs/architecture/03-local-server.md`.

### 08 - `08-onboarding.md`
- [x] Reviewed required setup gates, first sync, preferences/routines capture, and resume logic.
- [x] Conflict found: AI auth path differs from AI Harness fallback text.
- [x] Resolution: onboarding requirement wins for v1 - ChatGPT subscription OAuth required before completion.
- [x] Architecture impact logged in `docs/architecture/05-external-services.md` and `docs/architecture/03-local-server.md`.

### 09 - `09-smart-planner.md`
- [x] Reviewed hybrid AI/deterministic boundary, 6-week window, and check-in handling.
- [x] Conflict found: planner writes and priority updates must not bypass policy and contract typing.
- [x] Resolution: planner state changes and conversational preference writes go through typed server services and policy checks.
- [x] Architecture impact logged in `docs/architecture/03-local-server.md` and `docs/architecture/01-shared-contracts.md`.

### 10 - `10-notification-service.md`
- [x] Reviewed feed-first delivery, quiet hours, batching, and insight generation.
- [x] Conflict found: legacy "notification history" wording in architecture conflicted with unified activity feed model.
- [x] Resolution: replace notification-history framing with unified activity center/feed terminology.
- [x] Architecture impact logged in `docs/architecture/04-react-ui.md` and `docs/architecture/01-shared-contracts.md`.

## Architecture Update Checklist

- [x] Update shared contracts to include feature-level domain types and transport contracts used by dashboard/activity/planner/features.
- [x] Update Electron shell architecture to reflect plugin-orchestrator ownership in Main and typed bridge to server/UI.
- [x] Update Local Server architecture to reflect server-owned Canvas sync/diffing, policy enforcement, memory/profile flow, and gateway to plugin orchestrator.
- [x] Update React UI architecture to reflect dual transport usage (typed IPC + WebSocket), plus unified activity center.
- [x] Update external-services architecture to match OAuth-only v1 auth and resilient feed/cache behavior.
