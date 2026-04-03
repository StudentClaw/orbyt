# Feature 4: Memory System

## What It Is

The Memory System gives Student Claw the ability to remember — across sessions, across semesters, across the student's entire academic life. It stores what the AI learns about the student, their professors, their study habits, and their preferences. It uses **mem0** as the adaptive memory engine with **entity partitioning** to scope memories by category, and keeps a minimal set of markdown files for transparency.

---

## Why It Exists

Without memory, every conversation starts from zero. The student has to re-explain their schedule, their professors' quirks, their study preferences, and their academic history every time. Memory is what transforms Student Claw from a stateless chatbot into a personal academic advisor that gets better over time.

---

## Dependencies

```
SQLite Database ──→ Memory System (persistence layer for mem0)
AI Harness ──────→ Memory System (context injection, profile compilation)
Shared Contracts ──→ Memory System (MemoryEntry schema)
```

| Depends On | Why |
|---|---|
| **SQLite Database** | Persistent storage for mem0's vector store and history |
| **AI Harness** | Profile is injected into AI context; extraction uses the LLM |
| **Shared Contracts** | `MemoryEntry`, `ProfessorPattern`, `StudentPreference` schemas |

| Depended On By | Why |
|---|---|
| **AI Harness** | Surfaces relevant memories before each AI interaction |
| **Skill System** | Skills read/write memories (e.g., plan-mode stores time estimates) |
| **Canvas Integration** | Professor pattern learning writes to memory |
| **Smart Planner** | Reads routines, preferences, course data for scheduling |
| **Dashboard** | Study habit tracking reads from memory |
| **Notification Service** | Reads quiet hours and notification preferences |

---

## Architecture: mem0 with Entity Partitioning

Instead of maintaining a tree of discrete markdown files per memory category, the Memory System uses **mem0's entity partitioning** as the single source of truth. Memory categories are scoped using mem0's built-in identifiers (`user_id`, `agent_id`, `run_id`) as tags.

### Entity Mapping

| Memory Category | `user_id` | `agent_id` | `run_id` | Example Content |
|---|---|---|---|---|
| Student profile | `"student"` | `"profile"` | — | "Prefers morning study sessions. GPA goal: 3.5." |
| Academic info | `"student"` | `"academic"` | — | "Major: Computer Science. Strengths: math. Weakness: writing." |
| Personal context | `"student"` | `"personal"` | — | "Works part-time Tue/Thu evenings. Has a dog." |
| Behavioral patterns | `"student"` | `"behavioral"` | — | "Tends to underestimate essay time by 30%. Starts homework late on Sundays." |
| Per-course context | `"student"` | `"course_cs301"` | — | "Professor uses autograder. Submissions must be .py files." |
| Professor patterns | `"student"` | `"prof_dr_smith"` | — | "Posts assignments in Modules, not Assignments tab. Usually gives 1 week for homework." |
| Routines/schedule | `"student"` | `"routines"` | — | "Class MWF 9-10am. Work shifts Tue/Thu 4-8pm. Gym Mon/Wed 7am." |
| Preferences | `"student"` | `"preferences"` | — | "Quiet hours 10pm-8am. Max study session 2hr. Prefers evening study." |
| Daily context | `"student"` | — | `"2026-03-29"` | "Planned week. Estimated 12 hours of work. Completed 3 assignments." |
| Session context | `"student"` | — | `"session_abc123"` | "Currently working on the Bio essay about cell division." |

**Custom metadata** attached to each memory entry:
- `expiration`: Date after which the memory auto-expires (for temporal facts like "exam next Tuesday")
- `confidence`: 0-1 score for pattern-based memories (professor patterns, behavioral observations)
- `source`: Where the memory came from (`"conversation"`, `"canvas_sync"`, `"manual"`, `"planner"`)

### Why Entity Partitioning Over Files

| Concern | File-per-category approach | mem0 entity partitioning |
|---|---|---|
| **Retrieval** | Read + chunk + embed files, then semantic search | Semantic search with scoped filters in one call |
| **Updates** | Parse file, find section, edit text, re-index | mem0 ADD/UPDATE/DELETE pipeline handles automatically |
| **Contradictions** | Manual deduplication across files | mem0 detects contradictions and updates/deletes stale facts |
| **Scaling** | File tree grows unwieldy over semesters | Flat store with tags, scales naturally |
| **Transparency** | Students can read markdown files | `MEMORY.md` projection + Memory Manager UI |

---

## The Two Markdown Files

Only two markdown files are maintained. Everything else lives in mem0.

### `soul/SOUL.md` — Personality

The Soul document is a design artifact, not a memory. It defines the assistant's personality and is loaded by the [AI Harness](01-ai-harness.md) on every conversation. See the [Soul / Personality System](01-ai-harness.md#soul--personality-system) section for details on its two-part structure (immutable core + adaptive layer).

### `~/.student-claw/MEMORY.md` — Human-Readable Projection

A read-only, auto-generated summary of what mem0 knows about the student. Provides transparency without requiring the student to understand mem0's internals.

**Regeneration triggers:**
- On app launch
- After significant mem0 updates (new course detected, major profile change)
- On demand from the Memory Manager UI

**Contents:** Organized by category (profile, courses, professors, routines, preferences), with the most important facts surfaced first. Students can read this file directly, but edits are made through the Memory Manager UI — which writes back to mem0, then regenerates the projection.

---

## mem0 Integration

### How mem0 Works

mem0 uses a two-phase pipeline after each conversation:

**Phase 1 — Extraction**: Analyzes the exchange and extracts important facts using an LLM. Combines three context sources:
- The latest exchange (what just happened)
- A rolling summary (overall context)
- Recent messages (short-term buffer)

**Phase 2 — Update**: Compares extracted facts against existing memories in the vector database and performs one of four operations:
- **ADD** — New fact, store it
- **UPDATE** — Existing fact evolved (e.g., "prefers mornings" becomes "prefers mornings, except Fridays")
- **DELETE** — Contradicted fact (e.g., student no longer taking a course)
- **NOOP** — No meaningful change

### Real-Time Extraction

Extraction runs **after each conversation** automatically — not as a batch job. This means:
- Memories are available immediately for the next conversation
- No end-of-day distillation job to schedule or maintain
- The student's profile improves incrementally with every interaction

### mem0 Configuration for Student Claw

```typescript
// Conceptual config (adapted for TypeScript/Effect)
const mem0Config = {
  vector_store: {
    provider: "sqlite",
    config: {
      path: "~/.student-claw/memory/vectors.db"
    }
  },
  llm: {
    provider: "openai",
    config: {
      model: "gpt-4.1-mini",  // lightweight for extraction
      temperature: 0.1
    }
  },
  history_store: {
    provider: "sqlite",
    config: {
      path: "~/.student-claw/memory/history.db"
    }
  }
};
```

### Scoped Memory Operations

```typescript
// Writing memories with entity scoping
await memory.add(conversationMessages, {
  user_id: "student",
  agent_id: "course_cs301",
  run_id: "2026-03-29"
});

// Searching with entity filters
const courseMemories = await memory.search("grading policy", {
  filters: {
    AND: [
      { user_id: "student" },
      { agent_id: "course_cs301" }
    ]
  }
});

// Searching across all professor patterns
const profPatterns = await memory.search("late work policy", {
  filters: {
    AND: [
      { user_id: "student" },
      { agent_id: "prof_*" }  // wildcard for all professors
    ]
  }
});
```

---

## Memory Scopes

| Scope | What's Stored | Persistence | `agent_id` Pattern |
|---|---|---|---|
| **Student Profile** | Preferences, goals, schedule constraints | Permanent (until edited) | `"profile"`, `"academic"`, `"personal"` |
| **Course Context** | Per-course notes, professor patterns | Per-semester | `"course_*"`, `"prof_*"` |
| **Session Context** | Current conversation state | Per-session | — (uses `run_id`) |
| **Temporal** | Time-bound facts | Auto-expire via metadata | Any (with `expiration` metadata) |
| **Behavioral** | Learned patterns about the student | Long-term, adaptive | `"behavioral"` |

---

## How Memories Flow

### Writing Memories

1. **Conversation extraction** (mem0): After each chat, extract facts automatically with entity scoping
2. **Explicit storage**: Student says "remember that I prefer evening study sessions" — tagged with `agent_id="preferences"`
3. **Canvas sync**: Professor patterns detected during background sync — tagged with `agent_id="prof_*"` and `agent_id="course_*"`
4. **Skill output**: Plan-mode stores time estimates after each planning session — tagged with `agent_id="behavioral"`
5. **Feedback loops**: When the student corrects the AI, the correction triggers an UPDATE in mem0

### Reading Memories

1. **Profile compilation**: On app launch and after extraction cycles, query all scopes to generate a compact ~500-token profile context string for AI injection
2. **Pre-prompt injection**: Before each AI response, search memories relevant to the current query (budget-aware — respects token allocation from the [AI Harness Budget Manager](01-ai-harness.md))
3. **Skill context**: Active skills can query specific memory scopes (e.g., plan-mode queries `agent_id="routines"` and `agent_id="preferences"`)
4. **Dashboard display**: Study habits, pattern summaries read from memory for UI display
5. **Professor context**: When discussing a class, auto-load that professor's patterns via `agent_id="prof_*"` filter

### Memory Lifecycle

```
New fact extracted by mem0
  ├── Does it contradict an existing memory?
  │     ├── Yes → UPDATE the existing memory (mem0 handles this)
  │     └── No  → ADD as new memory
  ├── Is it time-bound?
  │     ├── Yes → Set expiration in metadata, auto-prune after date
  │     └── No  → Persist indefinitely
  └── If significant change → trigger MEMORY.md projection regeneration
```

---

## Profile Compiler

The Profile Compiler reads from mem0 and generates a compact context string (~500 tokens) that's always injected into the AI's context window.

**What it queries:**
- `agent_id="profile"` — core identity facts
- `agent_id="academic"` — academic context
- `agent_id="routines"` — current schedule
- `agent_id="preferences"` — study preferences
- `agent_id="behavioral"` — top behavioral patterns

**Regeneration triggers:**
- App launch
- After mem0 extraction cycles that touch profile-relevant scopes
- Manual trigger from Memory Manager UI

The compiled profile is cached and reused until a regeneration trigger fires.

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Memory engine** | mem0 OSS Node SDK in local server | Native Node runtime path keeps deployment simple in Electron and avoids sidecar complexity in v1 |
| **Embedding model** | OpenAI `text-embedding-3-small` | Quality retrieval, student already has auth. ~$0.02/1M tokens. |
| **Storage** | SQLite (vectors + history) | Local-first, single file, aligns with rest of the stack |
| **Extraction timing** | Asynchronous post-turn with durable queue | Keeps chat latency low while guaranteeing eventual memory writes with retry |
| **Transparency** | `MEMORY.md` projection + Memory Manager UI | Students can see what's stored without understanding vector databases |
| **Daily log granularity** | Summarized interaction notes (not full transcripts) | Cheaper storage, better retrieval quality, privacy-friendlier |
| **Auth UX** | Single OAuth sign-in for AI + memory | One secure auth broker serves both Codex chat and OpenAI extraction clients |

---

## Proposed File Structure

```
packages/server/src/memory/
  MemoryService.ts          # Effect service: read, write, search, profile compilation
  Mem0Integration.ts        # mem0 OSS client wrapper with entity scoping
  ProfileCompiler.ts        # Query mem0 scopes → generate compact profile context
  MemoryProjection.ts       # Generate MEMORY.md from mem0 contents
  MemoryScopes.ts           # Entity mapping constants (agent_id values, scope definitions)

~/.student-claw/
  memory/
    vectors.db              # mem0 vector store (SQLite)
    history.db              # mem0 history/audit trail
  MEMORY.md                 # Auto-generated human-readable memory projection
```

---

## Resolved decisions (grill-me)

| Topic | Decision |
|---|---|
| **Runtime path** | Memory stack is native to Node in v1 (mem0 Node SDK in the local server). No Python sidecar path in the v1 design. |
| **Model integration split** | AI chat uses Codex CLI; memory extraction uses OpenAI model config directly via mem0 integration. |
| **Auth flow** | Single sign-in UX. The app uses one secure auth broker/session source so students do not authenticate separately for chat and memory extraction. |
| **Write timing** | Extraction and writes run asynchronously after each turn via a durable queue with retries and typed failures. |
| **Retention policy** | Deterministic v1 lifecycle: session scope TTL 30 days, daily scope TTL 90 days, `course_*`/`prof_*` archived at term end then deleted after 18 months, profile/preference/routines/behavioral persistent unless edited/deleted. |
| **Bloat controls** | Weekly compaction job enforces per-scope caps by recency + confidence while preserving high-signal profile memories. |
| **Vector backend** | Keep SQLite vector/history stores for v1. Re-evaluate only if measured latency or corpus size crosses operational thresholds. |
| **Privacy controls** | Memory Manager is required in v1 for inspect/edit/delete operations against mem0 entries; `MEMORY.md` remains read-only projection for transparency. |
| **Graph memory** | Out of scope for v1. Keep flat entity-partitioned memory only. |
| **Portability** | v1 includes export/import of memory DB artifacts with metadata manifest to support device migration. |
| **Local extraction model** | Out of scope for v1; revisit after baseline quality/stability is validated. |

## Deferred follow-ups

- Define concrete operational thresholds for when SQLite vector storage should be upgraded.
- Evaluate local extraction models only after v1 quality and cost telemetry is available.
- Revisit graph-memory relationships if planner/course reasoning shows clear retrieval gaps.
