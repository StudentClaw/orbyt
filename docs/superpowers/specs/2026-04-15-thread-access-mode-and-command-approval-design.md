# Thread Access Mode And Command Approval Design

## Goal

Add a Codex-style access-mode control to ChatUI so each chat thread can run in either:

- `Default permissions`
- `Full access`

The UI must:

- default every new thread to `Default permissions`
- show a Codex-style footer pill for switching modes
- require an extra confirmation step before enabling `Full access`
- ask for confirmation when Codex requests approval for a potentially dangerous command in `Default permissions`

The system must use Codex's real approval flow rather than a frontend-only heuristic.

## Locked Product Decisions

- Access mode is stored per chat thread.
- New threads always start in `Default permissions`.
- `Full access` requires a confirmation step each time the thread is switched from `Default permissions` to `Full access`.
- Once a thread is in `Full access`, commands run without additional per-command prompts.
- Changing a thread's access mode applies immediately by resetting that thread's provider session while preserving visible chat history.

## Chosen Approach

Persist a thread-level access mode in orchestration state, map that mode directly to Codex sandbox and approval settings, and extend the local Codex app-server bridge so it can surface native approval requests to the renderer and accept approve or deny responses.

This avoids fake safety UI. The current bridge hardcodes `approvalPolicy: "never"` and `sandbox: "danger-full-access"` for new provider threads, so the required behavior cannot be delivered by UI work alone.

## Access Mode Mapping

- `default`
  - label: `Default permissions`
  - Codex sandbox: `workspace-write`
  - Codex approval policy: `untrusted`
- `full`
  - label: `Full access`
  - Codex sandbox: `danger-full-access`
  - Codex approval policy: `never`

## User Experience

### Footer Selector

Place the access-mode control in the existing chat composer footer next to the model selector.

Behavior:

- Render as a pill button with icon, label, and chevron.
- `Default permissions` uses neutral styling.
- `Full access` uses emphasized amber styling matching Codex.
- The control reflects the selected thread's persisted access mode.
- Disable the selector while the thread is streaming or waiting on an approval response.

### Menu Behavior

The dropdown contains exactly two choices:

1. `Default permissions`
2. `Full access`

Selecting `Default permissions` applies immediately.

Selecting `Full access` never applies directly from the dropdown. It opens a confirmation dialog first.

### Full Access Confirmation

The confirmation dialog is required every time the user attempts to switch a thread from `Default permissions` to `Full access`.

Dialog requirements:

- strong title explaining the thread is about to receive unrestricted command execution
- short explanation that commands in this thread can run without further command-by-command approval
- primary confirm action that enables `Full access`
- cancel action that leaves the thread unchanged

Switching back from `Full access` to `Default permissions` does not require extra confirmation.

### Approval Prompt Surface

When Codex requests approval for a command in `Default permissions`, show a blocking approval card directly above the composer.

The card displays:

- title: `Command needs approval`
- command text in monospace
- working directory when available
- reason or requested permission context when available
- `Approve` and `Deny` actions
- loading state while the response is being sent back to the runtime

Only one approval card is shown for the active thread at a time. If the user switches threads, the approval card follows the thread that owns it.

## State And Contract Changes

### Thread State

Add `accessMode` to `OrchestrationThread` with the values:

- `"default"`
- `"full"`

This field becomes part of:

- database storage
- orchestration snapshot payloads
- domain events containing thread data
- renderer state derived from snapshots

### Pending Approval State

Add a thread-scoped pending approval model that is visible to the renderer and recoverable after reconnect or refresh.

Recommended shape:

- `id`
- `threadId`
- `turnId`
- `kind`
  - `"command"`
  - `"file-change"`
  - `"permissions"`
- `itemId`
- `approvalId`
- `reason`
- `command`
- `cwd`
- `availableDecisions`
- optional details for future file-change and permission prompts

The first shipped UI can focus on `command`, but the bridge and contract should be generic enough to handle the other Codex approval request types without redesign.

Recommended snapshot surface:

- add `pendingApprovals` to `OrchestrationSnapshot`
- keep runtime approval events for incremental updates between full snapshot syncs

### RPC Additions

Add:

- `orchestration.setThreadAccessMode(threadId, accessMode)`
- `provider.respondToApproval(approvalRequestId, decision)`

These keep access-mode changes and approval responses explicit rather than overloading existing send-turn behavior.

### Runtime Events

Extend `ProviderRuntimeEvent` with approval events:

- `provider.approvalRequested`
- `provider.approvalResolved`

These drive incremental UI updates. The active pending approvals should also be included in a snapshot-backed state surface so the UI can recover after reconnects.

## Backend Design

### Database

Add the next migration to append `access_mode` to `orchestration_threads`:

- non-null
- default value: `"default"`

Existing threads backfill to `"default"`.

### Orchestration Service

Update orchestration thread reads and writes to include `access_mode`.

Add a new `setThreadAccessMode` orchestration command that:

1. validates the thread exists
2. rejects changes while the thread has an active turn, including approval-paused turns
3. updates `orchestration_threads.access_mode`
4. clears the thread's bound provider session in `provider_runtime_sessions`
5. emits `thread.updated`

Clearing the provider binding is the mechanism that makes the new mode take effect immediately for future work on that thread.

### Codex Bridge

Extend the Codex app-server bridge in `CodexCli.ts` in three ways.

First, when starting a provider thread, use the persisted thread access mode instead of hardcoded full access.

Second, handle JSON-RPC server requests, not just responses and notifications. Approval requests arrive as server-initiated requests such as:

- `item/commandExecution/requestApproval`
- `item/fileChange/requestApproval`
- `item/permissions/requestApproval`

Third, maintain an in-memory map of pending approval requests keyed by a renderer-safe approval request id. This map stores:

- original app-server request id
- request method
- thread id
- turn id
- approval metadata needed by the UI

When the renderer approves or denies, the bridge looks up the original request and writes a JSON-RPC response back to the app-server with the selected decision.

`OrchestrationService.getSnapshot()` should include the bridge's currently pending approvals so the renderer can recover approval UI after reconnects or a hard refresh.

### Immediate Apply Semantics

The selected access mode applies immediately at the thread-session level, but not mid-turn.

Rules:

- if a turn is currently streaming or paused on approval, the selector is disabled
- if the thread is idle, changing the mode immediately clears the provider thread binding
- the next provider interaction on that thread creates a new provider thread with the updated sandbox and approval policy

This keeps behavior deterministic without trying to mutate a live Codex turn.

## Data Flow

### Thread Creation

1. User starts a new chat thread.
2. Orchestration creates the thread with `accessMode = "default"`.
3. Snapshot and `thread.created` expose that mode to the renderer.
4. Footer selector renders `Default permissions`.

### Switching To Full Access

1. User opens the footer dropdown and selects `Full access`.
2. Renderer opens the confirmation dialog.
3. Confirming calls `orchestration.setThreadAccessMode(threadId, "full")`.
4. Backend updates the thread row and clears the provider session binding.
5. Renderer receives `thread.updated`.
6. Footer selector now renders `Full access`.

### Sending A Turn In Default Permissions

1. User submits a prompt on a thread with `accessMode = "default"`.
2. Provider thread starts with `workspace-write` plus `untrusted`.
3. Safe commands run normally.
4. If Codex requests command approval, the bridge captures the request and publishes `provider.approvalRequested`.
5. Renderer shows the approval card for that thread.
6. Approving or denying sends `provider.respondToApproval(...)`.
7. Bridge replies to the app-server request.
8. Renderer clears the approval card after `provider.approvalResolved`.

## Error Handling

- If the bridge receives an approval request it cannot map, fail closed and surface an error rather than silently approving.
- If the renderer response references an unknown or stale approval request id, reject the RPC and keep the approval pending.
- If the renderer disconnects and reconnects while approval is pending, the pending approval must rehydrate from snapshot-backed state.
- If a thread is deleted while approval is pending, deny the pending request and clear the bridge entry.
- If the provider session is reset because access mode changed, clear any stale approval UI belonging to the old provider session.

## Testing

### Contracts

- schema tests for `OrchestrationThread.accessMode`
- schema tests for provider approval event payloads and approval response RPC params

### Database And Orchestration

- migration test for backfilling `access_mode`
- orchestration tests for creating threads with default mode
- orchestration tests for updating mode and emitting `thread.updated`
- orchestration tests that mode changes clear provider session bindings
- orchestration tests that mode changes are blocked while a turn is active

### Codex Bridge

- unit tests that provider thread start uses the correct sandbox and approval policy for each access mode
- tests that `item/commandExecution/requestApproval` is captured and translated into renderer state
- tests that approve and deny responses are written back to the app-server correctly
- tests that unknown approval ids are rejected

### Renderer

- footer selector renders the active thread's mode
- selecting `Full access` opens the confirmation dialog before any state change
- confirming full access updates the thread mode
- switching back to `Default permissions` applies directly
- selector disables while streaming or approval is pending
- approval card renders command, cwd, and actions
- approving and denying dispatch the correct RPC calls
- thread switching shows the correct approval card for the selected thread

## Non-Goals

- no global app-level access mode preference
- no heuristic command classification in the frontend
- no per-command approval prompts once a thread is in `Full access`
- no redesign of the model selector or broader composer layout beyond the new access-mode control and approval card
