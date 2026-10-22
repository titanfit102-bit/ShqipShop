# SHQIPSHOP — MASTER HANDOFF (v1)

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
