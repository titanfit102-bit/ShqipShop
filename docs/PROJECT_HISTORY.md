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

