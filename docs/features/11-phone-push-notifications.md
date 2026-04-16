# Feature 11: Phone Push Notifications

## Status

**TODO** — core implementation exists, but the feature is not yet fully batteries-included or production-ready.

---

## Recap

This feature adds direct phone push notifications from the Electron app by pairing one phone to one desktop profile. The desktop owns the VAPID keys and sends notifications directly with `web-push`. A public phone-facing PWA handles browser notification permission and push subscription creation. A lightweight relay service stores short-lived pairing sessions so the desktop and phone can link safely without keeping push secrets in the relay.

The current UX has been simplified so the main desktop flow is closer to one click:

- `Pair Phone` is the primary action in the main notifications card
- pairing shows a QR and waits for the phone
- linked devices get a simpler state with test/unlink actions
- advanced setup lives in a separate yellow `Admin Setup` area

---

## What Is Done

- [x] Added a phone-facing PWA in `packages/pwa`
  - service worker registration
  - browser push subscription flow
  - pairing completion back to the relay
- [x] Added a pairing relay in `packages/push-relay`
  - Cloudflare Worker entrypoint
  - Durable Object backed pairing session lifecycle
  - pairing session create, fetch, complete, and delete endpoints
- [x] Added Electron push infrastructure in `packages/electron`
  - local VAPID key generation and persistence
  - subscription storage
  - pairing client
  - direct `web-push` delivery
  - weekly insight scheduler
  - invalid subscription cleanup
- [x] Added push IPC handlers so the renderer can manage settings and pairing
- [x] Added workflow activity bridge support so high-priority workflow events can trigger phone pushes
- [x] Added weekly insight generation and scheduled push plumbing
- [x] Added a simplified Settings UI flow
  - main user-facing card for pairing and linked state
  - hidden preferences until a phone is linked
  - yellow `Admin Setup` area for manual setup and testing
- [x] Added regression tests around relay lifecycle, Electron push orchestration, IPC registration, and Settings UI states

---

## What Still Needs To Be Done

### Required For Real End-To-End Use

- [ ] Deploy the relay service to a public HTTPS URL
- [ ] Deploy the PWA to a public HTTPS URL
- [ ] Set the desktop app's relay URL through code or env
  - `PUSH_RELAY_BASE_URL` in Electron
- [ ] Set the relay's public pairing/PWA URL
  - `PAIRING_APP_BASE_URL` in the relay config
- [ ] Run a real phone pairing test on iPhone and Android
- [ ] Verify a successful post-pairing automatic test push
- [ ] Verify workflow-complete pushes arrive on device
- [ ] Verify weekly insight scheduling and missed-run catch-up on resume

### Needed To Make Onboarding Truly Batteries-Included

- [ ] Remove the relay base URL from the normal user flow
- [ ] Preconfigure relay and PWA URLs in code or environment for dev/staging/prod
- [ ] Keep the yellow admin/setup card visible in dev only
- [ ] Replace remaining low-level setup errors with product-level guidance
- [ ] Auto-detect setup readiness and clearly show `Ready`, `Needs setup`, or `Linked`

### Dev Experience Improvements

- [ ] Add a documented local testing path using one temporary HTTPS origin
  - likely via `cloudflared` or `ngrok`
- [ ] Either serve the PWA and relay from one reachable origin in dev or add a proxy layer
  - the current phone page assumes the pairing page and `/api/pairing-sessions/...` share the same origin
- [ ] Add a small setup script or README for local phone testing
- [ ] Seed the relay URL automatically in development so pairing works without manual form entry

### Cleanup Before Production

- [ ] Remove or hide admin/debug controls for production users
- [ ] Confirm notification copy and permission instructions on iPhone
- [ ] Confirm unlinked / expired / denied-permission states are polished
- [ ] Verify subscription invalidation cleanup works against real endpoints
- [ ] Add final deployment notes for relay + PWA hosting

---

## Key Config Notes

- Electron uses `PUSH_RELAY_BASE_URL` as the base URL for relay API calls.
- The relay uses `PAIRING_APP_BASE_URL` to generate the public phone pairing URL embedded in the QR code.
- Full phone testing does **not** work with pure desktop `localhost` only.
- Real phone onboarding requires an HTTPS origin that the phone can reach.

---

## Recommended Next Step

- [ ] Make the dev flow zero-config by hardcoding or env-seeding the relay URL and documenting a one-command tunnel setup so `Pair Phone` works immediately during development.
