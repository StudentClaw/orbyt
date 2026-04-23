# Phase 00 - Rollout Scaffold And State Audit

Last updated: 2026-04-22

## Orientation Note

- Target feature: create the rollout scaffold and lock the starting truth for
  T3-style core lifecycle parity
- Key dependencies: [PLAN.md](../../../PLAN.md),
  [docs/implementation/thread-runtime-isolation/README.md](../thread-runtime-isolation/README.md),
  [docs/superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md](../../superpowers/specs/2026-04-16-thread-runtime-isolation-and-parallel-chat-design.md),
  [docs/architecture/03-local-server.md](../../architecture/03-local-server.md)
- Constraints and boundaries:
  - do not implement runtime or contract changes in this phase
  - do not redefine the predecessor runtime-isolation rollout
  - do not over-specify future event-sourced projection work
  - keep the scope locked to core lifecycle parity
- Acceptance criteria for this increment:
  - the new rollout package exists with README, glossary, and phase docs
  - the starting architecture note is recorded accurately
  - predecessor dependencies are linked explicitly
  - the deferred follow-up boundary is locked in writing

## Objective

Create the implementation package and capture the actual starting state so later
phases build on repo truth instead of rediscovery.

## Current State

- `ThreadRuntimeManager` already exists and owns active and warm runtime
  behavior.
- current orchestration still directly mutates `orchestration_threads`,
  `orchestration_turns`, and `provider_runtime_sessions`
- archive and unarchive do not exist in the public thread surface
- runtime-binding persistence is thinner than `t3code`
- the existing thread-runtime isolation docs stop at runtime isolation and do
  not cover the broader thread lifecycle

## Out Of Scope

- archive and unarchive implementation
- durable binding schema changes
- runtime recovery code
- delete cleanup reactors
- renderer changes

## Public Interface Changes

- none in code
- documentation package addition only:
  - `README.md`
  - `GLOSSARY.md`
  - six phase docs for this rollout

## Behavior Priority

1. one canonical rollout package exists for the new lifecycle work
2. predecessor work is linked clearly so future implementation starts with real
   context
3. scope is locked to core lifecycle parity and deferred work is named clearly

## Tracer Bullet

Create the rollout package, then verify a reader can answer three questions from
docs alone:

- what this rollout adds beyond thread-runtime isolation
- which phase is current
- what is intentionally deferred

## Incremental Red -> Green Slices

1. Add README with purpose, predecessor link, phase order, and planning
   principles.
2. Add glossary with tracker, shared vocabulary, and defaults locked by the
   rollout.
3. Add phase docs with consistent headings and explicit TDD sections.
4. Review wording for consistency so later phases inherit one vocabulary set.

## Refactor Gate

After the rollout package exists, tighten wording and remove duplicate phrasing
only after the structure is complete. Do not speculate about post-Phase-05 work
beyond the explicit deferred boundary.

## Verification Gates

- Unit:
  - none required unless doc-linked helpers or generators are added later
- Integration:
  - a reader can navigate from README to glossary to phase docs without missing
    predecessor context
- Manual smoke:
  - open the package and confirm the current recommended next step is Phase 00
- Failure path:
  - confirm no phase doc implies full projection parity is in scope for this
    rollout

## Evidence To Capture

- file list of the new rollout package
- one note confirming predecessor rollout linkage
- one note confirming deferred event-authoritative projection parity boundary

## Done When

- the new rollout package exists and matches repo rollout conventions
- the starting architecture truth is recorded accurately
- the scope boundary is explicit and stable

## First Recommended Next Step

Start
[Phase 01 - Thread Lifecycle Contracts And Command Surface](phase-01-thread-lifecycle-contracts-and-command-surface.md).
