# Assignment Detail Page Design

## Summary

Add a dedicated assignment detail route so students can click a dashboard assignment card and open a full assignment page.

The page should render immediately from lightweight preview state passed during navigation, then hydrate with fresh Canvas assignment details using `canvas.getAssignmentDetails`. The first shipped version should display the structured assignment metadata plus the assignment body from `source.description`.

This page should also introduce AI quick actions that launch a new chat thread pre-seeded with assignment context.

## Goals

- Let students open a dedicated assignment page from the dashboard.
- Keep navigation human-readable by showing the assignment title in breadcrumbs instead of the raw id.
- Render useful content immediately from dashboard preview state.
- Fetch fresh Canvas-backed details after navigation.
- Display assignment instructions/body using the current structured Canvas detail response.
- Add assignment-scoped AI quick actions that open a seeded chat thread.

## Non-Goals

- Scraping the full rendered Canvas page HTML.
- Shipping rubric, attachment, submission comment, or inline grading views in this pass.
- Running AI results inline on the assignment page.
- Adding a global assignment-detail cache layer beyond what is needed for this route.
- Reworking the dashboard layout or replacing the current card list.

## Route And Navigation

### Route Shape

Add a dedicated route:

- `/assignments/$assignmentId`

The route parameter should use the app's internal coursework id, such as `canvas-coursework:assignment:19737:540935`, not the raw Canvas numeric id.

### Click Behavior

- Clicking a dashboard assignment card navigates to the assignment detail route.
- Navigation should include lightweight preview state from the clicked card so the destination page can render immediately.
- The preview state should include:
  - assignment id
  - assignment title
  - course id
  - course code and, when available, course name
  - due date
  - submission status
  - points possible
  - course color
  - assignment `htmlUrl` if available

### Breadcrumbs

- The visible breadcrumb should read `Assignments > {assignment title}`.
- The route id remains internal, but no raw id should be shown in the primary navbar breadcrumb when a title is available.
- Before detail hydration completes, the page should use the preview title.
- After hydration, the breadcrumb should continue using the resolved assignment title.

## Page Structure

The page should prioritize scanability for students.

### Header Summary

The top of the page should show:

- assignment title
- course label
- due date
- submission status
- points possible
- grade when available
- `Open in Canvas` action when a source URL exists

This summary should use the preview state immediately and refine itself after the detail fetch completes.

### AI Quick Actions

Below the summary header, add a compact action strip with buttons for:

- `Draft Assignment`
- `Plan Assignment`
- `Explain Requirements`
- `Study From This`

These should be positioned as quick-launch actions, not as inline result panels.

### Assignment Body

Below the AI actions, render the assignment instructions/body from:

- `detail.source.description`

Behavior:

- If `source.description` exists, render it as the main content area.
- If `source.description` is empty or missing, show a friendly empty state explaining that full assignment instructions were unavailable.
- If `html_url` exists, the empty state should include an `Open in Canvas` fallback action.

## Data Flow

### Source Of Truth

The authoritative detail response remains the existing RPC:

- `canvas.getAssignmentDetails`

Current result shape:

- `course`
- `item`
- `source`
- optional `grade`

This pass should treat `source.description` as the primary assignment body.

### Preview-Then-Hydrate Model

Use a two-step model:

1. Dashboard click passes lightweight preview state into navigation.
2. Assignment page fetches fresh detail data on mount.

Benefits:

- fast-feeling transition
- immediate usable header
- fresh Canvas-backed body content
- no need to build a heavier shared cache first

### Fetch Parameters

The detail page should prefer calling `canvas.getAssignmentDetails` with the assignment's stored `htmlUrl` when available.

If the URL is unavailable, the implementation may fall back to any supported identifier combination already accepted by the RPC, but URL-first should be the default path.

### UI State Module

Do not bury all fetching logic directly inside the page component.

Add a small assignment-detail state/helper module on the UI side that handles:

- loading state
- successful detail value
- recoverable error state
- retry behavior

This keeps the route component thin and easier to test.

## AI Quick Actions

### Interaction Model

Each AI quick action should create a new chat thread rather than rendering AI output inline on the assignment page.

This matches the existing product direction for richer AI workflows and keeps the detail page focused on reading and launching work.

### Seeded Context

Each action should generate a prompt that includes:

- assignment title
- course name or code
- due date
- submission status
- points possible
- grade if present
- fetched assignment body from `source.description` when available

If the description is unavailable, the prompt should still launch with the available metadata and note that full assignment instructions were not available from Canvas.

### Action Intent

The initial shipped actions should behave as follows:

- `Draft Assignment`
  - asks the assistant to help produce a working first draft or solution approach for the assignment
- `Plan Assignment`
  - asks the assistant to break the assignment into concrete execution steps and time blocks
- `Explain Requirements`
  - asks the assistant to summarize the prompt and identify what is actually being asked
- `Study From This`
  - asks the assistant to convert the assignment into a study or review aid

The page does not need a custom AI orchestration system in this pass. It only needs to map each button to a seeded thread creation flow.

## Error Handling And Empty States

### Detail Fetch Failure

If the detail fetch fails:

- keep the page shell visible
- keep the summary header visible using preview state
- show a recoverable error message in the body section
- offer retry
- show `Open in Canvas` when available

### Missing Description

If detail fetch succeeds but `source.description` is missing:

- show the normal summary header
- show AI quick actions
- show an empty-state message for the body region
- keep `Open in Canvas` available when possible

### Missing Preview State

If a user lands directly on the route without navigation state:

- the page should still attempt to resolve details from the route param plus any locally available assignment data
- if the preview fields are unavailable, use a skeleton or generic loading header until the detail fetch resolves

This should not block direct-link support.

## Component Boundaries

Recommended units:

- assignment detail route/page component
- assignment summary header component
- assignment AI quick actions component
- assignment body/content component
- assignment detail state/helper module

The goal is to keep responsibilities clear:

- route handles navigation and composition
- state module handles fetch lifecycle
- presentational components render header, actions, and content

## Testing

Add or update tests to cover:

- clicking a dashboard assignment card navigates to the assignment detail route
- preview state renders immediately on first paint
- hydrated detail page renders `source.description` when present
- breadcrumb displays `Assignments > {assignment title}`
- AI quick actions create a new chat thread with seeded assignment context
- empty-state behavior when `source.description` is absent
- recoverable error state when detail fetch fails

## Rollout Risk

Risk is moderate but manageable.

Main risks:

- mismatch between preview data and fetched detail data
- Canvas detail bodies that are sparse or inconsistently formatted
- overloading the page if too many AI affordances compete with the assignment content

Mitigations:

- use preview only for fast initial render, then prefer hydrated detail
- keep the AI action strip compact and secondary to the summary header
- treat missing description as a valid state, not an error

## Implementation Notes

- Keep the first version narrow and readable.
- Use the existing `canvas.getAssignmentDetails` contract instead of inventing a new backend route.
- Use the current router and breadcrumb plumbing rather than building a custom header system.
- Use the current thread creation flow for AI actions.
- Do not block this feature on richer Canvas extras. Those can be added in a later pass once the dedicated assignment page exists.
