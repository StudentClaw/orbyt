---
type: community
cohesion: 0.06
members: 65
---

# Auth Bootstrap & Server Pairing

**Cohesion:** 0.06 - loosely connected
**Members:** 65 nodes

## Members
- [[.cancelSession()]] - code - packages/electron/src/push/push-pairing-client.ts
- [[.constructor()_1]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[.constructor()_36]] - code - packages/electron/src/push/push-pairing-client.ts
- [[.constructor()_39]] - code - packages/push-relay/src/worker.ts
- [[.createSession()_1]] - code - packages/electron/src/push/push-pairing-client.ts
- [[.fetch()]] - code - packages/push-relay/src/worker.ts
- [[.getSessionStatus()]] - code - packages/electron/src/push/push-pairing-client.ts
- [[BootstrapHttpError]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[PairingSessionDurableObject]] - code - packages/push-relay/src/worker.ts
- [[PushPairingClient]] - code - packages/electron/src/push/push-pairing-client.ts
- [[__resetServerAuthBootstrapForTests()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[auth.ts_1]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[bootstrapServerAuth()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[buildLanguageAssociations()]] - code - references/t3code/scripts/sync-vscode-icons.mjs
- [[buildPairingUrl()]] - code - packages/push-relay/src/worker.ts
- [[cloneRequestForForwarding()]] - code - packages/push-relay/src/worker.ts
- [[completePhonePairing()]] - code - packages/pwa/src/pwa.ts
- [[createServerPairingCredential()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[detectPhonePlatform()]] - code - packages/pwa/src/pwa.ts
- [[downloadVsix()]] - code - references/t3code/scripts/sync-vscode-icons.mjs
- [[exchangeBootstrapCredential()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[extractManifestFromVsix()]] - code - references/t3code/scripts/sync-vscode-icons.mjs
- [[fetchLatestRelease()]] - code - references/t3code/apps/marketing/src/lib/releases.ts
- [[fetchSessionState()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[getCurrentRecord()]] - code - packages/push-relay/src/worker.ts
- [[getDesktopBootstrapCredential()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[getDesktopLocalEnvironmentBootstrap()]] - code - references/t3code/apps/web/src/environments/primary/target.ts
- [[isLoopbackHostname()]] - code - references/t3code/apps/web/src/environments/primary/target.ts
- [[isTransientBootstrapError()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[json()_1]] - code - packages/push-relay/src/worker.ts
- [[listServerClientSessions()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[listServerPairingLinks()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[loadLanguagesCollection()]] - code - references/t3code/scripts/sync-vscode-icons.mjs
- [[main()]] - code - references/t3code/scripts/sync-vscode-icons.mjs
- [[normalizeBaseUrl()]] - code - references/t3code/apps/web/src/environments/primary/target.ts
- [[normalizeExtension()]] - code - references/t3code/scripts/sync-vscode-icons.mjs
- [[normalizeFileName()]] - code - references/t3code/scripts/sync-vscode-icons.mjs
- [[normalizeHostname()]] - code - references/t3code/apps/web/src/environments/primary/target.ts
- [[peekPairingTokenFromUrl()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[putIfAbsent()]] - code - references/t3code/scripts/sync-vscode-icons.mjs
- [[pwa.ts]] - code - packages/pwa/src/pwa.ts
- [[readErrorMessage()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[readPrimaryEnvironmentTarget()]] - code - references/t3code/apps/web/src/environments/primary/target.ts
- [[readSessionId()]] - code - packages/push-relay/src/worker.ts
- [[releases.ts]] - code - references/t3code/apps/marketing/src/lib/releases.ts
- [[requiresStandaloneInstall()]] - code - packages/pwa/src/pwa.ts
- [[resolveConfiguredPrimaryTarget()]] - code - references/t3code/apps/web/src/environments/primary/target.ts
- [[resolveDesktopPrimaryTarget()]] - code - references/t3code/apps/web/src/environments/primary/target.ts
- [[resolveHttpRequestBaseUrl()]] - code - references/t3code/apps/web/src/environments/primary/target.ts
- [[resolveInitialServerAuthGateState()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[resolvePrimaryEnvironmentHttpUrl()]] - code - references/t3code/apps/web/src/environments/primary/target.ts
- [[resolveWindowOriginPrimaryTarget()]] - code - references/t3code/apps/web/src/environments/primary/target.ts
- [[retryTransientBootstrap()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[revokeOtherServerClientSessions()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[revokeServerClientSession()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[revokeServerPairingLink()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[stripPairingTokenFromUrl()_1]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[submitServerAuthCredential()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[sync-vscode-icons.mjs]] - code - references/t3code/scripts/sync-vscode-icons.mjs
- [[takePairingTokenFromUrl()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[target.ts]] - code - references/t3code/apps/web/src/environments/primary/target.ts
- [[toState()_1]] - code - packages/push-relay/src/worker.ts
- [[waitForAuthenticatedSessionAfterBootstrap()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[waitForBootstrapRetry()]] - code - references/t3code/apps/web/src/environments/primary/auth.ts
- [[worker.ts]] - code - packages/push-relay/src/worker.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Auth_Bootstrap_&_Server_Pairing
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_App Runtime & Test Helpers]]
- 4 edges to [[_COMMUNITY_Activity Feed & State]]
- 3 edges to [[_COMMUNITY_Metrics & Tracing Attributes]]
- 2 edges to [[_COMMUNITY_Environment Catalog]]
- 2 edges to [[_COMMUNITY_Academic Data Normalization]]
- 1 edge to [[_COMMUNITY_Plugin Bridge & Attachments]]
- 1 edge to [[_COMMUNITY_Client Tracing & Observability]]
- 1 edge to [[_COMMUNITY_Composer Editor & Mentions]]
- 1 edge to [[_COMMUNITY_Chat View Browser Tests]]
- 1 edge to [[_COMMUNITY_Database Migrations & Onboarding Schema]]
- 1 edge to [[_COMMUNITY_Push Notifications]]

## Top bridge nodes
- [[.fetch()]] - degree 16, connects to 2 communities
- [[json()_1]] - degree 12, connects to 2 communities
- [[retryTransientBootstrap()]] - degree 7, connects to 2 communities
- [[.createSession()_1]] - degree 4, connects to 2 communities
- [[resolvePrimaryEnvironmentHttpUrl()]] - degree 10, connects to 1 community