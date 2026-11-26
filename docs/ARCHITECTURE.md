# Architecture decision record — ShqipShop

**Current decision.** Medusa is the selected commerce authority per merchant. The draft pins backend/reference storefront Medusa to 2.22.6. The PWA/native convergence, release-runtime approval, production deployment and financial gates remain open. See [approved evolution](ROADMAP.md#2026-11-25--approved-architectural-evolution), [tenant ADR](ADR-006_TENANT_BACKEND_ISOLATION.md) and [current evidence](CURRENT_STATE.md).

The following ADR-001 and ADR-002 entries explain the original PWA pilot. Pilot data, endpoints and acceptance checks below describe the FastAPI/SQLite implementation. [ADR-003](ADR-003_MEDUSA_NATIVE_VS_CUSTOM_PILOT.md) records the reversible native proof of concept.

## ADR-001: Pilot delivery is PWA first, native apps later
**Decision:** Use a branded web storefront per merchant, with an installable PWA and a single shared admin codebase.

**Why:** Apple 4.2.6 and Google repetitive-content policies make mass publication of near-identical apps risky. A PWA lets merchants validate catalog management, orders and payments before store approval.

**Revisit:** Three paying pilots explicitly require native push notifications, device features or merchant-owned App Store listings.

## ADR-002: Custom tenant backend only for throwaway pilot
**Decision:** Use FastAPI with SQLite for a functional prototype. Do not advertise Medusa mobile integration as finished.

**Why:** Medusa Mobile is only the mobile client. Medusa multi-store is not tenant isolation out of the box. Installing a shared Medusa and weakening isolation to rush launch would be unsafe. This pilot isolates product/orders in its own backend while native Medusa integration remains an independent workstream.

**Original options and later selection.** Dedicated Medusa per tenant increases per-merchant operating cost and simplifies the isolation boundary. A shared tenant-aware service would require wider policy enforcement and stronger evidence. ADR-006 selects the dedicated model for the initial pilot. The roadmap calls for measured capacity and unit cost before revisiting topology.

## Core data design
- `merchants`: public profile, branding, currency and shipping base cost.
- `users`: email and strong password hashes scoped to `merchant_id`.
- `sessions`: SHA-256 opaque token hashes with CSRF token and expiry.
- `products`: every row has `merchant_id`, price integer in ALL, nonnegative stock.
- `orders`: merchant ID, opaque tracking hash, unique tenant+idempotency key, identity and shipping info. Status transitions are restricted.
- `order_items`: server-snapshotted product name and unit price.

## Security and transaction invariants
- Never trust client price, subtotal or tenant ID; all queries are server-filtered by merchant.
- `BEGIN IMMEDIATE` prevents concurrent pilot checkout operations from overselling; purchase stock is decremented in the same transaction as the order.
- A canceled order restores product stock once; delivered orders are immutable.
- POST admin operations require session tenant check and CSRF token; session cookies are HttpOnly with SameSite Lax and configurable Secure.
- Storefront carts contain only product IDs and quantities and use per-tenant localStorage keys.
- Disable API and admin caching; service worker doesn't cache dynamic data.
- No real payment card data is handled, because the prototype supports cash on delivery only.

## Production gap / key risks
- Stronger auth (account recovery, MFA for operator, distributed login throttling), structured audits, and PII retention/deletion policy.
- Billing plans and lifecycle (trial, churn, suspended merchants), custom domain provisioning and TLS issuance.
- Tax receipt requirements, courier partners, refunds and inventory reservations.
- Object storage for product images with content moderation, metadata and quota enforcement.
- Monitoring, alerting, disaster recovery, database migrations and backup restore tests.
- Accessibility, localization QA, end-to-end iOS and Android build/checkout tests.

## Release acceptance checklist
- [x] Isolated merchant product catalog and admin access via automated tests
- [x] Order idempotency, stock constraint and status transitions via automated tests
- [x] Generic Albanian UI and per-merchant PWA manifest
- [ ] Browser/mobile E2E validated against deployed HTTPS preview
- [ ] PostgreSQL + migrations + backup restore validation
- [ ] Merchant billing and provisioning automation
- [ ] Local payment/courier integration with sandbox and webhook verification
- [ ] Full GDPR/local privacy compliance and legitimate customer data lifecycle
- [ ] Native apps built/tested/published from merchant-owned accounts
