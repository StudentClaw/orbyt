# Phase 00 - Rollout Scaffold And Contract

Last updated: 2026-05-05

## Orientation Note

- Target feature: plan and scaffold the Notion MCP official-wrapper rollout.
- Key dependencies: [PLAN.md](../../internal/PLAN.md), [TEST.md](../../internal/TEST.md), [docs/features/05-plugin-system.md](../../features/05-plugin-system.md), [docs/architecture/05-external-services.md](../../architecture/05-external-services.md).
- Constraints and boundaries: official wrapper, local stdio, manual token auth, static 22-tool API-prefixed manifest inventory, remote MCP deferred.
- Acceptance criteria: rollout docs exist, phase order is explicit, v1 decisions are locked, glossary tracker is ready.

## Beginning

### Objective

Create a decision-complete implementation scaffold for bundling Notion as a curated Orbyt extension.

### Current State

Orbyt already has a bundled local MCP runtime, manual-token vault UI, and manifest-driven gateway inventory. Notion is described in architecture docs but no package exists yet.

### Out Of Scope

- hosted Notion MCP OAuth
- custom Notion API tool design
- implementation code in this phase

## Middle

### TDD Cycle

Documentation-only phase. Reviewer verification is the RED/GREEN gate.

### Verification Gate

- Manual smoke: reviewer can identify the phase order and v1 contract from README/GLOSSARY without inspecting code.
- Failure path: remote MCP and custom adapter paths are explicitly out of scope.

## End

### Done When

The rollout docs exist and later phases can implement against a stable official-wrapper contract.
