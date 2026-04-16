# Assistant Response Layout Design

## Goal

Update chat rendering so assistant messages use a Claude-style layout:

- user messages remain left-aligned bubbles with a max width
- assistant responses no longer render inside a bubble
- chain of thought renders as a separate collapsed row above the assistant response

## Chosen Approach

The assistant message renderer will treat each assistant turn as a vertical content group instead of a single bordered card.

Within that group:

1. The assistant avatar stays on the left.
2. If reasoning exists, render a standalone `ChainOfThought` row first.
3. If tool calls exist, render them below the thought row and above the answer.
4. Render the final assistant answer as plain page content with no card, border, or filled background.
5. Render the timestamp below the whole assistant group.

User messages keep their current bubble treatment, but align left and keep a constrained width.

## Rendering Rules

### User Messages

- Keep bubble styling.
- Align to the left side of the thread instead of the right.
- Preserve a readable max width.

### Assistant Messages

- Remove the outer rounded message bubble.
- Keep the assistant avatar and left gutter.
- Answer text should render directly on the page using typography spacing only.
- Streaming answer text should continue using the current streaming component.

### Chain Of Thought

- Render outside the answer content.
- Place it above the assistant answer as a separate collapsed row.
- Keep it visible after completion, collapsed by default.
- If a turn only has reasoning and no answer yet, show only the thought row.

### Tool Calls

- Preserve existing tool call indicators.
- Place them between the thought row and the answer body so the execution order reads top-to-bottom.

## Component Impact

- `MessageBubble.tsx` becomes responsible for two distinct assistant regions:
  - metadata rows such as chain of thought and tool calls
  - the answer body
- `ChainOfThought` remains reusable and does not need API changes unless spacing adjustments are needed.
- Existing markdown and streaming renderers stay in place and are reused inside the new unwrapped assistant layout.

## Testing

Update component tests to cover:

- assistant messages render without an outer bubble container
- chain of thought appears outside the answer body
- streaming reasoning does not create an empty answer card
- user messages remain bubbled and left-aligned

## Non-Goals

- No change to message parsing or reasoning classification
- No redesign of tool call visuals beyond placement
- No change to chat data structures or transport contracts
