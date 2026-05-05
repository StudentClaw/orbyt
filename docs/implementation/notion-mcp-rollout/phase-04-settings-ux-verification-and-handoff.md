# Phase 04 - Settings UX Verification And Handoff

Last updated: 2026-05-05

## Orientation Note

- Target feature: verify Notion appears and behaves correctly through existing Settings and gateway surfaces.
- Key dependencies: `ConnectionsSection`, plugin auth IPC, plugin gateway inventory.
- Constraints and boundaries: use generic manual-token UI unless tests reveal a gap, do not add custom Notion screens, write smoke must use a throwaway Notion page.
- Acceptance criteria: Settings renders Notion credentials, gateway exposes `notion.<tool>` names after startup, bad/unauthorized tokens produce recoverable errors, glossary handoff is current.

## Beginning

### Objective

Close the rollout with user-visible verification and a clean next-agent handoff.

### Current State

Earlier phases add package, build, credential, and runtime behavior. This phase validates the surfaces users and Codex actually touch.

### Out Of Scope

- remote Notion OAuth
- bespoke Notion onboarding wizard
- permanent write/delete smoke against real user content

## Middle

### TDD Cycle

1. RED: Settings test expects Notion manual-token fields to render.
2. GREEN: rely on generic Connections UI or adjust copy only if necessary.
3. RED: gateway inventory test expects `notion.API-post-search` after startup.
4. GREEN: verify running plugin inventory path.
5. RED: failure-path test covers bad token or inaccessible page.
6. GREEN: preserve official error result as recoverable plugin/tool output.

### Verification Gate

- Unit: Settings auth rendering test
- Integration: gateway inventory and one routed Notion tool path
- Manual smoke: search/read/write against connected throwaway page
- Failure path: bad token and unauthorized page access

## End

### Done When

Notion is usable as a bundled extension and the glossary captures what was completed, what remains, and what to test next.
