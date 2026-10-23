# ShqipShop — Portat për izolimin e bizneseve

**Status: design and verification gates, NOT implemented multi-tenancy.** Snapshots më 2026-10-22.

## Parimi jo i negociueshëm
Çdo tregtar duhet të shohë dhe modifikojë vetëm katalogun, inventarin, klientët, porositë, asetet, konfigurimet dhe faturat e veta. Kontrolli duhet të zbatohet **në server dhe në datastore**, jo thjesht te filtri i aplikacionit.

## Çfarë është provuar

- [Run 39841615561](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39841615561): Porosia rezervoi 1 njësi stoku nga 20 nivelet, me sasinë fizike të pandryshuar.
- [Run 39842677918](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842677918): Dy publishable API keys të lidhura me kanale të ndryshme Medusa. Çelësi i kanalit bosh nuk sheh asnjë nga katër produktet e kanalit bazë; çelësi i kanalit bazë vazhdon të funksionojë.
- Këto prova janë testuar mbi **një dyqan Medusa demo** dhe NUK provojnë dy biznese të izoluara plotësisht.

## Dy arkitektura kandidate

### A — Një instancë/back-end dhe database të veçanta për çdo biznes
Izolim më i qartë dhe përdorim i natyrshëm i Medusa Admin. Kostot për tenant dhe mirëmbajtja rriten me numrin e bizneseve. Një control plane ShqipShop koordinon onboarding, konfigurim, metrikë dhe abonimet, por nuk bashkon databazat e porosive.

### B — Backend i përbashkët me multi-tenancy të ndërtuar
Në çdo record dhe query duhet lidhur një `merchant_id` me autorizim rigoroz, gjithë endpoint-et Medusa/API, admin workflows, eventet, caching, media, refunds, search dhe background jobs duhet të jenë tenant-bound. Ky model ka risk më të lartë të rrjedhjes së të dhënave. **Medusa sales channels nuk mjaftojnë.**

## Porta e testimit përpara vendimit production

1. Krijo dy biznese A dhe B me identitete, çelësa, administratorë, produkte, inventar dhe klientë të veçantë.
2. Provo për secilin: katalog pozitiv brenda vetes dhe negativ jashtë; akses direkt me ID të produktit të biznesit tjetër refuzohet.
3. Testo të gjitha rrugët order: krijim, rikthim me ID, liste, cancel/refund, fulfillment dhe evente. Administratorit A nuk i shfaqen/ndryshohen porositë e B.
4. Në stok, vendos 1 njësi për secilin dhe bëj dy checkout konkurente; sistemi nuk duhet të lejojë oversell dhe nuk duhet të ndryshojë stokun e tjetrit.
5. Shto prova për login/session/JWT, mediat, customer addresses, refunds dhe dashboard/billing, gjithmonë me kërkesa që përpiqen të ndërrojnë business scope.
6. Ndërprit një backend ose datastore dhe provo që problemi nuk prek klientët e biznesit tjetër; testo backup/restore brenda tenant-it.
7. Krahaso koston reale për 5, 50 dhe 500 biznese, kohën e mirëmbajtjes dhe margjinën SaaS. Vendimi final të mbahet në ADR me test-run/commit dhe review.

**Do not label G3 complete until all relevant negative access tests pass in CI**, and a human performs a permission/security review. Never use real customer information in a public GitHub CI run.

## Verifikim negativ shtesë — akses direkt me ID (2026-10-22)

[Run 39843421693](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39843421693) **PASSED**, commit `7e87bda1cfebe107e4acf78b31f4e98bc7defaa6`. Testi përdori çelësin publik të kanalit bosh për `GET /store/products/{id}` mbi ID-në e një produkti të kanalit kryesor. Serveri ktheu **HTTP 404** (`SHQIPSHOP_CROSS_CHANNEL_DIRECT_PRODUCT_DENIED`). Testet e katalogut, porosisë në PostgreSQL dhe rezervimit të 1 njësie inventari kaluan sërish. Ky është **scope i produkteve sipas sales-channel**, JO izolim i plotë i dy bizneseve ose i porosive/klientëve/adminëve.


## 23 tetor 2026 — Receipt emulator / kufiri i aksesit te porositë

- **PR #8**, branch `feat/order-receipt-accuracy`, shtoi testin real të faturës Android: `.github/workflows/android-receipt-accuracy.yml`, `native-medusa/scripts/android-receipt-accuracy.sh`, `assert-android-receipt-rows.py`. Verifikon që etiketat dhe vlerat janë në të **njëjtin rresht** në UI: `Nëntotali 1.500 lekë`, `Transporti 10 lekë`, `Gjithsej 1.510 lekë`, plus `≈ €15,10` vetëm me FX sintetik. Testi plotëson të njëjtin checkout artificial në emulator dhe kërkon porosi të ruajtur në PostgreSQL. [Run 39946022933](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933): kontrollo përfundimin live; ishte ende duke ndërtuar APK-në gjatë shkrimit. **Mos e deklaro visual PASS pa log/status + screenshot.**
- **PR #9 Draft**, branch `feat/store-order-boundary-smoke`, mbi PR #8: `medusa-backend-poc/scripts/probe-order-channel-boundary.mjs` në CI kontrollon akses direkt `GET /store/orders/{id}` ndaj një porosie sintetike nga dy publishable keys të kanaleve të ndryshme. Nuk printohen kredenciale apo informacion porosie, vetëm statuset HTTP. Nëse kanali tjetër merr HTTP 200, testi **dështon** dhe tregon rrjedhje potenciale që ndalon përdorimin e sales channels si tenant boundary. Nëse çelësi origjinal nuk mund ta hapë porosinë pa customer auth, rezultati **INCONCLUSIVE**, jo provë izolimi. [Run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016): kontrollo statusin real.
- Medusa sales-channel scoping ka kaluar vetëm për katalogun e produkteve; nuk kemi implementuar tenant isolation për klientët, adminët, porositë, asetet, eventet, refund, storage ose billing. Modeli i kërkuar në prodhim duhet të provohet me **dy tregtarë të veçantë**, jo vetëm dy API keys në të njëjtën databazë.
- `main` nuk modifikohet, PR-të mbeten Draft; testet janë mbi të dhëna sintetike dhe debug APK. Next: diagnozë e çdo CI failure, vendim ADR i modelit tenant sipas evidencës, verifikim i plotë i funksioneve të një biznesi.

