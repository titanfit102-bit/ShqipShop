# ShqipShop — CURRENT_STATE (checkpoint aktiv)

> Lexo këtë skedar të PARIN, pastaj [MASTER_HANDOFF.md](MASTER_HANDOFF.md) v22 dhe [AGENTS.md](../AGENTS.md). Ky është checkpoint-i i shpejtë, jo zëvendësim për verifikimin live të GitHub.
>
> **Vendndodhja e autorizuar:** repository publik [titanfit102-bit/ShqipShop](https://github.com/titanfit102-bit/ShqipShop), **vetëm** dega [feat/merchant-auth-boundary-ci](https://github.com/titanfit102-bit/ShqipShop/tree/feat/merchant-auth-boundary-ci); skedari [CURRENT_STATE.md](https://github.com/titanfit102-bit/ShqipShop/blob/feat/merchant-auth-boundary-ci/docs/CURRENT_STATE.md). **Nuk gjendet në main.** Mos kërko fillimisht në main dhe mos supozo se një PR i ri bart automatikisht dokumentacionin.

## Checkpoint i verifikuar — 2026-10-23

| Elementi | E konfirmuar |
| --- | --- |
| Identiteti | ShqipShop, white-label ecommerce SaaS për biznese shqiptare; **jo** marketplace/APK app store |
| Dega e dokumentacionit dhe zhvillimit të autorizuar | feat/merchant-auth-boundary-ci |
| PR aktiv | [#12](https://github.com/titanfit102-bit/ShqipShop/pull/12), **OPEN Draft**, bazuar në [#11](https://github.com/titanfit102-bit/ShqipShop/pull/11) |
| **Commit-i i kodit të verifikuar** | 3eab3c3fc0007c4b76aff9c51c80bae007290742 |
| CI i verifikuar në atë SHA | [39981336521](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336521) (dy Medusa/izolim/auth), [39981336483](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336483) (Medusa smoke), [39981336440](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39981336440) (pilot): **3/3 SUCCESS** |
| main në verifikim | 329e0381b0bc4ce39cf554a2b2888a047e1dd29e, pa merge të PR-ve |
| Faza | **G3 — në progres, jo production-ready** |
| Deploy/merge/pagesa reale | **Asnjë** prej këtyre veprimeve nuk është kryer për këtë fazë |

**Evidenca konkrete e kufirit A/B:** dy procese Medusa njëkohësisht, PostgreSQL me DB/role të veçanta, dy porosi sintetike nga 1.510 ALL, vetë-porosia HTTP 200, porosia e dyqanit tjetër HTTP 404, publishable key i huaj HTTP 400. Admin/customer JWT të dy bizneseve provohen dhe token-et e huaja refuzohen në të dy drejtimet. Dy Redis serverë ishin të arritshëm në CI; **përdorimi real i tyre nga provider-et e Medusa/queues nuk është konfirmuar**. Checkout-et u bënë njëri pas tjetrit teksa **të dy serverët** ishin aktivë, jo si race/load test.


## Rikuperim live — 2026-10-23, pas protokollit v22

- **HEAD i inspektuar:** `b3f759a2e363b70664ce74e17ef742964e6e6922`. Krahasimi nga code SHA `3eab3c3` përmban **vetëm** AGENTS.md, CURRENT_STATE, MASTER_HANDOFF, PROJECT_HISTORY dhe ROADMAP; asnjë ndryshim kodi.
- **CI në këtë HEAD:** [parallel/auth 39985437241](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39985437241), [Medusa smoke 39985437127](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39985437127), [pilot 39985437135](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39985437135): **3/3 SUCCESS**, job steps dhe log-et u lexuan. Pilot: **10 passed**; Medusa: porosi PostgreSQL dhe rezervim +1 me stok fizik të pandryshuar; dy-backend: marker-at order boundary A/B dhe admin/customer JWT isolation.
- **PR #1–#12:** ende OPEN Draft; #12 bazohet në #11, #11 në #10; #9 dhe #10 janë degë motra mbi #8. `main` mbetet `329e0381b0bc4ce39cf554a2b2888a047e1dd29e`.
- **Gjetje e re e verifikuar:** log-u i backend smoke shfaq vlera JWT_SECRET/COOKIE_SECRET të gjeneruara për runner-in, pa maskim; workflow i shkruan në GITHUB_ENV pa add-mask. Janë sekrete CI të përkohshme, jo provë ekspozimi kredencialesh production. **Mos kopjo vlerat** në docs/raporte. Korrigjimi i workflow-t kërkon leje kodi.
- **Gjendja:** G3 IN_PROGRESS. Analiza dhe kriteret më poshtë janë përgatitur; **testet e reja nuk janë implementuar/ekzekutuar**. Autorizimi i konfirmuar mbulon vetëm pesë dokumentet në këtë degë. Hapi teknik pret leje të shprehur për scripts/workflow; nuk është dështim i testit.

## Kufijtë e provës dhe punët e hapura

- **P0 (pasues):** teste negative të sesioneve cookie, logout/replay/cross-tenant, autorizimet e ndryshimeve (order/customer/inventory/admin), ID spoofing dhe RBAC; ndalo çdo pretendim production/security pa rezultate.
- **P1:** të verifikohet konfigurimi konkret i Medusa Redis/cache/event-bus/workers dhe izolimi real i jobs; backup/restore dhe rotacioni i kredencialeve.
- **P2:** të zgjidhet një burim i vetëm commerce truth për PWA dhe native, onboarding/branding/domain dhe tenant provisioning/deprovisioning idempotent; krahasim kosto 5/50/500 biznese.
- **P3:** pagesa/cash-on-delivery reale dhe PSP sandbox, kurs ALL/EUR real me kontroll vlefshmërie, dërgesa, GDPR/siguri, test në pajisje, pilotë biznesesh dhe publikim vetëm pas aprovimeve.
- **UI i hapur:** titulli Android «Detajet e porosisë» shfaqet shumë i vogël; duhet test vizual i ri. Sekondarja EUR është vetëm **orientuese**, me FX sintetik në CI, jo pagesë në dy monedha.
- **Dokumentacioni:** shënimet e vjetra në README/ADR/ROADMAP mund të pasqyrojnë gjendje historike; për gjendjen aktuale, krahaso gjithmonë kodin dhe Actions.

## Veprimi i saktë i ardhshëm

1. Verifiko live degën, SHA, PR #12, GitHub Actions dhe nëse ka ndryshime **pas checkpoint-it të kodit** 3eab3c3. Verifiko në mënyrë të veçantë testet e HEAD-it të dokumentacionit; mos supozo që statusi GREEN i kodit vlen për SHA-të e ardhshme.
2. Analiza dhe kriteret e testit cookie/session dhe negative mutations janë ruajtur në MASTER_HANDOFF §10; zbato testin CI të kufizuar sipas tyre, **vetëm nëse ka autorizim të shprehur për ndryshime kodi**. Autorizimi i protokollit vetë nuk jep leje për kod/degë të tjera.
3. Pas çdo rezultati material të verifikuar, përditëso CURRENT_STATE.md, MASTER_HANDOFF.md dhe, kur nevojitet, PROJECT_HISTORY.md/ROADMAP.md/AGENTS.md, **vetëm në këtë degë**.

## Protokolli i autorizimeve dhe handoff-it

**Autorizim i vazhdueshëm, i kufizuar:** përdoruesi autorizoi krijimin dhe mirëmbajtjen e dokumenteve docs/CURRENT_STATE.md, docs/MASTER_HANDOFF.md, docs/PROJECT_HISTORY.md, docs/ROADMAP.md, AGENTS.md, pas çdo ndryshimi material dhe të verifikuar, **vetëm në degën feat/merchant-auth-boundary-ci**. Dokumento fazën IN_PROGRESS, FAILED ose BLOCKED pa e quajtur completed. **Pa leje të veçantë:** mos modifiko kodin për këtë detyrë, mos prek degët e tjera/main, mos bëj merge/deploy, shpenzime, pagesa reale, secrets ose të dhëna reale.

**Vazhdimësia ndërmjet degëve — E PAZGJIDHUR:** dokumentet jetojnë sot vetëm në PR #12. Kur puna kalon në një degë tjetër, mos supozo se ky checkpoint do të sinkronizohet vetvetiu. Propozimi i sigurt është një **degë/PR e dedikuar vetëm dokumentacionit, me pikë hyrjeje të qëndrueshme**, ose një PR dokumentacioni te main, vetëm **pas autorizimit të ri** për degën e destinacionit. Deri atëherë, mbaje këtë degë si checkpoint autoritativ, rifreskoje pas çdo progresi të verifikuar dhe shëno SHA/PR të degës së punës në këtë skedar. Nëse dega është mbyllur/fshirë ose dokumentacioni s'është i aksesueshëm, kontrollo PR #12/commit-et historike dhe kërko autorizim për rikuperim në degë tjetër; mos shkruaj pa leje.

**Limit rikuperimi:** nuk disponohet garanci për transkriptet e plota të të gjitha bisedave të mëparshme. Ky checkpoint rrjedh nga dokumentacioni, kodi, PR-të dhe log-et e verifikuara; pasiguria duhet të raportohet.

**Checkpoint code SHA** është i fiksuar qëllimisht. **SHA aktual i dokumentacionit është HEAD-i live i kësaj dege**, i cili ndryshon gjatë ruajtjes së vet: verifikoje në GitHub, mos pretendo se një SHA statik brenda skedarit është commit-i final i atij skedari.
