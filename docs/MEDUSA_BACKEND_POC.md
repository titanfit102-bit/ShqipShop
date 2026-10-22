# Medusa v2 backend development POC — ShqipShop

**Snapshot:** 22 tetor 2026 · [PR #3](https://github.com/titanfit102-bit/ShqipShop/pull/3) · Branch `feat/medusa-v2-backend-poc`.

## Origjina dhe ndarja e kodit

Baza është **medusajs/dtc-starter** (MIT), e importuar nga commit i fiksuar `204130a32d80b704ab509069dcc1a2f8a61f51c1`, në dosjen `medusa-backend-poc/`. Autori dhe licenca origjinale ruhen në `medusa-backend-poc/LICENSE`. Ky është një POC i pavarur nga pilot FastAPI/SQLite (`app/`) dhe nga klienti React Native (`native-medusa/`). Në këtë fazë përfshin edhe kodin Next.js storefront të upstream **vetëm si material referimi**, jo si dyqani zyrtar ShqipShop.

Repository `medusajs/medusa-starter-default` është vjetruar sipas autorëve; mos e përdor si bazë të re.

## Dëshmia e funksionimit

GitHub Actions `.github/workflows/medusa-backend-smoke.yml` në `ubuntu-latest` ngriti **PostgreSQL 16, Redis 7, Node.js 24 dhe pnpm 10.11.1**, instaloi varësitë nga lockfile, realizoi migrimet dhe nisi API-në Medusa v2 në localhost:9000.

- [Run fillestar API/health](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39833563861): PASS, HTTP 200.
- [Run pas përshtatjes së rajonit shqiptar](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39833954965): PASS, seed Shqipëria/ALL dhe HTTP 200.
- [Run me kontrolle të dhënash reale nga Medusa](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39834267570): PASS. Log-u përmban `SHQIPSHOP_ALBANIA_ASSERTIONS_PASSED`, `region=Shqipëri`, `currency=all`, `productCount=4`, `shippingOptionCount=2`.

Kontrolli në `medusa-backend-poc/apps/backend/src/scripts/assert-albania-seed.ts` lexon përmes moduleve Medusa rajonin, monedhën, dyqanin, produktet dhe opsionet e transportit. Nuk vërteton ende izolimin mes bizneseve, pagesën apo një porosi nga telefoni.

## Personalizimi demo (jo konfigurim production)

`initial-data-seed.ts` u përshtat nga rajoni europian EUR në rajonin Shqipëri me monedhën ALL, kodin e vendit `al`, magazinën në Tiranë, dy opsione transporti dhe disa produkte testimi me çmime ALL. Ofruesi i pagesës është `pp_system_default` (manual/system default), jo pagesë elektronike e integruar. Seed kryhet mbi databazë të re për CI; mos e rikryej në një dyqan real.

## Kufijtë

- Backend funksionon **vetëm në runner-in e përkohshëm të GitHub Actions**, jo në një URL publike apo në telefonin e përdoruesit.
- APK-ja native nga run-i [39830678418](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39830678418) është ndërtuar me çelës testimi, por me konfigurimin default të endpoint-it Android emulator dhe një `PUBLISHABLE_API_KEY` bosh. **Nuk mund të testohet checkout kundrejt këtij backend-i pasi ai mbyllet kur përfundon CI.**
- Serveri Medusa v2 është kandidati kryesor për burimin autoritativ të katalogut/stokut/porosive, por nuk është miratuar ende për prodhim dhe as nuk ka multi-tenancy të sigurt sipas nevojave të ShqipShop.
- Nuk ka app-store publishing, abonime SaaS, pagesa reale, informacion klientësh realë apo deploy.
- Varësitë React Native kanë një raport auditimi në [run 39832976270](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39832976270): gjithsej 1 critical, 44 high dhe 19 moderate, përfshirë shell-quote. Auditimi nuk garanton cenueshmëri të shfrytëzueshme në APK; analizimi dhe riparimi janë të detyrueshëm para lançimit.

## Rruga e radhës për verifikim

1. Krijo test integrimi Store API me **publishable API key demonstrimi** (jo secret/admin), leximi i produktit, regionit dhe shipping nga HTTP i vërtetë; mos ekspozo kredenciale në logs.
2. Testo cart → address → shipping → payment manual → place order në backend ephemeral, duke vërtetuar order dhe decrement të inventarit; përdor vetëm të dhëna sintetike.
3. Build Android me endpoint/config testimi të arritshëm nga emulatori në të njëjtin mjedis; testoni instalim, startim, katalog dhe checkout në Android emulator ose pajisje.
4. Provo dy biznese me izolim server-side për përdorues, produkte, porosi dhe stok; zgjidh single commerce source-of-truth dhe migrimin/adapterin PWA.
5. Vetëm pastaj backend i qëndrueshëm, domain per tenant, onboarding, billing, review sigurie/privatësie, Play/App Store.

**Shënim:** Këto janë faza të përcaktuara, jo të gjitha të përfunduara. Kontrollo commit-in/Actions në çdo sesion.
