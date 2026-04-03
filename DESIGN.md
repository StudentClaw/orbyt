# DESIGN

## Design North Star

Student Claw should feel calm, focused, and intelligent. The interface should prioritize clarity, velocity, and trust over ornament.

## Interface Model

- The primary surface is a chat interface.
- AI UI artifacts (plans, summaries, schedules, checklists, status cards) are first-class outputs.
- Supporting surfaces (dashboard, panels, modals) should reinforce the chat workflow, not compete with it.

## Visual Language

- Use a minimal, modern aesthetic aligned with shadcn UI.
- Keep information density high but readable.
- Rely on spacing, typography, and hierarchy before adding visual decoration.
- Use motion sparingly and only when it improves comprehension.

## Baseline UI Stack

Use shadcn UI as the default component foundation with this preset:

```bash
bunx --bun shadcn@latest init --preset b3RXNlzf8 --template vite
```

## Interaction Principles

- Prefer progressive disclosure over crowded screens.
- Make primary actions obvious; keep destructive actions explicit.
- Keep state visible (loading, syncing, success, failure, stale data).
- Preserve continuity between chat intent and resulting UI artifacts.

## Artifact Quality Rules

Every AI-generated artifact should be:

- Actionable (clear next steps).
- Editable (student can adjust without friction).
- Traceable (shows source context or assumptions).
- Reusable (can feed the next planning/execution step).

## Accessibility and Usability Baseline

- Maintain strong contrast and readable type scales.
- Support keyboard-first navigation for core workflows.
- Avoid ambiguous icon-only actions without labels or tooltips.

## Consistency Rules

- Reuse existing component patterns before introducing new variants.
- Keep naming and wording consistent across chat, dashboard, and settings.
- Favor a small set of composable primitives over one-off bespoke components.

ALWAYS USE COMPONENTS IN `packages/ui/src/components/ui`

