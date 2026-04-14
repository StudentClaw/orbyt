# Thread CRUD Design

Date: 2026-04-11
Status: Approved in chat and implemented

## Goal

Add thread-level CRUD support to chat history without changing the existing folder-scoped chat model.

Users should be able to:

- create threads the same way they do today,
- read and open existing threads from the sidebar,
- rename a thread from a hover-revealed dropdown menu,
- delete a thread from that same dropdown after confirmation.

## Non-goals

- No message-level edit or delete
- No cross-folder thread move flow
- No workspace/folder model rewrite
- No new modal-heavy thread management surface

## Approved Behavior

### Thread actions

- Each thread row exposes a subtle hover action trigger.
- Clicking that trigger opens the existing dropdown menu component.
- The dropdown includes `Rename` and `Delete`.

### Rename

- `Rename` enters inline edit mode for that thread row.
- The user can save the new title or cancel.
- Empty titles are rejected.

### Delete

- `Delete` asks for confirmation before removing the thread.
- Confirmed deletion removes the thread and its message history from app storage.
- If the deleted thread is active, the app routes back to the parent folder chat state.

## Data and Architecture

The change extends the existing orchestration model rather than introducing renderer-only state.

- Add `renameThread` and `deleteThread` RPC methods.
- Add `thread.updated` and `thread.deleted` orchestration domain events.
- Persist rename in `orchestration_threads.title`.
- Cascade thread delete to `orchestration_turns` and `provider_runtime_sessions`.
- Keep thread creation and snapshot-driven thread listing unchanged.

## UI Shape

- Keep chat rows in the existing sidebar group structure.
- Use the existing dropdown menu primitive for thread actions.
- Keep the row compact by showing the action trigger on hover.
- Use inline edit mode instead of a separate dialog for rename.

## Error Handling

- Empty rename values should show an inline sidebar error.
- Failed rename or delete requests should surface an actionable sidebar error.
- Cancelled delete confirmation is a no-op.

## Verification

- Contracts decode rename/delete thread params and events.
- Server rename updates the persisted thread title.
- Server delete removes the thread, turns, and runtime session.
- Sidebar rename flows through the dropdown and submits the new title.
- Sidebar delete flows through the dropdown and returns the active route to the workspace when needed.
