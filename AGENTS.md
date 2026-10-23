# Working on ShqipShop — repository instructions

## Latest F07d checkpoint — verified 2026-10-24

[Code SHA cd300404](https://github.com/titanfit102-bit/ShqipShop/commit/cd3004040f80aabf3fa0f541e20fc55d66649323) in `feat/merchant-auth-boundary-ci` / PR #12 Draft: **7/7 PR + 3/3 push CI SUCCESS**, including [F07d PR 40032304599](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032304599) and [F07d push 40032297123](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032297123). New pinned `@medusajs/caching-redis@2.22.0` direct dep, existing transitive lock snapshot reused, frozen install GREEN. `MEDUSA_FF_CACHING=true` opt-in loads Redis provider and requires Redis; two physically separate Redis services, isolated DBs and 13 real Medusa CLI invocations proved same-merchant cache sharing/other-merchant cache denial and clear isolation. **F07 PARTIAL**: synthetic only, no full real-commerce invalidation, failover/HA/production or real devices. G3/G5 OPEN; F08/F09 remain priorities. New documentation commit requires separate CI verification. Read CURRENT_STATE and MASTER_HANDOFF first. Keep PR Draft, no merge/main/deploy; only 5 continuity docs have permanent update permission in this branch.


## Latest CI-verified F07c Redis AOF/locking checkpoint — 2026-10-23

**Verified code [0b058e8c](https://github.com/titanfit102-bit/ShqipShop/commit/0b058e8c63a5bf6621cb0cbab5f814f0368dd215)**, `feat/merchant-auth-boundary-ci` / [PR #12 Draft](https://github.com/titanfit102-bit/ShqipShop/pull/12), 6/6 PR and 2/2 push Actions SUCCESS. [F07c PR run 40030658466](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030658466), [push 40030654260](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030654260) confirm synthetic AOF Redis Docker stop/start queue recovery and two independent CLI-process Redis locking with no simultaneous critical side effects. This proves controlled restart with AOF and one-key locking under CI, **not** abrupt crash, replica failover, production persistence/HA/SSL/ACL, lock expiry, worker mid-side-effect crash or transactional exactly-once. F07=PARTIAL, G3/G5 IN_PROGRESS. Next F07d caching-redis compatible pin/lockfile + cross-process/tenant proof needs specific approval; JWT F08 and single commerce truth F09 remain open. Only maintenance of five docs continuously authorized in current branch; PR Draft, no main/merge/deploy. Verify documentation checkpoint HEAD CI separately.


## Latest F07c verified checkpoint — 2026-10-23

**Code SHA [02fa531d](https://github.com/titanfit102-bit/ShqipShop/commit/02fa531de23e03c2aad36d0cd053c4a9dfbb74e2)** on `feat/merchant-auth-boundary-ci`, [PR #12 Draft](https://github.com/titanfit102-bit/ShqipShop/pull/12). **6/6 PR workflows SUCCESS at that SHA**, including [F07c 40027474910](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027474910); [F07c push 40027467532](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027467532) SUCCESS. New CI tests a separated Medusa HTTP server vs worker, queued synthetic event, one controlled retry, terminated worker process followed by separate worker PID consuming next event. F07 still PARTIAL: no Redis daemon restart/failover, cache provider, locking contention, production infrastructure or exactly-once commerce guarantee. Latest docs commit CI must be verified on its own SHA. `main`/merge/deploy untouched. **Next:** scoped F07c-outage/locking proof and F07d Redis cache after separate code authorization; five continuity documents may be updated only on this authorized branch. Consult CURRENT_STATE and MASTER_HANDOFF for exact constraints/evidence.


## Latest recovery check — F07b docs HEAD 5/5 GREEN (2026-10-23)

PR #12 në `feat/merchant-auth-boundary-ci` mbetet Draft mbi PR #11 Draft. Code F07b `5cf17af`, dokumentacion bazë HEAD `94da03cb` me **5/5 workflow-t SUCCESS** ([pilot 40022501896](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40022501896), [native 40022501924](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40022501924), [two independent 40022501895](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40022501895), [parallel Redis/sessions 40022501996](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40022501996), [Medusa smoke 40022501911](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40022501911)). F07 është PARTIAL, sepse cross-process cookie Redis është provuar, por worker retry/Redis outage/cache provider/HA/production nuk janë provuar. `@medusajs/caching-redis` mungon në backend package, ndërsa fail-closed për Redis është me `SHQIPSHOP_REQUIRE_REDIS=true` eksplicit (CI) dhe jo automatik sipas `NODE_ENV=production`. Next PROPOSED F07c: read-only design komplet; kodi kërkon autorizim të ri. Në këtë checkpoint vetëm dokumentacion në branch; **jo main/merge/deploy/code**. Për historikun dhe next gates lexo CURRENT_STATE dhe MASTER_HANDOFF. CI e commit-it të ri dokumentar duhet verifikuar veçmas.


## F07b Redis session portability — latest verified checkpoint (2026-10-23)

**Code SHA [5cf17af](https://github.com/titanfit102-bit/ShqipShop/commit/5cf17af77d807ce57a7054358d447704ec12a307)** [parallel CI 40021889093](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021889093) SUCCESS: independent A:9002 process accepts A:9000 customer's and admin's cookie without bearer JWT, rejects B cookies/anonymous; marker `SHQIPSHOP_REDIS_SAME_MERCHANT_COOKIE_CROSS_PROCESS_PASSED`. A/B Redis events proof remains PASS. Other CI: two isolated 40021895454, Medusa 40021895280, native 40021895384, pilot 40021895506 — all SUCCESS. F07 PARTIAL because session cross-process is not Redis outage restart or worker retry; Redis Caching Module Provider not installed, no production/HTTPS/TLS/HA proof.

**Recovery instructions:** read [CURRENT_STATE](docs/CURRENT_STATE.md) then [MASTER_HANDOFF §19](docs/MASTER_HANDOFF.md) on branch `feat/merchant-auth-boundary-ci`, NOT main. Verify HEAD/Actions. Only F07-related CI code + five docs updated with authorization «vazhdo»; no main/merge/deploy. Future code outside scope requires approval.


## F07 Redis integration verified — latest technical checkpoint (2026-10-23)

**Code checkpoint [ad7a86dc](https://github.com/titanfit102-bit/ShqipShop/commit/ad7a86dc82778fe1658c51152210298a03ece6be), PR #12 Draft in `feat/merchant-auth-boundary-ci`:** Medusa sessions now receive `projectConfig.redisUrl`, and explicit Redis event/workflow/locking providers are registered when URL present. Parallel CI enforces `SHQIPSHOP_REQUIRE_REDIS=true`. **5/5 CI success**: [parallel runtime 40021073660](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073660) proves two separate Redis A/B keyspaces with events (17 total, 2 event, 4 workflow-named keys EACH), [two isolated 40021073589](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073589), [Medusa 40021073486](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073486), [native 40021073350](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073350), [pilot 40021073534](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073534).

**Do NOT overclaim:** F07 is PARTIAL; cache provider not configured, session persistence after restart and worker retries/locking contention untested, no Redis TLS/ACL/failover. Only event-bus redis keys and provider connection were proven. Local dev without Redis still allows fallback, but self-host production must require Redis. Consult [CURRENT_STATE](docs/CURRENT_STATE.md) and [MASTER_HANDOFF §18](docs/MASTER_HANDOFF.md) before resuming. Future F07 phase-two code and F09 require new scope; user authorization for this increment was to implement F07's initial Redis provider binding only, no main/merge/deploy.


## RegionProvider native recovery checkpoint — 2026-10-23

**Code [77de0869](https://github.com/titanfit102-bit/ShqipShop/commit/77de0869a4f072eeb3dcbd047c21dd5a0f525909)** on authorized branch `feat/merchant-auth-boundary-ci`, PR #12 Draft: region restore has 404/410 fallback, offline/401/5xx preserved ID, epoch-stale-response protection, sequential storage writes B→C, Home/RegionSelect error+Retry. Tests `region-recovery.test.ts`, `region-provider.test.tsx`. [Native 40014816829](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40014816829) SUCCESS: lint/typecheck, 15/15 suites, 71/71 Jest on f4a43d6. Final code SHA native [40015015192](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40015015192) pending in initial snapshot; check current GitHub CI and SHA. No merge/deploy/main.
**Remaining:** untested physical device, retry UI l10n, server-side cart-region update race after rapid changes, F07 Redis/provider/workers, F09 unified commerce truth, G3/G5 release. Do not mark those complete.
**Recovery:** [CURRENT_STATE](docs/CURRENT_STATE.md) then [MASTER_HANDOFF §17](docs/MASTER_HANDOFF.md); these live on feature branch **not main**. Only maintenance of the five known docs is continuously authorized on this branch; code changes outside region scope require approval.


## F03–F05 verified checkout reliability — current checkpoint (2026-10-23)

**Newest code checkpoint [7ea5153](https://github.com/titanfit102-bit/ShqipShop/commit/7ea515388d70ce45517ed667ab0275ff86cc9040):** authorized F03–F05 scope on `feat/merchant-auth-boundary-ci`, no main/merge/deploy. Native 13/13 Jest suites, 56/56 tests + lint/TS [40012363697](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363697) SUCCESS; Medusa HTTP real pending/authorized session probe `SHQIPSHOP_F05_CART_PAYMENT_SESSION_VERIFIED` in [40012363691](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363691) SUCCESS; pilot [40012363683](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363683) and parallel [40012363695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363695) SUCCESS; two-isolated [40012363718](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363718) **SUCCESS**; 5/5 workflow-t në code SHA GREEN.

**Changes:** F03 missing carts recreated on 404/410 only; offline/5xx preserved with retry. F04 cart mutation rejects surface in UI, no stuck loading. F05 Review requires actual pending/authorized session, not cart amount; Store cart reread after payment init. F01/F02/F06 CI proof preserved. Remaining P0/P1 gate: region restore/rapid switch, checkout idempotency, device QA, Redis F07, source-of-truth F09, real payments, production security. None are declared complete.

**Recovery:** read [CURRENT_STATE](docs/CURRENT_STATE.md), [MASTER_HANDOFF §16](docs/MASTER_HANDOFF.md), then verify HEAD/PR #12/Actions. Document maintenance permitted only on this branch; new feature code requires separate scope. No merge/deploy/main/Production.


## F06 checkout receipt privacy — latest checkpoint (2026-10-23)

**Latest verified code SHA: [9a6a4e1](https://github.com/titanfit102-bit/ShqipShop/commit/9a6a4e199fa4b72935fa44b356776bd9843bb408)**, **5/5 distinct CI workflows GREEN**: [Medusa](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599530), [Parallel merchants](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599479), [Native](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599449), [pilot](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599424), [two DBs](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599412). Customer-owned receipts require owner authentication; guest receipts require originating cart proof header, not order ID alone. Passed same-store customer-stranger denials in two merchant instances. **F06 passed scoped HTTP/CI proof, NOT production**; guest proof survives only route navigation (no post-restart guest recovery), other order-ID routes and device/infra security remain untested.

**Recovery:** FIRST read [CURRENT_STATE](docs/CURRENT_STATE.md), then [MASTER_HANDOFF v22 §15](docs/MASTER_HANDOFF.md). F01/F02 CI-verified, F03–F05/F07–F16 open, G3 in progress. Branch `feat/merchant-auth-boundary-ci`, PR #12 Draft, **not main**. User authorization was specific to F06 plus ongoing updates of these five documents on this branch; further code, branch, merge/deploy/Production requires separate authorization. Verify HEAD/Actions after documentation writes.


## F02 native JWT signout — latest verified checkpoint 2026-10-23

**Pas F01**, përdoruesi tha «vazhdo» për F02 (JWT custom storage logout race). Vetëm kodi/testet e F02 në `feat/merchant-auth-boundary-ci` u ndryshuan; nuk është leje për F06/Redis/merge/main/deploy. Code SHA [b3097a3](https://github.com/titanfit102-bit/ShqipShop/commit/b3097a3d9f8b78a7d60a5418ca565e82b66a1905): **4/4 CI GREEN**, përfshirë native lint/TS + 36/36 Jest. Custom token storage bllokon token-in e vjetër gjatë logout-it; `await client.clearToken()` dhe fshirje e verifikuar; marker lokal për rastin e gabimit në deletion, login i ri i verifikuar. Nuk është revokim JWT në server. F06 ownership dhe F03–F16 OPEN.

**Rikupero**: [CURRENT_STATE](docs/CURRENT_STATE.md), [MASTER_HANDOFF §14](docs/MASTER_HANDOFF.md), PR #12 Draft; verifiko live HEAD/CI para punës. Kontrollet e dokumentacionit pas këtij SHA mund të kenë runs të tjera; mos i quaj GREEN nëse janë pending. Autorizimi përditësues i këtyre pesë dokumenteve mbetet vetëm në këtë degë. Nuk u prek main/production.


## Authorized F01 native increment — checkpoint 2026-10-23

**Kontekst më i ri se auditimi i mëposhtëm:** përdoruesi tha «okej vazhdo» pas kërkesës specifike për korrigjimin F01. U autorizua dhe u implementua vetëm F01 native privacy cache në degën ekzistuese `feat/merchant-auth-boundary-ci` (PR #12 Draft), pa ndryshuar main/production. Code checkpoint [2219e65](https://github.com/titanfit102-bit/ShqipShop/commit/2219e65e5dff987ad5046bcf34f03fc253d9e714), [native test run 40001961028](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40001961028) SUCCESS (32/32 tests, lint/typecheck). Ky autorizim nuk shtrihet te F02–F16. Hapi teknik i radhës kërkon leje të re për kod.

**Rikuperimi:** shko fillimisht te [CURRENT_STATE](docs/CURRENT_STATE.md) pastaj [MASTER_HANDOFF §13](docs/MASTER_HANDOFF.md), verifiko CI/HEAD, mos përsërit F01. Kjo shënim korrigjon rreshtat historikë më poshtë që e quajnë ende F01 të paautorizuar. Mirëmbajtja automatike e pesë dokumenteve mbetet e lejuar vetëm në këtë degë.


## ShqipShop independent audit F01–F16 review — 2026-10-23

**Evidenca:** raport i pavarur për commit e22bb13 (F01–F16), rishikuar kundrejt source GitHub, upstream Medusa 2.21.2/2.22.0 dhe [CI 39991716155](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39991716155), [39991715755](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39991715755), [39991715961](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39991715961): 3/3 SUCCESS. Verifikimi i Work për komponentet native dhe numri i package advisories nuk u riprodhuan veçmas nga ky reviewer; shumica e mekanizmave defektozë u konfirmuan nga source. Detajet dhe caveats: CURRENT_STATE dhe MASTER_HANDOFF §12 në këtë branch (jo main).

**Rruga e rekomanduar, VETËM PROPOZIM, jo leje implementimi:**
- **Native me llogari reale:** F01 është P0 i privatësisë. F02 SDK logout, F03 stale cart, F04 swallowed mutation errors, F05 checkout resume dhe F13 price=0 duhet të kenë testet e tyre të regression. F12 production signing bllokon vetëm store release të native.
- **PWA-first:** F06 receipt ID-as-capability guest/account privacy contract dhe F09 një commerce source-of-truth janë prioritete pilot; F15 brand CSS/CSP vetëm nëse pilot FastAPI mbahet.
- **Operations:** F07 Redis provider/event/session/workflow wiring me prova të vërteta (jo vetëm PING); F08 JWT lifecycle dhe credential storage, F10 native CI gates, F11 dependency advisory triage/release bundle, backup/TLS/secrets/privacy; F14 UI error/accessibility sipas flow-it, F16 shënim historik/superseded.
- **Release gate:** G2 native është PARTIAL; G3 server tenant auth është PARTIAL (jo production-ready); G4–G8 varen nga target-i real; mos numëro P0 native release kundër një target-i PWA-only.
- **Autorizimi:** vetëm update docs CURRENT_STATE/MASTER_HANDOFF/PROJECT_HISTORY/ROADMAP/AGENTS në feat/merchant-auth-boundary-ci është i vazhdueshëm. Nuk është dhënë leje e re për F01–F15 kod ose për degë të tjera/main/merge/deploy.


## Përditësim analize P1 — 2026-10-23

CI i HEAD-it dokumentar `e5657c6`: [pilot 39990409987](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990409987), [parallel 39990410102](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990410102), [smoke 39990410033](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990410033): **3/3 SUCCESS**. Kodi i testuar mbetet `06ea54a`.

**Audit read-only i përfunduar:** REDIS_URL në env nuk aktivizon modulet Redis në konfigurimin aktual self-hosted; source v2.22.0 dhe log-u real konfirmojnë fallback lokal/fake redis, event bus lokal dhe locking in-memory. Cookie sessions përdorin default memory sipas loader-it/config-it; restart persistence nuk është provuar. JWT default pritet 1d nga source, ende pa matje runtime exp. TTL i shkurtër nuk është revokim pas logout-it.

**Next:** implementim i propozuar **P1a — Redis provider wiring dhe provat reale cache/event/workflow/session-restart/locking**, i përshkruar te [MASTER_HANDOFF §11](docs/MASTER_HANDOFF.md). Kërkon autorizim kodi për këtë scope të ri; deri tani u ndryshua vetëm dokumentacioni. JWT TTL/revocation mbetet fazë e ndarë P1b; G3 ende IN_PROGRESS.

## Checkpoint aktiv P0 — 2026-10-23

- Kodi i verifikuar: `06ea54a5f252ae367e3281c470cdc139729459bc`, PR #12 OPEN Draft, dega `feat/merchant-auth-boundary-ci`; main i pandryshuar.
- [Session/mutation CI 39989746378](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39989746378), push-run 39989739659, backend smoke 39989746313 dhe pilot 39989746410: **4/4 SUCCESS**. Cookie real customer/admin A/B, foreign/tampered/role denial, logout-cookie replay, negative POST/DELETE dhe snapshots e kufizuara kaluan. Scope dhe evidenca e plotë te CURRENT_STATE dhe MASTER_HANDOFF.
- **Kufizim i konfirmuar:** cookie logout nuk revokon JWT-të; 4/4 bearer replay dhanë HTTP 200. G3 mbetet IN_PROGRESS për browser HTTPS/CSRF/domain scope, JWT revocation, admin RBAC, Redis/jobs, media/backup dhe endpoints e mbetura.
- Përdoruesi autorizoi veçmas scripts/workflows të planit §10 dhe maskimin e sekreteve CI në këtë degë («po te autorizoj, vazhdo permirsimin sipas planit»). Ky increment është i verifikuar; nuk autorizon ndryshime të fazave/degëve të tjera, main, merge/deploy ose pagesa reale. Mirëmbajtja e pesë dokumenteve të vazhdimësisë vazhdon.
- **Next:** analizë read-only e Redis provider wiring dhe JWT TTL/revocation; implementimet e reja kërkojnë scope të autorizuar. Mos përsërit testet e kaluara si punë e re.

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
