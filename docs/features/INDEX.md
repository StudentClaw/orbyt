# Feature specs index

Use this list while running the [grill-me skill](../../.agents/skills/grill-me/SKILL.md) on each document. For **every** grilling pass, do a short context load **before** asking questions:

1. Read the target feature spec in full.
2. Pull in adjacent feature context that materially affects the design, especially dependencies, depended-on features, and the current top-level framing in `../PROJECT-SUMMARY.md`.
3. Review any relevant architecture docs, shared contracts, or other local project docs that clarify how the feature is supposed to fit into the system.
4. Review relevant technology or platform documentation when the feature depends on a concrete tool, protocol, SDK, API, or framework behavior that could change the recommendation.
5. Then begin the grill session, asking questions one at a time and grounding recommendations in both the local feature graph and the relevant technical constraints.

Toggle a line from `[ ]` to `[x]` only after that broader context review has happened and you have finished a grilling pass for the target spec.

**Progress:** 10 / 11 — update the numerator as you go.

- [x] **01** — [AI Harness](01-ai-harness.md)
- [x] **02** — [Canvas Integration](02-canvas-integration.md)
- [x] **03** — [Skill System](03-skill-system.md)
- [x] **04** — [Memory System](04-memory-system.md)
- [x] **05** — [Plugin System (Local MCP Orchestrator)](05-plugin-system.md)
- [x] **06** — [Dashboard](06-dashboard.md)
- [x] **07** — [File System](07-file-system.md)
- [x] **08** — [Onboarding](08-onboarding.md)
- [x] **09** — [Smart Planner](09-smart-planner.md)
- [x] **10** — [Proactive Notification Service](10-notification-service.md)
- [ ] **11** — [Phone Push Notifications](11-phone-push-notifications.md)
