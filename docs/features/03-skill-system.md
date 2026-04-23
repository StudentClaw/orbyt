# Feature 3: Skill System

## What It Is

The Skill System gives Orbyt specialized modes of behavior without turning every interaction into an ad hoc prompt. In v1 it is a **two-tier system**:

1. **Curated skills** — first-party, reviewed workflows shipped with the app
2. **Custom skills** — student-authored markdown workflows that start useful but constrained

Skills are still markdown-first and human-readable, but they are no longer the final authority on what the agent may do. A central server-side policy layer decides which capabilities are allowed, which require approval, and which are blocked.

The flagship skill is **plan-mode**, which orchestrates weekly academic planning across Canvas, memory, and calendar availability.

---

## Why It Exists

A general-purpose AI assistant is okay at everything but great at nothing. Skills let Orbyt behave like a specialist when it needs to:

- `plan-mode` follows a planning workflow instead of improvising
- `essay-reviewer` stays focused on feedback rather than rewriting the paper
- `exam-prep` can guide a study workflow grounded in real coursework

Just as important, the Skill System gives students a safe way to create their own workflows. Students can author and fork skills, but the app still protects sensitive actions like calendar writes, assignment downloads, and other side effects through server-enforced policy.

---

## Dependencies

```text
AI Harness ──→ Skill System (injects active skill instructions)
Memory System ──→ Skill System (skills can read relevant memories)
File System ──→ Skill System (skill markdown lives on disk)
Canvas / Calendar MCPs ──→ Skill System (capabilities requested by curated workflows)
```

| Depends On | Why |
|---|---|
| **AI Harness** | The Context Assembler injects active skill text into the model prompt |
| **Memory System** | Skills read student preferences, habits, and prior outcomes |
| **File System** | Curated and custom skills are stored locally as markdown files |
| **Plugin System / MCP servers** | Skills request capabilities backed by Canvas, calendar, file, and other tools |

| Depended On By | Why |
|---|---|
| **Plan-Mode** (internal) | The flagship workflow that coordinates planning behavior |
| **Onboarding** | Introduces curated skills and explains custom authoring / promotion |
| **Chat UI** | Displays active skills, suggested skills, and permission state |

---

## Core Responsibilities

### 1. Skill Discovery and Registry

Find all available skills on disk and maintain a registry with trust metadata.

- Scan the `skills/` directory for curated skill files
- Scan the student skill directory for custom / forked skills
- Parse YAML frontmatter for metadata such as `name`, `description`, `triggers`, `author`, `version`
- Track `tier` and provenance metadata such as `curated`, `custom`, or `forked-from`
- Watch for file changes and refresh the in-memory registry

### 2. Skill Activation

When a skill should be active, its content is injected into the AI's system prompt.

**Activation modes in v1:**
- **Explicit**: Student says "activate plan-mode" or clicks a skill
- **Suggest then confirm**: The assistant detects likely intent and recommends a curated skill before shifting into a higher-impact workflow
- **Always-on (limited)**: Only lightweight formatting or tone skills may remain persistently active

High-impact skills must not silently take over. If a skill meaningfully changes workflow behavior or is likely to lead to side effects, the assistant should surface that transition in chat.

### 3. Context Injection

When a skill is active, its markdown body becomes part of the system prompt.

- The skill text is inserted into the Context Assembler after `soul.md` identity and before conversation history
- Multiple skills can be active simultaneously, but only when they are compatible
- Skills do not bypass the harness's token budget or safety rules
- If two active skills conflict, curated workflow skills win over lightweight formatting helpers

### 4. Capability Declarations and Policy Enforcement

Skills may declare the capabilities they would like to use, but declarations are **requests**, not permission grants.

- Curated skills can request richer capabilities because they are app-reviewed
- Custom skills start with the custom default trust tier, even if they were forked from a curated skill
- Every sensitive tool call is checked by a **server-side policy gate**
- Reads, writes, and side effects are classified independently
- Write-capable actions require approval according to capability rules

This means the markdown file tells the model how to work, while the server decides what the workflow is actually allowed to do.

### 5. Custom Skill Authoring and Trust Ladder

Students can write their own skills, but new custom skills do not start fully trusted.

**Default custom skill behavior in v1:**
- **Default power:** `read-suggest`
- **Default read scope:** `planner-scope`
- **Planner-scope includes:** chat context, relevant memory, upcoming coursework summaries, and calendar availability summaries
- **Planner-scope excludes by default:** broad filesystem access, raw downloaded assignment files, and unrestricted grade history

**Trust ladder:**
1. **Create** a custom skill from scratch or by forking a curated skill
2. **Use it in read-suggest mode**
3. **Promote it manually** through a permissions review screen
4. **Grant extra capabilities one capability at a time**

Forking copies the skill's prompt logic and metadata, but **not** its curated trust level.

### 6. Skill Context Budget

Skills compete for context window space allocated by the AI Harness's [Budget Manager](01-ai-harness.md). The total skill budget is roughly 500-1000 tokens.

- Each active skill consumes tokens proportional to its markdown length
- Curated workflow skills get priority over optional helper skills
- Always-on helper skills get a small reserved slice rather than open-ended priority
- If total active skills exceed the budget, lower-priority helper skills are truncated or deactivated with a warning

### 7. Skill Editor UI

Students can create and edit custom skills directly in the app.

- Built-in markdown editor with syntax highlighting and YAML frontmatter support
- Template starter for new custom skills
- Validation for frontmatter fields and capability requests
- Clear display of current trust tier: curated, custom, or promoted custom
- Permission review screen for promotion requests
- Fork flow for duplicating curated skills into editable custom copies

### 8. Pre-Installed Skills

Orbyt ships with curated skills for common academic tasks:

| Skill | Tier | What it does |
|---|---|---|
| **plan-mode** | Curated workflow | Weekly planning using Canvas, memory, and calendar availability. See [Smart Planner](09-smart-planner.md) for the backend services. |
| **study-helper** | Curated helper | General study assistance: explanations, practice prompts, and study strategies |
| **essay-reviewer** | Curated helper | Reviews writing for structure, argument, and clarity |
| **exam-prep** | Curated workflow | Builds study plans and prep structure from course materials and upcoming exams |
| **citation-helper** | Curated helper | Formats citations in APA, MLA, or Chicago |
| **explain-like** | Curated helper | Adjusts explanation complexity ("explain like I'm 5" / "explain technically") |

---

## Skill File Model

Skills stay markdown-first so students can understand and author them easily.

**Example custom skill file:**
```markdown
---
name: Essay Reviewer
description: Reviews essay drafts for structure, argument flow, and grammar
triggers:
  - review my essay
  - check my paper
  - edit my draft
author: student
version: 1.0
requested_capabilities:
  - memory.read
tier: custom
---

# Essay Reviewer

You are reviewing the student's essay draft. Follow this process:

1. Read the full essay before commenting
2. Assess the thesis statement and whether it is arguable
3. Check paragraph structure and evidence
4. Note logical gaps or unsupported claims
5. Flag grammar and style issues, but prioritize content feedback
6. End with 2-3 specific, actionable suggestions

## Rules
- Be encouraging but honest
- Do not rewrite sections for the student
- Ask clarifying questions if the assignment context is missing
```

The important rule is that `requested_capabilities` expresses intent, not authority. The server policy gate is the final authority.

---

## Plan-Mode: The Flagship Skill

Plan-mode is the clearest example of the split between prompt behavior and backend authority. It has two parts:

1. **The skill file** (`plan-mode.md`) — tells the model how to reason about planning
2. **The Smart Planner backend** — performs durable scheduling, constraint checking, and rescheduling

The skill file instructs the AI *what to think about*; the Smart Planner services handle *what actually happens*.

### Plan-mode skill file (abbreviated)

```markdown
---
name: Plan Mode
description: Scan upcoming work and prepare a weekly study plan
triggers:
  - plan my week
  - what should I work on
  - schedule my assignments
author: orbyt
version: 1.0
requested_capabilities:
  - canvas.coursework.read
  - memory.read
  - calendar.availability.read
  - calendar.events.write
tier: curated
---

# Plan Mode

You are helping the student plan their academic week. Follow this process:

## Step 1: Gather upcoming work
Read upcoming coursework for the next 14 days.

## Step 2: Estimate effort
Use memory and assignment details to estimate time needed.

## Step 3: Check availability
Read the student's free blocks and planning preferences.

## Step 4: Build a draft plan
Balance workload, protect buffer time, and split large tasks into sessions.

## Step 5: Ask for approval
Show the draft plan clearly and ask for approval before any calendar write.
```

In v1, `plan-mode` may read planner-scope data and request stronger capabilities, but calendar writes still pass through the central policy gate and require approval.

---

## Technology

| Library | Purpose |
|---|---|
| `gray-matter` | Parse YAML frontmatter from markdown skill files |
| `@uiw/react-md-editor` or CodeMirror | In-app markdown editor for the Skill Editor UI |
| File watcher (chokidar or similar) | Hot-reload skill files during development when edited externally |

---

## Proposed File Structure

```text
packages/server/src/skills/
  SkillEngine.ts            # Effect service: load, activate, inject
  SkillRegistry.ts          # Discover and index available skills
  SkillParser.ts            # Parse markdown + YAML frontmatter
  SkillActivation.ts        # Explicit, suggested, and always-on activation rules
  SkillBudget.ts            # Token budget management for active skills
  SkillPolicy.ts            # Server-side policy gate for capability checks
  CapabilityCatalog.ts      # Capability definitions and read/write risk classes

packages/ui/src/components/skills/
  SkillEditor.tsx           # Markdown editor for creating/editing custom skills
  SkillSelector.tsx         # UI for activating/deactivating skills in chat
  SkillPromotionDialog.tsx  # Capability review and promotion flow
  SkillForkDialog.tsx       # Duplicate curated skills into custom copies

skills/
  curated/
    plan-mode.md
    study-helper.md
    essay-reviewer.md
    exam-prep.md
    citation-helper.md
    explain-like.md
  custom/
    README.md               # Guide for authoring custom skills
```

---

## Locked v1 Decisions

- **Skill model:** two-tier system with curated and custom skills
- **Activation authority:** suggest-then-confirm for higher-impact curated workflows
- **Safety boundary:** server-side policy gate, not prompt-only trust
- **Custom default power:** read-suggest
- **Custom default read scope:** planner-scope
- **Promotion model:** manual promotion with capability-by-capability approval
- **Curated customization:** fork-only
- **Fork trust behavior:** fork copies behavior, not trust
- **Always-on skills:** limited to lightweight helpers
- **Marketplace:** no community marketplace in v1
- **Versioning:** curated skills are immutable and app-updated; forks diverge as user-owned copies
- **Skill chaining:** no open-ended skill-to-skill chaining in v1
