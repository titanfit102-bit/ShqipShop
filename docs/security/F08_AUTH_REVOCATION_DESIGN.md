# ShqipShop — F08 bearer JWT revocation design (PROPOSAL ONLY)

**Stage 3 scoped CI evidence:** [Medusa backend 40520620233](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40520620233) verified two *distinct* JWTs issued to one synthetic customer: revoking A left B usable only on the two guarded quote endpoints until B was independently revoked. Caller-supplied all-device logout was rejected. This is not a design approval or proof of global/account-wide revocation.


**Stage 2 evidence (2026-10-27):** [Medusa CI 40513465562](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40513465562) additionally confirms one explicitly revoked bearer still reads both built-in private **/store/customers/me** and its **/store/carts/:id** with HTTP 200. The test deliberately removes the disposable PostgreSQL deny-list: scoped quote endpoints respond HTTP 503 for both revoked and valid bearer (fail closed), while the built-in profile still responds HTTP 200. No Medusa-wide enforcement or production policy is deployed. This is an open P0 gap, not a workaround for it.


**Status:** 2026-10-27; architecture and policy proposal, **NOT APPROVED OR DEPLOYED**. No changes to live authentication, Production schema, API keys, sessions, or release gate are authorized. Refer to `AGENTS.md`, [security register](SECURITY_REGISTER.md), [release gates](SECURITY_RELEASE_GATES.md), and [current state](../CURRENT_STATE.md).

## What is verified

Medusa v2 customer JWT and cookie-session logout are not interchangeable. Medusa's official [logout guidance](https://docs.medusajs.com/resources/storefront-development/customers/log-out) says JWT logout removes the browser-held JWT; cookie logout deletes the server session. ShqipShop's real Medusa CI observed that a JWT still worked after cookie logout. [F08 scoped CI](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40503092248) shows that a revoked bearer is denied by the TWO opt-in quote endpoints when a PostgreSQL deny-list guard is attached, while **the same bearer still succeeds on the built-in `GET /store/customers/me`**. This is proof of missing *global* enforcement, not mitigation of it.

## Required product/security decisions BEFORE implementation

1. Decide logout scope: current device, all devices, password reset, suspected compromise, merchant deactivation and customer deletion. Account-wide logout must have server authority, not just local removal.
2. Decide Medusa-compatible token lifecycle: access-token TTL, verified token ID (JTI) or hashed-token deny-list; short-lived refresh-token rotation with reuse detection where supported; device/session identifier, customer-scoped version/epoch for all-device revoke. Never trust the caller to assert a token owner or tenant. Do not invent claims unsupported by verified Medusa token payloads.
3. Identity boundary: tenant-specific Medusa auth service, PostgreSQL/Redis and keys; do not share a deny-list or revocation key across merchants. Protect all private Store and Admin routes AND any alternate entry points (workers, websocket, PWA/native), not merely the two test endpoints. API keys and machine actors require separate policies.
4. Store only keyed/hashed token identifiers and expiry/reason metadata with minimal retention; never log tokens, raw Authorization, customer PII or guest cart proofs. Ensure safe key rotation, GDPR-conscious deletion, operational audit and backup security.
5. Fail closed if revocation lookup is unavailable for protected actions; add bounded latency, rate limits, cache invalidation with strong consistency where required. Prevent accepted-before-revocation races and handle cross-process revocation propagation.
6. Native credentials must migrate away from AsyncStorage to verified secure platform storage. Android/iOS release signing and token revocation must be tested together, not represented by emulator smoke evidence.

## Proposed verification milestones (no production implementation yet)

- Establish actual Medusa 2.22.0 JWT claim semantics, token issuance and supported authentication middleware points; verify whether token format permits safe JTI/version handling.
- Design and security-review revocation for all customer-owned private routes, including receipt, cart mutation, payments, profile, session and token refresh; cover admin roles separately.
- Add one- and all-device logout tests: old JWT cannot authenticate any private route after revoke, new login behaves according to approved policy, cross-tenant and wrong-customer revocation forbidden, invalid token cannot force logout of a victim.
- Add positive and negative concurrency tests, duplicate/logout replay tests, expired JWT, datastore outage/fail-closed, multi-process Redis cache invalidation and rollback/disaster-recovery tests.
- Verify browser CSRF/cookie-origin protections, Android/iOS token deletion, real secure storage, retention, and independent staging acceptance. Gate RG-02 and G3/G5 stay BLOCKED until current release SHA proves all requirements.

**Current code is ONLY a CI fixture:** `medusa-backend-poc/apps/backend/src/api/middlewares/f08-revocation-ci.ts`, `src/api/store/shqipshop/f08-token-revoke-ci/route.ts`, `src/scripts/f08-revocation-fixture-ci.ts`, `scripts/f08-jwt-revocation-ci.mjs`. Exact disposable localhost/PostgreSQL/Redis flags guard it, and its deny-list is dropped. It does not replace Medusa's global authentication machinery or solve F08.
