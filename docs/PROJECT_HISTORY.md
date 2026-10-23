# ShqipShop — projekt / histori ndryshimesh

## 2026-10-24 — F07d Medusa Redis Caching Module

- Branch `feat/merchant-auth-boundary-ci`, PR #12 OPEN Draft. Code [cd300404](https://github.com/titanfit102-bit/ShqipShop/commit/cd3004040f80aabf3fa0f541e20fc55d66649323), **7/7 PR + 3/3 push Actions SUCCESS**, [F07d PR 40032304599](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032304599), [F07d push 40032297123](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032297123), [pilot 40032306040](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032306040), [native 40032304614](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032304614), [Medusa smoke 40032304629](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032304629), [two isolated 40032304573](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032304573), [parallel PR 40032304574](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032304574), [F07c PR 40032304788](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032304788), [parallel push 40032296950](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032296950), [F07c push 40032296958](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40032296958). Existing `@medusajs/caching-redis@2.22.0` transitive lock snapshot reused via pinned direct backend dependency and only importer change; `pnpm --frozen-lockfile` PASS. Scoped caching enabled only by `MEDUSA_FF_CACHING=true` and requires Redis URL.
- Dedicated CI proves 13 fresh Medusa CLI processes write/read/miss/clear the identical synthetic key on two physically separate Redis servers A/B, with distinct PostgreSQL DBs/roles; neither tenant sees/invalidates the other's cache. CI markers include `SHQIPSHOP_F07D_TWO_PHYSICAL_REDIS_CROSS_PROCESS_CACHE_ISOLATION_PASSED`.
- No main/merge/deploy/live payments; F07 PARTIAL, G3/G5 OPEN. Production cache invalidation, outage, TLS, metrics, real tenant onboarding and F08/F09 still missing. New documentation commit needs independent CI check.


## 2026-10-23 · F07c Redis outage/AOF & lock contention, code and CI evidence

- Branch `feat/merchant-auth-boundary-ci`, PR #12 OPEN Draft atop #11, code SHA `0b058e8c`. Added disposable Redis AOF container test (queue before actual Docker stop, start same container, queue retained and synthetic event consumed afterward), two-process Medusa Redis lock `execute()` overlap denial and sequential critical side effects; tests only. No main/merge/deploy or new dependencies.
- **CI code SHA 0b058e8c: 6/6 PR + 2/2 push SUCCESS:** [F07c PR 40030658466](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030658466), [F07c push 40030654260](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030654260), [parallel A/B PR 40030658486](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030658486), [parallel push 40030654117](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030654117), [Medusa smoke 40030658380](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030658380), [two isolated 40030658489](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030658489), [native 40030658499](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030658499), [pilot 40030658386](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40030658386). Job log markers confirm `SHQIPSHOP_F07C_REDIS_AOF_RESTART_DELIVERY_PASSED` and `SHQIPSHOP_F07C_REDIS_LOCK_CONTENTION_PASSED`, including preceding queue/port/lock checks.
- Does **NOT** certify Redis crash/HA, persistent-volume recovery on new host, lease expiry, in-flight worker failure or exactly-once business semantics. F07 PARTIAL, G3/G5 OPEN. F07d Redis caching and further production gates remain future scope. This document's own commit requires independent CI verification.


## 2026-10-23 · F07c dedicated Redis worker increment

- User continued the explicitly proposed F07c scope («vazhdojm»); modified only Medusa worker-mode config, test-only subscriber/producer, and a dedicated synthetic GitHub Actions workflow in `feat/merchant-auth-boundary-ci` / PR #12 Draft. No main/merge/deploy.
- Code commit `e0a8008`; its first new workflow [40027394332](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027394332) reported failure without jobs due runner.temp expression in job env. Follow-up `02fa531d` fixed the workflow context, preserving the actual assertions.
- **CI verified at `02fa531d`: 6/6 PR workflows SUCCESS**, [F07c PR 40027474910](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027474910) dhe [F07c push 40027467532](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027467532); other checks: [native 40027474587](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027474587), [pilot 40027474687](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027474687), [backend smoke 40027474759](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027474759), [two isolated 40027474793](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027474793), [parallel A/B 40027474601](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40027474601). F07c push run also SUCCESS. Test job markers support actual server-only queue, retry after synthetic transient failure and processing by a restarted worker with different PID. Does not prove Redis daemon recovery, Redis cache, locking contention, production TLS/HA/backup or exactly-once commerce effects.
- F07 PARTIAL, G3/G5 incomplete. Remaining scoped F07c outage/failure injection and F07d caching require specific authorization. Documentation checkpoint commit CI to be checked separately.


## 2026-10-23 · F07b GitHub HEAD verification (read-only audit + continuity update)

- Branch `feat/merchant-auth-boundary-ci`, PR #12 Draft mbi PR #11 Draft; code `5cf17af`; docs baseline `94da03cb`.
- Docs-baseline CI = 5/5 SUCCESS: [pilot 40022501896](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40022501896), [native 40022501924](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40022501924), [two independent 40022501895](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40022501895), [parallel Redis/sessions 40022501996](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40022501996), [Medusa smoke 40022501911](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40022501911). Jo rezultat i konfirmuar ende për commit-in e ri të këtij shënimi.
- Verifikuar në code/workflow: cookie share 9000→9002 me Redis, Redis A/B event keys dhe providers; mungon caching-redis; nuk ka outage/worker retry/restart/idempotency/load/production provë. `SHQIPSHOP_REQUIRE_REDIS` lidhet me flag të veçantë në CI, jo me production automatik.
- Nuk ndryshoi kodi, varësitë, workflow, main apo Production. Hapi pasues i propozuar F07c server/worker retry/failure-injection me autorizim specifik; F07 mbetet PARTIAL dhe G3/G5 OPEN.


## Checkpoint P0 i verifikuar — 2026-10-23

**Kodi:** [`06ea54a`](https://github.com/titanfit102-bit/ShqipShop/commit/06ea54a5f252ae367e3281c470cdc139729459bc). **PR #12 OPEN Draft**, mbi PR #11; main i pandryshuar `329e0381b0bc4ce39cf554a2b2888a047e1dd29e`. Nuk u bë merge/deploy ose pagesë reale.

**CI në këtë code SHA:** [session/mutation PR run 39989746378](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39989746378), [session/mutation push run 39989739659](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39989739659), [backend smoke 39989746313](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39989746313), [pilot 39989746410](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39989746410): **4/4 SUCCESS**. Job logs u lexuan për run-in session/mutation PR dhe backend smoke; statusi i push-run u kontrollua veçmas.

**E provuar me dy Medusa aktive A/B:**
- Sesione cookie reale për customer dhe admin, profile me actor ID korrekt pa bearer, role separation, cookie e manipuluar/huaj dhe cookie mungesë refuzohen; logout shkatërron sesionin dhe replay i cookie-t origjinal refuzohet. Sesioni i tenant-it tjetër mbetet funksional.
- POST /store/customers/me dhe POST Admin API për customer first_name, order metadata dhe inventory-item title: kontrolle pozitive; no-auth/customer-as-admin/foreign JWT/cookie refuzohen HTTP 401/403 me payload valid dhe ID që ekziston në target. Snapshot para/pas në të dy tenant-et ruan customer first_name/metadata, order ID/currency/total/metadata dhe inventory title/location-level stock/reservations.
- Foreign customer/order/inventory IDs në backend-in e tjetrit me admin lokal valid: GET/POST HTTP 404. DELETE provohet vetëm mbi customer fixture të dedikuar; negative 401/403 dhe objekti ende ekziston; admin i vet fshin me sukses dhe leximi më pas është 404.
- ID spoof: body dhe query refuzohen HTTP 400; headers injorohen HTTP 200 duke ruajtur actor ID të vet. Të dy tenant-et kontrollohen pas çdo probe. HTTP 400 këtu është validim input-i, **jo provë e refuzimit të autentikimit**.
- Backend smoke: porosi 1510 ALL në PostgreSQL, rezervim +1 dhe stok fizik i pandryshuar; **18 assignments të sekreteve të gjeneruara shfaqen të maskuara, 0 assignments hex të pamaskuara** në log-un e verifikuar.

**Finding i konfirmuar:** pas cookie logout, JWT origjinal i customer/admin vazhdon me HTTP 200 në **4/4 rastet** A/B. Testi e karakterizon këtë dhe nuk pretendon revokim JWT ose logout global. Revokimi/TTL/logout policy mbetet çështje përpara production.

**Kontrolle lokale:** 3/3 Node tests; syntax JS, YAML dhe bash PASS; compileall PASS; pytest 10 PASS me 1 warning Starlette/AnyIO deprecated alias. Mutation-check lokal: heqja e auth-status assertion ose side-effect assertion shkakton RED, restaurimi GREEN. Nuk u riekzekutua Android sepse ndryshimet janë vetëm scripts/workflows/dokumentacion backend.

**Rishikim i pavarur:** një P2 për mungesën e query/header spoof probes u korrigjua; header forwarding u provua RED→GREEN dhe suite 3/3. Pa blocker tjetër në increment-in e kufizuar. Run-i fillestar [39989352814](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39989352814) ishte RED nga snapshot query që mungonte currency_code në default Admin Order fields; u konfirmua në source v2.22.0 dhe u korrigjua me fields eksplicite, pa dobësuar assertion-in. Historiku i dështimit ruhet.

**G3 = IN_PROGRESS.** Prova është e kufizuar te endpoints/payloads e mësipërme, jo të gjitha mutations/refund/cancel/stock-level endpoints ose RBAC mes adminëve. Browser HTTPS/CSRF/domain cookie scope, JWT revocation, Redis provider/jobs, media, backup/restore, provisioning dhe production mbeten të hapura.

**Next i saktë:** analizë read-only e konfigurimit real Medusa Redis/cache/event-bus/workflow engine dhe kontratës JWT TTL/revocation. Implementimi i provider-ëve, ndryshimi i politikës së autentikimit apo veçori të tjera nuk janë të autorizuara automatikisht nga ky increment. Dokumentacioni vazhdon të mirëmbahet në këtë degë.

## Autorizim dhe implementim P0 — 2026-10-23 (CI NË PRITJE)

Përdoruesi autorizoi shprehimisht: «po te autorizoj, vazhdo permirsimin sipas planit», në përgjigje të kërkesës për testet cookie/session, mutation authorization dhe maskimin e sekreteve CI. **Leja e kësaj faze** përfshin scripts/workflows të këtij increment-i në `feat/merchant-auth-boundary-ci`, testim sintetik dhe dokumentacion; **pa merge/deploy/main/pagesa reale**. Ky autorizim plotëson kufirin e mëparshëm docs-only, nuk e zgjeron te faza të tjera.

**Implementuar, jo ende provuar në Medusa runtime:** helper HTTP/assertions fail-closed + 3 teste Node; cookie/session customer/admin A/B, role separation, tampering dhe logout/replay; mutations customer/order/inventory me snapshot para/pas për të dy tenant-et; DELETE vetëm në customer fixture të dedikuar; maskim i sekreteve të gjeneruara në backend smoke. Workflow dy-Medusa tani aktivizohet edhe për ndryshime script-esh në PR dhe ekzekuton testet e helper-it. JWT pas logout raportohet veçmas dhe nuk quhet i revokuar.

**Lokalisht:** Node 24.19.0, `node --test medusa-backend-poc/scripts/boundary-http.test.mjs` **3/3 PASS**, syntax checks PASS; `compileall` PASS; pytest **10 PASS, 1 warning** nga Starlette/AnyIO deprecated alias. Medusa session/mutation proof **PENDING**, duhet lexuar CI në HEAD të ri përpara pretendimit të suksesit. G3 mbetet IN_PROGRESS.

**Next:** verifiko CI real; diagnostiko dështime pa hequr checks, pastaj ruaj SHA/run dhe rezultatin e konfirmuar. Plani i detajuar mbetet MASTER_HANDOFF §10. Kufijtë: browser HTTPS/CSRF/domain cookie scope, JWT revocation, RBAC i kufizuar mes adminëve, Redis/jobs/media/backup/production ende të paprovuara.

**Qëllimi:** Ky dokument është log kronologjik. Për statusin e sotëm lexo `MASTER_HANDOFF.md`; për vendimet e arkitekturës lexo `ADR-003_MEDUSA_NATIVE_VS_CUSTOM_PILOT.md`.

## 2026-10-22 · Origjina e idesë

- Repository origjinal i identifikuar: https://github.com/bloomsynth/medusa-mobile-react-native. Është klient React Native për Medusa v2, me licencë MIT.
- Përdoruesi sqaroi se dëshiron të përdorë kodin për biznese në Shqipëri: secili biznes të ketë **aplikacionin e vet të branduar**, me produkte, klientë dhe porosi. Nuk po ndërtonim një marketplace shumëshitës të përbashkët.
- Diskutuam konceptin white-label SaaS dhe modelet PWA/Android/iOS. Tarifat dhe kostot ishin shembuj, jo kontrata apo verifikim tregu.

## 2026-10-22 · Ndërtimi i pilotit

- Në vend të importimit të plotë të React Native origjinal u zhvillua një prototip i veçantë PWA me FastAPI, SQLite, templates, CSS dhe JavaScript. Kjo ishte zgjedhje për të demonstruar menjëherë sistemin multi-merchant dhe panelin.
- Përmbajtja: dyqane per slug, theme, katalog, shportë, porosi cash-on-delivery, sesione administrimi, inventar, status porosish; 3 dyqane fikse demo.
- U krijua kit shqip `mobile-medusa/` për t'u aplikuar te React Native upstream. **Nuk u importua i gjithë upstream dhe nuk u bë build APK/IPA**.
- U krijua paketa ZIP lokale dhe një PREVIEW_OFFLINE vetëm demonstrim pamjeje.

## 2026-10-22 · GitHub dhe verifikimi

- Përdoruesi krijoi `titanfit102-bit/ShqipShop`; u hap branch `feat/bootstrap-pwa-mvp` dhe PR #1 Draft.
- Përdoruesi ngarkoi kodin me GitHub Upload. Mungonin dotfiles nga ngarkimi manual; ato u krijuan përmes GitHub connector.
- U shtuan teste izolimi të biznesit dhe keys për idempotency të porosive.
- U konfigurua GitHub Actions në `ubuntu-latest` me Python 3.13 dhe read-only permissions. U përditësuan action-et te variantet Node 24.
- Run 39822589301 për commit `2a8b1d1bd3c98a34149d4056097768003c0178cc`: **10 passed, 1 dependency deprecation warning**, logje konfirmuese. Nuk u krye deploy publik.
- `main` në kohën e kontrollit nuk kishte ndryshuar; PR mbeti Draft.

## 2026-10-22 · Pyetja strategjike dhe vendimi

- Përdoruesi pyeti nëse duhej marrë e modifikuar drejtpërdrejt vepra origjinale Medusa. Vlerësim: **po, për native ky është një drejtim më i përshtatshëm** se të rindërtojmë një aplikacion të tërë nga zero.
- Por kodi origjinal është klient, jo platformë multi-tenant SaaS dhe kërkon backend v2. Pilotin ekzistues nuk e shkatërrojmë. Eksperimentojmë në branch/dosje të veçantë dhe më pas unifikojmë burimin e të dhënave.
- Ky vendim ruhet në ADR-003, dhe gates në ROADMAP.

## Regjistri i vendimeve të hapura

| Tema | Vendimi aktual | Kriteri që e ndryshon |
|---|---|---|
| Native klienti | Medusa Mobile është **kandidat kryesor**, i pa-testuar nga ne | Build + backend + checkout E2E |
| Commerce production engine | Ende i papërcaktuar; mos e supozo FastAPI SQLite | POC Medusa tenant isolation, performance dhe kosto |
| Izolimi multi-tenant | Thelbësor në arkitekturë; pilot nuk është provë prodhimi | Integration/security tests, migration/backup |
| Branding/URL e çdo biznesi | Path per slug në pilot; domain/app real TBD | Rezultatet e 3–5 pilotëve |
| Pagesat | COD vetëm në pilot; pagesat online nuk implementohen pa provider | PSP kontratë + sandbox + siguri + legal |
| Tarifat SaaS | 29€ dhe 79€ vetëm hipoteza | Angazhimi i blerësve, marzhi dhe kostoja reale |
| Publikimi në app stores | Nuk premtohet për të gjitha bizneset | Politikat Apple/Google dhe kush e zotëron llogarinë e publikimit |

## Format për seancat e ardhshme

Pas çdo sesioni, shto në fund: `data · branch · commit SHA · PR · çfarë ndryshoi · testet (link run) · bllokimet · vendimi/next action`. Pa një run të ri mos kopjo statusin 'passed' për commit-in pasardhës.

## 2026-10-22 · Origjinali Medusa u fut realisht në ShqipShop

- Përdoruesi propozoi ShqipShop si **katalog APK Android**, ku dyqanet e bizneseve shkarkohen si aplikacione të veçanta nga ShqipShop. Koncepti u analizua; nuk është implementuar, dhe nuk zëvendëson automatikisht strategjinë PWA/native. Shih ADR-004.
- U krijua branch feat/native-medusa-poc nga feat/bootstrap-pwa-mvp, me PR #2 Draft mbi PR #1.
- U kopjua kodi MIT i upstream në native-medusa/ nga commit 4ad76d0. Importimi u bë përmes GitHub Actions me workflow të përkohshëm që hoqi vetveten pas commit-it; nuk ishte e nevojshme ngarkimi manual.
- Origjinali përmbante 170 files, 2 prej tyre JVM crash logs të injoruara nga root .gitignore; .env.template u rikthye. Kodi i përfshirë përmban React Native Android/iOS, teste, package-lock dhe LICENSE.
- U shtua sq-AL localization në React Native: katalogu, provider, settings dhe type/env config. Testet native JavaScript/TypeScript/Jest kaluan në run https://github.com/titanfit102-bit/ShqipShop/actions/runs/39826582144 (**5 suites, 17 tests**).
- **Status real:** APK nuk është ndërtuar, Medusa backend test nuk është ngritur; nuk ka gjenerator app-esh, dyqan APK, billing apo publikim. main nuk është prekur.

## 2026-10-22 · Android build në GitHub Actions

- U shtua workflow i veçantë `.github/workflows/build-android-internal.yml`, read-only permissions, immutable action SHAs, Node 24, JDK 17 dhe Android SDK/NDK, që përpiqet të prodhojë një **APK arm64 me JavaScript të përfshirë**.
- U zgjodh task Gradle `assembleRelease` vetëm për të përfshirë bundle-in JS; **mbetet me debug.keystore publik të upstream** dhe nuk është version prodhimi.
- Run i parë https://github.com/titanfit102-bit/ShqipShop/actions/runs/39830420989 dështoi në SDK Manager: mungonte `platforms;android-37`. U ndryshua `compileSdkVersion/buildToolsVersion` në **36**, `targetSdkVersion` mbeti **36**.
- Run i dytë https://github.com/titanfit102-bit/ShqipShop/actions/runs/39830678418 ka kaluar instalimin e SDK 36 dhe po ekzekuton build-in Gradle (kontrolli i fundit gjatë shkrimit); **nuk ekziston ende rezultat i verifikuar/artefakt**.
- Në `npm ci` u raportuan 64 advisory të varësive (19 moderate, 44 high, 1 critical). Ky është sinjal për auditim/upgrade të sigurt përpara prodhimit; mos supozo që të gjitha janë të shfrytëzueshme në runtime.
- Shih `docs/BUILD_ANDROID_INTERNAL.md` për konfigurimet, kufizimet, përmbajtjen e artefaktit dhe hapat e verifikimit.
- Hapi i radhës sipas rezultatit të run-it: verifiko artefaktin dhe instalimin, ose riparo rrënjën e dështimit nga log-et. Pas kësaj lidhja me Medusa v2 backend development (rajon ALL, produkt, shportë, checkout test-only).

## 2026-10-22 · APK funksionale në nivel build-i dhe prova backend Medusa

- Android CI run 39830678418 kaloi pas rregullimit të SDK 37→36; u krijua APK ARM64 33 MB me bundle JavaScript të përfshirë dhe SHA-256 të regjistruar në MASTER_HANDOFF. Nënshkrimi përdor upstream debug keystore dhe nuk është release komercial. Instalimi në pajisje nuk është konfirmuar.
- U krijua security audit workflow read-only për dependencies; run 39832976270 raportoi 1 critical, 44 high, 19 moderate (nga audit graph), dhe veçmas riskun e `shell-quote`. Remediimi nuk është kryer.
- U importua zyrtarisht DTC starter Medusa v2 në degën feat/medusa-v2-backend-poc (PR #3 Draft), commit i origjinës `204130a3`; ruhet licenca MIT, përfshin backend + storefront upstream reference.
- U shtua workflow me PostgreSQL 16 + Redis 7 dhe Medusa 2.22.0; migrimet dhe health endpoint 200 u verifikuan në Actions run 39833563861.
- Seed i backend-it u përshtat për Shqipërinë: ALL, vend al, magazinë Tiranë, transport standard/ekspres dhe 4 produkte demo; kontrolli i DB u verifikua në run https://github.com/titanfit102-bit/ShqipShop/actions/runs/39834267570 me marker `SHQIPSHOP_ALBANIA_ASSERTIONS_PASSED`.
- Nuk ka ende sistem prodhimi white-label me abonime, checkout Android↔Medusa, tenant provisioning apo server publik. Hapi pasues: Store API dhe checkout E2E me backend ephemeral, test instalimi Android, izolim i dy bizneseve.

## Prova e përfunduar: Store API → porosi → PostgreSQL (22 tetor 2026)

**Run i suksesshëm:** https://github.com/titanfit102-bit/ShqipShop/actions/runs/39839755263; commit `4ec90316abb2c211470a650599379809466b7e32`.

- U përdor serveri real Medusa v2 në GitHub Actions, PostgreSQL 16 dhe Redis 7 përkohshëm, dhe vetëm të dhëna sintetike.
- Skripti `medusa-backend-poc/scripts/store-api-checkout.mjs` testoi endpoint-et `/store` nëpërmjet HTTP: mungesa e `x-publishable-api-key` refuzohet me HTTP 400; leximi i 4 produkteve/rajonit Shqipëri/ALL, krijimi i shportës, shtimi i variantit, adresa shqiptare, transporti, payment collection + sesioni `pp_system_default`, completion → order.
- Përgjigjja e API-së konfirmoi një **order demonstrative me 1 artikull, 1 510 ALL**.
- Skripti `assert-ci-order.ts` lexoi përsëri porosinë e krijuar nga **databaza PostgreSQL** e Medusa: marker `SHQIPSHOP_ORDER_PERSISTED_IN_POSTGRES_PASSED` dhe total 1510 ALL.
- Çelësi publik për këtë eksperiment lexohet nga një skedar i përkohshëm në runner; nuk u vendos në repo. Nuk ka kredenciale admin në skriptin e checkout-it, pagesë reale ose server publik.
- **KUFIZIMET:** testi është HTTP nga runner, **nuk është APK Android i lidhur në pajisje/emulator**. `pp_system_default` është ofrues manual sistemor demo, jo procesor pagese online dhe jo integrim me korrier/fiskalizim. Nuk ka ende teste për uljen/rezervimin real të stokut pas porosisë, izolim të dy bizneseve, abonime SaaS ose fortifikim production.
- **NEXT:** krijo instalim/nisje Android me API të aksesueshme në ambient testimi, provo sjelljen e inventarit dhe izolimin e dy bizneseve, auditim varësish dhe plan i vetëm për `source-of-truth` të PWA/native.


## Ecuria e radhës (2026-10-22): Rezervim inventari dhe kufiri i katalogut

- [Run 39841615561](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39841615561) PASSED: 20 inventare fillestare, porosia e testimit rezervoi saktësisht 1 njësi (`reservedDelta:1`), sasia fizike `stocked_quantity` mbeti konstante. Ky është rezervim, **jo** zbritje pas dërgesës.
- [Run 39842677918](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842677918) PASSED: çelësi API i lidhur me një kanal të dytë bosh lexon 0 produkte, kur çelësi i kanalit origjinal lexon 4 produktet demo; `SHQIPSHOP_SALES_CHANNEL_CATALOG_SCOPE_PASSED`. Porosia 1510 ALL dhe kontrollet e stokut kaluan përsëri.
- **Kufizim kritik arkitekturor:** Këto dy prova **NUK** provojnë izolimin e klientëve, porosive, administratorëve, përdoruesve ose skedarëve ndërmjet bizneseve. Sales channels Medusa nuk janë sistem multi-tenancy i gatshëm.
- Vazhdo me `docs/TENANT_ISOLATION_GATES.md` për portat e detyrueshme dhe përzgjedhjen e modelit tenant. Emulator Android është workstream i veçantë në [PR #4](https://github.com/titanfit102-bit/ShqipShop/pull/4), me rezultat të pavarur që duhet verifikuar live.


## Verifikim negativ shtesë — akses direkt me ID (2026-10-22)

[Run 39843421693](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39843421693) **PASSED**, commit `7e87bda1cfebe107e4acf78b31f4e98bc7defaa6`. Testi përdori çelësin publik të kanalit bosh për `GET /store/products/{id}` mbi ID-në e një produkti të kanalit kryesor. Serveri ktheu **HTTP 404** (`SHQIPSHOP_CROSS_CHANNEL_DIRECT_PRODUCT_DENIED`). Testet e katalogut, porosisë në PostgreSQL dhe rezervimit të 1 njësie inventari kaluan sërish. Ky është **scope i produkteve sipas sales-channel**, JO izolim i plotë i dy bizneseve ose i porosive/klientëve/adminëve.


## PR #4 — Android emulator x86_64 (veçmas nga APK-ja ARM64 e telefonit)

- Branch `feat/android-emulator-smoke`, PR https://github.com/titanfit102-bit/ShqipShop/pull/4, krijuar mbi Medusa backend POC.
- Workflow `.github/workflows/android-emulator-smoke.yml` me `ubuntu-latest`, Android emulator API 35 / x86_64, Gradle APK bundled, `adb install`, `MainActivity`, kontroll procesi 15 sekonda, crash log të filtruar dhe screenshot artifact.
- Prova fillestare https://github.com/titanfit102-bit/ShqipShop/actions/runs/39841940988 dështoi në konfigurimin e action-it (SHA e shkurtuar, e rregulluar). Run pasues https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842340691 ishte në proces gjatë dokumentimit. **Verifiko statusin aktual dhe raportin e emulatorit; mos pretendo instalim të suksesshëm vetëm nga ky dokument.**
- APK është nënshkruar me debug keystore të upstream, jo me një çelës biznesi. Nuk ka ende backend të lidhur nga emulatori dhe as checkout Android end-to-end.
- Nuk ndërtohet ShqipShop si Play Store alternativ (vendim përfundimtar i përdoruesit).


## Android emulator realisht i verifikuar — 2026-10-22

- **Github Actions run [39842340691](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842340691): PASSED.** `ubuntu-latest`, Android emulator API 35 / **x86_64**, build-i native React Native me JS të përfshirë, `adb install` dhe nisja e `com.rnstartermedusa/.MainActivity` funksionuan. Kontrolli verifikoi procesin pas 15 sekondash dhe mungesën e `FATAL EXCEPTION` në log-et e filtruara.
- Artefakti `ShqipShop-Android-emulator-launch-report` ruan screenshot dhe crash-log të filtruar: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842340691/artifacts/12454487323 (retention deri më 27 tetor 2026). Screenshot ekziston, **por nuk është audituar manualisht për UI/UX**.
- Ndërtimi arm64 për telefon vazhdon i veçantë: run https://github.com/titanfit102-bit/ShqipShop/actions/runs/39830678418. Të dyja APK-të janë **test-only, të nënshkruara me debug keystore të upstream**, pa kredenciale prodhimi.
- **Nuk ka ende**: lidhje APK→backend Medusa të aksesueshëm, çelës publishable të konfiguruar te APK, checkout në emulator nga UI, instalim në telefon fizik, white-label per tenant, privatësi/siguri production ose pagesa reale.
- **Hapi i radhës:** ngri server Medusa testimi të aksesueshëm nga emulatori, konfiguro çelësin demo pa e vendosur në repository, bëj UI→cart→order real në Android. Gjithashtu provo izolimin e klientëve/porosive/adminëve, release signing dhe remediimin e auditimit të varësive.


## ShqipShop — prova e lidhjes reale Android ↔ Medusa (22 tetor 2026)

- **Branch/PR:** `feat/android-emulator-smoke`, [PR #4 Draft](https://github.com/titanfit102-bit/ShqipShop/pull/4).
- **Implementuar në CI:** `.github/workflows/android-medusa-catalog.yml` + `native-medusa/scripts/android-medusa-catalog.sh`; një GitHub Actions job ngre PostgreSQL + Redis + Medusa v2 me rajon Shqipëri/ALL dhe 4 produkte, krijon publishable key demonstrues vetëm në runner, nis serverin host localhost:9000, injekton URL `http://10.0.2.2:9000` dhe key në APK të përkohshëm, ndërton React Native x86_64 me JS bundle, ndez emulator Android 35 dhe kontrollon titujt e produkteve në hierarkinë e UI. Ruhet screenshot dhe crash-log i filtruar. Kjo nuk prek `main`, nuk publikon backend dhe nuk ka pagesa reale.
- **Kufiri i sigurisë:** Për HTTP test lokal, `android:usesCleartextTraffic=true` shtohet nga workflow vetëm në working copy të GitHub runner. NUK është commit në manifestin prodhimi. APK është e nënshkruar me debug keystore origjinal, e pa-përshtatshme për shpërndarje komerciale. Çelësi publik i testit nuk ruhet në Git dhe nuk shfaqet në log.
- **CI run i nisur:** https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408. Gjatë shkrimit të këtij historiku serveri Medusa HTTP ishte ngritur dhe po kompilohej APK x86_64. **Mos deklaro lidhje të suksesshme nga aplikacioni pa `SHQIPSHOP_ANDROID_REAL_MEDUSA_CATALOG_PASSED` dhe run success**.
- **Next gate:** nëse prova e katalogut kalon, verifiko screenshot, kalimin te product-detail/shporta dhe checkout manual nga Android. Deri tani porositë Medusa 1510 ALL janë testuar vetëm me klient HTTP në GitHub Actions, jo UI Android. Pas kësaj kërkohen izolimi real i klientëve/porosive/adminëve midis bizneseve dhe security review.


## Prova e konfirmuar Android ↔ Medusa me UI (2026-10-22)

- **[Run 39845817408](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408) PASSED** në commit `7545938fb98da8479796f1db34fc4fbfc1c85b3b` (workflow `.github/workflows/android-medusa-catalog.yml`). Medusa API u ngrit në runner me PostgreSQL/Redis, rajoni Shqipëri/ALL dhe 4 produkte; `SHQIPSHOP_CI_MEDUSA_CATALOG_READY 4` u verifikua.
- Kodi origjinal React Native u ndërtua si APK x86_64 **me çelës API demonstrues të përkohshëm** (jo në Git), URL Android emulator `http://10.0.2.2:9000`, dhe HTTP cleartext të lejuar vetëm në working copy të CI. Pas instalimit të APK-së në Android 35, UI tregoi produktet demo nga Medusa: `SHQIPSHOP_ANDROID_REAL_MEDUSA_CATALOG_PASSED`. Screenshot u shkarkua dhe u verifikua vizualisht: Medusa T-Shirt, Medusa Shorts, Medusa Sweatshirt, foto, çmime ALL 1500 dhe shqip në navigim.
- **Artefakti zyrtar GitHub**: [12456126411](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408/artifacts/12456126411), `ShqipShop-Android-Medusa-connected-catalog` (foto `android-catalog.png`, crash-log bosh, rezultat), skadon 26 tetor 2026. **Nuk është screenshot ilustrues.**
- **Vërejtje vizuale reale:** titulli mbetet `MEDUSA MOBILE`; banneri kryesor shfaqet bosh (burim i jashtëm `dummyjson.com` në upstream), dhe produktet/çmimet kanë ende të dhëna demonstrimi. Këto nuk janë gati për branding të tregtarëve.
- **E paprovuar ende:** klikim produkti/variant dhe shportë nga Android, adresa, transporti dhe porosia nga UI në Android, pagesa reale, depozitim i sigurt i kredencialeve, iOS, dy biznese me autorizim të izoluar, publikim/abonime.
- **Next:** testim native Produkt→Variant→Shportë→Checkout kundrejt Medusa test-only, më pas branding i konfiguruar për biznes dhe heqje e burimeve/fakteve të rreme upstream. Mos prek `main` ose production.


## PR #5 — Verifikimi real i shportës Android (23 tetor 2026)

- Branch `feat/android-ui-cart-poc` mbi PR #4, [PR #5 Draft](https://github.com/titanfit102-bit/ShqipShop/pull/5).
- U ndërtua workflow `.github/workflows/android-medusa-ui-cart.yml`, duke ripërdorur backend-in ephemeral PostgreSQL 16 / Redis 7 / Medusa, vend/monedhë Shqipëri/ALL dhe APK React Native të nënshkruar me debug-key. Çelësi publishable dhe HTTP localhost shtohen **vetëm në runner** dhe nuk futen në Git.
- Automatizim Android UI (`native-medusa/scripts/shqipshop-ui-automation.py` + `android-ui-cart.sh`) synon Medusa Shorts → madhësia S → Shto në shportë → Shiko shportën. Nuk përdor kërkesë HTTP direkte për të krijuar shportën.
- Verifikim i pavarur nga Medusa `assert-android-ui-cart.ts`: kërkon një shportë ALL në PostgreSQL me 1 Medusa Shorts. Marker-at për t'u verifikuar: `SHQIPSHOP_ANDROID_UI_CART_PASSED` dhe `SHQIPSHOP_ANDROID_CART_PERSISTED_IN_POSTGRES_PASSED`.
- [Run i parë](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695) ishte **në kompilim** gjatë dokumentimit. Mos numëro përfundim pa kontrolluar rezultatin e CI dhe log-et.
- **Jo e përfunduar:** porosia nga UI Android, checkout me adresë/transport/pagesë manuale, izolimi dy bizneseve, varësitë me advisory të sigurisë dhe gjeneratori white-label.
- Hapi pasues: nëse testi i shportës dështon, lexo log + screenshot, riparo shkakun, testo sërish. Nëse kalon, shto testim të checkout UI dhe të porosisë në databazë. Kurrë mos bëj merge në main pa autorizim të veçantë.


## Android UI → shportë → PostgreSQL: PASSED (2026-10-23)

- **[GitHub Actions run 39867727695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695): PASSED** në commit `7421811f11edf27b82f57c650b87e57fb9dcd258`, PR #5 Draft. U ndërtua APK x86_64, u instalua në Android 35 emulator, u hap `Medusa Shorts` nga katalogu i shërbyer nga Medusa, u zgjodh varianti `S`, u shtua një njësi në shportë dhe u hap ekrani real `Shporta`.
- Log-et verifikojnë `SHQIPSHOP_ANDROID_UI_CART_PASSED` dhe `SHQIPSHOP_ANDROID_CART_PERSISTED_IN_POSTGRES_PASSED`. Medusa query konfirmoi `{"currency":"all","itemCount":1,"product":"Medusa Shorts","quantity":1}` në PostgreSQL. Nuk është thjesht test vizual, por lidhje e plotë UI → Store API → database për **shportën**.
- **[Screenshot zyrtar i shportës](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695/artifacts/12465970419)** u shkarkua dhe u verifikua vizualisht: Shporta, Medusa Shorts, Varianti S, 1 njësi, ALL 1,500, butoni "Përfundo porosinë". Nuk ka fatal crash në logun e filtruar. Artefakti skadon 26 tetor 2026.
- **Kufizime:** porosia nuk është përfunduar nga UI Android, transporti nuk është zgjedhur, nuk është dhënë adresë, as pagesë reale. Backendi është ephemeral test-only, çelësi API demo dhe debug signing nuk përdoren për prodhim. Izolimi i të dhënave të dy bizneseve ende mungon.
- **Next:** test Android UI checkout nga ky ekran deri te order në PostgreSQL, me të dhëna krejt sintetike; më pas testi negativ i qasjes së porosive/klientëve/adminëve midis bizneseve dhe personalizimi white-label.


## 23 tetor 2026 — Dual Currency, çmim kryesor + orientues (PR #6)

- **Kërkesë e konfirmuar:** kur biznesi shet në ALL, produkti, varianti, shporta dhe përmbledhja tregojnë çmimin **1.500 lekë** si çmim real dhe në rresht të vogël gri **(≈ €15,00 · orientuese)** vetëm kur ekziston një kurs i vlefshëm; për shitje në EUR, çmimi kryesor mbetet në euro, ndërsa ALL mund të jepet orientues. Në shportë shënohet **ALL = lekë të reja**, për të shmangur keqkuptimin me lekë të vjetra.
- **PR #6 (Draft):** https://github.com/titanfit102-bit/ShqipShop/pull/6 , branch `feat/dual-currency-price-ui` mbi PR #5. U shtua `ShopPrice` dhe helper, React Query shared, të integruar në kartat e produkteve, detaje, çmimin e rreshtit të shportës dhe totalet, pa ndryshuar Medusa cart/order amount ose `currency_code`.
- **Backend:** `GET /store/shqipshop/indicative-fx` në Medusa, me kursin **ALL për 1 EUR** të vendosur nga operatori; kërkon `SHQIPSHOP_FX_ALL_PER_EUR`, `SHQIPSHOP_FX_AS_OF=YYYY-MM-DD`, `SHQIPSHOP_FX_SOURCE`. Nuk shfaqet asgjë në euro kur kursi është i munguar, i pavlefshëm ose mbi 7 ditë i vjetër. Nuk ka ende furnizues live për kurset ose kurs specifik për tenant; pa këto nuk mund të deklarohet gati për prodhim.
- **Kursi 100 ALL/EUR në GitHub CI është TËRËSISHT SINTETIK**, vetëm për regresione dhe screenshot, **jo kurs aktual**. Testet e serverit `SHQIPSHOP_INDICATIVE_FX_HTTP_PASSED` dhe të porosisë 1510 ALL kaluan në https://github.com/titanfit102-bit/ShqipShop/actions/runs/39931072361 .
- **React Native:** testet e konvertimit (Jest) kaluan; një ekzekutim fillestar zbuloi mock `apiUrl` të papërcaktuar te `App.test.tsx`, i korrigjuar. Native lint/typecheck/Jest kaluan në https://github.com/titanfit102-bit/ShqipShop/actions/runs/39931374229 .
- **Pamja realisht në Android:** u shtua workflow `android-dual-currency-ui.yml` që vendos kurs sintetik në backend dhe kërkon tekstin orientues `≈ €15,00` në emulator. [Workflow / runs](https://github.com/titanfit102-bit/ShqipShop/actions/workflows/android-dual-currency-ui.yml) — statusin dhe screenshot-in kontrolloji live përpara se ta deklarosh vizualisht të verifikuar.
- **Pagesa e vërtetë në EUR/ALL NUK është implementuar.** Për këtë duhen monedha/çmimet server-side në Medusa, transport/taksa, checkout/order në monedhën e zgjedhur, PSP/COD kompatibël, refund dhe kontroll kontabël. Nuk përdoret kursi orientues për pagesën.
- Pas verifikimit vizual vazhdo planin kryesor: checkout Android nga UI deri te porosia në PostgreSQL, pastaj izolimi i plotë i bizneseve dhe white-label generator.


## 23 tetor 2026 — PR #6 i provuar vizualisht; PR #7 checkout native në testim

- **Çmimet ALL/EUR / PR #6**: [Android emulator run 39931562458](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39931562458) PASSED, marker `SHQIPSHOP_ANDROID_DUAL_CURRENCY_UI_PASSED`: shporta e Medusa Shorts në ALL shfaqi `≈ €15,00` sipas **kursit SINTETIK** 100 ALL/EUR. PostgreSQL verifikoi artikullin në shportë. [Screenshot zyrtar](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39931562458/artifacts/12493325005). Nuk është lidhur ende kurs i vërtetë i Bankës së Shqipërisë/ndonjë burimi tjetër me freski të auditueshme; nuk ekziston ende pagesë reale në EUR.
- **PR #7 Draft:** [Android checkout UI](https://github.com/titanfit102-bit/ShqipShop/pull/7), branch `feat/android-native-checkout-e2e` mbi PR #6; workflows `.github/workflows/android-native-checkout-e2e.yml` dhe `native-medusa/scripts/android-native-checkout-e2e.sh`.
- Testi përdor një server dhe databazë **ephemeral PostgreSQL/Redis/Medusa**, APK Android 35 x86_64 me debug-keystore publik dhe publishable key vetëm në CI. Nga UI zgjedh Medusa Shorts S → shportë → plotëson adresë fiktive në Tiranë → Transport standard → Manual (`pp_system_default`) → Dërgo porosinë. Query server-side kërkon 1 porosi `ALL 1510`, vend `al`, email `buyer-ci@example.invalid`, 1 Medusa Shorts.
- U shtuan accessibility labels për inpute React Native dhe zgjedhje e paracaktuar e vendit vetëm kur rajoni ka një shtet. Këto ndryshime kaluan lint/typecheck/Jest në [run 39935031421](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39935031421); backend HTTP PostgreSQL checks në [run 39935031422](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39935031422); pilot Python në [run 39935031407](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39935031407).
- **Rezultati final i UI checkout-it:** [run 39934984130](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130). Në momentin e këtij dokumentimi ishte në ndërtimin Gradle; KËRKO `SHQIPSHOP_ANDROID_NATIVE_ORDER_UI_PASSED` dhe `SHQIPSHOP_ANDROID_NATIVE_ORDER_POSTGRES_PASSED` në të njëjtin run **me conclusion=success**. Nëse nuk kalon, dokumento error-in/screenshot-in dhe riparo. Mos raporto sukses vetëm prej kalimit të TypeScript/API.
- **Faza pasuese:** siguro 2 biznese me identitet, porosi, klientë, media dhe admin të izoluar, teste negative me ID cross-tenant; furnizues kursi real ALL/EUR dhe pagesa dymonedhëshe vetëm pasi bëhen kontrata server-side për çmimet, transportin, taksat, provider sandbox, order/refund/accounting. Branding white-label dhe release signing më vonë. `main` nuk ndryshohet pa autorizim.


## PR #7: POROSIA NGA UI ANDROID KALOI (2026-10-23)

- **[GitHub Actions run 39934984130](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130) PASSED.** Log-et përmbajnë në të njëjtin run `SHQIPSHOP_ANDROID_NATIVE_ORDER_UI_PASSED` dhe `SHQIPSHOP_ANDROID_NATIVE_ORDER_POSTGRES_PASSED`. Në Android 35 x86_64, UI përzgjodhi Medusa Shorts variant S, e shtoi në shportë, plotësoi email/adresë sintetike në Tiranë, përzgjodhi `Transport standard`, `Manual`, dhe shtypi `Dërgo porosinë`. UI kaloi te `Detajet e porosisë`.
- Query e pavarur në Medusa PostgreSQL vërtetoi **një porosi 1.510 ALL**, produktin/sasinë, vendin `al` dhe emailin sintetik. **Kjo është prova e parë native UI → Order DB**, jo vetëm API smoke.
- **[Artifact zyrtar 12493738613](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130/artifacts/12493738613)** përmban screenshot `checkout-final.png` të inspektuar vizualisht, `status.txt` dhe `android-crashes.log` bosh. Ekrani tregon numrin e porosisë, Medusa Shorts S, adresë sintetike, transport 10 ALL, total **1510 ALL**.
- **Gabim UI i zbuluar nga screenshot-i:** rreshti i emërtuar `Nëntotali` tregon **1510 ALL** në vend të 1500 ALL, ndërsa transporti është 10 ALL dhe totali 1510 ALL. Kodi `native-medusa/app/screens/order/order-detail.tsx` përdor `order.subtotal` në vend të `order.item_subtotal`/shumës së produkteve. Emri i metodës së transportit është hardcoded “Standard Shipping” dhe titulli i navbar-it “Detajet e porosisë” ngushtohet. Këto duhen riparuar si PR #8 përpara release-it. Backend order amount **është verifikuar**.
- **Mbetet:** real EUR checkout, FX zyrtar automatik, pagesa bankare/COD real, klientë/adminë/porosi të izoluar për 2 merchants, abonimet SaaS, release-grade signing, Play Store/iOS. `main` nuk është ndryshuar.


## PR #8 — Korrigjimi i nëntotalit të porosisë (23 tetor 2026)

- **Origjina e gabimit:** screenshot real i checkout-it të suksesshëm Android [artifact 12493738613](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130/artifacts/12493738613), porosia e regjistruar me 1 Medusa Shorts S (1500 ALL) + transport (10 ALL) = totali (1510 ALL). Ekrani gabimisht etiketonte si `Nëntotali` vlerën 1510 ALL, sepse përdorte `order.subtotal`. Kjo është **gabim vizual i llogaritjes**, jo i krijimit të porosisë.
- **Zgjidhja në [PR #8](https://github.com/titanfit102-bit/ShqipShop/pull/8)**, `feat/order-receipt-accuracy` mbi PR #7: utility `native-medusa/app/utils/order-totals.ts` përdor `order.item_subtotal` ose subtotalin e rreshtave, pa e përfshirë transportin; `order-detail.tsx` përdor çmim kryesor të formatuar ALL/EUR, emrin real të metodës së transportit kur ofrohet nga API-ja dhe `ShopPrice` në total. `navbar.tsx` zgjeroi hapësirën e titullit.
- **Verifikimi i kodit:** [React Native lint + TypeScript + Jest run 39937851854](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39937851854) PASSED, përfshirë testet e reja që `itemSubtotal=1500`, `shipping=10`, `total=1510`.
- **KUFIZIM PROVE:** përmbajtja e PR #8 nuk ka ende screenshot të ri Android për të konfirmuar pozicionimin vizual, `Transport standard` nga Store Order API dhe shfaqjen e `≈ €15,10` në faqen e porosisë. Mos i deklaro si të verifikuara në emulator pa run real green dhe screenshot të shqyrtuar. Screenshot-i i vjetër tregon gabimin, jo korrigjimin.
- PR-të #1–#8 mbeten Draft, nuk ka merge në `main`. Në prodhim ende duhen pagesë në EUR/ALL, kurs i verifikuar në mjedis real, tenant isolation, siguri varësish, white-label branding dhe nënshkrim release.


## 23 tetor 2026 — Izolimi ndërmjet dy Medusa backend-eve: prova e parë GREEN

- **Gjetja që e nisi këtë:** [PR #9 / run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016) FAILED AS INTENDED: në një backend të përbashkët Medusa me 2 sales channels, të dy publishable keys A/B morën **HTTP 200** ndaj `GET /store/orders/{id_A}`. Kjo vërtetoi që sales channels nuk janë kufi privatësie mes tregtarëve. PR #9 duhet të mbetet diagnostik i kuq dhe mos u fshi testimi.
- **Vendimi i pilotit [ADR-006](ADR-006_TENANT_BACKEND_ISOLATION.md):** çdo tregtar pilot ka një instancë Medusa/DB PostgreSQL/user role të izoluar, dhe control plane ShqipShop jashtë rrjedhës së klientëve/porosive. Ky është dizajn i rekomanduar, jo ende SaaS i përfunduar.
- **[PR #10](https://github.com/titanfit102-bit/ShqipShop/pull/10), [run 39947677104](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39947677104): PASSED.** CI krijoi dy database PostgreSQL të veçanta `shqipshop_ci_a`, `shqipshop_ci_b` dhe përdorues të pavarur me `REVOKE CONNECT FROM PUBLIC`. Prova negative DB A↔B kaloi: `SHQIPSHOP_TWO_DATABASE_ROLE_DENIAL_PASSED`.
- Në instancën A Medusa, u krijua porosi sintetike 1510 ALL; instanca B u ngrit **pas mbylljes së A** me të dhënat e B, port 9001, key publik të B dhe database të B. Serveri B ktheu **HTTP 200** për katalogun me B key, **HTTP 400** për A key dhe **HTTP 404** për porosinë A të kërkuar me B key. `SHQIPSHOP_SEPARATE_MEDUSA_ORDER_BOUNDARY_PASSED`.
- **Kufiri i provës:** dy instancat u testuan **sekuencialisht** (jo dy procese paralele). Kjo NUK provon admin/customer/session security, izolim të queues/Redis në të gjithë provider-at, media, webhook, refund, billing, backup ose real-world deployment. `G3 tenant isolation` mbetet **NË PROGRES, jo PASS**.
- **Android receipt visual:** [run 39946022933](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933) për 1500 ALL produkte + 10 ALL transport = 1510 ALL dhe FX hint 15.10 EUR sintetik duhet kontrolluar live përpara deklarimit vizual.
- **Next:** test dy backend-e aktive njëkohësisht me kontroll databazash/Redis dhe role admin/client për dy tregtarë, regjistro provision/deprovision + backup/restore, limite të burimeve, analizë reale kosto 5/50/500, pastaj branding i dyqanit dhe përditësimi i Android/PWA per merchant. Mos prek main/production.


## 23 tetor 2026 — Screenshot-i i ri Android i faturës është verifikuar

- **[GitHub Actions run 39946022933](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933): PASSED**, me `SHQIPSHOP_ANDROID_RECEIPT_ALL_ROWS_PASSED` dy herë, `SHQIPSHOP_ANDROID_RECEIPT_UI_PASSED` dhe `SHQIPSHOP_ANDROID_NATIVE_ORDER_POSTGRES_PASSED`. Testi verifikoi në **të njëjtin rresht të UI**: `Nëntotali → 1.500 lekë`, `Transporti → 10 lekë`, `Gjithsej → 1.510 lekë`; kursi sintetik 100 ALL për 1 EUR shfaqi `≈ €15,10 · orientuese`. Porosia u krijua nga Android dhe u verifikua në PostgreSQL.
- **[Screenshot artifact 12499331067](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933/artifacts/12499331067)** është shkarkuar dhe kontrolluar vizualisht: Medusa Shorts varianti S, adresa fiktive Tiranë, `Transport standard (10 lekë)`, nën-totali dhe shuma përfundimtare të sakta, tekst i vogël gri EUR. `android-crashes.log` ishte bosh. Artifact ka retention deri më 27 tetor 2026.
- **Defekt i vogël i mbetur në UI:** titulli `Detajet e porosisë` tani nuk pritet, por del shumë **i vogël** në telefon. Nevojitet rregullim i tipografisë së Navbar pa `adjustsFontSizeToFit` të pakontrolluar dhe një screenshot i ri.
- **Ende të paprovuara për prodhim:** real ALL/EUR checkout & FX data provider, real payment provider, tenant admin/customer auth, dy instanca aktive njëkohësisht, Redis/workers, storage/backup, siguri dependency, deploy me TLS dhe release signing. G3 tenant-isolation ende INCOMPLETE.

## 23 tetor 2026 — PR #11 dhe PR #12: dy biznese aktive, porosi dhe JWT të izoluara (GREEN)

- **PR #11** https://github.com/titanfit102-bit/ShqipShop/pull/11 (Draft, i bazuar në PR #10). **Run 39979050578** https://github.com/titanfit102-bit/ShqipShop/actions/runs/39979050578, commit `dafb668`: **PASSED**. Dy procese Medusa aktive njëkohësisht (:9000/:9001), PostgreSQL A/B me role të ndara, dy checkout sintetikë nga **1.510 ALL** secili; secili lexon porosinë e vet (HTTP 200), por kërkimi i porosisë së tjetrit jep HTTP 404, key i tjetrit refuzohet HTTP 400. Redis A/B janë dy shërbime të arritshme, por integrimi Medusa Redis provider dhe izolimi real i queues **nuk janë provuar**.
- **PR #12** https://github.com/titanfit102-bit/ShqipShop/pull/12 (Draft, mbi PR #11), commit kodi `c2c4f89`: **runs 39980691897 dhe 39980753775 PASSED**; gjithashtu Medusa smoke `39980753771` dhe pilot verify `39980753785` **PASSED**. Dy admin-e sintetike të krijuara në DB të ndryshme, dy customer accounts nëpërmjet Medusa /auth/customer/emailpass/register + /store/customers. Dy serverët përdorin JWT_SECRET dhe COOKIE_SECRET të ndryshëm. Token-i i klientit A nuk hyn si klient në B; token-i i adminit A nuk hyn si admin në B (dhe anasjelltas); asnjë token klienti nuk mund të përdoret si admin në serverin e vet. Markers: `SHQIPSHOP_MERCHANT_A_OWN_AUTH_PASSED`, `SHQIPSHOP_MERCHANT_B_OWN_AUTH_PASSED`, `SHQIPSHOP_MERCHANT_A_FOREIGN_AUTH_DENIED`, `SHQIPSHOP_MERCHANT_B_FOREIGN_AUTH_DENIED`, `SHQIPSHOP_TWO_MERCHANT_ADMIN_CUSTOMER_JWT_ISOLATION_PASSED`.
- **Kufijtë**: login me JWT është provuar, **jo cookie/session e vërtetë**, role/RBAC të ndryshme brenda administratorëve, GET/POST/PUT/DELETE të porosive me auth kundërshtare, refund/cancel, cross-tenant media/storage, Redis provider/worker/event hooks, race/load, backup/restore, provisioning, billing, real FX/PSP/COD ose production. **G3 ende i papërfunduar**; main ende baseline i paprekur, **asnjë merge/deploy**. Dokumentet më poshtë mund të përmbajnë snapshot-e të vjetra, prandaj përdor këtë hyrje të datës si progresin më të fundit të verifikuar.
- **Hapi i radhës**: negative tests për cookie/session dhe admin/customer mutation authorization; pastaj validimi i Redis queues dhe backup/restore, onboarding/provisioner idempotent, unifikimi PWA/native mbi një backend per tenant.


## 2026-10-23 — MASTER CONTINUITY PROTOCOL v22 (vendim dhe dokumentacion)

**Vendim i përdoruesit / autorizim i shprehur:** ShqipShop duhet të ketë checkpoint të shkurtër CURRENT_STATE dhe handoff të konsoliduar, të përditësuar pas çdo ndryshimi material dhe të verifikuar, me historik dhe gjendje të sinqertë. Leja e vazhdueshme përfshin vetëm docs/CURRENT_STATE.md, docs/MASTER_HANDOFF.md, AGENTS.md, docs/PROJECT_HISTORY.md dhe docs/ROADMAP.md, **vetëm në feat/merchant-auth-boundary-ci**. Nuk autorizon ndryshime të kodit brenda kësaj detyre, degë të tjera, main, merge, deployment ose pagesa reale.

**Baseline i verifikuar para dokumentimit:** [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12), HEAD kodi 3eab3c3fc0007c4b76aff9c51c80bae007290742, [parallel/auth run 39981336521](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336521), [Medusa smoke 39981336483](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336483), [pilot verification 39981336440](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336440), **3/3 SUCCESS**. JWT/customer/admin boundary e provuar në CI, jo cookie/session/authorization mutations/queues/production. PR #11 dhe #12 mbeten Draft.

**Implementimi dokumentar:** u shtua docs/CURRENT_STATE.md; MASTER_HANDOFF v21 u konsolidua në **v22**, me historikun e v21 të ruajtur te [commit 3eab3c3](https://github.com/titanfit102-bit/ShqipShop/blob/3eab3c3fc0007c4b76aff9c51c80bae007290742/docs/MASTER_HANDOFF.md); AGENTS mori rregullin e hyrjes në degën e saktë; ROADMAP sinkronizoi faktet e verifikuara për Android G2 dhe izolimin G3. Ky është mekanizmi i dokumentacionit të vazhdueshëm, jo fazë që zëvendëson ndërtimin e produkit.

**Rikuperimi:** https://github.com/titanfit102-bit/ShqipShop/blob/feat/merchant-auth-boundary-ci/docs/CURRENT_STATE.md — skedar **jo në main**, referuar gjithashtu nga MASTER_HANDOFF v22 dhe AGENTS. Në seancë të re: verifiko branch/PR/HEAD, lexo CURRENT_STATE dhe MASTER, pastaj kod/tests/logs. Nëse zhvillimi kalon në degë tjetër, ruaje checkpoint-in në degën e autorizuar duke referuar punën e verifikuar; **mos kopjo/shkruaj dokumentet në degën tjetër pa miratim**. Zgjidhje e propozuar, jo e zbatuar: branch/PR i dedikuar docs/continuity ose docs-only në main, me autorizim të veçantë.

**Rregull prove:** commit-i i kodit 3eab3c3 dhe CI e tij janë evidenca e baseline; commit-et dokumentare të kësaj seance kanë SHA të rinj dhe duhet të verifikohen live. Mos përziej implementimin me kalimin e testeve, release, production ose shitje. Hapi teknik pasues: testet negative cookie/session dhe mutation authorization, vetëm me leje të shprehur për kodin.

## Rikuperim live — 2026-10-23, pas protokollit v22

- **HEAD i inspektuar:** `b3f759a2e363b70664ce74e17ef742964e6e6922`. Krahasimi nga code SHA `3eab3c3` përmban **vetëm** AGENTS.md, CURRENT_STATE, MASTER_HANDOFF, PROJECT_HISTORY dhe ROADMAP; asnjë ndryshim kodi.
- **CI në këtë HEAD:** [parallel/auth 39985437241](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39985437241), [Medusa smoke 39985437127](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39985437127), [pilot 39985437135](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39985437135): **3/3 SUCCESS**, job steps dhe log-et u lexuan. Pilot: **10 passed**; Medusa: porosi PostgreSQL dhe rezervim +1 me stok fizik të pandryshuar; dy-backend: marker-at order boundary A/B dhe admin/customer JWT isolation.
- **PR #1–#12:** ende OPEN Draft; #12 bazohet në #11, #11 në #10; #9 dhe #10 janë degë motra mbi #8. `main` mbetet `329e0381b0bc4ce39cf554a2b2888a047e1dd29e`.
- **Gjetje e re e verifikuar:** log-u i backend smoke shfaq vlera JWT_SECRET/COOKIE_SECRET të gjeneruara për runner-in, pa maskim; workflow i shkruan në GITHUB_ENV pa add-mask. Janë sekrete CI të përkohshme, jo provë ekspozimi kredencialesh production. **Mos kopjo vlerat** në docs/raporte. Korrigjimi i workflow-t kërkon leje kodi.
- **Gjendja:** G3 IN_PROGRESS. Analiza dhe kriteret më poshtë janë përgatitur; **testet e reja nuk janë implementuar/ekzekutuar**. Autorizimi i konfirmuar mbulon vetëm pesë dokumentet në këtë degë. Hapi teknik pret leje të shprehur për scripts/workflow; nuk është dështim i testit.

**Përgatitje P0:** source Medusa v2.22.0 për auth/session dhe POST customer/order/inventory u inspektua. Kriteret dhe skedarët e propozuar u ruajtën në MASTER_HANDOFF §10. Dallohet logout cookie nga JWT revocation; testet negative kërkojnë payload valid dhe snapshot para/pas. Asnjë kod ose workflow nuk u ndryshua; implementimi pret autorizim specifik. Nuk u krye merge/deploy.

## 2026-10-23 — Audit read-only Redis/JWT

HEAD e5657c6ddfa79d5cba004868b8ac6ba800263cd1, PR #12 OPEN Draft; CI 39990409987/39990410102/39990410033 **3/3 SUCCESS**. Kodi dhe burimi upstream Medusa v2.22.0 (205aff40bacfa0049e0b9d3a7913a674738bff31) u krahasuan me log-un e job 120540397758: fallback lokal/fake redis, event bus lokal dhe locking in-memory; vetëm REDIS_URL në env nuk aktivizon modulet Redis në këtë rrugë self-hosted. Sessions janë default memory sipas konfigurimit dhe loader-it; restart persistence ende pa provë. JWT default pritet 1d nga source, jo matje runtime exp; cookie logout nuk revokon JWT, refresh-after-logout kërkon test. Workflow-inmemory ka edhe DB persistence dhe nuk u quajt «pa asnjë persistencë».

Analiza, linket immutable të source, kufijtë dhe plani konkret P1a (binding/cache/event/workflow/restart/locking/regressions) u ruajtën te MASTER_HANDOFF §11. Asnjë kod/config/workflow/dependency nuk u ndryshua. Implementimi P1a kërkon scope kodi për konfigurimin dhe fixtures; mirëmbajtja e dokumenteve mbetet e autorizuar. JWT policy/revocation është fazë e veçantë.

## ShqipShop independent audit F01–F16 review — 2026-10-23

**Evidenca:** raport i pavarur për commit e22bb13 (F01–F16), rishikuar kundrejt source GitHub, upstream Medusa 2.21.2/2.22.0 dhe [CI 39991716155](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39991716155), [39991715755](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39991715755), [39991715961](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39991715961): 3/3 SUCCESS. Verifikimi i Work për komponentet native dhe numri i package advisories nuk u riprodhuan veçmas nga ky reviewer; shumica e mekanizmave defektozë u konfirmuan nga source. Detajet dhe caveats: CURRENT_STATE dhe MASTER_HANDOFF §12 në këtë branch (jo main).

**Rruga e rekomanduar, VETËM PROPOZIM, jo leje implementimi:**
- **Native me llogari reale:** F01 është P0 i privatësisë. F02 SDK logout, F03 stale cart, F04 swallowed mutation errors, F05 checkout resume dhe F13 price=0 duhet të kenë testet e tyre të regression. F12 production signing bllokon vetëm store release të native.
- **PWA-first:** F06 receipt ID-as-capability guest/account privacy contract dhe F09 një commerce source-of-truth janë prioritete pilot; F15 brand CSS/CSP vetëm nëse pilot FastAPI mbahet.
- **Operations:** F07 Redis provider/event/session/workflow wiring me prova të vërteta (jo vetëm PING); F08 JWT lifecycle dhe credential storage, F10 native CI gates, F11 dependency advisory triage/release bundle, backup/TLS/secrets/privacy; F14 UI error/accessibility sipas flow-it, F16 shënim historik/superseded.
- **Release gate:** G2 native është PARTIAL; G3 server tenant auth është PARTIAL (jo production-ready); G4–G8 varen nga target-i real; mos numëro P0 native release kundër një target-i PWA-only.
- **Autorizimi:** vetëm update docs CURRENT_STATE/MASTER_HANDOFF/PROJECT_HISTORY/ROADMAP/AGENTS në feat/merchant-auth-boundary-ci është i vazhdueshëm. Nuk është dhënë leje e re për F01–F15 kod ose për degë të tjera/main/merge/deploy.

## 2026-10-23 — F01 native privacy cache increment (CI VERIFIED)

Me «okej vazhdo» përdoruesi miratoi konkretisht fazën e propozuar F01. Në degën ekzistuese `feat/merchant-auth-boundary-ci` u implementua principal/backend-scoped React Query private cache, cancel/remove gjatë auth identity transition, late identity response guard, order-detail route guard dhe reset navigimi pas logout. U shtuan teste me QueryClient/CustomerProvider real dhe fixtures sintetike për A→logout→B/offline/in-flight/legacy keys; *nuk* u ndryshua Medusa SDK logout ose backend order receipt policy.

**Evidencë:** code SHA [2219e65](https://github.com/titanfit102-bit/ShqipShop/commit/2219e65e5dff987ad5046bcf34f03fc253d9e714), native [run 40001961028](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40001961028) **SUCCESS** (9/9 suites, 32/32 tests, ESLint, TS); pilot [40001960999](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40001960999) dhe Medusa smoke [40001960998](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40001960998) SUCCESS; parallel/auth [40001960997](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40001960997) **SUCCESS**, pra **4/4 workflows** kaluan në code SHA F01. Intermediate RED nga lifecycle lint/test mock u zgjidhën pa fshirë regresionet.

**Status:** F01 IMPLEMENTED + VERIFIED në Jest/native source. **Nuk u krye telefon/emulator/screenshot i ri; jo release gate i plotë**. F02 JWT local logout race, F06 guest receipt ID-as-capability dhe F03–F16 mbeten. Asnjë ndryshim main, merge/deploy, payments, secrets. Vetëm scope F01 kodi u autorizua; ndryshime të tjera kodi kërkojnë leje të veçantë. CURRENT_STATE dhe MASTER_HANDOFF §13 japin pikën e rikuperimit; dokumentet jetojnë në degën e PR #12.

## 2026-10-23 — F02: safe local JWT logout under delayed/rejected AsyncStorage

**Autorizim:** përdoruesi tha «vazhdo» për korrigjimin F02 të propozuar, vetëm për native logout/token storage në degën ekzistuese. U shtua `auth-token-storage.ts` me barrierë sinkrone, shënues të qëndrueshëm të logout-it, queue asinkrone të storage writes dhe kontroll fizik të fshirjes. `CustomerProvider` nuk përdor më SDK `auth.logout()` që nuk pret clearToken; përdor `await apiClient.client.clearToken()` për JWT dhe fail-closed local barrier. Error i fshirjes i shfaqet përdoruesit dhe stack-u privat fshihet. U shtuan teste për delay/failure/in-flight read dhe verifikim token-i të ri; testet ekzistuese F01 u përshtatën.

**Evidencë të verifikuara në code SHA [b3097a3](https://github.com/titanfit102-bit/ShqipShop/commit/b3097a3d9f8b78a7d60a5418ca565e82b66a1905): 4/4 GitHub Actions SUCCESS:** [native 40005009842](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009842) 10 suites/36 Jest + lint/TS, [pilot 40005009867](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009867), [Medusa 40005009885](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009885), [parallel A/B 40005009829](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009829). Ndryshime F02: vetëm 6 skedarë native mbi checkpoint F01 `4ffef9cd`, pa main/production/merge. PR #12 mbetet Draft.

**Kufiri:** JWT nuk revokohet server-side; marker + fshirje storage nuk garantojnë persistencë pas restart-it nëse të dyja shkrimet dështojnë; device E2E/Authorization header nuk janë provuar. F02 CI testuar lokalisht, jo production-ready. Hapi pasues F06 receipt ownership/guest capability kërkon autorizim kodi të veçantë. [CURRENT_STATE](CURRENT_STATE.md), [MASTER_HANDOFF §14](MASTER_HANDOFF.md).

## 2026-10-23 — F06 order access ownership (HTTP/CI verified)

Me autorizimin «vazhdojm» për F06 u shtua kontrolli i leximit të faturave në Medusa: logged-in customer duhet të zotërojë order-in; blerësi guest duhet të dërgojë originating cart ID si proof shtesë në header. Native checkout i kalon proof ekranit të faturës. Testet HTTP mbi A/B përfshijnë një guest order dhe një customer-owned order në secilin dyqan, si dhe kundër-prova me klient të dytë brenda së njëjtës instancë. **Code SHA [9a6a4e1](https://github.com/titanfit102-bit/ShqipShop/commit/9a6a4e199fa4b72935fa44b356776bd9843bb408), 5/5 Actions SUCCESS**: [40009599530](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599530), [40009599479](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599479), [40009599449](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599449), [40009599424](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599424), [40009599412](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599412).

**S'mund të quhet release-ready:** guest proof nuk persiston për hapje pas restart-it, kthimet/returns dhe endpoint-et e tjera ID-as-capability nuk u auditua, nuk ka prova device/TLS/rate limit/secure storage. PR #12 ende Draft, pa merge/deploy/main. Ky entry është progres real i F06 dhe nuk shfuqizon historikun e F01/F02. Detajet: CURRENT_STATE, MASTER_HANDOFF §15.

## 2026-10-23 — F03/F04/F05 cart and checkout reliability

User «vazhdojm» autorizoi fazën e njoftuar F03–F05 brenda degës aktuale; pa merge/main/deploy. `cart-recovery.ts` provon 404/410 para heqjes së cart ID dhe krijimit të shportës së re; offline/401/5xx nuk shkatërrojnë shportën e ruajtur; Cart UI ka loading/error/retry. `CartProvider` i propagoi gabimet add/update, ndërsa butonat e produktit dhe të sasisë shfaqin Alert dhe përdorin finally. `checkout-progress.ts` nuk lejon review pa sesion real pending/authorized; `Checkout` rilexon cart me sesion nga Medusa pas nisjes së pagesës dhe bllokon complete kur mungon/mospërputhet sesioni.

**Prova e kodit:** [SHA 7ea5153](https://github.com/titanfit102-bit/ShqipShop/commit/7ea515388d70ce45517ed667ab0275ff86cc9040); [native 40012363697](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363697) SUCCESS, 13/13 suites, 56/56 Jest, ESLint+TS; [Medusa 40012363691](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363691) SUCCESS me `SHQIPSHOP_F05_CART_PAYMENT_SESSION_VERIFIED`; [pilot 40012363683](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363683) SUCCESS; [parallel 40012363695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363695) SUCCESS; [two isolated 40012363718](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363718) **SUCCESS** — **5/5 workflow-t në code SHA GREEN**. Referencat dhe kufijtë e plotë te CURRENT_STATE / MASTER_HANDOFF v22 §16.

**Nuk është verifikuar ende:** pajisja reale Android, restaurimi i region ID të gabuar, rapid region switch, idempotency reale / Stripe, rikthimi i produkteve nga cart i fshirë, secure storage dhe production. G3/G5 = in progress. Leja e re e kodit vlen vetëm për F03–F05; dokumentacioni ruhet në feat/merchant-auth-boundary-ci, jo main.

## 2026-10-23 — RegionProvider recovery and region selection races

**Scope / permission:** user «vazhdojm» after the RegionProvider next step. Only native region state, region screens, and associated tests edited on `feat/merchant-auth-boundary-ci`; no Redis, main, deploy, merge or production actions. Code SHA [77de0869](https://github.com/titanfit102-bit/ShqipShop/commit/77de0869a4f072eeb3dcbd047c21dd5a0f525909), PR #12 Draft. New `region-recovery.ts` catches invalid saved region 404/410, falls back to available list but never replaces saved ID on offline/401/5xx. `RegionProvider` ignores late bootstrap responses after manual selection, serializes AsyncStorage writes in order, exposes error/retry, and Home/RegionSelect display retry UI.

**Evidence:** [native CI 40014816829](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40014816829) SUCCESS on prior code SHA f4a43d6 (15/15 Jest suites, 71/71 tests, ESLint/TS) including `region-recovery.test.ts` and `region-provider.test.tsx`. Final UI code SHA 77de0869 had [native CI 40015015192](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40015015192) pending when first documented; pilot [40015015190](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40015015190) SUCCESS; backend/parallel pending. Read latest HEAD/runs before declaring fully GREEN.

**Limits:** no phone/emulator or live-region payment, no localized retry strings. Server-side CartProvider in-flight region update race remains; persisting region may fail and revert after restart despite local UI selection. Other project blockers unchanged. Detail: `CURRENT_STATE.md` and `MASTER_HANDOFF.md` v22 §17 (these docs exist only on the authorized feature branch).

## 2026-10-23 — F07 actual Redis providers and A/B event activity

Përdoruesi autorizoi vazhdimin e F07 («vazhdo»). Në `feat/merchant-auth-boundary-ci` u regjistruan Medusa Redis session URL, event bus Redis, workflow-engine Redis, locking Redis; CI kërkon REDIS_URL dhe verifikon që BullMQ event queue shkruan në **dy instanca fizike** Redis 6379/6381 për bizneset A/B. `scripts/verify-redis-runtime.py` lexon vetëm keyspace metadata sintetike pa printuar emra çelësash/vlera. Nuk u shtuan dependencies/cache provider dhe nuk u prek main/deploy.

**Code SHA [ad7a86dc](https://github.com/titanfit102-bit/ShqipShop/commit/ad7a86dc82778fe1658c51152210298a03ece6be)**, **5/5 CI SUCCESS**: [parallel 40021073660](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073660) marker `SHQIPSHOP_REDIS_A_B_EVENT_BUS_RUNTIME_PASSED`, Redis A=17 keys (2 event, 4 workflow-named), Redis B=17 keys (2 event, 4 workflow-named); [two DB 40021073589](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073589); [Medusa smoke 40021073486](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073486) logs event/workflow/locking connection; [native 40021073350](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073350); [pilot 40021073534](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021073534).

**NOT YET CERTIFIED:** session cookie persisted through restart, worker/server split, retries/HA, locking under contention, Redis caching provider (not installed), TLS/ACL and production. F07 stays PARTIAL. Docs CURRENT_STATE and MASTER_HANDOFF §18 are the newest recovery point on this feature branch only, not main. Future code changes need new scope authorization.

## 2026-10-23 — F07b session transport between independent Medusa instances

Code [5cf17af](https://github.com/titanfit102-bit/ShqipShop/commit/5cf17af77d807ce57a7054358d447704ec12a307) shtoi testim cross-process të session cookies: serveri A:9000 krijon cookie customer/admin, një server i ri A:9002 me të njëjtat Redis/DB/secrets autentikon të dy pa JWT; cookie B refuzohet, pa cookie refuzohet. Testi përdor vetëm skedar përkohshëm 0600 dhe nuk printon kredencialet. [Parallel 40021889093](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40021889093) **SUCCESS**, marker `SHQIPSHOP_REDIS_SAME_MERCHANT_COOKIE_CROSS_PROCESS_PASSED`, edhe event Redis A/B marker PASS. Katër workflow-t e tjerë për të njëjtin SHA gjithashtu SUCCESS: two isolated 40021895454, Medusa 40021895280, native 40021895384, pilot 40021895506. **F07 PARTIAL**: nuk u testua Redis outage/restart, caching provider, worker retry ose prod; pa main/merge/deploy. Vazhdimësia: CURRENT_STATE dhe MASTER_HANDOFF §19 në feature branch.

