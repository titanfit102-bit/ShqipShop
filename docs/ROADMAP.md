# ShqipShop — ROADMAP me prova për çdo fazë

**Vendim i konfirmuar, 22 tetor 2026:** ShqipShop mbetet white-label commerce SaaS (dyqan dhe app i personalizuar për çdo biznes); ideja e ShqipShop si APK marketplace është **refuzuar dhe jashtë scope-it**. Shih [ADR-004](ADR-004_APK_CATALOG_IDEA.md). Kodi Medusa Mobile është importuar në PR #2, me `sq-AL` dhe 17 teste Jest; hapi i radhës është Android debug build, pastaj Medusa v2 backend + porosi test end-to-end. Nuk ndërtohet APK store.


**Datë bazë:** 2026-10-22. **Kjo është një strategji zhvillimi**, jo pretendim që të gjitha fazat janë realizuar. Në çdo përditësim mbaj metrikat: koduar / testuar / deploy-uar / përdorur nga klientë realë.

## Përkufizimi i produktit që duhet të kemi në fund

Një operator ShqipShop mund të krijojë e të menaxhojë shumë biznese shqiptare; çdo biznes zotëron identitetin dhe të dhënat e vet, panel për produktet/inventarin/porositë, një faqe/dyqan PWA të instaluar në telefon dhe (opsional Premium) app Android/iOS që punon me **të njëjtin burim të të dhënave**. Biznesi paguan vetëm në bazë të një plani/fature transparente. Klienti final blen në shqip, në ALL, merr konfirmim dhe ndjek porosinë. Operatorët kanë logje, billing, backups, support dhe përgjegjësi privatësie të përcaktuara.

## Plan i varur nga evidenca

| Gate | Çfarë duhet | Vërtetohet me | Gjendja në snapshot |
|---|---|---|---|
| G0 · GitHub baseline | Kod, varësi, CI, dokumentacion, PR | `compileall`, `pytest`, CI i gjelbër | Po për pilot; 10/10 testet në run 39822589301 |
| G1 · Pilot UX/Security | 3 demo shop flows + admin + izolim, përmasa mobile | Browser E2E, auth/CSRF/XSS, review manual | Jo i përfunduar |
| G2 · Native feasibility | Upstream RN + locale sq-AL + Medusa dev server | `npm ci`, lint/TS/Jest, Android build, mobile checkout | Pjesërisht: kodi importuar, sq-AL, 17/17 testet native JS kaluan; build Android/backend mungon |
| G3 · Unified commerce backend | Një sistem inventory/order, multi-tenant i sigurt | Për 2 merchants teste pozitive/negative, migrations | Jo |
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
