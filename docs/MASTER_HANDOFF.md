# SHQIPSHOP — MASTER HANDOFF (v21)

## 23 tetor 2026 — PR #11 dhe PR #12: dy biznese aktive, porosi dhe JWT të izoluara (GREEN)

- **PR #11** https://github.com/titanfit102-bit/ShqipShop/pull/11 (Draft, i bazuar në PR #10). **Run 39979050578** https://github.com/titanfit102-bit/ShqipShop/actions/runs/39979050578, commit `dafb668`: **PASSED**. Dy procese Medusa aktive njëkohësisht (:9000/:9001), PostgreSQL A/B me role të ndara, dy checkout sintetikë nga **1.510 ALL** secili; secili lexon porosinë e vet (HTTP 200), por kërkimi i porosisë së tjetrit jep HTTP 404, key i tjetrit refuzohet HTTP 400. Redis A/B janë dy shërbime të arritshme, por integrimi Medusa Redis provider dhe izolimi real i queues **nuk janë provuar**.
- **PR #12** https://github.com/titanfit102-bit/ShqipShop/pull/12 (Draft, mbi PR #11), commit kodi `c2c4f89`: **runs 39980691897 dhe 39980753775 PASSED**; gjithashtu Medusa smoke `39980753771` dhe pilot verify `39980753785` **PASSED**. Dy admin-e sintetike të krijuara në DB të ndryshme, dy customer accounts nëpërmjet Medusa /auth/customer/emailpass/register + /store/customers. Dy serverët përdorin JWT_SECRET dhe COOKIE_SECRET të ndryshëm. Token-i i klientit A nuk hyn si klient në B; token-i i adminit A nuk hyn si admin në B (dhe anasjelltas); asnjë token klienti nuk mund të përdoret si admin në serverin e vet. Markers: `SHQIPSHOP_MERCHANT_A_OWN_AUTH_PASSED`, `SHQIPSHOP_MERCHANT_B_OWN_AUTH_PASSED`, `SHQIPSHOP_MERCHANT_A_FOREIGN_AUTH_DENIED`, `SHQIPSHOP_MERCHANT_B_FOREIGN_AUTH_DENIED`, `SHQIPSHOP_TWO_MERCHANT_ADMIN_CUSTOMER_JWT_ISOLATION_PASSED`.
- **Kufijtë**: login me JWT është provuar, **jo cookie/session e vërtetë**, role/RBAC të ndryshme brenda administratorëve, GET/POST/PUT/DELETE të porosive me auth kundërshtare, refund/cancel, cross-tenant media/storage, Redis provider/worker/event hooks, race/load, backup/restore, provisioning, billing, real FX/PSP/COD ose production. **G3 ende i papërfunduar**; main ende baseline i paprekur, **asnjë merge/deploy**. Dokumentet më poshtë mund të përmbajnë snapshot-e të vjetra, prandaj përdor këtë hyrje të datës si progresin më të fundit të verifikuar.
- **Hapi i radhës**: negative tests për cookie/session dhe admin/customer mutation authorization; pastaj validimi i Redis queues dhe backup/restore, onboarding/provisioner idempotent, unifikimi PWA/native mbi një backend per tenant.



## 23 tetor 2026 — Screenshot-i i ri Android i faturës është verifikuar

- **[GitHub Actions run 39946022933](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933): PASSED**, me `SHQIPSHOP_ANDROID_RECEIPT_ALL_ROWS_PASSED` dy herë, `SHQIPSHOP_ANDROID_RECEIPT_UI_PASSED` dhe `SHQIPSHOP_ANDROID_NATIVE_ORDER_POSTGRES_PASSED`. Testi verifikoi në **të njëjtin rresht të UI**: `Nëntotali → 1.500 lekë`, `Transporti → 10 lekë`, `Gjithsej → 1.510 lekë`; kursi sintetik 100 ALL për 1 EUR shfaqi `≈ €15,10 · orientuese`. Porosia u krijua nga Android dhe u verifikua në PostgreSQL.
- **[Screenshot artifact 12499331067](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933/artifacts/12499331067)** është shkarkuar dhe kontrolluar vizualisht: Medusa Shorts varianti S, adresa fiktive Tiranë, `Transport standard (10 lekë)`, nën-totali dhe shuma përfundimtare të sakta, tekst i vogël gri EUR. `android-crashes.log` ishte bosh. Artifact ka retention deri më 27 tetor 2026.
- **Defekt i vogël i mbetur në UI:** titulli `Detajet e porosisë` tani nuk pritet, por del shumë **i vogël** në telefon. Nevojitet rregullim i tipografisë së Navbar pa `adjustsFontSizeToFit` të pakontrolluar dhe një screenshot i ri.
- **Ende të paprovuara për prodhim:** real ALL/EUR checkout & FX data provider, real payment provider, tenant admin/customer auth, dy instanca aktive njëkohësisht, Redis/workers, storage/backup, siguri dependency, deploy me TLS dhe release signing. G3 tenant-isolation ende INCOMPLETE.


## 23 tetor 2026 — Izolimi ndërmjet dy Medusa backend-eve: prova e parë GREEN

- **Gjetja që e nisi këtë:** [PR #9 / run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016) FAILED AS INTENDED: në një backend të përbashkët Medusa me 2 sales channels, të dy publishable keys A/B morën **HTTP 200** ndaj `GET /store/orders/{id_A}`. Kjo vërtetoi që sales channels nuk janë kufi privatësie mes tregtarëve. PR #9 duhet të mbetet diagnostik i kuq dhe mos u fshi testimi.
- **Vendimi i pilotit [ADR-006](ADR-006_TENANT_BACKEND_ISOLATION.md):** çdo tregtar pilot ka një instancë Medusa/DB PostgreSQL/user role të izoluar, dhe control plane ShqipShop jashtë rrjedhës së klientëve/porosive. Ky është dizajn i rekomanduar, jo ende SaaS i përfunduar.
- **[PR #10](https://github.com/titanfit102-bit/ShqipShop/pull/10), [run 39947677104](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39947677104): PASSED.** CI krijoi dy database PostgreSQL të veçanta `shqipshop_ci_a`, `shqipshop_ci_b` dhe përdorues të pavarur me `REVOKE CONNECT FROM PUBLIC`. Prova negative DB A↔B kaloi: `SHQIPSHOP_TWO_DATABASE_ROLE_DENIAL_PASSED`.
- Në instancën A Medusa, u krijua porosi sintetike 1510 ALL; instanca B u ngrit **pas mbylljes së A** me të dhënat e B, port 9001, key publik të B dhe database të B. Serveri B ktheu **HTTP 200** për katalogun me B key, **HTTP 400** për A key dhe **HTTP 404** për porosinë A të kërkuar me B key. `SHQIPSHOP_SEPARATE_MEDUSA_ORDER_BOUNDARY_PASSED`.
- **Kufiri i provës:** dy instancat u testuan **sekuencialisht** (jo dy procese paralele). Kjo NUK provon admin/customer/session security, izolim të queues/Redis në të gjithë provider-at, media, webhook, refund, billing, backup ose real-world deployment. `G3 tenant isolation` mbetet **NË PROGRES, jo PASS**.
- **Android receipt visual:** [run 39946022933](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933) për 1500 ALL produkte + 10 ALL transport = 1510 ALL dhe FX hint 15.10 EUR sintetik duhet kontrolluar live përpara deklarimit vizual.
- **Next:** test dy backend-e aktive njëkohësisht me kontroll databazash/Redis dhe role admin/client për dy tregtarë, regjistro provision/deprovision + backup/restore, limite të burimeve, analizë reale kosto 5/50/500, pastaj branding i dyqanit dhe përditësimi i Android/PWA per merchant. Mos prek main/production.



## PR #8 — Korrigjimi i nëntotalit të porosisë (23 tetor 2026)

- **Origjina e gabimit:** screenshot real i checkout-it të suksesshëm Android [artifact 12493738613](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130/artifacts/12493738613), porosia e regjistruar me 1 Medusa Shorts S (1500 ALL) + transport (10 ALL) = totali (1510 ALL). Ekrani gabimisht etiketonte si `Nëntotali` vlerën 1510 ALL, sepse përdorte `order.subtotal`. Kjo është **gabim vizual i llogaritjes**, jo i krijimit të porosisë.
- **Zgjidhja në [PR #8](https://github.com/titanfit102-bit/ShqipShop/pull/8)**, `feat/order-receipt-accuracy` mbi PR #7: utility `native-medusa/app/utils/order-totals.ts` përdor `order.item_subtotal` ose subtotalin e rreshtave, pa e përfshirë transportin; `order-detail.tsx` përdor çmim kryesor të formatuar ALL/EUR, emrin real të metodës së transportit kur ofrohet nga API-ja dhe `ShopPrice` në total. `navbar.tsx` zgjeroi hapësirën e titullit.
- **Verifikimi i kodit:** [React Native lint + TypeScript + Jest run 39937851854](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39937851854) PASSED, përfshirë testet e reja që `itemSubtotal=1500`, `shipping=10`, `total=1510`.
- **KUFIZIM PROVE:** përmbajtja e PR #8 nuk ka ende screenshot të ri Android për të konfirmuar pozicionimin vizual, `Transport standard` nga Store Order API dhe shfaqjen e `≈ €15,10` në faqen e porosisë. Mos i deklaro si të verifikuara në emulator pa run real green dhe screenshot të shqyrtuar. Screenshot-i i vjetër tregon gabimin, jo korrigjimin.
- PR-të #1–#8 mbeten Draft, nuk ka merge në `main`. Në prodhim ende duhen pagesë në EUR/ALL, kurs i verifikuar në mjedis real, tenant isolation, siguri varësish, white-label branding dhe nënshkrim release.



## PR #7: POROSIA NGA UI ANDROID KALOI (2026-10-23)

- **[GitHub Actions run 39934984130](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130) PASSED.** Log-et përmbajnë në të njëjtin run `SHQIPSHOP_ANDROID_NATIVE_ORDER_UI_PASSED` dhe `SHQIPSHOP_ANDROID_NATIVE_ORDER_POSTGRES_PASSED`. Në Android 35 x86_64, UI përzgjodhi Medusa Shorts variant S, e shtoi në shportë, plotësoi email/adresë sintetike në Tiranë, përzgjodhi `Transport standard`, `Manual`, dhe shtypi `Dërgo porosinë`. UI kaloi te `Detajet e porosisë`.
- Query e pavarur në Medusa PostgreSQL vërtetoi **një porosi 1.510 ALL**, produktin/sasinë, vendin `al` dhe emailin sintetik. **Kjo është prova e parë native UI → Order DB**, jo vetëm API smoke.
- **[Artifact zyrtar 12493738613](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130/artifacts/12493738613)** përmban screenshot `checkout-final.png` të inspektuar vizualisht, `status.txt` dhe `android-crashes.log` bosh. Ekrani tregon numrin e porosisë, Medusa Shorts S, adresë sintetike, transport 10 ALL, total **1510 ALL**.
- **Gabim UI i zbuluar nga screenshot-i:** rreshti i emërtuar `Nëntotali` tregon **1510 ALL** në vend të 1500 ALL, ndërsa transporti është 10 ALL dhe totali 1510 ALL. Kodi `native-medusa/app/screens/order/order-detail.tsx` përdor `order.subtotal` në vend të `order.item_subtotal`/shumës së produkteve. Emri i metodës së transportit është hardcoded “Standard Shipping” dhe titulli i navbar-it “Detajet e porosisë” ngushtohet. Këto duhen riparuar si PR #8 përpara release-it. Backend order amount **është verifikuar**.
- **Mbetet:** real EUR checkout, FX zyrtar automatik, pagesa bankare/COD real, klientë/adminë/porosi të izoluar për 2 merchants, abonimet SaaS, release-grade signing, Play Store/iOS. `main` nuk është ndryshuar.



## 23 tetor 2026 — PR #6 i provuar vizualisht; PR #7 checkout native në testim

- **Çmimet ALL/EUR / PR #6**: [Android emulator run 39931562458](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39931562458) PASSED, marker `SHQIPSHOP_ANDROID_DUAL_CURRENCY_UI_PASSED`: shporta e Medusa Shorts në ALL shfaqi `≈ €15,00` sipas **kursit SINTETIK** 100 ALL/EUR. PostgreSQL verifikoi artikullin në shportë. [Screenshot zyrtar](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39931562458/artifacts/12493325005). Nuk është lidhur ende kurs i vërtetë i Bankës së Shqipërisë/ndonjë burimi tjetër me freski të auditueshme; nuk ekziston ende pagesë reale në EUR.
- **PR #7 Draft:** [Android checkout UI](https://github.com/titanfit102-bit/ShqipShop/pull/7), branch `feat/android-native-checkout-e2e` mbi PR #6; workflows `.github/workflows/android-native-checkout-e2e.yml` dhe `native-medusa/scripts/android-native-checkout-e2e.sh`.
- Testi përdor një server dhe databazë **ephemeral PostgreSQL/Redis/Medusa**, APK Android 35 x86_64 me debug-keystore publik dhe publishable key vetëm në CI. Nga UI zgjedh Medusa Shorts S → shportë → plotëson adresë fiktive në Tiranë → Transport standard → Manual (`pp_system_default`) → Dërgo porosinë. Query server-side kërkon 1 porosi `ALL 1510`, vend `al`, email `buyer-ci@example.invalid`, 1 Medusa Shorts.
- U shtuan accessibility labels për inpute React Native dhe zgjedhje e paracaktuar e vendit vetëm kur rajoni ka një shtet. Këto ndryshime kaluan lint/typecheck/Jest në [run 39935031421](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39935031421); backend HTTP PostgreSQL checks në [run 39935031422](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39935031422); pilot Python në [run 39935031407](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39935031407).
- **Rezultati final i UI checkout-it:** [run 39934984130](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130). Në momentin e këtij dokumentimi ishte në ndërtimin Gradle; KËRKO `SHQIPSHOP_ANDROID_NATIVE_ORDER_UI_PASSED` dhe `SHQIPSHOP_ANDROID_NATIVE_ORDER_POSTGRES_PASSED` në të njëjtin run **me conclusion=success**. Nëse nuk kalon, dokumento error-in/screenshot-in dhe riparo. Mos raporto sukses vetëm prej kalimit të TypeScript/API.
- **Faza pasuese:** siguro 2 biznese me identitet, porosi, klientë, media dhe admin të izoluar, teste negative me ID cross-tenant; furnizues kursi real ALL/EUR dhe pagesa dymonedhëshe vetëm pasi bëhen kontrata server-side për çmimet, transportin, taksat, provider sandbox, order/refund/accounting. Branding white-label dhe release signing më vonë. `main` nuk ndryshohet pa autorizim.



## 23 tetor 2026 — Dual Currency, çmim kryesor + orientues (PR #6)

- **Kërkesë e konfirmuar:** kur biznesi shet në ALL, produkti, varianti, shporta dhe përmbledhja tregojnë çmimin **1.500 lekë** si çmim real dhe në rresht të vogël gri **(≈ €15,00 · orientuese)** vetëm kur ekziston një kurs i vlefshëm; për shitje në EUR, çmimi kryesor mbetet në euro, ndërsa ALL mund të jepet orientues. Në shportë shënohet **ALL = lekë të reja**, për të shmangur keqkuptimin me lekë të vjetra.
- **PR #6 (Draft):** https://github.com/titanfit102-bit/ShqipShop/pull/6 , branch `feat/dual-currency-price-ui` mbi PR #5. U shtua `ShopPrice` dhe helper, React Query shared, të integruar në kartat e produkteve, detaje, çmimin e rreshtit të shportës dhe totalet, pa ndryshuar Medusa cart/order amount ose `currency_code`.
- **Backend:** `GET /store/shqipshop/indicative-fx` në Medusa, me kursin **ALL për 1 EUR** të vendosur nga operatori; kërkon `SHQIPSHOP_FX_ALL_PER_EUR`, `SHQIPSHOP_FX_AS_OF=YYYY-MM-DD`, `SHQIPSHOP_FX_SOURCE`. Nuk shfaqet asgjë në euro kur kursi është i munguar, i pavlefshëm ose mbi 7 ditë i vjetër. Nuk ka ende furnizues live për kurset ose kurs specifik për tenant; pa këto nuk mund të deklarohet gati për prodhim.
- **Kursi 100 ALL/EUR në GitHub CI është TËRËSISHT SINTETIK**, vetëm për regresione dhe screenshot, **jo kurs aktual**. Testet e serverit `SHQIPSHOP_INDICATIVE_FX_HTTP_PASSED` dhe të porosisë 1510 ALL kaluan në https://github.com/titanfit102-bit/ShqipShop/actions/runs/39931072361 .
- **React Native:** testet e konvertimit (Jest) kaluan; një ekzekutim fillestar zbuloi mock `apiUrl` të papërcaktuar te `App.test.tsx`, i korrigjuar. Native lint/typecheck/Jest kaluan në https://github.com/titanfit102-bit/ShqipShop/actions/runs/39931374229 .
- **Pamja realisht në Android:** u shtua workflow `android-dual-currency-ui.yml` që vendos kurs sintetik në backend dhe kërkon tekstin orientues `≈ €15,00` në emulator. [Workflow / runs](https://github.com/titanfit102-bit/ShqipShop/actions/workflows/android-dual-currency-ui.yml) — statusin dhe screenshot-in kontrolloji live përpara se ta deklarosh vizualisht të verifikuar.
- **Pagesa e vërtetë në EUR/ALL NUK është implementuar.** Për këtë duhen monedha/çmimet server-side në Medusa, transport/taksa, checkout/order në monedhën e zgjedhur, PSP/COD kompatibël, refund dhe kontroll kontabël. Nuk përdoret kursi orientues për pagesën.
- Pas verifikimit vizual vazhdo planin kryesor: checkout Android nga UI deri te porosia në PostgreSQL, pastaj izolimi i plotë i bizneseve dhe white-label generator.



## Android UI → shportë → PostgreSQL: PASSED (2026-10-23)

- **[GitHub Actions run 39867727695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695): PASSED** në commit `7421811f11edf27b82f57c650b87e57fb9dcd258`, PR #5 Draft. U ndërtua APK x86_64, u instalua në Android 35 emulator, u hap `Medusa Shorts` nga katalogu i shërbyer nga Medusa, u zgjodh varianti `S`, u shtua një njësi në shportë dhe u hap ekrani real `Shporta`.
- Log-et verifikojnë `SHQIPSHOP_ANDROID_UI_CART_PASSED` dhe `SHQIPSHOP_ANDROID_CART_PERSISTED_IN_POSTGRES_PASSED`. Medusa query konfirmoi `{"currency":"all","itemCount":1,"product":"Medusa Shorts","quantity":1}` në PostgreSQL. Nuk është thjesht test vizual, por lidhje e plotë UI → Store API → database për **shportën**.
- **[Screenshot zyrtar i shportës](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695/artifacts/12465970419)** u shkarkua dhe u verifikua vizualisht: Shporta, Medusa Shorts, Varianti S, 1 njësi, ALL 1,500, butoni "Përfundo porosinë". Nuk ka fatal crash në logun e filtruar. Artefakti skadon 26 tetor 2026.
- **Kufizime:** porosia nuk është përfunduar nga UI Android, transporti nuk është zgjedhur, nuk është dhënë adresë, as pagesë reale. Backendi është ephemeral test-only, çelësi API demo dhe debug signing nuk përdoren për prodhim. Izolimi i të dhënave të dy bizneseve ende mungon.
- **Next:** test Android UI checkout nga ky ekran deri te order në PostgreSQL, me të dhëna krejt sintetike; më pas testi negativ i qasjes së porosive/klientëve/adminëve midis bizneseve dhe personalizimi white-label.



## PR #5 — Verifikimi real i shportës Android (23 tetor 2026)

- Branch `feat/android-ui-cart-poc` mbi PR #4, [PR #5 Draft](https://github.com/titanfit102-bit/ShqipShop/pull/5).
- U ndërtua workflow `.github/workflows/android-medusa-ui-cart.yml`, duke ripërdorur backend-in ephemeral PostgreSQL 16 / Redis 7 / Medusa, vend/monedhë Shqipëri/ALL dhe APK React Native të nënshkruar me debug-key. Çelësi publishable dhe HTTP localhost shtohen **vetëm në runner** dhe nuk futen në Git.
- Automatizim Android UI (`native-medusa/scripts/shqipshop-ui-automation.py` + `android-ui-cart.sh`) synon Medusa Shorts → madhësia S → Shto në shportë → Shiko shportën. Nuk përdor kërkesë HTTP direkte për të krijuar shportën.
- Verifikim i pavarur nga Medusa `assert-android-ui-cart.ts`: kërkon një shportë ALL në PostgreSQL me 1 Medusa Shorts. Marker-at për t'u verifikuar: `SHQIPSHOP_ANDROID_UI_CART_PASSED` dhe `SHQIPSHOP_ANDROID_CART_PERSISTED_IN_POSTGRES_PASSED`.
- [Run i parë](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695) ishte **në kompilim** gjatë dokumentimit. Mos numëro përfundim pa kontrolluar rezultatin e CI dhe log-et.
- **Jo e përfunduar:** porosia nga UI Android, checkout me adresë/transport/pagesë manuale, izolimi dy bizneseve, varësitë me advisory të sigurisë dhe gjeneratori white-label.
- Hapi pasues: nëse testi i shportës dështon, lexo log + screenshot, riparo shkakun, testo sërish. Nëse kalon, shto testim të checkout UI dhe të porosisë në databazë. Kurrë mos bëj merge në main pa autorizim të veçantë.



## Prova e konfirmuar Android ↔ Medusa me UI (2026-10-22)

- **[Run 39845817408](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408) PASSED** në commit `7545938fb98da8479796f1db34fc4fbfc1c85b3b` (workflow `.github/workflows/android-medusa-catalog.yml`). Medusa API u ngrit në runner me PostgreSQL/Redis, rajoni Shqipëri/ALL dhe 4 produkte; `SHQIPSHOP_CI_MEDUSA_CATALOG_READY 4` u verifikua.
- Kodi origjinal React Native u ndërtua si APK x86_64 **me çelës API demonstrues të përkohshëm** (jo në Git), URL Android emulator `http://10.0.2.2:9000`, dhe HTTP cleartext të lejuar vetëm në working copy të CI. Pas instalimit të APK-së në Android 35, UI tregoi produktet demo nga Medusa: `SHQIPSHOP_ANDROID_REAL_MEDUSA_CATALOG_PASSED`. Screenshot u shkarkua dhe u verifikua vizualisht: Medusa T-Shirt, Medusa Shorts, Medusa Sweatshirt, foto, çmime ALL 1500 dhe shqip në navigim.
- **Artefakti zyrtar GitHub**: [12456126411](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408/artifacts/12456126411), `ShqipShop-Android-Medusa-connected-catalog` (foto `android-catalog.png`, crash-log bosh, rezultat), skadon 26 tetor 2026. **Nuk është screenshot ilustrues.**
- **Vërejtje vizuale reale:** titulli mbetet `MEDUSA MOBILE`; banneri kryesor shfaqet bosh (burim i jashtëm `dummyjson.com` në upstream), dhe produktet/çmimet kanë ende të dhëna demonstrimi. Këto nuk janë gati për branding të tregtarëve.
- **E paprovuar ende:** klikim produkti/variant dhe shportë nga Android, adresa, transporti dhe porosia nga UI në Android, pagesa reale, depozitim i sigurt i kredencialeve, iOS, dy biznese me autorizim të izoluar, publikim/abonime.
- **Next:** testim native Produkt→Variant→Shportë→Checkout kundrejt Medusa test-only, më pas branding i konfiguruar për biznes dhe heqje e burimeve/fakteve të rreme upstream. Mos prek `main` ose production.



## ShqipShop — prova e lidhjes reale Android ↔ Medusa (22 tetor 2026)

- **Branch/PR:** `feat/android-emulator-smoke`, [PR #4 Draft](https://github.com/titanfit102-bit/ShqipShop/pull/4).
- **Implementuar në CI:** `.github/workflows/android-medusa-catalog.yml` + `native-medusa/scripts/android-medusa-catalog.sh`; një GitHub Actions job ngre PostgreSQL + Redis + Medusa v2 me rajon Shqipëri/ALL dhe 4 produkte, krijon publishable key demonstrues vetëm në runner, nis serverin host localhost:9000, injekton URL `http://10.0.2.2:9000` dhe key në APK të përkohshëm, ndërton React Native x86_64 me JS bundle, ndez emulator Android 35 dhe kontrollon titujt e produkteve në hierarkinë e UI. Ruhet screenshot dhe crash-log i filtruar. Kjo nuk prek `main`, nuk publikon backend dhe nuk ka pagesa reale.
- **Kufiri i sigurisë:** Për HTTP test lokal, `android:usesCleartextTraffic=true` shtohet nga workflow vetëm në working copy të GitHub runner. NUK është commit në manifestin prodhimi. APK është e nënshkruar me debug keystore origjinal, e pa-përshtatshme për shpërndarje komerciale. Çelësi publik i testit nuk ruhet në Git dhe nuk shfaqet në log.
- **CI run i nisur:** https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408. Gjatë shkrimit të këtij historiku serveri Medusa HTTP ishte ngritur dhe po kompilohej APK x86_64. **Mos deklaro lidhje të suksesshme nga aplikacioni pa `SHQIPSHOP_ANDROID_REAL_MEDUSA_CATALOG_PASSED` dhe run success**.
- **Next gate:** nëse prova e katalogut kalon, verifiko screenshot, kalimin te product-detail/shporta dhe checkout manual nga Android. Deri tani porositë Medusa 1510 ALL janë testuar vetëm me klient HTTP në GitHub Actions, jo UI Android. Pas kësaj kërkohen izolimi real i klientëve/porosive/adminëve midis bizneseve dhe security review.



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

