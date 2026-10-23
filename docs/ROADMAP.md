# ShqipShop — ROADMAP me prova për çdo fazë

## F07c follow-up — controlled Redis outage and locking (2026-10-23)

**CI-VERIFIED at code SHA [0b058e8c](https://github.com/titanfit102-bit/ShqipShop/commit/0b058e8c63a5bf6621cb0cbab5f814f0368dd215), 6/6 PR workflows SUCCESS and 2/2 push workflows SUCCESS:** [F07c PR](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030658466), [F07c push](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030654260). F07c server/worker and retry regression preserved; new synthetic Redis AOF queue persists through deliberate container stop/start and is consumed after restart, and Medusa Redis lock contention serializes two independent processes. This is a test milestone, not infrastructure certification; documentation commit CI must be rechecked.

**STILL OPEN:** abrupt Redis kill/power loss/replica failover, restore to replacement persistent volume, worker killed inside handler, exactly-once/idempotent business mutations, locking lease expiration under actual crash, load/multiple consumers; Redis caching cross-process provider (`@medusajs/caching-redis`, lockfile), TLS/ACL/backup/HA/monitoring, automatic production Redis fail-closed, production security and mobile QA. F07 PARTIAL, G3/G5 not release-ready; no main/merge/deploy. Next separately authorized F07d caching integration and regression CI.


## F07c verified increment — Redis dedicated worker (2026-10-23)

**DONE as CI-scoped proof:** `WORKER_MODE=server|worker|shared` Medusa config; synthetic-only event with separate HTTP server and Medusa worker; controlled failure recovered by event retry; worker process stop/restart and new process delivery. [Verified code 02fa531d](https://github.com/titanfit102-bit/ShqipShop/commit/02fa531de23e03c2aad36d0cd053c4a9dfbb74e2), **6/6 PR Actions SUCCESS**, F07c [40027474910](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027474910) and [push 40027467532](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027467532). Tests use CI-only synthetic payloads and disposable services. Docs commit requires CI recheck.

**OPEN (F07c-outage):** Redis restart/failover and persistence with queued-job replay; work interrupted mid-handler, duplicate/idempotence controls and locking contention. **OPEN (F07d):** caching Redis provider installation/lockfile, cache isolation and invalidation proofs. **OPEN production gates:** automatic fail-closed deployment policy; TLS/ACL, backup/restore, HA, worker metrics; user/device flows. Do not promote F07/G3/G5 to complete. Maintain PR #12 Draft, no merge or deploy.


## F07b — session sharing cross-process (CI VERIFIED; 2026-10-23)

- **Code [5cf17af](https://github.com/titanfit102-bit/ShqipShop/commit/5cf17af77d807ce57a7054358d447704ec12a307) + [parallel session handoff 40021889093](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021889093) SUCCESS**: sesionet customer/admin nga A:9000 pranohen në A:9002 pa JWT, cookie B refuzohet. Redis event keyspaces A/B provohen, 5/5 distinct CI workflows green në code SHA.
- **F07 mbetet PARTIAL**: sesione cross-process dhe event activity u provuan; mbeten Redis restart/failover, server-vs-worker queues/retry, locking under contention, caching-redis provider/lockfile, Redis auth/TLS/ACL/backup, prod HA, fizik/browser HTTPS. Mos deklaro F07 closed, G3/G5 production.
- **Next:** test restart+worker processing në izolim sintetik dhe planifiko caching provider me lockfile; kërko scope të ri për kodin e mëtejshëm. PR #12 Draft, handoff në `feat/merchant-auth-boundary-ci` vetëm.


## F07 — real Medusa Redis modules (PARTIAL, 2026-10-23)

- **Implemented in [ad7a86dc](https://github.com/titanfit102-bit/ShqipShop/commit/ad7a86dc82778fe1658c51152210298a03ece6be):** Medusa `projectConfig.redisUrl` for sessions and explicit Redis event-bus, workflow-engine and locking provider registrations. `SHQIPSHOP_REQUIRE_REDIS=true` in parallel CI rejects absent Redis URL. Two physically separate Redis services A/B.
- **Evidence 5/5 CI GREEN at code SHA:** [A/B Redis runtime 40021073660](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073660), [two DB 40021073589](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073589), [Medusa 40021073486](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073486), [native 40021073350](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073350), [pilot 40021073534](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073534). Markers prove Medusa events in Redis on both merchants: each 2 event and 4 workflow-named keys; log shows provider connections. **This is not a mere Redis PING.**
- **F07 still OPEN/PARTIAL:** session restart persistence, worker/server separation and queue retry, contended locking, Redis caching module provider installation/pnpm frozen lock consistency, real Redis outage/recovery, backups/HA/ACL/TLS and operational tests. No proof of all these from connection logs or event keys alone.
- **Next** (separate code scope): test session cookie across restart and worker activity; then add `@medusajs/caching-redis` provider with lockfile updated and CI proof. Do not mark G3/G5 production ready. F09 PWA/Medusa single commerce truth still OPEN. Docs checkpoint in `feat/merchant-auth-boundary-ci` only; PR #12 Draft, no merge/deploy/main.


## RegionProvider recovery checkpoint — 2026-10-23

- **Implemented native, code [77de0869](https://github.com/titanfit102-bit/ShqipShop/commit/77de0869a4f072eeb3dcbd047c21dd5a0f525909):** saved `region_id` valid reuse, expired 404/410 fallback after successful list, offline/401/5xx preserve; epoch ignores outdated responses; serial AsyncStorage writes for rapid B→C selection; Home and RegionSelect error/retry states.
- **Evidence:** [native 40014816829](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40014816829) SUCCESS (15/15 suites, 71/71 Jest, TypeScript/lint) on f4a43d6; final code [native 40015015192](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40015015192) initially pending, [pilot 40015015190](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40015015190) success. Recheck the latest SHA and CI.
- **Open:** real mobile E2E and l10n, React CartProvider rapid region update race **in the server**, checkout idempotency, F07 Redis jobs, F09 PWA/Medusa unified backend, production controls. This native increment does not close G3/G5.
- **Next (proposal):** read-only inspection of Redis runtime configuration and CartProvider server-side region race. Changes to other code require scope-specific authorization. Docs checkpoint on `feat/merchant-auth-boundary-ci`, not main.


## F03–F05 — native cart/checkout resilience (2026-10-23)

- **Implementuar (CI-verified në code SHA [7ea5153](https://github.com/titanfit102-bit/ShqipShop/commit/7ea515388d70ce45517ed667ab0275ff86cc9040)):** F03 cart 404/410 recreate; offline/401/5xx preserve + UI retry. F04 add/update mutation error propagation, alerts dhe finally/loading. F05 payment status pending/authorized para review/complete, pas GET Store cart. Testet [native 40012363697](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363697) 56/56 PASS, [Medusa HTTP 40012363691](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363691) marker `SHQIPSHOP_F05_CART_PAYMENT_SESSION_VERIFIED` PASS, pilot dhe parallel CI GREEN; two isolated run [40012363718](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363718) **SUCCESS**, pra **5/5 GREEN** në code SHA.
- **OPEN për release:** region-context async restore pa catch, rapid region switching, cart items të fshirë server-side, device E2E, checkout idempotency, Stripe/real payments, guest receipt restart dhe F07 Redis. G3/G5 nuk janë closed. 
- **Next:** verifikimi i CI te HEAD dokumentacionit; më pas read-only audit RegionProvider dhe planifikimi F07 (Redis) / F09 (commerce source of truth), sipas prioritetit. Pa leje të re kodi për këto faza. PR #12 Draft, degë e dokumentacionit `feat/merchant-auth-boundary-ci`, jo main.


## F06 — guest and registered order privacy (CI verified, 2026-10-23)

- **Implementuar në code SHA [9a6a4e1](https://github.com/titanfit102-bit/ShqipShop/commit/9a6a4e199fa4b72935fa44b356776bd9843bb408):** 5/5 workflow-t kryesore PASS, përfshirë customer-owner order retrieval/foreign registered account denial në A/B, guest receipt 200 vetëm me cart proof, order-ID-only denial, existing Medusa smoke/native/pilot. [Parallel test 40009599479](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599479).
- **F06 ka kaluar gate-in HTTP/CI të synuar**, por jo release/security production. Mbeten: restaurimi i receipt guest pas restart-it, endpoint-e të tjera me ID-as-capability (returns), abuse/rate limiting, mobile device end-to-end, TLS/secure storage. **G3 = IN PROGRESS.**
- **Next recommended:** F03 rikuperimi i shportës kur ID vjetrohet, F04 error propagation i mutacioneve, F05 resume/payment-session check, me regresione të automatizuara. Autorizim i ri i veçantë për kodin e ardhshëm. Dokumentacioni CURRENT_STATE dhe MASTER_HANDOFF §15 është në degën `feat/merchant-auth-boundary-ci`, **jo në main**.


## F02 native JWT logout — verified checkpoint 2026-10-23

- **F02 local signout race:** implementuar në degën `feat/merchant-auth-boundary-ci`, code SHA [b3097a3](https://github.com/titanfit102-bit/ShqipShop/commit/b3097a3d9f8b78a7d60a5418ca565e82b66a1905), [native 40005009842](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009842) **PASS** (10/10 suites, 36/36 tests, ESLint, TypeScript). Pilot, Medusa smoke dhe parallel A/B **PASS** në të njëjtin SHA ([40005009867](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009867), [40005009885](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009885), [40005009829](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009829)).
- **F02 mbyllet vetëm si local app CI gate**, jo JWT server-side revocation/expiry, iOS/Android device test ose certifikim prod. F01 native cache CI PASS; F06 guest/account receipt access dhe F03–F05 commerce correctness janë OPEN. G3 ende IN_PROGRESS.
- **Next read-only:** analiza e kontratës F06 same-merchant order retrieval me account+guest, pastaj autorizim i posaçëm për implementim. PR #12 Draft, asnjë merge në main/Production.


## F01 implementation checkpoint — 2026-10-23

- **F01 private cache native:** Implementuar në `feat/merchant-auth-boundary-ci`, code SHA [2219e65](https://github.com/titanfit102-bit/ShqipShop/commit/2219e65e5dff987ad5046bcf34f03fc253d9e714), [native CI 40001961028](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40001961028) **PASS**, ESLint/TS + 32/32 Jest. Address/order/order-detail query keys të izoluara, pastrim gjatë logout/login, in-flight stale guard, reset navigation dhe tests A→B/offline.
- **Kufizim:** pa Android device/emulator E2E të ri ose validim të Medusa same-merchant receipt privacy. F01 është verified për regression suite, jo release approved. F02 logout JWT dhe F06 order capability mbeten P1 (native/pilot), G3 në progres.
- **Veprimi i ardhshëm:** F02 token cleanup race ose F06 receipt ownership sipas target-it. Kërko scope të ri për kodin; pa merge/deploy/main. Dokumentet CURRENT_STATE/MASTER_HANDOFF §13 japin gjendjen e plotë dhe referencat.


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

**Next:** implementim i propozuar **P1a — Redis provider wiring dhe provat reale cache/event/workflow/session-restart/locking**, i përshkruar te [MASTER_HANDOFF §11](MASTER_HANDOFF.md). Kërkon autorizim kodi për këtë scope të ri; deri tani u ndryshua vetëm dokumentacioni. JWT TTL/revocation mbetet fazë e ndarë P1b; G3 ende IN_PROGRESS.

## Checkpoint aktiv P0 — 2026-10-23

- Kodi i verifikuar: `06ea54a5f252ae367e3281c470cdc139729459bc`, PR #12 OPEN Draft, dega `feat/merchant-auth-boundary-ci`; main i pandryshuar.
- [Session/mutation CI 39989746378](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39989746378), push-run 39989739659, backend smoke 39989746313 dhe pilot 39989746410: **4/4 SUCCESS**. Cookie real customer/admin A/B, foreign/tampered/role denial, logout-cookie replay, negative POST/DELETE dhe snapshots e kufizuara kaluan. Scope dhe evidenca e plotë te CURRENT_STATE dhe MASTER_HANDOFF.
- **Kufizim i konfirmuar:** cookie logout nuk revokon JWT-të; 4/4 bearer replay dhanë HTTP 200. G3 mbetet IN_PROGRESS për browser HTTPS/CSRF/domain scope, JWT revocation, admin RBAC, Redis/jobs, media/backup dhe endpoints e mbetura.
- Përdoruesi autorizoi veçmas scripts/workflows të planit §10 dhe maskimin e sekreteve CI në këtë degë («po te autorizoj, vazhdo permirsimin sipas planit»). Ky increment është i verifikuar; nuk autorizon ndryshime të fazave/degëve të tjera, main, merge/deploy ose pagesa reale. Mirëmbajtja e pesë dokumenteve të vazhdimësisë vazhdon.
- **Next:** analizë read-only e Redis provider wiring dhe JWT TTL/revocation; implementimet e reja kërkojnë scope të autorizuar. Mos përsërit testet e kaluara si punë e re.


> **Statusi autoritativ i tanishëm:** [CURRENT_STATE.md](CURRENT_STATE.md) dhe [MASTER_HANDOFF.md](MASTER_HANDOFF.md) v22, në degën **feat/merchant-auth-boundary-ci** (jo main). Tabela historike më poshtë duhet lexuar së bashku me checkpoint-in e verifikuar. G3 është NË PROGRES, jo GREEN për sigurinë e plotë.


**Vendim i konfirmuar, 22 tetor 2026:** ShqipShop mbetet white-label commerce SaaS (dyqan dhe app i personalizuar për çdo biznes); ideja e ShqipShop si APK marketplace është **refuzuar dhe jashtë scope-it**. Shih [ADR-004](ADR-004_APK_CATALOG_IDEA.md). Kodi Medusa Mobile është importuar në PR #2, me `sq-AL` dhe 17 teste Jest; hapi i radhës është Android debug build, pastaj Medusa v2 backend + porosi test end-to-end. Nuk ndërtohet APK store.


**Përditësim 22 tetor 2026:** Store API HTTP cart→manual payment→order dhe verifikim i porosisë në PostgreSQL KALUAN në run [39839755263](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39839755263). Nuk ka ende test të aplikacionit Android, inventarit real pas porosisë apo izolim dy biznesesh.

**Test integrimi Android → backend në zhvillim:** [workflow Android + Medusa](https://github.com/titanfit102-bit/ShqipShop/actions/workflows/android-medusa-catalog.yml), run 39845817408. Puna e fundit ishte kompilimi i APK-së; statusi duhet lexuar live. Nuk numërohet si provë derisa produktet të shfaqen realisht në emulator.

**Prova e parë e katalogut native e kaluar:** [Android emulator + backend Medusa live run 39845817408](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408) — screenshot i verifikuar vizualisht me produkte demo dhe çmime ALL. Porosi UI Android NUK është provuar.

**PR #5 i aktivizuar:** Test real UI Android → Medusa cart dhe kontrolli i shportës në PostgreSQL; [run 39867727695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695) duhet verifikuar live para se të shënohet sukses. Checkout Android mbetet i paprovuar.

**Prova shporta Android → Medusa → PostgreSQL PASSED:** [run 39867727695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695). 1 Medusa Shorts variant S, monedha ALL, screenshot real. Checkout nga Android ende mungon.

**Shfaqja dymonedhëshe ALL/EUR në PR #6:** Implementim për çmim kryesor në monedhën reale dhe ekuivalent orientues në tekst të vogël gri, vetëm me kurs backend të validuar. Testet JS dhe Medusa kaluan në runs 39931374229 dhe 39931072361. Pagesa reale në dy monedha është fazë më vete; emulimi vizual është ende për t'u konfirmuar.

**Progres 23 tetor:** Dual-currency Android UI PASSED (run 39931562458; kurs vetëm sintetik). Checkout Android PR #7 me adresë/transport/pagesë manuale dhe order PostgreSQL është në testim (run 39934984130), **jo i konfirmuar** deri te marker-at e UI dhe DB.

**Checkout Android UI → PostgreSQL PASSED** [run 39934984130](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130), 1510 ALL, pagesë manuale sintetike. **PR #8** korrigjon nëntotalin e receipt (1500 + 10 = 1510) dhe emërtimin e transportit; Jest/TS green [run 39937851854](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39937851854), recheck i screenshot-it Android pending. Nuk ka pagesë reale EUR/ALL dhe multi-tenant isolation.

**Datë bazë:** 2026-10-22. **Kjo është një strategji zhvillimi**, jo pretendim që të gjitha fazat janë realizuar. Në çdo përditësim mbaj metrikat: koduar / testuar / deploy-uar / përdorur nga klientë realë.

## Përkufizimi i produktit që duhet të kemi në fund

Një operator ShqipShop mund të krijojë e të menaxhojë shumë biznese shqiptare; çdo biznes zotëron identitetin dhe të dhënat e vet, panel për produktet/inventarin/porositë, një faqe/dyqan PWA të instaluar në telefon dhe (opsional Premium) app Android/iOS që punon me **të njëjtin burim të të dhënave**. Biznesi paguan vetëm në bazë të një plani/fature transparente. Klienti final blen në shqip, në ALL, merr konfirmim dhe ndjek porosinë. Operatorët kanë logje, billing, backups, support dhe përgjegjësi privatësie të përcaktuara.

## Plan i varur nga evidenca

| Gate | Çfarë duhet | Vërtetohet me | Gjendja në snapshot |
|---|---|---|---|
| G0 · GitHub baseline | Kod, varësi, CI, dokumentacion, PR | `compileall`, `pytest`, CI i gjelbër | Po për pilot; 10/10 testet në run 39822589301 |
| G1 · Pilot UX/Security | 3 demo shop flows + admin + izolim, përmasa mobile | Browser E2E, auth/CSRF/XSS, review manual | Jo i përfunduar |
| G2 · Native feasibility | Upstream RN + locale sq-AL + Medusa dev server | `npm ci`, lint/TS/Jest, Android build, mobile checkout | Pjesërisht: RN dhe sq-AL, 17/17 testet, ARM64 APK build PASS, Android API35 x86_64 emulator install/start PASS (run 39842340691); Android↔Medusa UI katalogu PASS (39845817408); **Android checkout në emulator dhe receipt + PostgreSQL PASS** (39934984130, 39946022933); telefoni fizik dhe prod signing mungojnë |
| G3 · Unified commerce backend | Një sistem inventory/order, multi-tenant i sigurt | Për 2 merchants teste pozitive/negative, migrations | Medusa/PostgreSQL dy backend-e aktive njëkohësisht, 2 porosi 1510 ALL, order-ID cross-tenant 404, admin/customer JWT cross-tenant negative PASS në [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12), [run 39981336521](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336521); cookie/session dhe mutation auth të kufizuara PASS në run 39989746378 / code 06ea54a; JWT revocation, browser cookie scope/CSRF, admin RBAC, Redis provider, media/backup dhe production izolimi MUNGOJNË |
| G4 · Managed merchants | Signup/verifikim, branding, domain, panel, plan | Krijimi i 3 tenanteve pa komandë manuale | Jo |
| G5 · Payments, delivery, privacy | COD operativ; provë PSP sandbox; logjistika dhe GDPR | Test porosi-refund-webhook, privacy/legal review | Jo |
| G6 · Production QA | DB backup/restore, incident handling, metrics, load/security, HTTPS | Auditor + E2E + DR restore + staged rollout | Jo |
| G7 · Business validation | 3–5 pilotë; përdorim real dhe willingness-to-pay | Kontratë/depozitë ose pagesa + përdorim i matur | Jo |
| G8 · Native rollout | Publikim per merchant vetëm ku vlen | App store review, account, signing, E2E në devices | Jo |

## Udhëzime të projektimit

- Favorizo **proof të udhëtimit të blerësit** (produkti → shporta → porosia) mbi shtimin e veçorive dekorative.
- Bëj fillimisht intervista dhe oferta prove për segmente me katalog të ripërsëritur (butikë, parfumeri, aksesorë). Shmang restorantet/rezervimet në versionin e parë sepse kërkojnë domain tjetër logjik.
- Çmimet 29€/79€ ishin hipoteza demonstrimi; nuk ka billing real dhe nuk ka verifikim të willingness-to-pay.
- Klienti final mund të instalojë PWA, por 'app nga App Store' nuk i premtohet çdo biznesi pa aprovimet përkatëse.
- Nuk prodhohen kartë-krediti/test pagesash me para reale pa sekretet e ofruesit dhe autorizim të shprehur.
- CDO gate duhet të ketë evidencë reale: commit SHA, run logs, screenshot/video device ose rezultate testesh. Pa prova, statusi mbetet 'not verified'.

## Next 3 të ekzekutueshme (HISTORIK / SUPERSEDED NGA AUDITI F01–F16)

1. Audit i PR #1 për dobësitë e backend-it pilot; screenshot/device test; README dhe handoff up-to-date.
2. POC i veçantë për Medusa Mobile origjinal, me licencë MIT dhe konfigurim shqip; verifiko build/test/checkout.
3. Përzgjedhja e commerce source-of-truth dhe strategjisë tenant-isolation; dokumento ADR dhe fillo migrim të sigurt vetëm pas provës.

## Si matet progresi

Nuk ka përqindje 'totale' të besueshme deri sa të jenë vlerësuar gate-t dhe peshat e tyre. Prototipi i tanishëm përmbush pjesërisht G0; pas çdo ndryshimi kontrollo `main`, branch, PR, CI dhe testet përpara se t'i shënosh të përfunduara. G8 native nuk është e detyrueshme për të lançuar paketën PWA, por është domosdoshmëri për premtimin 'çdo biznes app-in e vet' në atë paketë.

## 23 tetor 2026 — Izolimi ndërmjet dy Medusa backend-eve: prova e parë GREEN

- **Gjetja që e nisi këtë:** [PR #9 / run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016) FAILED AS INTENDED: në një backend të përbashkët Medusa me 2 sales channels, të dy publishable keys A/B morën **HTTP 200** ndaj `GET /store/orders/{id_A}`. Kjo vërtetoi që sales channels nuk janë kufi privatësie mes tregtarëve. PR #9 duhet të mbetet diagnostik i kuq dhe mos u fshi testimi.
- **Vendimi i pilotit [ADR-006](ADR-006_TENANT_BACKEND_ISOLATION.md):** çdo tregtar pilot ka një instancë Medusa/DB PostgreSQL/user role të izoluar, dhe control plane ShqipShop jashtë rrjedhës së klientëve/porosive. Ky është dizajn i rekomanduar, jo ende SaaS i përfunduar.
- **[PR #10](https://github.com/titanfit102-bit/ShqipShop/pull/10), [run 39947677104](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39947677104): PASSED.** CI krijoi dy database PostgreSQL të veçanta `shqipshop_ci_a`, `shqipshop_ci_b` dhe përdorues të pavarur me `REVOKE CONNECT FROM PUBLIC`. Prova negative DB A↔B kaloi: `SHQIPSHOP_TWO_DATABASE_ROLE_DENIAL_PASSED`.
- Në instancën A Medusa, u krijua porosi sintetike 1510 ALL; instanca B u ngrit **pas mbylljes së A** me të dhënat e B, port 9001, key publik të B dhe database të B. Serveri B ktheu **HTTP 200** për katalogun me B key, **HTTP 400** për A key dhe **HTTP 404** për porosinë A të kërkuar me B key. `SHQIPSHOP_SEPARATE_MEDUSA_ORDER_BOUNDARY_PASSED`.
- **Kufiri i provës:** dy instancat u testuan **sekuencialisht** (jo dy procese paralele). Kjo NUK provon admin/customer/session security, izolim të queues/Redis në të gjithë provider-at, media, webhook, refund, billing, backup ose real-world deployment. `G3 tenant isolation` mbetet **NË PROGRES, jo PASS**.
- **Android receipt visual:** [run 39946022933](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933) për 1500 ALL produkte + 10 ALL transport = 1510 ALL dhe FX hint 15.10 EUR sintetik duhet kontrolluar live përpara deklarimit vizual.
- **Next:** test dy backend-e aktive njëkohësisht me kontroll databazash/Redis dhe role admin/client për dy tregtarë, regjistro provision/deprovision + backup/restore, limite të burimeve, analizë reale kosto 5/50/500, pastaj branding i dyqanit dhe përditësimi i Android/PWA per merchant. Mos prek main/production.

## 23 tetor 2026 — PR #11/#12: provat e njëkohshme dhe JWT (përditësim G3)

**Evidenca verifikuese:**
- [PR #11](https://github.com/titanfit102-bit/ShqipShop/pull/11) / [run 39979050578](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39979050578): dy Medusa aktive *njëkohësisht*, 2 DB/role, checkout 1510 ALL në A dhe B, order A↔B nuk shihet (404), key i huaj refuzohet (400) — **GREEN**.
- [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12) / [run 39980753775](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39980753775): sekrete të veçanta JWT/cookie për secilin backend, administratorë e klientë të veçantë; JWT-të e klientëve dhe adminëve refuzohen nga serveri tjetër; aktori customer nuk pranohet në Admin API — **GREEN**.
- [Backend smoke 39980753771](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39980753771) dhe [pilot verify 39980753785](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39980753785): **GREEN**.

**G3 = NË PROGRES, JO PËRFUNDUAR.** Nuk janë verifikuar cookie/session reale të klientit/adminit, akseset e modifikimit të porosive/inventarit, RBAC, Redis/queues/workers, media, backup/restore, secret rotation, provisioning, real payment, load ose production. Dy checkout-et kryhen njëri pas tjetrit *ndërkohë që dy serverët janë aktivë*, jo stress test race-condition. Duhet test izolimi operacional (provider-et vërtet të lidhur), negative mutation auth, pastaj automatisim provisioning dhe analiza e kostos për 5/50/500 biznese.

Shënimet historike më sipër pasqyrojnë gjendjen kur u shkruan; shiko `CURRENT_STATE.md` dhe `MASTER_HANDOFF.md` v22 për checkpoint-in më të ri. Asnjë merge në `main`.


## MASTER CONTINUITY — checkpoint 2026-10-23

- **Verifikuar:** PR #12 HEAD kodi 3eab3c3, [run 39981336521](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336521), [39981336483](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336483) dhe [39981336440](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336440): **3/3 SUCCESS**. PR #11 dhe #12 janë ende Draft. Dokumentet e protokollit të vazhdimësisë në këtë degë kërkojnë kontrollin e HEAD të tyre veçmas.
- **Rruga kritike G3:** (1) autentikim real cookie/session dhe teste negative mutation authorization, RBAC; (2) konfigurimi real i Medusa Redis/queues/workers, tenant backup/restore; (3) source-of-truth Medusa dhe migrimi i pilotit PWA; (4) tenant control plane/provisioning/branding, pastaj pagesa, operacione, pilotë dhe release gates.
- **Politika:** vetëm përditësimet e dokumentacionit të vazhdimësisë janë të autorizuara në degën feat/merchant-auth-boundary-ci. Handoff-i nuk transferohet automatikisht në degë të tjera. Një degë e pavarur docs/continuity ose PR docs-only në main është **propozim** që kërkon autorizim të ri. Nuk ka merge/deploy.
