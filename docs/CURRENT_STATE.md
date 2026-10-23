# ShqipShop — CURRENT_STATE (checkpoint aktiv)

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
