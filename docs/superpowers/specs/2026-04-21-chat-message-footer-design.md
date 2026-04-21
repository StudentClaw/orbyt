# Chat Message Footer Design

## Goal

Add a compact footer under chat messages that matches the Codex-style reference:

- render a local time-only timestamp under the message body
- render a copy action beside the timestamp
- support both user and assistant messages
- reveal the footer on hover without shifting layout

## Chosen Approach

Keep the change local to `packages/ui/src/components/chat/MessageBubble.tsx`.

Each message with visible text content will render a small footer row directly under the message body:

1. The footer shows the message timestamp formatted as local time only, such as `4:19 PM`.
2. The existing copy interaction used for assistant responses is reused for both roles.
3. The footer aligns with the message role:
   - user message footer stays right-aligned under the user bubble
   - assistant message footer stays left-aligned under the assistant response
4. The footer reserves its vertical space at all times, but its contents are only visible while the message row is hovered.

## Rendering Rules

### User Messages

- Keep the existing bubble styling and right alignment.
- When the message has visible text content, render a footer row under the bubble.
- The footer contains the timestamp and copy button on the same row.
- Keep the footer row in layout even when the message is not hovered so the bubble does not move on hover.

### Assistant Messages

- Keep the current unwrapped assistant response layout.
- When the assistant message has visible text content and is not streaming, render the footer row under the response.
- Preserve the existing copy success state and icon swap.
- Keep the footer row in layout even when the message is not hovered so the response does not move on hover.

### Timestamp

- Format from the existing `message.timestamp` value.
- Show time only in the user’s local timezone.
- Do not add relative time, date, or provider metadata.
- Keep the timestamp hidden until hover along with the rest of the footer content.

### Copy Action

- Only render when the message has visible text content.
- Copy plain message text using the existing clipboard path already used by assistant responses.
- Preserve the transient `Copied` state after click.
- Keep the copy action hidden until hover along with the timestamp.

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
- message layout keeps the footer row mounted even before hover state changes visibility

## Non-Goals

- No change to message ordering or chat state
- No new clipboard utility
- No tooltip redesign or hover-only controls
