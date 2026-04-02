# Feature 1: AI Harness

## What It Is

The AI Harness is the brain bridge — the subsystem that connects Student Claw to an LLM (via Codex CLI) and manages every aspect of that conversation: spawning the process, sending/receiving JSON-RPC messages, streaming tokens to the UI, managing sessions, and injecting context (skills, memory, personality).

---

## Why It Exists

Students interact with Student Claw through natural language. Every question ("What's due this week?"), every planning request ("Plan my week"), and every tool call (fetching Canvas data, creating calendar events) flows through the AI Harness. Without it, the app is a static dashboard with no intelligence.

---

## Dependencies

```
Shared Contracts ──→ AI Harness ──→ Codex CLI (subprocess)
WebSocket Server ──→ AI Harness ──→ React Chat UI
Memory System ────→ AI Harness (context injection)
Skill System ─────→ AI Harness (skill prompt injection)
```

| Depends On | Why |
|---|---|
| **Shared Contracts** | Message schemas for chat events (`chat.sendMessage`, `chat.streaming`, `chat.interrupt`) |
| **WebSocket Server** | Receives user messages from the React UI, pushes streaming tokens back |
| **Electron Shell** | Codex CLI is spawned as a child process from the main server |

| Depended On By | Why |
|---|---|
| **Skill System** | Injects skill prompts into the AI's context window |
| **Memory System** | Surfaces relevant memories as context before each message |
| **Smart Planner** | Codex does the reasoning for task analysis, decomposition, and natural-language rescheduling |
| **Notification Service** | Generates contextual notification text and weekly insight analysis |
| **Onboarding** | Handles the Codex CLI auth flow |
| **Dashboard** | Chat-based interactions and quick actions |
| **Chat UI** | Renders streaming responses |

---

## Provider architecture (v1)

- **Codex CLI only** for the first ship: no parallel direct OpenAI SDK path in v1. Pin protocol and auth to one stack.
- **Internal boundary**: define a small provider-shaped port (session, turns, interrupt, tool registration, canonical event stream) so a second backend could be added later **without** a user-facing multi-vendor model picker in v1.
- **Pattern**: same idea as multi-provider coding UIs — a **registry** maps provider kind → **adapter**; a **facade** routes threads and merges event streams. v1 registers **one** adapter (Codex).

---

## Core Responsibilities

### 1. Codex CLI Process Management

Codex CLI runs as a subprocess with stdin/stdout communication using JSON-RPC protocol.

- **Spawn**: Start the Codex CLI process with appropriate flags and environment
- **Health check**: Monitor the process, restart on crash
- **Graceful shutdown**: Clean termination on app close
- **Pre-warm**: Initialize the app-server on app launch, not on first user message, to avoid cold start latency
- **Pre-warm failure**: If startup fails (install, auth, timeout), enter **degraded** mode: clear UI, disable send or offer **Retry**, **exponential backoff** on auto-retry, telemetry the failure class. **Do not** block the rest of the app (dashboard, cached data, offline queue).
- **Auth mode (v1)**: ChatGPT subscription auth via OAuth

### 2. Auth Coordinator

Handles authentication with the LLM provider.

- **ChatGPT OAuth** (primary path): Trigger device auth flow via app-server `account/login/start` with type `chatgpt`. Opens a browser for OAuth, app listens for completion.
- **Fallback policy**: No API-key fallback in v1; on auth failure, prompt re-auth through OAuth
- **Auth state persistence**: Store auth state so students don't re-authenticate every session
- **Expiry handling**: Detect expired sessions, prompt re-auth via UI

### 3. JSON-RPC Protocol

All communication with Codex CLI happens through JSON-RPC 2.0 over stdin/stdout.

- **Request envelope**: `{ jsonrpc: "2.0", method: string, params: object, id: string }`
- **Response envelope**: `{ jsonrpc: "2.0", result: object, id: string }` or `{ error: ... }`
- **Notifications** (no id): Streaming tokens, tool call progress

### 4. Streaming Responses

The AI doesn't return a complete response — it streams tokens one by one.

- Buffer incoming tokens from Codex CLI
- Push chunks to the UI via WebSocket (`chat.streaming` events)
- Handle interruption (`chat.interrupt` from user pressing Stop)
- Signal completion when the full response is assembled

### 5. Session Lifecycle

Each conversation has a session with a context window that fills up. The harness manages the full lifecycle:

- **Thread create**: Initialize a new conversation thread with Codex
- **Turn submit**: Send assembled prompt (system + context + user message) to Codex
- **Turn interrupt**: Cancel mid-stream when the student presses Stop; follow up with a **normal next user turn** if they want to redirect (no separate “steer mid-stream” product feature in v1 unless Codex exposes a real API for it)
- **Thread cleanup**: Release resources, persist session history for memory extraction
- Track token usage per session
- Summarize and compress older messages when approaching context limits (see **Context compaction** below)
- Allow new sessions (fresh context) vs. continuing existing ones
- Store session history for the Memory System to learn from

### 6. Context Window Orchestration

Before each user message is sent to the LLM, the harness assembles the full prompt.

**Injection order:**
1. **Soul.md identity** — Who the assistant is (personality, values, boundaries); loaded from `soul/SOUL.md` **plus** adaptive signals injected from profile/memory (see Soul section)
2. **Active skill prompts** — If plan-mode is active, its instructions go here
3. **Student profile** — Compact summary (~500 tokens) generated by the Memory System's profile compiler
4. **Relevant memories** — Surfaced by the Memory System based on the current query
5. **Tool definitions** — Available MCP tools the AI can call
6. **Conversation history** — Recent messages in the current session (and/or rolling summary after compaction)
7. **User message** — The actual student query

**v1 rule:** **Every turn** includes the full Soul block and adaptive injection in the assembled prompt (safe default; revisit token savings once session semantics are verified).

### 7. Context Window Budget Manager

The context window is finite. The budget manager allocates token space across competing sources to prevent overflow.

| Source | Budget | Notes |
|---|---|---|
| Soul.md | ~300 tokens | Fixed, always loaded |
| Active skills | ~500–1000 tokens | Multiple skills compete for this allocation |
| Student profile | ~500 tokens | Compact summary from profile compiler |
| Retrieved memories | ~500–1000 tokens | Top-k chunks from semantic search |
| Tool definitions | ~200–500 tokens | Scales with number of active MCP tools |
| Conversation history | Remainder | Gets whatever's left after mandatory allocations |
| User message | Unbounded | Always included in full |

When total demand exceeds the window, the budget manager trims conversation history first, then reduces memory retrieval count, and finally truncates skill prompts (never soul.md).

### Context compaction (full window)

Aligned with common agent-harness practice (e.g. summarization plus recoverable history, large tool output as files):

- **Durable transcript** stays in app storage for analytics and memory extraction.
- When the **in-prompt** budget is tight: **summarize** older material into a rolling summary, keep **recent turns** verbatim where possible, and use **retrieval over transcript chunks** to rehydrate details the summary dropped.
- **Large MCP/tool results** should be **written to files or blobs** with **short handles** in the prompt instead of megabyte JSON inline.

### 8. MCP Server Registry

The harness maintains a registry of available MCP servers and registers them with the Codex app-server so the AI can call their tools.

- Register Canvas MCP and any installed extensions with Codex during initialization
- Aggregate tool schemas from all active plugins via the MCP Orchestrator
- Dynamically update available tools when plugins start or stop

### 9. Tool Call Routing

When the AI decides it needs data (e.g., Canvas assignments), it emits a tool call.

- Parse the tool call from Codex CLI output
- Route to the MCP Orchestrator (Plugin System)
- Wait for tool result
- Feed result back to Codex CLI to continue generation

---

## Soul / Personality System

Inspired by [soul.md](https://soul.md/) and aligned with the structure and spirit of **[Open Claw’s SOUL.md template](https://docs.openclaw.ai/reference/templates/SOUL)** (core truths, boundaries, vibe, continuity), the AI Harness loads a personality document that defines who the assistant is — not just what it can do. This is what makes Student Claw a *companion* and not a generic chatbot.

### Soul.md Structure

The Soul document has two distinct sections:

**Immutable Core** (in `soul/SOUL.md`) — Personality traits that do not drift with every chat:

- **Identity**: "You are a student's academic assistant. You're encouraging but honest."
- **Values**: Prioritize the student's understanding over just giving answers. Respect deadlines.
- **Boundaries**: Never write essays for students. Help them plan, outline, and review — not cheat.
- **Tone**: Casual but focused. Like a smart friend who's good at school.
- **Session awareness**: "You don't remember previous sessions unless memories are loaded. That's okay."

**Adaptive layer** (stored + injected, not silently merged into the file in v1) — Learned communication style that evolves based on interactions:

- **Interaction style**: How the student communicates (casual? formal? emoji-heavy? terse?) — recorded and adapted to over time
- **Tone calibration**: Match the student's energy without losing the core personality (e.g., student is stressed -> empathetic but still encouraging, not panicked)
- **Learned preferences**: "This student prefers bullet points over paragraphs" or "Responds well to analogies"

The immutable core prevents personality drift — without it, the adaptive layer could gradually turn the assistant into a mirror of the student's worst habits.

### How it's loaded

- **`soul/SOUL.md`** is read at server startup and **injected at the beginning** of the assembled prompt **on every turn** (v1), together with the adaptive block from profile/memory.
- Open Claw’s template emphasizes **continuity through files** and **telling the user** if the soul file changes; v1 **does not** auto-write adaptive content into `SOUL.md`. Optional later: user-reviewed export or assistant-proposed edits with explicit notice.

### Adaptive layer updates

The adaptive layer is updated by the Memory System's extraction pipeline. After conversations, mem0 extracts interaction patterns and stores them. The profile compiler surfaces these for **injection** in `ContextAssembler`. Updates are conservative — multiple consistent signals before changing.

---

## Offline and connectivity

- **No network**: LLM path unavailable; **clear** UI (no fake replies). **Durable local queue** for outbound user messages; flush in order when back online.
- **Rest of app**: read-only use of **cached** data where available (assignments, calendar, etc.).

---

## Technology

### Effect-TS

The AI Harness is an Effect Service, meaning:

- **Typed errors**: `CodexSpawnError`, `CodexTimeoutError`, `JsonRpcParseError` are tracked in the type system
- **Structured concurrency**: Streaming, tool calls, and timeout races are composed with Effect fibers
- **Dependency injection**: The harness declares its dependencies (WebSocket, Config, Memory) in its Layer — they're provided at composition time, not imported globally
- **Interruption**: Effect's built-in interruption model handles user-initiated Stop cleanly

### Key Libraries

| Library | Purpose |
|---|---|
| `@openai/codex` (npm) | Codex CLI — installed as app dependency, bundled or prompted during onboarding |
| Effect-TS `Stream` + `Queue` | Handle JSONL event streams from the Codex subprocess |
| Effect Schema | Typed JSON-RPC message contracts (can generate from `codex app-server generate-json-schema`) |
| Node `child_process` (or Bun equivalent) | Subprocess management for Codex CLI |
| `ws` or Bun native WebSocket | WebSocket bridge between server and React UI |

---

## Key Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Codex CLI versioning** | App-server protocol may change between CLI versions | Pin a known-good version. Test against CLI updates before shipping. |
| **ChatGPT rate limits** | Students on Plus get limited Codex usage per 5-hour window | Graceful degradation: show a "rate limited" message, queue requests, suggest trying later. Surface remaining quota in the UI. |
| **Cold start latency** | App-server initialization + auth takes several seconds | Pre-warm on app launch (not on first user message). Show a loading state in the chat UI. |
| **Auth expiry** | ChatGPT session can expire mid-use | Detect auth failures, prompt re-auth without losing conversation context |

---

## Proposed File Structure

```
packages/server/src/ai/
  CodexCli.ts           # Effect service: spawn, lifecycle, health, pre-warm
  AuthCoordinator.ts    # ChatGPT OAuth + auth state persistence
  JsonRpcProtocol.ts    # Encode/decode JSON-RPC messages
  StreamManager.ts      # Token buffering, chunked push to WS
  SessionManager.ts     # Session lifecycle: create, submit, interrupt, cleanup
  ContextAssembler.ts   # Orchestrates injection order (soul, skills, profile, memory, tools, history)
  BudgetManager.ts      # Token budget allocation across context sources
  SoulIdentity.ts       # Loads and caches soul/SOUL.md; merges adaptive from profile
  McpRegistry.ts        # Registers MCP servers with Codex, aggregates tool schemas
  ToolCallRouter.ts     # Parses tool calls, delegates to MCP Orchestrator

soul/
  SOUL.md               # Immutable core + human-edited continuity; adaptive lives in profile/memory for v1
```

---

## Resolved decisions (grill-me)

| Topic | Decision |
|---|---|
| **SDK surface** | Codex CLI only in v1; optional second backend later via the same internal port. |
| **Auth path** | OAuth-only in v1 (no direct API key fallback). |
| **Context overflow** | Summarization + rolling summary/recent turns; **retrieval** over stored transcript; **spill** huge tool output to files. |
| **Multi-backend** | Thin provider port + **one** Codex adapter in v1; no multi-vendor picker in v1. |
| **Turn steer** | Not a v1 feature; use **interrupt** + **next user message**. |
| **Soul** | Follow Open Claw SOUL template; **SOUL.md** = immutable core; adaptive **injected** from memory/profile; **every-turn** assembly in v1. |
| **Pre-warm failure** | Degraded mode, retry + backoff, do not block whole app. |
| **Offline** | Honest unavailable LLM; durable **send queue**; cached read-only elsewhere. |

---

## Future / follow-ups

- **Direct OpenAI SDK** or non-Codex backends: only after the provider port is proven with Codex.
- **Mid-stream steer**: only if/when Codex exposes a supported control channel.
- **Token optimization**: inject soul once per thread if session state proves reliable without re-including full system text every turn.
