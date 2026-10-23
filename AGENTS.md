# Working on ShqipShop — repository instructions

## Autorizim dhe implementim P0 — 2026-10-23 (CI NË PRITJE)

Përdoruesi autorizoi shprehimisht: «po te autorizoj, vazhdo permirsimin sipas planit», në përgjigje të kërkesës për testet cookie/session, mutation authorization dhe maskimin e sekreteve CI. **Leja e kësaj faze** përfshin scripts/workflows të këtij increment-i në `feat/merchant-auth-boundary-ci`, testim sintetik dhe dokumentacion; **pa merge/deploy/main/pagesa reale**. Ky autorizim plotëson kufirin e mëparshëm docs-only, nuk e zgjeron te faza të tjera.

**Implementuar, jo ende provuar në Medusa runtime:** helper HTTP/assertions fail-closed + 3 teste Node; cookie/session customer/admin A/B, role separation, tampering dhe logout/replay; mutations customer/order/inventory me snapshot para/pas për të dy tenant-et; DELETE vetëm në customer fixture të dedikuar; maskim i sekreteve të gjeneruara në backend smoke. Workflow dy-Medusa tani aktivizohet edhe për ndryshime script-esh në PR dhe ekzekuton testet e helper-it. JWT pas logout raportohet veçmas dhe nuk quhet i revokuar.

**Lokalisht:** Node 24.19.0, `node --test medusa-backend-poc/scripts/boundary-http.test.mjs` **3/3 PASS**, syntax checks PASS; `compileall` PASS; pytest **10 PASS, 1 warning** nga Starlette/AnyIO deprecated alias. Medusa session/mutation proof **PENDING**, duhet lexuar CI në HEAD të ri përpara pretendimit të suksesit. G3 mbetet IN_PROGRESS.

**Next:** verifiko CI real; diagnostiko dështime pa hequr checks, pastaj ruaj SHA/run dhe rezultatin e konfirmuar. Plani i detajuar mbetet MASTER_HANDOFF §10. Kufijtë: browser HTTPS/CSRF/domain cookie scope, JWT revocation, RBAC i kufizuar mes adminëve, Redis/jobs/media/backup/production ende të paprovuara.

## Mandatory continuity — current checkpoint (2026-10-23, authorized)

**First, discover the correct branch — not main.** The authoritative documentation is at:
- Repository: https://github.com/titanfit102-bit/ShqipShop
- **Authorized continuity branch:** feat/merchant-auth-boundary-ci
- **Fast checkpoint:** https://github.com/titanfit102-bit/ShqipShop/blob/feat/merchant-auth-boundary-ci/docs/CURRENT_STATE.md
- **Complete consolidated handoff:** https://github.com/titanfit102-bit/ShqipShop/blob/feat/merchant-auth-boundary-ci/docs/MASTER_HANDOFF.md (v22)
- PR #12: https://github.com/titanfit102-bit/ShqipShop/pull/12 (Draft, depends on PR #11); as of checkpoint, code SHA 3eab3c3, 3/3 CI checks GREEN. Reverify SHA and latest Actions before assuming that remains true.

**Required recovery order:** CURRENT_STATE → MASTER_HANDOFF → AGENTS → PROJECT_HISTORY/ROADMAP → ADRs → actual source, open PR dependency graph, branch HEAD and CI job logs. This root AGENTS.md also lives on the development branch rather than main. Historical priority/status paragraphs further down are snapshots; the CURRENT_STATE/latest verified tests override stale statuses.

**Authorized documentation writes:** The user gave continuing permission to update only docs/CURRENT_STATE.md, docs/MASTER_HANDOFF.md, AGENTS.md, docs/PROJECT_HISTORY.md and docs/ROADMAP.md **on branch feat/merchant-auth-boundary-ci**, after meaningful verified changes. On each checkpoint, preserve code SHA versus documentation HEAD and test evidence; if a check is pending/failed record it honestly. Do not overwrite historical ADRs. After writes, verify GitHub refs, content and diff. No permission under this continuity protocol for code changes, other branches, merge, deploy, live payments, production data or secrets.

**When development moves to a new branch:** do NOT assume the docs move. Continue maintaining the authorized continuity branch, recording the other PR/branch SHA and tests there. A dedicated documentation branch/PR or docs-only migration to main requires distinct authorization. If this branch is inaccessible, find PR #12/its last known commit and report the blocker rather than writing somewhere else. GitHub docs do not auto-update when ChatGPT is closed. Do not claim background work.

**Finish each work report with:** done; pending; exact next step; handoff status (updated/unchanged/save failed).


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

## Passed Android UI checkout and observed display defect

Android CI [run 39934984130](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130) PASSED UI checkout + PostgreSQL order. Evidence artifact [12493738613](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130/artifacts/12493738613) was manually inspected: checkout synthetic Medusa Shorts S/AL address/manual payment total 1510 ALL. **Known UI defect:** order detail subtotal 1510 ALL though product 1500 and shipping 10; `order.subtotal` field is wrong for item subtotal. Order detail also hardcodes English Standard Shipping and truncated navigation title. Fix in a follow-up PR; do not claim visual correctness. No real EUR payment or tenant isolation.

## Order receipt accuracy gate (PR #8, 2026-10-23)

Screenshot artifact [12493738613](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130/artifacts/12493738613) exposed UI bug: subtotal incorrectly 1510 ALL though item 1500, shipping 10 and payable 1510. PR #8 changes receipt to Medusa item_subtotal/fallback line subtotal, dynamic shipping name and ShopPrice on total; fixes truncated navbar title. Native Jest/TypeScript/lint [run 39937851854](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39937851854) PASSED. **A new real Android screenshot of the fix has NOT passed**, so don't claim visually verified until it does. Keep main unmodified; no real dual-currency payment or multi-tenant isolation.

## Verified separate-Medusa two-merchant baseline, NOT full tenant isolation

[CI run 39947677104](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39947677104) passed isolated Postgres DB roles A/B, real Medusa order A, separate Medusa B on port 9001 (SEQUENTIAL process); A key on B HTTP 400, A order on B HTTP 404, B catalog own key 200. Contrast [red diagnostic run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016): shared Medusa sales channels exposed synthetic order A via key B HTTP 200. ADR-006 recommends independent backends/databases for first pilots. **Admin/user auth, storage, Redis/workers, production deployment and parallel service isolation NOT proved; G3 remains incomplete.** Keep main unchanged, PRs Draft.

## Verified corrected Android receipt (2026-10-23)

[CI run 39946022933](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933) SUCCESS. Actual Android UI aligned label/value rows: product subtotal 1,500 ALL, shipping 10 ALL, total 1,510 ALL, grey synthetic EUR 15.10. Postgres order assertion passed. [Real screenshot artifact 12499331067](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933/artifacts/12499331067) was manually reviewed. **Remaining UI flaw:** 'Detajet e porosisë' title appears far too small after using adjustsFontSizeToFit; do not call typography production grade. No real FX/settlement or tenant-wide security yet.
