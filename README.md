# ShqipShop

**White-label ecommerce pilot for Albanian merchants** · **Status: prototype / local pilot only**

ShqipShop is a multi-merchant, Albanian-language storefront and merchant admin platform. Each merchant has a separate catalog, branding, inventory and order data. The current implementation is a **FastAPI + SQLite PWA pilot**, not a Medusa production backend. No real online payments, merchant subscriptions, native Android/iOS apps or public production deployment exist yet.

## What's implemented

- Storefront per merchant under `/s/<merchant-slug>/`, with Albanian UI and ALL (Lekë) pricing
- Product search, category filters, cart and cash-on-delivery order placement
- Merchant-only admin for products, stock, order status and store branding
- Server-calculated prices, order idempotency, tenant-scoped queries, password-backed sessions and CSRF validation
- PWA manifest, dynamically generated icons, and an intentionally network-only service worker
- An **optional localization kit** for the separate MIT-licensed Medusa Mobile React Native app in `mobile-medusa/` (translation pack only — **no native build or live Medusa integration**)
- GitHub Actions regression checks on pull requests and pushes to `main`

## Local setup

Requires Python 3.13+:

```bash
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
python -m app.cli init
python -m app.cli seed-demo
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000` for demo storefront links. Demo shops are fictitious; they do not include merchant admin accounts.

For a merchant you administer locally, use an interactive password prompt:

```bash
python -m app.cli create-merchant --slug butik-test --name "Butiku Test" --email admin@example.com
```

Then open `http://127.0.0.1:8000/admin/butik-test/login`.

## Tests

```bash
python -m compileall -q app mobile-medusa
PYTHONPATH=. python -m pytest -q
```

The PR CI runs the same checks. These are **unit/API checks**, not real merchant onboarding, payment testing, mobile-browser end-to-end testing or a production security audit.

## Documents

**Start here when resuming in a new ChatGPT conversation:** [MASTER HANDOFF](docs/MASTER_HANDOFF.md). It links to the complete history, architecture decision, roadmap and next verified steps.

- [Master handoff / new conversation](docs/MASTER_HANDOFF.md)
- [Chronological project history](docs/PROJECT_HISTORY.md)
- [Medusa Mobile original versus custom PWA — ADR-003](docs/ADR-003_MEDUSA_NATIVE_VS_CUSTOM_PILOT.md)
- [Evidence-based roadmap](docs/ROADMAP.md)
- [Repository working instructions](AGENTS.md)
- [Setup and known limitations](docs/MVP_SETUP.md)
- [Architecture, tenancy and production gates](docs/ARCHITECTURE.md)
- [Medusa translation kit](mobile-medusa/README.md)
- [Offline UI demonstration](PREVIEW_OFFLINE.html) — visuals only, not real checkout

## Safety and next milestones

**Do not expose this pilot publicly or collect real customer data yet.** SQLite, in-memory throttling, placeholder privacy text and undeployed HTTPS/TLS do not satisfy a production launch. Next: browser/device testing; tenant auth hardening; durable PostgreSQL migrations and backups; validated local payments/courier workflows; onboarding/billing; privacy and operational readiness; native app build tests where needed. Do not merge a draft PR as a production release.

The upstream `bloomsynth/medusa-mobile-react-native` application is MIT-licensed; this repository does **not** include its code. Any future incorporation must preserve its license and attribution.
