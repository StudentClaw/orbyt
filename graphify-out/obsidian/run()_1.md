---
source_file: "packages/server/src/db/migrations/011-onboarding-schema-repair.ts"
type: "code"
community: "Database Migrations & Onboarding Schema"
location: "L281"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Database_Migrations_&_Onboarding_Schema
---

# run()

## Connections
- [[011-onboarding-schema-repair.ts]] - `contains` [EXTRACTED]
- [[createDatabase()]] - `calls` [INFERRED]
- [[createOnboardingMetaTable()]] - `calls` [EXTRACTED]
- [[createOnboardingStateTable()]] - `calls` [EXTRACTED]
- [[createRoutinesTable()]] - `calls` [EXTRACTED]
- [[createUserPreferencesTable()]] - `calls` [EXTRACTED]
- [[ensureAiAuthStateTable()]] - `calls` [EXTRACTED]
- [[repairOnboardingStateTable()]] - `calls` [EXTRACTED]
- [[repairRoutinesTable()]] - `calls` [EXTRACTED]
- [[repairUserPreferencesTable()]] - `calls` [EXTRACTED]
- [[runMigrations()]] - `calls` [INFERRED]
- [[runWithAuthControlPlane()]] - `calls` [INFERRED]

#graphify/code #graphify/EXTRACTED #community/Database_Migrations_&_Onboarding_Schema