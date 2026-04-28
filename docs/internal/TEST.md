# TEST

## Testing Standard
Orbyt uses test-driven development (TDD) for feature work and bug fixes:

1. RED: write one behavior-focused test that fails.
2. GREEN: write the minimum code to pass that test.
3. REFACTOR: improve code structure while keeping tests green.

Do this in vertical slices. Do not write all tests first and all implementation second.

## What Good Tests Verify
- Behavior through public interfaces.
- User-visible outcomes and system contracts.
- End-to-end paths for critical flows.

Avoid tests coupled to internals (private functions, implementation-only mocks, or fragile internals).

## Per-Cycle Workflow
For each development cycle:
1. Select one behavior to verify.
2. Add one failing test for that behavior.
3. Implement the smallest change to pass.
4. Run relevant tests.
5. Refactor if needed.
6. Re-run tests and confirm green.
7. Log the cycle.

## Test Logging Requirement
Every TDD cycle must be logged in the feature branch notes (or PR notes) using this template.

```md
### TDD Cycle <N>
- Behavior: <what user-facing behavior was targeted>
- RED: <test name/path and failure summary>
- GREEN: <minimal change made to pass>
- REFACTOR: <cleanup/deepening performed, or "none">
- Verification: <test commands run and result>
- Notes: <risks, follow-ups, edge cases>
```

## Required Test Levels
- Unit/integration tests for domain logic.
- Contract tests at service boundaries where practical.
- End-to-end validation for high-risk user flows.

Choose the smallest set that proves behavior safely; do not over-test trivial glue.

## Definition of Done (Testing)
A feature is not done until:
- Critical acceptance behaviors have automated test coverage.
- All new and impacted tests pass locally.
- Regressions discovered in cycle are captured in tests.
- Test log entries are included with implementation notes.

