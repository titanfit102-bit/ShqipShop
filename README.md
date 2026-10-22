# ShqipShop

**Status:** Implementation import pending. This repository is not deployed and is not production-ready.

ShqipShop is an Albanian white-label commerce platform intended to let each merchant operate an independent branded storefront with separate products, orders, administration and inventory.

## Source package created

The initial 30-file prototype is available as `shqipshop-platform-mvp.zip` in the originating ChatGPT conversation. It has **not** yet been committed to this repository. The original ZIP contains:

- FastAPI backend and SQLite local pilot database
- Multi-merchant PWA storefronts and tenant-scoped merchant admin
- Albanian interface, ALL currency, manual cash-on-delivery ordering
- Inventory, order state transitions, CSRF/session safeguards
- React Native Medusa Albanian localization kit (not a full native integration)
- 8 local tests, Dockerfile, CI workflow and setup documentation

**Do not mistake this branch for a working deployment.** GitHub Actions, live Medusa, real payment integrations, subscriptions, production database hardening and mobile binaries all remain unverified or unimplemented.

## Next steps

1. Import the 30 source files from `shqipshop-platform-mvp.zip` into this branch (omit the outer `shqipshop-platform/` folder), preserving paths including dotfiles.
2. Review the source and security invariants before accepting it as a baseline.
3. Run `pip install -r requirements-dev.txt`, `python -m compileall -q app` and `PYTHONPATH=. pytest -q` in GitHub Actions.
4. Review all changes in a pull request before merging into `main`.
5. Validate storefront and admin flows in a browser, then plan hardened PostgreSQL multi-tenancy and Medusa integration.

## Architectural boundary

The current pilot is **FastAPI + SQLite**, not a deployed Medusa backend. The Medusa Mobile React Native repository is MIT-licensed; when importing or modifying its source later, preserve its upstream license and attributions. Keep ShqipShop independent of other repositories and do not use real customer or payment details in local demos.
