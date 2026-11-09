# ShqipShop — Security Test Matrix

## 2026-11-09 — Stage 11N finance identity + outbox S13/T06 proof (IMPLEMENTED; CI PENDING)

Early Medusa smoke script `f08-refund-authorized-outbox-ci.ts`: synthetic trusted actor/merchant fixture, finance-only permission with negative caller cases, exact zero-decimal ALL remaining bound, unique operation keys, atomic reserve + outbox, row-lock concurrency, rollback, no automatic resend after unknown mock provider outcome, and fake trusted confirmation/replay mismatch tests. **NOT real Medusa Admin auth/PSP/provider verification and NOT production bound.** Stage 11I/J regressions remain RED; S13/T05/T06 release gates BLOCKED.


## 2026-11-09 — F08 Stage 11M: synthetic provider ACK-loss reconciliation VERIFIED (CI ONLY)

**Stage 11M narrow VERIFIED:** [Medusa CI 42539022390](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42539022390) five processes, separate fake provider/local commits, discarded ACK, same-key replay without duplicate simulated effect, unknown result remaining reserved, dual reconciler idempotency, merchant scope and cleanup. No real PSP/provider lookup, permissions, webhook or production integration. Stage 11K PASS; Stage 11I/J direct/workflow over-refund PERSISTED/FAILED, backend smoke RED. S13/T05 still FAILED/PARTIAL, release BLOCKED.


## 2026-11-09 — Stage 11M S13 provider acknowledgement ambiguity (IMPLEMENTED; CI PENDING)

A mandatory disposable `medusa exec` script uses five distinct processes with fake provider table, persisted refund reservation and operation key; tests no resend on lost ACK, cross-merchant/key conflict, unknown provider result remaining reserved, repeated/concurrent reconciliation and cleanup. **Not a real PSP/provider, webhook/3DS, production auth or real process crash proof.** Stage 11I/J payment bugs remain RED; S13 FAILED/PARTIAL and RG-03 BLOCKED.


## 2026-11-09 — Stage 11L atomic refund reservation proof VERIFIED (DISPOSABLE PostgreSQL ONLY)

**VERIFIED as isolated DB reservation POC only:** [Medusa CI 42537695571](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42537695571) Stage 11L success with two PG sessions and NOWAIT row-lock proof; atomic new-key reservation, same-key replay, mismatched-key-amount denial, rollback, parallel 60+60 vs 100 ALL yielding at most one accepted, simulated merchant A/B scope checks. **NOT production refund route, RBAC, PSP or multi-process API proof.** Stage 11K serial bound SUCCESS; 11I/J over-refund tests FAILED by design and overall backend smoke RED. S13/T05 remains FAILED/PARTIAL; RG-02/RG-03 release BLOCKED.


## 2026-11-09 — Stage 11L S13/T05 atomic reservation primitive (IMPLEMENTED, UNVERIFIED)

New `f08-refund-reservation-race-ci.ts` uses two distinct PostgreSQL sessions, `FOR UPDATE NOWAIT` denial, transactional atomic balance+operation write, cross-tenant synthetic scoped checks, key replay/conflict and rollback, plus parallel over-cap claims. **CI PENDING**; this is database reservation evidence only, NOT a real provider refund or production permission. Retain mandatory Stage 11I/J failing checks. S13 P0/RG-03 BLOCKED.


## 2026-11-09 — F08 Stage 11K: strict serial ALL refund guard verified (DISPOSABLE CI ONLY)

**VERIFIED scope: TEST-ONLY serial pre-call amount guard, NOT fixed S13.** [CI 42536108473](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42536108473) Stage 11K showed successful exact integer ALL remaining-balance validation and PostgreSQL effects for positive partial/full and negative invalid/+1 ALL requests on independent second Stage 11B mock order. Known-red Stage 11J and 11I still persisted extra refunds and failed backend smoke. **S13/T05 remains FAILED/PARTIAL; RG-03 BLOCKED.** NEXT: scoped server RBAC/tenant, transactional idempotent serialization across processes, real PSP and webhook test suite.


## 2026-11-09 — Stage 11K narrow S13 guard test (IMPLEMENTED, CI PENDING)

`f08-refund-exact-bound-ci.ts` checks positive partial/full and negative invalid/over-remaining requests before the `pp_system_default` direct module call on an independent synthetic order. **Serial CI-only amount policy**; no production enforcement, auth, distributed lock or PSP evidence. Both confirmed 11I/11J regressions remain mandatory and red. S13/T05 remain FAILED/PARTIAL; RG-03 BLOCKED.


## 2026-11-09 — F08 Stage 11J: zero-decimal ALL workflow over-refund persisted (CONFIRMED CI FAILURE)

**S13/T05 updated, P0:** [CI 42534844309](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42534844309) confirmed a persisted extra `+1 ALL` refund through `refundPaymentsWorkflow` on a fully refunded separate Stage 11B mock payment, and independently confirmed direct module over-refund in Stage 11I. Normal partial/full workflow paths and `+2 ALL` denial passed. Zero-decimal epsilon=1 from pinned Medusa. **Status remains FAILED/PARTIAL, release BLOCKED**; no live PSP/sandbox, concurrent race, Admin authorization or real settlement proof. Keep both regressions enabled.


## 2026-11-08 — Stage 11J additional S13 workflow test (IMPLEMENTED, UNVERIFIED)

`f08-refund-workflow-ci.ts` uses the independent Stage 11B disposable payment with `refundPaymentsWorkflow` for over-total, partial, over-remaining, exact remaining, and fully-refunded negative checks; PostgreSQL Query proves persisted records. Runs **before** the existing Stage 11I direct-Payment-Module confirmed-red regression. Its passing log markers must be checked at exact SHA; the documented red low-level module risk and S13 **FAILED/PARTIAL** release status cannot be changed by a narrower green workflow.


## 2026-11-08 — F08 Stage 11I: direct module over-refund persisted (CONFIRMED CI FAILURE)

**CONFIRMED IN DISPOSABLE MEDUSA 2.22.0 CI, NOT A LIVE PSP TEST:** [diagnostic code ae65f20](https://github.com/titanfit102-bit/ShqipShop/commit/ae65f201bda12718184391d1d4ec3dfc57f5f777), [backend CI run 42533394638](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42533394638). After Stage 11G's full manual-provider capture and one legitimate keyed partial refund, the **direct** Payment Module `paymentService.refundPayment` accepted a fresh-key refund requested at **remaining captured amount + 1**. Independent Medusa PostgreSQL Query immediately found **two persisted refund rows, not one** and the CI emitted both `SHQIPSHOP_F08_STAGE11I_DIRECT_MODULE_OVER_REFUND_CALL_ACCEPTED` and `SHQIPSHOP_F08_STAGE11I_DIRECT_MODULE_OVER_REFUND_PERSISTED`. Its critical no-extra-refund assertion FAILED (2 !== 1). This confirms a persisted extra refund on this **direct low-level module invocation with `pp_system_default`**. It does **NOT** establish an exploitable standard Admin API path, real bank/card refund, external settlement loss, production behavior, or whether Medusa's higher-level workflows enforce the bound.

**Security decision:** Stage 11I = **FAILED / RELEASE-BLOCKING RISK for direct refund calls**; no code/config/role policy change is authorized for Production. Preserve the failing CI assertion; do NOT bypass, skip, weaken or relabel red as green. Other seven distinct workflows passed on the diagnostic SHA, while backend smoke remained RED. Medusa documentation describes a refund-amount validation step in [`refundPaymentsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/refundPaymentsWorkflow); it is a **candidate safe boundary**, NOT VERIFIED against pinned 2.22.0/our app. **NEXT:** separately test validated workflow over-amount and valid partial/full refund against fresh disposable payment/DB fixtures (positive+negative), confirm admin and programmatic refund call graph/RBAC, analyze refund idempotency/provider timeout and concurrency; decide on production policy/adapter only with separate authorization. RG-02/RG-03/F07g/F08/F09/G3/G5 **BLOCKED**. No main merge, live payments or production deployment.

## 2026-11-08 — F08 Stage 11H acceptance design pointer

[Existing F07g checkout design](../checkout/F07G_DURABLE_QUOTE_DESIGN.md) now enumerates provider eligibility and P01–P14 sandbox reconciliation/negative conditions. **No new execution evidence:** S13 remains PARTIAL and all relevant release gates remain BLOCKED; Stage 11G manual `pp_system_default` remains the last verified capture/refund scope.


The **minimum security tests depend on changed trust boundaries**. These are pointers to existing executable evidence and open acceptance conditions; do not duplicate entire scripts. Exact SHA/run needed before marking VERIFIED. CI jobs use synthetic tenants and disposable keys only.

| Test ID | Requirement / layer | Existing automated proof (scope) | Status | Next gate |
| --- | --- | --- | --- | --- |
| S01 | Pilot merchant auth/CSRF/idempotent checkout | `.github/workflows/verify.yml` runs pytest; [CI 40178952066](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178952066) | VERIFIED (pilot CI only) | HTTPS browser E2E |
| S02 | A/B backend/DB role and cross-order denial | `parallel-medusa-isolation-ci.yml`, `two-medusa-isolated-ci.yml`; [40178952139](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178952139) | VERIFIED (scoped A/B CI) | full admin/refund/media/tenant deprovision |
| S03 | F08 disposable CI registered cart auth, checkout and payment lifecycle | [CI 42529315731](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42529315731), `f08-psp-contract-ci.ts` plus 11F DB checks | VERIFIED narrow CI 8/8: full mock capture repeated without second persisted row, partial keyed refund repeated without duplicate, invalid amounts/conflicting key rejected | F08 P0 OPEN: real PSP, global/device JWT revoke, guest expiry, CSRF/cookies, production policy |
| S04 | Guest receipt ID not sufficient | `ensure-order-reader.ts` + checkout A/B tests | VERIFIED (GET covered) | returns and other order routes, restart |
| S05 | Redis session/cache, workers, locks and bounded outage recovery | F07c/F07d plus [CI 41328337308](https://github.com/titanfit102-bit/ShqipShop/actions/runs/41328337308) | Synthetic subsets VERIFIED; controlled Redis 10s pause + API crash/restart passed | Redis full loss/failover/HA, TLS/ACL, backups and queue retry idempotency OPEN |
| S06 | Client-local JWT logout + private cache isolation | `native-medusa/__tests__/auth-token-storage.test.ts`, other native cache tests, `verify-native.yml` | VERIFIED (Jest), PARTIAL system | Keystore/Keychain + emulator/device, revocation |
| S07 | Live synthetic Medusa payment mismatch HTTP 409 | `medusa-backend-smoke.yml` F07f injection; [CI 40178570633](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178570633) | VERIFIED (opt-in CI only) | default production guard policy and PSP |
| S08 | F07g real Medusa guest/customer HTTP review and atomic accept, plus one per-cart PostgreSQL claim across distinct accepted quotes | `quote-claim-ci.ts`, `f07g-live-cart-snapshot-ci.ts`; [CI 40499708458](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40499708458) | VERIFIED disposable CI ONLY | Durable per-cart intent model, real Medusa stock/order/payment lock and PSP exactly-once business effects, CSRF/full pricing/UI |
| S09 | Production Android signed build, secure token at rest, certificate policy | Android `build.gradle`, manifest and token storage inspected | FAILED (debug release signing), PARTIAL/UNKNOWN elsewhere | signed release on isolated device + MASVS |
| S10 | Dependency security and provenance | Existing `native-dependency-audit.yml` is **report-only**, frozen installs and SHA-pinned actions in tested workflows | PARTIAL | risk-tuned blocking advisories, SBOM, verified CodeQL |
| S11 | High-confidence credential markers in tracked plaintext | `scripts/security/guard.py --scan`, 5 unittest cases, [run 40181786360](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40181786360): 601 files, no matches | VERIFIED (narrow PR guard only) | Add historical/entropy/host secret scanning and workflow privilege/security scanning; never treat as complete secret audit |
| S12 | Live production domain/TLS/CSRF/rate limit/observability | No live environment evidence | UNKNOWN | independent staging/production validation |
| S13 | Real PSP charge/refund/webhook exactly-once and reconciliation | [CI 42529315731](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42529315731): Medusa Payment Module `pp_system_default` synthetic capture/refund + independent PostgreSQL | PARTIAL Stage 11G mock same-key replay; **FAILED Stage 11I** direct module over-refund persisted; **FAILED Stage 11J** validated workflow persisted +1 ALL after full refund (zero-decimal epsilon=1); +2 ALL rejected and valid partial/full persisted ([CI 42534844309](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42534844309)); Admin/PSP unverified | PSP sandbox: external provider ID/ledger, signed webhook replay and 3DS, ambiguous timeout after external success, crash during PSP call, durable keys, merchant currency/stock reconciliation UNKNOWN/BLOCKED |
| S14 | Privacy retention/media upload/backup/restore | No live infra evidence | UNKNOWN | tenant-aware operator runbooks and drill |

## Incremental test selection

- **Docs/copy/theme:** S11 baseline + changed-doc review; no Medusa migrations or Android emulator unless security claims/code changed.
- **Frontend/native logic:** S11 + `verify-native`, affected Jest, cache and auth negative tests; mobile network/storage controls if relevant.
- **Server/API/auth/DB/Redis/checkout:** S11 + relevant Medusa A/B isolation, payment/guest/session paths and synthetic negative/positive tests. Any payment amount or tenancy change expands S02–S08.
- **Dependencies/build/CI:** S11 + lockfile audit/SAST and supply-chain review, signed Android release check for distribution-related changes.
- **Release/prod:** ALL applicable gates in [SECURITY_RELEASE_GATES](SECURITY_RELEASE_GATES.md), real HTTPS/device/PSP/restore rehearsal and independent review.

No tests may be marked GREEN by skipping, suppressing or weakening security assertions. An intentionally red historical diagnostic is retained as evidence of the rejected architecture.
