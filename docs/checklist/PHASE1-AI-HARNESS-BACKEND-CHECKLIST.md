# Phase 1 AI Harness Backend Checklist

Last reviewed: 2026-04-09

## Purpose

Use this checklist to verify the backend Codex-harness slice that now sits behind the existing orchestration runtime. This is the checklist for “did the Person A Phase 1 backend implementation actually work in the live app,” not for the later production chat UI work.

## What Is Implemented

- [x] Shared orchestration contracts now include a detailed `providerRuntime` state object
- [x] Provider control RPCs exist for `provider.startAuth` and `provider.retryInitialize`
- [x] SQLite migration `003-provider-runtime-state.ts` adds persisted provider runtime and queued-turn tables
- [x] `packages/server/src/ai/CodexCli.ts` manages Codex app-server lifecycle and runtime event ingestion
- [x] `packages/server/src/ai/ProviderRuntimeStore.ts` persists provider state, thread session state, and queued turns
- [x] `packages/server/src/orchestration/OrchestrationService.ts` routes turns through Codex instead of the old stub-token loop
- [x] Automated verification passes with `bun run typecheck`, `bun run test`, and `bun run build`

## Preflight

- [ ] No stale server is still listening on port `8787` before starting a new dev session
- [ ] Codex CLI is installed and reachable at runtime
- [ ] `codex --version` returns successfully
- [ ] `codex login status` reports an authenticated ChatGPT session
- [ ] Local DB migrated successfully to schema version `3`

## Manual Runtime Validation

- [ ] `bun run dev` launches Vite, Electron, and the local server without startup crashes
- [ ] `/chat` connects to `ws://127.0.0.1:8787`
- [ ] Creating a thread succeeds and adds a new thread row to the orchestration snapshot
- [ ] Sending the first turn causes provider state to move through a sane path such as `initializing` or `streaming`, not immediately to `degraded`
- [ ] A real assistant token delta appears in the active thread output area
- [ ] Snapshot provider state returns to `idle` after completion
- [ ] Interrupting a long-running turn changes the turn status to `interrupted`
- [ ] Re-sending after an interrupt still works in the same session

## Provider State Validation

- [ ] `provider_runtime_state.status` matches the UI snapshot state
- [ ] `provider_runtime_state.auth_state` is `authenticated` during normal operation
- [ ] `provider_runtime_sessions.provider_thread_id` is populated after the first successful provider thread start
- [ ] `queued_provider_turns` stays empty during the healthy happy path
- [ ] If the provider is unavailable, the queued-turn count and `last_error_*` fields explain why

## Failure-Mode Checks

- [ ] Auth failure: forcing an unauthenticated Codex state leads to `auth_required`, not a generic degraded loop
- [ ] Retry path: `provider.retryInitialize` can recover after a transient provider startup failure
- [ ] Degraded mode does not crash the rest of the app shell
- [ ] Server restart does not leave stale streaming turns stuck forever
- [ ] Provider-runtime writes do not trigger `SQLITE_BUSY` / `database is locked`

## Current Known Issue To Resolve

- [ ] Live desktop send can still fall into `providerStatus = degraded` with `codex_process_unavailable` before the first streamed token appears

## Handy Commands

```bash
bun run typecheck
bun run test
bun run build
sqlite3 ~/.orbyt/data.db "select provider,status,auth_state,last_error_code,last_error_message,queued_turn_count,last_updated_at from provider_runtime_state;"
sqlite3 ~/.orbyt/data.db "select thread_id,provider,status,last_error,provider_thread_id,auth_state,updated_at from provider_runtime_sessions order by updated_at desc limit 5;"
sqlite3 ~/.orbyt/data.db "select id,thread_id,input_text,output_text,status,started_at,completed_at from orchestration_turns order by started_at desc limit 5;"
```
