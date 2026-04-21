# Chat Message Footer Design

## Goal

Add a compact footer under chat messages that matches the Codex-style reference:

- render a local time-only timestamp under the message body
- render a copy action beside the timestamp
- support both user and assistant messages

## Chosen Approach

Keep the change local to `packages/ui/src/components/chat/MessageBubble.tsx`.

Each message with visible text content will render a small footer row directly under the message body:

1. The footer shows the message timestamp formatted as local time only, such as `4:19 PM`.
2. The existing copy interaction used for assistant responses is reused for both roles.
3. The footer aligns with the message role:
   - user message footer stays right-aligned under the user bubble
   - assistant message footer stays left-aligned under the assistant response

## Rendering Rules

### User Messages

- Keep the existing bubble styling and right alignment.
- When the message has visible text content, render a footer row under the bubble.
- The footer contains the timestamp and copy button on the same row.

### Assistant Messages

- Keep the current unwrapped assistant response layout.
- When the assistant message has visible text content and is not streaming, render the footer row under the response.
- Preserve the existing copy success state and icon swap.

### Timestamp

- Format from the existing `message.timestamp` value.
- Show time only in the user’s local timezone.
- Do not add relative time, date, or provider metadata.

### Copy Action

- Only render when the message has visible text content.
- Copy plain message text using the existing clipboard path already used by assistant responses.
- Preserve the transient `Copied` state after click.

## Component Impact

- `MessageBubble.tsx` becomes responsible for rendering a shared message footer for both roles.
- No changes are required in chat transport, message models, or container layout.
- Existing action primitives remain in use.

## Testing

Update component tests to cover:

- user messages render a timestamp footer
- assistant messages render a timestamp footer after non-streaming content
- user message copy uses the clipboard
- assistant message copy still uses the clipboard and resets after one second

## Non-Goals

- No change to message ordering or chat state
- No new clipboard utility
- No tooltip redesign or hover-only controls
