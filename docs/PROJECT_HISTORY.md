# ShqipShop — projekt / histori ndryshimesh

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

