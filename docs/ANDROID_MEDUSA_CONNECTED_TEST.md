# ShqipShop — Real Android ↔ Medusa catalog integration

**Purpose:** This test is an integration milestone, not a production deployment.

## Architecture of the test

GitHub Actions job on `feat/android-emulator-smoke` provisions PostgreSQL 16 / Redis 7 / Medusa 2.22.0 on the runner, seeds the Albanian demo region (currency ALL, 4 demo products), and creates an ephemeral *publishable* API key bound to the default sales channel. In the same runner it builds an actual React Native x86_64 APK with key and backend URL `http://10.0.2.2:9000`. Android emulator's special host gateway `10.0.2.2` points to the runner host where Medusa is serving on port 9000.

The workflow **temporarily** allows Android cleartext loopback HTTP in its disposable checkout. The source repository manifest is unchanged. All regular production app builds must use an HTTPS endpoint. Publicly tracked debug signing keys are only for test APKs.

## Acceptance

- Runner verifies Medusa HTTP `/health` + `/store/products` with seeded `Medusa T-Shirt`.
- Actual Android emulator boots, installs the bundled APK and starts `MainActivity`.
- After remote region/catalog queries, UI accessibility hierarchy contains one of the seeded product titles. No Android fatal exception and a nonempty screenshot.
- Marker: `SHQIPSHOP_ANDROID_REAL_MEDUSA_CATALOG_PASSED`, plus GitHub Actions job conclusion `success`.
- Screenshot and filtered crash log uploaded as `ShqipShop-Android-Medusa-connected-catalog` artifact. The full UI hierarchy is **not uploaded**, to avoid leaking screen text. The artifact is a screenshot, not a production APK.

## Not tested yet

Native product-detail→variant→cart, address form, shipping choice, manual payment, order placement from UI; full merchant isolation; real courier/payment processing; secure build signing; iOS; physical device. Existing order in Medusa was made by a **Node.js HTTP test client**, not Android. Do not label the entire commerce path end-to-end until an Android UI order and a PostgreSQL order record have been proved in the same runner.

## Historical execution

- Workflow: https://github.com/titanfit102-bit/ShqipShop/actions/workflows/android-medusa-catalog.yml
- Initial run: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408.
- Last observed before this document: backend's HTTP catalog was ready, APK was compiling. **Outcome is not asserted by this document; verify live.**

## Real prior emulator UI inspected (2026-10-22)

Downloaded [artifact 12454487323](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39842340691/artifacts/12454487323) from the earlier **disconnected** Android launch run and visually inspected `emulator-launch.png`. The APK launches to a stable home screen with Albanian navigation labels (Kryefaqja, Kategoritë, Koleksionet, Profili) but the catalog displays **"Something went wrong, Please try again later"** and header still says **"MEDUSA MOBILE"**. This **is not** a successful catalog test: the backend/key was missing in that run. Do not present the earlier emulator's green launch test as proof of working store data, and do not publish unchanged upstream branding.

The new integration workflow must replace this error state with actual demo product titles, verified through Android UI hierarchy and screenshot. A green build without catalog validation is insufficient.
