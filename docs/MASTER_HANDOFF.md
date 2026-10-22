# SHQIPSHOP — MASTER HANDOFF (v8)

## Android emulator realisht i verifikuar — 2026-10-22

- **Github Actions run [39842340691](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842340691): PASSED.** `ubuntu-latest`, Android emulator API 35 / **x86_64**, build-i native React Native me JS të përfshirë, `adb install` dhe nisja e `com.rnstartermedusa/.MainActivity` funksionuan. Kontrolli verifikoi procesin pas 15 sekondash dhe mungesën e `FATAL EXCEPTION` në log-et e filtruara.
- Artefakti `ShqipShop-Android-emulator-launch-report` ruan screenshot dhe crash-log të filtruar: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842340691/artifacts/12454487323 (retention deri më 27 tetor 2026). Screenshot ekziston, **por nuk është audituar manualisht për UI/UX**.
- Ndërtimi arm64 për telefon vazhdon i veçantë: run https://github.com/titanfit102-bit/ShqipShop/actions/runs/39830678418. Të dyja APK-të janë **test-only, të nënshkruara me debug keystore të upstream**, pa kredenciale prodhimi.
- **Nuk ka ende**: lidhje APK→backend Medusa të aksesueshëm, çelës publishable të konfiguruar te APK, checkout në emulator nga UI, instalim në telefon fizik, white-label per tenant, privatësi/siguri production ose pagesa reale.
- **Hapi i radhës:** ngri server Medusa testimi të aksesueshëm nga emulatori, konfiguro çelësin demo pa e vendosur në repository, bëj UI→cart→order real në Android. Gjithashtu provo izolimin e klientëve/porosive/adminëve, release signing dhe remediimin e auditimit të varësive.



## Verifikim negativ shtesë — akses direkt me ID (2026-10-22)

[Run 39843421693](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39843421693) **PASSED**, commit `7e87bda1cfebe107e4acf78b31f4e98bc7defaa6`. Testi përdori çelësin publik të kanalit bosh për `GET /store/products/{id}` mbi ID-në e një produkti të kanalit kryesor. Serveri ktheu **HTTP 404** (`SHQIPSHOP_CROSS_CHANNEL_DIRECT_PRODUCT_DENIED`). Testet e katalogut, porosisë në PostgreSQL dhe rezervimit të 1 njësie inventari kaluan sërish. Ky është **scope i produkteve sipas sales-channel**, JO izolim i plotë i dy bizneseve ose i porosive/klientëve/adminëve.



## Ecuria e radhës (2026-10-22): Rezervim inventari dhe kufiri i katalogut

- [Run 39841615561](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39841615561) PASSED: 20 inventare fillestare, porosia e testimit rezervoi saktësisht 1 njësi (`reservedDelta:1`), sasia fizike `stocked_quantity` mbeti konstante. Ky është rezervim, **jo** zbritje pas dërgesës.
- [Run 39842677918](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842677918) PASSED: çelësi API i lidhur me një kanal të dytë bosh lexon 0 produkte, kur çelësi i kanalit origjinal lexon 4 produktet demo; `SHQIPSHOP_SALES_CHANNEL_CATALOG_SCOPE_PASSED`. Porosia 1510 ALL dhe kontrollet e stokut kaluan përsëri.
- **Kufizim kritik arkitekturor:** Këto dy prova **NUK** provojnë izolimin e klientëve, porosive, administratorëve, përdoruesve ose skedarëve ndërmjet bizneseve. Sales channels Medusa nuk janë sistem multi-tenancy i gatshëm.
- Vazhdo me `docs/TENANT_ISOLATION_GATES.md` për portat e detyrueshme dhe përzgjedhjen e modelit tenant. Emulator Android është workstream i veçantë në [PR #4](https://github.com/titanfit102-bit/ShqipShop/pull/4), me rezultat të pavarur që duhet verifikuar live.



## Prova e përfunduar: Store API → porosi → PostgreSQL (22 tetor 2026)

**Run i suksesshëm:** https://github.com/titanfit102-bit/ShqipShop/actions/runs/39839755263; commit `4ec90316abb2c211470a650599379809466b7e32`.

- U përdor serveri real Medusa v2 në GitHub Actions, PostgreSQL 16 dhe Redis 7 përkohshëm, dhe vetëm të dhëna sintetike.
- Skripti `medusa-backend-poc/scripts/store-api-checkout.mjs` testoi endpoint-et `/store` nëpërmjet HTTP: mungesa e `x-publishable-api-key` refuzohet me HTTP 400; leximi i 4 produkteve/rajonit Shqipëri/ALL, krijimi i shportës, shtimi i variantit, adresa shqiptare, transporti, payment collection + sesioni `pp_system_default`, completion → order.
- Përgjigjja e API-së konfirmoi një **order demonstrative me 1 artikull, 1 510 ALL**.
- Skripti `assert-ci-order.ts` lexoi përsëri porosinë e krijuar nga **databaza PostgreSQL** e Medusa: marker `SHQIPSHOP_ORDER_PERSISTED_IN_POSTGRES_PASSED` dhe total 1510 ALL.
- Çelësi publik për këtë eksperiment lexohet nga një skedar i përkohshëm në runner; nuk u vendos në repo. Nuk ka kredenciale admin në skriptin e checkout-it, pagesë reale ose server publik.
- **KUFIZIMET:** testi është HTTP nga runner, **nuk është APK Android i lidhur në pajisje/emulator**. `pp_system_default` është ofrues manual sistemor demo, jo procesor pagese online dhe jo integrim me korrier/fiskalizim. Nuk ka ende teste për uljen/rezervimin real të stokut pas porosisë, izolim të dy bizneseve, abonime SaaS ose fortifikim production.
- **NEXT:** krijo instalim/nisje Android me API të aksesueshme në ambient testimi, provo sjelljen e inventarit dhe izolimin e dy bizneseve, auditim varësish dhe plan i vetëm për `source-of-truth` të PWA/native.



## PIKË REFERIMI E VERIFIKUAR (22 tetor 2026) — APK + Backend Medusa i testuar

- **APK native Android ARM64 u ndërtua dhe u ruajt si GitHub Action artifact**, run https://github.com/titanfit102-bit/ShqipShop/actions/runs/39830678418, SHA-256 e APK-së `66f01d24dcc8c8c8729a424f954e61db745b9f61ac990d1e060185bcafa29324`. Artefakti skadon sipas politikës së ruajtjes të run-it. Çelësi i nënshkrimit është debug i publikuar; jo release komercial. Instalimi në telefon nuk është testuar.
- **PR #3** https://github.com/titanfit102-bit/ShqipShop/pull/3 është branch `feat/medusa-v2-backend-poc` mbi branch e PR #2; përmban Medusa zyrtar DTC starter me licencë MIT në `medusa-backend-poc/` dhe backend CI.
- **Testi Medusa v2 + PostgreSQL + Redis dhe kontrolli i të dhënave Shqipëria/ALL KALUAN**: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39834267570; seed 4 produkte dhe 2 opsione transporti; health HTTP 200. Serveri u mbyll pas Actions, nuk është i hostuar publikisht. Shih `docs/MEDUSA_BACKEND_POC.md`.
- **Audit varësish React Native**: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39832976270; 1 critical, 44 high, 19 moderate në graph e përgjithshëm të npm. `shell-quote` është kritike, me version të korrigjuar. Nuk është riparuar ende, kërkon plan upgrade pa breaking changes.
- **GJENDJA E PUNËS:** React Native + lokalizimi sq-AL kanë kaluar lint/types/Jest, APK ndërtuar, backend Medusa ka kaluar migrime, seed dhe health; **jo** instalim në telefon, backend publik, katalog në telefon, cart/checkout E2E, multi-tenant production, pagesa apo abonime.
- **NEXT:** kontrata API (publishable key + products), cart/checkout me të dhëna testimi, Android emulator/device smoke, proof tenant isolation dhe audit/correct critical advisory. Mos e ndërto ShqipShop si app store APK (ide e refuzuar nga përdoruesi).



## Status i ri — Përpjekja e parë për APK (2026-10-22)

## 2026-10-22 · Android build në GitHub Actions

- U shtua workflow i veçantë `.github/workflows/build-android-internal.yml`, read-only permissions, immutable action SHAs, Node 24, JDK 17 dhe Android SDK/NDK, që përpiqet të prodhojë një **APK arm64 me JavaScript të përfshirë**.
- U zgjodh task Gradle `assembleRelease` vetëm për të përfshirë bundle-in JS; **mbetet me debug.keystore publik të upstream** dhe nuk është version prodhimi.
- Run i parë https://github.com/titanfit102-bit/ShqipShop/actions/runs/39830420989 dështoi në SDK Manager: mungonte `platforms;android-37`. U ndryshua `compileSdkVersion/buildToolsVersion` në **36**, `targetSdkVersion` mbeti **36**.
- Run i dytë https://github.com/titanfit102-bit/ShqipShop/actions/runs/39830678418 ka kaluar instalimin e SDK 36 dhe po ekzekuton build-in Gradle (kontrolli i fundit gjatë shkrimit); **nuk ekziston ende rezultat i verifikuar/artefakt**.
- Në `npm ci` u raportuan 64 advisory të varësive (19 moderate, 44 high, 1 critical). Ky është sinjal për auditim/upgrade të sigurt përpara prodhimit; mos supozo që të gjitha janë të shfrytëzueshme në runtime.
- Shih `docs/BUILD_ANDROID_INTERNAL.md` për konfigurimet, kufizimet, përmbajtjen e artefaktit dhe hapat e verifikimit.
- Hapi i radhës sipas rezultatit të run-it: verifiko artefaktin dhe instalimin, ose riparo rrënjën e dështimit nga log-et. Pas kësaj lidhja me Medusa v2 backend development (rajon ALL, produkt, shportë, checkout test-only).



## VENDIM PËRFUNDIMTAR I PËRDORUESIT — 22 tetor 2026

**ShqipShop NUK do të ndërtohet si Play Store alternativ / katalog APK-sh / instalues i aplikacioneve të bizneseve.** Përdoruesi ka zgjedhur të mbajë **idenë origjinale white-label**: çdo biznes shqiptar ka dyqanin e tij të branduar dhe, kur ka kuptim, app-in e vet Android/iOS. Kodi origjinal Medusa Mobile është baza për native, kurse prototipi PWA i ShopifyShop është burim reference, jo motori përfundimtar i porosive.

Ky ADR mbetet vetëm arkiv historik i alternativës së analizuar. Mos planifiko apo ndërto sistem APK distribution/signing/installer pa kërkesë të re të qartë. Shpërndarja e një APK-je demo për testim nuk është dyqan APK-sh.

### Plani i aprovuar i punës
1. Stabilizo kodin ekzistues në PR #2; kontrollo CI Python dhe React Native.
2. Ndërto **Android debug APK** nga native-medusa/ në CI dhe ruaj artefaktin pa çelësa production.
3. Konfiguro Medusa v2 backend development/test (PostgreSQL, rajon ALL, produkte, manual payment/COD) dhe lidh aplikacionin Android.
4. Testo një porosi të plotë vetëm me të dhëna testimi dhe shiko order/inventory në backend.
5. Zgjidh **një source of truth** dhe izolimin e bizneseve; adapt PWA vetëm te ky backend, jo dy databaza autoritative.
6. Ndërto personalizim White-label (emër, logo, ngjyra, ID aplikacioni, konfigurim, build signing i sigurt); panel biznesi + operator, abonime.
7. Testo 3–5 biznese reale (pa pagesa/PII realë deri në release gates), bëj auditim sigurie, backup/recovery, kontroll rregullash dhe rollout gradual Android/iOS.


## Përditësim i verifikuar — Native Medusa POC, 22 tetor 2026

**Ky është statusi më i ri; seksionet historike më poshtë përshkruajnë gjendjen përpara importimit.**

- **PR #1 (Draft)** përmban pilotin PWA FastAPI/SQLite, branch feat/bootstrap-pwa-mvp, 10 teste pytest të kaluara në Actions: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39824460831
- **PR #2 (Draft)** i ndërtuar mbi branch-in e PR #1 përmban importin e origjinalit Medusa Mobile në native-medusa/ dhe integrimin e përkthimit sq-AL: https://github.com/titanfit102-bit/ShqipShop/pull/2.
- Upstream MIT i fiksuar në commit **4ad76d0eb5878efdd16ed294f5a655851aa99617**. Nga 170 skedarët origjinalë, dy logje diagnostikuese JVM u përjashtuan, ndërsa .env.template u rikthye në commit-in e lokalizimit. Kodi native nuk është mbishkruar mbi kodin e FastAPI. Shih [NATIVE_MEDUSA_POC](NATIVE_MEDUSA_POC.md).
- **JavaScript native CI, pas lokalizimit shqip:** run https://github.com/titanfit102-bit/ShqipShop/actions/runs/39826582144 — ESLint, TypeScript dhe Jest kaluan, 5 suites / 17 teste. Ky nuk është Android APK build apo provë me Medusa backend.
- Ide e re për t'u ruajtur (jo ende për implementim): **ShqipShop si katalog APK Android** ku bizneset kanë APK-të e tyre të veçanta që përdoruesit instalojnë nga katalogu ynë, pa qenë të detyruar të përdorin Play Store. Kjo nuk është e njëjtë me PWA/native white-label dhe ka rreziqe sigurie, sideloading dhe verifikim zhvilluesish. Shih [ADR-004](ADR-004_APK_CATALOG_IDEA.md).
- **Vendimi:** PWA pilot + Medusa native si kandidat për aplikacione individuale; mos krijo një app store të plotë para provave të kërkesës dhe sigurisë.
- **Puna e radhës:** Android debug build në runner të përshtatshëm; Medusa v2 backend test, rajon ALL, produkte/porosi; verifikimi i dy bizneseve të izoluara, pastaj billing/onboarding. Kërkohet një burim i vetëm i së vërtetës për stokun/porositë.
- **Mbrojtjet:** mos prek main, mos bëj merge/deploy, mos paguaj shërbime dhe mos përdor të dhëna reale klientësh pa autorizim. Përpara se të deklarosh gjendjen, krahaso live PR-et dhe CI; commit-et pas dokumentit nuk trashëgojnë automatikisht statusin 'passed'.


**Përditësuar:** 22 tetor 2026. **Burimi i së vërtetës:** ky repository, jo pretendimet e bisedave.

> LEXO KËTË I PARI NË ÇDO BISEDË TË RE. Verifiko gjithmonë branch, PR, skedarë, log-e dhe statusin aktual përpara çdo ndryshimi.

## 1. Misioni dhe kërkesa origjinale

Përdoruesi kërkon një biznes **white-label commerce SaaS për tregun shqiptar**: çdo biznes të ketë identitetin, produktet, inventarin, porositë, panelin dhe (sipas paketës/vlefshmërisë në store) **aplikacionin e vet Android/iOS**. Duhet të funksionojë në shqip, me çmime në lekë, blerje të thjeshtë për klientin, operacione të automatizuara për shitësin dhe abonim mujor potencial për operatorin ShqipShop.

**Kjo nuk është një marketplace i përbashkët në të cilin klienti sheh të gjithë shitësit.** Është zgjidhje për dyqane të pavarura me markën e secilit. Një katalog i përbashkët mund të studiohet vetëm më vonë, por NUK është produkti bazë. Mos e ngatërro me Illyrian/IllyrianShop, Protesto, Builder System apo projekte të tjera.

Vlera që blihet: biznesi krijon një kanal shitjesh në pronësi të vet pa ekip programues; menaxhon produkte/stok/porosi dhe klientë. Diferencimi nuk është thjesht përkthimi shqip. Tregtarë të vegjël që sot marrin porosi me Instagram/WhatsApp janë segment testimi, jo demand i konfirmuar.

## 2. Historiku i vendimeve dhe punës (në rend)

1. Përdoruesi solli upstream https://github.com/bloomsynth/medusa-mobile-react-native dhe kërkoi vlerësim. U verifikua repo MIT me **React Native CLI + TypeScript**, Medusa v2 SDK, shportë, login, kategori, checkout bazë dhe ndjekje porosish. **Kërkon server Medusa veçmas**; pagesa Stripe dhe kërkimi i avancuar ishin në roadmap.
2. U sqarua ideja: jo kopje për një marketplace, por **një aplikacion i veçantë për çdo biznes shqiptar**. U diskutua white-label SaaS me tarifa hipotetike 29€/muaj dyqan web dhe 79€/muaj Premium app; këto janë shembuj, JO çmime të validuara, JO abonime të ndërtuara.
3. U ndërtua një MVP pilot origjinal, por ai është **FastAPI + SQLite + HTML/CSS/JS PWA**, jo fork/klon i plotë i Medusa Mobile. Ka panel biznesi dhe rrjedhë COD të thjeshtë. U prodhua veçmas kit për lokalizim shqip të Medusa Mobile, por **NUK është integruar ose build-uar aplikacioni React Native**.
4. Përdoruesi krijoi repository https://github.com/titanfit102-bit/ShqipShop. Branch i izoluar `feat/bootstrap-pwa-mvp` dhe **PR #1 Draft** u krijuan; përdoruesi importoi manualisht kodin e pilotit.
5. Pas importimit u rivendosën skedarët dotfiles që mungonin: `.gitignore`, `.dockerignore`, `.env.example`, `.github/workflows/verify.yml`. U shtuan dy teste tenant-regression dhe u përditësua README.
6. GitHub Actions u modernizua me SHA të pandryshueshme të `actions/checkout` v7.0.1 dhe `actions/setup-python` v7.1.0, Node 24. **Run i fundit i verifikuar në nisjen e këtij dokumentimi**: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39822589301 ; commit `2a8b1d1bd3c98a34149d4056097768003c0178cc`, **10/10 pytest PASSED, 1 paralajmërim deprecation nga varësitë**. Ky rezultat nuk provon testim native, browser E2E ose production.
7. Më 22 tetor përdoruesi kërkoi një historik për vazhdim mes bisedave dhe pyeti nëse ishte më mirë të përdornim drejtpërdrejt kodin origjinal Medusa. Përgjigjja arkitekturore: **për app-e native, upstream është bazë më e përshtatshme; pilotin tonë nuk e hedhim poshtë, por as nuk e lidhim me forcë pa provë përputhshmërie**. Shih `docs/ADR-003_MEDUSA_NATIVE_VS_CUSTOM_PILOT.md`.

## 3. Verifikimi real i repository-t në momentin e handoff

- Repository: `titanfit102-bit/ShqipShop` (publik); default branch `main`.
- `main` ishte ende commit fillestar `329e0381b0bc4ce39cf554a2b2888a047e1dd29e` dhe **nuk ishte ndryshuar** në kontrollin e fundit.
- Branch zhvillimi `feat/bootstrap-pwa-mvp`; PR https://github.com/titanfit102-bit/ShqipShop/pull/1 **Draft, open, jo merged**.
- PR pilot përfshin: `app/*.py`, `templates/*.html`, `static/*`, `tests/*`, konfigurimet, `mobile-medusa/*` (vetëm përkthim/skript), `docs/*` dhe `PREVIEW_OFFLINE.html` (demo statike pa porosi reale).
- CI ekzekuton Python 3.13, `compileall` dhe `pytest -q` në `ubuntu-latest`. Statusi i fundit kaloi, por çdo commit pasues duhet rikonfirmuar nga Actions.
- ASNJË backend Medusa i vendosur, ASNJË build APK/IPA, ASNJË domain live, ASNJË abonim, ASNJË pagesë online, ASNJË onboarding publik biznesesh. Mos e quaj 'e gatshme për klientë realë'.

## 4. Arkitektura e pranishme (implementuar)

Klienti web `/s/{slug}/` → FastAPI `app/main.py` → logjikë `app/services.py` → SQLite `app/db.py`.
Paneli `/admin/{slug}`: hyrje/password hash/session/CSRF dhe administrim i katalogut, stokut dhe statusit të porosive. API porosish cash-on-delivery me çmim të llogaritur në server, idempotency, transaksione stoku dhe kufizim sipas merchant-id. Frontend `templates/`, `static/`; testet `tests/`.
Skema pilot: merchants, users, sessions, products, orders, order_items. E kufizuar për demonstrim; për prodhim kërkohen PostgreSQL/migrime, backup/restore, rate limiting i shpërndarë, siguri e auditueshme dhe procedura për të dhënat personale.
Materiali `mobile-medusa/` është **localization pack** që duhet aplikuar në një kopje të origjinalit jashtë pilotit. Nuk është vetë Medusa, nuk ka `package.json` React Native në repository aktual.

## 5. Produkti final i synuar (jo i përfunduar)

- Biznesi regjistrohet/verifikohet, zgjedh planin dhe menaxhon abonimin; platforma krijon tenant-in, URL/domain dhe branding.
- Panel shqip ku tregtari menaxhon katalog, variante, foto, inventar, dërgesa, porosi, promovime, analitikë bazë, klientë dhe kërkesa për asistencë.
- Çdo biznes merr dyqan mobil/PWA individual. Paketa native, nëse e leverdishme dhe e pranueshme nga store, do të vijë nga një bazë e përbashkët Medusa React Native e parametrizueshme për identitetin, funksionet dhe endpoint-in e biznesit.
- Konsistencë e vetme për çmimin/stokun/porositë mes PWA dhe native; asnjë sinkronizim 'best effort' mes dy databazave të pavarura për pagesat.
- Mbështetje për Shqipëri: ALL, shqip, adresa/dërgesa lokale, cash-on-delivery në fillim; pagesa elektronike vetëm pas kontratave të ofruesit dhe testimit të sandbox/webhooks.
- Dashboard për operatorin e ShqipShop: tenant lifecycle, subscriptions, konfigurim, logje, support, usage, siguri, backup.
- Standardet e prodhimit: GDPR dhe ligje lokale, siguri, performancë, audit logs, monitorim, recovery, billing, testim integrimi në pajisje, shqyrtim Apple/Google.

## 6. Vendime arkitekturore dhe kufij

- **ADR-001:** PWA fillimisht për testimin e vlerës dhe uljen e friksionit; kjo nuk e zëvendëson aspiratën për app-e native.
- **ADR-002:** backend custom është vetëm pilot; **nuk është vendosur** që FastAPI/SQLite të mbetet motor commerce në prodhim.
- **ADR-003:** rruga e preferuar për native është të studiohet/përshtatet Medusa Mobile original; një proof-of-concept Medusa v2 backend + app real para migrimit. Shmang dy order systems paralelë.
- Medusa Store Module nuk është multi-tenancy e izoluar automatikisht. Opsionet production: Medusa backend i veçantë për tenant ose një arkitekturë e përbashkët e zgjeruar me autorizim rigoroz. Krahaso kostot/shkallëzimin dhe sigurinë para zgjedhjes.
- Apple App Review 4.2.6: aplikacionet nga template komercial duhen dorëzuar nga ofruesi i përmbajtjes; Google Play ndalon app-e shumë të ngjashme. Nuk premtohet publikim masiv automatik.
- Upstream është licencë MIT, me detyrim për të ruajtur LICENSE dhe njoftimet e autorit në redistribuim; mos pretendoni pronësi origjinale të kodit.

## 7. Gjendja sipas fazave (jo përqindje të shpikura)

| Fazë | Gjendja | Dëshmia/porta e daljes |
| --- | --- | --- |
| Kërkesat dhe identifikimi upstream | E dokumentuar | Repo upstream, licenca dhe dallimi PWA/native |
| Pilot storefront/admin | Kod + 10 teste të kaluara në CI (sipas run-it të mësipërm) | Mungon browser/device E2E dhe validimi me biznese reale |
| Shqip lokalizim Medusa Mobile | Kit, jo app i ndërtuar | Clone upstream, patch, `npm run verify`, Android/iOS build |
| Prova Medusa end-to-end | Nuk ka filluar | Produkt → shportë → porosi reale development backend → status |
| Multi-tenant backend production | Nuk ka filluar | DB, autorizime, migrime, izolim, recovery dhe load test |
| SaaS operator/onboarding/billing | Nuk ka filluar | Onboarding i 3 bizneseve dhe faturim i kontrolluar |
| Pagesa/dërgesa dhe legal/privacy | Nuk ka filluar | Sandbox + politika/kontrata të verifikuara |
| Publikim & prodhim | Nuk ka filluar | Auditim, preview real, CI/E2E, publikim i lejuar dhe monitorim |

**Rregulli i progresit:** mos deklaro X% të ndërtuar pa faza të peshuara dhe evidencë. Testet unit/API nuk janë testet end-to-end dhe as garanci sigurie. Mbaj të ndarë 'implementuar', 'testuar', 'deploy-uar' dhe 'shitur'.

## 8. Prioritetet e ardhshme (rend i varur)

1. Bëj auditim pilotit + rreziqe: regjistrim, izolim tenant, siguri, databazë, saktesi e formave dhe testim browser të 3 dyqaneve demo.
2. Përgatit **branch/zonë të izoluar** për proof-of-concept upstream Medusa Mobile (jo overwrite të `app/` FastAPI). Importo upstream duke ruajtur LICENSE dhe shënimet; vendos konfigurim dhe përkthim shqip; testoni `npm ci`, `npm run verify`, Android build.
3. Vendos Medusa v2 backend development me inventar, rajon ALL, manual payment/COD dhe kanal të duhur të shitjeve. Testo rrugën reale të porosisë në mobile. Në mungesë të ambienteve mobile, deklaro kufizimin dhe mos e quaj 'testuar'.
4. Shkruaj ADR final për **source-of-truth** të porosive/stokut dhe strategjinë multi-tenancy. Vendimi bazohet te eksperimenti, jo tek preferenca e framework.
5. Testo me 3–5 biznese të vërteta duke përdorur të dhëna testimi. Kërko sinjal pagese reale; vetëm më pas automatizo onboardimin dhe shitjen.
6. Implemento në faza sigurinë, PostgreSQL, domain provisioning, SaaS subscriptions, dërgesat dhe më pas publikimin native.

## 9. Rregullat e punës / autorizimit

- Projekti ShqipShop **i ndarë**: mos prek repository, koda, dokumente apo secrets të projekteve të tjera.
- Shiko gjendjen në GitHub dhe udhëzimet e repo **përpara** ndryshimeve; mos bazo vendime në kujtesë të pa-verifikuar.
- Ndryshimet bëhen në feature branches, PR Draft/review dhe teste, pa push direkt në `main`, pa force push, pa fshirje të dëmshme.
- Ndryshime të pakthyeshme, publikime, shpenzime, pagesa reale, menaxhim secrets, migrime production dhe merge në main kërkojnë autorizim të qartë.
- Mos premto punë asinkrone. Në çdo përgjigje ndaji veprimet e kryera nga rekomandimet. Verifiko logs dhe përputhshmërinë në objektivin e testit.
- Ruaj licencat, atribucionet, sekretet, privatësinë dhe parandalimin e izolimit të tenantëve.

## 10. Si vazhdohet në një chat të ri

Ngjit këtë udhëzim (s'ka nevojë të rikopjosh gjithë bisedën):

> Vazhdo projektin ShqipShop vetëm nga https://github.com/titanfit102-bit/ShqipShop. Lexo `docs/MASTER_HANDOFF.md`, `docs/PROJECT_HISTORY.md`, `docs/ADR-003_MEDUSA_NATIVE_VS_CUSTOM_PILOT.md`, `docs/ROADMAP.md`, `AGENTS.md`, plus kodin real. Verifiko branch-et, PR #1, testet Actions, problemet e hapura dhe ndërprerjet mes statusit të dokumentuar e real. Objektivi është një platformë white-label ku çdo biznes shqiptar ka dyqanin dhe potencialisht app-in e vet Android/iPhone; fillimi është PWA pilot, ndërsa Medusa Mobile origjinal është kandidati kryesor për native. Mos përziej me projekte të tjera; mos bëj merge/deploy pa autorizim. Jep raport të gjendjes së verifikuar dhe vazhdo me fazën me leverage më të madh.

**Shënim:** Ky handoff është snapshot historik, jo provë që commit-et pas datës së dokumentit kanë kaluar testet. Përditëso datën, SHA, evidencën dhe vendimet kur ndryshojnë.

## PR #4 — Android emulator x86_64 (veçmas nga APK-ja ARM64 e telefonit)

- Branch `feat/android-emulator-smoke`, PR https://github.com/titanfit102-bit/ShqipShop/pull/4, krijuar mbi Medusa backend POC.
- Workflow `.github/workflows/android-emulator-smoke.yml` me `ubuntu-latest`, Android emulator API 35 / x86_64, Gradle APK bundled, `adb install`, `MainActivity`, kontroll procesi 15 sekonda, crash log të filtruar dhe screenshot artifact.
- Prova fillestare https://github.com/titanfit102-bit/ShqipShop/actions/runs/39841940988 dështoi në konfigurimin e action-it (SHA e shkurtuar, e rregulluar). Run pasues https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842340691 ishte në proces gjatë dokumentimit. **Verifiko statusin aktual dhe raportin e emulatorit; mos pretendo instalim të suksesshëm vetëm nga ky dokument.**
- APK është nënshkruar me debug keystore të upstream, jo me një çelës biznesi. Nuk ka ende backend të lidhur nga emulatori dhe as checkout Android end-to-end.
- Nuk ndërtohet ShqipShop si Play Store alternativ (vendim përfundimtar i përdoruesit).

