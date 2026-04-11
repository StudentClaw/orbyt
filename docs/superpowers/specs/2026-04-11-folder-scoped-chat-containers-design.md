# Folder-Scoped Chat Containers Design

Date: 2026-04-11
Status: Approved in chat, pending implementation

## Goal

Make chat folders work as organizational containers only.

Users should be able to:

- add a folder from the sidebar using the Electron native directory picker,
- see that folder appear once in the sidebar with no duplicates,
- open the folder itself as an empty chat container,
- create multiple chats under that folder with `+Chat`,
- keep broken folders visible with recovery actions,
- remove a folder and all of its chats after a warning.

## Non-goals

- No file tree
- No editor pane or file tabs
- No file-scoped chat model
- No folder-as-execution-context behavior
- No standalone web fallback for folder picking
- No thread move or cross-folder rehome flow

## Problem Summary

The current implementation already persists folder-backed chat workspaces, but its behavior does not fully match the approved UX.

The main mismatches are:

1. Adding a folder currently auto-creates a first chat instead of landing on the folder empty state.
2. The add-folder affordance has been visually confusing.
3. Folder removal needs an explicit warning before destructive deletion.
4. The intended product meaning needs to stay explicit: folders are containers for grouping chats only, not execution roots.

## Approved Behavior

### 1. Folder creation

- The global `+Folder` action works only in Electron.
- Clicking it opens the native directory picker.
- If the user cancels the picker, nothing changes.
- If the selected absolute path already exists, the existing folder is focused instead of creating a duplicate.
- If the selected path is new, the folder is added and opened at its empty state.

### 2. Folder selection

- Clicking a folder row opens the folder itself, not its latest chat.
- On `/chat`, the folder state is represented by `/chat/$workspaceId`.
- Outside `/chat`, selecting a folder keeps the current page and opens the right chat panel on that folder selection.

### 3. Chat creation within folders

- Each folder can contain multiple chats.
- Chats are only created from that folder's `+Chat` action or from composing in that folder empty state.
- Adding a folder does not auto-create a first chat.

### 4. Missing folders

- Saved folders that no longer exist on disk remain visible.
- Missing folders render as broken with `Relink` and `Remove`.
- Broken folders cannot create new chats or send messages.

### 5. Folder removal

- Removing a folder is app-only and never deletes anything from the real filesystem.
- Before removal, the app must show a warning that deleting the folder also deletes every chat stored under it.
- Confirmed removal deletes the folder record and all chats in that folder from app storage.

## Data and Persistence

No model rewrite is required for this pass.

The current workspace-backed persistence remains valid:

- folders stay represented as persisted workspaces,
- chats stay represented as threads owned by a workspace,
- duplicate detection remains based on normalized absolute folder paths,
- broken-folder state remains driven by filesystem availability checks,
- deleting a workspace continues to cascade to its threads in app storage.

This keeps the current backend shape while tightening the renderer behavior to match product intent.

## UI Changes

### Sidebar

- Keep the `Folders` section with collapsible folder groups.
- Keep the global add-folder action, but ensure the icon reads clearly as an add-folder affordance.
- Keep per-folder `+Chat`.
- Keep folder basename as the primary label and full path as secondary text.
- Keep broken-state actions inline under the folder row.

### Chat route behavior

- `/chat/$workspaceId` remains the folder empty state.
- `/chat/$workspaceId/$threadId` remains the active chat state.
- The folder empty state should invite the user to create or start a chat in that folder.

## Implementation Shape

### Renderer

Update [ChatHistory.tsx](/Users/rereynrd/School/student-claw/packages/ui/src/components/shell/ChatHistory.tsx) to:

- stop auto-creating a chat after folder add,
- focus existing folders when a duplicate path is picked,
- navigate or select the folder empty state after a successful add,
- prompt for confirmation before folder deletion,
- keep folder clicks targeting the folder itself.

Keep [ChatPage.tsx](/Users/rereynrd/School/student-claw/packages/ui/src/pages/ChatPage.tsx) and the existing route model as the source of truth for folder-empty versus active-chat states.

### Backend

Keep the existing orchestration contracts, workspace persistence, and deletion cascade behavior unless a bug is found during verification.

This is a behavior-correction pass, not a backend model expansion.

## Error Handling

- Picker cancellation is a no-op.
- Folder-picker failures in Electron should surface an actionable error instead of failing silently.
- Duplicate picks should focus the existing folder instead of erroring.
- Removing a folder without confirmation should do nothing.

## Verification Plan

- Folder add creates a folder and lands on `/chat/$workspaceId`, not a new thread.
- Duplicate folder add focuses the existing folder and does not create a second folder.
- Folder row selection opens the folder empty state.
- Per-folder `+Chat` still creates a chat inside the correct folder.
- Missing folders remain visible with `Relink` and `Remove`.
- Remove shows a warning and only deletes after confirmation.
- Removing a folder deletes its chats from app storage but never touches the real folder on disk.
- Electron-only folder picking still works through the existing IPC bridge.

## Risks and Mitigations

### Silent picker failures hide the real bug

Mitigation:

- surface picker errors instead of swallowing rejected promises.

### Folder-empty and thread-active states drift apart

Mitigation:

- keep the existing route model as the single source of truth on `/chat`.

### Current implementation scope gets confused with future code-context behavior

Mitigation:

- keep product language explicit in code comments and UI copy: folders are organizational containers only in this pass.

## Expected Deliverables

- Folder add opens the folder empty state instead of auto-creating a chat
- Duplicate folder picks focus existing folders
- Folder delete requires confirmation
- Broken folders remain visible and recoverable
- Existing workspace-backed persistence remains intact
