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

### Stage 11H-2 — provider feasibility evidence, 2026-11-08 (RESEARCH, not integration approval)

**Screening assumption:** first pilot merchants are **separately incorporated Albanian businesses** with their own funds, account, contract and merchant-branded shop. If a merchant is legally established elsewhere, the assessment must be repeated for its actual jurisdiction; the platform's Italian presence cannot authorize a different merchant's card charges.

| Option | Verified official statements | Important unknown or blocker | Qualification decision |
| --- | --- | --- | --- |
| **BKT Virtual POS** | Visa/Mastercard acceptance in LEK and/or EUR; provider gives technical integration manual and *test accounts after onboarding*; website applicant is required to be the website owner; public site lists **€170 setup + €110 annual maintenance** (other transaction fees not established) | Bank must confirm whether a merchant-branded ShqipShop subdomain, merchant-owned/custom domain and SaaS operator implementation satisfy the website-ownership requirement; obtain contract, fee schedule, merchant-level credentials, API, callbacks and idempotency guarantees | **Priority 1: commercial/technical qualification only; NOT selected** |
| **Fibank POS Virtual** | Hosted payment interface, one-step/two-step authorization/capture, card security/3DS, refunds and LEK/EUR merchant account; publicly offers integration support | Written sandbox access, API, webhook/replay security, exact merchant contract, refund implementation and current fees NOT verified | **Priority 2: parallel qualification; NOT selected** |
| **Paysera Checkout Modern** | Public developer docs expose OAuth2, webhook HMAC, idempotent refunds and Test Mode | **Albania is NOT listed as a supported Checkout Modern merchant market** (currently LT/LV/EE/BG/XK/MK). Publicly documented Modern API cannot be assumed deployable for Albanian legal entities | **Not an available Albanian pilot integration on current documented rollout; reconsider only on written provider confirmation** |
| **Paysera Checkout Classic** | Official legacy redirect/callback integration exists and Paysera Albania lists a merchant gateway | [Paysera Albania's own checkout page](https://www.paysera.al/v2/en-AL/payment-gateway-checkout) states Visa/Mastercard processing is available for natural/legal persons **registered within the EU**. Albanian-entity card acceptance and payment methods are therefore **not verified**. Classic's older signing/callback design requires independent cryptographic/security review | **Conditional research only; never use it as an assumed Albania card-payment solution** |
| **Stripe** | Stripe public supported-business jurisdictions include Italy; Albanian direct business registration not listed | It does not automatically cover an Albanian merchant under an Italian ShqipShop platform account; Stripe demands a correctly established eligible legal entity | **Do not shortlist for Albania-registered merchants by default** |

Primary sources:
- [BKT official Virtual POS](https://www.bkt.com.al/en/business/daily-operations/virtual-pos-services/virtual-pos) — ownership/onboarding, supported cards/currency, published fees and test-account sequence.
- [Fibank official POS Virtual](https://www.fibank.al/pos/pos-virtual/) — hosted checkout, partial lifecycle features and LEK/EUR.
- [Paysera Checkout Modern availability](https://developers.paysera.com/guides/checkout-modern) and [Modern getting started limitations](https://developers.paysera.com/guides/checkout-modern/getting-started) — Albania excluded from published rollout despite public API docs.
- [Paysera Albania gateway page](https://www.paysera.al/v2/en-AL/payment-gateway-checkout), [Checkout Classic overview](https://developers.paysera.com/guides/checkout-classic) and [Classic callback verification](https://developers.paysera.com/guides/checkout-classic/getting-started/making-your-first-payment/processing-callback) — verify card market restrictions, merchant project and legacy security semantics before any use.
- [Stripe supported countries](https://stripe.com/global), [Stripe cross-border account requirements](https://support.stripe.com/questions/requirements-to-open-a-stripe-account-in-another-country).

**High-risk white-label go/no-go requirement:** a merchant must be allowed to hold **its own** PSP merchant contract while using a website technically operated by ShqipShop. BKT's published website-ownership clause is an explicit unresolved dependency. The bank must clarify control of a branded domain or subdomain, merchant identity in checkout/receipt, refund authority, webhook access and who receives settled funds. No Shopify-like split/marketplace model or custody of merchant funds may be assumed. Verify in writing *before* a native/PWA payment adapter is designed.

**Currency invariant:** advertised LEK/EUR support is not proof of interchangeable charge currencies. Independently obtain PSP currency minor-unit rules, authorized currency, amount conversion policy, merchant settlement currency, rounding and card-statement display. The grey EUR equivalent in ShqipShop remains an **indicative display**, not a charged value.

**Research outcome:** official public sources make **BKT and Fibank qualified contacts, not approved suppliers**. No provider-specific API credentials or integrations are present in this codebase. For BKT the online published fees are **indicative at review date, not a confirmed quotation**. A written onboarding/technical answer from a concrete merchant is the necessary next piece of evidence. Existing P01–P14 remain **UNEXECUTED** for an external PSP; every production gate remains BLOCKED.


### Stage 11I — confirmed direct Payment Module refund boundary failure (CI only, 2026-11-08)

[Code ae65f20](https://github.com/titanfit102-bit/ShqipShop/commit/ae65f201bda12718184391d1d4ec3dfc57f5f777) + [Medusa CI 42533394638](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42533394638) **FAILED** after the direct `paymentService.refundPayment` accepted a new-key over-remaining request and a second refund was persisted by PostgreSQL Query with the system/manual provider. **Do not generalize to all Medusa workflows, real PSP settlement or production endpoints.** The amount of the external financial effect is unknown; no external provider was used. Preserve this red regression and require independent positive/negative tests of the higher-level [`refundPaymentsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/refundPaymentsWorkflow) on fresh disposable payment fixtures. Any production merchant refund path must have verified authorization, remaining-refund bound, safe idempotency, provider reconciliation, concurrency protection and role-based approval before separate authorization. P01–P14 remain pending with real PSP; all release gates BLOCKED.

### Stage 11J — zero-decimal refund tolerance requires strict merchant-level guard (CONFIRMED CI 2026-11-09)

[Medusa CI 42534844309](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42534844309): for a separate synthetic `pp_system_default` payment already refunded fully, Medusa 2.22.0 `refundPaymentsWorkflow` accepted and persisted **1 extra ALL**, despite rejecting `+2 ALL` and allowing normal partial/exact remaining refunds. Pinned `ALL` has zero decimals; the workflow's `epsilon=1` tolerance is unsuitable as an exact merchant refund-liability bound. Direct `paymentService.refundPayment` persisted excess in the same run on another synthetic fixture. **Neither public Admin access nor real PSP settlement is demonstrated.** Any approved future refund entry must verify strict captured-minus-successful-and-pending amounts and currency units under merchant/auth/operation locking, independently of Medusa rounding epsilon, and reconcile PSP outcomes; preserve both red CI sentinels until proof of a permitted safe path. No production integration, migration or policy is authorized.

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


### Stage 11N — merchant-authorized refund entry and outbox model (PROPOSED, CI-only contract)

Use a back-end verified Medusa Admin subject with `finance_admin` (or a separately approved more granular permission), trusted deployed merchant scope, original server-calculated order/payment/capture ledger and settlement-currency integral amount. Forbid public Store clients and frontend-tenant claims as sources of refund authority. Acquire payment-row lock; reserve captured-minus-all-pending-and-confirmed amounts and write an immutable operation ID plus unique outbox event in the **same committed transaction**. Release transaction before external PSP request. A claimed dispatch must not be blindly repeated when external result is ambiguous: reconcile authenticated provider record using merchant/payment/reference/amount, accept signed events idempotently, keep unknown results pending and fully reserved until explicit resolution. Reject wrong actor/merchant, changing key amount, exhausted balance, non-integer ALL, unknown provider record, or mismatched provider evidence. Reconcile failed provider operations only after authoritative negative proof and recorded audit. Require independently validated Admin RBAC, negative API access tests, concurrent workers/restarts, PSP sandbox, webhook signature and real provider idempotency before deployment. Stage 11N synthetic CI validates a narrow database control only; the application financial release gates stay BLOCKED.

