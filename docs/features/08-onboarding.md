# Feature 8: Onboarding

## What It Is

Onboarding is the first-run experience that transforms a freshly installed Student Claw from an empty app into a fully connected, personalized academic assistant. It walks the student through Canvas credentials, AI authentication, extension setup, preferences, and a first sync with guided walkthrough.

---

## Why It Exists

Student Claw requires setup that most students aren't accustomed to — generating API tokens, authorizing AI services, understanding what MCP plugins are. Onboarding must make this painless. A confused student who can't get past setup is a lost user. The goal is: **installed to productive in under 5 minutes**.

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
| **AI Harness** | Needs Codex CLI to authenticate (ChatGPT subscription or API key) |
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

- Brief explanation: "Student Claw connects to your Canvas and helps you plan your academic life."
- Set expectations: "Setup takes about 3-4 minutes."
- Privacy assurance: "Your data stays on your computer. Nothing is sent to us."

### Step 2: Canvas Connection

The most critical step. Students need to generate a Canvas personal access token.

**The challenge**: Most students have never generated an API token. This step needs hand-holding.

**Guided flow:**
1. **Institution selector**: Select your university from a searchable list (populated from a maintained database of Canvas URLs), or enter the Canvas URL manually (e.g., `https://canvas.myuniversity.edu`)
   - Validate the URL is a real Canvas instance via a test request
2. Show step-by-step instructions with screenshots:
   - "Click your profile picture → Settings"
   - "Scroll to Approved Integrations"
   - "Click + New Access Token"
   - "Name it 'Student Claw' and click Generate Token"
   - "Copy the token (you won't see it again!)"
3. Paste the token into Student Claw
4. Validate by making a test API call (`GET /api/v1/users/self`)
5. Show success: "Connected! Found [name] at [university]"

**Error handling:**
- Invalid token → "That token doesn't seem to work. Let's try again."
- Wrong URL → "We couldn't find Canvas at that address. Double-check your university's Canvas URL."
- Token expired → Explain how to generate a new one

### Step 3: AI Authentication

Connect to the LLM that powers Student Claw's intelligence.

**Option A: ChatGPT Subscription (primary path)**
- "Do you have a ChatGPT Plus, Pro, or Team subscription?"
- If yes: Codex CLI auth flow (browser-based OAuth)
- This is the zero-friction path — no API keys, no billing surprises

**Option B: OpenAI API Key (alternative)**
- "Prefer to use your own API key?"
- Paste API key, validate with a test call
- Show estimated cost: "Based on typical usage, expect ~$3-5/month"

**Option C: Skip for now**
- Allow the student to explore the Dashboard with cached data but no AI features
- Prompt to complete setup when they try to use chat

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

### Step 6: Extension Recommendations

Based on the student's preferences, suggest relevant plugins.

- Canvas MCP is already installed (required)
- If they use Google Calendar → recommend `calendar-mcp`
- If they use Notion → recommend `notion-mcp`
- If they're a CS student → recommend `github-mcp`
- "You can always add more extensions later from the Extension Manager"

### Step 7: First Sync and Memory Population

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

### Step 8: Dashboard Walkthrough

Guided tour of the now-populated Dashboard, including a live demo of the plan-mode skill.

- Highlight each section with a tooltip overlay
- "Here are your upcoming deadlines..."
- "This shows your current grades..."
- "Here's your first weekly plan — we scheduled study blocks based on your preferences"
- **Plan-mode live demo**: Show the student how plan-mode works by walking through the generated plan, explaining the reasoning
- "Click here to ask the AI for help or say 'plan my week' anytime"
- "You're all set! Student Claw will sync with Canvas in the background."

---

## Resume and Skip Logic

Students should be able to:
- **Skip ahead**: "I'll set this up later" at any step (except Canvas, which is required for v1)
- **Resume**: If they close during onboarding, resume where they left off
- **Redo**: Access individual setup steps from Settings after onboarding is complete

**Onboarding state** is tracked in SQLite:
```
onboarding_state
  step, status (pending/completed/skipped), completedAt
```

---

## Design Principles

- **Progressive disclosure**: Don't overwhelm with everything at once. One step at a time.
- **Visual guidance**: Screenshots and animations showing exactly where to click in Canvas.
- **Error recovery**: Every error has a clear, friendly message and a path forward.
- **Speed**: The whole flow should take under 5 minutes. Respect the student's time.
- **Trust building**: Explain what data is being accessed and why, at each step.

---

## Technology

| Library | Purpose |
|---|---|
| React step-wizard component (or custom stepper) | Multi-step wizard UI with progress indicator |
| Electron `shell.openExternal` | Open browser for ChatGPT OAuth redirect |
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
  AiAuthStep.tsx                    # Step 3: ChatGPT subscription or API key
  PreferencesStep.tsx               # Step 4: Study schedule, priorities
  RoutinesStep.tsx                  # Step 5: Weekly recurring blocks input
  ExtensionRecommendations.tsx      # Step 6: Suggested plugins
  FirstSyncStep.tsx                 # Step 7: Initial Canvas sync + memory population
  DashboardWalkthrough.tsx          # Step 8: Guided tour + plan-mode demo

packages/server/src/onboarding/
  OnboardingService.ts              # Effect service: state tracking, validation
  CanvasValidator.ts                # Validate Canvas URL and token
  AiAuthValidator.ts                # Validate Codex CLI or API key connection
  InitialPopulation.ts              # Populate mem0 with first sync data + run profile compiler
```

---

## Open Questions

- **Canvas URL database**: Can we maintain and distribute a database of university Canvas URLs? Who keeps it updated?
- **Token refresh**: Canvas tokens can expire. How do we detect and handle expiration gracefully?
- **Codex CLI installation**: Does the student need Codex CLI installed separately, or does Student Claw bundle it?
- **Re-onboarding**: When a new semester starts, should we prompt the student to update their preferences and routines?
- **Accessibility**: The onboarding wizard needs to be fully keyboard-navigable and screen-reader compatible.
- **Localization**: Should onboarding support multiple languages from v1? Many students are multilingual.
