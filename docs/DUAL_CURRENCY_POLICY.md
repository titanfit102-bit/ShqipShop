# ShqipShop — Standardi i çmimeve ALL/EUR (ADR-005)

**Data:** 23 tetor 2026 · **Status:** faza A e implementuar në PR #6, prova e emulatorit duhet verifikuar. **Faza B (pagesa reale në dy monedha) jo ende.**

## Kërkesa e përdoruesit

ShqipShop është platformë white-label për biznese të pavarura. Në Shqipëri shumë klientë ngatërrojnë 'lekët e vjetra' me **ALL (lekë të reja)**. UI tregon monedhën e transaksionit me hierarki vizuale dhe ekuivalentin orientues më të vogël, gri e në kllapa.

| Monedha reale në Medusa | Çmimi kryesor | Rreshti dytësor (vetëm kur rate është valid) |
|---|---|---|
| ALL | **1.500 lekë** | *(≈ €15,00 · orientuese)* |
| EUR | **€15,00** | *(≈ 1.500 lekë · orientuese)* |

Shembulli përdor vetëm kurs **sintetik 100 ALL/EUR** për të shpjeguar dizajnin. Ky **nuk është** kurs real i sotëm, çmim i garantuar ose premtim për pagesë në monedhën dytësore.

## Kontrata e vërtetë e të dhënave

- Frontend **nuk llogarit vlerën që paguan klienti**. Shumat dhe `currency_code` e katalogut/shportës/porosisë vijnë nga Medusa.
- Medusa `GET /store/shqipshop/indicative-fx`: operator-configured `all_per_eur` (sa ALL për 1 EUR), `as_of` (YYYY-MM-DD UTC), `source`, `indicative_only:true`. Pa quote: `{available:false}`.
- Backend dhe klienti kërkojnë normë pozitive, burim jo bosh, datë valide jo në të ardhmen dhe jo më të vjetër se 7 ditë. Klienti nuk krijon kurs default; rreshti gri fshihet automatikisht.
- Kursi vendoset në mjedisin e backend-it me `SHQIPSHOP_FX_ALL_PER_EUR`, `SHQIPSHOP_FX_AS_OF`, `SHQIPSHOP_FX_SOURCE`. Vlerat nuk futen në `.env.template` si norma reale të pretenduara.
- Një instancë demo ka quote globale. Në produktin e ardhshëm multi-tenant, kursi/burimi/freskia duhet të merren sipas politikës së **tregtarit/tenant-it**, të testohen në mënyrë negative për rrjedhje të konfigurimit, të logohen ndryshimet, dhe quote të rifreskohet në mënyrë të besueshme. Medusa është burimi autoritativ për çmimet e shitjes, jo endpoint-i FX.
- Rreshti i vogël gri nuk duhet të keqkuptohet si shuma e faturës; për përdoruesin shënohet shprehimisht `ALL = lekë të reja`.

## Integrimi

`native-medusa/app/utils/dual-currency.ts` bën vetëm `formatShopPrice` dhe `getIndicativeConversion`. `native-medusa/app/data/indicative-fx.ts` përdor një cache React Query me interval 15 minuta dhe verifikim quote. `ShopPrice` përdoret për product cards, product detail/variants, cart line items, totals/checkout summary; trashëgon monedhën nga Medusa.

Me shpejtësinë e kërkuar nga mobile, frontend nuk bën kërkesë individuale për çdo kartë: të gjitha përdorin të njëjtin query key/cache. Në mungesë lidhjeje interneti përdoret vetëm çmimi real (pa konvertim të rremë).

## Faza B — Pagesa reale me EUR ose ALL (e ardhshme)

Ky është zhvillim **i ndarë nga konvertimi vizual**, që duhet të kalojë porta reale:

1. Verifiko monedhat e mbështetura nga biznesi dhe çmimet e sakta EUR/ALL në Medusa server-side; llogarit diferencat fiskale, roundings, shipping, discounts, taxes, refunds, returns dhe reporting.
2. Monedha të zgjidhet **para krijimit/rikrijimit të cart**. Vetëm mundësi me `region`/pricing/payment provider të konfiguruar dhe autorizuar. Çmimi i pagueshëm duhet kthyer nga Medusa, jo nga ndarja shumëzimi në UI.
3. Testo dy checkout-e me monedha të ndryshme me përditësim dinamik të totalit të shportës, çmimit të transportit dhe porosisë së ruajtur. Testo edhe dështimin kur EUR checkout nuk ofrohet.
4. Provë pagesash në sandbox PSP ose manual COD sipas konfigurimit të biznesit, pa para reale, dhe pajtueshmëri me llogaritë bankare/kontabilitetin.
5. Integrim kursesh nga ofrues zyrtar/licencuar, përditësim i auditueshëm, ruajtje e origjinës/datës dhe rastet kur shërbimi nuk përgjigjet.
6. Implementim i sigurt për çdo biznes të ndarë; prova negative tenant-isolation para prodhimit.

## Verifikimi

- React Native Jest: ALL primary, EUR primary, të dy konvertimet, quote missing/stale/future/invalid, amounts negative/NaN/unsupported currencies.
- Medusa HTTP CI: quote sintetik 100 ALL/EUR me datën e runnerit/burim të deklaruar, dhe checkout ekzistues 1510 ALL pa ndryshim.
- Android emulator: workflow `android-dual-currency-ui.yml` kërkon rreshtin real orientues në shportë dhe ruan screenshot. Pa rezultat `success` dhe shqyrtim pamjeje, dizajni nuk quhet i verifikuar vizualisht.
- Nuk ka ndryshime në main, publikim, PSP prodhimi apo tarifa reale.
