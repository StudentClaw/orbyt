# Plugin Management Grid And Detail Design

Date: 2026-04-21
Status: Approved in chat, pending spec review

## Goal

Redesign the Settings plugin manager so plugin discovery and configuration feel like a real product surface instead of a utility list.

The new experience should:

- replace avatar initials with Hugeicons-based plugin marks,
- present plugins in a responsive minimal card grid,
- remove the current modal dialog flow,
- navigate into dedicated plugin detail pages with breadcrumbs like `Plugins > Canvas Assistant`,
- show plugin metadata, configuration controls, runtime status, and exposed tools in the detail view.

## User Intent

The current plugin manager is functional but visually dense and interaction-heavy:

- list rows feel administrative rather than intentional,
- the modal interrupts browsing and makes comparison awkward,
- avatar initials do not communicate plugin type or identity well,
- the layout does not scale elegantly as more plugins are discovered.

The user wants a cleaner layout, less chrome, stronger rhythm, and a route-based detail view that feels native to the app.

## Non-goals

- No redesign of the overall Settings shell outside the plugin management surface
- No backend or IPC contract changes for plugin discovery/auth unless needed for missing data
- No redesign of the Skills detail model in this pass
- No separate top-level `/plugins` app area
- No plugin installation marketplace flow

## Chosen Approach

Use real nested settings routes for plugin management.

### Why this approach

It supports the requested breadcrumb structure directly:

- `/settings/plugins`
- `/settings/plugins/$pluginId`

This preserves browser history, supports direct linking, keeps the user inside Settings, and removes the awkward statefulness of the current dialog model.

## Alternatives Considered

### 1. Keep everything on `/settings` and fake page navigation with local state

Pros:

- smaller implementation surface,
- fewer router changes.

Cons:

- no real URLs,
- brittle refresh/back behavior,
- breadcrumb would be visual only,
- detail state would remain tightly coupled to one large component.

Rejected because it does not fully satisfy the requested navigation model.

### 2. Move plugins to a top-level app area outside Settings

Pros:

- room to expand into a larger plugin hub later.

Cons:

- breaks the intended `Plugins > [Plugin]` flow inside Settings,
- introduces broader navigation churn than necessary.

Rejected because it over-scopes the change.

## UX Design

### Visual thesis

A quieter, icon-led plugin management surface with stronger spatial rhythm, fewer container treatments, and detail pages that read like product configuration pages rather than dialogs.

### Layout thesis

- Search first, filters second, content third
- Grid at the index level, stacked sections at the detail level
- Tight grouping inside cards, generous separation between page sections

### Interaction thesis

- Plugin cards navigate directly to detail pages
- Breadcrumbs and browser history replace modal open/close behavior
- Actions stay close to the top of the detail page so important controls remain immediately accessible

## Information Architecture

### Routes

Add the following Settings routes:

- `/settings/plugins`
- `/settings/plugins/$pluginId`

The existing `/settings` route remains, but plugin management should use route-backed state rather than local section-only state.

### Breadcrumbs

Plugin detail pages should show:

- `Plugins > {Plugin Name}`

Example:

- `Plugins > Canvas Assistant`

This breadcrumb belongs inside the plugin detail view header area.

### Scope of routed detail

This routed detail view applies to plugin and MCP entries. Skills remain in the searchable registry view for this pass and do not get dedicated routed detail pages.

## Index Page Design

### Controls

At the top of the plugin index:

- search field,
- tab filters for `Plugins`, `MCPs`, and `Skills`.

These controls should remain vertically stacked.

### Plugin grid

Replace the plugin list rows with a responsive grid.

Recommended CSS shape:

- `grid`
- `gap-4` or `gap-5`
- `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`

This should scale from one column on narrow widths to multiple columns on larger widths without explicit breakpoint-heavy logic.

### Plugin cards

Cards should be minimal and flatter than the current dialog-launch rows.

Each plugin card should include:

- Hugeicon-based plugin icon,
- plugin name,
- short description,
- compact metadata line or chips,
- status/readiness,
- enable switch.

Cards should avoid:

- large avatar blocks,
- nested containers,
- extra descriptive paragraphs beyond the core summary,
- modal affordances.

The whole card body should behave like a navigation target, while the enable switch remains an inline control.

### Card metadata

Show a restrained amount of scannable metadata such as:

- plugin vs MCP,
- install source,
- version,
- tool count,
- auth status when useful.

Do not overload the index card with credential fields, readiness explanation copy, or long error text.

## Icon Strategy

Replace avatar initials with Hugeicons from the existing icon package.

### Rules

- Use one stable icon per plugin type or source when no custom plugin icon exists
- Invalid entries should use a warning/error-appropriate icon
- MCP entries should get a visually distinct but consistent system icon
- Skills may continue using lightweight treatment in the list for this pass

### Implementation preference

Create a small helper that maps a plugin entry to a Hugeicons glyph and accent treatment so the logic is reusable across the index and detail views.

## Detail Page Design

### Header

The plugin detail page should open with:

- breadcrumb,
- icon,
- plugin name,
- concise description,
- key badges: status, readiness, type, source, version, tool count.

Primary controls should live near the header:

- enable/disable,
- sync for Canvas when applicable,
- save credentials when applicable.

### Sections

The detail page should support the following sections, shown only when relevant:

#### 1. Overview

Contains:

- description,
- plugin id,
- version,
- transport type or manifest summary,
- install source.

#### 2. Credentials

Shown for manual-token plugins.

Contains:

- auth instructions,
- input fields,
- field errors,
- save action,
- auth state badge or status line.

#### 3. Readiness

Shown for no-auth plugins or runtime-gated plugins.

Contains:

- readiness explanation,
- lifecycle state,
- retry/grant/enable/disable actions when relevant,
- runtime detail alert if needed.

#### 4. Exposed Tools

Always shown for available plugin entries.

Contains:

- list of tools exposed by the manifest,
- tool name,
- short description.

This section is required because the user explicitly asked to show what tools the plugin exposes.

#### 5. Runtime Detail

Shown only when there is an error or a surfaced runtime issue.

Contains:

- last error,
- manifest validation issue,
- runtime-specific failure details.

## Component Architecture

The current `ConnectionsSection.tsx` is doing too much. This redesign should split responsibilities.

Recommended component breakdown:

- `PluginManagerIndex`
- `PluginCard`
- `PluginIcon`
- `PluginDetailPage`
- `PluginDetailHeader`
- `PluginOverviewSection`
- `PluginCredentialsSection`
- `PluginReadinessSection`
- `PluginToolsSection`

`ConnectionsSection.tsx` should become an orchestration container for data loading and shared actions rather than the place where every index/detail rendering concern lives.

## State Model

### Router state

Use the router as the source of truth for which plugin is open.

Remove:

- dialog open state via `openPluginId`.

Replace with:

- route params for plugin detail selection.

### Shared data state

Keep the existing registry/auth/readiness data fetching patterns, but move them high enough that both the index and detail views can consume the same data source without duplication.

## Content Rules

### Index cards

Keep copy tight:

- one line for name,
- one short line for description,
- one compact metadata row.

### Detail pages

Use utility copy:

- headings like `Overview`, `Credentials`, `Exposed Tools`, `Readiness`
- no marketing tone,
- no filler explanatory banners.

## Testing Plan

### Router behavior

Add tests that verify:

- navigating to plugin detail route renders the correct breadcrumb,
- direct route load for `/settings/plugins/$pluginId` shows the correct plugin,
- going back returns to the plugin index.

### Index behavior

Add or update tests for:

- plugin cards render in the registry,
- search still filters plugin cards,
- switching tabs still filters index content.

### Detail behavior

Add tests for:

- clicking a plugin card navigates instead of opening a dialog,
- Canvas detail page shows credential fields and tool list,
- no-auth plugin detail page shows readiness content,
- invalid plugin detail page shows manifest error content.

### Regression coverage

Verify:

- enable/disable still works,
- Canvas sync still works,
- credential save still works,
- existing settings navigation remains functional.

## Risks And Mitigations

### Risk: route migration complicates the current local Settings state model

Mitigation:

- treat plugin management as the first route-backed settings section,
- keep the rest of Settings on the existing model for now,
- isolate routing logic rather than rewriting all settings sections at once.

### Risk: plugin cards become visually noisy if too much metadata is retained

Mitigation:

- limit card surface area,
- move verbose details to the detail page,
- keep the card layout icon-led and text-light.

### Risk: one giant settings component remains hard to maintain

Mitigation:

- split index and detail rendering into dedicated components,
- keep data/actions in a shared container.

## Expected Deliverables

- Hugeicons replace avatar initials in plugin cards
- Plugin registry becomes a responsive minimal card grid
- Clicking a plugin navigates to `/settings/plugins/$pluginId`
- Plugin detail pages show breadcrumb, status, controls, metadata, and exposed tools
- Dialog-based plugin management flow is removed

