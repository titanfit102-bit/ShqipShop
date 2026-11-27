# ShqipShop — PR #11: Parallel Medusa merchant isolation proof

**Date:** 2026-10-23
**Source:** PR #10, commit `3359f0c`
**PR:** https://github.com/titanfit102-bit/ShqipShop/pull/11
**Status:** [GitHub Actions run 39979050578](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39979050578): **PASSED** (commit `dafb668`). Still **not** a production isolation certification.

## Changes

- Dedicated parallel CI workflow `.github/workflows/parallel-medusa-isolation-ci.yml`.
- Two independent PostgreSQL databases and per-database roles; cross-connect denied.
- Two concurrently alive Medusa v2 HTTP services (9000/9001), using independent database URLs and separate Redis service endpoints.
- Checkout in both tenants via `store-api-checkout.mjs` with explicitly selected local test port.
- `parallel-merchant-boundary.mjs` tests both own orders, both foreign order denials (404), wrong/missing public API keys, and direct foreign product IDs.
- Disposable Redis A/B service reachability only; **Medusa's Redis provider usage and queue isolation are not thereby proven**.

## Verified proof markers in successful workflow

`SHQIPSHOP_PARALLEL_TWO_SERVERS_READY`
`SHQIPSHOP_PARALLEL_MERCHANT_A_ORDER_BOUNDARY_PASSED`
`SHQIPSHOP_PARALLEL_MERCHANT_B_ORDER_BOUNDARY_PASSED`
`SHQIPSHOP_PARALLEL_CROSS_MERCHANT_BOUNDARY_PASSED`
`SHQIPSHOP_PARALLEL_MERCHANT_ORDER_ISOLATION_PASSED`

## Still blocked

- Customer/admin **JWT identity isolation has since passed in PR #12** (run 39980753775); actual cookie/session auth, mutations, refunds, payment-provider callbacks, event/queue integrity, image and file storage, tenant lifecycle, restore, operational security and real-device tests.
- Parallel checkout is executed while both processes are live, but the two checkout requests are **sequential**: throughput or race-condition stress tests are not proven.
- The current backend configuration does not declare a validated Medusa Redis provider; separate reachable Redis instances do not establish that Medusa uses them.
- This PR is Draft and **must not be merged** or deployed as a production merchant platform on this proof alone.
