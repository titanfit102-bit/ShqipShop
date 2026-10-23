# ShqipShop — ROADMAP me prova për çdo fazë

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
