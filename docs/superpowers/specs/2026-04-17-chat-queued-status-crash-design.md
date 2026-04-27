# Chat Queued Status Crash Design

## Problem

Sending a chat message crashes the UI immediately with:

`Cannot read properties of undefined (reading 'dotClassName')`

The crash happens before any assistant response is rendered, which points to a send-time state transition rather than markdown or streaming output rendering.

## Root Cause

`ChatStatus` includes a `queued` state in [packages/ui/src/hooks/chat-model.ts](/Users/rereynrd/School/orbyt/packages/ui/src/hooks/chat-model.ts), but `getChatStatusPresentation()` does not return a presentation object for `queued`.

[packages/ui/src/components/chat/ChatStatusBadge.tsx](/Users/rereynrd/School/orbyt/packages/ui/src/components/chat/ChatStatusBadge.tsx) assumes the presentation object always exists and reads `presentation.dotClassName`. When a send transitions into `queued`, the badge receives `undefined` and throws.

## Approach Options

### Recommended: Fix the mapping at the source and harden the badge

- Add an explicit `queued` case to `getChatStatusPresentation()`.
- Add a defensive fallback in `ChatStatusBadge` so a future missing mapping cannot crash the whole chat surface.

Why this is recommended:

- It preserves the intended queued lifecycle instead of hiding it.
- It fixes the immediate regression at the source.
- It adds a small guardrail against similar bugs from future status additions.

### Alternative: Badge-only fallback

- Leave the missing `queued` mapping in place.
- Make `ChatStatusBadge` render a generic fallback state when the mapping is missing.

Why this is weaker:

- It prevents the crash but leaves the model inconsistent.
- The queued state would not have a deliberate label or appearance.

### Alternative: Collapse `queued` into another state upstream

- Map `queued` to `idle` or `streaming` before it reaches the badge.

Why this is not preferred:

- It hides a real state transition.
- It spreads the fix into the orchestration-to-UI flow instead of correcting the broken presentation layer contract.

## Design

### Status Presentation

- Add `queued` to `getChatStatusPresentation()` with a non-error visual treatment distinct from `idle` and `streaming`.
- Keep the existing dark/light theme token usage untouched elsewhere.

### Rendering Hardening

- Make `ChatStatusBadge` tolerate an unexpected missing presentation object.
- Fallback should be generic and neutral rather than error-colored, because an unknown status is a rendering contract issue, not necessarily a failed turn.

### Testing

- Add or update a focused test that renders the badge in `queued` state.
- Run targeted UI regression tests around chat container and prompt input.
- If practical, run the broader UI test suite after the patch.

## Risk

- Low risk. The change is localized to status presentation and badge rendering.
- The only meaningful product decision is the exact queued label and indicator color, but that does not affect behavior.

## Success Criteria

- Sending a message no longer crashes the UI immediately.
- The chat badge renders a stable queued state while the request is waiting to start.
- Missing future status presentations do not white-screen the chat.
