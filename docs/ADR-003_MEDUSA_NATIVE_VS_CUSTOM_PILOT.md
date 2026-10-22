# ADR-003 — Medusa Mobile origjinal kundrejt pilotit custom ShqipShop

**Datë:** 2026-10-22 · **Status:** propozim arkitekturor për proof-of-concept (jo migrim i aprovuar në prodhim).

## Problemi

Përdoruesi kërkoi të merrnim aplikacionin origjinal `bloomsynth/medusa-mobile-react-native`, ta përkthenim dhe për çdo biznes shqiptar të gjeneronim një aplikacion unik. Implementimi i parë devijoi në një PWA FastAPI/SQLite të shkruar nga e para; kjo na dha një pilot me merchant admin, por **jo aplikacion native**, jo integrim me Medusa. Pyetja: a duhet ta zëvendësojmë dhe të fillojmë nga upstream?

## Evidenca

- Upstream: https://github.com/bloomsynth/medusa-mobile-react-native; React Native CLI + TypeScript + SDK Medusa 2.x; flows katalog, user login, checkout manual, order history; i testuar sipas autorit me Medusa 2.21.2. Licenca MIT. Kërkon backend Medusa v2 veçmas, publishable API key dhe build Android/iOS.
- Upstream README roadmap: Stripe, product search dhe plugins ende TODO; nuk është white-label multi-tenant SaaS i përfunduar. Native testet e projektit tonë mbi upstream nuk janë kryer.
- ShqipShop pilot: FastAPI + SQLite + Jinja templates + JavaScript; PWA per merchant, admin i kufizuar sipas tenant, porosi COD dhe 10/10 teste API/unit në Actions në snapshot-in bazë. Nuk është Medusa backend ose native frontend.
- Medusa docs: https://docs.medusajs.com/resources/commerce-modules/store — Multi-tenancy **nuk ofrohet automatikisht**; lidhja e produkteve, përdoruesve dhe porosive te bizneset kërkon zhvillim.
- Apple: https://developer.apple.com/app-store/review/guidelines/ (4.2.6) — template-generated apps zakonisht dorëzohen nga vetë ofruesi i përmbajtjes. Google: https://support.google.com/googleplay/android-developer/answer/9899034/spam — ndalon aplikacione me përmbajtje/funksion shumë të ngjashëm.

## Krahasimi sipas objektivit

| Kriteri | Medusa Mobile origjinal | ShqipShop PWA aktual |
|---|---|---|
| Android/iOS me komponentë native | Po, kod ekzistues (build ende i pa-verifikuar nga ne) | Jo |
| PWA individual i biznesit | Kërkon storefront web shtesë | Po, prototip |
| Panel merchant | Medusa Admin/backend i veçantë | Ka panel pilot |
| Multi-tenant i sigurt për prodhim | Jo out-of-box | Jo (pilot vetëm) |
| Checkout dhe commerce flows të pjekura | SDK/backend Medusa, por disa flows TODO | COD pilot dhe testet bazë |
| Testet tona | Jo ende në upstream | 10/10 CI në snapshot-in bazë |
| Lokalizim | Framework lokalizimi, pack shqip të importueshëm | UI shqip |
| Shkallëzim | Varet nga arkitektura e backend-it dhe tenant isolation | SQLite jo për multi-tenant SaaS production |

## Vendimi i përkohshëm

**Mos e hedhim poshtë pilotin; mos e kthejmë atë në motorrin final të commerce pa analizë.** Përdorim pilotin për të kuptuar biznesin, UX dhe onboarding. Për **aplikacionet native** bëjmë provë teknike me upstream Medusa Mobile të pandryshuar fillimisht, pastaj përkthimin dhe identitetin tenant. Vlerësojmë backend Medusa v2 si kandidatin kryesor për të vërtetën e porosive/stokut, por nuk imponojmë arkitekturën e prodhimit para testimit.

**I papranueshëm:** PWA inventar i pavarur + Medusa inventar i pavarur në prodhim. Dy datastore autoritative do të japin stok/porosi të paqarta, kthime problematike dhe rrezik për pagesa. Duhet **një commerce source-of-truth** ose migrim i qartë i pilotit.

## Alternativat e verifikueshme

1. **Medusa backend i dedikuar për biznes** + mobile branded build (dhe web storefront që përdor të njëjtin backend). Izolim i fortë dhe semantikë native me kosto më të lartë hostimi/operimi për dyqanet e vogla.
2. **Medusa backend i përbashkët i zgjeruar multi-tenant**, me autorizim server-side, skemë pronësie, tests për tenant isolation dhe boundaries të qarta. Më ekonomik në shkallë, por arkitekturë/siguri më e vështirë.
3. **Custom commerce backend shared** (evolucion FastAPI pilot) + UI mobile e shkruar/portuar. Rrezik rinovimi i order/payment/inventory capabilities që Medusa i ka tashmë. Vetëm nëse eksperimenti tregon pengesa të forta me Medusa.

## Prova e detyrueshme para vendimit final

- Kopje e sigurt e upstream me SHA pinned + LICENSE MIT (mos e mbishkruaj `app/` FastAPI); inventarizo dependencat dhe licencat.
- `npm ci`, `npm run verify`, build Android (dhe iOS kur ekziston Mac/Xcode); regjistro çfarë u provua realisht.
- Lidh me Medusa v2 development backend në ambient lokal/test; krijo rajon ALL, produkt me variant, stok dhe manual payment; testo app → cart → checkout → order → admin.
- Apliko kit shqip `mobile-medusa/` dhe testoni të gjitha 154 vargjet, formatet e lekut dhe adresat shqiptare; mos quaj lokalizim të plotë pa provë UX.
- Provo dy biznese të izoluara (asnjëri nuk sheh katalog, customer, session, order apo stock të tjetrit), përfshirë rastet negative.
- Mat koston per tenant, procesin e publikimit në store dhe nevojat native reale të 3–5 pilotëve.

## Kriteri për mbylljen e ADR

Vendimi production merret vetëm pas raportit të eksperimentit me testet, kompromiseve monetare dhe sigurisë. Ndryshimi i drejtpërdrejtë i arkitekturës operative në `main` pa provat e mësipërme nuk lejohet. Për sigurinë dhe testet përdor PR të ndara, review dhe CI.
