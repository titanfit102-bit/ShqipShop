# SHQIPSHOP — MASTER HANDOFF (v22)

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

**Izolimi i provuar aktual:** secili prej dy backend-eve Medusa mund të punojë njëkohësisht me PostgreSQL DB dhe role të ndara, çelësa, porosi, customer/admin JWT dhe JWT/cookie **secrets** të ndara. Rezultatet negative të porosive dhe token-eve janë GREEN në CI. Dy serverë Redis janë të arritshëm, por config aktual medusa-config.ts **nuk provon që provider-et Redis / event queues janë lidhur dhe izoluar**. Sesionet e vërteta cookie nuk janë testuar ende.

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

**Next atomic technical step, as of this checkpoint:** pasi të lexosh CI të PR #12, projekto testin negativ cookie/session dhe mutation authorization me Medusa A/B në CI. Regjistro kriteret e pranimit përpara ndryshimit të kodit.

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
