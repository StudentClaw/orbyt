---
type: community
cohesion: 0.07
members: 53
---

# Push Notifications

**Cohesion:** 0.07 - loosely connected
**Members:** 53 nodes

## Members
- [[.constructor()_35]] - code - packages/electron/src/push/push-delivery-service.ts
- [[.constructor()_34]] - code - packages/electron/src/push/push-server-rpc-client.ts
- [[.constructor()_33]] - code - packages/electron/src/push/push-store.ts
- [[.constructor()_37]] - code - packages/electron/src/push/weekly-insight-scheduler.ts
- [[.ensureDir()]] - code - packages/electron/src/push/push-store.ts
- [[.getLastWeeklyInsightWeekKey()]] - code - packages/electron/src/push/push-store.ts
- [[.getLinkedDevice()]] - code - packages/electron/src/push/push-store.ts
- [[.getLinkedSubscription()]] - code - packages/electron/src/push/push-store.ts
- [[.getPairingStatus()]] - code - packages/electron/src/push/push-store.ts
- [[.getSettings()]] - code - packages/electron/src/push/push-store.ts
- [[.getVapidKeys()]] - code - packages/electron/src/push/push-store.ts
- [[.handleMessage()_1]] - code - packages/electron/src/push/push-activity-bridge.ts
- [[.linkDevice()]] - code - packages/electron/src/push/push-store.ts
- [[.load()]] - code - packages/electron/src/push/push-store.ts
- [[.persist()]] - code - packages/electron/src/push/push-store.ts
- [[.request()_2]] - code - packages/electron/src/push/push-server-rpc-client.ts
- [[.runCatchUpIfNeeded()]] - code - packages/electron/src/push/weekly-insight-scheduler.ts
- [[.send()_3]] - code - packages/electron/src/push/push-delivery-service.ts
- [[.sendCurrentInsight()]] - code - packages/electron/src/push/weekly-insight-scheduler.ts
- [[.sendTestPush()]] - code - packages/electron/src/push/push-delivery-service.ts
- [[.setLastWeeklyInsightWeekKey()]] - code - packages/electron/src/push/push-store.ts
- [[.setPairingSession()]] - code - packages/electron/src/push/push-store.ts
- [[.start()_4]] - code - packages/electron/src/push/weekly-insight-scheduler.ts
- [[.stop()_3]] - code - packages/electron/src/push/weekly-insight-scheduler.ts
- [[.unlinkDevice()]] - code - packages/electron/src/push/push-store.ts
- [[.updatePairingState()]] - code - packages/electron/src/push/push-store.ts
- [[.updateSettings()]] - code - packages/electron/src/push/push-store.ts
- [[FakeWebSocket_1]] - code - packages/electron/src/__tests__/push-core.test.ts
- [[PushDeliveryService]] - code - packages/electron/src/push/push-delivery-service.ts
- [[PushServerRpcClient]] - code - packages/electron/src/push/push-server-rpc-client.ts
- [[PushStore]] - code - packages/electron/src/push/push-store.ts
- [[WeeklyInsightScheduler]] - code - packages/electron/src/push/weekly-insight-scheduler.ts
- [[computeWeeklyInsightRunAt()]] - code - packages/electron/src/push/weekly-insight-scheduler.ts
- [[computeWeeklyInsightRunForWeek()]] - code - packages/electron/src/push/weekly-insight-scheduler.ts
- [[createPushManager()]] - code - packages/electron/src/push/push-manager.ts
- [[createTempDir()_9]] - code - packages/electron/src/__tests__/push-core.test.ts
- [[createTempDir()_6]] - code - packages/electron/src/__tests__/push-orchestration.test.ts
- [[isQuietHour()]] - code - packages/electron/src/push/push-activity-bridge.ts
- [[isQuietHour()_1]] - code - packages/electron/src/push/weekly-insight-scheduler.ts
- [[isTimeWithinQuietHours()]] - code - packages/electron/src/push/push-store.ts
- [[normalizeSettings()]] - code - packages/electron/src/push/push-store.ts
- [[parsePushEnvelope()]] - code - packages/electron/src/push/push-activity-bridge.ts
- [[parseTime()]] - code - packages/electron/src/push/weekly-insight-scheduler.ts
- [[push-activity-bridge.ts]] - code - packages/electron/src/push/push-activity-bridge.ts
- [[push-core.test.ts]] - code - packages/electron/src/__tests__/push-core.test.ts
- [[push-delivery-service.ts]] - code - packages/electron/src/push/push-delivery-service.ts
- [[push-manager.ts]] - code - packages/electron/src/push/push-manager.ts
- [[push-orchestration.test.ts]] - code - packages/electron/src/__tests__/push-orchestration.test.ts
- [[push-pairing-client.ts]] - code - packages/electron/src/push/push-pairing-client.ts
- [[push-server-rpc-client.ts]] - code - packages/electron/src/push/push-server-rpc-client.ts
- [[push-store.ts]] - code - packages/electron/src/push/push-store.ts
- [[weekStart()]] - code - packages/electron/src/push/weekly-insight-scheduler.ts
- [[weekly-insight-scheduler.ts]] - code - packages/electron/src/push/weekly-insight-scheduler.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Push_Notifications
SORT file.name ASC
```

## Connections to other communities
- 5 edges to [[_COMMUNITY_Plugin Bridge & Attachments]]
- 3 edges to [[_COMMUNITY_Metrics & Tracing Attributes]]
- 3 edges to [[_COMMUNITY_Client Tracing & Observability]]
- 1 edge to [[_COMMUNITY_Chat UI & Composer]]
- 1 edge to [[_COMMUNITY_App Runtime & Test Helpers]]
- 1 edge to [[_COMMUNITY_Auth & Analytics Services]]
- 1 edge to [[_COMMUNITY_Auth Bootstrap & Server Pairing]]

## Top bridge nodes
- [[.handleMessage()_1]] - degree 6, connects to 3 communities
- [[.runCatchUpIfNeeded()]] - degree 9, connects to 2 communities
- [[.updateSettings()]] - degree 8, connects to 2 communities
- [[push-manager.ts]] - degree 9, connects to 1 community
- [[push-activity-bridge.ts]] - degree 7, connects to 1 community