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
