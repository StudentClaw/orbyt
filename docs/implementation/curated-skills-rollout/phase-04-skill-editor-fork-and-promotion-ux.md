# Phase 04 - Skill Editor Fork And Promotion UX

Last updated: 2026-04-22

## Orientation Note

- **Target feature:** let students **see** skill trust state, **fork** curated skills into editable custom copies, **author** custom skills, and **promote** capabilities one at a time with explicit grants written to the Phase 03 store.
- **Key dependencies:** [Phase 03 - Resolver Tier Metadata And Policy Gate](phase-03-resolver-tier-metadata-and-policy-gate.md), [docs/features/03-skill-system.md](../../features/03-skill-system.md), existing chat components [packages/ui/src/components/chat/SkillPicker.tsx](../../../packages/ui/src/components/chat/SkillPicker.tsx), server websocket routes under `packages/server/src/ws/`.
- **Constraints and boundaries:**
  - Forking copies markdown and metadata but **not** trust tier (spec decision).
  - Promotion is **per capability key**, not "trust this file completely."
  - UI must not imply that checking a box bypasses the gate — grants persist server-side only.
- **Acceptance criteria for this increment:**
  - SkillPicker shows tier (curated vs custom) and surfaces missing grants when a skill requests more than granted.
  - SkillForkDialog duplicates a curated skill to user space with new slug or enforced `tier: custom` + `forkedFrom` on same slug per product choice (recommend **new slug** `plan-mode-custom` vs overwrite — **default:** fork creates `<slug>-fork` or user-named slug to avoid reconciler fighting curated slug; document final UX).
  - SkillPromotionDialog lists `requested_capabilities` keys with human descriptions and toggles grants via authenticated IPC.
  - SkillEditor allows create/edit/delete for **custom** skills only under user `.agents/skills/` paths exposed through safe APIs.

## Beginning

### Objective

Close the loop between static markdown, runtime enforcement, and student-controlled capability expansion.

### Current State

- SkillPicker exists; tier badges and promotion flows do not.
- No in-app markdown editor wired to skill files in repo layout from spec ([docs/features/03-skill-system.md](../../features/03-skill-system.md) proposed paths).

### Out Of Scope

- Community marketplace for skills (explicitly deferred in spec).
- Remote sync of skills across devices.

### Acceptance Criteria

- All flows below have UI + server endpoints + tests.
- `plan-mode` calendar write remains impossible without explicit promotion + in-chat approval path.

## Middle

### Implementation Slices

1. **SkillPicker enhancements** ([SkillPicker.tsx](../../../packages/ui/src/components/chat/SkillPicker.tsx)):

   - Badge: `Curated`, `Custom`, `Forked` (derived from `forkedFrom` presence).
   - When selected skill has `requestedCapabilities` not covered by grants, show sublabel "Needs permission" with CTA opening SkillPromotionDialog.

2. **SkillForkDialog** (new component under `packages/ui/src/components/skills/`):

   - Source: curated `ResolvedSkill` from picker.
   - Action: call server `skills.fork` RPC with `{ sourceSlug, targetSlug?, displayName? }`.
   - Server copies SKILL.md text, sets `tier: custom`, sets `forkedFrom: <source>@<version>`, writes into user skills root only.
   - Prevent forking into an existing slug without confirmation.

3. **SkillEditor** (new):

   - Markdown editor with frontmatter validation client-side (lightweight) + server-side parse on save.
   - Save path restricted to custom skills the user owns (not bundled read-only resource).
   - On save, trigger SkillResolver refresh or file watcher reload (if watcher exists; else explicit reload RPC).

4. **SkillPromotionDialog** (new):

   - Lists each `requested_capabilities` entry with plain-language description (static map in UI constants keyed by logical capability from Phase 00).
   - Toggle calls `skills.grantCapability` / `skills.revokeCapability` RPCs.
   - Flagship case: `calendar.events.write` for `plan-mode` shows extra warning and requires checkbox + confirm.

5. **Server RPC / WS handlers:**

   - Validate session, validate slug ownership, write grant store file from Phase 03, return updated `ResolvedSkill`.

6. **Optional "Reset to curated"** (nice-to-have):

   - If reconciler detected fork/upgrade conflict in Phase 02, offer button to discard local `SKILL.md` and re-copy bundled — must be explicit destructive confirm.

### Primary Directories

- `packages/ui/src/components/skills/` (new)
- `packages/ui/src/components/chat/SkillPicker.tsx`
- `packages/server/src/ws/Router.ts` or dedicated skills route module
- `packages/contracts/` for RPC message shapes

### Verification Gates

- **Unit:** reducer / hook tests for grant state; server validation tests rejecting illegal fork paths.
- **Integration:** UI test (React Testing Library) for fork + promotion happy path.
- **Manual smoke:** fork `plan-mode`, edit instructions, confirm Codex picks up new text from user dir; confirm calendar write still blocked until promotion.
- **Failure path:** attempt grant API without auth → 401; attempt edit curated bundle path → rejected.

### Evidence To Capture

- Screen recording of fork + promotion + blocked tool call.
- RPC contract snippet in handoff log.

## End

### Done When

- Students can understand trust at a glance, safely fork, and expand capabilities without markdown becoming the security layer.

### Handoff To Next Phase

None scoped in this rollout; follow-up work might include marketplace, skill versioning UI, or cross-device sync.

### Risks To Carry Forward

- Editor foot-guns: broken frontmatter could drop skill from registry — show inline errors and never save partial YAML.
- Slug namespace collisions between user skills and future curated additions — reserve prefixes or validate on fork.

### First Recommended Next Step

Run full regression: `bun run typecheck`, targeted UI and server tests, then update [GLOSSARY.md](GLOSSARY.md) phase tracker when all phases ship.
