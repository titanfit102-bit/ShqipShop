# Android APK — internal build and validation

**Date:** 2026-10-22 · **Scope:** only the Medusa Mobile React Native proof-of-concept under `native-medusa/` on `feat/native-medusa-poc`.

## Why this build exists

We are verifying that a real native Android application can be produced from the imported MIT-licensed Medusa Mobile source. This is **not** an app catalog/alternative Play Store and is **not** the final white-label generator. The commercial product remains one branded storefront and potentially one Android/iOS app **per independent merchant**.

## GitHub Actions workflow

[`build-android-internal.yml`](../.github/workflows/build-android-internal.yml) runs on changes to native source or this workflow, and can be manually dispatched when appropriate.

- `ubuntu-latest`, Node 24, project-pinned npm, JDK 17, Android build tools/compile SDK **36** and NDK 27.1.12297006.
- Original upstream had compile SDK/build tools 37, unavailable from `sdkmanager` on this GitHub runner; changed to **36** while keeping target SDK 36.
- Runs `./gradlew :app:assembleRelease` for **arm64-v8a** only so the JavaScript bundle is embedded. This is necessary for a standalone tester APK rather than a standard dev-server-dependent `assembleDebug` app.
- **CRITICAL:** The upstream release configuration currently signs with the public **debug.keystore**, so the resulting APK is **NOT a production release** despite the Gradle task named `assembleRelease`. Never distribute to merchant customers or publish to Google Play with this signing configuration.
- Uses public disposable `.env.template`: `DEFAULT_LOCALE=sq-AL`, `MEDUSA_BACKEND_URL=http://10.0.2.2:9000`, `PUBLISHABLE_API_KEY=` (empty). This APK has **NO REAL BACKEND**, products and checkout will not function without a correctly configured Medusa v2 development server and a separate build with its publishable key.
- The artifact name ends in `INTERNAL-debug-signed`. If successful, it is accessible under the GitHub Actions run's **Artifacts** section, retained for three days. It is a GitHub-hosted archive containing `app-release.apk`, not an APK published to any app store. The repository is public, so treat artifacts and hashes as public.

## Test gates

1. **Build gate:** GitHub Actions concludes success, artifact exists and is nonempty, hash logged.
2. **Install gate:** APK is installed on physical Android arm64 device or suitable emulator, app launches without a native crash. This is **not proven by a green build**.
3. **Locale/UX gate:** Albanian texts display correctly and common device sizes are checked.
4. **Backend gate:** Configure a disposable Medusa v2 server, region/currency ALL, demo products, stock, shipping, manual payment, and link the client using its publishable API key. API URL must be reachable from device; emulator `10.0.2.2` maps to local host, not GitHub.
5. **Checkout gate:** With test-only customer data, perform browse → cart → checkout → order → stock update in the same commerce backend.
6. **Merchant isolation:** Test two stores with independent products/customers/orders and server-side auth. Do not share merchant data based only on a client-side store picker.
7. **Release gate:** Replace public debug keystore with secure merchant-appropriate signing, secrets storage, audit/update pipeline, privacy/legal checks, live merchant verification, and platform policies.

## Security and accuracy

- `npm ci` during the initial build emitted a dependency audit summary indicating **64 vulnerabilities (19 moderate, 44 high, 1 critical)**. This is a *tool-reported dependency count* and not proof that all are reachable/exploitable in the runtime. A focused dependency audit and safe upgrade plan are required **before any public deployment**; do not apply `npm audit fix --force` blindly.
- Upstream `android/app/debug.keystore` is publicly tracked and must never sign a customer production app.
- No merchant billing, APK signing service, Play Store publishing, production backend, full E2E or real payment processing is implemented.
- Store historical CI run links only after checking their conclusion; GitHub workflows execute asynchronously.

## Current iteration notes

- Initial build workflow attempt: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39830420989 **failed while installing missing `platforms;android-37`**, before compiling Java/Kotlin or the application.
- SDK compatibility fix: `native-medusa/android/build.gradle` compile/build-tools changed to 36, and workflow installs `platforms;android-36`, `build-tools;36.0.0`.
- Follow-up build workflow: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39830678418. **Verify result live** before claiming a usable artifact.
