# SHQIPSHOP — MASTER HANDOFF (v22)

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

## Autorizim dhe implementim P0 — snapshot para verifikimit (historik)

Përdoruesi autorizoi shprehimisht: «po te autorizoj, vazhdo permirsimin sipas planit», në përgjigje të kërkesës për testet cookie/session, mutation authorization dhe maskimin e sekreteve CI. **Leja e kësaj faze** përfshin scripts/workflows të këtij increment-i në `feat/merchant-auth-boundary-ci`, testim sintetik dhe dokumentacion; **pa merge/deploy/main/pagesa reale**. Ky autorizim plotëson kufirin e mëparshëm docs-only, nuk e zgjeron te faza të tjera.

**Implementuar, jo ende provuar në Medusa runtime:** helper HTTP/assertions fail-closed + 3 teste Node; cookie/session customer/admin A/B, role separation, tampering dhe logout/replay; mutations customer/order/inventory me snapshot para/pas për të dy tenant-et; DELETE vetëm në customer fixture të dedikuar; maskim i sekreteve të gjeneruara në backend smoke. Workflow dy-Medusa tani aktivizohet edhe për ndryshime script-esh në PR dhe ekzekuton testet e helper-it. JWT pas logout raportohet veçmas dhe nuk quhet i revokuar.

**Lokalisht:** Node 24.19.0, `node --test medusa-backend-poc/scripts/boundary-http.test.mjs` **3/3 PASS**, syntax checks PASS; `compileall` PASS; pytest **10 PASS, 1 warning** nga Starlette/AnyIO deprecated alias. Medusa session/mutation proof **PENDING**, duhet lexuar CI në HEAD të ri përpara pretendimit të suksesit. G3 mbetet IN_PROGRESS.

**Next:** verifiko CI real; diagnostiko dështime pa hequr checks, pastaj ruaj SHA/run dhe rezultatin e konfirmuar. Plani i detajuar mbetet MASTER_HANDOFF §10. Kufijtë: browser HTTPS/CSRF/domain cookie scope, JWT revocation, RBAC i kufizuar mes adminëve, Redis/jobs/media/backup/production ende të paprovuara.

**Checkpoint:** 23 tetor 2026. **Status:** i konsoliduar nga v21 pas auditimit të GitHub. Lexo së pari [CURRENT_STATE.md](CURRENT_STATE.md), pastaj këtë dokument, [AGENTS.md](../AGENTS.md), [ROADMAP.md](ROADMAP.md), [PROJECT_HISTORY.md](PROJECT_HISTORY.md) dhe ADR-të përkatëse.

**Burimi i qëndrueshëm:** [titanfit102-bit/ShqipShop](https://github.com/titanfit102-bit/ShqipShop). **DEGA AUTORITATIVE E HANDOFF-IT TANI:** [feat/merchant-auth-boundary-ci](https://github.com/titanfit102-bit/ShqipShop/tree/feat/merchant-auth-boundary-ci), [PR #12 (Draft)](https://github.com/titanfit102-bit/ShqipShop/pull/12). **Nuk është në main.** Një chat i ri duhet të shohë degën/PR-në e saktë dhe të verifikojë live ndryshimet pas këtij checkpoint-i.

> **Ruajtja e historikut:** v21 ruhet e pandryshuar në [commit 3eab3c3, MASTER_HANDOFF.md](https://github.com/titanfit102-bit/ShqipShop/blob/3eab3c3fc0007c4b76aff9c51c80bae007290742/docs/MASTER_HANDOFF.md) dhe historia kronologjike vazhdon në [PROJECT_HISTORY.md](PROJECT_HISTORY.md). Ky v22 është sinteza e konsoliduar, jo fshirje e historikut: hollësitë dhe evidence të vjetra mbeten të rikuperueshme nga ai commit, git history dhe dokumentet specifike. Pasazhet e vjetra që thoshin «s'ka Android build/checkout/izolim» janë snapshot-e historike, **jo** gjendja e sotme.

## 1. Misioni, audienca, scope dhe kërkesat e përdoruesit

**Produkt final i synuar (PLAN, JO I NDËRTUAR):** platformë shqiptare white-label ecommerce SaaS: operatori ShqipShop krijon/mirëmban shumë dyqane të pavarura; çdo tregtar ka markën, URL/domain, vitrinën web/PWA, panelin, katalogun, çmimet, stokun, klientët, porositë, transportin dhe (kur justifikohet) aplikacionin e vet Android/iOS. Klienti final blen në shqip, me adresë lokale, çmim të saktë dhe status të porosisë. Operatorit i nevojiten onboarding, plan/abonim, support, observability, backup dhe kontroll sigurie. Kandidatë fillestarë për validim janë biznese që sot shesin përmes rrjeteve sociale; kërkesa e tyre për të paguar nuk është verifikuar.

**Kufij të konfirmuar:**
- ShqipShop **NUK** është alternativë Play Store, APK installer, APK catalog ose marketplace multi-vendor i përbashkët. Ideja u refuzua; shih [ADR-004](ADR-004_APK_CATALOG_IDEA.md).
- **Çdo biznes** duhet të jetë i izoluar server-side: jo vetëm filtra në frontend ose publishable keys. Branding dhe endpoints konfigurohen për çdo tenant. Mos bashko me projekte të tjera.
- Preferencë për origjinalin [bloomsynth/medusa-mobile-react-native](https://github.com/bloomsynth/medusa-mobile-react-native) (MIT; ruaj licencat/notice). Aplikacionet native janë opsionale për paketat që justifikojnë koston dhe janë subjekt i review Apple/Google.
- **PWA-first për pilotë**; native kur ka provë vlere. Një **commerce source of truth** i vetëm për çmime, inventar dhe porosi mes PWA dhe native; mos ruaj dy sisteme realisht të ndara me sinkronizim të pasigurt.
- Shqipëri/sq-AL; ALL dhe mundësi të ardhshme EUR. Kur monedha reale është ALL: çmimi kryesor «1.500 lekë» dhe dytësor i vogël/gri «(≈ €15,00 · orientuese)» nëse kursi është valid. Shembulli 100 ALL/EUR është **sintetik CI, jo FX aktual**; «lekë» i referohet ALL/lekëve të reja. Zgjedhja dhe pagesa reale ALL/EUR janë punë më vete.
- COD dhe dorëzim lokal si rrugë pilot, PSP vetëm pas sandbox/kontratës/webhooks. Tarifat 29€/79€ në dokumentet e hershme janë **hipoteza**, jo ofertë e validuar ose sistem billing.

## 2. Vendime arkitekturore dhe arsyet

- [ARCHITECTURE / ADR-001](ARCHITECTURE.md): PWA-first për testim biznesi, pa detyrim app-store dhe pa kosto të panevojshme.
- [ADR-002](ARCHITECTURE.md): FastAPI/SQLite multi-shop është **pilot i ndërtuar**, jo backend production i përzgjedhur.
- [ADR-003](ADR-003_MEDUSA_NATIVE_VS_CUSTOM_PILOT.md): Medusa Mobile React Native është kandidati kryesor për native; provo integrimin real në vend të rishkrimit të pakontrolluar. Source-of-truth final ende kërkon vendim migrimi.
- [ADR-004](ADR-004_APK_CATALOG_IDEA.md): katalogu/installuesi i APK-ve është **i refuzuar**.
- [ADR-005](DUAL_CURRENCY_POLICY.md): dallim strikt midis monedhës së pagesës dhe ekuivalentit orientues të kontrolluar për datë, burim dhe vlefshmëri; kurs sintetik vetëm për testim.
- [ADR-006](ADR-006_TENANT_BACKEND_ISOLATION.md): model provizor për 3–5 pilotët: Medusa instance + PostgreSQL DB/role të veçanta për çdo tregtar, izolim i admin/auth/Redis/workers/media/secrets dhe control plane minimal pa porosi/PII në rrjedhën normale. Arsye: [PR #9 / run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016) provoi që dy sales-channel publishable keys brenda **një Medusa shared** merrnin të njëjtën porosi me ID (HTTP 200/200). Nuk është pretendim për cenueshmëri universale të Medusa, por provë që shared sales channels nuk bëjnë tenant authorization.
- Serveri i pavarur për çdo tenant sjell **kosto operative**. Para shkallëzimit duhen prova dhe analiza për 5/50/500 dyqane, jo supozim se ky model është ekonomik për qindra klientë.

## 3. Teknologjitë dhe arkitektura e implementuar (FAKT)

**Pilot web i pavarur:** app/main.py, app/services.py, app/db.py; FastAPI + SQLite, templates/ + static/, pilot PWA/storefront dhe panel admin/CSRF/session; 3 dyqane sintetike, porosi COD/idempotency/stok të llogaritura server-side; tests/ me 10 pytest të kaluara në CI. Ky pilot **nuk** është i lidhur si një frontend i prodhimit me backend-in Medusa dhe nuk duhet trajtuar si sistemi final i porosive.

**Native:** native-medusa/ është kodi origjinal Medusa Mobile React Native i importuar me lokalizim sq-AL, teste JS/Jest, Android build/emulator, katalog/cart/checkout/receipt të lidhur realisht me Medusa development API në CI. mobile-medusa/ është paketë e hershme lokalizimi, jo app i dytë në prodhim.

**Backend commerce:** medusa-backend-poc/ — Medusa v2 2.22.0, PostgreSQL 16, demo Albania region/ALL, produktet/variantet/shipping, Store API cart → shipping → payment manual sintetike → order 1.510 ALL dhe rezervim stoku. CI përdor Node 24 / pnpm pinned dhe fixtures sintetike. Kodet e testimit të izolimit ndodhen në medusa-backend-poc/scripts/ dhe .github/workflows/. Të gjitha këto janë development/ephemeral, jo deployment i një platforme live.

**Izolimi i provuar aktual:** secili prej dy backend-eve Medusa mund të punojë njëkohësisht me PostgreSQL DB dhe role të ndara, çelësa, porosi, customer/admin JWT dhe JWT/cookie **secrets** të ndara. Rezultatet negative të porosive dhe token-eve janë GREEN në CI. Dy serverë Redis janë të arritshëm, por config aktual medusa-config.ts **nuk provon që provider-et Redis / event queues janë lidhur dhe izoluar**. Sesionet reale cookie dhe mutations e kufizuara u verifikuan në checkpoint-in P0 më sipër; kufijtë e tjerë mbeten të hapur.

**Arkitekturë e synuar (PLAN):** një control plane ShqipShop (tenant registry, branding, domain, provisioning, billing plan, version/deployment, observability) i ndarë nga commerce data; për çdo merchant backend Medusa, databazë, IAM dhe storage të izoluara; PWA dhe opsionalisht app-i native lexojnë të njëjtin backend të atij tregtari. Provisioner, billing, domain routing, izolim storage dhe native apps për shumë tregtarë nuk janë implementuar.

## 4. PR-të, varësitë dhe provat e verifikuara

Të gjitha PR-të #1–#12 janë **OPEN Draft / jo merged**, sipas kontrollit të GitHub më 23 tetor. PR-të #1→#8 janë një zinxhir; **#9 dhe #10 janë degë motra mbi #8** (testi diagnostik i #9 nuk duhet hequr ose fshehur). #11 është mbi #10, #12 mbi #11. main mbetet commit fillestar 329e0381b0bc4ce39cf554a2b2888a047e1dd29e.

| PR | Përmbajtja dhe prova |
| --- | --- |
| [#1](https://github.com/titanfit102-bit/ShqipShop/pull/1) | FastAPI PWA/COD/tenant pilot me 10 pytest, p.sh. [run 39822589301](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39822589301). |
| [#2](https://github.com/titanfit102-bit/ShqipShop/pull/2) | Import origjinal Medusa RN, MIT notices, sq-AL, teste JS. |
| [#3](https://github.com/titanfit102-bit/ShqipShop/pull/3) | Backend Medusa 2.22, Postgres/Redis demo, produktet/ALL, checkout me porosi në DB. [Run 39839755263](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39839755263). |
| [#4](https://github.com/titanfit102-bit/ShqipShop/pull/4) | APK/emulator Android API 35 install/launch + katalog live Medusa; [runs 39842340691](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842340691), [39845817408](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408). |
| [#5](https://github.com/titanfit102-bit/ShqipShop/pull/5) | UI Android → cart persisted Postgres; [run 39867727695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695). |
| [#6](https://github.com/titanfit102-bit/ShqipShop/pull/6) | Shfaqje çmimi ALL/EUR orientuese, jo pagesë në EUR; [run 39931562458](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39931562458). |
| [#7](https://github.com/titanfit102-bit/ShqipShop/pull/7) | Android UI → adresë/transport/manual payment → porosi në PostgreSQL; [run 39934984130](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130). |
| [#8](https://github.com/titanfit102-bit/ShqipShop/pull/8) | Receipt: nëntotali 1.500 ALL + transporti 10 ALL = 1.510 ALL; FX hint sintetik «≈ €15,10». [Run 39946022933](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933), screenshot artifact 12499331067. Navbar title ende tepër i vogël. |
| [#9](https://github.com/titanfit102-bit/ShqipShop/pull/9) | Diagnostik **qëllimisht RED**: dy keys sales-channel lexojnë një porosi (HTTP 200/200). [Run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016). Mos e quaj një regres të rastësishëm ose fshi kontrollin. |
| [#10](https://github.com/titanfit102-bit/ShqipShop/pull/10) | Dy databaza PostgreSQL/role të ndara dhe Medusa **sekuenciale**, cross-order HTTP 404; [run 39948690213](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39948690213) GREEN, SHA 3359f0c. |
| [#11](https://github.com/titanfit102-bit/ShqipShop/pull/11) | Dy serverë Medusa **aktivë paralelisht**; dy checkout-e sintetike, cross-order 404 dhe key i huaj 400; [run 39979050578](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39979050578) GREEN, SHA dafb668. Checkout-et nuk janë dy transaksione që ekzekutohen paralelisht nën load. |
| [#12](https://github.com/titanfit102-bit/ShqipShop/pull/12) | Dy admin/customer identities dhe JWT secrets të ndara; foreign credentials/JWT refuzohen; HEAD i **kodit të testuar** 3eab3c3fc0007c4b76aff9c51c80bae007290742. [Run 39981336521](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336521), [39981336483](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336483) dhe [39981336440](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336440): **3/3 GREEN**, kontrolluar edhe nga log-et auth. |

**Rregull evidence:** progresi i testuar lidhet me një SHA dhe run konkret. Commit-et pas atij SHA (p.sh. vetëm dokumentacioni) kërkojnë verifikim të ri të HEAD-it; jo çdo GREEN e vjetër vlen për çdo HEAD të ardhshëm. PR #12, #11 e #10 janë Draft: asgjë nuk është bashkuar në main, asgjë nuk është deploy-uar në prodhim.

## 5. Gjendja e gates G0–G8 dhe mangësitë

Shih [ROADMAP.md](ROADMAP.md) për kriteret e daljes të secilës fazë.

| Gate | Gjendja e bazuar te prova |
| --- | --- |
| G0 · Repo/CI bazë | CI i pilotit kalon, por release baseline në main ende nuk ekziston. |
| G1 · PWA pilot/UX/security | Kod + unit/integration demo; browser E2E dhe përdorim real të paplotësuar. |
| G2 · Native feasibility | Android build/emulator, katalog, cart, receipt, checkout development **të provuara**; jo app store signing/real device production. |
| G3 · Commerce & tenant isolation | **NË PROGRES:** PostgreSQL/Medusa dy tregtarë dhe order/customer/admin JWT boundary testet kalojnë; ende jo siguri e plotë, Redis queues, media, session cookies, mutations, recovery, source-of-truth unifikim. |
| G4 · Managed tenants | Onboarding/branding/domain/plan/provisioner i plotë mungon. |
| G5 · Payments/delivery/privacy | Vetëm pagesë manuale sintetike dhe transport demo; real PSP/COD reconciliation/GDPR mungojnë. |
| G6 · Production QA | Nuk ka prod TLS, secret manager, audit/backup+restore, load/security/release verifikim. |
| G7 · Business validation | Nuk janë provuar 3–5 pilotë realë dhe willingness-to-pay. |
| G8 · Native rollout | Vetëm APK debug/proof; jo publikim real i app-eve merchant në store. |

**Mos shpik përqindje** pa peshim të gates. Dallo: implementuar, testuar në CI, testuar në pajisje, deploy-uar, përdorur nga klientë realë dhe monetizuar.

## 6. Probleme, siguri dhe pasiguri

- **Siguria:** cross-tenant cookie/sesione, logout/replay, admin/customer ID tampering, mutation/refund/inventory/customer authorization, role/RBAC, Redis integration/job/cache leaks, media, webhook signatures, queue failure recovery, backups/restore, audit logs, rate limiting, abuse handling — të pakonfirmuara.
- **Dev/prod:** secrets sintetike në CI; pa rotation/manager prod, TLS, observability, isolation cost, zero-downtime, load tests apo databaza tenant production.
- **Modeli i biznesit:** çmimet/abonimet hipotetike, kostot 5/50/500 pa llogari të validuara, klientë pilotë dhe payment providers realë ende mungojnë.
- **Mobile:** React Native dependency advisories të hapura për audit; ende problem tipografie Navbar «Detajet e porosisë» dhe pa prova release-store/device reale.
- **Produkti:** FastAPI/SQLite dhe Medusa/Postgres janë dy POC të ndara; zgjedhja e production commerce source-of-truth/migrimi PWA nuk është implementuar.
- **Shënime historike stale:** seksionet e vjetra të README, ROADMAP, AGENTS dhe dokumenteve POC përshkruajnë gjendjen e dikurshme. Mos i përdor si prova kundër testimeve më të reja.
- **Informacion i parikuperuar:** jo transkripte të plota të çdo chat-i, jo të gjithë screenshot-et e vjetra të rishikuara në këtë seancë, as setup i prodhimit, as analytics/kërkesë tregu jashtë evidencës së dokumentuar. Nuk u inspektuan personalisht të gjitha transaksionet në celularë fizikë. Mos plotëso boshllëqet me supozime.

## 7. Plan ekzekutimi deri te produkti përfundimtar

**P0 — gate sigurie i radhës (SHUMË I RËNDËSISHËM):** me teste sintetike të ndara, provo cookie/session e Medusa-s, mbijetesë/token invalidation, unauthorized GET/POST/PATCH/DELETE për order/customer/inventory/admin, cross-merchant headers/domain/config spoofing dhe RBAC. Mos i testoni sesionet «cookie» duke provuar vetëm JWT. Ruaj log-et dhe endpoint-et me rezultatet konkrete. Kjo kërkon **autorizim specifik për kodin** nëse nuk është dhënë.

**P1 — siguri operacionale:** inspekto regjistrimin real të Medusa Redis modules/providers, kryej prova cache/queue/event/worker të ndara, order/inventory concurrency stress, secrets handling, backups/restores të një tenant-i pa rrjedhje në tjetrin, dhe analyze 5/50/500 tenant cost.

**P2 — SaaS dhe commerce i unifikuar:** vendos ADR final për Medusa si source-of-truth kundrejt migrimit të FastAPI pilot; përmirëso PWA që përdor backend-in e tregtarit, implemento tenant registry/control plane të kufizuar, provisioning idempotent, onboarding, brand/domain config, merchant panel dhe plan/billing sandbox.

**P3 — klienti dhe operacionet e vërteta:** COD operational, payment PSP sandbox/settlement, ALL/EUR FX real me data freshness, logistics, GDPR/privacy/law review, accessible mobile UX, perf/load/device and security QA, 3–5 pilotë realë me marrëveshje dhe matje, rollout staged, opsionalisht app-e native të nënshkruara/publikuara sipas politikave për secilin merchant.

**Next atomic technical step, as of the original v22 checkpoint (superseded by P0 above):** pasi të lexosh CI të PR #12, projekto testin negativ cookie/session dhe mutation authorization me Medusa A/B në CI. Regjistro kriteret e pranimit përpara ndryshimit të kodit.

## 8. MASTER CONTINUITY PROTOCOL — mekanizëm i detyrueshëm

**Dy nivele:**
1. [CURRENT_STATE.md](CURRENT_STATE.md) — i shkurtër, autoritativ për gjendjen e fundit, degën/PR/SHA, CI, bllokimet, hapin vijues dhe autorizimet.
2. Ky MASTER_HANDOFF — konteksti i konsoliduar i plotë. Historia kronologjike te [PROJECT_HISTORY.md](PROJECT_HISTORY.md), vendimet te ADR-të, fazat te [ROADMAP.md](ROADMAP.md). Mos dubliko v21.

**Në çdo bisedë të re:** hap [repository ShqipShop](https://github.com/titanfit102-bit/ShqipShop), **kontrollo PR #12 dhe degën feat/merchant-auth-boundary-ci**, lexo CURRENT_STATE → MASTER_HANDOFF → AGENTS → ROADMAP/ADR; më pas verifiko live main, branch heads, varësinë e PR-ve, CI SHA/logs/diff dhe ndryshimet pas checkpoint-it. Rikthe detyrën e fundit pa nisur nga zero. Mos supozo qasje të plotë në chat-e të tjera.

**Pas çdo ndryshimi material të verifikuar:** ndrysho vetëm rubrikën përkatëse në CURRENT_STATE dhe MASTER; përditëso HISTORY/ROADMAP/AGENTS vetëm kur ka ndryshim kronologjik, gate/decision ose procesi. Së pari ekzekuto testet e përshtatshme, pastaj ruaj rezultatin me SHA/URL dhe kriteret e papërfunduara. Pas çdo ruajtjeje kontrollo në GitHub ref/commit përmbajtjen dhe diff-in. Në rast gabimi shëno gjendjen dhe mos shpall sukses. Mos e quaj të përfunduar një test që është pending, cancelled ose failed.

**Autorizimi i dokumentacionit (2026-10-23):** përdoruesi miratoi vetëm degën feat/merchant-auth-boundary-ci dhe skedarët docs/CURRENT_STATE.md, docs/MASTER_HANDOFF.md, docs/PROJECT_HISTORY.md, docs/ROADMAP.md, AGENTS.md për krijim/update inicial dhe mirëmbajtje të vazhdueshme pas çdo ndryshimi të verifikuar. **Ky autorizim nuk transferohet automatikisht në degë të tjera dhe nuk autorizon ndryshimin e kodit, merge, deploy, pagesa reale apo prod.** Për veprime jashtë scope-it kërko leje përkatëse. Dokumentacioni nuk azhurnohet vetë kur biseda është e mbyllur; rifillimi duhet të kontrollojë ndryshimet jashtë seancës.

**Rreziku i mobilitetit ndërmjet degëve:** handoff-i **nuk është në main**, është në degën e PR #12. Nëse zhvillimi vazhdon në PR #13 ose degë tjetër, vazhdo ta azhurnosh checkpoint-in në degën e autorizuar me referencat e reja, në masën që mbetet e aksesueshme. **Propozim i sigurt, jo i autorizuar ende:** degë dedikuar docs/continuity me Draft PR dhe pikë hyrjeje të identifikueshme, ose promovim dokumentacioni minimal në main me review të veçantë. Kërkon leje të re për atë degë/destinacion; **mos krijo/mos prek degë tjetër** për protokollin pa autorizim.

**Linku i hyrjes së shpejtë:** https://github.com/titanfit102-bit/ShqipShop/blob/feat/merchant-auth-boundary-ci/docs/CURRENT_STATE.md

## 9. Politika e raportimit dhe sigurisë

Në fund të çdo pune: **(1) çfarë u përfundua; (2) çfarë mbetet; (3) hapi i ardhshëm; (4) handoff: përditësuar/i pandryshuar/ruajtja dështoi.** Ruaj vendimet si të konfirmuara, planet si të propozuara, supozimet si hipoteza dhe evidencën si verifikim konkret. Mos ndaj secrets/PII; jo force push, jo fshirje historie, jo merge në main ose deploy pa autorizim. Respekto license MIT/upstream dhe projektet e tjera të pavarura.

## Rikuperim live — 2026-10-23, pas protokollit v22

- **HEAD i inspektuar:** `b3f759a2e363b70664ce74e17ef742964e6e6922`. Krahasimi nga code SHA `3eab3c3` përmban **vetëm** AGENTS.md, CURRENT_STATE, MASTER_HANDOFF, PROJECT_HISTORY dhe ROADMAP; asnjë ndryshim kodi.
- **CI në këtë HEAD:** [parallel/auth 39985437241](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39985437241), [Medusa smoke 39985437127](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39985437127), [pilot 39985437135](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39985437135): **3/3 SUCCESS**, job steps dhe log-et u lexuan. Pilot: **10 passed**; Medusa: porosi PostgreSQL dhe rezervim +1 me stok fizik të pandryshuar; dy-backend: marker-at order boundary A/B dhe admin/customer JWT isolation.
- **PR #1–#12:** ende OPEN Draft; #12 bazohet në #11, #11 në #10; #9 dhe #10 janë degë motra mbi #8. `main` mbetet `329e0381b0bc4ce39cf554a2b2888a047e1dd29e`.
- **Gjetje e re e verifikuar:** log-u i backend smoke shfaq vlera JWT_SECRET/COOKIE_SECRET të gjeneruara për runner-in, pa maskim; workflow i shkruan në GITHUB_ENV pa add-mask. Janë sekrete CI të përkohshme, jo provë ekspozimi kredencialesh production. **Mos kopjo vlerat** në docs/raporte. Korrigjimi i workflow-t kërkon leje kodi.
- **Gjendja:** G3 IN_PROGRESS. Analiza dhe kriteret më poshtë janë përgatitur; **testet e reja nuk janë implementuar/ekzekutuar**. Autorizimi i konfirmuar mbulon vetëm pesë dokumentet në këtë degë. Hapi teknik pret leje të shprehur për scripts/workflow; nuk është dështim i testit.

## 10. Hapi pasues i përgatitur — cookie/session dhe negative mutations

**Status historik i planit: i implementuar dhe i verifikuar në checkpoint-in P0 më sipër.** Kriteret rrjedhin nga P0 ekzistues dhe ADR-006; nuk shtojnë veçori produkti. Ekzekutim i synuar: inline, me fixtures sintetike, dy serverët ekzistues dhe pa varësi të reja. Para kodit duhet autorizim specifik për scripts/workflow në këtë degë; jo merge/deploy/main.

**Burim primar i inspektuar:** Medusa tag [v2.22.0 session route](https://github.com/medusajs/medusa/blob/v2.22.0/packages/medusa/src/api/auth/session/route.ts), [auth middleware routes](https://github.com/medusajs/medusa/blob/v2.22.0/packages/medusa/src/api/auth/middlewares.ts) dhe [authenticate middleware](https://github.com/medusajs/medusa/blob/v2.22.0/packages/core/framework/src/http/middlewares/authenticate-middleware.ts). POST /auth/session merr bearer dhe ruan auth_context; DELETE përdor session auth dhe shkatërron sesionin. **Inferencë nga kodi, jo provë runtime:** logout cookie nuk është vetvetiu revokim JWT. JWT replay dhe session replay duhen raportuar veçmas; mos vendos kriter të rremë që çdo bearer duhet të skadojë pas DELETE /auth/session.

**Skedarët e propozuar, ende të pamodifikuar:** zgjerim i `medusa-backend-poc/scripts/parallel-auth-boundary.mjs` për request/cookies/identitete dhe kontrollet session; script i fokusuar `medusa-backend-poc/scripts/parallel-mutation-boundary.mjs` vetëm nëse ndarja e përgjegjësive justifikohet; lidhje e tyre në `.github/workflows/parallel-medusa-isolation-ci.yml`; maskimi i sekreteve ephemeral në `.github/workflows/medusa-backend-smoke.yml`. Mos ndrysho Medusa core, lockfiles ose native UI në këtë hap.

### Detyra 1 — sesione reale A/B, customer/admin

- [ ] Zgjero request helper-in ekzistues me cookie input dhe Set-Cookie output në memorie, pa log token/cookie/body. Inputet mbeten localhost :9000/:9001, CI=true dhe NODE_ENV=development.
- [ ] Për customer dhe admin të secilit tenant: login JWT → POST /auth/session → ruaj cookie-n → GET profili **vetëm me cookie**, pa Authorization. Kërko HTTP 200 dhe actor ID të saktë.
- [ ] Cookie A në B dhe B në A; cookie e manipuluar; customer cookie në Admin API dhe admin cookie në customer profile: HTTP 401/403; pa cookie: HTTP 401/403. Përdor publishable key korrekt të serverit target që gabimi i key-t të mos maskojë testin e sesionit.
- [ ] DELETE /auth/session me cookie: HTTP 200, success=true, Set-Cookie për pastrim; replay i cookie-t origjinal duhet të japë HTTP 401/403. Krijo sesion të ri dhe verifiko që logout A nuk çaktivizon sesionin B.
- [ ] Provo bearer-in origjinal pas logout dhe regjistro vetëm statusin; kjo mat kontratën aktuale JWT, jo revokim të implementuar. Nëse bearer mbetet valid, dokumento gap-in e revokimit sipas kërkesave production.
- [ ] Cookie jar duhet menaxhuar shprehimisht: Node fetch nuk siguron jar automatik. Dy porta në 127.0.0.1 **nuk provojnë izolim cookie sipas domain-it të browser-it**; Secure/SameSite/HttpOnly, CORS/CSRF dhe HTTPS kërkojnë gate browser të veçantë.

### Detyra 2 — kërkesat që ndryshojnë të dhënat

Rrugët POST më poshtë janë lexuar në source v2.22.0; mos shpik PATCH/PUT ose endpoint që s'ekziston. Krijo fixtures sintetike dhe merr IDs përmes API-ve të tenant-it të vet.

| Kontrolli | Kriteri |
| --- | --- |
| POST /store/customers/me, first_name sintetike | Customer i vet: 200 + actor ID/vlerë korrekte; pa auth, foreign JWT/cookie: 401/403. |
| POST /admin/customers/{id}, first_name | Admin i vet: 200 dhe lexim pasues; pa auth, customer actor, foreign admin JWT/cookie: 401/403. |
| POST /admin/orders/{id}, metadata marker | Kontroll pozitiv me admin të vet; të njëjtat negative 401/403, pa ndryshim të order ID/currency/total/metadata në tenant-et A/B. |
| POST /admin/inventory-items/{id}, title | Kontroll pozitiv me admin të vet; negative 401/403 dhe verifikim se stock/reservations/title nuk ndryshuan. |
| ID i B dërguar në backend A me admin valid A | Asnjë objekt i B i kthyer/modifikuar; për customer/order/inventory GET/POST kërko 404 sipas rrugës së konfirmuar dhe lexo sërish objektin B. Çdo rezultat tjetër është finding, jo sukses i supozuar. |
| DELETE /admin/customers/{id} | Vetëm fixture sintetike e dedikuar për fshirje dhe kontroll pozitiv; pa auth/customer/foreign admin JWT ose cookie refuzohet 401/403 dhe fixture ekziston ende. |

- [ ] Për çdo negative përdor payload të vlefshëm dhe ID ekzistuese në serverin target; HTTP 400/404 nga validimi/rruga e gabuar **nuk vërteton** refuzim autentikimi.
- [ ] Ruaj snapshot para/pas për objektet A/B përmes leximit me admin të vet dhe verifiko mungesë side effects; mos u mbështet vetëm në status HTTP.
- [ ] ID spoofing në customer body/query/header nuk duhet të ndryshojë actor-in server-side; pranimi/refuzimi i fushës shtesë raportohet veçmas nga prova se objekti i tjetrit mbeti i paprekur.
- [ ] Admin/customer role separation **nuk është** provë RBAC me role të kufizuara mes administratorëve. RBAC i tillë mbetet i hapur; refund/cancel, media, Redis/jobs dhe load nuk certifikohen nga ky increment.

### Detyra 3 — CI dhe evidenca

- [ ] Për sekretet CI të gjeneruara, regjistro add-mask përpara eksportimit në GITHUB_ENV; mos printo token/cookie/PII dhe mos ngarko jar/response objects në artifacts.
- [ ] `node --check medusa-backend-poc/scripts/parallel-auth-boundary.mjs` (dhe script-in e ri nëse krijohet), pastaj workflow ekzistues dy-Medusa me të dy serverët aktivë; endpoint-et e paarritshme/5xx janë FAIL, jo auth denied.
- [ ] Kërko marker-a të veçantë për own-cookie, cross-cookie denial, logout replay denial dhe negative mutation side-effects; një marker total vetëm pas kalimit të të dy drejtimeve A↔B.
- [ ] Përdor kontroll pozitiv dhe prove të kontrolluar se heqja e një assertion-i/refuzimi zbulohet nga testi; mos dobëso kontrollet për ta bërë CI green.
- [ ] Kontrollo backend smoke + pilot regression në SHA e re. Mos riekzekuto Android build për ndryshime vetëm testesh backend; native proof mbetet historik dhe i lidhur me SHA/run e vet.
- [ ] Lexo job logs të redaktuara, diff dhe branch HEAD; përditëso CURRENT_STATE/MASTER/HISTORY me SHA/run/rezultatet reale. Nëse cookie/logout dështon, ruaj finding-un dhe mos anashkalo kontrollin.

**Pranim i këtij increment-i:** vetëm nëse session/mutation kontrolli dhe regresionet kalojnë në SHA e re; G3 prapë mbetet IN_PROGRESS për Redis/providers, browser security, RBAC, media, backup/restore dhe production.


## 11. Analizë P1 — Redis dhe JWT (2026-10-23, READ-ONLY për kodin)

**Bazë e inspektuar:** ShqipShop `e5657c6ddfa79d5cba004868b8ac6ba800263cd1`, PR #12 ende OPEN Draft mbi PR #11. CI i këtij HEAD-i: [pilot 39990409987](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990409987), [parallel 39990410102](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990410102), [Medusa smoke 39990410033](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990410033): **3/3 SUCCESS**. Parallel job 120540397758 u lexua; konfirmoi sërish cookie/session dhe mutation markers. Kodi nuk ndryshoi gjatë këtij auditimi.

### Gjetje të verifikuara nga kodi dhe log-et

1. Konfigurimi i ShqipShop nuk vendos `projectConfig.redisUrl`, modules Redis, jwtExpiresIn ose sessionOptions. Workflow vendos REDIS_URL të ndryshme për A/B, por kjo nuk është lidhja e provider-ëve.
2. Medusa tag v2.22.0, commit upstream `205aff40bacfa0049e0b9d3a7913a674738bff31`, [define-config.ts](https://github.com/medusajs/medusa/blob/205aff40bacfa0049e0b9d3a7913a674738bff31/packages/core/utils/src/common/define-config.ts) zgjedh `defaultModules` në rrugën jo-cloud. Aktivizimi automatik REDIS_URL që shfaqet në këtë skedar lidhet me `cloudModules` / EXECUTION_CONTEXT=medusa-cloud; nuk duhet keqpërdorur ai kontekst për të aktivizuar Redis në ShqipShop. [Module mapping](https://github.com/medusajs/medusa/blob/205aff40bacfa0049e0b9d3a7913a674738bff31/packages/core/utils/src/modules-sdk/definition.ts) tregon default cache-inmemory, event-bus-local dhe workflow-engine-inmemory; locking ka default in-memory.
3. Kjo përputhet me log-un real [39990410102](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990410102): «redisUrl not found. A fake redis instance will be used», «Local Event Bus installed» dhe «Locking module: Using in-memory as default». **Përfundim:** PING në dy Redis servers nuk ka provuar cache/event/jobs/session storage Redis; rruga aktuale mbetet lokale sipas konfigurimit. Nuk u krye një runtime dump i resolved container ose inspektim Redis keys në këtë audit.
4. [express-loader.ts](https://github.com/medusajs/medusa/blob/205aff40bacfa0049e0b9d3a7913a674738bff31/packages/core/framework/src/http/express-loader.ts) vendos Redis session store vetëm kur ka projectConfig.redisUrl, përndryshe pa store custom bie te default i express-session (memory). Default cookie maxAge është 10 orë; në development secure=false/sameSite=false, në production/staging secure=true/sameSite=lax në source. **Këto janë defaults nga burimi, jo test browser-i production.** Testet e cookie-ve të kaluara nuk provojnë persistence pas restart-it ose funksionim në disa procese.
5. `workflow-engine-inmemory` nuk duhet përkthyer si «asnjë persistencë databaze»: [storage](https://github.com/medusajs/medusa/blob/205aff40bacfa0049e0b9d3a7913a674738bff31/packages/modules/workflow-engine-inmemory/src/utils/workflow-orchestrator-storage.ts) ka edhe workflowExecutionService/upsert. Çfarë nuk kemi provuar është orchestrator/queues të mbështetura te Redis, retry/recovery ndërmjet proceseve dhe izolimi i jobs.
6. [ConfigManager](https://github.com/medusajs/medusa/blob/205aff40bacfa0049e0b9d3a7913a674738bff31/packages/core/framework/src/config/config.ts) vendos jwtExpiresIn=1d dhe ia kalon jwtOptions; [JWT generation](https://github.com/medusajs/medusa/blob/205aff40bacfa0049e0b9d3a7913a674738bff31/packages/core/utils/src/auth/token.ts) kërkon secret + expiry. ShqipShop s'e mbivendos këtë. **Afati i pritur nga source: 24h**, por exp-iat i token-eve reale dhe skadimi në runtime ende nuk janë matur në suite.
7. Logout cookie shkatërron sesionin, jo bearer-in (4/4 replay HTTP 200 i provuar në increment-in P0). [Refresh route](https://github.com/medusajs/medusa/blob/205aff40bacfa0049e0b9d3a7913a674738bff31/packages/medusa/src/api/auth/token/refresh/route.ts) lejon reissue për context të autentikuar dhe identity ekzistuese. **Inferencë që kërkon test:** bearer ende valid mund të rifreskohet pas cookie logout; kufizimi TTL vetëm nuk është logout global/revokim. Nuk u testuan në këtë audit refresh-after-logout, password change, account disable ose JWT expiration.

**Ndikimi:** konfigurimi është i përshtatshëm si POC lokal i testuar, por provat e deri sot nuk mjaftojnë për shared workers, persistent sessions ose tenant operations production. G3 mbetet IN_PROGRESS. Mos e quaj këtë zbulim rrjedhje të provuar cross-tenant; është boshllëk konfigurimi dhe evidence.

### Hapi i propozuar P1a — kërkon autorizim kodi përpara implementimit

**Qëllimi i kufizuar:** lidhje eksplicite Redis për sessions/cache/event-bus/workflow-engine/locking në dy instancat sintetike dhe verifikim që secila përdor Redis-in e vet. Ruaj DB/roles/JWT/cookie secrets të ndara. Pa main, merge/deploy, shpenzime, production data ose ndryshim politike JWT në këtë increment.

**Skedarët e synuar:** `medusa-backend-poc/apps/backend/medusa-config.ts`; `.github/workflows/parallel-medusa-isolation-ci.yml`; skripte CI të fokusuara nën `medusa-backend-poc/scripts/` dhe, vetëm nëse nevojitet për provë event/retry, fixture subscriber/workflow nën backend që aktivizohet vetëm në testin sintetik. Kontrollo nested AGENTS dhe paketat pinned 2.22.0 përpara kodit; pa ndryshim lockfile/dependencies nëse provider-ët re-exported ekzistojnë.

**Kontrata teknike për t'u respektuar:** projectConfig.redisUrl është e ndarë nga options e secilit modul; konfigurimi vetëm i njërës nuk provon të tjerat. Provider-ët duhet regjistruar eksplicit nga exports zyrtare të 2.22.0, pa ndryshuar EXECUTION_CONTEXT në medusa-cloud. [Workflow Redis loader](https://github.com/medusajs/medusa/blob/205aff40bacfa0049e0b9d3a7913a674738bff31/packages/modules/workflow-engine-redis/src/loaders/redis.ts) kërkon `options.redis.redisUrl`; `redis.url` është deprecated. Për cache, dallo legacy cache nga caching provider modern; mos migro cache API në heshtje.

**Kriteret e pranimit (ende NOT IMPLEMENTED / NOT RUN):**
- Runtime assertion për resolved module bindings dhe projectConfig.redisUrl; regjistro vetëm identitetin e provider-it, kurrë URL kredencialesh. Mungesa e modulit ose fallback lokal duhet të bëjë FAIL, jo vetëm kontroll teksti në log.
- Përmes shërbimit real Medusa shkruaj cache sentinel A/B me të njëjtin logical key dhe vlera të ndryshme; lexo vlerën përkatëse dhe verifiko backend Redis përkatës. PING ose SET/GET i drejtpërdrejtë jashtë Medusa-s s'mjafton.
- Emit event sintetik me correlation ID unik, prit subscriber-in real vetëm brenda tenant-it; provo A→B/B→A denial dhe retry të kontrolluar pa dyfishim të side effect-it. Nëse testohet vetëm event bus, mos certifiko workflow queue/scheduler.
- Provo një workflow async/retry që kalon realisht në workflow-engine Redis; ndal/restart kontrolluar worker-in dhe verifiko recovery brenda të njëjtit tenant. Mos dedukto job recovery vetëm nga event subscriber.
- Krijo sesion cookie real, restart vetëm Medusa A duke ruajtur Redis A, verifiko që sesioni i A mbetet funksional dhe B s'ndikohet; pas DELETE/logout, cookie origjinale mbetet e refuzuar. Secret-et duhet të ruhen gjatë restart-it të fixture-it, pa u printuar.
- Provo kontendim në locking service: dy contenders brenda A nuk e zotërojnë lock-un njëkohësisht; i njëjti logical lock key në B nuk bllokohet nga A. Kjo provon konfigurimin e shërbimit, jo të gjitha race conditions commerce.
- Pas këtyre, checkout/order/inventory smoke, cookie/mutation suite dhe pilot pytest duhet të mbeten GREEN në SHA e re. Security failures/5xx/Redis unreachable nuk pranohen si prova negative. Ruaj SHA/run/limits në CURRENT_STATE dhe MASTER.

**P1b më pas, analizë/plan ende jo implementim i autorizuar:** mat JWT exp-iat pa log tokeni; testo skadimin me TTL të shkurtër vetëm në CI, refresh-after-logout dhe password-change/disabled-identity behavior; pastaj vendos politikën production për access-token TTL, refresh lifecycle dhe revokim. Mos e zëvendëso revokimin e një përdoruesi me rotacionin global të JWT_SECRET: prek të gjithë tenant-in dhe kërkon plan operacional.

**Vendim ekzekutimi i këtij auditimi:** vetëm lexim source/logs dhe update i dokumentacionit të lejuar. Nuk u ndryshuan konfigurimi, scripts, workflow, token policies ose varësitë.
