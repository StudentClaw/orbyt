# PLAN

## Purpose
This file defines the required implementation workflow for every Student Claw feature.

## Mandatory Delivery Flow
1. Create a feature branch.
2. Orient on existing product and architecture docs.
3. Implement through the Beginning-Middle-End lifecycle.
4. Update relevant documentation.
5. Open a pull request.
6. Merge to `main` after review and checks pass.

## Branching Rules
- Branch from `main`.
- Branch naming:
  - `feature/<short-description>`
  - `fix/<short-description>`
  - `docs/<short-description>`
- Keep each branch focused on one feature or one tightly related change set.

## Orientation Gate (Required Before Coding)
Before writing implementation code, review:
- `docs/features/INDEX.md`
- Relevant feature specs in `docs/features/`
- Relevant architecture docs in `docs/architecture/`

Capture a short orientation note in your branch notes:
- target feature
- key dependencies
- constraints and boundaries
- acceptance criteria for this increment

No implementation starts until this orientation note exists.

## Three-Phase Feature Lifecycle (Required)
Every feature implementation must pass through all three phases.

### 1) Beginning: Orient And Gather Context
Goal: understand exactly what to build and under what constraints.

Required outputs:
- Clear objective statement.
- Constraints and out-of-scope list.
- Acceptance criteria.
- Current progress and known system state.
- Next smallest increment to implement.

### 2) Middle: Execute And Verify
Goal: implement in a controlled feedback loop.

Required behaviors:
- Implement in small, testable increments.
- Use tools and real evidence instead of assumptions.
- Run tests and validation continuously.
- Debug failures before moving on.
- Check outcomes against explicit acceptance criteria.
- Revise plan when new information appears.

### 3) End: Document And Handoff
Goal: leave clean state for the next iteration, agent, or teammate.

Required outputs:
- What was completed.
- What remains.
- Blockers and risks.
- How this increment supports the broader objective.
- First recommended next step.
- Updated docs/checklists/progress notes.

## Loop Rule
The end of one feature cycle becomes the beginning context for the next cycle.
Each handoff should make the next session faster and safer.

## Documentation Rules
- Update docs whenever behavior, interfaces, or constraints change.
- Keep `PRODUCT_SENSE.md`, `DESIGN.md`, `TEST.md`, and this `PLAN.md` aligned with actual practice.
- Avoid stale process docs; if workflow changes, update docs in the same branch.

## Pull Request Checklist
- [ ] Orientation gate completed and recorded.
- [ ] Feature implemented through Beginning/Middle/End phases.
- [ ] Tests added/updated and passing.
- [ ] TDD cycle logs captured per `TEST.md`.
- [ ] Docs updated (feature/architecture/harness docs as needed).
- [ ] Scope is focused and reviewable.

## Merge Criteria
A PR can merge to `main` only when:
- acceptance criteria are met,
- tests pass,
- documentation is up to date,
- and review feedback is resolved.

