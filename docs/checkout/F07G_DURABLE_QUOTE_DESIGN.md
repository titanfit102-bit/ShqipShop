# ShqipShop F07g — durable quote and checkout design (Stage 2C-2)

**2026-10-27 2C-5 CI-only evidence:** A disposable unique PostgreSQL partial index on tenant/cart where quote status is claimed prevents *different accepted quote IDs* for one real Medusa cart from both claiming under concurrent requests. [Medusa CI 40499708458](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40499708458) passed. Production needs separately reviewed per-cart unique checkout-intent/fulfillment/idempotency guarantees and PSP reconciliation; the CI index is NOT a release-ready migration or payment lock.


**2026-10-27 2C-4 scoped proof:** Registered Medusa owner HTTP quote review/accept passed [CI 40448041404](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40448041404), denying foreign buyer, guest downgrade, spoofed tenant and replay/reprice. Owner quote is still **pre-issued only by CI script**. Production module, cookie CSRF, migration, PSP and shared checkout transaction NOT approved or implemented.


**2026-10-27 CI-only update:** A disposable guest HTTP GET review / POST one-winner accept boundary passed [Medusa CI 40447001570](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40447001570), including stale 409. Quote issuance remains CI-script only; production model and endpoints below stay **NOT APPROVED / NOT IMPLEMENTED**.


**DESIGN ONLY — not an approved migration, Store API, payment hook, or release.**
Separate architectural/security authorization is required before production
persistence or changing Medusa cart completion. Current branch: Draft PR #12.

## Trust and authorization invariants

1. The merchant deployment (not a browser header, body, or path) supplies the
   tenant ID. Each merchant retains independent Medusa/PostgreSQL/Redis and
   scoped worker identities. Keep cross-tenant isolation on every query/write.
2. Medusa-validated customer sessions/JWT must own the cart. A failed bearer
   or cookie cannot downgrade to guest access. Guest possession requires the
   original secret cart capability and tenant-bound HMAC binding; do not log
   or persist the raw proof. F08 server JWT revocation is still missing.
3. A fresh Medusa backend adapter must calculate all item prices, stock,
   taxes, shipping, discounts, credits, currency and catalogue revisions.
   No frontend total, EUR indication or tenant/customer assertion is trusted.
4. Buyer separately reviews line-item ALL amounts and explicitly accepts an
   immutable, versioned, expiring quote fingerprint. Never silently replace
   the amount after repricing; require a new quote and buyer consent.

## Proposed tenant-local schema — NOT CREATED

| Field | Required property |
| --- | --- |
| quote_id | Opaque UUID primary key |
| tenant_id, cart_id, buyer_binding | NOT NULL, always server-scoped |
| immutable_snapshot, version, fingerprint | Versioned JSONB, canonical hash, no PII or raw credentials |
| issued_at, expires_at | DB-owned times; TTL max 5 minutes |
| status | issued, accepted, claimed, fulfilled, expired, cancelled |
| accepted_at, acceptance_nonce | One conditional buyer-accept transition |
| claimed_at, claim_nonce, checkout_intent_id | Unique, one-winner pre-payment claim |
| order_id, payment_reference | Optional, verified business identities and uniqueness |
| created_at, updated_at | Operational auditing with retention controls |

Final choice between a Medusa module and a dedicated tenant-local table needs
an independent migration and upgrade-compatibility review. Add unique active
intent constraints, permissions, retention policy, migrations and rollback
tests before acceptance. Tenant-separated DB accounts are the primary boundary;
row-level security may add defense in depth but cannot replace deployment
isolation.

## Proposed endpoints and workflow — NOT IMPLEMENTED

**Review/issue:** authenticated Store POST using cookie CSRF/origin checks.
Recalculate authoritative Medusa cart, persist immutable quote, return quote
ID, fingerprint, full itemized ALL payable total and expiry with no-store.
Do NOT create PSP sessions on review.

**Accept:** separate authenticated POST with quote ID and fingerprint only.
Require identical tenant, buyer, cart and fresh backend snapshot. Conditional
issued-to-accepted transition; expired/repriced/changed-stock decisions result
in HTTP 409 and buyer must review again. Enforce one winner under concurrency.

**Claim:** trusted checkout worker executes one accepted-to-claimed intent
transition with server-side expiration checks and idempotent business key.
A successful PostgreSQL claim is merely local intent reservation, NOT an
atomic Medusa order, inventory hold or PSP authorization.

**Complete/reconcile:** implement actual Medusa workflow transaction boundary
if supported. Otherwise use a durable outbox/saga, compensations and exactly-
once business-effect constraints across PSP, stock and order state. Verify
signed webhooks, 3DS/authorizations, retries, out-of-order callbacks, refund
handling, rollbacks and crash recovery. Never confuse a database compare-and-
swap on the quote table with a guarantee of no duplicate external charge.

## Required negative tests before release

- Cross-merchant and foreign customer/cart IDs, invalid/expired/revoked
  tokens, session cookies, CSRF, forged caller-supplied tenant or amounts.
- Currency, shipping, tax, stock, coupon, discount, address, cart and catalogue
  revision changes between review, accept, claim and order completion.
- Two simultaneous accepts/claims, expired quote, replay/restart, crashed
  worker before and after PSP authorization, duplicate/out-of-order webhook.
- HTTPS, rate limits, receipt privacy, tenant RBAC, media/backup isolation;
  live staging/PSP sandbox and physical Android/iOS coverage; buyer UI proves
  the EXACT quote total was displayed and intentionally confirmed.

## Verified scope and unresolved gates

The Stage 2C-2 CI-only proof extends the existing disposable real Medusa cart
PostgreSQL quote test with a second, single-winner, scoped pre-payment intent
claim and a stale accepted quote that cannot be claimed after repricing.
It adds **no production table/migration, Store review/accept HTTP route, real
payment, order workflow, worker, secret, or deployment**.

F07g full buyer acceptance and payment/order binding, F08 JWT revocation,
F09 single commerce authority and all G3/G5 release gates remain OPEN.
