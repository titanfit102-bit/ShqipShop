# Medusa Mobile — Shqip localization integration

Source: https://github.com/bloomsynth/medusa-mobile-react-native (MIT licensed, original authors retain attribution).

**Update (2026-10-22):** The original pilot did not redistribute the source. A separate branch feat/native-medusa-poc now carries the pinned upstream source under native-medusa/ and integrates this locale; this folder remains a reusable patch kit. This folder provides a new Albanian Fluent catalog (`sq-AL.ts`), generator and guarded patch script. It does not connect the native Medusa storefront to the separate ShqipShop prototype backend. The upstream mobile app requires a running **Medusa v2** backend and a publishable API key.

1. Clone upstream into a separate folder and retain its original LICENSE.
2. From this directory, run `python apply_albanian_locale.py /path/to/medusa-mobile-react-native` (dry run).
3. Run again with `--apply` after reviewing the proposed files. No changes are made unless all expected source fragments match.
4. In the native source run `npm ci && npm run verify`, and build on a real Android/iOS environment.
5. Configure its separate Medusa server, inventory, regions and payment providers; test native checkout, notifications, auth and localization.

For individualized native apps, ensure each merchant controls brand and content and follows Apple guideline 4.2.6 and Google Play repetitive-content policies. The native delivery pipeline and Medusa integration are NOT completed by the pilot.

Locale source originated in upstream `app/constants/fluent-templates` design; the Albanian translated strings were written for this project. Before production, review translations with native Albanian speakers and confirm formatting of prices, dates, address forms, and stock messaging.
