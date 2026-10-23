# ShqipShop — ROADMAP me prova për çdo fazë

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
| G2 · Native feasibility | Upstream RN + locale sq-AL + Medusa dev server | `npm ci`, lint/TS/Jest, Android build, mobile checkout | Pjesërisht: RN dhe sq-AL, 17/17 testet, ARM64 APK build PASS, Android API35 x86_64 emulator install/start PASS (run 39842340691); Android↔Medusa UI katalogu PASS (39845817408); UI checkout dhe telefoni fizik mungojnë |
| G3 · Unified commerce backend | Një sistem inventory/order, multi-tenant i sigurt | Për 2 merchants teste pozitive/negative, migrations | Medusa dev PostgreSQL, API order 1510 ALL, rezervim 1 stok dhe sales-channel product access 404 me key të huaj kaluan në CI; multi-tenant customer/order/admin isolation NUK është verifikuar |
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

## Next 3 të ekzekutueshme

1. Audit i PR #1 për dobësitë e backend-it pilot; screenshot/device test; README dhe handoff up-to-date.
2. POC i veçantë për Medusa Mobile origjinal, me licencë MIT dhe konfigurim shqip; verifiko build/test/checkout.
3. Përzgjedhja e commerce source-of-truth dhe strategjisë tenant-isolation; dokumento ADR dhe fillo migrim të sigurt vetëm pas provës.

## Si matet progresi

Nuk ka përqindje 'totale' të besueshme deri sa të jenë vlerësuar gate-t dhe peshat e tyre. Prototipi i tanishëm përmbush pjesërisht G0; pas çdo ndryshimi kontrollo `main`, branch, PR, CI dhe testet përpara se t'i shënosh të përfunduara. G8 native nuk është e detyrueshme për të lançuar paketën PWA, por është domosdoshmëri për premtimin 'çdo biznes app-in e vet' në atë paketë.
