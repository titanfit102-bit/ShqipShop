# ShqipShop · Albanian White-Label Commerce Pilot

**Status:** local functional MVP/prototype, **NOT production**, **NOT deployed**. Separate from the user's other projects. No real payments, public registration, merchant billing, Medusa integration, or Android/iOS builds yet.

The repository builds a **multi-merchant mobile-first store platform** where each merchant has its own catalog, theme, order pipeline, session-protected admin and installable PWA. Albanian is the UI language and ALL (Lekë) is the default currency. An optional integration kit can localize the upstream `bloomsynth/medusa-mobile-react-native` application; see `mobile-medusa/README.md`. The PWA pilot backend is FastAPI/SQLite, **not Medusa**, and must not be mistaken for the upstream app.

## Run locally

Requires Python 3.13+, pip. In the repo root:

```sh
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows: .venv\\Scripts\\activate
pip install -r requirements-dev.txt
python -m app.cli init
python -m app.cli seed-demo
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- Home: http://127.0.0.1:8000
- Demo boutique: http://127.0.0.1:8000/s/butiku-era/
- Demo electronics: http://127.0.0.1:8000/s/tech-alba/
- Demo perfume: http://127.0.0.1:8000/s/aroma-studio/

**Important:** The demo shops are fictitious. They have no merchant admin accounts; do not use real personal data for demo orders. To test the admin, create a new tenant with an interactive password prompt:

```sh
python -m app.cli create-merchant --slug butik-test --name "Butiku Test" --email admin@example.com
# Then go to http://127.0.0.1:8000/admin/butik-test/login
```

For an automated secure provisioning environment, set `SHQIPSHOP_NEW_MERCHANT_PASSWORD` via the environment or secret manager, never via command-line flags or committed files. Passwords must be 12+ characters. Do not reuse production secrets.

### Tests

```sh
PYTHONPATH=. pytest -q
```

Automated tests check tenant separation, duplicate order prevention, CSRF, validation, inventory decrement and restoration, access control, PWA routes and XSS escaping. These tests do **not** verify web browser layout or production-hosted behavior. GitHub Actions CI has been configured and its baseline run [39822589301](https://github.com/titanfit102-bit/ShqipShop/actions/runs/39822589301) verified 10/10 pytest passing on commit `2a8b1d1bd3c98a34149d4056097768003c0178cc`. Later commits require separate CI verification; this is not device E2E or production validation.

## Architecture

```text
Browser / PWA: /s/<merchant-slug>/  → Storefront HTML, CSS, JS
                                            |
                                            v
                                   /api/stores/<slug>/orders
                                            |
                                       SQLite pilot DB
                                            ^
                                            |
Merchant: /admin/<merchant-slug> → Protected sessions + CSRF
Operator: python -m app.cli      → Local provisioning (no public signup)

Future (not implemented): SaaS billing, PostgreSQL, dedicated RN Medusa apps,
managed Medusa v2 backend/store per merchant, Play/App Store release automation.
```

All tenant reads/writes are scoped by merchant ID. Session hashes, inventory transactions and payment/COD status are server-side. Prices are integer `ALL` units (Lekë), calculated from database product prices, not from the client. No HTTPS termination is provided in the pilot server; use TLS reverse proxy if ever deployed.

## Limitations and security gates

- SQLite is for local or tightly controlled pilots; scale to PostgreSQL with tenant-scoped row-level authorization or isolated databases, migration scripts and backups before a public SaaS launch.
- **DO NOT expose this pilot on the public internet** without reviewing auth/security, rate limiting (currently in-memory), CSRF/login, backup/restore, order abuse, XSS, privacy policy, retention/deletion, transport security, tenant authorization and load tests.
- `SHQIPSHOP_SECURE_COOKIES=1` must be set behind HTTPS. The Dockerfile defaults to secure cookies.
- Real seller onboarding, email/SMS verification, legal terms, invoicing, subscriptions, taxes, billing, courier tracking, and real payment gateways are **not implemented**.
- PWA offline navigation/data caching is intentionally disabled so private/customer data isn't cached. PWA installability and browser compliance need device validation.
- The user-facing privacy notice is placeholder wording and **not** a lawyer-reviewed GDPR/Albania privacy policy.
- Native React Native/Medusa checkout flows are a separate product branch; the catalog localization is present but native builds, backend integration and release signing are **unverified**.
- New business domains and automated per-tenant subdomain provisioning are **not implemented**; current storefront URLs are `/s/<slug>/`.

## Development phases (measurable)

| Phase | Current status | Exit criterion |
|---|---|---|
| 0. Source inspection and decision | Completed | Medusa licensing, multi-tenancy and mobile constraints documented |
| 1. Albanian multi-merchant PWA prototype | Automated checks passing | Full browser/mobile and 3 demo store journeys |
| 2. Native Medusa app localization | Translation pack only | Upstream clone patched; native `verify`/Android/iOS tests |
| 3. Production multi-tenant backend | Not started | PostgreSQL, migrations, tenant security, billing and backup |
| 4. Payments, couriers and merchant activation | Not started | Real end-to-end merchant pilot using test payments |
| 5. Production launch | Not started | Security/legal/QA gates and app stores approved where applicable |

## Upstream reuse and licensing

https://github.com/bloomsynth/medusa-mobile-react-native is MIT-licensed. If combining its code with this project, retain the upstream LICENSE and authorship notices. Historical note: the original pilot did not copy the upstream application. The separate native POC branch now includes the pinned original source under native-medusa/ with upstream LICENSE and an integrated Albanian localization. See NATIVE_MEDUSA_POC.md; this pilot FastAPI backend is still separate from Medusa. This distinction is critical to architecture and license compliance.

## Platform release rules

Apple App Review Guideline 4.2.6 states that apps generated from commercial templates should generally be submitted by the content provider (merchant); a single aggregator app is an alternative. Google Play rejects highly repetitive apps. Independent native apps per merchant are therefore premium options, not promised automatic approvals.

Sources:
- https://developer.apple.com/app-store/review/guidelines/
- https://support.google.com/googleplay/android-developer/answer/9899034/spam
- https://docs.medusajs.com/resources/commerce-modules/store

## Next verified milestone

Validate the same buyer-to-merchant process with 3 real business owners using test data; choose between Medusa-backend per tenant and a shared custom backend based on actual SKU/order/payment needs. Do not enable subscription billing or live payments without verifying local providers and contractual/legal requirements.
