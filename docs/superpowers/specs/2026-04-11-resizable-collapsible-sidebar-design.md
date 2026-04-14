# Resizable Collapsible Sidebar Design

Date: 2026-04-11
Status: Approved in chat, pending implementation

## Goal

Make the desktop app sidebar:

- resizable by dragging,
- fully collapsible so it disappears from view,
- restorable with a persistent top-left trigger,
- consistent across all routed pages, and
- persistent in its last chosen desktop width across app restarts.

## Non-goals

- No redesign of sidebar content or information architecture
- No icon-rail collapsed state
- No mobile sidebar interaction rewrite
- No per-page custom sidebar widths
- No backend or database changes

## Problem Summary

The current shell uses the existing sidebar primitives and supports open or closed state, but desktop width is fixed and the layout does not take advantage of the repo's existing resizable panel primitives.

This creates two UX gaps:

1. Users cannot widen or narrow the sidebar based on the amount of navigation content.
2. Sidebar collapse behavior is not paired with a strong, always-visible restoration affordance in the shared shell.

The repo already includes both pieces needed for this pass:

- a shared sidebar implementation in `packages/ui/src/components/ui/sidebar.tsx`,
- a shared resizable wrapper in `packages/ui/src/components/ui/resizable.tsx`.

This should be solved as a shell integration pass rather than as a new sidebar system.

## Approved Behavior

### 1. Desktop resizing

- On desktop, the sidebar sits inside a horizontal resizable panel group.
- Users can drag the separator between the sidebar and main content to resize the sidebar.
- Desktop width is clamped to:
  - minimum `240px`
  - default `320px`
  - maximum `480px`
- The most recent desktop width persists locally and is restored on the next app launch.

### 2. Desktop collapse

- On desktop, collapsing the sidebar hides it completely.
- The collapsed state is not an icon rail and does not leave navigation icons visible.
- When collapsed, the resize handle is also hidden.
- Existing keyboard toggle behavior remains supported.

### 3. Restore trigger

- A persistent top-left trigger is rendered in the shared shell chrome, not inside individual pages.
- The trigger remains available while the sidebar is collapsed.
- The trigger uses the same sidebar toggle action as keyboard shortcuts and any other sidebar controls.
- Reopening the sidebar restores it at the last saved desktop width.

### 4. Mobile behavior

- Mobile continues using the current sheet-based sidebar behavior.
- This pass does not change mobile layout, sizing, or interaction patterns beyond preserving compatibility with the shared sidebar state.

## Architecture

### Shell ownership

`AppShell.tsx` becomes the owner of desktop layout composition.

On desktop, it should:

- render a `ResizablePanelGroup` with horizontal orientation,
- place `AppSidebar` in the left panel,
- place routed page content in the right panel,
- render the persistent top-left sidebar trigger in the main content shell.

On mobile, it should keep using the current `Sidebar` sheet behavior through the existing sidebar primitives.

### Sidebar ownership

`SidebarProvider` remains the source of truth for sidebar visibility state:

- `open` / `collapsed` behavior stays in the sidebar context,
- keyboard shortcut support remains there,
- mobile open state remains there.

Resize state is separate from visibility state:

- width belongs to the desktop shell layout,
- open/closed belongs to the sidebar provider.

This keeps responsibilities clear and avoids turning the sidebar primitive into a full layout manager.

## State and Persistence

### Collapse state

- Keep the existing sidebar open/closed persistence behavior already implemented by `SidebarProvider`.
- Do not introduce a second collapse state store for this pass.

### Width state

- Store the desktop sidebar width in `localStorage` using an app-specific key.
- Persist the width as a pixel value so the product requirement stays expressed in real sidebar width, not panel percentage.
- Read the stored width on shell mount.
- If the stored value is missing or invalid, fall back to `320px`.
- Clamp restored and newly saved widths to the approved min/max range.
- When wiring that value into `react-resizable-panels`, `AppShell` should translate the pixel width into the panel sizing model based on the current desktop container width.

## UI Composition

### Main shell

- Add a small shared header strip or shell control row at the top of the main content area.
- Place the sidebar trigger at the top left of this shell area so it is consistently reachable across routes.
- Keep the routed page content below or beside that control region without requiring each page to own sidebar controls.

### Sidebar panel

- Render `AppSidebar` inside the resizable left panel.
- Keep existing sidebar internals, including navigation, chat history, footer actions, and theming controls.
- Do not redesign `AppSidebar` content in this pass.

### Resize handle

- Use the shared resizable handle component between sidebar and content.
- Style it to feel intentional but low-noise.
- Hide it when the sidebar is collapsed so the hidden state feels fully dismissed.

## Error Handling and Edge Cases

- If `localStorage` is unavailable or throws, the app should continue using the default width without crashing.
- If a persisted width is malformed, ignore it and restore the default width.
- If the sidebar is collapsed, reopening should restore the prior valid width instead of resetting.
- If viewport constraints make the stored width too large, clamp it safely within the approved range.
- Mobile should ignore desktop width persistence values.

## Testing Plan

### Shell behavior

- `AppShell` renders the sidebar and routed content in the shared layout.
- A persistent top-left trigger is visible in the shell.
- Toggling the trigger collapses and restores the sidebar.

### Persistence

- The desktop sidebar defaults to `320px` when no stored width exists.
- A stored width is restored on mount.
- Invalid stored widths fall back to the default.
- Resized widths are clamped and persisted.

### Regression coverage

- Existing sidebar content still renders inside the resizable panel.
- Mobile keeps using sheet-based behavior.
- Keyboard toggle behavior still works through the existing sidebar provider.

## Risks and Mitigations

### Mixed ownership between width and open state becomes confusing

Mitigation:

- keep `SidebarProvider` responsible only for visibility state,
- keep shell layout responsible only for width and panel composition.

### The shell trigger interferes with page layouts

Mitigation:

- render it in a small shared shell control region instead of overlaying arbitrary page content,
- keep spacing minimal and consistent.

### Resize persistence becomes brittle

Mitigation:

- validate and clamp stored values before use,
- gracefully degrade to the default width when storage is unavailable.

## Expected Deliverables

- Desktop sidebar can be resized by dragging
- Desktop sidebar fully disappears when collapsed
- A persistent top-left trigger restores the sidebar
- Desktop sidebar width persists locally with a `320px` default
- Mobile sidebar behavior remains unchanged
