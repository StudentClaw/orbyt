# Feature 8: Onboarding

## What It Is

Onboarding is the first-run experience that transforms a freshly installed Orbyt from an empty app into a fully connected, personalized academic assistant. It walks the student through Canvas credentials, AI authentication, extension setup, preferences, and a first sync with guided walkthrough.

---

## Why It Exists

Orbyt requires setup that most students aren't accustomed to — generating API tokens, authorizing AI services, understanding what MCP plugins are. Onboarding must make this painless. A confused student who can't get past setup is a lost user. The goal is: **installed to productive in under 5 minutes**.

---

## Dependencies

This is the most dependent feature — it touches almost everything.

```
Canvas Integration ──→ Onboarding (credential setup, first sync)
AI Harness ──────────→ Onboarding (Codex CLI auth flow)
Plugin System ───────→ Onboarding (extension discovery and installation)
Memory System ───────→ Onboarding (initial preference storage)
Dashboard ───────────→ Onboarding (walkthrough of populated Dashboard)
Shared Contracts ────→ Onboarding (StudentPreference, OnboardingState schemas)
```

| Depends On | Why |
|---|---|
| **Canvas Integration** | Needs Canvas MCP to validate token and run first sync |
| **AI Harness** | Needs Codex CLI to authenticate via ChatGPT OAuth (v1 required) |
| **Plugin System** | Extension recommendations require the plugin registry |
| **Memory System** | Saves student preferences, routines, and course priorities via mem0 |
| **Smart Planner** | First plan generation runs after onboarding completes |
| **Dashboard** | Walkthrough shows the student their freshly populated Dashboard |

| Depended On By | Why |
|---|---|
| Nothing directly — Onboarding is the entry point | Everything else assumes setup is complete |

---

## Onboarding Flow

### Step 1: Welcome

A warm, non-intimidating welcome screen.

- Brief explanation: "Orbyt connects to your Canvas and helps you plan your academic life."
- Set expectations: "Setup takes about 3-4 minutes."
- Privacy assurance: "Your data stays on your computer. Nothing is sent to us."

### Step 2: Canvas Connection

The most critical step. Students need to generate a Canvas personal access token.

**The challenge**: Most students have never generated an API token. This step needs hand-holding.

**Guided flow:**
1. **Institution selector**: Select your university from a searchable list powered by a `universities.json` file bundled with the app (updated with each release), or enter the Canvas URL manually (e.g., `https://canvas.myuniversity.edu`)
   - Validate the URL is a real Canvas instance via a test request
2. Show step-by-step instructions with screenshots:
   - "Click your profile picture → Settings"
   - "Scroll to Approved Integrations"
   - "Click + New Access Token"
   - "Name it 'Orbyt', **leave the expiry date blank**, and click Generate Token"
   - "Copy the token (you won't see it again!)"
3. Paste the token into Orbyt
4. Validate by making a test API call (`GET /api/v1/users/self`)
5. Show success: "Connected! Found [name] at [university]"

**Error handling:**
- Invalid token → "That token doesn't seem to work. Let's try again."
- Wrong URL → "We couldn't find Canvas at that address. Double-check your university's Canvas URL."
- Token expired → Explain how to generate a new one

### Step 3: AI Authentication

Connect to the LLM that powers Orbyt's intelligence. **This step is required — AI is the core of the app.** Students must connect before proceeding.

**ChatGPT Subscription via Codex CLI (only path)**
- Requires a ChatGPT Plus, Pro, or Team subscription
- Browser-based OAuth via bundled Codex CLI — no API keys, no billing configuration
- If the student doesn't have a subscription, surface a link to sign up for ChatGPT Plus before continuing


### Step 4: Preferences

Quick preference collection to personalize the experience from day one.

- **Study schedule**: "When do you usually study?" (morning/afternoon/evening/night)
- **Max study duration**: "How long can you study in one sitting?" (30min / 1hr / 2hr / custom)
- **Off-limit days**: "Any days you don't study?" (multi-select)
- **Course priorities**: After first sync, show discovered courses — "Rank these by importance to you"
- **Calendar**: "Do you use Apple Calendar, Google Calendar, or something else?"
- **Notification preferences**: "How should we alert you about upcoming deadlines?" + quiet hours

These are saved to the Memory System via mem0 with `agent_id="preferences"`.

### Step 5: Routines

Capture the student's recurring weekly schedule so the Smart Planner knows when they're available.

- **Recurring blocks**: Manual entry of weekly commitments (class times, work shifts, gym, other commitments)
- **Import option**: If a calendar MCP is installed, offer to import existing calendar events (deferred for v1 — manual entry only)
- **Visual display**: Show a weekly grid preview so the student can verify

Routines are stored in mem0 with `agent_id="routines"`.

### Step 6: First Sync and Memory Population

Run the initial Canvas sync and populate the Memory System.

- Progress indicator: "Discovering your courses... Found 5 courses"
- "Fetching assignments... Found 23 upcoming assignments"
- "Checking grades... Retrieved grades for all courses"
- Show a summary card of what was imported

**Initial memory population:**
- Canvas sync writes course data to mem0 (`agent_id="course_*"` for each discovered course)
- Preferences and routines from steps 4-5 are already stored in mem0
- Profile compiler runs to generate the initial student profile context
- First Smart Planner run generates the student's initial weekly plan

### Step 7: Extension Recommendations

After sync, suggest plugins based on the student's actual discovered courses and calendar preference.

- Canvas MCP is already installed (required)
- If they use Google Calendar → recommend `calendar-mcp`
- If they use Notion → recommend `notion-mcp`
- If discovered courses include CS/programming subjects → recommend `github-mcp`
- Other course-based signals can drive future recommendations as the plugin registry grows
- "You can always add more extensions later from the Extension Manager"

### Step 8: Dashboard Walkthrough

Guided tour of the now-populated Dashboard. The AI speaks live — not scripted — using the student's real pre-generated plan and actual course data.

- Tooltip overlays highlight each Dashboard section
- The AI introduces itself and narrates the student's real plan: "Here's what I've put together for you this week based on your courses and schedule..."
- The AI explains its reasoning for specific study blocks ("I scheduled your CHEM exam prep on Tuesday because that's when you said you study best")
- Student can ask follow-up questions right here — the chat is live from this moment on
- Ends with: "You're all set — ask me anything anytime."

The first AI call happens here, using the pre-generated plan from Step 6 as context. No scripted copy — the student's actual data drives everything.

---

## Semester Prompt

When Canvas sync detects a new semester (course roster changes >50% or a new term ID appears), show a lightweight one-screen prompt — not the full wizard.

- "Looks like a new semester — want to update your schedule and priorities?"
- Lets the student update: routines, off-limit days, course priorities
- Takes ~60 seconds; skippable
- Triggered once per detected new term, not on every sync

---

## Resume and Skip Logic

Students should be able to:
- **Skip ahead**: "I'll set this up later" at any step except Canvas and AI Authentication — both are required to use the app
- **Resume**: If they close during onboarding, resume where they left off
- **Redo**: Access individual setup steps from Settings after onboarding is complete. Re-running Canvas auth only updates the stored token — it does not trigger a re-sync. Re-sync is a separate explicit action ("Sync now") on the Canvas settings page.

**Onboarding state** is tracked in SQLite:
```
onboarding_state
  step, status (pending/completed/skipped), completedAt
```

On resume: jump directly to the first non-completed step. For Canvas and AI auth steps specifically, re-run validation if `completedAt` is older than 24 hours — otherwise treat them as already passed.

---

## Design Principles

- **Progressive disclosure**: Don't overwhelm with everything at once. One step at a time.
- **Visual guidance**: Screenshots and animations showing exactly where to click in Canvas.
- **Error recovery**: Every error has a clear, friendly message and a path forward.
- **Speed**: The whole flow should take under 5 minutes. Respect the student's time.
- **Trust building**: Explain what data is being accessed and why, at each step.
- **i18n-ready**: All onboarding strings live in `i18n/en.json`. English-only for v1 — add languages once usage data shows which matter most.

---

## Technology

| Library | Purpose |
|---|---|
| React step-wizard component (or custom stepper) | Multi-step wizard UI with progress indicator |
| Electron `shell.openExternal` | Open browser for ChatGPT OAuth redirect |
| Codex CLI (bundled) | Handles ChatGPT subscription auth — shipped inside the Electron app, no student install required |
| Screenshot/GIF assets | Visual guides for Canvas token generation (generic + per-institution if possible) |

---

## Proposed File Structure

```
packages/ui/src/components/onboarding/
  OnboardingWizard.tsx              # Step container with progress indicator
  WelcomeStep.tsx                   # Step 1: Welcome and privacy info
  InstitutionSelector.tsx           # Step 2: Searchable university list + manual URL
  CanvasCredentialStep.tsx          # Step 2: Canvas URL + token guide
  CanvasTokenGuide.tsx              # Visual step-by-step token generation guide
  AiAuthStep.tsx                    # Step 3: ChatGPT OAuth auth gate
  PreferencesStep.tsx               # Step 4: Study schedule, priorities
  RoutinesStep.tsx                  # Step 5: Weekly recurring blocks input
  FirstSyncStep.tsx                 # Step 6: Initial Canvas sync + memory population
  ExtensionRecommendations.tsx      # Step 7: Suggested plugins based on discovered courses
  DashboardWalkthrough.tsx          # Step 8: Guided tour + plan-mode demo
  SemesterPrompt.tsx                # Lightweight new-semester update screen (routines + course priorities)

packages/server/src/onboarding/
  OnboardingService.ts              # Effect service: state tracking, validation
  CanvasValidator.ts                # Validate Canvas URL and token
  AiAuthValidator.ts                # Validate Codex CLI connection
  InitialPopulation.ts              # Populate mem0 with first sync data + run profile compiler
```

---

## Future Considerations

- **Token longevity**: Canvas personal access tokens don't expire by default — guide students to leave the expiry blank during token generation. If a 401 is ever detected post-onboarding, show a persistent banner with a direct reconnect flow. Explore whether Canvas offers any refresh mechanism to avoid manual reconnection entirely.
- **Accessibility** (post-V1): Full WCAG 2.1 AA compliance — keyboard navigation, focus trapping in the step wizard, ARIA live regions for sync progress, screen reader announcements on step transitions. Use standard HTML form elements in v1 to minimize retrofit cost later.
