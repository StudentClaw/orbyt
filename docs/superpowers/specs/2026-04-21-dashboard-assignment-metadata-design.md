# Dashboard Assignment Metadata Design

## Summary

Add compact assignment metadata to the main dashboard assignment cards so students can quickly see point value and submission state while scanning upcoming work.

The change keeps the existing card layout and priority behavior intact. Metadata is displayed as a small secondary row below the due label in each assignment card.

## Goals

- Improve scanability of dashboard assignments without adding a new drill-in step.
- Surface information students already use to prioritize work: point value and whether the work has been submitted or graded.
- Preserve the current visual hierarchy: title first, due state second, metadata third.

## Non-Goals

- Reworking dashboard card layout, grouping, or priority ranking.
- Introducing a new assignment detail panel or hover interaction.
- Changing how Canvas sync stores assignment metadata.
- Adding new database columns.

## Current State

Dashboard assignment cards are rendered by `TaskCard` from a derived `PrioritizedItem` shape. The current derived shape includes only:

- identity
- course context
- due date
- effort estimate
- ranking inputs

The source Canvas-backed assignment model already includes optional `pointsPossible` and `submissionStatus`, but those fields are dropped when dashboard items are derived.

## Proposed UX

Each dashboard assignment card should keep its current structure:

1. Assignment title
2. Due label
3. Metadata row with up to two chips
4. Estimated effort on the right

### Metadata Chips

- Points chip
  - Show when `pointsPossible` is present.
  - Format as `<value> pts`.
  - Preserve integer values without a trailing decimal when possible.
- Submission chip
  - Show when `submissionStatus` is present.
  - Normalize raw Canvas status values into student-friendly labels.

### Status Label Mapping

- `graded` -> `Graded`
- `submitted` -> `Submitted`
- `unsubmitted` -> `Not submitted`
- any other non-empty value -> title-cased fallback, unless the raw value is too noisy or clearly internal

### Visual Treatment

- Keep chips muted and compact.
- Points chip should use neutral styling.
- Submission chip may use slightly stateful styling, but should remain visually secondary to urgency and due date.
- Do not add another strong color system that competes with the existing urgency border.

## Data Flow

### Canonical Source

The canonical assignment shape remains `CourseWorkItem`.

Relevant optional fields already available upstream:

- `pointsPossible?: number`
- `submissionStatus?: string`

### Dashboard Derived Shape

Extend `PrioritizedItem` with:

- `pointsPossible?: number`
- `submissionStatus?: string`

This keeps `TaskCard` simple and avoids reaching back into raw Canvas state from the presentational layer.

### Derivation Rules

When building `PrioritizedItem` values in `DashboardPage`:

- carry forward `pointsPossible` when present
- carry forward `submissionStatus` when present
- preserve the current de-duplication logic across overdue, pending, and upcoming buckets
- preserve current priority scoring and sort behavior

No ranking logic should change as part of this feature.

## Component Changes

### `DashboardPage`

- Update `derivePriorityItems` input assumptions to include the extra metadata fields.
- Pass `pointsPossible` and `submissionStatus` into the derived items.

### `PrioritizedItem`

- Add the two optional metadata fields.

### `TaskCard`

- Render a metadata row below the due label.
- Show only the chips that have data.
- Keep spacing stable when zero, one, or two chips are present.

## Formatting Rules

### Points Formatting

- Prefer compact display.
- Whole numbers should render as `10 pts`, not `10.0 pts`.
- Non-integer values may render with minimal precision, such as `12.5 pts`.

### Submission Status Formatting

- Normalize known statuses first.
- Use fallback title case for unrecognized values only if the result remains user-friendly.
- Hide empty or null values.

## Error Handling and Edge Cases

- If an assignment has no `pointsPossible`, omit the points chip.
- If an assignment has no `submissionStatus`, omit the status chip.
- If both are missing, the card should render exactly as it does today.
- If Canvas returns an unfamiliar status string, show a readable fallback only when it is safe to expose directly.

## Testing

Add or update tests to cover:

- `PrioritizedItem` accepts the new optional fields without affecting existing priority behavior.
- `TaskCard` renders points when present.
- `TaskCard` renders normalized submission labels for known statuses.
- `TaskCard` hides metadata cleanly when fields are absent.
- Existing urgency and due labels continue to render unchanged.

## Rollout Risk

Risk is low because the change is:

- read-only
- UI-local
- backed by data already present in the server and database

The main risk is visual clutter. The chosen design keeps metadata secondary and avoids changing sort or grouping behavior.

## Implementation Notes

- Keep the implementation narrow to the dashboard assignment list flow.
- Avoid schema or migration changes.
- Avoid introducing a second source of truth for assignment display state.
