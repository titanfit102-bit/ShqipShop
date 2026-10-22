# Android product → variant → cart → PostgreSQL proof

**Status:** automated POC in [PR #5](https://github.com/titanfit102-bit/ShqipShop/pull/5); verify CI conclusion live. No production storefront or merchant data.

## Mechanism
The original React Native app is built into an x86_64 emulator APK with a runner-local Medusa publishable API key and localhost gateway `10.0.2.2:9000`. The backend is a temporary PostgreSQL + Redis + Medusa v2 stack seeded with Albania/ALL demo data. Workflow `.github/workflows/android-medusa-ui-cart.yml` boots an Android 35 emulator.

`native-medusa/scripts/shqipshop-ui-automation.py` inspects Android's actual UIAccessibility hierarchy and taps on visible labels. `native-medusa/scripts/android-ui-cart.sh` opens Medusa Shorts → selects variant S → uses the app's original Add-to-cart logic → opens cart, verifies the product and checkout button are rendered. The workflow then executes `medusa-backend-poc/apps/backend/src/scripts/assert-android-ui-cart.ts` against the **actual Medusa PostgreSQL data**. This is an independent server-side check that a single Medusa Shorts unit is present in an ALL cart.

## Proof required
- `SHQIPSHOP_ANDROID_UI_CART_PASSED` from emulator, plus non-empty `final-ui.png`.
- `SHQIPSHOP_ANDROID_CART_PERSISTED_IN_POSTGRES_PASSED` from Medusa query.
- GitHub Actions conclusion `success`.
- No fatal Android crash, no use of live data, and public test-only debug key.
- Any red run must have its precise cause investigated before a green claim.

## Non-goals and security boundaries
This is **not** Android checkout, order placement, account login, payment integration, Play Store release or full multi-tenant isolation. The client signing is test-only and HTTP localhost allowance and store publishable key are injected only inside the disposable runner, not committed to the repository or exported as APK artifact. Crash logs are filtered and the UI hierarchy is not uploaded. Native dependency advisories remain unresolved.

## References
- [Workflow and runs](https://github.com/titanfit102-bit/ShqipShop/actions/workflows/android-medusa-ui-cart.yml).
- [Initial run 39867727695](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39867727695).
- [Earlier successful connected Android catalog](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39845817408).
