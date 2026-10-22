# Architecture decision record — ShqipShop

**Further design decision:** [ADR-003 — original Medusa Mobile vs custom PWA pilot](ADR-003_MEDUSA_NATIVE_VS_CUSTOM_PILOT.md) defines a reversible proof-of-concept for native apps, keeping the PWA for business validation. The production source-of-truth is NOT selected yet.

## ADR-001: Pilot delivery is PWA first, native apps later
**Decision:** Use a branded web storefront per merchant, with an installable PWA and a single shared admin codebase.

**Why:** Apple 4.2.6 and Google repetitive-content policies make mass publication of near-identical apps risky. A PWA lets merchants validate catalog management, orders and payments before store approval.

**Revisit:** Three paying pilots explicitly require native push notifications, device features or merchant-owned App Store listings.

## ADR-002: Custom tenant backend only for throwaway pilot
**Decision:** Use FastAPI with SQLite for a functional prototype. Do not advertise Medusa mobile integration as finished.

**Why:** Medusa Mobile is only the mobile client. Medusa multi-store is not tenant isolation out of the box. Installing a shared Medusa and weakening isolation to rush launch would be unsafe. This pilot isolates product/orders in its own backend while native Medusa integration remains an independent workstream.

**Next production decision:** (A) tenant-specific Medusa servers with an independent provisioning control plane (more cost, stronger isolation); or (B) vetted shared multi-tenant commerce service with merchant tenant ID enforcement (more platform work, lower overhead). Benchmark both under real business volume.

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
