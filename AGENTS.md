# Working on ShqipShop — repository instructions

**Final product decision (2026-10-22):** Original white-label concept only. Each merchant gets a branded ecommerce storefront and optionally its own Android/iOS app. The user explicitly rejected creating an APK app store / installer / alternative Play Store. Preserve the historical ADR-004, but do not implement it without a new explicit request. Android bundled ARM64 APK was built in GitHub Actions and Medusa 2.22.0 CI backend migrated/seeded with Albania/ALL and responded HTTP 200. Real Store API cart/shipping/manual-payment/order was verified from CI and persisted in PostgreSQL (run 39839755263). Next: Android install/launch and checkout proof; inventory reservation is now verified (+1 reserved/physical stock unchanged, run 39841615561); sales-channel publishable-key catalog scoping passed in run 39842677918. These are NOT full tenant isolation. Next: negative tests for customers/orders/auth/admin; Android emulator proof in PR #4; security advisory remediation.


## Mandatory orientation in every new session

Read these files **before editing** (they are the durable project memory):

1. [MASTER HANDOFF](docs/MASTER_HANDOFF.md) — user intent, chronological context, real status, decisions and future objective.
2. [PROJECT HISTORY](docs/PROJECT_HISTORY.md) — dated decisions and evidence log.
3. [ADR-003](docs/ADR-003_MEDUSA_NATIVE_VS_CUSTOM_PILOT.md) — why upstream Medusa Mobile + existing PWA pilot must be evaluated in parallel.
4. [ROADMAP](docs/ROADMAP.md) — exit criteria / verification gates.
5. [Architecture](docs/ARCHITECTURE.md), [MVP setup](docs/MVP_SETUP.md), [README](README.md) and the actual code/tests.

Start each resumed session by verifying GitHub branch heads, PRs, workflows, logs and changed files. Handoff is a **historical snapshot**, not a substitute for live verification.

## Core mission — never drift

Build an **Albanian white-label ecommerce platform where each merchant has its own branded storefront and potentially Android/iOS app**, with isolated catalog, orders, customers and inventory. The user brought https://github.com/bloomsynth/medusa-mobile-react-native as intended original client; the current custom FastAPI/SQLite implementation is only a **pilot**, not the final replacement for that native client. Merchant-specific apps are subject to Apple/Google review. Subscription prices in docs are illustrative, not validated.

Do not confuse ShqipShop with Illyrian, Protesto, Builder System, My-phone/Expo, or any other project. Do not mix repositories.

## Working conventions and safety

- **Never modify `main` directly**; use feature branches and draft PR, unless explicit release approval.
- Do not merge, publish to public environments, run live payments, change account billing, delete source/data, force push or use real users' personal data without explicit authorization.
- Always inspect real code/config before modifying. Do not trust stale filenames, branch SHAs, remembered decisions or scripts alone.
- Keep tenant permissions server-side; test cross-merchant access (users, products, orders, assets, settings). Reuse tests for regressions.
- Preserve existing contracts and protect credentials, MIT license notices, exact dependency pins and native platform constraints.
- Baseline CI: Python 3.13, `python -m compileall -q app mobile-medusa`, `PYTHONPATH=. python -m pytest -q`. Existing known good run **at handoff**: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39822589301 (10/10 passed). A new commit needs a new run.
- No claim of native build, Medusa integration, browser/device E2E, production security, billing or app-store acceptance unless verified separately.
- Keep progress reporting honest: implementation versus tests versus deployment versus commercial adoption. For future percentages, define weighted verifiable gates instead of inventing numbers.

## Resume workflow

1. Compare `main`, `feat/bootstrap-pwa-mvp`, and open PR(s); read current CI results.
2. Identify highest-value unresolved gate from ROADMAP and ADR-003.
3. Make the smallest coherent change in isolated branch, with targeted tests.
4. Run and inspect CI logs, not merely job status; do manual browser/device checks when UI changes.
5. Update `docs/PROJECT_HISTORY.md` and `docs/MASTER_HANDOFF.md` with date, accurate status, commit, PR, evidence and next steps.

### Immediate priority

Imported native-medusa/ now has React Native verification and a bundled Android ARM64 internal-test APK (Actions run 39830678418). Official Medusa DTC backend POC has been imported under medusa-backend-poc/ in feat/medusa-v2-backend-poc (PR #3), with PostgreSQL/Redis migration, Albania/ALL demo seed assertions and HTTP 200 (run 39834267570). **The Store API HTTP demo checkout and persisted PostgreSQL order passed in run 39839755263 (1 item, 1510 ALL), with an ephemeral publishable key. Remaining: actual Android install/launch and network-bound checkout, inventory effects, and two-merchant server-side isolation; keep all data synthetic.** The optional APK catalog is an unimplemented hypothesis (docs/ADR-004_APK_CATALOG_IDEA.md); keep it separate from core white-label SaaS. Choose the production commerce source of truth only after an actual Medusa checkout and two-merchant isolation proof.


## Current emulator workstream (PR #4)

Android x86_64 APK install/launch test is in `feat/android-emulator-smoke`, [PR #4](https://github.com/titanfit102-bit/ShqipShop/pull/4). Its workflow captures screenshot, checks process and crash logs. Earlier job 39841940988 failed before build due an abbreviated action SHA, now fixed; run 39842340691 must be verified live. An APK build is not proof of Android install. Production signing and native connected checkout remain absent. Do not confuse the PR #3 scoped catalog proof with full tenant isolation.

## Emulator proof (2026-10-22)

[Run 39842340691](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842340691) passed Android 35 x86_64 APK installation, MainActivity launch, process survival and filtered crash test; screenshot/log artifact 12454487323. Physical Android device, UI checkout and backend connectivity are NOT proven. React Native security advisories remain open. Keep main protected and use test-only data.

## Current native-to-backend integration test

The new `.github/workflows/android-medusa-catalog.yml` is in PR #4. It provisions disposable Medusa/PostgreSQL/Redis, injects a runner-only publishable store key into a test APK, patches cleartext HTTP ONLY inside CI for emulator host mapping 10.0.2.2, then checks actual product titles in Android UI. Check [run 39845817408](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408) and the marker `SHQIPSHOP_ANDROID_REAL_MEDUSA_CATALOG_PASSED` before claiming connected Android catalog. Do not conflate with HTTP test-only checkout. Never persist the disposable key or the CI-only insecure Android manifest.

## Verified native Medusa catalog (2026-10-22)

[Run 39845817408](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408) passed actual Android API35 x86_64 emulator showing live seeded Medusa products and ALL prices from disposable PostgreSQL/Redis backend. Marker `SHQIPSHOP_ANDROID_REAL_MEDUSA_CATALOG_PASSED`. [Screenshot artifact 12456126411](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408/artifacts/12456126411) visually reviewed (real product cards; upstream 'MEDUSA MOBILE' title and blank remote banner remain). Store API HTTP order passed separately; no UI cart/checkout/merchant isolation has yet been verified. CI temporary cleartext patch + public debug signing is test-only, not production.

## Current UI→cart gate (2026-10-23)

[PR #5](https://github.com/titanfit102-bit/ShqipShop/pull/5) adds native Android UIAutomation on a disposable Medusa backend, then server-side PostgreSQL cart assertion. Target: Medusa Shorts size S, Add to cart, View cart; markers `SHQIPSHOP_ANDROID_UI_CART_PASSED` and `SHQIPSHOP_ANDROID_CART_PERSISTED_IN_POSTGRES_PASSED`. Initial run [39867727695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695) was still building when documented; check conclusion and logs. Full native checkout/order has NOT yet been proved. Do not merge main.

## Verified UI cart (2026-10-23)

[Run 39867727695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695) passed Android API35 UI automation product Medusa Shorts → select size S → add one → view cart, plus Medusa PostgreSQL cart query (ALL, one item). UI screenshot artifact 12465970419 visually verified (1500 ALL pre-shipping). Next: UI-driven Android checkout with synthetic address/shipping/manual payment, server-side order proof and security checks. No checkout success claim yet.

## Multi-currency price presentation (PR #6; 2026-10-23)

User approved **display** of primary transaction price ALL or EUR and a small grey indicative reciprocal price for guidance. Only valid operator-provided dated ALL/EUR quote from Medusa `/store/shqipshop/indicative-fx` may be used. Never hardcode a market rate, never change actual cart/order totals with the indicative rate, never claim EUR payment is ready. Synthetic CI rate 100 is only an illustration. See `docs/DUAL_CURRENCY_POLICY.md`; preserve 7-day freshness guard, rate source, missing-rate fallback and full native/Jest/Medusa checks. Follow Android emulator visual result on PR #6; then resume Android UI checkout + two merchant isolation.

## Current Android checkout (PR #7, 2026-10-23)

PR #6 Android FX grey hint passed in run 39931562458 using a **synthetic only** ALL/EUR rate; don't assert actual exchange/payment availability. [PR #7](https://github.com/titanfit102-bit/ShqipShop/pull/7) tests *actual native UI* address (one-country default), delivery, system manual payment, place-order and persisted Medusa DB order via [run 39934984130](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130). TypeScript/Jest and backend smoke pass (39935031421, 39935031422), but do not claim Android checkout completion without BOTH UI and Postgres markers. Full merchant isolation, real dual-currency settlement and release-grade signing remain unimplemented. 
