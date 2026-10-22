# ADR-004 — ShqipShop si katalog aplikacionesh Android për bizneset

**Data:** 2026-10-22 · **Gjendja:** ide e re strategjike; jo plan i autorizuar për ndërtimin e një app store prodhimi. Nuk zëvendëson ADR-001/002/003.

## Ideja origjinale

ShqipShop mund të jetë një APK qendrore, e ngjashme me mini app-store ku klientët zgjedhin dyqane shqiptare dhe shkarkojnë APK të branduara të secilit biznes pa u varur për çdo dyqan nga publikimi në Google Play. Bizneset janë klientët SaaS; përdoruesit zbulojnë dyqanet në katalog.

APK-të nuk duhen futur fizikisht brenda APK-së qendrore. Secili APK i nënshkruar ruhet në server/storage dhe shkarkohet individualisht.

## Kufizimet Android dhe iOS

- Android lejon shpërndarje jashtë Play Store, por instalimet nga burime të panjohura kërkojnë aprovimin e përdoruesit: https://developer.android.com/distribute/marketing-tools/alternative-distribution
- Android PackageInstaller normalisht kërkon veprim aktiv të përdoruesit; nuk planifikohet instalim i heshtur: https://developer.android.com/reference/android/content/pm/PackageInstaller
- Përditësimi kërkon të njëjtin app ID dhe certifikatë të përputhshme nënshkrimi: https://developer.android.com/google/play/app-updates
- Nëse katalogu shpërndahet në Google Play, leja REQUEST_INSTALL_PACKAGES ka kufizime: https://support.google.com/googleplay/android-developer/answer/12085295
- Verifikimi i zhvilluesve Android nisi në disa vende në 2026; shtrirja globale është planifikuar për 2027: https://developer.android.com/developer-verification
- APK nuk është format instalimi për iOS; Apple 4.2.6 kufizon template-generated apps: https://developer.apple.com/app-store/review/guidelines/

## Krahasimi

| Alternativa | Friksioni për blerësin | Operacionet | Rekomandim |
|---|---|---|---|
| PWA për biznes | I ulët (link/QR) | Më të lehta | MVP i preferuar |
| Native app specifik për biznes | I mesëm | Build, signing, review, update | Premium pas validimit |
| ShqipShop APK catalog/installer | I lartë (sideload + instalime) | Siguri e binareve, verifikim, updates, suport | Vetëm eksperiment më vonë |
| Një app ShqipShop me katalog të gjithë bizneseve brenda | Një instalim i vetëm | Më i thjeshtë se 100 APK | Alternativë, por ndryshon produktin |

## Vendimi i kthyeshëm

**Mos ndërto full alternative app store tani.** Prioritet: pilot PWA i ShqipShop + një native proof-of-concept nga Medusa Mobile origjinal (i ruajtur nën native-medusa/), me një burim të vetëm autoritativ për stokun dhe porositë. Testo 3–5 biznese dhe kërkesën për apps individuale. Më pas, nëse ka provë tregu, shto katalog të lehtë me buton Hap dyqanin dhe eventualisht shkarko APK për aplikacione të verifikuara.

## Kushtet e domosdoshme për katalog APK

1. Provë instalimi në modele reale Android duke respektuar dialogët e OS.
2. Identitet i verifikuar i botuesit, certifikatë/signature, checksum SHA-256, versionCode, malware scan dhe menaxhim i sigurt i çelësave privatë jashtë GitHub.
3. Manifest dhe server i besuar për versionet, rollback i sigurt, përditësime që nuk prishin të dhënat.
4. Përputhshmëri me verifikimin e zhvilluesve Android 2026/2027.
5. Politika privatësie, kontrata me shitësit, abuse reporting dhe përgjegjësi për support.
6. Metri i aktivizimit, instalimeve, blerjeve dhe retention kundrejt PWA që justifikon kompleksitetin.

## Status

Asnjë APK installer/katalog, sistem signing, storage për apk, automatizim update, apo publikim nuk është implementuar. Kjo është vetëm një ide e dokumentuar dhe nuk ndryshon objektivin origjinal: çdo biznes ka dyqanin dhe mundësisht aplikacionin e vet.
