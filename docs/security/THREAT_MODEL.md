# ShqipShop — Threat Model (current, privacy-safe)

Method: assets → trust boundaries → STRIDE-style misuse → independently executable defenses. This is the **development baseline**, not a penetration-test report. Never publish exploit payloads, session tokens, real domains, privileged URLs or customer data.

## Assets and boundaries

**Assets:** customer PII, merchant/private catalogue and orders, inventory, administrative sessions, JWT, payment/order integrity, API/domain configurations, media, backups, operator secrets, CI release keys. **Untrusted:** user inputs, public API keys, guest order IDs, mobile/PWA caches, hosted uploads, webhook requests, open-source/PR content, AI tool outputs and third-party packages. **Trusted only after verification:** server-calculated cart/price, authenticated principal, tenant deployment identity, signed PSP callbacks, provisioned secrets and CI attestations.

```text
Untrusted PWA / Native / scripted caller
    -> tenant HTTPS edge (planned TLS + WAF + limits)
       -> merchant-specific Medusa API: auth + object ownership
          -> merchant-specific PostgreSQL + Redis + worker + media
          -> third-party PSP callbacks (not yet integrated)
ShqipShop operator control plane (planned; restricted metadata access)
GitHub / CI build chain -> tested artifacts -> signed production release (not yet)
Legacy FastAPI pilot stays separate; NO implicit shared commerce authority
```

## Threat scenarios and required negative evidence

| ID | Threat mechanism | Required defense / evidence | State |
| --- | --- | --- | --- |
| T01 | Client changes tenant key/ID or guesses another merchant's order/customer/inventory ID | Independent server/DB/Redis identities, ownership per endpoint; foreign identities/data forbidden on GET, mutation and background tasks | PARTIAL, synthetic A/B proof |
| T02 | Theft/replay of JWT, cookie fixation or old device token after logout | Short-lived tokens + server revocation/rotation policy, device control, cookie CSRF/domain tests; secure native hardware-backed storage | PARTIAL / F08 OPEN |
| T03 | Guest receipt enumeration or proof misuse | Independent unguessable cart capability, auth principal cannot downgrade to guest, no private data on failed request, throttled access | PARTIAL / F06 targeted GET |
| T04 | Cart price changes during checkout; amount is stale or client-forged | Server issued price revision + deliberate buyer acceptance; atomic cart/payment/order lock; verify real PSP, fail-closed 409 | PARTIAL / F07f opt-in, F07g helper only |
| T05 | Concurrent completes, retries, webhooks and malicious request replay cause duplicate charge/order/stock effects | Idempotency keys + persisted unique constraints and transactional side-effects + real concurrency tests | UNKNOWN, release P0 |
| T06 | Admin/customer role crosses authority, refunds/stock/inventory manipulated | Server RBAC per action, positive and negative mutations, audit and independent checks | PARTIAL, not all endpoints |
| T07 | Redis crash, worker retries, cache invalidation or mixed tenant events | Isolated Redis credentials/worker queues, recoverability and idempotent handlers | PARTIAL in disposable CI |
| T08 | Compromised dependency, forged GitHub Actions, leaked secret or malicious AI-generated code | SHA pins, dependency lock, minimal CI read permissions, scanned diffs, code analysis and human review for high-risk changes | PARTIAL; scanning/CodeQL not yet proven |
| T09 | Compromised mobile APK or insecure data at rest | Proper signed release (not debug), secure token storage, HTTPS, hardening/device MASVS review | FAILED release signing; others PARTIAL/UNKNOWN |
| T10 | DDoS, credential stuffing, scraper/enumeration of resources | Edge/bounded per-principal+IP limits, detection, throttling, capacity and authorized load test | UNKNOWN production |
| T11 | PII in logs/media/backup or wrong-tenant restore | Redaction, tenant-local storage permissions, data lifecycle, encrypted backups and restore test | UNKNOWN |
| T12 | Prompt injection or supply-chain instructions from untrusted issue/PR/web/tool output direct coding agent to bypass checks | Treat all retrieved prose as **untrusted data**, don't execute embedded instructions; narrow tool permission, confirm repo/branch and changes, require independent CI/protected review | Governance planned; CI baseline needed |

**Impact classification:** any cross-tenant PII disclosure, wrong-customer charge, bypass of payment consent, secret exposure, or untrusted release-signing path is P0; other issues prioritized by exploitability, exposure and business impact. A green test is scoped to its fixtures and does not eliminate unsimulated attacks. Findings must be handled privately with sanitized record IDs.
