# Thread Runtime Isolation And Parallel Chat Design

## Goal

Replace the current shared-runtime chat execution model with true thread isolation.

The shipped experience must:

- allow up to `4` chat threads to run at the same time
- isolate execution so one thread's runtime state does not leak into another
- block a second send in the same thread while that thread is `queued` or `streaming`
- show a distinct `Queued` state before a turn actually starts running
- keep thread runtimes warm after completion for faster follow-up turns
- evict warm idle runtimes with LRU when capacity is needed
- mark all `queued` and `streaming` work as `interrupted` when the app closes
- never auto-resume queued or active work after restart

## Problem Summary

The current chat system has two architectural problems.

First, the renderer derives thread status from global provider runtime state. That makes one active thread appear to put every thread into the same busy state.

Second, orchestration drains a single global work queue serially. Even though turns belong to separate threads, only one turn is processed at a time, which makes chat feel slow and prevents parallel use.

## Locked Product Decisions

- Use one Codex process per active thread.
- Cap total active or warm thread runtimes at `4`.
- Queue additional threads globally in FIFO order after the cap is reached.
- A thread that already has a `queued` or `streaming` turn rejects additional sends.
- Finished thread runtimes stay warm instead of shutting down immediately.
- Warm idle runtimes are evicted only when capacity is needed.
- Eviction uses least-recently-used warm idle runtime selection.
- Active runtimes are never evicted.
- If the app closes, all warm runtimes are destroyed and any `queued` or `streaming` turn becomes `interrupted`.
- Restart never resumes or requeues prior work automatically.

## Chosen Approach

Introduce a `ThreadRuntimeManager` in the server orchestration layer that owns a distinct Codex process for each active thread.

Each thread runtime slot contains:

- thread id
- child Codex process handle
- provider thread id and session metadata
- slot state: `active` or `warm-idle`
- last-used timestamp for LRU eviction

The manager enforces a maximum of `4` total slots. A slot can be reused only by its owning thread. When a new queued thread needs capacity and no free slot exists, the manager evicts the least-recently-used warm idle slot, then starts a fresh runtime for the waiting thread.

This design gives true isolation between threads while preserving fast follow-up turns in the same thread.

## Rejected Alternatives

### Shared Process With A Parallel Scheduler

Keep one Codex app-server process and allow up to `4` turns at once within that shared process.

Rejected because the user explicitly chose full thread isolation. This approach would still share runtime lifecycle, process health, and some state surfaces across threads even if turn execution became concurrent.

### Process Per Thread Without A Cap

Start one runtime for every thread that wants to run.

Rejected because it would multiply memory, CPU, file handles, and plugin gateway pressure without any backpressure. The failure mode would be worse than the current system on a busy machine.

### Warm Process Per Thread Forever

Keep a process attached to each thread until manual deletion or app shutdown.

Rejected because warm idle threads would permanently consume runtime capacity and make the `4` slot cap much less useful.

## User Experience

### Thread Status

Each thread owns its own visible execution state.

Supported thread states:

- `idle`
- `queued`
- `streaming`
- `interrupted`
- `completed`

The sidebar and active chat view must render these states from thread-local state only. One thread being `queued` or `streaming` must not change the visible status of other threads.

### Sending Messages

When the user sends a message:

1. if the thread already has a `queued` or `streaming` turn, reject the send immediately
2. otherwise create a new turn in `queued`
3. if a runtime slot is available for that thread, promote the turn to `streaming`
4. if no slot is available, leave the thread visibly `queued` until admitted

The user should see the new turn appear immediately, but queued turns must not present as active thinking.

### Queued State

Queued threads should show:

- thread status: `Queued`
- composer submit blocked for that thread
- a clear disabled reason such as `This thread is waiting for an execution slot.`

Queued assistant output should render as queued, not streaming. The UI must not show `Thinking...` or a streaming caret until the turn actually starts.

### Streaming State

Only a thread that has been admitted to an active runtime slot may show streaming behavior:

- stop button enabled
- streaming token updates
- thinking indicator
- live tool call and approval UI

### Warm Reuse

If the user sends another message in a thread that still owns a warm idle runtime, that thread should start faster because it reuses its own process and provider session.

Warm reuse is invisible to the user except for reduced latency.

### Shutdown And Restart

If the app closes:

- all warm idle runtimes are destroyed
- all active runtimes are destroyed
- all `queued` turns become `interrupted`
- all `streaming` turns become `interrupted`

On next launch:

- interrupted history remains visible
- no thread is auto-resumed
- the user must manually send a new message to continue

## State And Contract Changes

### Thread Status

Extend `OrchestrationThread.status` to include:

- `queued`

Final thread status set:

- `idle`
- `queued`
- `streaming`
- `interrupted`
- `completed`

### Turn Status

Stop using `pending` as a proxy for both waiting and active work.

Extend `OrchestrationTurn.status` to include:

- `queued`

Final turn status set:

- `queued`
- `streaming`
- `interrupted`
- `completed`

Queued and streaming are intentionally distinct. A queued turn has been accepted by orchestration but has not yet been attached to an active thread runtime.

### Provider Runtime State

Global provider runtime state should represent service health, not per-thread activity.

The existing global state remains responsible for:

- auth required
- offline
- degraded
- rate limited

It must stop being the source of truth for whether an individual thread is busy.

Recommended additions to `ProviderRuntimeState`:

- `activeRuntimeCount`
- `warmRuntimeCount`
- `maxRuntimeCount`

These counts are not required for the first UI pass, but they make runtime behavior observable and debuggable.

### Runtime Slot State

Add a server-only slot model for `ThreadRuntimeManager`.

Recommended shape:

- `threadId`
- `processId`
- `providerThreadId`
- `state`
  - `active`
  - `warm-idle`
- `lastUsedAt`
- `startedAt`

This model does not need to be exposed directly to the renderer in the first version.

## Event Model Changes

The current event semantics blur `queued` and `started`. That must change.

Recommended orchestration domain events:

- `turn.queued`
- `turn.started`
- `turn.updated`
- `turn.completed`

Rules:

- `turn.queued` is emitted when orchestration accepts a new turn but the thread has not started executing yet
- `turn.started` is emitted only when the thread has been admitted to a runtime slot and streaming can begin
- `turn.updated` continues to represent output and reasoning updates for an active streaming turn
- `turn.completed` covers both normal completion and interrupted final state through the included turn payload

This keeps UI behavior correct without guessing from global provider runtime events.

Provider runtime events may continue to exist for token, tool-call, and approval streaming, but thread status must be derived from the thread and turn payloads, not a global `providerStatus === "streaming"` check.

## Backend Design

### ThreadRuntimeManager

Add a new orchestration-owned manager responsible for:

- creating thread-specific Codex runtimes
- tracking active and warm idle slots
- admitting queued work when capacity exists
- reusing warm slots for the same thread
- evicting the least-recently-used warm idle slot when necessary
- terminating slots on thread deletion, workspace deletion, runtime failure, or app shutdown

The manager should own the concurrency cap. Orchestration should ask it for admission instead of directly pushing work into one global serialized queue.

### Send Turn Flow

`sendTurn(threadId, ...)` should do the following:

1. validate the thread exists and can accept chat
2. reject if the thread already has a current turn in `queued` or `streaming`
3. create a new turn with status `queued`
4. set the thread status to `queued` and `currentTurnId` to the new turn
5. emit `turn.queued`
6. enqueue the thread for runtime admission
7. return immediately to the caller

Admission then happens asynchronously through `ThreadRuntimeManager`.

### Admission Flow

When the manager processes queued work:

1. if the thread already owns a warm idle runtime, reuse it immediately
2. otherwise if fewer than `4` slots exist, start a new thread runtime
3. otherwise try to evict the LRU warm idle runtime
4. if eviction succeeds, start a runtime for the waiting thread
5. if all `4` slots are active, keep the thread queued

When a queued turn is admitted:

1. update the turn status to `streaming`
2. update the thread status to `streaming`
3. emit `turn.started`
4. begin the Codex turn on that thread's runtime

### Per-Thread Runtime Reuse

Each thread runtime keeps its own provider thread id and session state.

Changing threads must never reuse another thread's runtime or provider thread id.

Within the same thread, a warm runtime may be reused across turns until one of these happens:

- the runtime is evicted by LRU
- the runtime fails
- the thread is deleted
- the workspace is deleted
- the app shuts down

### Eviction Policy

Eviction applies only to warm idle runtimes.

Rules:

- never evict an active runtime
- choose the least-recently-used warm idle runtime
- fully shut down the evicted process before admitting a new thread into that slot budget
- clear any server-side session mapping for the evicted thread

The first version should not add a separate idle TTL. LRU under capacity pressure is sufficient.

### Interrupt Behavior

Interrupt continues to target the current thread only.

If the thread is `streaming`, interrupt the live Codex process for that thread and finalize the turn as `interrupted`.

If the thread is `queued`, remove it from the admission queue, finalize the turn as `interrupted`, and release its place without ever starting a runtime.

After interrupt, the thread runtime may remain warm if the process is still healthy and the turn had already been admitted. A queued turn that never started does not create or keep a warm runtime.

### Shutdown Behavior

App shutdown is terminal for in-flight work.

On shutdown:

1. stop accepting new admissions
2. mark every queued turn as `interrupted`
3. mark every streaming turn as `interrupted`
4. destroy all thread runtimes, both active and warm idle
5. persist the final interrupted state before exit

No queued or streaming work should be restored automatically on next launch.

### Restart Behavior

On startup:

- reconcile stale `queued` and `streaming` turns to `interrupted`
- start with zero warm runtimes
- rebuild no automatic runtime ownership
- wait for fresh user sends to create new queued work

This keeps recovery deterministic and avoids replaying partially completed turns.

## Renderer Design

### Chat State Resolution

`resolveChatState` and related renderer helpers must stop treating global provider status as thread activity.

Thread-local state should be derived in this order:

1. thread status and current turn status
2. thread-specific pending approval state
3. app-level connection and auth health

This prevents shared status bleed between threads.

### Composer Behavior

The composer remains visible in queued threads, but submit is blocked.

Recommended behavior:

- `streaming`: show stop button
- `queued`: disable submit with queued reason
- `idle` or `completed`: allow send
- `interrupted`: allow send

This matches the product decision to block re-entry within the same thread without making the whole app single-threaded.

### Message Rendering

Queued turns need a distinct assistant placeholder.

Recommended rendering:

- queued with no output: `Queued...`
- streaming with no output: `Thinking...`

This avoids the current false impression that queued work is already running.

### Sidebar Indicators

Sidebar thread indicators should distinguish:

- `queued`
- `streaming`
- unread completed work
- idle/completed with no unread changes

Exact iconography can follow the existing sidebar language, but queued and streaming must not collapse into the same indicator.

## Testing

### Server Tests

Add coverage for:

- admitting up to `4` threads in parallel
- leaving the fifth thread queued
- rejecting a second send in the same thread while queued
- rejecting a second send in the same thread while streaming
- reusing a warm runtime for the same thread
- evicting the least-recently-used warm idle runtime only
- never evicting an active runtime
- interrupting a queued turn before runtime start
- interrupting a streaming turn in its own runtime
- converting queued and streaming turns to `interrupted` on shutdown
- reconciling stale queued and streaming turns to `interrupted` on startup

### Renderer Tests

Add coverage for:

- one thread streaming without other threads appearing busy
- one thread queued while another thread streams
- queued turns rendering `Queued...` instead of streaming UI
- composer disabled for queued threads only
- composer still usable in other idle threads while another thread runs
- sidebar indicators reflecting thread-local state only

## Risks And Mitigations

### Process Cost

Risk: four isolated Codex processes may consume noticeably more resources than one shared process.

Mitigation: keep the hard cap at `4`, prefer warm reuse, and expose runtime counts for debugging.

### Session Cleanup Bugs

Risk: stale per-thread provider session mappings could survive eviction and cause cross-thread leakage.

Mitigation: make eviction and shutdown clear both process handles and thread-to-provider session mappings atomically.

### Event Ordering

Risk: queued, started, token, and completed events may arrive in the wrong order and confuse the renderer.

Mitigation: separate `turn.queued` from `turn.started` explicitly and keep thread status updates persisted before publishing the corresponding event.

## Implementation Notes

The first implementation should prioritize correctness over aggressive optimization.

Recommended order:

1. add `queued` thread and turn status support through contracts, snapshots, and renderer state
2. separate `turn.queued` from `turn.started` semantics
3. introduce `ThreadRuntimeManager` with cap enforcement and per-thread send blocking
4. wire warm reuse and LRU eviction
5. finalize shutdown and startup reconciliation rules

This sequence fixes the shared-status bug early while making room for the full isolated-runtime architecture.
