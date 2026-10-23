# ShqipShop — Native Android checkout-to-order proof

**PR #7:** https://github.com/titanfit102-bit/ShqipShop/pull/7
**Run:** https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130
**Stage:** draft automation; verify conclusion and diagnostic logs.

## Verifikimi i synuar

Testi në CI ngre Medusa, PostgreSQL dhe Redis ephemeral, me vetëm të dhëna sintetike. Një APK x86_64 React Native instalohet në Android 35 emulator, me `10.0.2.2:9000` (host runner) dhe publishable key vetëm në working copy të CI. HTTP cleartext lejohet vetëm në runner, jo në manifestin e repozitorit.

Testi prek butonat e **vetë UI**: produkt Medusa Shorts → variant S → Shto në shportë → Përfundo porosinë → fusha email dhe adresë demonstrative → Transport standard → Manual (provider sandbox/system) → Kontrollo porosinë → Dërgo porosinë → Detajet e porosisë.

Pas UI, një Medusa Graph query nga backend lexon **porositë reale në PostgreSQL** dhe kërkon një order me shumën 1510 ALL, një Medusa Shorts, email sintetik, `shipping_address.country_code=al`.

## Provat e domosdoshme

- `SHQIPSHOP_ANDROID_NATIVE_ORDER_UI_PASSED` në log nga emulatori.
- `SHQIPSHOP_ANDROID_NATIVE_ORDER_POSTGRES_PASSED` në query e databazës.
- GitHub Actions run `conclusion: success`, screenshot i kontrolluar dhe pa `FATAL EXCEPTION`.
- Asnjë informacion apo pagesë reale, asnjë ndryshim `main`.

## Të paprovuara

Nga ky test nuk dalin pagesa bankare në EUR/ALL, fiskalizimi, transporti real, iOS, release APK me signing personal, admin isolation për dy biznese, pagesat/abonimet e SaaS, publikimi në Play Store/App Store apo miratimi i tyre.

## Më pas

1. Nëse CI dështon, korrigjo konkretisht skriptin ose UI-në sipas provave dhe ekzekuto sërish.
2. Kur porosia kalon, provo anulim/fulfillment/inventory, 2-tenant auth-negative tests.
3. Pagesa reale në dy monedha vetëm mbi një ofertë server-side në monedhën e zgjedhur; kursi orientues gri **nuk mund të përdoret për të ngarkuar pagesa**.

## PR #7: POROSIA NGA UI ANDROID KALOI (2026-10-23)

- **[GitHub Actions run 39934984130](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130) PASSED.** Log-et përmbajnë në të njëjtin run `SHQIPSHOP_ANDROID_NATIVE_ORDER_UI_PASSED` dhe `SHQIPSHOP_ANDROID_NATIVE_ORDER_POSTGRES_PASSED`. Në Android 35 x86_64, UI përzgjodhi Medusa Shorts variant S, e shtoi në shportë, plotësoi email/adresë sintetike në Tiranë, përzgjodhi `Transport standard`, `Manual`, dhe shtypi `Dërgo porosinë`. UI kaloi te `Detajet e porosisë`.
- Query e pavarur në Medusa PostgreSQL vërtetoi **një porosi 1.510 ALL**, produktin/sasinë, vendin `al` dhe emailin sintetik. **Kjo është prova e parë native UI → Order DB**, jo vetëm API smoke.
- **[Artifact zyrtar 12493738613](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39934984130/artifacts/12493738613)** përmban screenshot `checkout-final.png` të inspektuar vizualisht, `status.txt` dhe `android-crashes.log` bosh. Ekrani tregon numrin e porosisë, Medusa Shorts S, adresë sintetike, transport 10 ALL, total **1510 ALL**.
- **Gabim UI i zbuluar nga screenshot-i:** rreshti i emërtuar `Nëntotali` tregon **1510 ALL** në vend të 1500 ALL, ndërsa transporti është 10 ALL dhe totali 1510 ALL. Kodi `native-medusa/app/screens/order/order-detail.tsx` përdor `order.subtotal` në vend të `order.item_subtotal`/shumës së produkteve. Emri i metodës së transportit është hardcoded “Standard Shipping” dhe titulli i navbar-it “Detajet e porosisë” ngushtohet. Këto duhen riparuar si PR #8 përpara release-it. Backend order amount **është verifikuar**.
- **Mbetet:** real EUR checkout, FX zyrtar automatik, pagesa bankare/COD real, klientë/adminë/porosi të izoluar për 2 merchants, abonimet SaaS, release-grade signing, Play Store/iOS. `main` nuk është ndryshuar.

