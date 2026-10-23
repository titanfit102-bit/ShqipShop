# ShqipShop — CURRENT_STATE (checkpoint aktiv)

## RegionProvider recovery — F03 follow-up (2026-10-23)

**Implementuar në code HEAD [77de0869](https://github.com/titanfit102-bit/ShqipShop/commit/77de0869a4f072eeb3dcbd047c21dd5a0f525909)**, në `feat/merchant-auth-boundary-ci` / [PR #12 Draft](https://github.com/titanfit102-bit/ShqipShop/pull/12). `native-medusa/app/data/region-recovery.ts` dallon ID rajoni të fshirë (vetëm HTTP 404/410) nga offline/401/5xx; ruan `region_id` ekzistues në gabime të përkohshme dhe zgjedh default vetëm pasi fallback region.list kthehet me sukses. `RegionProvider` injoron përgjigjet e vjetra me generation/epoch guard, serializon AsyncStorage writes nga B→C, ekspozon `regionLoading`/`regionError`/`retryRegion`, dhe shmang promises të patrajtuara. Home shfaq loading ose Retry në vend të ekranit bosh, RegionSelect mund të përsërisë ruajtjen që dështoi. Nuk u prek backend, pagesat, main apo Production.

**Teste të reja:** `region-recovery.test.ts` (saved/default/404/410/401/500/503/offline/empty), `region-provider.test.tsx` (retry pas offline, boot response i vonuar nuk mbishkruan zgjedhjen, dy përzgjedhje B→C shkruhen në rend, dështim persistence dhe retry). [Native CI 40014816829](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40014816829) në SHA `f4a43d6` **SUCCESS**, ESLint + TypeScript + **15/15 suites, 71/71 Jest**. Ky test ishte përpara një ndryshimi të vogël UI te `RegionSelect` në commit `77de0869`; [native CI 40015015192](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40015015192) **SUCCESS** në final code SHA `77de0869` (ESLint, TS, **15/15 suites, 71/71 Jest**) dhe [pilot 40015015190](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40015015190) **SUCCESS**. Tre workflow-t Medusa/parallel/two-isolated të atij SHA-je u **CANCELLED nga commits pasues**, jo FAILED. Udhëzimi: verifiko 5 workflow-t te HEAD-i i dokumentacionit; mos i konsidero 5/5 GREEN pa provat.

**Kufizimet:** teste sintetike React Native/Jest, jo telefon fizik/emulator E2E; rajoni përzgjidhet lokalisht edhe nëse persistence dështon (gabimi/Retry shfaqet, por restart mund të kthejë rajonin e vjetër); gjendja shumë e shpejtë e ndryshimit të rajonit **brenda server-side cart update** mund të ketë ende race (CartProvider cancel-on-unmount nuk anulon kërkesën Medusa tashmë në server). Mesazhet e reja UI Retry janë përkohësisht anglisht dhe duhen lokalizuar më vonë. Kjo fazë nuk implementon Redis F07, single commerce truth F09, real payments, checkout idempotency, apo release.

**Autorizim:** «vazhdojm» pas hapit të propozuar `RegionProvider` u përdor vetëm për kod/teste të rikuperimit të rajonit në degën ekzistuese. Përditësimi i 5 dokumenteve është i autorizuar vetëm në këtë branch. Jo leje për Redis/F09, degë të tjera, main, merge/deploy.

**Next:** verifiko CI final të code SHA dhe HEAD dokumentacionit; rishiko risk-un e server-side cart region switch dhe projektimin e Redis/provider/workers read-only. Kërko autorizim të veçantë për kodin Redis/F09. Mos e quaj production-ready.


## F03–F05 — cart recovery, mutation errors and checkout payment-state gate (2026-10-23)

**Kodi implementuar / verifikuar në commit [7ea515388d70ce45517ed667ab0275ff86cc9040](https://github.com/titanfit102-bit/ShqipShop/commit/7ea515388d70ce45517ed667ab0275ff86cc9040)**, vetëm në degën `feat/merchant-auth-boundary-ci`, [PR #12 Draft](https://github.com/titanfit102-bit/ShqipShop/pull/12). [Native 40012363697](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363697) **SUCCESS** — ESLint, TypeScript, 13/13 suites, 56/56 Jest; [pilot 40012363683](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363683) **SUCCESS**; [Medusa smoke 40012363691](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363691) **SUCCESS**, marker `SHQIPSHOP_F05_CART_PAYMENT_SESSION_VERIFIED`; [parallel A/B 40012363695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363695) **SUCCESS** (plus [40012356971](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012356971) SUCCESS për të njëjtin code SHA). [two isolated 40012363718](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40012363718) **SUCCESS**. **Të pestë workflow-t për code SHA 7ea5153 janë GREEN (5/5)**; kontrollet e HEAD-it të mëvonshëm të dokumentacionit kërkojnë verifikim të veçantë. Commits të dokumentacionit pas këtij kodi kanë HEAD të ri dhe kërkojnë kontrolle të veçanta.

- **F03:** `cart-recovery.ts` lexon shportën e ruajtur. Vetëm 404/410 e heq ID-në dhe krijon një shportë të re. 401, offline, 5xx dhe gabimet e storage propagohen pa shkatërruar ID-në ekzistuese. `CartProvider` ka `cartLoading`, `cartError`, `retryCart` dhe anulon setState nga një restore i vjetër në region change/unmount; `Cart` ofron retry/error state. Nuk riprodhohet një gabim rrjeti si shportë bosh.
- **F04:** `addToCart/updateLineItem` nuk i gëlltisin gabimet; throw dhe UI `Alert` në AnimatedCartButton/LineItemQuantity, loading restaurohet në `finally`, butonat e sasisë bllokohen gjatë mutation. Mbi cart 404 gjatë edit, reset dhe përpjekja e radhës rikrijon shportën (produktet e shportës së vjetër nuk rikuperohen).
- **F05:** `checkout-progress.ts` e vendos Review vetëm nëse Medusa cart ka sesion `pending` ose `authorized`; cart.total (edhe 0) nuk është dëshmi pagese. Pas `initiatePaymentSession` checkout rilexon cart nga Store API, verifikon session + provider dhe vetëm pastaj kalon Review; `handleOrderComplete` refuzon një session të munguar ose jo të vlefshëm. HTTP Medusa real `SHQIPSHOP_F05_CART_PAYMENT_SESSION_VERIFIED` PASSED në CI.
- **Testet:** `cart-recovery.test.ts`, `cart-mutation-errors.test.tsx`, `checkout-progress.test.ts` + të gjitha testet e vjetra; nuk është kryer emulator/telefon fizik i ri në këtë fazë.

**Kufij / rreziqe të pambyllura:** F03 kur një ID shporte skadon do të humbasë line items e serverit të fshirë; nuk premtojmë riparim inventari. Nuk janë testuar plotësisht region restore kur region është invalid, race me shkrime AsyncStorage gjatë ndërrimit të rajonit, retry abuse/offline UX në pajisje fizike, payment providers realë/Stripe, idempotenca e checkout-it ose pagesat reale. G3/G5 mbeten NË PROGRES. F01/F02/F06 ruajnë CI proof; F07 Redis/queues, F08 token policy, F09 source-of-truth dhe release gate të tjerë OPEN.

**Autorizimi i kësaj faze:** «vazhdojm» pas deklarimit të hapit F03–F05 u përdor vetëm për kod/teste të lidhur me këtë fazë në degën ekzistuese. Nuk lejon F07/F08/F09, ndryshime në degë të tjera, main, merge, deploy ose pagesa reale. Dokumentet CURRENT_STATE, MASTER_HANDOFF, PROJECT_HISTORY, ROADMAP dhe AGENTS mund të përditësohen vazhdimisht **vetëm në këtë degë**.

**Hapi pasues:** verifiko statusin e fundit të CI pas çdo dokumentimi; audit read-only të `region-context` të ruajtjes së rajonit dhe të ardhmen e F07 Redis provider/workers ose F09 unifikimin e commerce source of truth. Për korrigjimet e ardhshme të kodit kërko scope të ri të shprehur. Mos e quaj production-ready.


## F06 — order receipt ownership and guest-cart proof (2026-10-23)

**IMPLEMENTUAR DHE VERIFIKUAR NË CI:** code SHA [`9a6a4e199fa4b72935fa44b356776bd9843bb408`](https://github.com/titanfit102-bit/ShqipShop/commit/9a6a4e199fa4b72935fa44b356776bd9843bb408), [PR #12 Draft](https://github.com/titanfit102-bit/ShqipShop/pull/12). **5/5 workflows SUCCESS**: [Medusa smoke 40009599530](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599530), [Parallel Medusa auth/receipts 40009599479](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599479), [native Jest/TS/lint 40009599449](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599449), [web pilot 40009599424](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599424), [two isolated Medusa 40009599412](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599412). E gjitha në CI me të dhëna sintetike, pa merge/deploy.

**Si funksionon:** Medusa middleware për `GET /store/orders/:id` kërkon ose customer JWT/session me `auth_context.actor_id === order.customer_id`, ose për guest ID-në origjinale të shportës në header-in `x-shqipshop-cart-proof`; e verifikon ndaj `order.cart.id`, nuk ekspozon provën në URL, mban krahasimin `timingSafeEqual`, dhe nuk lejon fallback nga JWT i pavlefshëm apo JWT i klientit tjetër në guest. Android ruan `cartProof` vetëm në parametrat e navigimit pas checkout-it dhe e dërgon në header për faturën guest; lista e porosive të klientit përdor JWT normal.

**Provat HTTP**: në A dhe B blerësi guest lexon faturën e vet, vetëm order ID/provë e gabuar/provë e biznesit tjetër refuzohen; klienti i regjistruar lexon porosinë e vet pa cartProof, një llogari e dytë e të njëjtit dyqan refuzohet. Markers `SHQIPSHOP_GUEST_RECEIPT_CART_PROOF_PASSED`, `SHQIPSHOP_F06_SAME_MERCHANT_STRANGER_DENIED_A/B`, `SHQIPSHOP_F06_REGISTERED_OWNER_ONLY_PASSED_A/B`; janë në log-et e [40009599479](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40009599479).

**KUFIZIMET:** F06 është CI-verified për këtë endpoint/rrjedhë, **jo certifikim sigurie production**; nuk u krye Android emulator/telefon fizik në këtë increment, nuk është provuar restaurimi i faturës guest pas mbylljes së aplikacionit (cartProof nuk persiston për këtë qëllim), as hardening i API-ve të tjera të lidhura me order ID (`POST /store/returns` p.sh.), rate-limits, CSRF, TLS, device secret storage, Redis/queues apo backup. G3 ende NË PROGRES. F01/F02 mbeten CI verified, F03–F05 dhe F07–F16 të hapura.

**Autorizimi:** përdoruesi tha «vazhdojm» pas propozimit konkret F06; ky increment u kufizua te kontrollet server, testet CI, rrjedha native e faturës dhe konfigurimi i testeve në degën ekzistuese. Leja e vazhdueshme për dokumentet vazhdon vetëm në këtë degë. Pa autorizim për F03–F05/F07, degë të tjera, main, merge apo Production.

**Hapi pasues:** audit read-only i F03–F05 (recovery i cart 404/410/offline, propagimi i gabimeve të mutacioneve dhe checkout-resume), pastaj implementim vetëm me scope të ri kodi. Kontrollo HEAD dhe Actions live në çdo seancë; commit-et e dokumentacionit pas SHA-së së kodit nisin CI të reja.


## F02 — verified awaited local JWT logout (2026-10-23)

**Implementuar në scope + CI verified:** code commit [`b3097a3d9f8b78a7d60a5418ca565e82b66a1905`](https://github.com/titanfit102-bit/ShqipShop/commit/b3097a3d9f8b78a7d60a5418ca565e82b66a1905); [native CI 40005009842](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009842) **SUCCESS** — ESLint, TS dhe **10/10 suites, 36/36 Jest**. [Pilot CI 40005009867](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009867) **SUCCESS**; [Medusa backend 40005009885](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009885) dhe [parallel/auth 40005009829](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40005009829) **SUCCESS**; pra **4/4 CI GREEN** në commit-in e kodit F02. HEAD i dokumentacionit ka commit dhe runs të reja që duhen verifikuar më vete.

**Ndryshimi konkret:** SDK Medusa v2.21.2 `auth.logout()` nuk pret `client.clearToken()`; native tani përdor `await apiClient.client.clearToken()`, ruajtje JWT asinkrone me kontroll lokal të gjendjes, bllokim në memorie dhe marker persistent `shqipshop:jwt-signed-out` për të mos përdorur JWT të vjetër kur fshirja vonohet/dështon. Kontrollohet leximi fizik pas fshirjes; login i ri aktivizohet vetëm pasi është verifikuar JWT i ri në storage. `CustomerProvider` pastron PII/cart edhe në error path; ekrani Profile njofton për logout të papërfunduar dhe fshin back-stack. Testet e reja mbulojnë delayed remove, rejected remove, pending reads dhe verifikim të token-it të ri; dy testet lifecycle F01 rifreskohen.

**Limitet e rëndësishme:** **nuk** revokohen bearer JWT në Medusa server; as token TTL/revocation, mobile secure storage/Keychain, root/jailbreak, disk-write failure ku *si marker ashtu edhe fshirja* nuk persistojnë, apo test Android në pajisje. `getToken` i SDK-së përdor storage adapter-in, por nuk u ekzekutua një test i ri real mobile-network/Authorization header; prova është unit + inspect upstream. F02 = **IMPLEMENTED/TESTED lokalisht në këtë scope**, jo production-certified. F06 same-merchant/guest receipt ownership, F03–F05 checkout, F07 Redis, F08 JWT server/TTL e të tjerat mbeten OPEN. G3 në progres.

**Leja / handoff:** përdoruesi tha «vazhdo» në vijim të autorizimit specifik për F02. Ky increment përfshin vetëm gjashtë skedarë `native-medusa/` krahasuar me checkpoint `4ffef9cd`; pa ndryshim në main, PR #12 ende Draft, asnjë merge/deploy. Përditësimet e pesë dokumenteve janë të autorizuara vetëm në `feat/merchant-auth-boundary-ci`. Hapi i radhës: verifiko të gjitha Actions e commit-it të dokumentacionit, pastaj analizë read-only F06 dhe propozim i kontratës së guest/order ownership pa ndryshime kodi pa autorizim të ri.


## Checkpoint F01 — privacy cache native, 2026-10-23

**Implementuar dhe testuar në kod SHA `2219e65e5dff987ad5046bcf34f03fc253d9e714`**: [Native verification 40001961028](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40001961028) **SUCCESS**, 9/9 suites, 32/32 Jest, ESLint & TypeScript PASS; [pilot 40001960999](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40001960999) **SUCCESS**; [Medusa smoke 40001960998](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40001960998) **SUCCESS**. [Parallel isolation 40001960997](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40001960997) **SUCCESS** — të katër workflow-t e SHA-së së kodit kaluan (native, pilot, Medusa smoke, parallel A/B). Këto janë prova të SHA-së së kodit, jo automatikisht të HEAD-it të dokumentacionit që vjen pas.

**F01 në këtë increment:** query keys të adresave, orders dhe order-detail janë `private-customer + apiUrl + customer.id/guest`; legacy keys të pastruar; `CustomerProvider` cancel/remove queries në login/logout/identity transition dhe injoron late profile refresh me epoch; QueryClientProvider është mbi CustomerProvider; logout reset navigimi, order-detail i montuar nën një identitet nuk rishfaqet nën një tjetër. Testet përdorin React Query real dhe CustomerProvider real me fixtures sintetike: A→B kur B është offline, stale A response, local logout cache purge/legacy keys. **Nuk ka test të ri Android emulator/telefon fizik ose browser të këtij increment-i**, prandaj F01 është i mbyllur në nivel source/unit/CI, **jo** i certifikuar në pajisje/release.

**F02 dhe F06 MBETEN TË HAPURA:** Medusa SDK logout me JWT/AsyncStorage (F02) nuk është ndryshuar; GET receipt me ID (F06) mbetet kontratë server-side guest access. Ndryshimi F01 nuk certifikon as server-owned receipts, as JWT revocation. F03–F05, F07–F16 mbeten si auditimi §12. **G3 = IN_PROGRESS**, target native real accounts = HOLD deri te prova e sigurisë/release sipas target-it.

**Autorizim i kësaj faze:** përdoruesi tha «okej vazhdo» menjëherë pas rekomandimit për të filluar F01 dhe kërkesës për autorizim të veçantë të atij korrigjimi; autorizimi u përdor vetëm për kodin/testet e F01 **në degën ekzistuese**. Nuk përfshin F02, F03–F16, degë të tjera, merge/deploy/main/Production. Autorizimi i vazhdueshëm për 5 dokumentet mbetet në këtë degë.

**Hapi i radhës:** verifiko HEAD/CI dhe vlerëso F02 (logout JWT storage race) ose F06 (same-merchant receipt privacy), sipas target-it pilot, dhe kërko scope të ri kodi për increment të ri. Mos përsërit implementimin F01. Mos shpall release-ready.


## Review i auditimit të pavarur — 2026-10-23

**Audit i marrë:** SHQIPSHOP_INDEPENDENT_DEEP_AUDIT_2026-10-23.md, 16 gjetje F01–F16. Audituesi raporton eksperimente lokale sintetike; kjo seancë kontrolloi të njëjtin GitHub HEAD, kodin relevant, Medusa SDK/Store Order upstream dhe Actions, por NUK e riekzekutoi në mënyrë të pavarur të gjithë reproduksionin React Native/npm audit. **Baseline i verifikuar:** code HEAD e22bb13cd364e785c324e9daabd3af5f3ee2b34d, [parallel/auth 39991716155](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39991716155), [Medusa 39991715755](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39991715755), [pilot 39991715961](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39991715961) — 3/3 SUCCESS. Nuk ka merge/deploy.

**Të konfirmuara në source/CI:** F01 shared customer-address/order cache keys pa reset; F02 SDK logout pa await clearToken (source v2.21.2); F03 stale cart restore pa catch; F04 cart mutations swallow errors; F05 resume kthen review pa payment session; F06 order-by-ID pa auth të llogarisë është MEDUSA upstream capability e qëllimshme, PII në fields; F07 Redis fallback lokal i verifikuar në log; F08 native JWT/AsyncStorage dhe JWT post-cookie-logout i vlefshëm; F09 dy commerce DB/backend POC; F10 native regressions mungojnë në PR CI; F12 debug signing i release/starter ID; F13 price=0 refuzohet; F14 empty/error/a11y të kufizuara; F15 inline brand style kundrejt CSP; F16 udhëzime historike që duken operative. **F11:** audit-i i Work raporton 14 advisory package records; workflow report-only verifikohet, por numri dhe reachability APK nuk u riekzekutuan këtë seancë.

**Scope dhe rëndësia:** F01 = P0 vetëm për native me llogari reale, F12 = P0 vetëm për native STORE release; jo P0 për PWA-only. F06 është privatësi/kontratë aksesi që duhet projektuar, jo provë enumerimi/komprometimi. F07 është gap operacional, jo provë cross-tenant leak. Nuk ka provë production compromise.

**Hapi teknik i propozuar, jo i autorizuar për kod:** (A) native real accounts: F01 → F02 → F03–F05 + F13, dhe regressions F10; (B) PWA-first: F06 guest/account receipt ownership + F09 Medusa source-of-truth vertical + F15 CSP (vetëm nëse FastAPI pilot mbahet); (C) para live merchant: F07 Redis/session/jobs sipas target-it, restore/TLS/privacy, F08 JWT policy dhe F11 dependency triage. F12 vetëm nëse publikohet native. Detajet/acceptance gates në MASTER_HANDOFF §12. G3 mbetet IN_PROGRESS; asnjë kod i ndryshuar nga ky review.

**Autorizimi aktual:** mirëmbajtje dokumentacioni vetëm në këtë degë është e lejuar. Autorizimi i mëparshëm për scripts/workflows cookie/mutation është i përfunduar dhe nuk shtrihet automatikisht te native/PWA/backend Redis. Ndryshime kodi për F01–F15 dhe degë të tjera kërkojnë scope të ri të shprehur. Nëse bëhet zhvillim në degë tjetër, vazhdo ruajtjen e statusit këtu deri në miratim të ri për migrimin e handoff-it.


## Përditësim analize P1 — 2026-10-23

CI i HEAD-it dokumentar `e5657c6`: [pilot 39990409987](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990409987), [parallel 39990410102](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990410102), [smoke 39990410033](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39990410033): **3/3 SUCCESS**. Kodi i testuar mbetet `06ea54a`.

**Audit read-only i përfunduar:** REDIS_URL në env nuk aktivizon modulet Redis në konfigurimin aktual self-hosted; source v2.22.0 dhe log-u real konfirmojnë fallback lokal/fake redis, event bus lokal dhe locking in-memory. Cookie sessions përdorin default memory sipas loader-it/config-it; restart persistence nuk është provuar. JWT default pritet 1d nga source, ende pa matje runtime exp. TTL i shkurtër nuk është revokim pas logout-it.

**Next:** implementim i propozuar **P1a — Redis provider wiring dhe provat reale cache/event/workflow/session-restart/locking**, i përshkruar te [MASTER_HANDOFF §11](MASTER_HANDOFF.md). Kërkon autorizim kodi për këtë scope të ri; deri tani u ndryshua vetëm dokumentacioni. JWT TTL/revocation mbetet fazë e ndarë P1b; G3 ende IN_PROGRESS.

> Lexo së pari këtë dokument, pastaj [MASTER_HANDOFF.md](MASTER_HANDOFF.md) v22, [AGENTS.md](../AGENTS.md), ROADMAP dhe ADR-të. Verifiko live SHA/PR/Actions; checkpoint-i nuk zëvendëson kontrollin real.
>
> **Repository:** [titanfit102-bit/ShqipShop](https://github.com/titanfit102-bit/ShqipShop). **Dega e autorizuar:** [feat/merchant-auth-boundary-ci](https://github.com/titanfit102-bit/ShqipShop/tree/feat/merchant-auth-boundary-ci), [PR #12](https://github.com/titanfit102-bit/ShqipShop/pull/12). **Këto dokumente nuk gjenden në main.**

**Misioni:** white-label ecommerce për biznese shqiptare, storefront/PWA dhe opsionalisht app native për çdo tregtar; jo APK store ose marketplace i përbashkët. FastAPI/SQLite pilot dhe Medusa/PostgreSQL POC mbeten dy sisteme të ndara; source-of-truth përfundimtar dhe migrimi PWA janë ende për t'u vendosur/zbatuar.

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

**Next i saktë (pas analizës së përfunduar):** shih P1a më sipër dhe MASTER_HANDOFF §11 për konfigurimin/testet Redis të propozuara. Implementimi i provider-ëve, ndryshimi i politikës së autentikimit apo veçori të tjera nuk janë të autorizuara automatikisht nga ky increment. Dokumentacioni vazhdon të mirëmbahet në këtë degë.

## Autorizimet aktive dhe kufijtë

- Përdoruesi autorizoi mirëmbajtjen e docs/CURRENT_STATE.md, docs/MASTER_HANDOFF.md, docs/PROJECT_HISTORY.md, docs/ROADMAP.md dhe AGENTS.md pas çdo progresi material të verifikuar, **vetëm në feat/merchant-auth-boundary-ci**.
- Më pas autorizoi shprehimisht increment-in e planit §10: scripts/workflows për cookie/session, negative mutations dhe maskim sekretesh CI, duke thënë «po te autorizoj, vazhdo permirsimin sipas planit». Ky increment është tani i verifikuar; leja nuk transferohet në faza/degë të tjera.
- Pa leje për main, merge/deploy, shpenzime, pagesa reale, sekretet ose të dhënat production. Përdor vetëm fixtures sintetike.
- Ruaj historikun në MASTER/HISTORY/git; mos rishkruaj ADR-të historike. Dallo IMPLEMENTED, VERIFIED, FAILED, PENDING. Code SHA sipër është evidenca e testuar; documentation HEAD ndryshon gjatë ruajtjes së vet dhe duhet lexuar live.

## Punët e hapura pas këtij increment-i

1. Redis/cache/event-bus/workflow engine: dy Redis endpoints janë të arritshme, por **konfigurimi aktual zgjedh provider-ët lokalë**; binding Redis/job isolation dhe session persistence duhen implementuar/provuar.
2. Politika JWT TTL/revocation/logout global; browser session cookie attributes, HTTPS, CSRF/CORS dhe domain separation; RBAC i kufizuar mes administratorëve dhe mutation endpoints të mbetura.
3. Media/storage, backup/restore dhe rotacioni i kredencialeve; race/load tests, provisioning idempotent dhe kostot 5/50/500 biznese.
4. Commerce source-of-truth i vetëm për PWA/native, onboarding/branding/domain/control plane/billing sandbox.
5. FX real ALL/EUR, pagesa/PSP/COD e logjistikë reale, privatësi/GDPR, pajisje fizike/signing, pilotë biznesesh dhe release gates. Hint EUR mbetet vetëm orientues; kursi 100 në CI është sintetik.
6. Titulli Android «Detajet e porosisë» është tepër i vogël; kërkon ndryshim të autorizuar UI dhe screenshot të ri.

## Rikuperimi në bisedën tjetër

Verifiko branch HEAD dhe PR #12/base #11, krahaso ndryshimet pas code SHA 06ea54a5f252ae367e3281c470cdc139729459bc, lexo testet/Actions dhe dokumentet. Mos përsërit increment-in cookie/session/mutations të kaluar. Analiza read-only është ruajtur te MASTER_HANDOFF §11; implemento P1a vetëm me scope të autorizuar; mos konverto këtë rezultat në pretendim production-ready.

Dokumentacioni mbetet në këtë degë edhe nëse zhvillimi kalon diku tjetër; mos e kopjo ose krijo degë tjetër pa autorizim. Nëse dega s'është e aksesueshme, rikupero nga PR #12/git history dhe raporto bllokimin. GitHub nuk përditësohet vetvetiu kur biseda është e mbyllur. Transkriptet e plota të bisedave të mëparshme nuk garantohen.
