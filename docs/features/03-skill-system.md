# Feature 3: Skill System

## What It Is

The Skill System lets the AI harness different "modes" of behavior by loading markdown instruction files into its context. Skills are natural language programs — they tell the AI how to approach a specific task. The flagship skill is **plan-mode**, which orchestrates weekly academic planning.

---

## Why It Exists

A general-purpose AI assistant is okay at everything but great at nothing. Skills make Student Claw a specialist when it needs to be. When a student says "plan my week," the AI doesn't wing it — it follows a structured skill that knows to check Canvas, estimate time, and schedule calendar blocks. Students and the community can also write their own skills.

---

## Dependencies

```
AI Harness ──→ Skill System (injects skill prompts into context)
Memory System ──→ Skill System (skills can reference stored memories)
File System ──→ Skill System (skills are markdown files on disk)
```

| Depends On | Why |
|---|---|
| **AI Harness** | Skills are injected into the AI's context window via the Context Assembler |
| **Memory System** | Skills can reference and write to memory (e.g., plan-mode stores time estimates) |
| **File System** | Skills are markdown files stored locally |

| Depended On By | Why |
|---|---|
| **Plan-Mode** (internal) | The flagship skill that orchestrates Canvas + Calendar |
| **Onboarding** | Recommends pre-installed skills, explains how to create custom ones |
| **Chat UI** | Shows active skills, allows activation/deactivation |

---

## Core Responsibilities

### 1. Skill Discovery and Registry

Find all available skills on disk and maintain an index.

- Scan the `skills/` directory for `.md` files
- Parse frontmatter (YAML) for metadata: name, description, trigger phrases, author
- Build an in-memory registry of available skills
- Watch for file changes (new skills added, existing skills edited)

### 2. Skill Activation

When a skill should be active, its content is injected into the AI's system prompt.

**Activation modes:**
- **Explicit**: Student says "activate plan-mode" or clicks a button
- **Auto-detect**: The AI recognizes that a query matches a skill's trigger phrases and activates it
- **Always-on**: Some skills (like a study-tips skill) can be marked as persistent

### 3. Context Injection

When a skill is active, its markdown content becomes part of the system prompt.

- The skill text is inserted into the Context Assembler's injection pipeline
- Position: after Soul.md identity, before conversation history
- Multiple skills can be active simultaneously (stacked)
- Total token budget for skills is capped to prevent context overflow

### 4. Skill Authoring

Students can write their own skills — they're just markdown files.

**Skill file format:**
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
---

# Essay Reviewer

You are reviewing the student's essay draft. Follow these steps:

1. Read the full essay before commenting
2. Assess the thesis statement — is it clear and arguable?
3. Check paragraph structure — does each paragraph support the thesis?
4. Look for logical gaps or unsupported claims
5. Note grammar and style issues, but prioritize content feedback
6. End with 2-3 specific, actionable suggestions

## Rules
- Be encouraging but honest
- Don't rewrite sections for the student — point out issues and let them fix it
- If the essay is on a topic you know well, share relevant context
```

### 5. Skill Context Budget

Skills compete for context window space allocated by the AI Harness's [Budget Manager](01-ai-harness.md). The total skill budget is ~500-1000 tokens.

- Each active skill consumes tokens proportional to its markdown length
- When multiple skills are active, they share the budget (divided equally, or by priority)
- If total active skills exceed the budget, lower-priority skills are truncated or deactivated with a warning
- The `always-on` skills get first claim on the budget; keyword/explicit skills split the remainder

### 6. Skill Editor UI

Students can create and edit skills directly in the app without using an external text editor.

- Built-in markdown editor with syntax highlighting and YAML frontmatter support
- Live preview of how the skill will appear
- Validation: check frontmatter fields, warn about excessively long skills (context budget impact)
- Template starter: pre-populated skeleton when creating a new skill

### 7. Pre-Installed Skills

Student Claw ships with skills for common academic tasks:

| Skill | What it does |
|---|---|
| **plan-mode** | Weekly planning: Canvas scan, time estimation, calendar scheduling. See [Smart Planner](09-smart-planner.md) for the backend services. |
| **study-helper** | General study assistance: explains concepts, creates practice problems |
| **essay-reviewer** | Reviews writing for structure, argument, grammar |
| **exam-prep** | Creates study guides from course materials and past assignments. Spaced repetition scheduling, practice question generation. |
| **citation-helper** | Formats citations in APA, MLA, Chicago based on input |
| **explain-like** | Adjusts explanation complexity ("explain like I'm 5" / "explain technically") |

---

## Plan-Mode: The Flagship Skill

Plan-mode is the most complex skill and the one that demonstrates Student Claw's full power. It has two parts:

1. **The skill file** (`plan-mode.md`) — Natural language instructions that tell the AI how to reason about planning. Lives here in the Skill System.
2. **The Smart Planner backend** — Deterministic services for task analysis, slot finding, scheduling, and rescheduling. Lives in the [Smart Planner](09-smart-planner.md) feature.

The skill file instructs the AI *what to think about*; the Smart Planner services handle *what actually happens* (database writes, constraint checking, calendar placement).

### Plan-mode skill file (abbreviated)

```markdown
---
name: Plan Mode
description: Scan Canvas for upcoming work and create a weekly study plan
triggers:
  - plan my week
  - what should I work on
  - schedule my assignments
author: student-claw
version: 1.0
always_has_tools:
  - canvas-mcp.get_upcoming
  - canvas-mcp.get_assignment_detail
  - calendar-mcp.get_free_blocks
  - calendar-mcp.create_event
---

# Plan Mode

You are helping the student plan their academic week. Follow this process:

## Step 1: Gather assignments
Call `get_upcoming` with days=14 to see everything due in the next two weeks.

## Step 2: Estimate time
For each assignment, estimate hours needed. Use the student's memory
for past performance on similar tasks. If no history exists, use these defaults:
- Reading response: 1-2 hours
- Problem set: 2-4 hours
- Essay (short): 3-5 hours
- Essay (long/research): 8-15 hours
- Exam study: 4-8 hours

## Step 3: Check availability
Call `get_free_blocks` for the next 14 days. Respect the student's preferences
for study times (morning person vs. night owl, no-study days, etc.).

## Step 4: Schedule
Place study blocks optimally:
- Hardest tasks during peak productivity hours
- Buffer time before deadlines (never schedule right before due)
- Break large tasks into multiple sessions
- Balance load across days

## Step 5: Present the plan
Show the student the proposed plan in a clear format. Ask for approval
before writing to the calendar. Let them adjust.
```

For the backend that persists the plan, handles rescheduling, and tracks completion, see [Smart Planner](09-smart-planner.md).

---

## Technology

| Library | Purpose |
|---|---|
| `gray-matter` | Parse YAML frontmatter from markdown skill files |
| `@uiw/react-md-editor` or CodeMirror | In-app markdown editor for the Skill Editor UI |
| File watcher (chokidar or similar) | Hot-reload skill files during development when edited externally |

---

## Proposed File Structure

```
packages/server/src/skills/
  SkillEngine.ts          # Effect service: load, activate, inject
  SkillRegistry.ts        # Discover and index available skills
  SkillParser.ts          # Parse markdown + YAML frontmatter (gray-matter)
  SkillActivation.ts      # Activation logic (explicit, auto-detect, always-on)
  SkillBudget.ts          # Token budget management for active skills

packages/ui/src/components/skills/
  SkillEditor.tsx         # Markdown editor for creating/editing custom skills
  SkillSelector.tsx       # UI for activating/deactivating skills in chat

skills/
  plan-mode.md            # Flagship: weekly planning (backend in Smart Planner)
  study-helper.md         # General study assistance
  essay-reviewer.md       # Writing review
  exam-prep.md            # Study guide generation
  citation-helper.md      # Citation formatting
  explain-like.md         # Adjustable explanation complexity
  README.md               # Guide for authoring custom skills
```

---

## Open Questions

- **Skill marketplace**: Should students be able to share/install skills from a community repo?
- **Skill versioning**: When a pre-installed skill is updated in an app release, how do we handle students who customized their copy?
- **Skill chaining**: Can one skill invoke another? E.g., plan-mode triggers exam-prep for upcoming exams?
- **Skill permissions**: Should skills declare what tools they need access to? The `always_has_tools` frontmatter field is a start.
