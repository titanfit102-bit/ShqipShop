# ShqipShop — Security Test Matrix

The **minimum security tests depend on changed trust boundaries**. These are pointers to existing executable evidence and open acceptance conditions; do not duplicate entire scripts. Exact SHA/run needed before marking VERIFIED. CI jobs use synthetic tenants and disposable keys only.

| Test ID | Requirement / layer | Existing automated proof (scope) | Status | Next gate |
| --- | --- | --- | --- | --- |
| S01 | Pilot merchant auth/CSRF/idempotent checkout | `.github/workflows/verify.yml` runs pytest; [CI 40178952066](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178952066) | VERIFIED (pilot CI only) | HTTPS browser E2E |
| S02 | A/B backend/DB role and cross-order denial | `parallel-medusa-isolation-ci.yml`, `two-medusa-isolated-ci.yml`; [40178952139](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178952139) | VERIFIED (scoped A/B CI) | full admin/refund/media/tenant deprovision |
| S03 | F08 CI-only cart ownership, checkout and recovery | [Medusa CI 41330729685](https://github.com/titanfit102-bit/ShqipShop/actions/runs/41330729685), `f08-multiprocess-complete-ci.mjs`, `f08-multiprocess-orders-ci.ts` | VERIFIED narrow CI 8/8: synthetic lost acknowledgement, restart and owner retry retained same PostgreSQL order and cart link | Global revocation, cookies/CSRF, PSP, guest expiry and production F08 OPEN |
| S04 | Guest receipt ID not sufficient | `ensure-order-reader.ts` + checkout A/B tests | VERIFIED (GET covered) | returns and other order routes, restart |
| S05 | Redis session/cache, workers, locks and bounded outage recovery | F07c/F07d plus [CI 41328337308](https://github.com/titanfit102-bit/ShqipShop/actions/runs/41328337308) | Synthetic subsets VERIFIED; controlled Redis 10s pause + API crash/restart passed | Redis full loss/failover/HA, TLS/ACL, backups and queue retry idempotency OPEN |
| S06 | Client-local JWT logout + private cache isolation | `native-medusa/__tests__/auth-token-storage.test.ts`, other native cache tests, `verify-native.yml` | VERIFIED (Jest), PARTIAL system | Keystore/Keychain + emulator/device, revocation |
| S07 | Live synthetic Medusa payment mismatch HTTP 409 | `medusa-backend-smoke.yml` F07f injection; [CI 40178570633](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178570633) | VERIFIED (opt-in CI only) | default production guard policy and PSP |
| S08 | F07g real Medusa guest/customer HTTP review and atomic accept, plus one per-cart PostgreSQL claim across distinct accepted quotes | `quote-claim-ci.ts`, `f07g-live-cart-snapshot-ci.ts`; [CI 40499708458](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40499708458) | VERIFIED disposable CI ONLY | Durable per-cart intent model, real Medusa stock/order/payment lock and PSP exactly-once business effects, CSRF/full pricing/UI |
| S09 | Production Android signed build, secure token at rest, certificate policy | Android `build.gradle`, manifest and token storage inspected | FAILED (debug release signing), PARTIAL/UNKNOWN elsewhere | signed release on isolated device + MASVS |
| S10 | Dependency security and provenance | Existing `native-dependency-audit.yml` is **report-only**, frozen installs and SHA-pinned actions in tested workflows | PARTIAL | risk-tuned blocking advisories, SBOM, verified CodeQL |
| S11 | High-confidence credential markers in tracked plaintext | `scripts/security/guard.py --scan`, 5 unittest cases, [run 40181786360](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40181786360): 601 files, no matches | VERIFIED (narrow PR guard only) | Add historical/entropy/host secret scanning and workflow privilege/security scanning; never treat as complete secret audit |
| S12 | Live production domain/TLS/CSRF/rate limit/observability | No live environment evidence | UNKNOWN | independent staging/production validation |
| S13 | Duplicate order/charge/payment reconciliation | [Medusa CI 41330729685](https://github.com/titanfit102-bit/ShqipShop/actions/runs/41330729685): deliberate lost HTTP acknowledgement after mock order persistence | PARTIAL: DB before/after restart identical single order; anonymous denied and owner retry nonduplicative | Real PSP webhooks, charge idempotency, in-commit failures, refunds, distributed stock and repeated load UNKNOWN |
| S14 | Privacy retention/media upload/backup/restore | No live infra evidence | UNKNOWN | tenant-aware operator runbooks and drill |

## Incremental test selection

- **Docs/copy/theme:** S11 baseline + changed-doc review; no Medusa migrations or Android emulator unless security claims/code changed.
- **Frontend/native logic:** S11 + `verify-native`, affected Jest, cache and auth negative tests; mobile network/storage controls if relevant.
- **Server/API/auth/DB/Redis/checkout:** S11 + relevant Medusa A/B isolation, payment/guest/session paths and synthetic negative/positive tests. Any payment amount or tenancy change expands S02–S08.
- **Dependencies/build/CI:** S11 + lockfile audit/SAST and supply-chain review, signed Android release check for distribution-related changes.
- **Release/prod:** ALL applicable gates in [SECURITY_RELEASE_GATES](SECURITY_RELEASE_GATES.md), real HTTPS/device/PSP/restore rehearsal and independent review.

No tests may be marked GREEN by skipping, suppressing or weakening security assertions. An intentionally red historical diagnostic is retained as evidence of the rejected architecture.
