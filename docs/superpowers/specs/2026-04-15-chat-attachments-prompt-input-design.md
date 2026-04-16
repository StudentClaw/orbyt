# Chat Attachments Prompt Input Design

## Goal

Replace the current custom chat composer with a ShadCN-based prompt input that matches the requested Codex-style layout and adds real local-file attachments.

The shipped experience must:

- use the actual ShadCN `prompt-input` component as the composer shell
- use the actual ShadCN `attachments` component in `inline` variant
- visually match the provided screenshot while adapting colors to the app's existing green theme
- place the attachment trigger first, with the model selector and access selector immediately to its right
- support selecting multiple files from any local directory
- show inline image thumbnails and non-image file chips before send
- persist attachment metadata on user turns so history can render the same attachments after send
- keep attachments path-based for Codex rather than uploading file contents into the turn payload

## Locked Product Decisions

- Attachments are path-based, not uploaded payloads.
- Files can be selected from any directory on the machine.
- A single message can include multiple attachments.
- The composer shows previews before send.
- Sent user messages keep showing attachments in history.
- Images render as thumbnails.
- Non-image files render as chips.
- Thread access mode remains independent from attachment source. Attaching a file from outside the workspace does not widen Codex permissions by itself.

## Chosen Approach

Persist attachment metadata as part of orchestration turn state, while continuing to send turns through the existing text-only `sendTurn` RPC.

When the user sends a message:

1. the renderer gathers attachment metadata for each selected path
2. the renderer synthesizes a structured attachment reference block into the user prompt text
3. orchestration stores both:
   - the prompt text that Codex receives
   - the attachment metadata needed for UI rendering

This keeps the backend compatible with the current text-based provider flow while giving the UI first-class attachment history.

## Rejected Alternatives

### UI-Only Path Injection

Append file paths to the prompt text without storing structured attachment metadata anywhere else.

Rejected because history rendering would have to scrape paths back out of freeform prompt text, which is brittle and makes previews unreliable.

### Uploaded Attachment Payloads

Create a new binary attachment transport and store copied file payloads or snapshots with the turn.

Rejected for this change because the current stack is text-only and the requested behavior is explicitly local path-based.

## User Experience

### Composer Layout

Use the ShadCN `prompt-input` component as the primary composer container.

The final layout inside the composer is:

1. multiline prompt field
2. inline attachment preview strip when files are selected
3. bottom action row
   - attachment `+` trigger
   - model selector
   - access selector
   - send or stop button aligned to the far right

The overall surface should stay close to the screenshot:

- large rounded container
- darker elevated surface in dark mode
- subtle border and focus ring
- action emphasis derived from the existing `--primary` theme tokens instead of registry default colors

### Attachment Selection

The attachment trigger opens the native Electron file picker.

Behavior:

- allows multiple file selection
- allows files from any directory
- does not allow directory selection for this flow
- ignores canceled selections
- appends newly selected files to the current composer selection instead of replacing the whole list

Duplicate paths should be de-duplicated within the current composer state.

### Attachment Preview

Use the ShadCN `attachments` component in `inline` variant as the attachment preview surface.

Rules:

- image attachments render thumbnail previews
- non-image attachments render chips with file name and secondary metadata
- each selected attachment has a remove action before send
- if an image preview cannot be resolved, fall back to a standard file chip

### Message History

User messages render attachments above the message text.

Rules:

- preserve the same image thumbnail vs chip distinction from the composer
- keep attachment rendering visible after refresh or reconnect
- if a file later disappears, keep the chip or thumbnail frame in history but render it as unavailable

### Model And Access Controls

Reuse the current model selector and access selector behavior, but move them into the composer action row so they sit immediately to the right of the attachment button.

No change to existing access-mode semantics:

- `Default permissions`
- `Full access`

No change to existing model selection behavior.

## State And Contract Changes

### Turn Attachment Model

Add a first-class attachment model to orchestration turn state.

Recommended shape:

- `id`
- `turnId`
- `path`
- `name`
- `mimeType`
- `sizeBytes`
- `kind`
  - `"image"`
  - `"file"`

`kind` is a rendering hint only. It does not imply the file was uploaded to the model.

### Turn Schema

Extend `OrchestrationTurn` with:

- `attachments: Attachment[]`

This makes attachments part of:

- database-backed orchestration state
- orchestration snapshot payloads
- renderer message derivation

The stored `input` field remains the exact text sent to Codex.

### Send Turn API

The current `SendTurnParams` only accepts prompt text and model selection.

Extend it so the renderer can submit both:

- the final text content sent to Codex
- the structured attachment metadata stored on the turn

Recommended shape:

- `threadId`
- `content`
- `attachments`
- optional `skillId`
- optional `model`

This keeps attachment persistence explicit instead of reconstructing it server-side from prompt text.

## Database Design

Store attachments in a dedicated table instead of embedding JSON into `orchestration_turns`.

Add a new table:

- `orchestration_turn_attachments`
  - `id TEXT PRIMARY KEY`
  - `turn_id TEXT NOT NULL REFERENCES orchestration_turns(id)`
  - `path TEXT NOT NULL`
  - `name TEXT NOT NULL`
  - `mime_type TEXT`
  - `size_bytes INTEGER`
  - `kind TEXT NOT NULL`
  - `position INTEGER NOT NULL`

Rationale:

- stable ordering for history rendering
- easier queries and deletes
- clearer schema evolution if attachment metadata grows later

Deleting a thread or turn should delete attachment rows for that turn as part of existing cleanup paths.

## Electron And Desktop Integration

### File Picker

The current `file:open-dialog` IPC path only returns one selected path.

Add a dedicated attachment-picker IPC path so the renderer can request multiple file paths without changing the existing workspace picker contract.

The attachment picker should:

- support multi-select
- return absolute file paths
- preserve existing single-directory behavior for workspace selection elsewhere in the app

Recommended new desktop surface:

- `file:select-attachments`
  - params:
    - optional extension filters
  - result:
    - `null` when canceled
    - `string[]` of absolute file paths when accepted

### File Metadata Resolution

Because the renderer does not directly own filesystem access, attachment preview metadata should come from a dedicated Electron-backed metadata lookup rather than guessing entirely in the browser.

Required metadata resolution:

- file name
- file size
- MIME or extension-based type guess
- whether the file should render as an image thumbnail

Recommended new desktop surface:

- `file:get-attachment-metadata`
  - params:
    - `paths: string[]`
  - result:
    - attachment metadata records for each resolved path

Image preview URLs should be derived at render time from the local path. They should not require copying the original file into app storage.

## Prompt Formatting

The attachment-aware prompt text sent to Codex should prepend a deterministic structured block above the user-entered message.

Recommended format:

```text
Attached files:
- /absolute/path/to/file-1.png
- /absolute/path/to/file-2.pdf

User message:
<original user text>
```

This gives Codex a reliable path list without relying on the user to mention the files manually.

The exact formatting can change during implementation, but it must remain:

- deterministic
- easy to inspect in tests
- readable if surfaced in stored prompt text

## Renderer Design

### Prompt Input

Refactor `PromptInput.tsx` around the ShadCN prompt composer primitives.

Responsibilities:

- manage textarea value
- manage staged attachment list before send
- open the Electron picker
- remove staged attachments
- disable send when the message is empty and there are no attachments
- clear staged attachments after successful send

### Chat Model

Update chat message derivation so user messages carry attachment metadata separately from message text.

Recommended `ChatMessage` addition:

- `attachments?: readonly ChatAttachment[]`

This keeps `MessageBubble` simple and avoids reparsing prompt text.

### Message Rendering

Update user message rendering to show attachments above the bubble body.

Behavior:

- render image grid or row for image attachments
- render chips for non-image attachments
- keep the message text below attachments
- handle missing-file state gracefully

Assistant messages are unchanged by this design.

## Data Flow

### Selecting Attachments

1. User clicks the `+` trigger.
2. Renderer opens the Electron multi-file picker.
3. Electron returns selected absolute paths.
4. Renderer resolves metadata for those paths.
5. Composer shows inline ShadCN attachment previews.

### Sending A Message

1. User clicks send.
2. Renderer validates selected attachments still exist.
3. Renderer builds the final prompt text by injecting the structured attachment reference block.
4. Renderer calls `sendTurn(threadId, content, attachments, model)`.
5. Orchestration creates the user turn and persists the attachment rows.
6. Snapshot-driven UI renders the sent message with its stored attachments.
7. Composer clears text and staged attachments.

### Reloading History

1. Renderer receives the orchestration snapshot.
2. Each turn includes its persisted attachments.
3. `buildChatMessages` maps turn attachments onto user messages.
4. History renders the same chips and thumbnails without re-parsing prompt text.

## Error Handling

- If the picker is canceled, keep current composer state unchanged.
- If a selected file no longer exists before send, block send and let the user remove it.
- If metadata lookup fails for a file, do not silently drop it. Show a fallback chip when possible and surface a user-visible failure if the attachment cannot be used.
- If an image preview cannot be produced, render the attachment as a non-image chip.
- If a file disappears after the turn is already stored, keep the history item but render a missing state for preview or open actions.
- If attachment persistence fails during turn creation, reject the turn submission rather than sending text to Codex without the UI metadata that the user expects.

## Testing

### Contracts

Update contract tests for:

- `SendTurnParams` attachment support
- `OrchestrationTurn` attachment support

### Orchestration

Add tests for:

- persisting attachments when a turn is created
- returning attachments in orchestration snapshots
- deleting attachment rows when parent turns or threads are deleted

### UI

Add or update tests for:

- multiple attachments in the composer
- image thumbnail vs chip rendering
- remove attachment behavior
- send behavior with attachment-aware prompt formatting
- user message history rendering with attachments
- graceful fallback when an image preview is unavailable

### Desktop IPC

Add tests for:

- multi-file picker behavior
- attachment metadata lookup behavior

## Non-Goals

- No binary upload transport for attachments
- No directory attachment support
- No drag-and-drop flow in this first pass unless it comes for free from the imported ShadCN component
- No change to assistant-side rendering beyond showing user attachment history
- No automatic permission escalation when an attached file lives outside the current workspace
