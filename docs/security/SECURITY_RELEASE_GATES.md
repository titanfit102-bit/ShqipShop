# ShqipShop — Security Release Gates (G3 / G5)

**Current decision: BLOCKED — NOT PRODUCTION READY.** Development PR #12 is Draft and stacked on Draft PR #11; no merge, Production deploy, merchant onboarding, real charge, release signing or branch-admin mutation is authorized. A CI-green PR is **not** equivalent to safe release.

## Gate definitions

| Gate | Required demonstrable evidence | Current decision |
| --- | --- | --- |
| RG-01 tenant boundary | Independent merchant Medusa/DB/Redis/secrets/media configuration; signed-in/anonymous/guest/admin negative GET+mutation+refund/fulfillment tests and real staging tenant boundary review | BLOCKED (G3 partial) |
| RG-02 identity/privacy | Server-side JWT expiry/revocation and logout/device policy, secure native token store, RBAC and object ownership, CSRF/CORS/cookie/TLS tests | BLOCKED (F08 open) |
| RG-03 cart/order/payment | Server quote+explicit buyer acceptance from authoritative cart; atomic stale/race/replay protections, exactly-once business effects, idempotent retries, PSP sandbox/webhook signature/refund reconciliation | BLOCKED (F07g helper only) |
| RG-04 mobile | Distinct secure production signing key and rotation procedure, reproducible signed release, no dev HTTP/keys, MASVS/MASTG device review, privacy, safe build artifact provenance | BLOCKED (debug signing in release build config) |
| RG-05 supply chain | Tracked secret scan with zero validated exposed credentials or revoked findings, SAST/CodeQL and dependency findings triaged; high/critical exploitable issues resolved/explicitly risk-accepted with recorded owner | BLOCKED (insufficient evidence) |
| RG-06 infrastructure | HTTPS/HSTS, edge rate limiting/WAF, least-privilege DB/Redis/backup IAM, restores, logging/alerts, retention/privacy, disaster recovery and incident tabletop exercise | BLOCKED (no verified production deployment) |
| RG-07 one commerce authority | PWA/native use one authoritative Medusa domain per merchant; no split-source orders, prices or inventory | BLOCKED (F09 open) |
| RG-08 independent acceptance | Regression evidence linked to **current release SHA**, relevant mobile/browser E2E, cross-tenant attack cases, independent review and explicit release authorization | BLOCKED |

**Fail policy:** any confirmed tenant leak, stale/unapproved charge, unrecoverable backup, exposed signing/production secret, actively exploitable severe dependency, debug-signed public APK, or failed critical authorization test blocks release. Failed checks require a validated remediation, not a skipped job. UNKNOWN critical gates also block release; `NOT APPLICABLE` only with written business and architectural justification.

## GitHub enforcement proposal — NOT activated

- Create a security baseline workflow that fails on supported high-confidence secret indicators and unsafe workflow privilege patterns. Document precise scope; it does **not** replace repository-wide hosted secret scanning, CodeQL or historical leak investigation.
- Keep `verify.yml`, native, Medusa backend and two-tenant tests; add blocking dependency severity policy **after inspecting advisories** instead of silently converting the old report to PASS.
- Run CodeQL (JavaScript/TypeScript, Python) with pinned official actions on high-risk PR changes + periodic schedule if compatible with repository settings; confirm code-scanning state to avoid duplicate setup/cost.
- Configure GitHub branch protection/required checks, pull-request approvals and CODEOWNERS **only after separate admin authorization**. Protected `main` configuration could not be inspected: GitHub API returned 403 (UNKNOWN, not OFF).
- Integrations deploying releases must independently check release gates and signed artifacts; a documentation checkbox is not an enforceable deployment block until actual deployment policy is wired.

## Required release evidence

Release SHA and reproducible build, signed artifact digest, GitHub checks (no failed/pending mandatory jobs), severity triage IDs, tenant isolation/PSP/device test artifacts, restore/incident evidence, authorized release owner, rollback procedure and dated acceptance record kept in appropriate private system. Never place real secrets, attack reproduction payloads or customer data in public logs.

Next: keep development on `feat/merchant-auth-boundary-ci`; resolve F07g Stage 2, F08 and release-signing/token storage in scoped increments; revisit this gate prior to any staging/live merchant.
