# ShqipShop — Security Register (active; 2026-10-25)

## F07g Stage 2A — PostgreSQL atomic-acceptance CI, 2026-10-25

**Verified code [8f5a5b53](https://github.com/titanfit102-bit/ShqipShop/commit/8f5a5b53bdb3c534f7867949b7cc926fb782ada7)** on Draft PR #12: **8/8 PR workflows SUCCESS** including [backend 40182883873](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40182883873), [F07c 40182883858](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40182883858), [F07d 40182883860](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40182883860), isolation, native, pilot and security baseline. New `f07g-persisted-quote-ci.ts` uses Medusa's PostgreSQL connection and a disposable table in CI only; validates scoped tenant/cart/guest acceptance, rejected expired/stale prices, one-winner concurrent acceptance, replay denial and transaction rollback. Backend logs show `SHQIPSHOP_F07G_POSTGRES_TENANT_PRINCIPAL_AND_EXPIRY_DENIAL_PASSED`, `SHQIPSHOP_F07G_POSTGRES_ATOMIC_SINGLE_ACCEPTANCE_AND_REPLAY_DENIED`, `SHQIPSHOP_F07G_POSTGRES_TRANSACTION_ROLLBACK_PASSED`; old F07f HTTP 409 tests still green.

**F07c regression repaired:** [2b91c545](https://github.com/titanfit102-bit/ShqipShop/commit/2b91c5457b32ae3fd10943a3b188b132219f8816) replaced two Redis `--scan | grep -q .` pipelines (SIGPIPE/exit 141 under `pipefail`) with full-output-consuming `grep . >/dev/null` while preserving both pre/post restart checks; [F07c 40182883858](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40182883858) SUCCESS. Historical failed run 40182334895 remains recorded.

**Strict limits:** This is an isolated synthetic PostgreSQL test, **not** a permanent quote migration, Medusa HTTP review/accept endpoint, authenticated buyer confirmation UI or atomic real payment/order/PSP workflow. F07g Stage 2B remains P0: trusted fresh Medusa cart+price version adapter, tenant-specific persistent quote model, 409 direct completion, idempotency/payment lock and UI tests. G3/G5 BLOCKED; F08 JWT and F09 commerce authority OPEN. No main, merge, deploy, Production, real money or secrets touched. Check this docs commit's own CI separately.





**Scope:** `titanfit102-bit/ShqipShop` / `feat/merchant-auth-boundary-ci`, Draft [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12), based on Draft PR #11. Baseline reviewed at commit [bfa26cf](https://github.com/titanfit102-bit/ShqipShop/commit/bfa26cf8825452b1adaffe71a35191636d0a08bb), with **7/7 associated PR Actions SUCCESS**. The evidence is development/CI, **not** evidence of a live, hardened deployment. No main merge or Production authorization.

## Security governance checkpoint — 2026-10-25

Source HEAD before governance: [bfa26cf](https://github.com/titanfit102-bit/ShqipShop/commit/bfa26cf8825452b1adaffe71a35191636d0a08bb) / PR #12 Draft, 7/7 PR CI successful. Added five security documents, a compact operational `AGENTS.md`, a Python standard-library scanner with five unit tests and [`security-baseline.yml`](../../.github/workflows/security-baseline.yml), triggered automatically on PRs (read-only checkout; no stored credentials). On [code/test commit 7ba7c25](https://github.com/titanfit102-bit/ShqipShop/commit/7ba7c253ea83d4bdfe487881e81d9be7ec24668e), [security CI 40181786360](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40181786360) **SUCCESS**: five scanner tests passed, 601 tracked text files checked with high-confidence credential patterns, no matches. This is NOT CodeQL, Git history/entropy scanning, credential leak remediation or all-secrets protection. Manual `workflow_dispatch` with `release_gate=true` adds two static blockers (debug-signed Android release and AsyncStorage token); the release mode was NOT executed here and Production remains BLOCKED. Other GitHub workflow runs for this code SHA and the new documentation HEAD require independent verification.

**Highest-risk OPEN:** F07g persistent quote/atomic payment/replay and buyer UI, F08 JWT revocation, Android secure storage and approved signing, G3 full merchant/admin/media boundary, F09 commerce authority, PSP webhooks/refunds, real TLS/WAF/backup/monitoring, dependency triage and SAST/CodeQL. Branch protection cannot be read (GitHub API 403), so enforcement status UNKNOWN; no admin settings or Production actions were changed. This checkpoint documents governance, not security certification. New developments must update [SECURITY_REGISTER](SECURITY_REGISTER.md) by exact SHA/run, without exposing secrets.

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
| SEC-02 | P0 | PARTIAL | F07f stale-amount HTTP 409 and F07g Stage 1/Stage 2A PostgreSQL acceptance verified in disposable CI; real persistent quote/API/buyer consent/payment order atomic lock still absent. | [Code 8f5a5b53](https://github.com/titanfit102-bit/ShqipShop/commit/8f5a5b53bdb3c534f7867949b7cc926fb782ada7), [CI 40182883873](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40182883873); Stage 2B P0 |
| SEC-03 | P0 | PARTIAL | JWT local logout race has native tests, but bearer JWT remains usable after cookie logout in controlled A/B test. Server-side revocation/multi-device logout and TTL policy not proved. | PR #12 P0 boundary tests, `MASTER_HANDOFF.md`; F08 next |
| SEC-04 | P0 | PARTIAL | Native token uses AsyncStorage, **not** an evidenced Android Keystore / iOS Keychain-backed secret store. Local logout marker does not substitute for hardware-backed persistence. | `native-medusa/app/api/auth-token-storage.ts`; mobile auth review |
| SEC-05 | P0 | FAILED | Android **release** build configuration points to debug signing. This is a known release-signing gate failure, not evidence of a production-signed APK. | `native-medusa/android/app/build.gradle` (`signingConfig signingConfigs.debug` inside `release`); require approved production signing procedure |
| SEC-06 | P0 | UNKNOWN | Browser HTTPS/TLS/HSTS, cookie domains, CSRF/CORS by tenant, rate limiting/DDoS and edge WAF in actual deployments; no production environment audited. Pilot FastAPI local rate limiter is not a distributed protection. | `app/main.py`, Medusa config, deployment verification required |
| SEC-07 | P0 | UNKNOWN | Payment refunds/returns, PSP webhooks/signatures, retries, 3DS/reconciliation, duplicate order prevention under parallel requests and accounting invariants. No real PSP integration verified. | G5 payment acceptance suite required; system mock tests are not PSP proof |
| SEC-08 | P1 | PARTIAL | Native dependency audit remains **report-only**; new narrow high-confidence plaintext credential scanner has 5 passing unit tests and PR CI; no CodeQL, history/entropy scanning, full advisory gate or verified current advisory triage. | [security run 40181786360](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40181786360), `native-dependency-audit.yml`; SAST/dependency next |
| SEC-09 | P0 | UNKNOWN | PostgreSQL/Redis/media backup encryption, restoration, retention/deletion, credential rotation, TLS/ACL, incident response drills and monitoring. CI Redis AOF restart ≠ production disaster recovery. | F07c/d CI + operator validation; no production access |
| SEC-10 | P1 | PARTIAL | GitHub Actions use SHA-pinned actions and read-only tokens in examined workflows. Full dependency provenance/SBOM, code scanning alerts and branch required-check protections cannot be confirmed. Branch protection API returned **403**, so status is UNKNOWN, not disabled. | GitHub admin inspection/authorization required |
| SEC-11 | P1 | VERIFIED | Narrow scanner successfully checked 601 tracked plaintext files for selected strong indicators (5 tests) at code SHA 7ba7c25. This **does not** cover binary files, Git history, entropy, all credential formats or repository secret-scanning settings; release gate manual mode not invoked. | [security CI 40181786360](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40181786360), `scripts/security/guard.py` |
| SEC-12 | P1 | UNKNOWN | Security of physical Android/iOS devices, hardware-backed storage verification, backup/restore and signed-distribution verification; synthetic emulator/internal APK test ≠ production. | Mobile MASVS/MASTG testing, G5 |
| SEC-13 | P1 | PARTIAL | Five docs created and 47 KB historical AGENTS.md condensed to operational rules with pre-consolidation Git history retained; PR CI security baseline works, but administrative required checks/protected branches are unverified. | `AGENTS.md`, five docs, [security CI 40181786360](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40181786360) |

### Historical diagnostic (do not confuse with new production vulnerability)

An intentionally failing shared-Medusa sales-channel test showed another channel key could retrieve a synthetic order, [run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016). ADR-006 selected separate Medusa/DB instances as pilot isolation. The historical FAILED result remains valid **for the rejected shared-channel architecture**, not evidence that the newer independent-backend test failed.

## Governance protocol

For a new change: identify affected `SEC-xx` and trust boundary → choose matching [test matrix](SECURITY_TEST_MATRIX.md) → implement fail-closed + negative/positive tests → run relevant CI at **exact code SHA** → update affected rows only when evidence changes → check [release gates](SECURITY_RELEASE_GATES.md). `VERIFIED` always states scope and evidence. A green static scan is never a security certification. If a new P0 finding is confirmed, halt merge/release, preserve minimal sanitized evidence and obtain an authorized fix.

**Next critical path:** complete F07g authoritative quote/payment boundary, F08 JWT lifecycle, secure native token storage and release signing, broaden tenant/admin/refund/media isolation tests; then F09 and real deployment/PSP/operational checks. New GitHub protections, production configuration, secrets and payment behavior need separate authorization.
