# Orbyt AI Artifact Catalog (v1)

Lightweight catalog of v1 AI-generated outputs and AI-mediated artifacts, mapped to UX surfaces.

## Scope

- v1 only.
- Includes generated text, reasoning outputs, summaries, and AI-composed user-facing content.
- Excludes pure deterministic records unless they are surfaced as an AI artifact.

## Artifact Inventory


| Artifact                                                     | Producer (Feature)                                  | Trigger                                            | Primary Surface                                       | Persistence                                         |
| ------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| Streaming assistant response                                 | AI Harness (`01-ai-harness`)                        | User sends chat message                            | Chat slide-over panel                                 | Conversation/session history                        |
| Tool-call backed answer (Canvas/planner/files context)       | AI Harness + tool routing (`01`, `02`, `07`)        | AI selects MCP/tool usage                          | Chat slide-over panel                                 | Conversation/session history                        |
| Plan generation progress messages (student-friendly)         | Smart Planner via AI Harness streaming (`09`, `01`) | Plan run starts                                    | Chat + planner/calendar area                          | Ephemeral stream + turn history                     |
| First weekly plan narrative ("here's your first plan")       | Smart Planner + onboarding walkthrough (`09`, `08`) | Post-onboarding first plan                         | Onboarding walkthrough + dashboard/chat follow-up     | Stored as plan/session records + chat history       |
| Task decomposition proposal (first-time assignment type)     | Smart Planner decomposition (`09`)                  | First decomposition for a type                     | Planner/check-in flow and related UI prompts          | Planner task/session records                        |
| Reschedule explanation (natural language)                    | Smart Planner reschedule engine (`09`)              | Student-initiated or event-driven plan change      | Chat, planner context, and notification text pathways | Activity/feed and/or chat, depending on entry point |
| "Yes, but..." follow-up effort estimate                      | Smart Planner AI estimate (`09`)                    | Completion check-in with partial completion        | Check-in and planner follow-up scheduling views       | Planned session records                             |
| Announcement summary                                         | Dashboard + AI bridge (`06`, `01`)                  | User clicks "Summarize this announcement"          | Announcements feed                                    | Cached in SQLite for re-open                        |
| Complex linked-event notification copy                       | Notification composer (`10`)                        | Causally linked events in same batch               | Native notification + activity feed                   | Activity feed store                                 |
| AI-classified announcement importance                        | Notification evaluator fallback (`10`)              | Fuzzy keyword filter misses                        | Notification pipeline (feed/OS decision)              | Decision outcome + resulting feed item              |
| Weekly insight cards (2-3 actionable insights)               | Insight generator (`10`)                            | Sunday minimum or event thresholds                 | Dashboard insight card strip + activity feed          | `activity_feed` entries (`type=insight`)            |
| Event-driven proactive insight cards                         | Insight generator (`10`)                            | Grade drop, deadline pressure, plan-behind signals | Dashboard insight card strip + activity feed          | `activity_feed` entries                             |
| Autonomous workflow summary (chat/artifact-oriented)         | Notification service (`10`)                         | Meaningful autonomous action completes             | Activity center + optional chat summary channel       | Activity feed entries                               |
| Skill-guided structured outputs (plan-mode, exam-prep, etc.) | Skill System + AI Harness (`03`, `01`)              | Skill activated and used in chat                   | Chat panel and task-specific views                    | Conversation/session history                        |
| Profile context compilation string (AI-facing artifact)      | Memory profile compiler (`04`)                      | App launch or relevant memory updates              | Not directly shown; injected into AI context          | Cached compiled profile                             |
| `MEMORY.md` projection (human-readable memory summary)       | Memory projection pipeline (`04`)                   | Launch, significant updates, or manual trigger     | File system / memory manager transparency surfaces    | Regenerated markdown file                           |
| File-aware summary/review output (markdown, PDF, docx)       | File System context + AI Harness (`07`, `01`)       | "Ask AI about this file" actions                   | Chat panel (with file context)                        | Conversation history; source file unchanged         |


## UX Notes For Frontend Tracking

- Treat each artifact as a first-class UX object with visible state (`loading`, `streaming`, `cached`, `failed`, `stale`).
- Prefer explicit provenance chips where possible (for example: `AI summary`, `Auto-generated insight`, `Planner update`).
- Keep AI artifacts actionable: every major artifact should expose a next step (`open plan`, `reschedule`, `view assignment`, `dismiss`).
- Where artifacts are cached (announcement summaries, feed insights), surface "last generated" metadata in a subtle way.

## Ownership Snapshot

- **Core generation surfaces**: Chat panel, Dashboard insight strip, Activity center/feed.
- **Highest artifact density**: Smart Planner (`09`) and Notification Service (`10`).
- **Supporting infrastructure**: AI Harness (`01`) for streaming/composition, Memory (`04`) for personalization context.

