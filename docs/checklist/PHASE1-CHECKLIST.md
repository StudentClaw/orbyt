# Phase 1 Verification Checklist

## Shared Contracts
- [ ] Chat WS protocol exports phase 1 message types/events used by both tiers (`chat.sendMessage`, `chat.interrupt`, `chat.streaming`, `chat.complete`, auth/degraded-state events if added)
- [ ] JSON-RPC envelope used for Codex stdin/stdout is typed and round-trips correctly
- [ ] Typed errors exist for phase 1 AI failure modes (auth expired, rate limited, Codex unavailable, interrupted stream, protocol parse/decode failure)

## AI Harness Backend
- [ ] `bun run dev:server` starts with AI Harness services wired into the WS router
- [ ] Codex CLI subprocess spawns successfully and health/pre-warm completes, or degraded mode is entered with a clear log/state
- [ ] ChatGPT auth flow can be initiated and auth state persists across restart
- [ ] Sending `chat.sendMessage` creates or reuses a session/thread and forwards the turn to Codex
- [ ] `chat.streaming` events arrive incrementally while the model is responding
- [ ] `chat.complete` is emitted exactly once at the end of a successful turn
- [ ] `chat.interrupt` stops an active turn and no further stream chunks are emitted after interruption is acknowledged
- [ ] Session/thread continuity works across multiple turns in the same conversation
- [ ] Soul identity loads from `soul/SOUL.md` and is injected into context assembly
- [ ] Context assembly includes the expected phase 1 inputs in order: soul, skills, profile/memory context, tools, history, user message
- [ ] Budget manager enforces token allocation without crashing or overfilling context
- [ ] Tool calls route through the MCP/tool call layer without breaking the active chat session
- [ ] Codex subprocess crash or timeout triggers retry/backoff and a user-visible unavailable/degraded state
- [ ] `bun test --cwd packages/server` passes AI Harness, JSON-RPC, session, and stream management tests

## Chat UI
- [ ] `bun run dev:ui` renders the phase 1 chat experience (sheet and/or dedicated `/chat` route)
- [ ] User messages appear immediately in the conversation when submitted
- [ ] Assistant responses stream into the UI in real time
- [ ] Auto-scroll follows new tokens during streaming, with scroll-to-bottom behavior when scrolled away
- [ ] Stop button is visible during streaming and interrupts the active turn
- [ ] Reasoning blocks render and can be expanded/collapsed when present
- [ ] Tool-call state is visible while the assistant is calling tools
- [ ] Assistant messages render markdown correctly
- [ ] Chat store preserves conversation history, streaming state, and active session metadata
- [ ] Connected, offline, interrupted, rate-limited, auth-expired, and AI-unavailable states each show clear UI feedback
- [ ] Reopening the chat sheet does not lose the current conversation unexpectedly
- [ ] `bun --cwd packages/ui vitest run` passes chat component, hook, and store tests

## Electron
- [ ] `bun run dev:electron` launches the desktop shell with the phase 1 chat UI accessible
- [ ] Electron still spawns/monitors the local server successfully with AI Harness enabled
- [ ] Any auth handoff required for ChatGPT/Codex login completes without breaking the desktop shell
- [ ] If Codex/auth is unavailable, Electron stays stable and the UI shows the degraded state instead of crashing

## End-to-End
- [ ] `bun run dev` launches the app and supports a full chat round-trip: UI -> WS -> server -> Codex -> stream back to UI
- [ ] Send a prompt, receive a streamed response, interrupt it, then send a follow-up successfully in the same session
- [ ] Tool usage invoked during a chat turn surfaces correctly in both backend logs and frontend indicators
- [ ] Auth expiry or rate-limit scenarios produce honest user-facing messaging and recoverable next steps
- [ ] `bun run typecheck` passes all packages after phase 1 changes
- [ ] `bun run test` passes across the monorepo
