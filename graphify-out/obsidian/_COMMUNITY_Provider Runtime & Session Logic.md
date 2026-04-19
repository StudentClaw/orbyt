---
type: community
cohesion: 0.07
members: 53
---

# Provider Runtime & Session Logic

**Cohesion:** 0.07 - loosely connected
**Members:** 53 nodes

## Members
- [[asRecord()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[asTrimmedString()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[collapseDerivedWorkLogEntries()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[collectChangedFiles()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[compareActivitiesByOrder()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[compareActivityLifecycleRank()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[deriveActivePlanState()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[deriveActiveWorkStartedAt()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[deriveCompletionDividerBeforeEntryId()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[derivePendingApprovals()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[derivePendingUserInputs()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[derivePhase()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[deriveTimelineEntries()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[deriveToolLifecycleCollapseKey()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[deriveWorkLogEntries()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[executableBasename()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[extractChangedFiles()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[extractToolCommand()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[extractToolTitle()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[extractWorkLogItemType()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[extractWorkLogRequestKind()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[findLatestProposedPlan()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[findShellWrapperSpec()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[findSidebarProposedPlan()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[formatCommandArrayPart()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[formatCommandValue()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[formatDuration()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[formatElapsed()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[hasActionableProposedPlan()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[hasToolActivityForTurn()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[inferCheckpointTurnCountByTurnId()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[isLatestTurnSettled()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[isPlanBoundaryToolActivity()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[isStalePendingRequestFailureDetail()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[isToolLifecycleItemType()]] - code - references/t3code/packages/contracts/src/providerRuntime.ts
- [[mergeChangedFiles()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[mergeDerivedWorkLogEntries()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[normalizeCommandValue()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[normalizeCompactToolLabel()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[parseUserInputQuestions()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[providerRuntime.ts]] - code - references/t3code/packages/contracts/src/providerRuntime.ts
- [[pushChangedFile()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[requestKindFromRequestType()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[session-logic.ts]] - code - references/t3code/apps/web/src/session-logic.ts
- [[shouldCollapseToolLifecycleEntries()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[splitExecutableAndRest()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[stripTrailingExitCode()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[toDerivedWorkLogEntry()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[toLatestProposedPlanState()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[toRawToolCommand()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[trimMatchingOuterQuotes()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[unwrapCommandRemainder()]] - code - references/t3code/apps/web/src/session-logic.ts
- [[unwrapKnownShellCommandWrapper()]] - code - references/t3code/apps/web/src/session-logic.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Provider_Runtime_&_Session_Logic
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_Composer Draft & Orchestration]]
- 2 edges to [[_COMMUNITY_Activity Feed & State]]
- 2 edges to [[_COMMUNITY_App Runtime & Test Helpers]]
- 1 edge to [[_COMMUNITY_Auth & Analytics Services]]
- 1 edge to [[_COMMUNITY_UI Component Library]]
- 1 edge to [[_COMMUNITY_Chat View Browser Tests]]

## Top bridge nodes
- [[derivePendingApprovals()]] - degree 6, connects to 3 communities
- [[derivePendingUserInputs()]] - degree 6, connects to 3 communities
- [[findLatestProposedPlan()]] - degree 4, connects to 1 community
- [[isToolLifecycleItemType()]] - degree 3, connects to 1 community
- [[isLatestTurnSettled()]] - degree 3, connects to 1 community