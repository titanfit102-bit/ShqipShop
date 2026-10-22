# Working on ShqipShop — repository instructions

## Mandatory orientation in every new session

Read these files **before editing** (they are the durable project memory):

1. [MASTER HANDOFF](docs/MASTER_HANDOFF.md) — user intent, chronological context, real status, decisions and future objective.
2. [PROJECT HISTORY](docs/PROJECT_HISTORY.md) — dated decisions and evidence log.
3. [ADR-003](docs/ADR-003_MEDUSA_NATIVE_VS_CUSTOM_PILOT.md) — why upstream Medusa Mobile + existing PWA pilot must be evaluated in parallel.
4. [ROADMAP](docs/ROADMAP.md) — exit criteria / verification gates.
5. [Architecture](docs/ARCHITECTURE.md), [MVP setup](docs/MVP_SETUP.md), [README](README.md) and the actual code/tests.

Start each resumed session by verifying GitHub branch heads, PRs, workflows, logs and changed files. Handoff is a **historical snapshot**, not a substitute for live verification.

## Core mission — never drift

Build an **Albanian white-label ecommerce platform where each merchant has its own branded storefront and potentially Android/iOS app**, with isolated catalog, orders, customers and inventory. The user brought https://github.com/bloomsynth/medusa-mobile-react-native as intended original client; the current custom FastAPI/SQLite implementation is only a **pilot**, not the final replacement for that native client. Merchant-specific apps are subject to Apple/Google review. Subscription prices in docs are illustrative, not validated.

Do not confuse ShqipShop with Illyrian, Protesto, Builder System, My-phone/Expo, or any other project. Do not mix repositories.

## Working conventions and safety

- **Never modify `main` directly**; use feature branches and draft PR, unless explicit release approval.
- Do not merge, publish to public environments, run live payments, change account billing, delete source/data, force push or use real users' personal data without explicit authorization.
- Always inspect real code/config before modifying. Do not trust stale filenames, branch SHAs, remembered decisions or scripts alone.
- Keep tenant permissions server-side; test cross-merchant access (users, products, orders, assets, settings). Reuse tests for regressions.
- Preserve existing contracts and protect credentials, MIT license notices, exact dependency pins and native platform constraints.
- Baseline CI: Python 3.13, `python -m compileall -q app mobile-medusa`, `PYTHONPATH=. python -m pytest -q`. Existing known good run **at handoff**: https://github.com/titanfit102-bit/ShqipShop/actions/runs/39822589301 (10/10 passed). A new commit needs a new run.
- No claim of native build, Medusa integration, browser/device E2E, production security, billing or app-store acceptance unless verified separately.
- Keep progress reporting honest: implementation versus tests versus deployment versus commercial adoption. For future percentages, define weighted verifiable gates instead of inventing numbers.

## Resume workflow

1. Compare `main`, `feat/bootstrap-pwa-mvp`, and open PR(s); read current CI results.
2. Identify highest-value unresolved gate from ROADMAP and ADR-003.
3. Make the smallest coherent change in isolated branch, with targeted tests.
4. Run and inspect CI logs, not merely job status; do manual browser/device checks when UI changes.
5. Update `docs/PROJECT_HISTORY.md` and `docs/MASTER_HANDOFF.md` with date, accurate status, commit, PR, evidence and next steps.

### Immediate priority

Upstream Medusa Mobile RN has now been imported to native-medusa/ in feat/native-medusa-poc and localized to sq-AL; JS CI passed (see docs/NATIVE_MEDUSA_POC.md). The next missing proof is an **Android debug build plus a Medusa v2 development backend with real test-only checkout**, and 2-merchant isolation. The optional APK catalog is an unimplemented hypothesis (docs/ADR-004_APK_CATALOG_IDEA.md); keep it separate from core white-label SaaS. Choose the production commerce source of truth only after an actual Medusa checkout and two-merchant isolation proof.
