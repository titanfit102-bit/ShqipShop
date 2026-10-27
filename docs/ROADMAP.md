# ShqipShop — ROADMAP me prova për çdo fazë

## 2026-10-27 — F08 Stage 3: independent same-customer bearer tokens (disposable CI)

F08 scoped two-device JWT behavior verified in [Medusa CI 40520620233](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40520620233); **does not** approve all-device logout or solve global Medusa/private API revocation. Production implementation and release remain blocked.


## 2026-10-27 — F08 Stage 2: revoked JWT private-cart replay and deny-list outage (CI only)

**VERIFIED CODE:** [e72bb04](https://github.com/titanfit102-bit/ShqipShop/commit/e72bb0477f41acf97f68d89f6767d1cffb003108), Draft [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12); **8/8 GitHub Actions SUCCESS at this code SHA**. [Medusa backend run 40513465562](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40513465562) logged `SHQIPSHOP_F08_GLOBAL_BEARER_REVOCATION_REMAINS_OPEN_STORE_CART_200`, `SHQIPSHOP_F08_CI_DENYLIST_UNAVAILABLE_GUARDED_BEARER_503` and `SHQIPSHOP_F08_CI_OUTAGE_GLOBAL_PRIVATE_STORE_STILL_UNGUARDED`, in addition to the earlier profile replay proof. Existing tenant, checkout, Redis, native, security and pilot checks remained green.

**SCOPE:** Extended existing synthetic CI-only `medusa-backend-poc/scripts/f08-jwt-revocation-ci.mjs` to show the same *explicitly revoked* JWT still receives HTTP 200 on Medusa's normal private customer-profile AND owner-cart reads. After deliberately dropping the **disposable** deny-list table, guarded F07g quote endpoint denies both revoked and otherwise valid bearer with HTTP 503 (fail-closed); the built-in private profile endpoint remains unguarded. No real customer data or mutations, no global Medusa auth middleware changes, no permanent DB schema/migration, new credentials, money, merge or Production. F08 remains **P0 PARTIAL**, not fixed. No guarantee of account/device-wide logout or private-route coverage.

**NEXT:** do not infer global JWT revocation from isolated guard; obtain separate approval for complete Medusa token lifecycle, enforcement at every private API, credential rotation and native secure token storage. F07g order/payment locking, F09 single commerce authority and G3/G5 release still BLOCKED. Following docs commit has independent CI outcome.



## 2026-10-27 — F08 Stage 1: disposable JWT revocation guard and demonstrated global gap

**VERIFIED CODE:** [2237118](https://github.com/titanfit102-bit/ShqipShop/commit/2237118a43eed863b515ed60852b133f9f564512), **8/8 GitHub Actions SUCCESS** on that exact code SHA; [Medusa smoke 40503092248](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40503092248) logged `SHQIPSHOP_F08_DISPOSABLE_PER_TOKEN_HTTP_REVOCATION_DENIES_GUARDED_QUOTE` and `SHQIPSHOP_F08_GLOBAL_BEARER_REVOCATION_REMAINS_OPEN_STORE_ME_200`. Guest/customer quote and Medusa order/price/Redis checks remained green.

**IMPLEMENTED / TESTED ONLY IN DISPOSABLE CI:** A per-bearer SHA-256 digest revocation table is created/dropped in disposable PostgreSQL via `f08-revocation-fixture-ci.ts`. Explicit CI-only authenticated bearer POST `/store/shqipshop/f08-token-revoke-ci` inserts only its own Medusa-validated token digest; tests deny a forged JWT, forged merchant, altered caller identity, and prove idempotent revocation. `enforceF08CiBearerPolicy` rejects a revoked JWT on the two disposable quote test endpoints, failing closed on storage errors. Crucially the SAME token continues to receive HTTP 200 at the unguarded built-in Medusa `/store/customers/me` endpoint. **Global F08 IS NOT IMPLEMENTED**, and session logout is not bearer revocation. No customer data, permanent DB, production middleware, auth policy migration, external payments or live deployment changed.

**BLOCKED / NEXT:** Design and separately authorize a comprehensive per-merchant authenticated-route revocation/rotation/expiry strategy, including all Store order/customer/cart mutations, admin/worker roles as applicable, cookie-session logout, native secure storage, token refresh/password-change/device policy, failure cases and independent negative integration tests. Read [F08 design](security/F08_AUTH_REVOCATION_DESIGN.md) from docs; F07g PSP/atomicity, F09 commerce authority and G3/G5 gates remain blocked. PR #12 stays Draft. CI status of the following documentation SHA requires separate verification.



## 2026-10-27 — F07g Stage 2C-5: one claimed checkout intent per real Medusa cart (CI)

**VERIFIED code:** [e59831c](https://github.com/titanfit102-bit/ShqipShop/commit/e59831c81bbc071077a30668858c110b4b789655), [Medusa CI 40499708458](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40499708458); **8/8 GitHub Actions SUCCESS** at that code SHA on Draft PR #12. In `f07g-live-cart-snapshot-ci.ts` the disposable PostgreSQL fixture now has a partial unique index on `(tenant_id,cart_id) WHERE status='claimed'`, and the CI-only `quote-claim-ci.ts` treats PostgreSQL error 23505 as a denied competing claim. Four concurrent claims on **two separately accepted quote IDs for one real Medusa cart** result in exactly one local claim. Same-quote replay, stale price, tenant/buyer denial, registered/guest HTTP and other checks remain passing.

**BOUNDARY:** This prevents duplicate *CI quote intent states for one cart*, not duplicate Medusa orders, inventory reservations or PSP charges. Only disposable test table; NO production schema/migration, real payment/order/stock transaction or release. F07g final, F08 token revocation, F09 commerce authority, G3/G5 remain BLOCKED. Next requires an explicitly approved durable quote model plus Medusa checkout workflow/idempotency/PSP design; do not merge/deploy. This documentation SHA's CI must be checked separately.



## 2026-10-27 — F07g Stage 2C-4: registered buyer HTTP quote evidence

**VERIFIED:** code [cfcd8b0](https://github.com/titanfit102-bit/ShqipShop/commit/cfcd8b047ac0ee79c0740c5ecaeb09fc171f4f42), Draft [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12); **8/8 GitHub Actions SUCCESS** on that code SHA. [Medusa backend 40448041404](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40448041404) verified real synthetic registered owner cart with Medusa, independently scoped database quote pre-issuance, bearer HTTP review/accept, two concurrent accepts with exactly one winner, foreign buyer/guest downgrade/invalid bearer/tenant spoof/client total denial, and HTTP 409 on replay and after real catalogue repricing. Prior guest path and F07f payment amount 409, tenant A/B, Redis and native checks remain passing.

**SCOPED ONLY:** Added `medusa-backend-poc/scripts/f07g-http-registered-quote-ci.mjs`, `apps/backend/src/scripts/f07g-registered-http-quote-fixture-ci.ts` and backend smoke orchestration. Customer quotes are pre-issued **only by disposable CI script**, not by production Store API. One ALL-priced item; no shipping, tax, promotion or real PSP. Cookies deliberately denied (no CSRF design); there is no customer-facing quote UI, durable migration, live cart/stock/payment/order lock, webhook/refunds or real payment. F08 bearer JWT still works after cookie logout; F09 single commerce authority, G3/G5 release gates BLOCKED. PR remains Draft, no main merge/deploy/migrations. Next requires separately authorized durable quote/checkout architecture; continue only scoped synthetic tests until then. Docs commit CI separate.



## 2026-10-27 — F07g Stage 2C-3: CI-only Medusa HTTP quote review/accept

**VERIFIED code:** [b64e25c](https://github.com/titanfit102-bit/ShqipShop/commit/b64e25c9c44f68d69fbbb138b0237492ec550c79), Draft [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12), **8/8 GitHub Actions SUCCESS** at the code SHA. [Backend smoke 40447001570](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40447001570) confirms real Medusa guest quote HTTP GET review; two competing POST accept attempts yield one 200 and one 409; replay and stale catalogue review/accept 409; tenant/proof/auth spoof and client-total injection denied; acceptance stored in disposable PostgreSQL across Medusa processes, while existing tenant, Redis, native and security gates remained green.

**Scope:** CI-gated `src/api/store/shqipshop/quote-review-accept-ci/route.ts`, Medusa session/bearer middleware, `scripts/f07g-http-review-accept-ci.mjs` and disposable quote fixtures in `src/scripts/f07g-live-cart-snapshot-ci.ts`. A **guest** quote is pre-issued only by Medusa CI script, not by Store API. Restricted to one real synthetic ALL-priced cart item with no shipping or discounts. Cookies denied (no CSRF contract); registered customer HTTP positive path not yet covered. NO durable production quote, approved migration, buyer-visible UI, real PSP or atomic Medusa cart/order/stock/payment lock.

**Next:** add isolated registered-customer positive HTTP quote review/accept with independently created owner-bound cart and foreign-principal downgrade negatives; separately review migration/checkout architecture before authorization. F08 JWT revocation, F09 commerce authority and G3/G5 release gates remain BLOCKED. No main merge or deployment. Following docs commit needs own CI evaluation.



## 2026-10-27 — F07g Stage 2C-2: disposable pre-payment quote-intent claim + durable-design proposal

**VERIFIED TEST CODE:** [commit 59b9153](https://github.com/titanfit102-bit/ShqipShop/commit/59b91530ecb18f2fb2bde2e75234071039b7663f) on Draft [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12), **8/8 GitHub Actions SUCCESS** on that exact SHA. [Medusa smoke 40445884796](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40445884796) logged `SHQIPSHOP_F07G_REAL_MEDUSA_PG_PREPAYMENT_INTENT_SINGLE_CLAIM_PASSED`, `SHQIPSHOP_F07G_REAL_MEDUSA_PG_STALE_ACCEPTED_INTENT_CLAIM_DENIED`, plus original single-acceptance/reprice and F07f HTTP 409 proofs.

**IMPLEMENTED:** CI-only `medusa-backend-poc/apps/backend/src/lib/checkout/quote-claim-ci.ts` provides a second one-winner PostgreSQL status CAS (`accepted→claimed`), scoped to tenant/cart/buyer/fingerprint, with strict stored expiry and fresh Medusa quote verification. Extended `f07g-live-cart-snapshot-ci.ts` to test concurrent claim, wrong tenant/buyer/fingerprint, expired/repriced state, replay, persistence across separate Medusa executions, and the denial of claiming a previously accepted offer after repricing. Disposal table and synthetic cart only; no production payment effects. New [F07g durable design](checkout/F07G_DURABLE_QUOTE_DESIGN.md) is a proposal, **not approved schema/API architecture**.

**P0 STILL OPEN:** a DB-only intent claim is NOT a Medusa order/cart stock lock or exactly-once PSP charge. There is no production quote migration, HTTP buyer review/accept, complete taxes/shipping/discount rules, PSP callback/refund reconciliation, or buyer UI acceptance. F08 JWT revocation, F09 unified commerce, G3/G5 release gates remain blocked; native secure token/release signing also open. No merge, main, Production deploy, live payment, secrets or migration changes. The following docs commit will require its own CI verification.



## 2026-10-26 — F07g Stage 2C-1: PostgreSQL acceptance of actual Medusa cart quote (CI)

**VERIFIED CODE:** [99d008a](https://github.com/titanfit102-bit/ShqipShop/commit/99d008a1913041dcbb98d6a0d9f096f42841ca51) on Draft [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12); **8/8 PR GitHub Actions SUCCESS** at exactly that SHA. [Medusa smoke 40364666854](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40364666854) proves `SHQIPSHOP_F07G_REAL_MEDUSA_PG_ATOMIC_SINGLE_ACCEPTANCE_AND_REPLAY_DENIED` and `SHQIPSHOP_F07G_REAL_MEDUSA_PG_REPRICE_DENIES_PENDING_QUOTE_ACROSS_PROCESSES`, while F07f HTTP 409, Medusa A/B, Redis F07c/F07d, pilot, native and security baseline also passed. The real **disposable** Medusa cart and linked live catalogue ALL price now yield quote snapshots persisted in a temporary PostgreSQL table; two concurrent transactions permit one acceptance only, foreign tenant/buyer, expired/replayed and mismatched price revision are denied. A separate Medusa process reads stored quote state after repricing, and the previously pending quote cannot become accepted. Temp fixture table is dropped after the two-phase test.

**P0 remains PARTIAL / release BLOCKED:** single-item ALL-only CI fixture, no production quote persistence/migration, server HTTP review/accept, audited buyer-facing consent, full tax/shipping/discount/reprice engine, transactionally coordinated **live** cart/payment/order with PSP, signed callbacks/refunds, UI or staging. DB quote compare-and-swap does **not** lock the actual Medusa price/order workflow; TOCTOU remains until production workflow design is approved. F08 bearer JWT remains usable after cookie logout; F09 unified commerce open. No main/merge/deploy/secrets/payment changes. **Next:** design separately controlled tenant-local quote model, HTTP review/accept and cart/payment/order locking, with authorizations and full negative/replay/stale tests before actual migration. New documentation HEAD requires its own CI result.



## 2026-10-26 — F07g Stage 2B-2C: real Medusa customer HTTP proof

**VERIFIED code:** [41ff8a8](https://github.com/titanfit102-bit/ShqipShop/commit/41ff8a8ed9feced57d55bbc74fc341e66e3ae557), Draft [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12), **8/8 scoped CI SUCCESS**. [Backend smoke 40362438097](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40362438097) shows `SHQIPSHOP_F07G_REAL_CUSTOMER_BEARER_OWN_CART_HTTP_PASSED`, `SHQIPSHOP_F07G_REAL_CUSTOMER_FOREIGN_BEARER_AND_GUEST_DOWNGRADE_DENIED`, `SHQIPSHOP_F07G_REAL_CUSTOMER_COOKIE_SESSION_AND_LOGOUT_DENIAL_PASSED`; previous guest principal, PostgreSQL single-winner, real catalogue repricing and F07f HTTP 409 still passed. F07c/d, native, A/B, pilot and scanner passed at identical SHA.

**Implemented:** `medusa-backend-poc/scripts/f07g-http-registered-customer-ci.mjs` in existing backend smoke workflow: use real disposable Medusa customer registrations, customer bearer JWTs, explicitly associate a customer with a new cart via authenticated `POST /store/carts/:id/customer`; read back server `customer_id`, require own-cart bearer and cookie access, reject foreign bearer even with guest cart proof, reject guest downgrade of an account cart, invalid bearer, tampered and logged-out cookies, and header tenant spoofing. Only synthetic customers/URLs/keys; no payment, quote issuance, checkout policy or schema migration.

**Observed F08 OPEN:** `SHQIPSHOP_F07G_POST_COOKIE_LOGOUT_BEARER_STATUS 200`. Medusa session logout invalidated its cookie, **not** the previously issued bearer JWT. Do not claim account-wide or multi-device logout. Server revocation/TTL and token-at-rest remain P0. **F07g still PARTIAL**: CI-only authorization probe is not persistent production quote, buyer review/accept or payment/order lock; PSP, race/replay, stock and client UI remain gating. G3/G5 BLOCKED, F09 OPEN. No merge/main/Production. CI for the following documentation SHA must be checked separately.



## 2026-10-26 — F07g Stage 2B-2B: CI-gated Medusa HTTP buyer/capability boundary

**CODE VERIFIED:** [commit `1cd4bd9`](https://github.com/titanfit102-bit/ShqipShop/commit/1cd4bd951df978dd84255d09734f821b12735e07) on `feat/merchant-auth-boundary-ci`, Draft [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12), **8/8 GitHub Actions SUCCESS** at this code SHA. [Backend smoke 40328961097](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40328961097) logged `SHQIPSHOP_F07G_REAL_HTTP_GUEST_CAPABILITY_AND_TENANT_SPOOF_DENIED` and `SHQIPSHOP_F07G_REAL_HTTP_INVALID_AUTH_NO_GUEST_DOWNGRADE`, plus existing F07g PostgreSQL single-winner and stale-price checks and F07f active stale-payment HTTP 409 twice. Parallel tenant, Redis, native, pilot and security baseline tests also passed.

**Implemented:** `src/api/store/shqipshop/quote-boundary-ci/route.ts` is a **read-only-in-effect HTTP authorization probe** (POST with no body; reads one real disposable Medusa cart only; does NOT create/accept quotes, orders or payments); `src/api/middlewares.ts` attaches the actual Medusa customer session/bearer authentication middleware with fail-closed guest downgrade; `scripts/f07g-http-quote-boundary-ci.mjs` verifies correct guest cart capability and denies missing/foreign proof, unknown cart, caller-supplied tenant header/body, forged Authorization and invalid cookie. Route is disabled unless the process has exact disposable CI-only environment/DB/Redis markers, including `SHQIPSHOP_F07G_HTTP_CI=true`; no live deployments, secrets or release changes. Tenant identifier is provisioned in test backend, never from user. Output omits raw cart capability, customer and PII. Test uses only synthetic data. **The tested HTTP positive path is GUEST, not a real authenticated-customer HTTP session.**

**LIMITS / next:** No persistent production quote table, HTTP *review/accept* contract, customer token/session positive proof, server pricing/shipping/tax snapshot for arbitrary carts, cart-payment-order transaction and idempotency lock, UI consent or real PSP. G3/G5 BLOCKED; F08 JWT revocation and F09 unified commerce OPEN. Keep production gate closed. Next F07g Stage 2B-2C should prove real customer-session HTTP positive and invalidation/expiry, then tenant-local persistent state and atomic payment/order integration with explicit approval and safe migrations. The follow-up docs commit's CI is separate.



## 2026-10-25 — F07g Stage 2B-2A: server-derived tenant/buyer quote binding

**IMPLEMENTED / backend CI VERIFIED:** [code `5d0f6320`](https://github.com/titanfit102-bit/ShqipShop/commit/5d0f6320720d6527a69e87275aaf914859084a7a) on `feat/merchant-auth-boundary-ci`, [Draft PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12). [Medusa backend CI 40240684456](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40240684456) **SUCCESS**: `SHQIPSHOP_F07G_GUEST_CAPABILITY_TENANT_HMAC_AND_DOWNGRADE_DENIED`, `SHQIPSHOP_F07G_CUSTOMER_MEDUSA_PRINCIPAL_OWNERSHIP_PASSED`, `SHQIPSHOP_F07G_POSTGRES_ATOMIC_SINGLE_ACCEPTANCE_AND_REPLAY_DENIED`, `SHQIPSHOP_F07G_REAL_MEDUSA_REPRICE_INVALIDATES_BUYER_QUOTE_PASSED` and existing F07f HTTP 409 test. Overall CI at this checkpoint: **7/8 SUCCESS; pending: Verify native Medusa source**; do not equate pending with green.

Added `src/lib/checkout/quote-principal.ts`, CI-only `src/scripts/f07g-principal-binding-ci.ts`. Trusted adapter contract binds deployment tenant + Medusa cart + validated customer actor or unguessable guest cart capability, rejects foreign customer/tenant/proof and failed Authorization downgrade. Guest binding stores only tenant-separated HMAC-SHA256 digest (no raw proof). Integrated into real disposable Medusa cart repricing proof and PostgreSQL acceptance test. CI quote fixture persists `issued_at_ms` and checks it from DB, rejecting caller-supplied issued-time spoofing. All tests use per-run synthetic CI key/credentials; there are **no new HTTP endpoints, production tables, migrations, checkout/payment hooks, devices, secrets, release or deploy**.

**P0 remains OPEN:** caller must validate *actual* Medusa JWT/cookie/session auth and cookie-failure downgrade, tenant source and original cart capability before invoking helper; use a separately managed and rotated production HMAC key. Tenant-local persistent quote migration and schema authorization, server-authoritative cart/pricing/shipping/tax adapter, expiration/race-safe HTTP 409 review/accept, atomic payment/order/idempotency lock, buyer UX, real PSP/3DS/refunds, G3/G5 and F08/F09 remain unimplemented/blocked. This is a narrow CI guard, **not** production buyer authentication. The following documentation HEAD requires its own CI verification.



## F07g Stage 2B-1 — real Medusa cart/catalogue repricing boundary (2026-10-25)

**Verified CODE [ff8486de](https://github.com/titanfit102-bit/ShqipShop/commit/ff8486deb75bc13f24e3428fa4fc2ab1b2591d20)**, Draft [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12): **8/8 pull-request GitHub Actions SUCCESS** at this exact SHA, including [backend smoke 40186854917](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40186854917), [parallel isolation 40186854949](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40186854949), [F07c 40186854929](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40186854929), [F07d 40186854919](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40186854919), native, pilot and security scanner. New `f07g-live-cart-snapshot-ci.ts` uses **real disposable Medusa cart and linked ALL price rows via server Query Graph**, not a client-supplied price. It creates a CI-only accepted quote snapshot, then uses Medusa's existing variant-price workflow to reprice the catalogue and proves the prior acceptance fingerprint is invalid; **real current cart retained a stale unit amount**. Verified log markers: `SHQIPSHOP_F07G_REAL_MEDUSA_CART_SNAPSHOT_BEFORE_REPRICE_PASSED`, `SHQIPSHOP_F07G_REAL_MEDUSA_STALE_CART_UNIT_OBSERVED_NOT_APPROVED`, `SHQIPSHOP_F07G_REAL_MEDUSA_REPRICE_INVALIDATES_BUYER_QUOTE_PASSED`. Earlier PostgreSQL atomic-acceptance Stage 2A, F07f real HTTP 409 and old checkout/inventory regressions still pass. Medusa's framework `BigNumber` computed fields required exact `MathBN` normalization rather than JavaScript `String()` or float rounding; first two attempts (e67528c7 and 6a0bf618) failed this NEW test and were corrected, not bypassed.

**Evidence scope / P0 still OPEN:** Single-item, ALL-currency, no shipping/discount context, mock-only disposable CI and synthetic buyer binding. This **does not** add an HTTP review/accept endpoint, tenant-local permanent quote migration, authenticated guest/customer capability verification, full Medusa pricing rules, production server payment/order hook, transactional lock for concurrent checkout, native/PWA consent UX, real PSP/webhook/refunds or production security. Next Stage 2B-2: design/authorize tenant-isolated durable quote model and server-validated principal + fresh cart/pricing adapter, then fail-closed HTTP 409 and atomic payment/order coupling with parallel/replay/PSP sandbox proof. G3/G5 BLOCKED, F08/F09 OPEN. No main, merge, deploy, payment-policy activation, secrets or Production changes. This new documentation HEAD needs separate CI verification.



## F07g Stage 2A — PostgreSQL atomic-acceptance CI, 2026-10-25

**Verified code [8f5a5b53](https://github.com/titanfit102-bit/ShqipShop/commit/8f5a5b53bdb3c534f7867949b7cc926fb782ada7)** on Draft PR #12: **8/8 PR workflows SUCCESS** including [backend 40182883873](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40182883873), [F07c 40182883858](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40182883858), [F07d 40182883860](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40182883860), isolation, native, pilot and security baseline. New `f07g-persisted-quote-ci.ts` uses Medusa's PostgreSQL connection and a disposable table in CI only; validates scoped tenant/cart/guest acceptance, rejected expired/stale prices, one-winner concurrent acceptance, replay denial and transaction rollback. Backend logs show `SHQIPSHOP_F07G_POSTGRES_TENANT_PRINCIPAL_AND_EXPIRY_DENIAL_PASSED`, `SHQIPSHOP_F07G_POSTGRES_ATOMIC_SINGLE_ACCEPTANCE_AND_REPLAY_DENIED`, `SHQIPSHOP_F07G_POSTGRES_TRANSACTION_ROLLBACK_PASSED`; old F07f HTTP 409 tests still green.

**F07c regression repaired:** [2b91c545](https://github.com/titanfit102-bit/ShqipShop/commit/2b91c5457b32ae3fd10943a3b188b132219f8816) replaced two Redis `--scan | grep -q .` pipelines (SIGPIPE/exit 141 under `pipefail`) with full-output-consuming `grep . >/dev/null` while preserving both pre/post restart checks; [F07c 40182883858](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40182883858) SUCCESS. Historical failed run 40182334895 remains recorded.

**Strict limits:** This is an isolated synthetic PostgreSQL test, **not** a permanent quote migration, Medusa HTTP review/accept endpoint, authenticated buyer confirmation UI or atomic real payment/order/PSP workflow. F07g Stage 2B remains P0: trusted fresh Medusa cart+price version adapter, tenant-specific persistent quote model, 409 direct completion, idempotency/payment lock and UI tests. G3/G5 BLOCKED; F08 JWT and F09 commerce authority OPEN. No main, merge, deploy, Production, real money or secrets touched. Check this docs commit's own CI separately.





## F07g Stage 1 — server-quote contract primitive, CI VERIFIED (2026-10-25)

**Implemented code [e9f6033](https://github.com/titanfit102-bit/ShqipShop/commit/e9f6033778d15059cdbcd805807eabb2d101f270)** on `feat/merchant-auth-boundary-ci`, [PR #12 Draft](https://github.com/titanfit102-bit/ShqipShop/pull/12). All **7/7 pull-request workflow runs COMPLETED/SUCCESS at this exact code SHA**: [backend smoke 40178570633](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178570633), [two isolated 40178570656](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178570656), [parallel 40178570589](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178570589), [F07c Redis worker 40178570604](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178570604), [F07d Redis cache 40178570685](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178570685), [native 40178570613](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178570613), [pilot 40178570650](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178570650). Backend CI logs explicitly include `SHQIPSHOP_F07G_EXPLICIT_QUOTE_ACCEPTANCE_CONTRACT_PASSED`, `SHQIPSHOP_F07G_STALE_PRINCIPAL_TENANT_PRICE_SHIPPING_CART_DENIED` and `SHQIPSHOP_F07G_MALFORMED_REPLAY_AND_TAMPERING_DENIED`.

**Three changed files:** `apps/backend/src/lib/checkout/quote-contract.ts` implements a pure **server-side contract primitive**, synthetic `apps/backend/src/scripts/f07g-quote-contract-ci.ts` exercises it, and existing `.github/workflows/medusa-backend-smoke.yml` executes it behind `CI=true`, development, disposable PostgreSQL/Redis and `SHQIPSHOP_F07G_CONTRACT_CI=true`. Versioned canonical snapshot binds tenant, cart, verified buyer principal/guest proof digest, cart and catalogue revisions, currency, exact decimal total, line items, shipping, discounts/taxes/credits; deterministic sorted digest, 1–300 second expiry, separate issue/accept/assert phases. Negative fixtures reject stale variants, quantity, tenant, guest proof, monetary fields and price revision even where displayed total is unchanged; malformed input, expired/replayed acceptance and tampering rejected. Existing F07f and baseline smoke tests preserved.

**Strict non-claims / P0 OPEN:** This is *only a pure helper and synthetic CLI contract test*, not an HTTP Store API quote endpoint, persisted quote, user-visible acknowledgement, transactional compare-and-swap, cart/pricing revision adapter, payment-session binding, locking/TOCTOU solution, real PSP/3DS/idempotent order or production checkout protection. It is not called by Medusa checkout hook or native UI. Payment amount guard F07f stays opt-in CI. Next F07g Stage 2 must implement tenant-local durable quotes with trusted fresh Medusa cart/catalogue snapshot adapter, verify buyer capability, persistent acceptance and expiry, typed 409 at direct HTTP completion, and transaction/lock against races BEFORE any rollout; then native/PWA confirmation UX, parallel/replay and real PSP sandbox tests. Keep F07 PARTIAL, G3/G5 NOT production-ready, F08/F09 OPEN. No main/merge/deploy/live money/Production. This new **documentation-only checkpoint requires its own CI verification**.



## F07f — real HTTP 409 for processable wrong-amount payment session (2026-10-24)

**CI-VERIFIED / scoped test DONE:** [code 3fad5802](https://github.com/titanfit102-bit/ShqipShop/commit/3fad5802e202d60d3bfa46978bbf18e3d2ad37ca), **8/8 PR+push runs SUCCESS**, [backend 40136557541](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40136557541). Isolated `pp_system_default` session was deliberately mutated through Medusa's Payment module to amount = unchanged cart total +23 and stayed processable. Two separate Store HTTP completion attempts gave 409, created no order and did not complete cart. CI-only proof with guard flag enabled; no Production activation. This completes the previously open **negative active-stale-session HTTP** gate, but is NOT a release authorization. Documentation checkpoint CI must be checked separately.

**P0 STILL OPEN / F07g NEXT:** existing bounded buyer-accepted quote architecture at next section below is DESIGN ONLY. Build server-side tenant/cart-bound quote + canonical amount and revision, strict expiry, deliberate buyer acceptance, front-end difference confirmation, payment collection binding, stale quote 409 at direct Store API completion, transactional cart/order/payment boundary and race/replay tests. Do not accept a client-calculated EUR indication as payment amount. Then provider authorization reconciliation, split tender/credit lines, tax/promotion/shipping, frontend Next.js cache and operational Redis monitoring. F07 PARTIAL, G3/G5 IN PROGRESS; F08/F09 OPEN. PR #12 Draft, no merge/deploy.


## F07g — proposed buyer-accepted quote protocol (design checkpoint, NOT implemented; 2026-10-24)

**Basis**: current verified HEAD [82b1ebf3](https://github.com/titanfit102-bit/ShqipShop/commit/82b1ebf32a6705620bda2526a8c26d51793f3ad6) on Draft PR #12, **7/7 PR CI SUCCESS**. Previous CI code 85baac09 observed Medusa automatically invalidates a processable session on an ordinary quantity edit; this does not establish a guarantee for an externally authorized payment, admin repricing during checkout or other races. Existing F07f equality guard is opt-in and only enabled in synthetic CI.

**Proposed default policy (approval/implementation pending):** no open-ended price lock. The buyer must acknowledge the authoritative total (ALL or EUR) as a fresh, bounded *checkout quote*. When the cart totals/items/shipping/taxes/promotions/currency change, the quote becomes invalid and checkout must return a typed conflict before order/payment completion. The server must never silently charge a new or older amount. Reference/indicative EUR display for ALL does not belong in the authoritative payable amount hash; accepted currency, amount and chosen payment currency do.

**Server state machine:** `draft-cart → quoted → buyer-accepted → payment-ready → completing → completed`, with `conflict/expired` returning to `draft-cart`; terminal completed orders are idempotently returned on replay. Store quote server-side, not trusting client-provided totals: `quote_id` random opaque ID, `cart_id`, customer/guest cart capability binding, `merchant_id` (isolation), `currency`, exact decimal `total`, server canonical digest over variant IDs/quantities/adjustments/shipping/tax/discount/credits/payment allocation and quote revision, `expires_at`, `accepted_at`, `acceptance_nonce`, status, `payment_collection_id`/provider and session IDs. Avoid PII and raw payment tokens in logs. Persistent storage must be tenant-isolated and transactional; hashing alone is NOT a lock or atomic acceptance.

**Workflow boundaries:** (1) POST review issues/updates a quote from a fresh **uncached** server cart, with no payment authorized; (2) a deliberate buyer action POST accepts exact quote ID/revision; (3) payment session initialization/refresh is gated on that same accepted quote and exact amount; (4) `completeCartWorkflow.hooks.validate` checks accepted quote, currency, payment session amount, same cart snapshot and expiry. An outer lock/transaction must prevent cart mutation or price-state changes between final validation and completion/payment authorization; hook alone cannot close TOCTOU, and must never mutate cart. Existing native `POST /store/carts/:id/complete` must be fail-closed when policy is enabled, including direct HTTP clients. Design hooks/middleware carefully to preserve Medusa idempotent already-completed order semantics, client return handlers and guest capability isolation.

**Negative CI acceptance gates:** missing/expired/unaccepted/modified quote → conflict and no order; exact amount positive mock checkout; quote accepted then quantity/shipping/promotion/currency/admin price mutated → conflict and visible new quote; two parallel complete requests create at most one order/payment; replay same idempotency key returns same order; wrong tenant/customer/guest quote cannot be used; disabled worker/Redis and expired locks fail closed; payment collection stale/different amount rejects; 3DS/redirect return and webhook do not skip the check; existing legitimate quote completion remains green. Split tender/credits and price-list/taxes require explicit rules/tests instead of being silently unsupported.

**Not performed in this checkpoint:** no endpoint, migration, client consent UI, price-lock, payment gateway, lock or runtime behavior was added. F07 remains PARTIAL; G3/G5 not release-ready, F08/F09 open. Next implementation needs a small architecture decision and isolated backend proof followed by genuine buyer UI tests before any deploy/merge.


## F07f — post-session cart change HTTP regression (2026-10-24)

**Verified CODE SHA [85baac09](https://github.com/titanfit102-bit/ShqipShop/commit/85baac09a723c075ea555ae9975cb5bfb46a3617)**, branch `feat/merchant-auth-boundary-ci`, [PR #12 Draft](https://github.com/titanfit102-bit/ShqipShop/pull/12). **8/8 GitHub PR + push runs SUCCESS** at this code SHA, including [backend smoke 40099439205](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40099439205) and [Redis F07d](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40099439168). This docs-only checkpoint requires its OWN CI check. Main, merge, deployment and Production untouched.

**DONE (limited):** Real Store API demo checkout script creates matching manual session; changing item quantity via regular API invalidates the old session. Two completion calls return 4xx, leave cart uncompleted, no order. See [backend smoke 40099439205](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40099439205). Prior negative validator helper and successful live synthetic order cases retain PASS. Initial wrong assumption about a remaining active session produced a test-only failure (`33e0d91c`), fixed in `85baac09`. No live payment, no backend policy enabled in Production.

**P0 OPEN:** real HTTP rejection for a still-processable mismatched session (not tested by normal quantity update), explicit buyer accepted quote, server-side amount/revision check at workflow boundary, TOCTOU/payment synchronization, idempotent replay and PSP reconciliation. P1: tax/promos, multiple lines, Next.js price cache, Redis worker failure/HA. F07 PARTIAL, G3/G5 IN PROGRESS; F08 and F09 OPEN. No merge/deploy.


## F07f — opt-in workflow payment-session amount equality (2026-10-24)

**Verified code [58104c54](https://github.com/titanfit102-bit/ShqipShop/commit/58104c54d24812003a8212e71f23d4b655ce86d7), 7/7 PR CI SUCCESS**, [backend 40094386938](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40094386938). New `completeCartWorkflow.hooks.validate` checks processable payment-session amount equals server cart snapshot with `MathBN`, rejects mismatches via conflict. Feature flag `SHQIPSHOP_ENFORCE_PAYMENT_TOTAL_MATCH=true` is **only enabled in disposable CI**. Deterministic negative unit fixtures and live positive mock HTTP order PASS. No production behavior enabled by default. Docs checkpoint CI separate.

**P0 OPEN:** verify actual HTTP 409 on a real mis-sized disposable payment session; implement buyer price-change review/acceptance and backend quote revision; protect against race between review, PSP authorization and order transaction; stale/replay/idempotency testing. Upstream Medusa core workflow does not compare authorized amount to cart total; split tender/credits and full payment reconciliation require explicit rules. F07 PARTIAL; G3/G5 IN PROGRESS. Also Next.js product caching, tax/discounts, Redis worker/outages, F08 JWT and F09 single Medusa commerce authority. No merge/deploy.


## F07e — priced cart to mock order consistency (2026-10-24)

**VERIFIED in CI:** [code 1a7241f2](https://github.com/titanfit102-bit/ShqipShop/commit/1a7241f2ae84cc4c3b29aa2399d61602468af17f), 8/8 workflows SUCCESS, [backend 40090442879](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40090442879). Synthetic pre-existing cart: product ALL price increased 1500→1517; existing cart initially retained 1500 but repriced to 1517 after quantity update. Qty2 products 3034 + shipping10 = server-reviewed cart 3044; `pp_system_default` mock order total and protected guest receipt both 3044. Existing CI inventory assertions preserved. Earlier failing assertion that subtotal excludes shipping was corrected after diagnostic run 40090096933. No real charges/production code modified; new docs SHA requires CI recheck.

**P0 open, not a product fix:** explicit shopper acknowledgement of the changed total and server-authoritative cart/price version or bounded quote, stale-price conflict (409 or equivalent), atomic prepayment and order recheck, idempotency/race tests, payment provider reconciliation. **P1 open:** tax, promotions, multi-line, multiple currency and Next.js product cache invalidation, Redis outage/ops. F07 PARTIAL, G3/G5 IN_PROGRESS, F08/F09 OPEN; no merge/deploy.


## F07e active-cart price snapshot vs current catalogue (2026-10-24)

**VERIFIED CI:** code [b3a854f7](https://github.com/titanfit102-bit/ShqipShop/commit/b3a854f7845c27e8254fa60250e805c175c079fc), **8/8 PR+push runs SUCCESS**, [Store HTTP job 40085452001](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40085452001). Separate CI-only official variant ALL price mutation (+17) while cart at old price is already active: Store API `calculated_price` updates, new cart reflects new price, original cart initially preserves old price. Quantity 1→2 subtotal invariant PASS; precise post-quantity pricing policy not yet classified. Code changed only two guarded proof scripts and the existing backend smoke workflow, not checkout production logic. New docs checkpoint requires separate CI review.

**RELEASE-BLOCKING / P0-P1 OPEN:** distinguish allowable time-limited price lock from stale exploit; ensure checkout/payment/order authority revalidates price with clear buyer consent to any repricing; verify exact final order/receipt/payment mock against displayed/accepted amount and concurrency/replay. Then shipping/tax/promotions/discount/multiline, real frontend Next.js product+variant `force-cache` invalidation and cache TTL, worker outage/Redis failover/HA/ACL/TLS, F08 server-side JWT revocation and F09 unified Medusa commerce. Do not declare F07, G3 or G5 done; no merge/deploy.


## F07e Stage 2 — HTTP calculated ALL price + quantity/cart totals proof (2026-10-24)

**DONE (verified CI):** [code 8f47c5d7](https://github.com/titanfit102-bit/ShqipShop/commit/8f47c5d7ca178be87b60f286d175e78bba5f441e), 7/7 PR workflows SUCCESS, including [backend Store API smoke 40044165844](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40044165844). New standalone CI-only HTTP Store API test confirms calculated ALL variant price equals line unit price/subtotal, cart quantity 1→2 doubles subtotal and total rises, 2→1 restores original subtotal and total. Existing checkout and inventory preservation unaffected. Explicit isolated Redis requirement enforced in backend CI. This docs checkpoint requires its own CI verification.

**OPEN GATES:** Store API after updating ALL/other currency variant price via backend workflow, existing carts price refresh vs contractual price snapshot; promotions/discounts/taxes/shipping and multiple line items, Next.js product and variants `force-cache` expiry/merchant invalidation, PWA/browser E2E; worker outage/observability, production fail-closed TLS/ACL/HA, F08 JWT revocation, F09 single-commerce authority. F07 PARTIAL, G3/G5 IN_PROGRESS; PR Draft, no main/merge/deploy.


## F07e — linked variant-price and cart metadata cache proof (2026-10-24)

**DONE / CI verified:** [a16263f2](https://github.com/titanfit102-bit/ShqipShop/commit/a16263f2bc042eaf0a6e848440bf699a426bd137) with 7/7 PR and 2/2 push Actions SUCCESS including [F07e PR](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40040438586). New CI guarded Medusa script verifies a linked `price.amount` and a cart `email` field are refreshed across independent processes after official variant-price/cart workflows; A and B isolated Redis/DB + live workers. Old F07d title and cache isolation remain green. Docs commit requires its own CI check.

**STILL OPEN:** Store API `calculated_price`, currencies/price lists and correct cart item quantities, tax/discount/total recomputation, backend-to-Next.js `force-cache` invalidation and PWA/browser price freshness, worker downtime and Redis failure policies/observability, TLS/ACL/HA/backup/restore, JWT server revocation F08, unified commerce authority F09. F07 remains PARTIAL; G3/G5 not ready for production; no merge/deploy.


## F07d product title Query cache invalidation — CI validated (2026-10-24)

**DONE as scoped CI proof (not release gate):** [code bc682a9a](https://github.com/titanfit102-bit/ShqipShop/commit/bc682a9a4d8546e76504857594ab1f603caaee78); 7/7 PR and 2/2 push CI PASS, [F07d PR](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40034143183). Discovered initial stale cache in server-only setup with no workers (code 6e04f522, [failed run 40033739068](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40033739068)); fixed testing architecture by starting isolated A/B Medusa dedicated workers. Real seeded product title changes through Medusa update workflow invalidate cached Query result across fresh processes within bounded wait, without manual clear; repeated for both merchants. Existing synthetic Redis cache isolation preserved. Docs HEAD requires separate CI verification.

**OPEN:** F07e price sets/variants and cart changes invalidation and real HTTP checkout data; PWA Next.js/browsers revalidation, event lag/outage/error handling and worker monitoring; production fail-closed/TLS/ACL/HA/backups/restore; F08 server-side JWT lifecycle; F09 single Medusa commerce authority. F07 PARTIAL and G3/G5 IN PROGRESS; no merge/deploy.


## F07d — Redis cache explicit provider, pinned dependency, isolation proof (2026-10-24)

**CI-VERIFIED:** [cd300404](https://github.com/titanfit102-bit/ShqipShop/commit/cd3004040f80aabf3fa0f541e20fc55d66649323), **7/7 PR + 3/3 push checks SUCCESS**. `@medusajs/caching-redis@2.22.0` explicit backend dep+existing lock snapshot; frozen pnpm install passed. Opt-in Caching Module plus Redis default provider, fail closed when opt-in enabled without Redis. Synthetic 13 independent Medusa processes, separate DB/Redis A/B, cross-process cache sharing within tenant, denial of foreign-tenant reads, key invalidation contained within tenant. [F07d PR](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032304599) / [push](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032297123).

**OPEN:** real product/cart invalidation under concurrency, cache Redis outage handling, server/worker metrics, automatic non-dev fail-closed, TLS/ACL/HA/persistence/backups and realistic performance, JWT revocation (F08), unified commerce backend truth (F09), physical phone/browser QA. F07 **PARTIAL**, G3/G5 **IN PROGRESS**. Do not merge/deploy. Check docs commit's CI separately.


## F07c follow-up — controlled Redis outage and locking (2026-10-23)

**CI-VERIFIED at code SHA [0b058e8c](https://github.com/titanfit102-bit/ShqipShop/commit/0b058e8c63a5bf6621cb0cbab5f814f0368dd215), 6/6 PR workflows SUCCESS and 2/2 push workflows SUCCESS:** [F07c PR](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030658466), [F07c push](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030654260). F07c server/worker and retry regression preserved; new synthetic Redis AOF queue persists through deliberate container stop/start and is consumed after restart, and Medusa Redis lock contention serializes two independent processes. This is a test milestone, not infrastructure certification; documentation commit CI must be rechecked.

**STILL OPEN:** abrupt Redis kill/power loss/replica failover, restore to replacement persistent volume, worker killed inside handler, exactly-once/idempotent business mutations, locking lease expiration under actual crash, load/multiple consumers; Redis caching cross-process provider (`@medusajs/caching-redis`, lockfile), TLS/ACL/backup/HA/monitoring, automatic production Redis fail-closed, production security and mobile QA. F07 PARTIAL, G3/G5 not release-ready; no main/merge/deploy. Next separately authorized F07d caching integration and regression CI.


## F07c verified increment — Redis dedicated worker (2026-10-23)

**DONE as CI-scoped proof:** `WORKER_MODE=server|worker|shared` Medusa config; synthetic-only event with separate HTTP server and Medusa worker; controlled failure recovered by event retry; worker process stop/restart and new process delivery. [Verified code 02fa531d](https://github.com/titanfit102-bit/ShqipShop/commit/02fa531de23e03c2aad36d0cd053c4a9dfbb74e2), **6/6 PR Actions SUCCESS**, F07c [40027474910](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027474910) and [push 40027467532](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027467532). Tests use CI-only synthetic payloads and disposable services. Docs commit requires CI recheck.

**OPEN (F07c-outage):** Redis restart/failover and persistence with queued-job replay; work interrupted mid-handler, duplicate/idempotence controls and locking contention. **OPEN (F07d):** caching Redis provider installation/lockfile, cache isolation and invalidation proofs. **OPEN production gates:** automatic fail-closed deployment policy; TLS/ACL, backup/restore, HA, worker metrics; user/device flows. Do not promote F07/G3/G5 to complete. Maintain PR #12 Draft, no merge or deploy.


## F07b — session sharing cross-process (CI VERIFIED; 2026-10-23)

- **Code [5cf17af](https://github.com/titanfit102-bit/ShqipShop/commit/5cf17af77d807ce57a7054358d447704ec12a307) + [parallel session handoff 40021889093](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021889093) SUCCESS**: sesionet customer/admin nga A:9000 pranohen në A:9002 pa JWT, cookie B refuzohet. Redis event keyspaces A/B provohen, 5/5 distinct CI workflows green në code SHA.
- **F07 mbetet PARTIAL**: sesione cross-process dhe event activity u provuan; mbeten Redis restart/failover, server-vs-worker queues/retry, locking under contention, caching-redis provider/lockfile, Redis auth/TLS/ACL/backup, prod HA, fizik/browser HTTPS. Mos deklaro F07 closed, G3/G5 production.
- **Next:** test restart+worker processing në izolim sintetik dhe planifiko caching provider me lockfile; kërko scope të ri për kodin e mëtejshëm. PR #12 Draft, handoff në `feat/merchant-auth-boundary-ci` vetëm.


## F07 — real Medusa Redis modules (PARTIAL, 2026-10-23)

- **Implemented in [ad7a86dc](https://github.com/titanfit102-bit/ShqipShop/commit/ad7a86dc82778fe1658c51152210298a03ece6be):** Medusa `projectConfig.redisUrl` for sessions and explicit Redis event-bus, workflow-engine and locking provider registrations. `SHQIPSHOP_REQUIRE_REDIS=true` in parallel CI rejects absent Redis URL. Two physically separate Redis services A/B.
- **Evidence 5/5 CI GREEN at code SHA:** [A/B Redis runtime 40021073660](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073660), [two DB 40021073589](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073589), [Medusa 40021073486](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073486), [native 40021073350](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073350), [pilot 40021073534](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073534). Markers prove Medusa events in Redis on both merchants: each 2 event and 4 workflow-named keys; log shows provider connections. **This is not a mere Redis PING.**
- **F07 still OPEN/PARTIAL:** session restart persistence, worker/server separation and queue retry, contended locking, Redis caching module provider installation/pnpm frozen lock consistency, real Redis outage/recovery, backups/HA/ACL/TLS and operational tests. No proof of all these from connection logs or event keys alone.
- **Next** (separate code scope): test session cookie across restart and worker activity; then add `@medusajs/caching-redis` provider with lockfile updated and CI proof. Do not mark G3/G5 production ready. F09 PWA/Medusa single commerce truth still OPEN. Docs checkpoint in `feat/merchant-auth-boundary-ci` only; PR #12 Draft, no merge/deploy/main.


## RegionProvider recovery checkpoint — 2026-10-23

- **Implemented native, code [77de0869](https://github.com/titanfit102-bit/ShqipShop/commit/77de0869a4f072eeb3dcbd047c21dd5a0f525909):** saved `region_id` valid reuse, expired 404/410 fallback after successful list, offline/401/5xx preserve; epoch ignores outdated responses; serial AsyncStorage writes for rapid B→C selection; Home and RegionSelect error/retry states.
- **Evidence:** [native 40014816829](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40014816829) SUCCESS (15/15 suites, 71/71 Jest, TypeScript/lint) on f4a43d6; final code [native 40015015192](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40015015192) initially pending, [pilot 40015015190](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40015015190) success. Recheck the latest SHA and CI.
- **Open:** real mobile E2E and l10n, React CartProvider rapid region update race **in the server**, checkout idempotency, F07 Redis jobs, F09 PWA/Medusa unified backend, production controls. This native increment does not close G3/G5.
- **Next (proposal):** read-only inspection of Redis runtime configuration and CartProvider server-side region race. Changes to other code require scope-specific authorization. Docs checkpoint on `feat/merchant-auth-boundary-ci`, not main.


## F03–F05 — native cart/checkout resilience (2026-10-23)

- **Implementuar (CI-verified në code SHA [7ea5153](https://github.com/titanfit102-bit/ShqipShop/commit/7ea515388d70ce45517ed667ab0275ff86cc9040)):** F03 cart 404/410 recreate; offline/401/5xx preserve + UI retry. F04 add/update mutation error propagation, alerts dhe finally/loading. F05 payment status pending/authorized para review/complete, pas GET Store cart. Testet [native 40012363697](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363697) 56/56 PASS, [Medusa HTTP 40012363691](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363691) marker `SHQIPSHOP_F05_CART_PAYMENT_SESSION_VERIFIED` PASS, pilot dhe parallel CI GREEN; two isolated run [40012363718](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363718) **SUCCESS**, pra **5/5 GREEN** në code SHA.
- **OPEN për release:** region-context async restore pa catch, rapid region switching, cart items të fshirë server-side, device E2E, checkout idempotency, Stripe/real payments, guest receipt restart dhe F07 Redis. G3/G5 nuk janë closed. 
- **Next:** verifikimi i CI te HEAD dokumentacionit; më pas read-only audit RegionProvider dhe planifikimi F07 (Redis) / F09 (commerce source of truth), sipas prioritetit. Pa leje të re kodi për këto faza. PR #12 Draft, degë e dokumentacionit `feat/merchant-auth-boundary-ci`, jo main.


## F06 — guest and registered order privacy (CI verified, 2026-10-23)

- **Implementuar në code SHA [9a6a4e1](https://github.com/titanfit102-bit/ShqipShop/commit/9a6a4e199fa4b72935fa44b356776bd9843bb408):** 5/5 workflow-t kryesore PASS, përfshirë customer-owner order retrieval/foreign registered account denial në A/B, guest receipt 200 vetëm me cart proof, order-ID-only denial, existing Medusa smoke/native/pilot. [Parallel test 40009599479](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599479).
- **F06 ka kaluar gate-in HTTP/CI të synuar**, por jo release/security production. Mbeten: restaurimi i receipt guest pas restart-it, endpoint-e të tjera me ID-as-capability (returns), abuse/rate limiting, mobile device end-to-end, TLS/secure storage. **G3 = IN PROGRESS.**
- **Next recommended:** F03 rikuperimi i shportës kur ID vjetrohet, F04 error propagation i mutacioneve, F05 resume/payment-session check, me regresione të automatizuara. Autorizim i ri i veçantë për kodin e ardhshëm. Dokumentacioni CURRENT_STATE dhe MASTER_HANDOFF §15 është në degën `feat/merchant-auth-boundary-ci`, **jo në main**.


## F02 native JWT logout — verified checkpoint 2026-10-23

- **F02 local signout race:** implementuar në degën `feat/merchant-auth-boundary-ci`, code SHA [b3097a3](https://github.com/titanfit102-bit/ShqipShop/commit/b3097a3d9f8b78a7d60a5418ca565e82b66a1905), [native 40005009842](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009842) **PASS** (10/10 suites, 36/36 tests, ESLint, TypeScript). Pilot, Medusa smoke dhe parallel A/B **PASS** në të njëjtin SHA ([40005009867](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009867), [40005009885](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009885), [40005009829](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009829)).
- **F02 mbyllet vetëm si local app CI gate**, jo JWT server-side revocation/expiry, iOS/Android device test ose certifikim prod. F01 native cache CI PASS; F06 guest/account receipt access dhe F03–F05 commerce correctness janë OPEN. G3 ende IN_PROGRESS.
- **Next read-only:** analiza e kontratës F06 same-merchant order retrieval me account+guest, pastaj autorizim i posaçëm për implementim. PR #12 Draft, asnjë merge në main/Production.


## F01 implementation checkpoint — 2026-10-23

- **F01 private cache native:** Implementuar në `feat/merchant-auth-boundary-ci`, code SHA [2219e65](https://github.com/titanfit102-bit/ShqipShop/commit/2219e65e5dff987ad5046bcf34f03fc253d9e714), [native CI 40001961028](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40001961028) **PASS**, ESLint/TS + 32/32 Jest. Address/order/order-detail query keys të izoluara, pastrim gjatë logout/login, in-flight stale guard, reset navigation dhe tests A→B/offline.
- **Kufizim:** pa Android device/emulator E2E të ri ose validim të Medusa same-merchant receipt privacy. F01 është verified për regression suite, jo release approved. F02 logout JWT dhe F06 order capability mbeten P1 (native/pilot), G3 në progres.
- **Veprimi i ardhshëm:** F02 token cleanup race ose F06 receipt ownership sipas target-it. Kërko scope të ri për kodin; pa merge/deploy/main. Dokumentet CURRENT_STATE/MASTER_HANDOFF §13 japin gjendjen e plotë dhe referencat.


## ShqipShop independent audit F01–F16 review — 2026-10-23

**Evidenca:** raport i pavarur për commit e22bb13 (F01–F16), rishikuar kundrejt source GitHub, upstream Medusa 2.21.2/2.22.0 dhe [CI 39991716155](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39991716155), [39991715755](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39991715755), [39991715961](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39991715961): 3/3 SUCCESS. Verifikimi i Work për komponentet native dhe numri i package advisories nuk u riprodhuan veçmas nga ky reviewer; shumica e mekanizmave defektozë u konfirmuan nga source. Detajet dhe caveats: CURRENT_STATE dhe MASTER_HANDOFF §12 në këtë branch (jo main).

**Rruga e rekomanduar, VETËM PROPOZIM, jo leje implementimi:**
- **Native me llogari reale:** F01 është P0 i privatësisë. F02 SDK logout, F03 stale cart, F04 swallowed mutation errors, F05 checkout resume dhe F13 price=0 duhet të kenë testet e tyre të regression. F12 production signing bllokon vetëm store release të native.
- **PWA-first:** F06 receipt ID-as-capability guest/account privacy contract dhe F09 një commerce source-of-truth janë prioritete pilot; F15 brand CSS/CSP vetëm nëse pilot FastAPI mbahet.
- **Operations:** F07 Redis provider/event/session/workflow wiring me prova të vërteta (jo vetëm PING); F08 JWT lifecycle dhe credential storage, F10 native CI gates, F11 dependency advisory triage/release bundle, backup/TLS/secrets/privacy; F14 UI error/accessibility sipas flow-it, F16 shënim historik/superseded.
- **Release gate:** G2 native është PARTIAL; G3 server tenant auth është PARTIAL (jo production-ready); G4–G8 varen nga target-i real; mos numëro P0 native release kundër një target-i PWA-only.
- **Autorizimi:** vetëm update docs CURRENT_STATE/MASTER_HANDOFF/PROJECT_HISTORY/ROADMAP/AGENTS në feat/merchant-auth-boundary-ci është i vazhdueshëm. Nuk është dhënë leje e re për F01–F15 kod ose për degë të tjera/main/merge/deploy.


## Përditësim analize P1 — 2026-10-23

CI i HEAD-it dokumentar `e5657c6`: [pilot 39990409987](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990409987), [parallel 39990410102](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990410102), [smoke 39990410033](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990410033): **3/3 SUCCESS**. Kodi i testuar mbetet `06ea54a`.

**Audit read-only i përfunduar:** REDIS_URL në env nuk aktivizon modulet Redis në konfigurimin aktual self-hosted; source v2.22.0 dhe log-u real konfirmojnë fallback lokal/fake redis, event bus lokal dhe locking in-memory. Cookie sessions përdorin default memory sipas loader-it/config-it; restart persistence nuk është provuar. JWT default pritet 1d nga source, ende pa matje runtime exp. TTL i shkurtër nuk është revokim pas logout-it.

**Next:** implementim i propozuar **P1a — Redis provider wiring dhe provat reale cache/event/workflow/session-restart/locking**, i përshkruar te [MASTER_HANDOFF §11](MASTER_HANDOFF.md). Kërkon autorizim kodi për këtë scope të ri; deri tani u ndryshua vetëm dokumentacioni. JWT TTL/revocation mbetet fazë e ndarë P1b; G3 ende IN_PROGRESS.

## Checkpoint aktiv P0 — 2026-10-23

- Kodi i verifikuar: `06ea54a5f252ae367e3281c470cdc139729459bc`, PR #12 OPEN Draft, dega `feat/merchant-auth-boundary-ci`; main i pandryshuar.
- [Session/mutation CI 39989746378](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39989746378), push-run 39989739659, backend smoke 39989746313 dhe pilot 39989746410: **4/4 SUCCESS**. Cookie real customer/admin A/B, foreign/tampered/role denial, logout-cookie replay, negative POST/DELETE dhe snapshots e kufizuara kaluan. Scope dhe evidenca e plotë te CURRENT_STATE dhe MASTER_HANDOFF.
- **Kufizim i konfirmuar:** cookie logout nuk revokon JWT-të; 4/4 bearer replay dhanë HTTP 200. G3 mbetet IN_PROGRESS për browser HTTPS/CSRF/domain scope, JWT revocation, admin RBAC, Redis/jobs, media/backup dhe endpoints e mbetura.
- Përdoruesi autorizoi veçmas scripts/workflows të planit §10 dhe maskimin e sekreteve CI në këtë degë («po te autorizoj, vazhdo permirsimin sipas planit»). Ky increment është i verifikuar; nuk autorizon ndryshime të fazave/degëve të tjera, main, merge/deploy ose pagesa reale. Mirëmbajtja e pesë dokumenteve të vazhdimësisë vazhdon.
- **Next:** analizë read-only e Redis provider wiring dhe JWT TTL/revocation; implementimet e reja kërkojnë scope të autorizuar. Mos përsërit testet e kaluara si punë e re.


> **Statusi autoritativ i tanishëm:** [CURRENT_STATE.md](CURRENT_STATE.md) dhe [MASTER_HANDOFF.md](MASTER_HANDOFF.md) v22, në degën **feat/merchant-auth-boundary-ci** (jo main). Tabela historike më poshtë duhet lexuar së bashku me checkpoint-in e verifikuar. G3 është NË PROGRES, jo GREEN për sigurinë e plotë.


**Vendim i konfirmuar, 22 tetor 2026:** ShqipShop mbetet white-label commerce SaaS (dyqan dhe app i personalizuar për çdo biznes); ideja e ShqipShop si APK marketplace është **refuzuar dhe jashtë scope-it**. Shih [ADR-004](ADR-004_APK_CATALOG_IDEA.md). Kodi Medusa Mobile është importuar në PR #2, me `sq-AL` dhe 17 teste Jest; hapi i radhës është Android debug build, pastaj Medusa v2 backend + porosi test end-to-end. Nuk ndërtohet APK store.


**Përditësim 22 tetor 2026:** Store API HTTP cart→manual payment→order dhe verifikim i porosisë në PostgreSQL KALUAN në run [39839755263](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39839755263). Nuk ka ende test të aplikacionit Android, inventarit real pas porosisë apo izolim dy biznesesh.

**Test integrimi Android → backend në zhvillim:** [workflow Android + Medusa](https://github.com/titanfit102-bit/ShqipShop/actions/workflows/android-medusa-catalog.yml), run 39845817408. Puna e fundit ishte kompilimi i APK-së; statusi duhet lexuar live. Nuk numërohet si provë derisa produktet të shfaqen realisht në emulator.

**Prova e parë e katalogut native e kaluar:** [Android emulator + backend Medusa live run 39845817408](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408) — screenshot i verifikuar vizualisht me produkte demo dhe çmime ALL. Porosi UI Android NUK është provuar.

**PR #5 i aktivizuar:** Test real UI Android → Medusa cart dhe kontrolli i shportës në PostgreSQL; [run 39867727695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695) duhet verifikuar live para se të shënohet sukses. Checkout Android mbetet i paprovuar.

**Prova shporta Android → Medusa → PostgreSQL PASSED:** [run 39867727695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695). 1 Medusa Shorts variant S, monedha ALL, screenshot real. Checkout nga Android ende mungon.

**Shfaqja dymonedhëshe ALL/EUR në PR #6:** Implementim për çmim kryesor në monedhën reale dhe ekuivalent orientues në tekst të vogël gri, vetëm me kurs backend të validuar. Testet JS dhe Medusa kaluan në runs 39931374229 dhe 39931072361. Pagesa reale në dy monedha është fazë më vete; emulimi vizual është ende për t'u konfirmuar.

**Progres 23 tetor:** Dual-currency Android UI PASSED (run 39931562458; kurs vetëm sintetik). Checkout Android PR #7 me adresë/transport/pagesë manuale dhe order PostgreSQL është në testim (run 39934984130), **jo i konfirmuar** deri te marker-at e UI dhe DB.

**Checkout Android UI → PostgreSQL PASSED** [run 39934984130](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130), 1510 ALL, pagesë manuale sintetike. **PR #8** korrigjon nëntotalin e receipt (1500 + 10 = 1510) dhe emërtimin e transportit; Jest/TS green [run 39937851854](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39937851854), recheck i screenshot-it Android pending. Nuk ka pagesë reale EUR/ALL dhe multi-tenant isolation.

**Datë bazë:** 2026-10-22. **Kjo është një strategji zhvillimi**, jo pretendim që të gjitha fazat janë realizuar. Në çdo përditësim mbaj metrikat: koduar / testuar / deploy-uar / përdorur nga klientë realë.

## Përkufizimi i produktit që duhet të kemi në fund

Një operator ShqipShop mund të krijojë e të menaxhojë shumë biznese shqiptare; çdo biznes zotëron identitetin dhe të dhënat e vet, panel për produktet/inventarin/porositë, një faqe/dyqan PWA të instaluar në telefon dhe (opsional Premium) app Android/iOS që punon me **të njëjtin burim të të dhënave**. Biznesi paguan vetëm në bazë të një plani/fature transparente. Klienti final blen në shqip, në ALL, merr konfirmim dhe ndjek porosinë. Operatorët kanë logje, billing, backups, support dhe përgjegjësi privatësie të përcaktuara.

## Plan i varur nga evidenca

| Gate | Çfarë duhet | Vërtetohet me | Gjendja në snapshot |
|---|---|---|---|
| G0 · GitHub baseline | Kod, varësi, CI, dokumentacion, PR | `compileall`, `pytest`, CI i gjelbër | Po për pilot; 10/10 testet në run 39822589301 |
| G1 · Pilot UX/Security | 3 demo shop flows + admin + izolim, përmasa mobile | Browser E2E, auth/CSRF/XSS, review manual | Jo i përfunduar |
| G2 · Native feasibility | Upstream RN + locale sq-AL + Medusa dev server | `npm ci`, lint/TS/Jest, Android build, mobile checkout | Pjesërisht: RN dhe sq-AL, 17/17 testet, ARM64 APK build PASS, Android API35 x86_64 emulator install/start PASS (run 39842340691); Android↔Medusa UI katalogu PASS (39845817408); **Android checkout në emulator dhe receipt + PostgreSQL PASS** (39934984130, 39946022933); telefoni fizik dhe prod signing mungojnë |
| G3 · Unified commerce backend | Një sistem inventory/order, multi-tenant i sigurt | Për 2 merchants teste pozitive/negative, migrations | Medusa/PostgreSQL dy backend-e aktive njëkohësisht, 2 porosi 1510 ALL, order-ID cross-tenant 404, admin/customer JWT cross-tenant negative PASS në [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12), [run 39981336521](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336521); cookie/session dhe mutation auth të kufizuara PASS në run 39989746378 / code 06ea54a; JWT revocation, browser cookie scope/CSRF, admin RBAC, Redis provider, media/backup dhe production izolimi MUNGOJNË |
| G4 · Managed merchants | Signup/verifikim, branding, domain, panel, plan | Krijimi i 3 tenanteve pa komandë manuale | Jo |
| G5 · Payments, delivery, privacy | COD operativ; provë PSP sandbox; logjistika dhe GDPR | Test porosi-refund-webhook, privacy/legal review | Jo |
| G6 · Production QA | DB backup/restore, incident handling, metrics, load/security, HTTPS | Auditor + E2E + DR restore + staged rollout | Jo |
| G7 · Business validation | 3–5 pilotë; përdorim real dhe willingness-to-pay | Kontratë/depozitë ose pagesa + përdorim i matur | Jo |
| G8 · Native rollout | Publikim per merchant vetëm ku vlen | App store review, account, signing, E2E në devices | Jo |

## Udhëzime të projektimit

- Favorizo **proof të udhëtimit të blerësit** (produkti → shporta → porosia) mbi shtimin e veçorive dekorative.
- Bëj fillimisht intervista dhe oferta prove për segmente me katalog të ripërsëritur (butikë, parfumeri, aksesorë). Shmang restorantet/rezervimet në versionin e parë sepse kërkojnë domain tjetër logjik.
- Çmimet 29€/79€ ishin hipoteza demonstrimi; nuk ka billing real dhe nuk ka verifikim të willingness-to-pay.
- Klienti final mund të instalojë PWA, por 'app nga App Store' nuk i premtohet çdo biznesi pa aprovimet përkatëse.
- Nuk prodhohen kartë-krediti/test pagesash me para reale pa sekretet e ofruesit dhe autorizim të shprehur.
- CDO gate duhet të ketë evidencë reale: commit SHA, run logs, screenshot/video device ose rezultate testesh. Pa prova, statusi mbetet 'not verified'.

## Next 3 të ekzekutueshme (HISTORIK / SUPERSEDED NGA AUDITI F01–F16)

1. Audit i PR #1 për dobësitë e backend-it pilot; screenshot/device test; README dhe handoff up-to-date.
2. POC i veçantë për Medusa Mobile origjinal, me licencë MIT dhe konfigurim shqip; verifiko build/test/checkout.
3. Përzgjedhja e commerce source-of-truth dhe strategjisë tenant-isolation; dokumento ADR dhe fillo migrim të sigurt vetëm pas provës.

## Si matet progresi

Nuk ka përqindje 'totale' të besueshme deri sa të jenë vlerësuar gate-t dhe peshat e tyre. Prototipi i tanishëm përmbush pjesërisht G0; pas çdo ndryshimi kontrollo `main`, branch, PR, CI dhe testet përpara se t'i shënosh të përfunduara. G8 native nuk është e detyrueshme për të lançuar paketën PWA, por është domosdoshmëri për premtimin 'çdo biznes app-in e vet' në atë paketë.

## 23 tetor 2026 — Izolimi ndërmjet dy Medusa backend-eve: prova e parë GREEN

- **Gjetja që e nisi këtë:** [PR #9 / run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016) FAILED AS INTENDED: në një backend të përbashkët Medusa me 2 sales channels, të dy publishable keys A/B morën **HTTP 200** ndaj `GET /store/orders/{id_A}`. Kjo vërtetoi që sales channels nuk janë kufi privatësie mes tregtarëve. PR #9 duhet të mbetet diagnostik i kuq dhe mos u fshi testimi.
- **Vendimi i pilotit [ADR-006](ADR-006_TENANT_BACKEND_ISOLATION.md):** çdo tregtar pilot ka një instancë Medusa/DB PostgreSQL/user role të izoluar, dhe control plane ShqipShop jashtë rrjedhës së klientëve/porosive. Ky është dizajn i rekomanduar, jo ende SaaS i përfunduar.
- **[PR #10](https://github.com/titanfit102-bit/ShqipShop/pull/10), [run 39947677104](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39947677104): PASSED.** CI krijoi dy database PostgreSQL të veçanta `shqipshop_ci_a`, `shqipshop_ci_b` dhe përdorues të pavarur me `REVOKE CONNECT FROM PUBLIC`. Prova negative DB A↔B kaloi: `SHQIPSHOP_TWO_DATABASE_ROLE_DENIAL_PASSED`.
- Në instancën A Medusa, u krijua porosi sintetike 1510 ALL; instanca B u ngrit **pas mbylljes së A** me të dhënat e B, port 9001, key publik të B dhe database të B. Serveri B ktheu **HTTP 200** për katalogun me B key, **HTTP 400** për A key dhe **HTTP 404** për porosinë A të kërkuar me B key. `SHQIPSHOP_SEPARATE_MEDUSA_ORDER_BOUNDARY_PASSED`.
- **Kufiri i provës:** dy instancat u testuan **sekuencialisht** (jo dy procese paralele). Kjo NUK provon admin/customer/session security, izolim të queues/Redis në të gjithë provider-at, media, webhook, refund, billing, backup ose real-world deployment. `G3 tenant isolation` mbetet **NË PROGRES, jo PASS**.
- **Android receipt visual:** [run 39946022933](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933) për 1500 ALL produkte + 10 ALL transport = 1510 ALL dhe FX hint 15.10 EUR sintetik duhet kontrolluar live përpara deklarimit vizual.
- **Next:** test dy backend-e aktive njëkohësisht me kontroll databazash/Redis dhe role admin/client për dy tregtarë, regjistro provision/deprovision + backup/restore, limite të burimeve, analizë reale kosto 5/50/500, pastaj branding i dyqanit dhe përditësimi i Android/PWA per merchant. Mos prek main/production.

## 23 tetor 2026 — PR #11/#12: provat e njëkohshme dhe JWT (përditësim G3)

**Evidenca verifikuese:**
- [PR #11](https://github.com/titanfit102-bit/ShqipShop/pull/11) / [run 39979050578](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39979050578): dy Medusa aktive *njëkohësisht*, 2 DB/role, checkout 1510 ALL në A dhe B, order A↔B nuk shihet (404), key i huaj refuzohet (400) — **GREEN**.
- [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12) / [run 39980753775](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39980753775): sekrete të veçanta JWT/cookie për secilin backend, administratorë e klientë të veçantë; JWT-të e klientëve dhe adminëve refuzohen nga serveri tjetër; aktori customer nuk pranohet në Admin API — **GREEN**.
- [Backend smoke 39980753771](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39980753771) dhe [pilot verify 39980753785](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39980753785): **GREEN**.

**G3 = NË PROGRES, JO PËRFUNDUAR.** Nuk janë verifikuar cookie/session reale të klientit/adminit, akseset e modifikimit të porosive/inventarit, RBAC, Redis/queues/workers, media, backup/restore, secret rotation, provisioning, real payment, load ose production. Dy checkout-et kryhen njëri pas tjetrit *ndërkohë që dy serverët janë aktivë*, jo stress test race-condition. Duhet test izolimi operacional (provider-et vërtet të lidhur), negative mutation auth, pastaj automatisim provisioning dhe analiza e kostos për 5/50/500 biznese.

Shënimet historike më sipër pasqyrojnë gjendjen kur u shkruan; shiko `CURRENT_STATE.md` dhe `MASTER_HANDOFF.md` v22 për checkpoint-in më të ri. Asnjë merge në `main`.


## MASTER CONTINUITY — checkpoint 2026-10-23

- **Verifikuar:** PR #12 HEAD kodi 3eab3c3, [run 39981336521](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336521), [39981336483](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336483) dhe [39981336440](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336440): **3/3 SUCCESS**. PR #11 dhe #12 janë ende Draft. Dokumentet e protokollit të vazhdimësisë në këtë degë kërkojnë kontrollin e HEAD të tyre veçmas.
- **Rruga kritike G3:** (1) autentikim real cookie/session dhe teste negative mutation authorization, RBAC; (2) konfigurimi real i Medusa Redis/queues/workers, tenant backup/restore; (3) source-of-truth Medusa dhe migrimi i pilotit PWA; (4) tenant control plane/provisioning/branding, pastaj pagesa, operacione, pilotë dhe release gates.
- **Politika:** vetëm përditësimet e dokumentacionit të vazhdimësisë janë të autorizuara në degën feat/merchant-auth-boundary-ci. Handoff-i nuk transferohet automatikisht në degë të tjera. Një degë e pavarur docs/continuity ose PR docs-only në main është **propozim** që kërkon autorizim të ri. Nuk ka merge/deploy.
