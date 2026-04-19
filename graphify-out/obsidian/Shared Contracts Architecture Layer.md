---
source_file: "docs/architecture/01-shared-contracts.md"
type: "document"
community: "Shared Contracts & Architecture"
tags:
  - graphify/document
  - graphify/EXTRACTED
  - community/Shared_Contracts_&_Architecture
---

# Shared Contracts Architecture Layer

## Connections
- [[Branded Types (CourseId, CourseWorkItemId, SkillId)]] - `references` [EXTRACTED]
- [[Domain Schemas (Course, CourseWorkItem, Grade, PlannedSession, etc.)]] - `references` [EXTRACTED]
- [[Effect Schema (vs ZodYupio-ts)]] - `references` [EXTRACTED]
- [[IPC Contracts (Renderer↔Main Channels)]] - `references` [EXTRACTED]
- [[Shared Contracts (Foundation)]] - `implements` [EXTRACTED]
- [[Typed Errors (CanvasAuthError, CodexSpawnError, PluginStartError, etc.)]] - `references` [EXTRACTED]
- [[WebSocket Transport Contracts (Client↔Server Messages)]] - `references` [EXTRACTED]

#graphify/document #graphify/EXTRACTED #community/Shared_Contracts_&_Architecture