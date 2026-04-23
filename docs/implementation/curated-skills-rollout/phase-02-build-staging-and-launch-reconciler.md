# Phase 02 - Build Staging And Launch Reconciler

Last updated: 2026-04-22

## Orientation Note

- **Target feature:** ensure curated `SKILL.md` files ship inside the desktop artifact and land in the **Codex-visible** user skills directory on launch, with **hash-based upgrade** and **fork protection**.
- **Key dependencies:** [Phase 01 - Author Curated Skills With MCP Workflows](phase-01-author-curated-skills-with-mcp-workflows.md), [packages/electron/src/codex/runtime.ts](../../../packages/electron/src/codex/runtime.ts), build pipeline that already stages extensions via [scripts/stage-bundled-extensions.ts](../../../scripts/stage-bundled-extensions.ts) and [scripts/stage-bundled-extensions.test.ts](../../../scripts/stage-bundled-extensions.test.ts).
- **Constraints and boundaries:**
  - Bundled skills in resources are **read-only** at runtime; all user mutations happen in the reconciler target dir under userData.
  - Reconciler must be **idempotent** and safe across app restarts and upgrades.
  - Do not break isolated Codex env vars (`CODEX_HOME`, synthetic `HOME`) established in [runtime.ts](../../../packages/electron/src/codex/runtime.ts).
- **Acceptance criteria for this increment:**
  - `scripts/stage-bundled-skills.ts` exists, mirrors extension staging patterns (deterministic output, test coverage).
  - Build emits `bundled-skills.manifest.json` next to copied skill trees.
  - `prepareIsolatedCodexRuntime` (or a dedicated helper it calls) reconciles manifest → user `.agents/skills/<slug>/SKILL.md` without clobbering divergent user content.
  - `skills.state.json` records last installed bundled hash per slug for upgrade decisions.

## Beginning

### Objective

Separate **source** (`skills/` in repo), **shipped bundle** (resources), and **runtime copy** (userData) so Codex always sees curated skills while students can fork safely.

### Current State

- Repo `skills/` holds authoring (Phase 01).
- Electron creates `mkdirSync(..., ".agents", "skills")` but does not yet populate files from a bundle.
- Extension staging provides a template for discover → copy → manifest sidecars.

### Out Of Scope

- Parser and policy gate (Phase 03).
- Skill Editor UI (Phase 04).

### Acceptance Criteria

- CI runs a test for staging (new `scripts/stage-bundled-skills.test.ts`).
- Packaged app contains the six skill directories under a known resource subpath documented in this phase.
- Reconciler behavior matches the state machine in Middle below.

## Middle

### Implementation Slices

1. **Add** `scripts/stage-bundled-skills.ts` exporting a function analogous to extension staging:

   - Inputs: `skillsRoot` (default `path.join(repoRoot, "skills")`), `outputRoot` (e.g. `release/bundled-skills` or electron `resources` staging dir used by existing desktop build).
   - Behavior: for each immediate child directory `<slug>` containing `SKILL.md`, copy the entire directory to `outputRoot/<slug>/` preserving structure.
   - Compute `contentHash` per `SKILL.md` (SHA-256 of file bytes) and collect `version` from frontmatter if parseable; otherwise default `0.0.0` until Phase 03 parser supplies it reliably — **implementation choice:** prefer hashing file bytes only for manifest truth; version is advisory in manifest.

2. **Emit** `bundled-skills.manifest.json`:

   ```json
   {
     "version": 1,
     "generatedAt": "<iso8601>",
     "skills": [
       { "slug": "plan-mode", "version": "1.0.0", "contentHash": "<sha256>" }
     ]
   }
   ```

3. **Wire** the desktop build script(s) that call `stage-bundled-extensions` to also call `stage-bundled-skills` (exact file: follow the pattern in [scripts/build-macos-desktop-artifact.ts](../../../scripts/build-macos-desktop-artifact.ts) or equivalent after reading that file during implementation).

4. **Implement reconciler** (TypeScript near Electron main or shared util imported by `runtime.ts`):

   - Let `userSkillsRoot = path.join(codexProcessHomePath, ".agents", "skills")` (same tree already created).
   - Let `statePath = path.join(userSkillsRoot, "..", "skills.state.json")` or colocate under `userData` — **pick one path** and document it; must survive upgrades.
   - Load `bundled-skills.manifest.json` from `app.getAppPath()` / `process.resourcesPath` (whichever the app already uses for staged extensions).

   **Reconciliation pseudocode** (normative intent):

   ```ts
   for (const bundled of manifest.skills) {
     const userPath = path.join(userSkillsRoot, bundled.slug, "SKILL.md")
     const prev = state.installed[bundled.slug]
     if (!existsSync(userPath)) {
       copyFromBundle(bundled, userPath)
     } else if (prev && hash(readFileSync(userPath)) === prev.contentHash) {
       copyFromBundle(bundled, userPath) // user file still matches last shipped bytes; safe upgrade
     } else {
       markForkedOrEdited(bundled.slug) // do not overwrite; optional telemetry
     }
     state.installed[bundled.slug] = {
       bundledVersion: bundled.version,
       contentHash: bundled.contentHash,
     }
   }
   ```

   **First install:** `prev` missing → copy.
   **Upgrade untouched:** on-disk hash equals `prev.contentHash` (the hash we stored last launch from bundled content) → copy new bundle.
   **User fork/edit:** on-disk hash differs from `prev.contentHash` → skip overwrite; Phase 04 may surface "update available" UX later.

5. **Edge cases** to cover in tests:

   - Missing manifest → no crash; log and skip or treat as dev-only.
   - Extra directories in user skills root not in manifest → left untouched.
   - Slug in manifest but missing bundled file → fail staging in CI, not at runtime.

### Primary Directories

- `scripts/stage-bundled-skills.ts` (new)
- `scripts/stage-bundled-skills.test.ts` (new)
- `packages/electron/src/codex/runtime.ts` (reconciler hook)
- Desktop build scripts under `scripts/`

### Verification Gates

- **Unit:** staging script test asserts manifest hashes match file contents; filter ignores non-skill dirs.
- **Integration:** one electron-main-level test or harness test that runs reconciler against a temp userData dir (if existing patterns allow; otherwise manual checklist).
- **Manual smoke:** install app fresh → six skills appear under userData `.agents/skills`; edit one skill → restart app after version bump → edited file unchanged, others upgraded.
- **Failure path:** corrupt `skills.state.json` → reconciler resets state safely without deleting user markdown.

### Evidence To Capture

- Test output for new staging test.
- Example `bundled-skills.manifest.json` from CI artifact.

## End

### Done When

- Shipped builds include curated skills and Codex discovers them without relying on repo `skills/` path on end-user machines.

### Handoff To Next Phase

Phase 03 reads `tier`, `version`, and `requested_capabilities` from the reconciled files and enforces grants at the MCP gateway.

### Risks To Carry Forward

- Hash-only upgrade cannot distinguish "user fixed a typo then wants upstream merge" — product may later add explicit "reset to curated" action in Phase 04.
- Manifest `version` vs file `version` frontmatter could drift; prefer single source of truth after Phase 03 parser lands.

### First Recommended Next Step

Start [Phase 03 - Resolver Tier Metadata And Policy Gate](phase-03-resolver-tier-metadata-and-policy-gate.md).
