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


## 23 tetor 2026 — Izolimi ndërmjet dy Medusa backend-eve: prova e parë GREEN

- **Gjetja që e nisi këtë:** [PR #9 / run 39946398016](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946398016) FAILED AS INTENDED: në një backend të përbashkët Medusa me 2 sales channels, të dy publishable keys A/B morën **HTTP 200** ndaj `GET /store/orders/{id_A}`. Kjo vërtetoi që sales channels nuk janë kufi privatësie mes tregtarëve. PR #9 duhet të mbetet diagnostik i kuq dhe mos u fshi testimi.
- **Vendimi i pilotit [ADR-006](ADR-006_TENANT_BACKEND_ISOLATION.md):** çdo tregtar pilot ka një instancë Medusa/DB PostgreSQL/user role të izoluar, dhe control plane ShqipShop jashtë rrjedhës së klientëve/porosive. Ky është dizajn i rekomanduar, jo ende SaaS i përfunduar.
- **[PR #10](https://github.com/titanfit102-bit/ShqipShop/pull/10), [run 39947677104](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39947677104): PASSED.** CI krijoi dy database PostgreSQL të veçanta `shqipshop_ci_a`, `shqipshop_ci_b` dhe përdorues të pavarur me `REVOKE CONNECT FROM PUBLIC`. Prova negative DB A↔B kaloi: `SHQIPSHOP_TWO_DATABASE_ROLE_DENIAL_PASSED`.
- Në instancën A Medusa, u krijua porosi sintetike 1510 ALL; instanca B u ngrit **pas mbylljes së A** me të dhënat e B, port 9001, key publik të B dhe database të B. Serveri B ktheu **HTTP 200** për katalogun me B key, **HTTP 400** për A key dhe **HTTP 404** për porosinë A të kërkuar me B key. `SHQIPSHOP_SEPARATE_MEDUSA_ORDER_BOUNDARY_PASSED`.
- **Kufiri i provës:** dy instancat u testuan **sekuencialisht** (jo dy procese paralele). Kjo NUK provon admin/customer/session security, izolim të queues/Redis në të gjithë provider-at, media, webhook, refund, billing, backup ose real-world deployment. `G3 tenant isolation` mbetet **NË PROGRES, jo PASS**.
- **Android receipt visual:** [run 39946022933](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39946022933) për 1500 ALL produkte + 10 ALL transport = 1510 ALL dhe FX hint 15.10 EUR sintetik duhet kontrolluar live përpara deklarimit vizual.
- **Next:** test dy backend-e aktive njëkohësisht me kontroll databazash/Redis dhe role admin/client për dy tregtarë, regjistro provision/deprovision + backup/restore, limite të burimeve, analizë reale kosto 5/50/500, pastaj branding i dyqanit dhe përditësimi i Android/PWA per merchant. Mos prek main/production.

