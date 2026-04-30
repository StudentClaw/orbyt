# Onboarding Hero Copy Redesign

**Date:** 2026-04-30
**Surfaces:**
- `WelcomeSplit` in `packages/ui/src/components/onboarding/phases/DnaDiscoveryPhase.tsx` (lines 309-384) — left pane copy
- Phase-label area in `OnboardingWizard.tsx` (around line 277) — right pane subline

**Scope:** Copy changes on the left pane, a light type-scale bump (everything goes bigger to fill available space), and small label changes on the right pane (new top label with progress percentage, conditional subline below the DNA visual). No new components, no layout overhaul.

## Problem

The first screen of the onboarding wizard — the hero shown before the DNA survey starts — is too vague. It tells the user there are "{N} questions" leading to a "Study DNA" but never explains:

1. **What Orbyt actually is** (what does the app do?)
2. **Why we are asking the survey questions** (what does the survey personalize?)

Current copy:

```
Eyebrow:   Building your study profile
Headline:  {N} questions. One Study DNA.
Body:      Your answers build something alive on the right —
           revealed at the end. No right or wrong.
CTA:       Start →
Footer:    Takes about 3 minutes.
```

This trades clarity for mystery. A first-time user who doesn't already know what Orbyt is gets no anchor.

## Goal

Replace the hero copy so a new user, in roughly 5 seconds of reading, understands:

- Orby is their AI study coach / partner
- The app plans their week from Canvas and coaches them through it
- The next questions exist to personalize (a) the AI tutor's style and (b) the schedule around their focus hours

## Voice

**Product voice, not Orby's voice.** This page introduces Orby; it is not Orby speaking.

- Sentence case, normal punctuation (em dashes allowed here)
- No emojis
- Warm but informational — closer to a product onboarding tone than a marketing landing tone

The Orby voice rules (gen-z lowercase, no dashes, no emojis) do not apply to this surface. Those rules continue to apply everywhere Orby actually speaks (notifications, insights, in-app reactions).

## Final Copy

```
Eyebrow:   Meet your study coach        (rendered uppercase via CSS)
Headline:  Meet Orby.
           Your AI study
           partner.
Body:      Orby plans your week from Canvas, coaches you
           through assignments, and adapts to how you
           actually study. The next {N} questions teach it
           your learning style and when you focus best —
           so the plan is yours, not a generic one.
CTA:       Say Hi →
Footer:    {N} questions · ~3 minutes
```

Source strings are in sentence case. The eyebrow's `textTransform: "uppercase"` style (already in `WelcomeSplit`) renders it visually as `MEET YOUR STUDY COACH`. Do not change the source string to all caps — the CSS handles presentation.

### Field-level rules

- **Eyebrow:** Uppercase, monospace, letter-spaced (existing eyebrow style). String literal.
- **Headline:** Three rendered lines. Existing layout already wraps the second half in an italic gradient `<em>`. The italic span continues to wrap the bottom two lines:
  - Line 1: `Meet Orby.`
  - Line 2 (gradient italic): `Your AI study`
  - Line 3 (gradient italic, continuation): `partner.`
- **Body:** Single paragraph. Em dash retained as written. `{N}` is the existing `questionCount` prop interpolated into the string.
- **CTA:** Button label `Say Hi →` (arrow glyph kept as plain text per existing convention). Frames the click as the start of the conversation with Orby — short, warm, and consistent with the "Meet Orby" headline.
- **Footer:** `{N} questions · ~3 minutes` — replaces the current generic "Takes about 3 minutes." Adds the question count for transparency. Uses a middle-dot separator (U+00B7) consistent with the rest of the wizard's metadata rows.

## Right-Pane Labels

The right pane currently shows only one label — a small phase tag positioned at the bottom of the column reading `Study DNA` (rendered uppercase via CSS, source at `OnboardingWizard.tsx:230` and rendered at `:277`).

Two changes on this pane:

### 1. Top label (above the DNA visual) — replaces and relocates the existing phase label

```
STUDENT DNA · 0% COMPLETE
```

- Source string (literal): `Student DNA · {pct}% complete`
- `{pct}` is computed from onboarding answers: `Math.round((answeredCount / activeQuestions.length) * 100)`. On the hero step (`answeredCount === 0`) it renders `0%`. After the final answer, it renders `100%`.
- Position: above the DNA companion (above `MysteryNebula` during `dna-discovery`, above `DNACard` during the post-DNA phases).
- Style: same mono / letter-spaced / uppercased style the existing phase label uses, just bumped one step in size to match the new type scale.
- Naming note: the existing source label is `Study DNA` (used in `ONBOARDING_STEPS` and as a `phaseLabel` fallback). The user requested `Student DNA` here. Treat this as a deliberate rename for this label only; do not rename `ONBOARDING_STEPS[0].label` or any other reference.

### 2. Bottom subline (below the DNA visual) — new, hero-only

```
waiting to get to know you
```

- Source string (literal, lowercase as written): `waiting to get to know you`
- Style: smaller than the top label, dim (`color: T.textFaint`), mono, letter-spaced, NOT uppercased — keep source case as-is so it reads as a soft caption rather than a UI chrome label.
- Visibility rule: shown only while `phase === "dna-discovery"` AND `answeredCount === 0`. Once the user submits the first answer, this subline disappears so the right pane focuses on the live nebula progress filling up.

Both changes touch `OnboardingWizard.tsx` (the phase-label render block around line 268-280), not `WelcomeSplit`.

## Type Scale (bigger, fills available space)

Both panes have plenty of unused vertical room on a normal desktop window. Bumping the scale across the hero and the right-pane labels.

### Left pane (`WelcomeSplit`)

| Slot | Before | After |
|------|--------|-------|
| Eyebrow | `fontSize: 11`, `letterSpacing: 0.2em` | `fontSize: 13`, `letterSpacing: 0.22em` |
| Headline | `fontSize: 72`, `lineHeight: 1.02` | `fontSize: 88`, `lineHeight: 1.0` |
| Body | `fontSize: 17`, `lineHeight: 1.6`, `maxWidth: 440` | `fontSize: 20`, `lineHeight: 1.55`, `maxWidth: 520` |
| CTA label | `fontSize: 18`, padding `18px 40px` | `fontSize: 20`, padding `20px 44px` |
| Footer | `fontSize: 12` | `fontSize: 14` |

These are starting values; final visual tuning may nudge by ±2px during implementation. The spirit is "noticeably bigger" without breaking the existing rhythm — the headline gains the most weight, body and CTA gain enough to feel intentional.

### Right pane (in `OnboardingWizard.tsx`)

| Slot | Before | After |
|------|--------|-------|
| Top label `Student DNA · {pct}% complete` | (was `fontSize: 10` bottom label) | `fontSize: 13`, mono, uppercase, `letterSpacing: 0.22em` |
| Bottom subline `waiting to get to know you` | (new) | `fontSize: 11`, mono, `letterSpacing: 0.18em`, dim, NOT uppercased |

## What Stays the Same

- Component structure of `WelcomeSplit`
- Layout grid (1.15fr / 1fr two-column wizard, gradient backgrounds, particle layer)
- Color tokens and gradient palette on the italic span
- Font families (serif for headline, mono for chrome)
- The `questionCount` prop signature and how `WelcomeSplit` is invoked from `DnaDiscoveryPhase`
- The `MysteryNebula` and `DNACard` components themselves — only the framing labels around them change

## What Changes — Summary

Three categories of change:

**1. Left-pane copy (in `WelcomeSplit`):**

| Slot | Before | After |
|------|--------|-------|
| Eyebrow | `Building your study profile` | `Meet your study coach` (rendered uppercase) |
| Headline line 1 | `{N} questions.` | `Meet Orby.` |
| Headline lines 2-3 (italic gradient) | `One Study DNA.` | `Your AI study` / `partner.` |
| Body | `Your answers build something alive on the right — revealed at the end. No right or wrong.` | `Orby plans your week from Canvas, coaches you through assignments, and adapts to how you actually study. The next {N} questions teach it your learning style and when you focus best — so the plan is yours, not a generic one.` |
| CTA | `Start →` | `Say Hi →` |
| Footer | `Takes about 3 minutes.` | `{N} questions · ~3 minutes` |

The body now interpolates `questionCount`, which it didn't before. The headline drops the count interpolation it currently uses. Net effect on prop usage: `questionCount` is still consumed in the body (replacing its previous use in the H1), plus a new second use in the footer.

**2. Right-pane labels (in `OnboardingWizard.tsx`):** see the Right-Pane Labels section above. Existing bottom phase label is replaced and relocated to a top label `Student DNA · {pct}% complete`; a new conditional bottom subline `waiting to get to know you` is added for the hero step only.

**3. Type scale (both panes):** see the Type Scale section above. All copy slots step up to fill available space.

## Testing

The existing test file `packages/ui/src/__tests__/OnboardingWizard.test.tsx` does not assert on the hero strings. After the copy swap:

- Add or update a render test for `WelcomeSplit` (or for `DnaDiscoveryPhase` at `step === 0` with empty answers) asserting the new headline `Meet Orby.` and CTA `Say Hi` are present.
- Verify the body interpolates the question count by passing a known count and asserting the rendered substring `The next 11 questions` (or whatever the test's count is).
- No snapshot changes expected beyond the copy diff.

Existing onboarding integration tests should continue to pass — they trigger the wizard by clicking the start CTA, so any test that selected the button by its old `Start` text needs to be updated to the new label.

## Out of Scope

- Layout grid changes (the two-column wizard layout, particle background, gradient panels stay as-is)
- The `MysteryNebula` and `DNACard` internals — only the framing labels around them change
- Other onboarding phases (`ActiveHoursPhase`, `BusyGridPhase`, `AiConnectPhase`, `CanvasSyncPhase`, `LaunchPhase`)
- Marketing site, App Store screenshots, or any non-app surface
- Any change to the survey questions themselves
- Localization — copy is English-only, matching the rest of the app today
- Renaming `Study DNA` anywhere except the new top-label string (`ONBOARDING_STEPS[0].label`, the `phaseLabel` fallback, and any other reference stay as `Study DNA`)

## Acceptance Criteria

1. A first-time user landing on the onboarding wizard sees the new copy as written above.
2. The `questionCount` value renders correctly in both the body and the footer.
3. The italic-gradient span continues to apply to the bottom two headline lines.
4. The button labeled `Say Hi →` advances the wizard to step 1 (first DNA question), unchanged behavior.
5. Existing onboarding tests are updated to reference the new CTA label and pass.
6. The right-pane top label reads `Student DNA · {pct}% complete` with `{pct}` updating live as the user answers questions (`0%` on the hero step → `100%` after the final answer).
7. The right-pane bottom subline `waiting to get to know you` renders under the DNA visual only on the hero step (before any questions answered) and disappears as soon as the first answer is submitted.
8. Type sizes match the new scale documented in the Type Scale section, with the left pane noticeably larger than today on a default desktop window size.
