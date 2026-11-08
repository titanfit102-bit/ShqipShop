# ShqipShop F07g — durable quote and checkout design (Stage 2C-2)

## F08 Stage 11H — PSP merchant eligibility and sandbox acceptance contract (DESIGN ONLY, 2026-11-08)

**NOT IMPLEMENTED / NOT TESTED:** No provider selected, merchant contract, SDK, sandbox/live credential, payment adapter, approved migration, new executable regression, PSP charge or deployment. [Stage 11G](../CURRENT_STATE.md) proves only manual `pp_system_default` capture/refund in disposable CI. All F08/F07g/F09 and RG-02/RG-03/G3/G5 production gates stay BLOCKED.

### PSP merchant eligibility and jurisdiction

Qualify **each independent merchant entity** by registered country/NIPT, its own PSP contract and bank settlement account, accepted charge/settlement currencies (ALL/EUR), 3DS/SCA, refunds, partial capture, provider-side idempotency, webhook signatures/replay protection, dispute workflow, fees, sandbox documentation/test accounts and audited provider transaction lookup. Merchant customer payments and ShqipShop SaaS subscription billing are **separate financial boundaries** under ADR-006. Neither platform-owner credentials nor client-supplied tenant IDs can grant merchant payment authority.

Official public candidate material examined on 2026-11-08 (advertised features do NOT establish contractual/API eligibility):
- [BKT Virtual POS](https://www.bkt.com.al/en/business/daily-operations/virtual-pos-services/virtual-pos): advertises LEK/EUR acceptance and test accounts following merchant onboarding; API/webhook terms and actual eligibility still need bank confirmation.
- [Fibank POS Virtual](https://www.fibank.al/pos-virtual): advertises LEK/EUR settlement, authorization/capture, refunds and 3D Secure; actual sandbox, API and eligibility need confirmation.
- [Paysera Albania](https://www.paysera.al/v2/en-AL/partners-network): publicly lists online-shop payment collection; verify supported methods, currencies, sandbox and technical/merchant approval.
- [Stripe availability](https://stripe.com/global): lists Italy, not Albania, among directly supported merchant registration locations. An Italian platform account is **not** automatically approved to collect on behalf of Albanian merchants.

**Result:** no provider is adopted. BKT/Fibank are candidate conversations, not approved implementations. The grey EUR *indicative* display is never the actual payment authorization; charge currency, amounts and conversion consent must be explicit and independently supported by the PSP.

### Required provider/Medusa reconciliation boundary (PROPOSED)

1. Resolve tenant from trusted merchant deployment and use only its dedicated PSP account/secrets. Bind operation to Medusa order/cart/customer ownership, immutable accepted server quote fingerprint/version, currency, provider currency precision, and server-computed charge total; reject unaccepted repricing and client amount.
2. Use stable per-merchant, per-business-effect idempotency identities for authorization, capture and refund; preserve provider operation IDs and auditable state transitions. Uniqueness of HTTP requests is NOT proof of one external charge.
3. After timeout or lost provider acknowledgement, mark operation `PENDING_RECONCILIATION`, query authoritative provider state using the original reference, and reconcile independently with PostgreSQL BEFORE any retry. Never use a new payment key to blindly repeat an unknown external charge; unknown is not declined.
4. Verify provider-specific webhook signature, timestamp and deduplication identity before mutation; enforce tenant/order association and monotonic legal transitions for delayed or out-of-order callbacks. Fail closed for foreign/invalid events, and never double-fulfill or double-refund.
5. Reconcile **three distinct ledgers** where applicable: tenant-local Medusa order/payment/refund/inventory, external PSP transactions, and real settlement/payout reports. Sandbox proofs cannot establish real bank settlement. Unresolved divergence requires an explicit exception and authorized review, not silent `PAID`.
6. Keep raw card data outside client/server repository paths; use PSP-hosted/tokenized surfaces, redact PII and payment references in public logs, and require independently approved PCI/GDPR/RBAC boundaries.

### P01–P14 acceptance cases: all UNEXECUTED with a real PSP

| ID | Failure/positive scenario | Mandatory evidence and outcome |
| --- | --- | --- |
| P01 | Valid buyer accepts exact server ALL quote; authorization/capture | One PSP charge and one linked Medusa payment/order, currency/amount match |
| P02 | Concurrent checkout and duplicate same-key capture | One external business effect, one order/fulfillment/stock change |
| P03 | Lost HTTP acknowledgement AFTER PSP success | Query original provider ID; no new charge and no false decline |
| P04 | PSP rejects, disconnects or times out before confirmation | No paid order/fulfillment; UNKNOWN blocked until authoritative reconciliation |
| P05 | Duplicate, delayed, out-of-order signed webhook | At most one legal persisted transition and side effect |
| P06 | Invalid signature/replay/foreign merchant or order | Denied without PSP, order, refund or stock mutation |
| P07 | Changed price, stock, taxes, coupon, shipping, currency or FX | Fail closed and require fresh buyer approval; no stale charge |
| P08 | Interrupted 3DS/SCA or asynchronous authorization | No premature PAID/fulfillment; verified completion idempotent |
| P09 | Partial capture/refund; duplicate/mismatched-key/over-refund | Bounded cumulative amount, stable local and provider operation ID |
| P10 | Crash after PSP success and before database commit; restart | Durable lookup/recovery, no second charge, no lost financial record |
| P11 | Two merchant accounts and DB/Redis with injected foreign IDs | Independent positive + negative tenant isolation and reconciliation |
| P12 | Medusa/PSP totals mismatch, missing webhook, dispute/chargeback | Audit exception, manual review; never silently mark SUCCESS |
| P13 | Unauthorized operator, revoked token, guest downgrade issuing refund | Server RBAC/resource denial, zero external and local mutations |
| P14 | Refund webhook replay after order completion | Exactly-once refund/net amount; coherent fulfillment and immutable audit |

Future **PASS** requires redacted provider ledger lookup/event evidence, independent PostgreSQL comparison, approved buyer-consent test, positive and negative runs, exact SHA and CI artifact. No real provider or settlement tests have been executed for these cases.

**NEXT:** obtain actual merchant eligibility + written PSP API/sandbox material, validate pinned Medusa 2.22.0 integration hooks, seek separate authorization for PSP account/architecture/migration, then implement and test the smallest tenant-local adapter against P01–P14. PR #12 remains Draft; no merge/main/live deployment.


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
