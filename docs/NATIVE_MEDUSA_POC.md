# Native Medusa Mobile POC — provenance and next steps

**Status (2026-10-22):** React Native + Albanian locale verified; test-only ARM64 APK built and x86_64 APK installed and launched successfully in Android 35 emulator ([run 39842340691](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842340691)). There is still **no iOS build, production signing, device/UI review, Medusa backend integration from Android, or app-store launch**.

## Source provenance (pinned)
- Original MIT-licensed upstream: https://github.com/bloomsynth/medusa-mobile-react-native
- Exact pinned source commit: 4ad76d0eb5878efdd16ed294f5a655851aa99617 (2026-10-21).
- Import location: native-medusa/ (separate from the FastAPI pilot under root app/).
- Upstream license: native-medusa/LICENSE; keep original author attribution and review third-party assets.
- Original upstream tree contains 170 tracked blobs. GitHub initial import staged 167: repository root ignore rules excluded .env.template and two Android diagnostic JVM log files. The required native-medusa/.env.template was restored in the Albanian-localization commit. **The two non-source crash logs android/hs_err_pid22264.log and android/replay_pid22264.log remain intentionally excluded**. Hence the snapshot includes 168 of 170 upstream tracked items (including the restored env template), plus Albanian changes.

## What changed for ShqipShop
- New native-medusa/app/constants/fluent-templates/sq-AL.ts: Albanian translations reused from the previously prepared localization kit.
- Locale provider supports sq-AL with Day.js Albanian, and the settings screen exposes Shqip alongside English/Bahasa.
- .env.template now defaults to sq-AL; environment TypeScript declaration includes this locale.
- The React Native checkout/catalog remains tied to a separate **Medusa v2 backend** and publishable API key; it does NOT talk to the FastAPI/SQLite pilot.

## CI and test distinction
- The original upstream source was verified with npm ci + npm run verify (lint, typecheck, Jest) in GitHub Actions: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39825746572
- A new run must pass for the Albanian localization commit before claiming localization checks succeeded.
- This is **not** Android/iOS native build testing. Signing, Gradle, backend and live checkout are unverified.

## Next execution gates
1. Obtain green GitHub Actions native verification on the latest branch HEAD; inspect logs, resolve type/lint/test problems.
2. Set up a Medusa v2 development backend, ALL currency region, products and manual-payment provider without handling real payments.
3. Compile Android debug build in a suitable cloud runner, install in emulator/device and test login, catalog, cart, checkout.
4. Validate language/RTL assumptions, currency prices, local address forms and marketing copy with Albanian reviewers.
5. Design a single authoritative commerce backend and tenant-isolation model before connecting multiple merchants.
6. Only after pilot demand justifies it, evaluate native white-label app generation, app signing and optional alternative APK catalog as described in ADR-004.

## Security and governance
- Branch: feat/native-medusa-poc, based on feat/bootstrap-pwa-mvp. Keep main unchanged.
- The one-time import workflow removed itself after import; no persistent write-token workflow is kept.
- Do not include real keystores, production tokens, personal data or signing keys in git.
- Upstream android/app/debug.keystore is a public debug key from the template, NOT a secure production signing key.
- App Store / Play Store acceptance is not guaranteed; review each business content/provider arrangement and Android developer verification timeline.

## Android emulator realisht i verifikuar — 2026-10-22

- **Github Actions run [39842340691](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842340691): PASSED.** `ubuntu-latest`, Android emulator API 35 / **x86_64**, build-i native React Native me JS të përfshirë, `adb install` dhe nisja e `com.rnstartermedusa/.MainActivity` funksionuan. Kontrolli verifikoi procesin pas 15 sekondash dhe mungesën e `FATAL EXCEPTION` në log-et e filtruara.
- Artefakti `ShqipShop-Android-emulator-launch-report` ruan screenshot dhe crash-log të filtruar: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842340691/artifacts/12454487323 (retention deri më 27 tetor 2026). Screenshot ekziston, **por nuk është audituar manualisht për UI/UX**.
- Ndërtimi arm64 për telefon vazhdon i veçantë: run https://github.com/titanfit102-bit/ShqipShop/actions/runs/39830678418. Të dyja APK-të janë **test-only, të nënshkruara me debug keystore të upstream**, pa kredenciale prodhimi.
- **Nuk ka ende**: lidhje APK→backend Medusa të aksesueshëm, çelës publishable të konfiguruar te APK, checkout në emulator nga UI, instalim në telefon fizik, white-label per tenant, privatësi/siguri production ose pagesa reale.
- **Hapi i radhës:** ngri server Medusa testimi të aksesueshëm nga emulatori, konfiguro çelësin demo pa e vendosur në repository, bëj UI→cart→order real në Android. Gjithashtu provo izolimin e klientëve/porosive/adminëve, release signing dhe remediimin e auditimit të varësive.

