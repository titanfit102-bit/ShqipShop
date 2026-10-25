# ShqipShop — Security Register (active; 2026-10-25)

**Scope:** `titanfit102-bit/ShqipShop` / `feat/merchant-auth-boundary-ci`, Draft [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12), based on Draft PR #11. Baseline reviewed at commit [bfa26cf](https://github.com/titanfit102-bit/ShqipShop/commit/bfa26cf8825452b1adaffe71a35191636d0a08bb), with **7/7 associated PR Actions SUCCESS**. The evidence is development/CI, **not** evidence of a live, hardened deployment. No main merge or Production authorization.

This is the **current, concise status index**; the detailed chronological evidence stays in `docs/PROJECT_HISTORY.md`, `docs/CURRENT_STATE.md`, `docs/MASTER_HANDOFF.md`, the ADRs and GitHub commits/runs. Re-evaluate every status when new code, test, incident, vulnerability advisory or deployment changes its evidence. Avoid publishing exploit details, private infrastructure addresses, real credentials, tokens or customer data. Report sensitive findings privately to the owner.

## Status definitions

- **VERIFIED** — a specific implemented control is demonstrated by relevant tests at a named SHA, **within the stated test scope**, not globally.
- **PARTIAL** — partial implementation/proof or known shortfall.
- **FAILED** — a concrete negative result/violation in the stated scope; do not obscure it with aggregate GREEN.
- **UNKNOWN** — no adequate evidence or environment access.
- **NOT APPLICABLE** — justified absence of an applicable component/feature, revisit when scope changes.

## Current register (P0 blocks release; P1 must be resolved before professional production; P2 enhancement)

| ID | Priority | Status | Control / verified boundary / unresolved requirement | Evidence / owner of next action |
| --- | --- | --- | --- | --- |
| SEC-01 | P0 | PARTIAL | Separate A/B Medusa services, PostgreSQL databases and roles, Redis/cache/worker probes and limited Admin/Customer JWT/cookie/order/mutation negative HTTP tests. Full endpoints, refunds, media, operations and deployed tenant lifecycle remain unproven. | [ADR-006](../ADR-006_TENANT_BACKEND_ISOLATION.md), [CI 40178952139](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178952139), [40178952074](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178952074); G3 owner |
| SEC-02 | P0 | PARTIAL | F07f opt-in (CI-only) payment-session/cart equality; HTTP 409 on injected stale session **VERIFIED in synthetic scope**. F07g pure versioned quote contract **VERIFIED in CI**; no persistent acceptance, authoritative HTTP checkout gate, price lock or concurrency/idempotent PSP proof. | [Code F07g e9f6033](https://github.com/titanfit102-bit/ShqipShop/commit/e9f6033778d15059cdbcd805807eabb2d101f270), [backend run 40178570633](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178570633); F07g next |
| SEC-03 | P0 | PARTIAL | JWT local logout race has native tests, but bearer JWT remains usable after cookie logout in controlled A/B test. Server-side revocation/multi-device logout and TTL policy not proved. | PR #12 P0 boundary tests, `MASTER_HANDOFF.md`; F08 next |
| SEC-04 | P0 | PARTIAL | Native token uses AsyncStorage, **not** an evidenced Android Keystore / iOS Keychain-backed secret store. Local logout marker does not substitute for hardware-backed persistence. | `native-medusa/app/api/auth-token-storage.ts`; mobile auth review |
| SEC-05 | P0 | FAILED | Android **release** build configuration points to debug signing. This is a known release-signing gate failure, not evidence of a production-signed APK. | `native-medusa/android/app/build.gradle` (`signingConfig signingConfigs.debug` inside `release`); require approved production signing procedure |
| SEC-06 | P0 | UNKNOWN | Browser HTTPS/TLS/HSTS, cookie domains, CSRF/CORS by tenant, rate limiting/DDoS and edge WAF in actual deployments; no production environment audited. Pilot FastAPI local rate limiter is not a distributed protection. | `app/main.py`, Medusa config, deployment verification required |
| SEC-07 | P0 | UNKNOWN | Payment refunds/returns, PSP webhooks/signatures, retries, 3DS/reconciliation, duplicate order prevention under parallel requests and accounting invariants. No real PSP integration verified. | G5 payment acceptance suite required; system mock tests are not PSP proof |
| SEC-08 | P1 | PARTIAL | `native-dependency-audit.yml` generates a report **without failing on advisories**; no evidenced CodeQL or repository-wide automated secret scanning before this governance phase. Unknown current live advisories. | `.github/workflows/native-dependency-audit.yml`; add minimal CI and triage actual findings |
| SEC-09 | P0 | UNKNOWN | PostgreSQL/Redis/media backup encryption, restoration, retention/deletion, credential rotation, TLS/ACL, incident response drills and monitoring. CI Redis AOF restart ≠ production disaster recovery. | F07c/d CI + operator validation; no production access |
| SEC-10 | P1 | PARTIAL | GitHub Actions use SHA-pinned actions and read-only tokens in examined workflows. Full dependency provenance/SBOM, code scanning alerts and branch required-check protections cannot be confirmed. Branch protection API returned **403**, so status is UNKNOWN, not disabled. | GitHub admin inspection/authorization required |
| SEC-11 | P0 | PARTIAL | Legacy FastAPI/SQLite pilot and Medusa commerce are separate backends; one production commerce source of truth across PWA/native is not implemented. | `ARCHITECTURE.md`, `MASTER_HANDOFF.md`; F09 |
| SEC-12 | P1 | UNKNOWN | Security of physical Android/iOS devices, hardware-backed storage verification, backup/restore and signed-distribution verification; synthetic emulator/internal APK test ≠ production. | Mobile MASVS/MASTG testing, G5 |
| SEC-13 | P1 | PARTIAL | Agent instructions existed but were a long historical log. New operational governance and CI must be verified independently at their own commit. | `AGENTS.md`, `docs/security/`, new workflow run when completed |

### Historical diagnostic (do not confuse with new production vulnerability)

An intentionally failing shared-Medusa sales-channel test showed another channel key could retrieve a synthetic order, [run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016). ADR-006 selected separate Medusa/DB instances as pilot isolation. The historical FAILED result remains valid **for the rejected shared-channel architecture**, not evidence that the newer independent-backend test failed.

## Governance protocol

For a new change: identify affected `SEC-xx` and trust boundary → choose matching [test matrix](SECURITY_TEST_MATRIX.md) → implement fail-closed + negative/positive tests → run relevant CI at **exact code SHA** → update affected rows only when evidence changes → check [release gates](SECURITY_RELEASE_GATES.md). `VERIFIED` always states scope and evidence. A green static scan is never a security certification. If a new P0 finding is confirmed, halt merge/release, preserve minimal sanitized evidence and obtain an authorized fix.

**Next critical path:** complete F07g authoritative quote/payment boundary, F08 JWT lifecycle, secure native token storage and release signing, broaden tenant/admin/refund/media isolation tests; then F09 and real deployment/PSP/operational checks. New GitHub protections, production configuration, secrets and payment behavior need separate authorization.
