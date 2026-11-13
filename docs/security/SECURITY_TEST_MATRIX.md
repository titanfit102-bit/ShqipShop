# ShqipShop — Security Test Matrix

## 2026-11-14 — N02 registration JWT scoped security matrix

| Scenario in real `CustomerProvider`, mocked SDK/storage | Pre-fix | Corrected CI |
| --- | --- | --- |
| A signed-in → logout → B registration JWT is used for `customer.create` → final B login JWT | [#43528338763](https://github.com/titanfit102-bit/ShqipShop/actions/runs/43528338763) FAIL | [#43528981412](https://github.com/titanfit102-bit/ShqipShop/actions/runs/43528981412) PASS |
| A's late registration after logout/B cannot issue `customer.create` or replace B | FAIL | PASS |
| Registration SDK token-storage failure must clear old A principal and block bearer | FAIL | PASS |
| `customer.create` 503 must clear interim registration JWT; later B login succeeds | Added after fix | PASS |
| Persisted wrong JWT must prevent `customer.create` | Added after fix | PASS |
| Existing native suites + TS/lint | 86 old PASS | **91/91 PASS**, 16 suites |

[Red test commit ee93034](https://github.com/titanfit102-bit/ShqipShop/commit/ee93034c215fe75657a3e07dc19f0229365e6f12), [source fix b92f13a](https://github.com/titanfit102-bit/ShqipShop/commit/b92f13ab366671294db4210f9757945e90d05595), [additional tests 2fc6d4b](https://github.com/titanfit102-bit/ShqipShop/commit/2fc6d4b003fec9cfbcfd03c80f7e33ea90ebd7e1). **Coverage is mock-backed and cannot certify actual SDK Authorization header, Medusa server identity ownership, email-verification variations, network crash/partial-create recovery, device process restart or Production policies.** N02 PARTIAL; N01/N04 release device gaps and R01/R02/R03 all OPEN. Next exact installed SDK controlled transport test (not real accounts).



## 2026-11-13 — N04 native SDK JWT transition acceptance (mocked provider)

| Scenario | Before | After scoped fix | Remaining limitation |
| --- | --- | --- | --- |
| Delayed A SDK login completes after logout | [CI #43512841854](https://github.com/titanfit102-bit/ShqipShop/actions/runs/43512841854) FAIL | [CI #43513780394](https://github.com/titanfit102-bit/ShqipShop/actions/runs/43513780394) PASS; A superseded | No actual SDK request or device |
| Delayed A token after logout while newer B login queued | FAIL | PASS; B only JWT/profile, A rejected | Backend A/B tenant/owner policy untested |
| Direct A/B overlapping logins, no logout | Not measured pre-fix | PASS; B wins, A rejected | SDK delayed/unawaited writes after resolution UNKNOWN |
| Prior A login fails; next B retry queued | Not measured pre-fix | PASS; B accepted | Never-settling request requires timeout policy |
| Existing native source suite | 82 pre-existing PASS | **86/86 (16 suites) PASS**, lint and TypeScript | N02 register bootstrap, native real-device session and server revocation OPEN |

[Pre-fix tests](https://github.com/titanfit102-bit/ShqipShop/commit/cb04478a6ad0f356a0fc3b8a511d2aeb47288a51), [N04 code](https://github.com/titanfit102-bit/ShqipShop/commit/f0faac8a90f0c494c777f34334b6346fd865bfc3), [additional cases](https://github.com/titanfit102-bit/ShqipShop/commit/b78ba5ba91ca3fa9d670129d6f28f121f31b96ed). N04 PARTIAL/OPEN; NO RELEASE, R01/R02/R03 unaffected.



## 2026-11-13 — N01 actual nested native React providers (mock SDK + storage)

| Real React providers + mocked I/O | Verified result | Missing acceptance |
| --- | --- | --- |
| A login/cart → delayed A update → logout (token deletion delayed) → new guest cart → B login/cart transfer | PASS: customer B, B JWT and B cart intact, no A PII in context | Real Medusa HTTP, server owner/tenant gate, Android E2E |
| Provider unmount/restart after `cart_id` deletion failure and persisted pending tombstone | PASS: no A retrieve, error fail-closed while disk broken; repaired storage allows new guest cart | True OS process-kill and both marker write + ID deletion failing |
| Existing regressions + lint + TypeScript | [CI #43333136692](https://github.com/titanfit102-bit/ShqipShop/actions/runs/43333136692) **82/82**, 16/16 suites | N04/N02 and Production gates separate |

[Test commits db6f42d](https://github.com/titanfit102-bit/ShqipShop/commit/db6f42d36c78b38caa9158987cac5cba35276f6f) and [7bea52d](https://github.com/titanfit102-bit/ShqipShop/commit/7bea52d775e73aba6d786c780bd3bb5a9c10a34b). Earlier [#43332871763](https://github.com/titanfit102-bit/ShqipShop/actions/runs/43332871763) 81 PASS/1 FAIL due cross-test mock leakage, **not app defect**. No runtime code changed. N01 PARTIAL and release BLOCKED; next N04 red-before stale login and B session ownership.


## 2026-11-13 — N01 phase 2 exact pre/post native CI evidence

| Case | Before | After | Scope |
| --- | --- | --- | --- |
| Logout starts reset before async token deletion | [#43330845234](https://github.com/titanfit102-bit/ShqipShop/actions/runs/43330845234) FAIL | [#43331293749](https://github.com/titanfit102-bit/ShqipShop/actions/runs/43331293749) PASS | CustomerProvider with mocked cart dependency |
| Interrupted reset persists tombstone before `cart_id` delete | FAIL | PASS | CartProvider mock AsyncStorage |
| Boot with pending tombstone never retrieves old private ID if deletion still fails | FAIL | PASS | `restoreOrCreateCart` actual function, mock disk |
| Checkout delayed A response cannot commit after reset/guest, while valid guest response can | New tests | Both PASS | Actual CartProvider scoped task; mock operation |
| Native verify | 3 new failures, 75 existing PASS | **80/80 PASS**, lint+TypeScript | Jest; NOT Android device or live HTTP |

[Code eb46444](https://github.com/titanfit102-bit/ShqipShop/commit/eb464441593407b352bf95455ba8ba592fa66b00). **Still required:** actual combined providers A→logout→guest/B, marker write+remove failures on process restart, lost in-flight authentication/checkout responses and native E2E. Do not call N01 COMPLETE; R01/R02/R03 gates unaffected.


## 2026-11-13 — N01 native cart generation regression (scope-only)

| Exact evidence | Before | After | Remaining gate |
| --- | --- | --- | --- |
| Delayed A update cannot restore A into guest B/cart | [CI #43329067146](https://github.com/titanfit102-bit/ShqipShop/actions/runs/43329067146) FAIL | [CI #43329750761](https://github.com/titanfit102-bit/ShqipShop/actions/runs/43329750761) PASS | Real CustomerProvider logout/SDK race |
| AsyncStorage cart ID remove throws: private React cart immediately hidden | FAIL | PASS | Persisted tombstone + restart/retry if deletion fails |
| Delayed cart transfer cannot overwrite new guest cart | FAIL | PASS | Native E2E / cross-account B isolation |
| Matching current guest cart update succeeds | Not a pre-fix regression | PASS | Full checkout integration |
| ESLint/TypeScript/15 Jest suites | 3 new tests FAIL; 71 prior PASS | **75/75 PASS** | Neither proof certifies real device/Production |

Source [f3a1641](https://github.com/titanfit102-bit/ShqipShop/commit/f3a1641b143504e31180d64607850a735024ed30) and tests [00400c1](https://github.com/titanfit102-bit/ShqipShop/commit/00400c1c386273862891770ac11a58f754996282); rollback/fail-closed no skip. N01 overall PARTIAL/OPEN. **Next:** integrated providers logout/startup, external checkout setter, fail-storage restart and ghost storage writes; red-before/green-after then review. All other audit findings and RG remain unchanged.



## 2026-11-13 — Independent audit native/customer/receipt regression gaps (proposed, NOT run)

| Test family | Positive required | Negative/failure required | Current classification |
| --- | --- | --- | --- |
| N01 CartProvider + CustomerProvider | guest cart and account switch preserve appropriate cart | A's delayed update/transfer/create/retrieve after logout cannot set React state or saved cart ID; failed remove, restart cannot expose A PII | Missing integrated regression; audit harness reproduced problem |
| N04 SDK token lifecycle | new legitimate login B after A/logout | stale A login completes after logout/B; no stale JWT persisted/unblocked on restart | Missing race regression |
| N02 registration | initial and post-logout bootstrap registration | no old JWT resurrection; storage failure/401/retry without duplicate customer | Missing live auth-contract integration |
| N03 completed cart | active 200 reuse and valid receipt recovery | completed 200 does not become live cart; lost ACK/restart, 404/410, 5xx/offline no double completion | Missing specific branch/e2e |
| N05 Next guest receipt | guest order proof accepted then refresh/restart; owner signed in allowed | ID-only/foreign cart/tenant denied, proof absent from URL and shared caches | Missing Next server+browser E2E; conditional client |
| R01 / R02 / R03 | captured-refund, legit Admin session, patched query semantics | overrefund/zero capture/concurrency, real form CSRF without auth bypass, malicious dotted query paths | R01 FAIL, Stage12AG scoped CI PASS/global OPEN, R03 baseline OPEN |

These are **planned acceptance criteria**, not new test executions. Keep existing green positives and known-red financial sentinels; do not turn acceptance failures into skipped tests. Device/emulator, dependency changes and Production security require separate approvals. Refer to [ROADMAP](../ROADMAP.md) and [SECURITY_REGISTER](SECURITY_REGISTER.md).


## 2026-11-12 — Stage12AG exact isolated Medusa 2.22.6 region regression

| Admin region-name mutation (synthetic CI only) | Actual HTTP/browser | PostgreSQL | Status |
| --- | --- | --- | --- |
| A Admin trusted JSON POST | **200** | Changed, then restored | VERIFIED |
| Missing Admin cookie / A customer cookie / B Admin cookie | **401 / 401 / 401** | NO_CHANGE | VERIFIED |
| External-Origin direct JSON with valid A Admin cookie | **403** | NO_CHANGE | VERIFIED |
| Recent server-cookie Chromium attacker top-level form (Cookie sent) | **403** | NO_CHANGE | VERIFIED |
| Chromium default cookie iframe (Cookie omitted) | **401** | NO_CHANGE | Cookie denial, NOT server CSRF proof |
| Chromium controlled None;Secure iframe/top-level (Cookie sent) | **403 / 403** | NO_CHANGE | VERIFIED |
| Chromium external-origin JSON credentialed fetch, both cookie policies | CORS preflight; no POST | NO_CHANGE | VERIFIED |
| Existing protected profile/product paths | CI regression GREEN | No unauthorized mutation | VERIFIED scope only |
| Other unsafe Admin/Store/Auth routes and Production | UNKNOWN | UNKNOWN | OPEN |

[Stage12AG code 8af9bd3](https://github.com/titanfit102-bit/ShqipShop/commit/8af9bd36f7152dd3ab0d76404ae6a13df48972ae); [isolated Medusa 2.22.6 Chromium/AOF/PostgreSQL CI #43325401851](https://github.com/titanfit102-bit/ShqipShop/actions/runs/43325401851) **SUCCESS**; exact code SHA: **8 workflows SUCCESS, 1 mandatory financial FAILURE** ([pinned 2.22.0 #43325401868](https://github.com/titanfit102-bit/ShqipShop/actions/runs/43325401868)). Six isolated policy-unit checks **PASS/0 FAIL**. See [SECURITY_ARCHITECTURE](SECURITY_ARCHITECTURE.md) for a non-deploying proposal covering session CSRF tokens, bearer/mixed auth, guest cart capabilities, proxy trust and actual route coverage. Finance P0 remains FAILED; no release.


## 2026-11-11 — Stage12AF Admin region real HTTP / Chromium / PostgreSQL matrix

| Scoped Medusa 2.22.6 CI case | Browser/HTTP | Persisted? | Interpretation |
| --- | --- | --- | --- |
| A Admin trusted JSON region-name POST | 200 | Yes; then restored | Positive authorized mutation |
| No-cookie / customer cookie / B Admin cookie POST | 401 / 401 / 401 | No | Auth/role/tenant denial |
| Foreign Origin direct JSON with A Admin cookie | **200** | **Yes; then restored** | Server Origin trust gap (direct client) |
| Chromium attacker iframe, default cookie omitted | 401 | No | Cookie not sent, not protection proof |
| **Chromium attacker top-level form, default recent cookie sent** | **200** | **Yes; then restored** | **Browser-real Admin region CSRF** |
| **Chromium attacker iframe, browser None;Secure cookie sent** | **200** | **Yes; then restored** | **Browser-real CI fixture CSRF** |
| **Chromium attacker top-level, browser None;Secure cookie sent** | **200** | **Yes; then restored** | **Browser-real CI fixture CSRF** |
| Chromium cross-site JSON fetch both cookie policies | CORS preflight; no POST | No | Cannot substitute for form protection |
| Existing Stage12AE Admin product cross-site forms | 403 when Cookie sent | No | Narrow CI-only product guard still works |
| Production / other Admin and Store mutations | UNKNOWN | UNKNOWN | CSRF release gate OPEN |

[Stage12AF code d5cbea7](https://github.com/titanfit102-bit/ShqipShop/commit/d5cbea7d4a0bebf163d225927efec44f99265f6e); [Medusa 2.22.6 disposable Chromium/AOF/PostgreSQL CI #42931945599](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42931945599) **SUCCESS as an evidence-gathering test, NOT protection**. The installed compiled export inventory explicitly showed `POST /admin/regions/:id` (separate from three Stage12X/12AE protected profile/product matchers). We selected ONLY the synthetic Albania region's **name**; no currency, tax, shipping provider, price, payment or order configuration was changed.

Authenticated A Admin JSON POST from trusted Origin returned **200 and persisted** a reversible region-name change. No cookie, A customer cookie and B Admin cookie returned **401** and changed no PostgreSQL row. An external-Origin JSON POST **manually carrying A Admin cookie** returned **200 and persisted** the region-name change; B region remained unchanged. These values were checked via direct PostgreSQL SELECT, and the original Albania name was restored in `finally` both for HTTP and browser test stages.

**Real Chromium, attacker-origin HTML forms:** with the recent server-default cookie, iframe omitted cookie and got **401/no mutation**, but **top-level form automatically transmitted valid Admin Cookie, returned 200 and persisted** the synthetic region name. With real signed session cookie deliberately reconfigured in Chromium's cookie jar to `SameSite=None; Secure`, iframe and top-level browser forms both transmitted Cookie, returned **200 and persisted** changes. Every change was independently restored and SQL-verified. Cross-site credentialed JSON fetch had a real CORS preflight and **no POST** under both cookie policies; no mutation. Browser CORS preflight does not protect native HTML forms. The previous scoped Stage12AE Admin product guard still denied its own tested attacks 403.

**Risk classification:** browser-real CSRF **CONFIRMED in the single isolated Medusa 2.22.6 AOF CI/Admin region configuration**. Not a proven Production compromise, Medusa 2.22.0 result, other browsers or entire route inventory. Tested localhost-mapped synthetic HTTPS hosts with self-signed cert (browser verification bypassed), recent session-cookie window and experimental alternative cookie fixture; no live accounts. A region **name** mutation demonstrates state change, not a payment/financial exploit. No CSRF mitigation was added for regions in Stage12AF. The two separate Admin mutation findings indicate a **systemic coverage concern**, while all other unsafe routes remain individually UNKNOWN; do not extrapolate to all 325 without runtime proof.

**Release remains forbidden:** exact Stage12AF code SHA GitHub Actions **8 SUCCESS / 1 FAILURE**. [Pinned Medusa 2.22.0 native finance CI #42931945576](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42931945576) again accepted/persisted **uncaptured Admin refund (11P)** and **+1 ALL over-refunds (11J/11O/11I)**. T02 (global session CSRF) OPEN, T05/S13 P0 and release gates RG-01/02/03, G3/G5 BLOCKED. Draft PR #12 stacked on PR #11; main, Production, real PSP/payments and baseline dependencies unchanged. Earlier unmitigated product browser proof remains at [Stage12AD CI](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42923862169), while Stage12AE scoped mitigation stays green.


## 2026-11-11 — Stage12AE pre/post browser CSRF regression, 2.22.6 CI only

| Selected case | Stage12AD before | Stage12AE exact-code CI | PostgreSQL |
| --- | --- | --- | --- |
| Admin product, trusted same-site JSON + Cookie | 200 | **200** | Updated, original restored |
| Attacker iframe form, server-default cookie omitted | 401 | **401** | No mutation (no Cookie) |
| Attacker top-level form, recent server-default Cookie sent | **200/persisted** | **403** | **No mutation** |
| Attacker iframe form, None;Secure Cookie sent | **200/persisted** | **403** | **No mutation** |
| Attacker top-level form, None;Secure Cookie sent | **200/persisted** | **403** | **No mutation** |
| Direct foreign-Origin Admin Cookie JSON POST | **200/persisted** | **403** | **No mutation** |
| Missing credentials / wrong role / B Admin cookie | 401 | **401** | No mutation |
| Attacker JSON fetch | Preflight blocks POST | Preflight blocks POST | No mutation |
| Stage12X unit policy checks | 5 prior | **6 PASS** | Synthetic Node/TS units |
| Guest cart, missing publishable key browser form | 400 | **400** | No mutation, not owner-CSRF proof |
| Other Medusa mutations / Production | UNKNOWN | **UNKNOWN** | No global certification |

[Stage12AE code 2e3222d](https://github.com/titanfit102-bit/ShqipShop/commit/2e3222d1fa006f9bc9d045697b35360267922f4f), [exact Medusa 2.22.6 browser/HTTP CI #42927329805](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42927329805) **SUCCESS**: extended the existing *CI-only, AOF port 6382, Medusa 2.22.6* Stage12X cookie Origin/Fetch-Metadata/JSON guard by exactly one additional `POST /admin/products/:id` matcher. Tested with real Chromium + original signed Medusa Admin cookie: the previously exploitable **recent server-default top-level attacker form with Cookie** now returned **403 and no PostgreSQL mutation**; controlled `SameSite=None; Secure` attacker iframe and top-level forms with Cookie also returned **403 / no mutation**. Server-default iframe omitted Cookie and returned **401 / no mutation** (not evidence of the guard).

Trusted same-site Admin JSON POST continued to return **200 and persist**, and the synthetic product title was restored to its original value with direct PostgreSQL readback; tenant-B resource stayed isolated. Manual foreign-Origin Admin-cookie JSON POST also returned **403**, not the predecessor Stage12AC's 200+persisted. Credential-free, wrong-role and B-admin cookie writes remained 401. Six Stage12X TypeScript unit tests passed, including exact-only POST matching, denied external/missing/invalid Origins, rejected browser form content type, fail-closed Fetch Metadata, and out-of-scope/non-CI pass-through. Existing customer/Admin profile Stage12X, Stage12Y-Z browser, Stage12AB identity, Stage12AC guest-cart tests all remained successful.

**Boundaries:** this is an **isolated experimental CI-only gate**, not Medusa 2.22.0/Production CSRF remediation. It applies only to the two existing customer/Admin profile route matchers plus the new Admin product POST matcher, with explicit runner/version/Redis conditions; other 322+ changing methods from the installed inventory are not claimed safe. Browser JSON `fetch` attacker preflight remains blocked before POST; the guest-cart public-key and possession behavior is unchanged and not evidence of registered-cart ownership. No production config, session cookie policy, global anti-CSRF token, payment/PSP, dependency lockfile, main or release gates changed. Previous exploitable CI evidence remains preserved in [Stage12AD pre-guard CI #42923862169](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42923862169).

**Release veto unchanged:** exact Stage12AE code SHA 9 GitHub workflows = **8 SUCCESS / 1 FAILURE**. [pinned 2.22.0 financial CI #42927330046](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42927330046) again persisted **uncaptured Admin refund** (11P) and **+1 ALL over-refunds** (11J, 11O, 11I) in disposable native 2.22.0 flows. T02 global CSRF **OPEN**, T05/S13 P0 and RG-01/02/03, G3/G5 **BLOCKED: NO RELEASE**. Draft PR #12 remains stacked on PR #11; no main merge.


## 2026-11-11 — Stage12AD Chrome HTTPS / PostgreSQL browser-CSRF matrix, Medusa 2.22.6 CI

| Actual Chromium operation | Cookie attached | Browser HTTP result | SQL persisted? | Interpretation |
| --- | --- | --- | --- | --- |
| Same-site Admin product JSON, trusted cookie | yes | 200 | yes, then restored | Positive authorized mutation |
| Attacker iframe form / server-default cookie | no | 401 | no | Cookie omitted, not server-side CSRF proof |
| **Attacker top-level form / recent server-default cookie** | **yes** | **200** | **yes, then restored** | **Browser-real Admin catalog CSRF in CI** |
| **Attacker iframe form / Chrome None;Secure cookie fixture** | **yes** | **200** | **yes, then restored** | **Browser-real Admin catalog CSRF in CI fixture** |
| **Attacker top-level form / Chrome None;Secure cookie fixture** | **yes** | **200** | **yes, then restored** | **Browser-real Admin catalog CSRF in CI fixture** |
| Attacker JSON fetch / either cookie policy | POST not sent | CORS preflight browser rejection | no | Not a native-form defense |
| Same-site guest cart JSON with publishable key | yes | 200 | yes, then restored | Positive guest capability test |
| Attacker guest-cart native forms / both cookie policies | varies | 400 (no key) | no | Missing publishable key, NOT customer CSRF defense |
| Attacker guest-cart JSON fetch / both policies | POST not sent | CORS preflight browser rejection | no | No write in browser fixture |
| Production, other browsers, all mutation routes | UNKNOWN | UNKNOWN | UNKNOWN | NO RELEASE |

[Stage12AD code 9c722db](https://github.com/titanfit102-bit/ShqipShop/commit/9c722dbcbfa592c7f847e4fd77e54ecbc80b5704) and [real Chromium HTTPS/AOF CI #42923862169](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42923862169) **SUCCESS as diagnostic evidence, NOT mitigation**. Headless Chromium on disposable self-signed HTTPS (certificate errors bypassed), Medusa 2.22.6, synthetic Admin login and signed Medusa cookie, with PostgreSQL readback and guaranteed restoration: trusted same-site Admin JSON `POST /admin/products/:id` persisted as expected. An **attacker-site top-level native HTML form POST using the genuine recent server-default cookie** sent Cookie, returned **HTTP 200, and persisted a product title change**. Server-default iframe omitted Cookie and returned 401 without mutation.

Using the same genuine Medusa cookie deliberately reconfigured in Chrome's cookie store to `SameSite=None; Secure` (not emitted with these attributes by Medusa), both attacker iframe and top-level forms sent Cookie, returned **200, and persisted product changes**. Every synthetic product value was restored and confirmed directly in PostgreSQL. These cases establish **browser-real CSRF on the scoped Admin product route in disposable 2.22.6 config**; not merely a forged direct HTTP request.

From the attacker origin, credentialed JSON `fetch` generated a real CORS preflight but **no POST** for the Admin product under both cookie policies, and no DB change. **CORS preflight therefore blocked JSON fetch but did NOT block native HTML forms**. For the synthetic guest cart, all attacker native forms had no publishable key and got **400/no mutation**, including default top-level (cookie sent) and SameSite=None iframe/top-level (cookie sent); attacker JSON fetch was stopped before POST by preflight. The allowed same-site browser JSON writes worked and were independently read back/restored. Guest cart testing does NOT establish authenticated owner protection.

**Boundary:** single headless Chromium, local synthetic HTTPS origins and short-lived certificate with browser certificate verification bypassed, new Medusa session cookie in a recent-cookie window, one disposable Medusa 2.22.6 AOF/PostgreSQL backend. No Firefox/WebKit, long-aged cookie, Production TLS/domain topology, complete role/tenant model, global CSRF, session-bound anti-CSRF token, or pinned Medusa 2.22.0 verification. Don't overstate this as a proven live Production compromise. Security impact is nevertheless significant: **the candidate's Admin catalog mutation is demonstrably browser-CSRF-reachable under the tested cookie circumstances**.

Exact Stage12AD code commit: **9 workflows — 8 SUCCESS, 1 FAILURE**; [pinned Medusa 2.22.0 financial CI #42923862020](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42923862020) again accepted/persisted uncaptured Admin refund (11P) and +1 ALL over-refund workflow/singular/direct (11J/O/I). T02 browser-CSRF risk **OPEN**, T05/S13 and RG-01/02/03, G3/G5 **BLOCKED — NO RELEASE**. Draft PR #12 stacked on Draft PR #11; no `main` merge, Production/PSP/payment changes, dependency upgrade or global security-policy rollout.


## 2026-11-11 — Stage12AC real HTTP / SQL persistence, selected routes only

| Disposable Medusa 2.22.6 mutation | HTTP status | PostgreSQL result | Meaning |
| --- | --- | --- | --- |
| Admin product, trusted Origin + A Admin cookie | 200 | Title changed; later restored | Positive authorized action |
| Admin product, missing cookie | 401 | No change | Role/identity denial |
| Admin product, A customer cookie | 401 | No change | Role denial |
| Admin product, B Admin cookie | 401 | No change | Merchant isolation denial |
| Admin product, external Origin + A Admin cookie + JSON | **200** | **Title changed**; later restored | Server Origin trust gap in direct HTTP; browser attack UNKNOWN |
| Guest cart, A publishable key, no cookie | 200 | Email changed; later restored | Guest capability positive |
| Guest cart, no publishable key | 400 | No change | API key validation; not session CSRF |
| Guest cart, B publishable key | 400 | No change | Key scope, not proof of authenticated ownership |
| Guest cart, external Origin + A key + A customer cookie + JSON | **200** | **Email changed**; later restored | Guest possession boundary; browser attack UNKNOWN |
| Real Chromium for these two exact routes | NOT TESTED | UNKNOWN | NEXT Stage12AD |
| Nonselected Medusa mutation routes / Production | NOT TESTED | UNKNOWN | OPEN; NO RELEASE |

[Stage 12AC code 282de11](https://github.com/titanfit102-bit/ShqipShop/commit/282de11407b6fb395f85b8abcef7ca448a3e2ca0); [isolated Medusa 2.22.6 PostgreSQL/HTTP CI #42921000702](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42921000702) **SUCCESS as a diagnostic classifier, NOT a CSRF security pass**. Real AOF candidate :9003 with fresh synthetic admin/customer cookies and tenant-B independent admin. On built-in `POST /admin/products/:id`, trusted Admin cookie JSON POST returned 200 and updated the product title in **actual PostgreSQL**; no credentials, wrong customer role and B-admin cookie returned 401 and left the DB row unchanged. An **external-Origin JSON POST manually carrying the genuine A Admin cookie** returned **HTTP 200 and the title WAS PERSISTED**. A `finally` restore returned its original title; both A and B product database rows matched original values afterward.

For a separately created synthetic **guest**, NOT account-owned, cart, `POST /store/carts/:id` with A publishable key and no session returned 200 and persisted an email change. Missing and B-merchant publishable keys returned 400 without mutation. An external-Origin request with the A public key and a manually attached A customer cookie returned **200 and persisted** another email change. The test restored the original synthetic cart email and verified via direct PostgreSQL SELECT; the guest cart itself exists only in disposable CI DB and is discarded with the runner. No payment session, actual order, charge, refund or PSP operation was attempted.

**Critical interpretation:** 200 and persisted on external-Origin requests means these **selected** routes did not enforce a server-side exact Origin denial on the manually constructed HTTP requests. It is NOT yet evidence of practical browser CSRF: manual Cookie and JSON headers differ from browser form requests, credentialed cross-origin JSON may be blocked by CORS preflight, and the guest cart is a possession-capability resource whose A publishable key is intentionally public. Do not count guest-cart write as customer cookie ownership bypass or all Medusa routes as exposed. Existing experimental Stage12X Origin policy covers only two *profile* matchers, NOT product or cart mutations. Production cookie policy, alternate browsers, real storefront domain, full token binding and global CSRF remain UNKNOWN/OPEN.

Exact Stage12AC **code SHA** checks: **9 workflows = 8 SUCCESS / 1 FAILURE**. [Pinned Medusa 2.22.0 finance CI #42921000452](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42921000452) again persisted an uncaptured Admin refund (11P), plus 1 ALL excessive refund through workflow (11J), singular (11O), and direct module (11I). Financial T05/S13 P0, RG-01/02/03, G3/G5 remain **BLOCKED; NO RELEASE**. PR #12 Draft remains stacked on PR #11 Draft; `main`, Production, PSP, baseline Medusa dependency/lockfile and payment code unchanged.


## 2026-11-10 — Stage12AB disposable Medusa 2.22.6 runtime auth matrix

| Real HTTP probe | Correct A cookie | Correct A bearer | Missing/invalid | Wrong role | Foreign B cookie / JWT | Boundary |
| --- | --- | --- | --- | --- | --- | --- |
| GET Store customer self | 200 | 200 | 401 / 401 | 401 | 401 / 401 | Exact A customer identity |
| GET Admin user self | 200 | 200 | 401 / 401 | 401 | 401 / 401 | Exact A Admin identity |
| GET Admin orders | 200 | 200 | 401 guest | 401 customer cookie | 401 B Admin cookie | Authorized read-only list |
| GET Admin customer detail | 200 | 200 | not checked here | not checked here | not checked here | Same A synthetic customer |
| POST Store customer profile (bearer positive) | 200 cookie restore | 200 persisted | 401 no auth | 401 wrong-role cookie | 401 B cookie | Read-back and restore |
| POST Admin customer profile (bearer positive) | 200 cookie restore | 200 persisted | 401 no auth | 401 wrong-role cookie | 401 B cookie | Read-back and restore |
| POST /auth/session | Valid token yields cookie | Valid bearer exchange 200 | 401 no/invalid | not checked | 401 B customer/Admin JWT | No session cookie on 401 |
| GET /store/products with publishable key, no buyer session | n/a | n/a | 200 with public key; 400 without key | n/a | not checked | Public catalog; no buyer auth claim |
| Other compiled unsafe endpoints | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | Outside Stage12AB |

[Stage12AB code 8afff4b](https://github.com/titanfit102-bit/ShqipShop/commit/8afff4b4ab42beaaddede0f7321a6392f3433c13), [Stage12AB isolated Medusa 2.22.6 HTTP CI #42917704819](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42917704819) **SUCCESS**: real Medusa 2.22.6 on disposable PostgreSQL and AOF Redis :6382. For tenant A, both authenticated Store customer GET `/store/customers/me` and Admin GET `/admin/users/me` accepted a newly issued **session cookie** and a newly issued **bearer JWT** with HTTP **200** and the correct synthetic identity. Both returned **401** for missing/invalid credentials, wrong-actor cookie, tenant-B cookie and tenant-B JWT. Admin customer detail GET also accepted Admin cookie/bearer, while Admin order listing accepted Admin cookie/bearer HTTP 200 and rejected guest, customer and tenant-B Admin cookie HTTP 401. Public Store products GET with tenant A's publishable API key and no login returned HTTP 200; with neither key nor session it returned 400 (publishable-key requirement, not proof of private buyer authorization).

**Authenticated writes (real HTTP):** for both `POST /store/customers/me` and `POST /admin/customers/:id`, tenant-A **bearer** update persisted with HTTP **200**; no credential, wrong role and tenant-B cookie were rejected HTTP **401**, without mutation. The original synthetic values were restored using fresh tenant-A cookie and allowed Origin and verified via read-back. `POST /auth/session` issued a new Medusa cookie only after valid JWT exchange; missing/invalid and tenant-B customer/Admin JWT returned **401** without a session cookie. Tenant B's own authenticated endpoints on its independent API :9001 stayed HTTP 200 with its identity unchanged.

**Scope and limitations:** these were selected real Store/Admin/Auth routes, NOT all 334 installed route files/494 exported methods/325 potentially changing methods. Profile POST paths have Stage12X experimental exact-CI-only Origin protection in AOF :9003; the bearer-only positive bypasses that cookie-specific check by design. Real browser cross-site, token revocation, other mutation routes, CSRF-token binding, all-device logout, tenant ownership outside chosen identities, Production, actual PSP and pinned 2.22.0 behavior are NOT newly certified. During the first Stage12AB run, the probe reused a session fixture that had been intentionally expired by earlier AOF TTL tests; that red diagnostic was NOT an auth bypass. The fixed probe uses **fresh Medusa-issued cookies**, does not log credentials, tokens, session values or private identities, and retains all positive/negative regression assertions.

At exact **code SHA**, 9 workflows: **8 SUCCESS, 1 FAILURE**. [pinned Medusa 2.22.0 finance CI #42917704827](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42917704827) reproduced persisted uncaptured Admin refund (11P) and +1 ALL persisted over-refund through workflow/singular/direct module (11J/O/I). T05/S13 P0, RG-01/02/03, G3/G5 remain **BLOCKED — NO RELEASE**. No main merge, Production deploy, payments/PSP modification, baseline dependency change or security policy promotion. PR #12 remains Draft, stacked on Draft PR #11.


## 2026-11-10 — Stage12AA exact installed Medusa 2.22.6 route export matrix

| Version-locked package group | Route files | Exported HTTP methods | Potentially state-changing declarations | HTTP/session validation |
| --- | ---: | ---: | ---: | --- |
| Admin | 255 | 393 | 269 | UNKNOWN |
| Store | 48 | 55 | 26 | UNKNOWN |
| Auth | 16 | 20 | 16 | UNKNOWN |
| Cloud, Hooks, RBAC | 15 | 26 | 14 | UNKNOWN |
| **Total** | **334** | **494** | **325** | **NOT CERTIFIED** |

| Gate | Outcome | Evidence type |
| --- | --- | --- |
| TypeScript AST method parser positive and false-positive negatives | 6/6 PASS | CI unit |
| Installed version check, all compiled route.js modules parsed | 2.22.6, 0 unresolved | Disposable package static |
| Stage12X two-path guard for Store/Admin profile | Scoped CI-only | NOT global route/session coverage |
| Session/bearer/tenant/side-effect mapping for installed routes | UNKNOWN | Stage12AB NEXT |
| Pinned original Medusa finance P0 | [FAILURE CI #42891775014](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42891775014) | RELEASE BLOCKED |

[Stage12AA code e388f01](https://github.com/titanfit102-bit/ShqipShop/commit/e388f0181e42dd810afdf8b117a9108996885857), [Medusa 2.22.6 disposable CI #42891774946](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42891774946) **SUCCESS**: checked an exact 2.22.6 installed pnpm package under RUNNER_TEMP, AST-parsed only compiled dist/api route.js exports without invoking handlers. Identified **334 route files**, **494 exported HTTP method declarations**, **325 potentially state-changing method declarations** (POST/PUT/PATCH/DELETE), with **0 unresolved route files**. Admin 255 routes/393 methods/269 potentially changing; Store 48/55/26; Auth 16/20/16; Cloud+Hooks+RBAC 15/26/14. Six of six AST positives/negatives PASS, including prevention of false positives from comments, strings, non-exported names and void-only initializers; existing Stage12X policy, AOF, browser, identity and merchant-boundary checks remained successful.

**Evidence classification:** static exported-method inventory of the *installed* disposable 2.22.6 package only. A source-file declaration is not proof of an active registered endpoint, caller session auth, bearer permission, availability under feature flags or an actual state mutation. GET/HEAD are not independently proven side-effect-free; POST can also implement reads. Auth middleware composition and per-route cookie acceptance UNKNOWN; framework vs project custom routing may differ. Production baseline 2.22.0 remains pinned, not inventoried by this candidate evidence. All global T02 CSRF, JWT/session revocation and Production gates OPEN.


## 2026-11-10 — Stage12Z Chromium HTTPS top-level / 302 / 307 matrix

| Actor (recent default cookie; repeated with None;Secure browser fixture) | Target method | Cookie sent | HTTP | Meaning |
| --- | --- | --- | --- | --- |
| Customer attacker direct form | POST | yes | 400 | Missing publishable key; no mutation; CSRF guard not independently proved |
| Customer attacker 302 redirect | GET | yes | 400 | POST became GET; no mutation |
| Customer attacker 307 redirect (Origin:null) | POST | yes | 400 | POST preserved; missing publishable key; no mutation |
| Admin attacker direct form | POST | yes | 403 | Scoped cookie-origin gate denied; no mutation |
| Admin attacker 302 redirect | GET | yes | 200 | Authenticated read-only GET; no mutation |
| Admin attacker 307 redirect (Origin:null) | POST | yes | 403 | Scoped origin check denied; no mutation |
| Both trusted origin profile JSON writes | POST | yes | 200 | Positive mutation and restore, CI only |
| Alternate browsers/Production/global Medusa endpoints | — | UNKNOWN | UNKNOWN | OUT OF SCOPE / NO RELEASE |

[Stage12Z code bc91261](https://github.com/titanfit102-bit/ShqipShop/commit/bc9126146f6a1a20430129f01d811d4d5dac0c0c) and [isolated 2.22.6 Chromium HTTPS CI #42886843904](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42886843904) **SUCCESS**. In real headless Chrome, both synthetic customer and Admin sessions sent genuine Medusa cookies from the attacker site on all TOP-LEVEL variants using server-issued recent cookies (no explicit SameSite/Secure) and again with a controlled browser SameSite=None; Secure fixture. Direct form POST stayed POST; 302 transformed POST to GET; 307 retained POST and had Origin:null with Sec-Fetch-Site:cross-site. For each cookie configuration, customer direct/307 POST returned 400 (no publishable API key; NOT proof of the customer CSRF guard) and 302 GET returned 400. Admin direct/307 POST returned 403 with cookie (scoped Origin/metadata guard), while 302 GET returned 200 (read only); all profile values were unchanged and synthetic positive trusted writes were restored. Default iframe POST still omitted the cookie, unlike recent-cookie top-level POST. The initial Stage12Z code attempt was red due to a browser navigation/readback race; corrected by waiting for navigation commit; the exact later CI is the sole green evidence.

**Limit:** one real headless Chrome on ephemeral self-signed local HTTPS with bypassed certificate verification, disposable Medusa 2.22.6 AOF instance :9003 only. Session cookies were actual synthetic credentials; the SameSite=None variant was deliberately set in Chrome's cookie store rather than by Medusa. Other browsers, expiry beyond recent-cookie window, additional sites, production TLS, login/logout, cross-tenant writes and all other mutation routes are NOT verified. The Stage12X CSRF middleware is CI-only and covers ONLY /store/customers/me and /admin/customers/:id for POST/DELETE; not main A/B services or production.

At exact code SHA: **9 workflows = 8 SUCCESS + 1 FAILURE**. [Pinned Medusa 2.22.0 finance CI #42886844202](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42886844202) again observed persisted uncaptured Admin refund (11P) and +1 ALL over-refund via workflow/singular/direct-module (11J/O/I). Financial T05/S13, RG-01/02/03, G3/G5 **BLOCKED — NO RELEASE**. No main merge, Production, PSP, payment/refund implementation, baseline dependency or lockfile changes; PR #12 remains Draft stacked on Draft PR #11.


## 2026-11-10 — Stage12Y genuine Chromium HTTPS cookie delivery matrix

| Actor / browser request | Cookie actually sent | HTTP | Verified meaning |
| --- | --- | --- | --- |
| Customer legitimate HTTPS shop-origin credentialed JSON POST | Yes | 200 | Profile changed & restored |
| Admin legitimate HTTPS admin-origin credentialed JSON POST | Yes | 200 | Profile changed & restored |
| Customer external iframe form, server-default Lax | No | 400 | No mutation; not CSRF guard proof |
| Admin external iframe form, server-default Lax | No | 401 | No mutation; browser excluded cookie |
| Customer external iframe form, controlled None; Secure browser fixture | Yes | 400 | No mutation; missing publishable key, guard unproven |
| Admin external iframe form, controlled None; Secure browser fixture | Yes | 403 | No mutation; scoped server-side Origin gate PASS |
| Cookie attribute observation | HttpOnly true, server SameSite/Secure absent; browser default Lax | — | Local CI only |
| Production/browser diversity/full mutation routes | NOT TESTED | — | OPEN |
| Native finance | [pinned Medusa 2.22.0 finance CI #42873953944](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42873953944) FAILURE 11I/J/O/P | — | P0 BLOCKED |

[Stage 12Y code 6f21509](https://github.com/titanfit102-bit/ShqipShop/commit/6f215090fe762920c807fb6cbefd3cea8ded791c); [isolated browser/Medusa 2.22.6 CI #42873953863](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42873953863) SUCCESS; exact code SHA 8 SUCCESS / 1 FAILURE. **Boundary:** Browser controlled actual cookie inclusion, but the second cookie policy was created in Chromium's test cookie store; Medusa did NOT emit SameSite=None; Secure. TLS used a temporary untrusted self-signed certificate with browser trust-error bypass, NOT a real PKI deployment. Chrome headless CI only; hidden iframe not top-level form submission, no Firefox/WebKit, no production domain or real customer data. CI-only Stage12X origin guard protects exactly two profile matchers on AOF :9003, NOT all routes, candidate A/B :9000/:9001, checked-in Medusa 2.22.0 or production. No full CSRF-token/session binding, cookie subdomain hardening or bearer JWT revocation.


## 2026-11-10 — Stage 12X isolated Medusa HTTP evidence matrix

| Boundary | Result | Classification |
| --- | --- | --- |
| Allowed-origin customer/Admin cookie JSON POST | HTTP 200, own data restored | Real AOF CI PASS |
| Untrusted Origin JSON POST with manual Cookie | 403, no mutation | Real AOF CI PASS |
| Untrusted Origin form POST with manual Cookie | 403, no mutation | Real AOF CI PASS |
| Missing Origin / cross-site metadata | 403, no mutation | Real AOF CI PASS |
| Browser-simple text/plain POST | 400, no mutation | Real AOF CI PASS |
| Policy guard on DELETE and non-CI passthrough | 5/5 Node unit cases | Unit only |
| Isolated candidate / PG / Redis / 72 Python tests | [CI #42867499601](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42867499601) SUCCESS | CI proof, not Production |
| Real HTTPS browser cross-site Cookie | NOT TESTED | Stage12Y OPEN |
| Native pinned finance | [finance CI #42867499508](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42867499508) FAILURE 11I/J/O/P | P0 BLOCKED |

Exact-CI-only profile cookie guard runs exclusively with temporary GitHub CI flags and Redis AOF :6382 on candidate :9003. It does NOT protect candidate A/B :9000/:9001, checked-in Medusa 2.22.0, other routes or Production. Real HTTP covered POST only; DELETE denial was unit-tested only. Browser HTTPS cross-site cookie delivery, SameSite/Secure behavior, trusted external storefront exceptions, token-based CSRF defense, full-route protection and JWT revocation are unverified.

9 code-SHA workflows: **8 SUCCESS / 1 FAILURE**. [finance CI #42867499508](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42867499508) failed uncaptured Admin refund 11P and persisted +1 ALL over-refund 11I/J/O; 11E/F recovery passed. T05/S13 P0, RG-01/02/03, G3/G5 and release BLOCKED; no main, merge, Production, payment or dependency upgrades. PR #12 Draft on PR #11 Draft.


## 2026-11-10 — Stage 12W CORS versus server-side CSRF HTTP regressions

| Check | Real disposable Medusa 2.22.6 outcome | Classification |
| --- | --- | --- |
| Trusted customer/Admin cookie mutation | HTTP 200, correct own fixture updated and restored | Positive PASS |
| Missing/foreign/wrong-role cookie | HTTP 401/403, A and B records unchanged | Negative PASS |
| Untrusted Origin CORS preflight | External Origin not allowed (trusted storefront/Admin origins allowed) | CORS PASS only |
| External Origin with manually attached cookie, application/json | Customer/Admin POST 200 and mutated each synthetic record | Server-side Origin enforcement GAP |
| External Origin with manually attached cookie, text/plain | 400, no modification on both routes | Simple-body negative PASS |
| External Origin with manually attached cookie, application/x-www-form-urlencoded | Customer/Admin POST 200 and changed own fixture | Server-side CSRF risk / FAIL-CLOSED CI |
| Candidate HTTP cookie flags on localhost | HttpOnly and Expires yes; SameSite and Secure absent | Observation only, production UNKNOWN |
| Browser exploit proof | No browser-driven cookie transmission test | NOT VERIFIED |
| CI CSRF fail-closed gate | [Run 42861306367](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42861306367) failed at security sentinel after classification | VERIFIED RED |
| Native finance | [Run 42861306553](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42861306553) persisted uncaptured/+1 ALL refunds | P0 RELEASE BLOCKED |

**Threat boundaries:** isolated Medusa 2.22.6 development Set-Cookie had HttpOnly=true and explicit Expires/Max-Age, but SameSite ABSENT and Secure ABSENT on localhost HTTP (not representative proof of HTTPS Production). The Node HTTP client deliberately provided cookies: this proves server-side Origin/Fetch Metadata enforcement was insufficient on two mutation routes under this fixture, NOT that a real browser would automatically attach cookies or that a complete browser CSRF exploit was proven. CORS denial of an origin does not by itself prevent simple cross-site form POSTs, so investigate browser cookie attachment, SameSite default semantics, Sec-Fetch-Site/Origin/Referer validation, body parsing, CSRF tokens and subdomain trust. See OWASP CSRF Prevention Cheat Sheet. Restore after each probe verified, no real users or payment mutations.

**Exact source-SHA workflows:** 9 completed, **7 SUCCESS / 2 FAILURE**. Stage12W candidate #42861306367 FAILED intentionally on CSRF sentinel. [Pinned Medusa 2.22.0 native backend #42861306553](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42861306553) independently FAILED: uncaptured Admin refund (11P) and persisted +1 ALL over-refund through workflow/singular/direct module paths (11J/11O/11I); 11E/11F order/payment retry PASS. RG-01/02/03, T05/S13 and G3/G5 remain BLOCKED, NO RELEASE.

**Next scoped stage 12X:** verify actual browser cross-site cookie behavior under a realistic local HTTPS/site topology; develop and test a fail-closed CI-only origin/Fetch-Metadata/CSRF boundary for cookie-authenticated POST/DELETE with trusted cross-origin storefront exceptions, before separately authorizing any production security policy. Do not conflate diagnostics with verified exploit or clear finance P0 and JWT revocation.


## 2026-11-10 — Stage 12V session expiry matrix

| Boundary | Scoped outcome | Status |
| --- | --- | --- |
| Genuine session key | Signed customer connect.sid maps to actual sess: key, native TTL positive | CI PASS |
| Server expiry | Targeted disposable session PEXPIRE 2400 ms; expired cookie denied 401/403 | CI PASS |
| AOF reload | AOF retained active A/B sessions and sentinel; expired cookie/key not restored | CI PASS |
| Cookie attributes | HttpOnly and explicit expiry yes; SameSite absent in development candidate | OBSERVED, CSRF review OPEN |
| Not certified | Natural browser expiry, production auth, bearer JWT revocation, host loss, PSP | OPEN |
| Finance | Medusa 2.22.0 uncaptured/+1 ALL persisted refund failures | P0, NO RELEASE |

[Stage 12V source 507798b](https://github.com/titanfit102-bit/ShqipShop/commit/507798b8a27137b12d65f166d21a6054c73550fb), [isolated Medusa 2.22.6 CI #42854128435](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42854128435): SUCCESS with 72/72 Python tests. A real signed synthetic Medusa connect.sid mapped to its actual Redis sess: record with native positive TTL. CI-only PEXPIRE 2400 ms was applied to that exact record. After expiry the cookie returned 401/403, and the expired record/cookie did not revive after another AOF container replacement on the same disposable volume. Active A Admin and B sessions remained correctly isolated, and a new A customer session worked.

Observed on the 2.22.6 disposable development candidate: HttpOnly=true, explicit cookie expiry=true, SameSite attribute ABSENT. The missing attribute needs a separate CSRF/cookie-hardening investigation; it is not proof of a production exploit. The short CI-forced server-side TTL does not prove natural browser cookie expiry, absolute lifetime or bearer JWT revocation; post-logout JWT replay remains OPEN.

At exact code SHA, all nine workflows completed: 8 SUCCESS, 1 genuine FAILURE. [Pinned Medusa 2.22.0 backend #42854128884](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42854128884) again persisted Admin refund without capture (11P) and +1 ALL excess refunds (11J/11O/11I), while 11E/11F order/payment retries passed. T05/S13 P0, RG-01/02/03 and G3/G5 stay BLOCKED: NO RELEASE.

Next: Stage 12W evaluate SameSite/CSRF exposure on cookie-authenticated customer and Admin mutation routes using disposable positive/negative cases, separately assess JWT revocation and natural expiry. No production policy or release change without separate authorization and P0 remediation.


## 2026-11-10 — Stage 12U repeated Redis AOF replacement, revoked cookie and synthetic TTL

| Check | Expected / observed | Evidence |
| --- | --- | --- |
| Pre-second-replacement | A customer logout denied old cookie; A active customer/Admin accepted | [CI #42848271272](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42848271272) PASS |
| Hard outage / replacement | Replace second container with third different ID, same AOF named volume; B Redis/sessions healthy; A protected identity not exposed during outage | PASS |
| AOF continuity | Synthetic long-lived key and two active A customer/Admin cookies survived replacement with correct identities | PASS |
| Negative auth | Previously logged-out A customer cookie denied 401/403 after restart; foreign B and wrong-role cookies denied | PASS |
| Short-lived Redis key | Synthetic Redis SET EX 8 eventually expires after AOF replay (not session-cookie expiry) | PASS |
| Fresh A login | New A cookie accepted after second replacement | PASS |
| Outside scope | Real cookie max age / absolute expiry, bearer JWT logout revocation, disk loss, backups, HA, live PSP, production auth | OPEN |
| Finance blocker | Pinned Medusa 2.22.0 uncaptured/+1 ALL refund invariants fail | [backend #42848271246](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42848271246) FAILURE, P0 BLOCKED |

**Scope and limitations:** same-host, disposable Redis 7 AOF volume and Medusa candidate 2.22.6 on a GitHub runner. Container replacement and cookie revocation integrity do NOT certify cookie/absolute session expiry, complete all-device logout, bearer JWT invalidation (post-logout JWT replay still OPEN), CSRF/TLS protections, damaged disk, off-host backup restore, replica failover, production durability or RPO/RTO. Retaining AOF sessions must never imply protected sessions survive credential compromise safely. Only temporary CI test script, CI lifecycle cleanup and workflow step label changed; checked-in Medusa remains 2.22.0, no production setting/financial contract/merge/deploy changes, PR #12 Draft and main untouched.

**Next bounded stage:** design and independently verify synthetic cookie-expiration/absolute TTL semantics and logout/JWT revocation contracts, with negative identity and tenant-isolation cases, before any production policy decision. Never equate synthetic Redis-key TTL to user cookie expiration, and do not lift financial release gates.


## 2026-11-10 — Stage 12T AOF external named volume and cookie invalidation (EXACT-SHA CI VERIFIED)

| Test | Evidence / expected invariant | Status |
| --- | --- | --- |
| Disposable volume | Redis AOF Docker volume with scoped label; original container removed, replacement has different ID and same attached volume | [CI #42843451926](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42843451926) PASS |
| Storage continuity | Synthetic Redis key survives container deletion and recreation | PASS |
| Auth continuity | Original A customer/Admin cookie identities accepted after replacement; fresh A login works | PASS |
| Isolation during outage | B customer/Admin remains valid; protected A identity not returned while container absent | PASS |
| Negative authorization | B foreign cookie, anonymous and customer-as-Admin requests denied on A | PASS |
| Cookie logout | Logged-out A customer cookie replay denied; A Admin and B remain authenticated | PASS |
| Not tested | Host or volume loss, backups, migration, expiry/rotation, JWT revocation, production availability | OPEN / UNKNOWN |
| Financial safety | Pinned Medusa 2.22.0 persists uncaptured/+1 ALL refunds | [Backend #42843451925](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42843451925) genuine FAILURE, P0 BLOCKED |

**Scope:** named volume survived a single **same-host CI Docker container replacement**, but was destroyed at job cleanup; this is NOT a production persistence deployment, off-host backup, volume migration, disk-loss recovery, corrupted AOF repair, Redis replication/failover, RPO/RTO, HTTPS/CSRF, PSP or HA proof. Restoring cookies may also restore stolen sessions; cookie logout tested here does NOT revoke the independent bearer JWTs (Stage12O still found post-logout JWTs HTTP 200). Production session TTL/rotation and all-device revocation remain OPEN. No changes to pinned Medusa 2.22.0, auth runtime, payments, production, main, or PR #12 Draft status.

**Next authorized test direction:** in disposable CI, verify expiry and logout-invalidation persistence across a SECOND container replacement and classify backup/restore limitations. Do not approve production AOF or dependency version promotion without separate architecture, encryption, backup and security review; native finance P0 and JWT revocation need independent remediation authorization.


## 2026-11-10 — Stage 12S AOF persistence comparison matrix (EXACT-SHA CI VERIFIED)

| Scope | Positive / negative outcome | Evidence |
| --- | --- | --- |
| Default Redis from Stage12R | Hard restart restored connection but lost synthetic key and four old A cookie checks | [Stage 12R CI 42835225603](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42835225603) |
| Dedicated Redis AOF | appendonly yes; appendfsync always; RDB disabled; synthetic key and correct A customer/Admin cookie identities before crash | [Stage 12S CI 42838944829](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42838944829) SUCCESS |
| Forced AOF crash | SIGKILL of isolated AOF service only; B stays authenticated; A protected identities not returned | SUCCESS |
| Same-container AOF restart | AOF key survives, original A customer/Admin cookies valid with correct IDs; fresh authentication passes | SUCCESS |
| Foreign B cookie | Denied by A process before and after AOF crash | SUCCESS |
| Unverified | Container replacement, external volume, disk corruption, backups, production failover, token revocation | OPEN / UNKNOWN |
| Pinned native finance 2.22.0 | Uncaptured and 1 ALL excess refunds persist (known-red P0) | [Backend CI 42838944734](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42838944734) FAILURE / RELEASE BLOCKED |

**Exact comparison:** Stage 12R default Redis A on port 6379 lost its disposable sentinel and 4/4 old cookie reads after hard restart; Stage 12S AOF Redis on separate port 6382 kept its sentinel and both original cookies across a hard restart of the same container. This is evidence of session persistence for the exact CI AOF setting, NOT proof of persistence after container removal/replacement, external volume loss, disk failure, AOF corruption, HA failover, reliable backups, replication, encryption at rest, or production RPO/RTO. Longer-lived cookies also extend the risk of stolen-session replay; server JWT revocation after logout remains OPEN and is not improved by AOF.

**Authorization and implementation:** changed only `scripts/security/medusa_226_aof_session_probe.cjs`, `scripts/security/medusa_226_ab_ci.sh` and `.github/workflows/medusa-226-candidate-ci.yml`. AOF is switched on only in a newly created temporary Docker container; no Medusa production version/config/dependency change, no existing merchant Redis service persistence change, no live PSP, no main merge. Checked-in Medusa is still 2.22.0; PR #12 remains Draft.


## 2026-11-10 — Stage 12R: Redis restart and session durability (CI VERIFIED, RELEASE BLOCKED)

[Code 5afef2a](https://github.com/titanfit102-bit/ShqipShop/commit/5afef2ab5ed2c4e9c0c6c2b925d584e93e64f297) and [candidate CI 42835225603](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42835225603) SUCCESS, 72 Python tests. In isolated Medusa 2.22.6 CI, Redis A was stopped and restarted; B remained healthy. No private A identity was returned during the outage. Redis A reconnected, but a synthetic data sentinel was lost and all four old A cookie checks were denied. Fresh A customer/Admin authentication and cookies then worked across both A processes; B remained isolated. This shows reconnection and new-login recovery, NOT persistence of old sessions or Redis HA.

Exactly nine workflows on the code SHA: eight SUCCESS; [pinned Medusa 2.22.0 backend 42835225696](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42835225696) genuine FAILURE of uncaptured and +1 ALL refunds. 11E/11F order/payment retry checks passed. T05/S13, RG-01/02/03 and G3/G5 remain BLOCKED. Bearer JWT revocation after logout remains OPEN. Production persistence, failover, real PSP and disaster recovery are unverified.

Only disposable CI scripts and candidate workflow changed; pinned Medusa 2.22.0, main, production, and Draft PR #12 remain untouched. Next: define session durability/re-login behavior and test persistence separately; production auth, finance and dependency upgrade require separate authorization.


## 2026-11-09 — Stage 12Q Redis/session fault matrix (EXACT SOURCE CI VERIFIED; release veto active)

| Scenario | Required assertion | Status / Evidence |
| --- | --- | --- |
| Pre-fault identity | Correct A/B customer/Admin cookie accepted; B cookie rejected by A-clone | [42709446325](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42709446325) SUCCESS |
| Real short Redis A stall | A :6379 PING times out after CLIENT PAUSE; B :6381 PING still works | SUCCESS |
| No identity disclosure under stall | A-clone authenticated cookie requests never return HTTP 200 private identity during confirmed pause | SUCCESS: 401/403/503/504/timeout only |
| B independence | B customer/Admin sessions HTTP 200 during A stall | SUCCESS |
| Redis automatic expiry + session recovery | Fresh Redis A PING, correct A identities at :9000 and :9002, B foreign cookies still denied, B identities and three APIs healthy | SUCCESS |
| Native financial invariant | Pinned 2.22.0 accepted uncaptured and +1 ALL refunds | [42709446681](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42709446681) FAILURE, P0 BLOCKED |
| Untested | Hard Redis shutdown, persisted-data loss, HA, server-side JWT revocation, production PSP | OPEN / UNKNOWN |

**Implementation:** `scripts/security/medusa_226_redis_outage_probe.cjs` added and invoked from existing `scripts/security/medusa_226_ab_ci.sh`; existing `.github/workflows/medusa-226-candidate-ci.yml` includes it in the CI-only trigger. Earlier Stage12Q runs failed from probe mistakes (wrong merchant publishable key on foreign-cookie request and `CLIENT UNPAUSE` timing out while all clients paused); the final job uses target-A publishable key for B-cookie denial and verifies automatic expiry of the bounded pause before declaring session recovery. No tests were weakened: actual foreign cookies still must return 401/403 and A identity may never be returned as HTTP 200 during the stall.

**Boundaries:** this proves only a short, non-destructive Redis command stall in one disposable CI runner, not Redis crash/data loss/HA/failover/replication, indefinite outage, process restart under outage, real service reliability, HTTPS/CSRF, token revocation, device security, production tenant isolation, PSP or settlement. A cookie works after temporary Redis recovery; bearer JWT revocation after logout remains **OPEN** (all four A/B customer/Admin tokens returned HTTP 200 in Stage 12O). The original checked-in Medusa 2.22.0 manifest/lock were not changed; candidate 2.22.6 is ephemeral only. No release, merge, production config or finance code/policy change; PR #12 stays Draft.

**Next bounded investigation:** a separate disposable test for hard Redis disconnect/restart and persistence effects, with explicit no-leak and post-recovery assertions; independently plan production server JWT revocation, Redis resilience and native refund correctness. Permanent Medusa upgrade, production policy changes and financial remediation require separate approval.


## 2026-11-09 — Stage 12P session handoff matrix (EXACT-SHA CI VERIFIED)

| Test | Positive / negative condition | Result |
| --- | --- | --- |
| A same-merchant process | A customer/Admin cookie issued at :9000 works with correct identity at separate A :9002 using same DB/Redis/session keys | [42705520128](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42705520128) SUCCESS |
| B cross-merchant cookie | B customer/Admin cookies sent to A :9002 denied | SUCCESS |
| Missing cookie | Anonymous requests to A clone denied; both original APIs alive | SUCCESS |
| Revocation and resilience | Post-logout bearer JWT still accepted in Stage 12O; Redis HA/failover/restart not tested by 12P | **OPEN / UNKNOWN** |
| Native payments | Uncaptured and +1 ALL refunds persist in pinned Medusa 2.22.0 | [42705520489](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42705520489) FAILURE / RELEASE BLOCKED |

**Scope:** Stage 12P changed only `scripts/security/medusa_226_ab_ci.sh` to reuse the existing `medusa-backend-poc/scripts/verify-redis-session-handoff.mjs` in disposable runner CI. It did not change production auth, tenant deployment, API middleware, Medusa pinned dependencies, payment/PSP logic, secrets, release gates, main or PR Draft status. Shared Redis cookie reuse on one host is NOT evidence for Redis failover, cross-region HA, cross-device revocation, TLS/CSRF or the deployed topology. Stage 12O established that customer/Admin **bearer JWTs remain accepted after cookie logout**; this remains an OPEN T02 security risk, not corrected by Stage 12P.

**Next permitted direction:** review (without deployment) disposable Redis outage/restart semantics and session invalidation limitations for a future Stage 12Q; native ALL refund correction, version promotion and production security controls still require distinct explicit approval.


## 2026-11-09 — Stage 12O candidate Medusa 2.22.6 A/B test matrix (EXACT-SHA CI VERIFIED)

| Gate | Positive and negative evidence | Status |
| --- | --- | --- |
| Two merchants | Concurrent API A/B, separate Postgres roles/DB and Redis A/B, denied A↔B DB connections | [42703930774](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42703930774) SUCCESS |
| Store/orders | Own synthetic checkout and receipt 200; foreign merchant IDs/keys and missing guest proof denied | SUCCESS, scoped fixtures |
| Identity and permissions | Own customer/admin JWT and cookie sessions accepted; other merchant/role and tampered/expired cookie replay denied; positive mutations and no-effect negative snapshots | SUCCESS, scoped fixtures |
| Registered receipt ownership | Registered owner accepted, unrelated same-store registered customer denied | SUCCESS, scoped fixtures |
| Logout revocation | Logout invalidated cookie but all four bearer JWTs still returned 200 | **OPEN / NOT REVOKED** |
| Finance and release | Pinned backend native uncaptured and +1 ALL refund P0 still reproduces | [42703930892](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42703930892) FAILURE / RELEASE BLOCKED |

**Residual risk and authorization:** all four A/B customer/admin bearer JWTs remained usable (HTTP 200) after cookie-session logout; server JWT revocation is NOT fixed. This evidence is disposable CI-only, not production multi-tenancy, HTTPS/CSRF, browser/device coverage, multi-process cookie handoff on the candidate, webhook/PSP/settlement, back-ups, media, RBAC completeness or release sign-off. No application dependency/lockfile change, no production server, no live payments, no main merge, no release-gate modification. PR #12 stays Draft.

**Next:** inspect the exact Medusa 2.22.6 multi-process cookie session handoff tests (read-only first); extend disposable CI only within the approved scope. A permanent version promotion or native finance correction needs distinct explicit authorization and independent safety review.


## 2026-11-09 — Stage 12N HTTP query candidate matrix (EXACT SOURCE CI VERIFIED)

| Candidate 2.22.6 case | Scope / assertion | Evidence / result |
| --- | --- | --- |
| Valid Store fields | GET /store/regions, `fields=id`, then nested `countries.iso_2`; HTTP 200, nonempty stable IDs | [42702330586](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42702330586) SUCCESS |
| Unsafe fields | 3 synthetic dotted paths involving prototype or constructor; no 5xx, no widened region IDs/unsafe own properties for 200; 400/422 is acceptable | Same run SUCCESS; **not** whole-server pollution proof |
| Isolation / release veto | Candidate key only in RUNNER_TEMP, original 2.22.0 unchanged, query and finance guards deny release | Same run SUCCESS; release BLOCKED |
| Not covered | Admin/JWT, tenant A/B, other query routes, PSP, financial invariants | **OPEN / NOT VERIFIED** |

**Limits:** The HTTP probe covers one Store route, three unsafe shapes and 2 legitimate field selections on a disposable seed; safe omission as HTTP 200 does not prove that every unsafe input is rejected or that server-wide prototype state is unmodified. It does NOT verify all query routes, Admin/JWT, cross-merchant isolation on 2.22.6, real PSP/webhooks/settlement, finance correctness, or Production. Native Medusa refund +1 ALL/uncaptured P0 (T05/S13) remains exposed in unchanged 2.22.0, and upstream 2.22.6 has not fixed that guard. **RG-01/02/03, G3/G5 RELEASE BLOCKED.** PR #12 remains Draft; no merge, deploy, permanent Medusa update, finance-policy or GitHub setting change. Other exact-source workflows must be checked separately; no all-green claim.

**Next narrowly scoped work:** read-only inspection of the existing tenant/JWT/order HTTP fixtures, then consider disposable 2.22.6 A/B merchant and auth regression (CI-only, no permanent upgrade); financial remediation and any production dependency promotion require distinct authorization and independent review.


## 2026-11-09 — Stage 12M disposable Medusa 2.22.6 candidate (CI VERIFIED ON SOURCE 433f9e15; RELEASE BLOCKED)

**Scope / owner confirmation:** following the immediately preceding request to authorize **only** isolated Medusa 2.22.6 candidate validation, the user replied to proceed. This authorizes the CI-only experiment, **not** an application dependency upgrade, a finance fix, main merge, Production rollout, PSP access, or release-gate relaxation. Current [source HEAD cfadd01a](https://github.com/titanfit102-bit/ShqipShop/commit/cfadd01a05fca6ee85387962bc07a36559045d8a) has eight completed workflows: **seven SUCCESS**, [backend 42691453259](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42691453259) genuine FAILURE of native unguarded Stage11P/J/O/I refund P0, while order/payment retry 11E/F passed. Source 2.22.0 is unchanged. Upstream [2.22.6 release](https://github.com/medusajs/medusa/releases/tag/v2.22.6) supersedes incomplete 2.22.5 and includes unsafe dotted-query path hardening, but its native refund amount check is unchanged.

**Implementation:** new `scripts/security/medusa_226_ci_candidate.py` (strict source 2.22.0 validation, fail-closed isolated copy into `RUNNER_TEMP`, exact direct Medusa 2.22.6 candidate while preserving independently versioned UI); new `test_medusa_226_ci_candidate.py` (six offline positive/negative regressions); new `medusa_226_query_probe.cjs` (positive nested-query utility and negative prototype-pollution synthetic assertions using actually installed candidate `@medusajs/utils`); new read-only [Medusa 2.22.6 candidate GitHub Actions workflow](https://github.com/titanfit102-bit/ShqipShop/blob/feat/merchant-auth-boundary-ci/.github/workflows/medusa-226-candidate-ci.yml). Candidate job runs pinned pnpm 10.11.1 `--lockfile-only` exclusively in runner temp; full version/snapshot preflight, frozen install, patched-query utility, disposable PostgreSQL migrations and HTTP health. Final step asserts original 2.22.0 source and BOTH query/finance release vetoes remain active. Registry resolution can fail if any 2.22.6 package is not published; that is a valid failure, not license to mix release trains or select 2.22.5.

**Verified Stage 12M result on exact source [433f9e15](https://github.com/titanfit102-bit/ShqipShop/commit/433f9e15dbeefaf1610aaa0489e9280d89e4a3f4):** [disposable candidate CI run 42696198294](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42696198294) **SUCCESS with a real GitHub job**. Runner logs show **72/72 Python tests PASS**, sixteen direct Medusa declarations staged at `2.22.6` only in ephemeral `RUNNER_TEMP`, pnpm v9 candidate lockfile regenerated and statically verified, **frozen pnpm installation PASS**, synthetic positive/negative installed query-utility assertions PASS, disposable PostgreSQL migrations PASS and local API health PASS. Final step verified the checked-in `2.22.0` manifest set remained unchanged and both query-security and RG-03 finance release vetoes still denied release. Earlier [e2a4e316](https://github.com/titanfit102-bit/ShqipShop/commit/e2a4e316b3a261c4c12aaf270c759378dc169a9c) candidate workflow had zero jobs due to invalid workflow context, and [82bd1ab9](https://github.com/titanfit102-bit/ShqipShop/commit/82bd1ab9f6fb5f255a0c7cc6f3670c2aaecdc5e2) showed candidate lock importer and package record parsing PASS but wrong preflight root path; both CI harness mistakes were corrected before the successful 433f run. **This does not constitute a permanent upgrade, an HTTP dotted-query-route regression, tenant auth isolation on the candidate, real PSP coverage, or production readiness.** Existing native refund P0 tests remain mandatory on the unchanged source. For 433f, the separate pinned-source baseline CI workflows were 7/8 SUCCESS, with the native Medusa backend still running at this readback. RG-01/02/03, G3/G5, T05/S13 and the production release remain BLOCKED.


## 2026-11-09 — Stage 12L scoped pnpm runtime-vs-dev importer coherence (SOURCE-HEAD CI VERIFIED; RELEASE BLOCKED)

**Completed basis:** [Stage12K corrective source 3eb7834e](https://github.com/titanfit102-bit/ShqipShop/commit/3eb7834e59de2433deb75ff8262f115890d58dbb) [security 42685473688](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42685473688) **60/60 Python tests PASS**. All eight exact-HEAD workflows finished: seven SUCCESS and [backend 42685473290](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42685473290) genuine FAILURE of preserved native P0 refund sentinels Stage11P/J/O/I; persisted uncaptured and +1 ALL refunds confirmed, while disposable checkout/restart recovery 11E/F passed. No payment remediation or release approval.

**New change:** `scripts/security/medusa_query_preflight.py` importer scanner now distinguishes `dependencies`, `devDependencies`, and `optionalDependencies` per pnpm workspace. A Medusa package required for runtime in backend or storefront **must** appear in the manifest's `dependencies` and corresponding lock importer runtime scope; root `@medusajs/eslint-plugin` must remain in devDependencies. Previously a package moved to dev-only could satisfy the flat importer lookup and fail to install in production. Duplicate dependency scope declarations fail closed, and optional Medusa packages must also obey the exact release train. Six new negative/positive regression cases; existing positive baselines retained. **SOURCE-HEAD CI VERIFIED:** [2719c609](https://github.com/titanfit102-bit/ShqipShop/commit/2719c609acfba3e3650a59bee901a8e1d98a7554) [security run 42687388564](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42687388564) **SUCCESS, 66/66 Python tests PASS**, actual pinned pnpm v9 preflight and financial sentinel-source contract passed; known vulnerable 2.22.0 release veto still detected. All eight exact-code-SHA workflows completed: **seven SUCCESS**, [backend 42687388502](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42687388502) **FAILURE after real execution**. Backend logs confirmed the mandatory Stage11P authenticated Admin uncaptured refund persisted, Stage11J/O +1 ALL excess refund persisted, and Stage11I direct payment-module over-refund persisted. Narrow disposable CI-only Stage11Z idempotency/concurrency and Stage11E/F order/payment recovery checks passed; they do not fix native amount invariants. This is static preflight/defense in depth only, not vendor security or financial fixes. This documentation-only commit has a different HEAD; any new CI must be classified separately.

**Boundary:** no actual package/lock changes, Medusa upgrade, production runtime/PSP/refund logic, auth/tenant migration, secret/config change, main merge or deploy. Pinned 2.22.0 dotted-query exposure and T05/S13 native finance P0 remain OPEN; RG-01/02/03, G3/G5 and release remain BLOCKED. Further 2.22.6 candidate and finance remediation require separately specified permission.


## 2026-11-09 — Stage 12K test fixture correction (IMPLEMENTED; CI PENDING; RELEASE BLOCKED)

[First Stage12K security run 42685065083](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42685065083) on [3a7cc1c](https://github.com/titanfit102-bit/ShqipShop/commit/3a7cc1c581301588646663bbc0b0ce175ed25922) executed **59 Python tests: 58 PASS, 1 FAIL**. The failed case was a **pre-existing fixture defect**, not an observed financial release bypass: `test_financial_release_gate_blocks_p0_and_unknown` wrote a literal backslash followed by `n` after the trailing pipe rather than a real newline. With the strengthened Stage12K row parser, this malformed row correctly returned UNKNOWN rather than NOT-APPROVED. All five new duplicate/malformed tests passed. Security preflight and finance source steps were SKIPPED after unit failure and MUST NOT be described as passing on 3a7cc1c.

**Correction:** change only that test's two intended lines (single BLOCKED and single PASS fixtures) to use real `\\n` Python newline escapes, keeping the production code fail-closed. Add a new explicit negative fixture asserting that an invalid literal `\\\\n` suffix cannot impersonate a valid PASS table row. **Expected 60 Python tests; exact corrective CI PENDING.** No gate status, code policy, Medusa versions, lockfile, financial behavior, main or Production changed. Known T05/S13 refund and vulnerable Medusa 2.22.0 P0, RG-01/02/03 G3/G5 remain BLOCKED.


## 2026-11-09 — Stage 12K RG-03 contradictory row fail-closed (IMPLEMENTED; EXACT-HEAD CI PENDING; RELEASE BLOCKED)

**Exact Stage12J predecessor** [00083510](https://github.com/titanfit102-bit/ShqipShop/commit/00083510ef904db59c33642ad0a245fb62f6a84b): [security 42683427421](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42683427421) **54/54 Python tests PASS**, and seven of eight CI workflows SUCCESS. [Backend 42683427749](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42683427749) genuinely FAILED on mandatory native P0 persisted uncaptured Admin refund (11P) and +1 ALL excess/singular/direct module refunds (11J/O/I); mock restart/owner retry 11E/F passed. Native finance defect and version 2.22.0 dependency exposure remain OPEN; no release.

**New static governance hardening:** `scripts/security/guard.py` formerly stopped at the **first** `RG-03 cart/order/payment` row in `docs/security/SECURITY_RELEASE_GATES.md`, potentially reporting PASS if a duplicate forged PASS preceded a real BLOCKED P0 row. Now `financial_release_gate_failures` requires **exactly one valid Markdown table row** for RG-03: missing/malformed returns UNKNOWN, duplicate contradictory or repeated PASS rows return `FIN-RELEASE-RG03-AMBIGUOUS`, and the single BLOCKED row still returns NOT-APPROVED. Five new negative regression tests cover both duplicate orders, duplicate PASS, unformatted and incomplete rows; existing sole PASS fixture remains the positive test. **Expected 59 Python tests; exact new CI PENDING**. This is document-state source validation only, NOT independent finance certification and does not make any release green.

**Scope preserved:** no policy status switched to PASS, no Medusa dependency/lock edit, no payment, refund, PSP, tenant, production setting, merge or deployment change. RG-01/02/03, T05/S13, G3/G5 remain BLOCKED and release is forbidden pending real remedies and separate authorization.


## 2026-11-09 — Stage 12J duplicate Medusa lock keys (IMPLEMENTED / EXACT-HEAD CI PENDING; RELEASE BLOCKED)

**Completed predecessor:** [Stage12I source b5a9f2fb](https://github.com/titanfit102-bit/ShqipShop/commit/b5a9f2fb0ac170040ffd3bdea636adf72bb8870c), [security run 42681934746](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42681934746) **51/51 Python tests PASS**, pinned 2.22.0 exposure correctly flagged. All eight workflows completed: **seven SUCCESS** and [backend run 42681934537](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42681934537) **FAILURE** due to mandatory true native P0 refund regressions. Runner-local logs reproduced Stage11P Admin refund with no captured funds, Stage11J/O extra 1 ALL after full refund, Stage11I direct module over-refund. Stage11E/F lost-ack/restart and narrow CI-only Stage11X/Y/Z guards passed. This is not evidence of real PSP safety or release readiness.

**Stage12J narrow change:** `scripts/security/medusa_query_preflight.py` now tracks the full key of each actual top-level `packages:` and `snapshots:` Medusa record, including its peer-resolution suffix, and fails closed on a repeated **identical key**. Previously the version-level `set` would silently deduplicate duplicate lockfile keys; adding a second YAML entry could produce an ambiguous lockfile despite the static check returning PASS. Distinct valid peer snapshots for the same package/version remain allowed. Three regressions (duplicate package, duplicate snapshot, distinct peer-positive) added; **expected 54 Python tests; new exact-source CI PENDING**. No general YAML parser, dependency-download or installed-runtime correctness claim.

**No authorization expansion:** manifests and pnpm lock untouched; Medusa remains 2.22.0 with unpatched dotted-query issue; refund T05/S13 P0 and RG-01/02/03/G3/G5 stay **BLOCKED**. No financial/PSP/policy/tenant/product deployment changes, no main merge. An official 2.22.6 disposable candidate and native refund remediation require separate explicit authorization.


## 2026-11-09 — Stage 12I unexpected Medusa lock-key fail-closed guard (IMPLEMENTED; EXACT-HEAD CI PENDING; RELEASE BLOCKED)

**Verified basis:** [Stage12H source d729816d](https://github.com/titanfit102-bit/ShqipShop/commit/d729816d3236258910a27204b9d5e2791a756f50), [security run 42679719004](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42679719004), **47/47 Python tests PASS**; all eight exact-SHA workflows completed with **seven SUCCESS** and [Medusa backend 42679718938](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42679718938) genuinely **FAILED** preserved refund-P0 checks Stage11P/J/O/I (uncaptured and +1 ALL persisted). The real pnpm v9 lock has **158** package/snapshot keys starting `'@medusajs/` under the two top-level sections, all 158 recognized by the existing static Medusa key pattern on source inspection. These observations are not production security evidence.

**Narrow Stage12I change:** the existing `_lock_package_records` previously **silently ignored** a package or snapshot key beginning with the real Medusa namespace whose version was not recognized as strict stable `major.minor.patch`. A candidate with otherwise valid records could therefore hide a prerelease/custom tagged Medusa key from the version-train check. Now these nonconforming top-level Medusa keys fail closed with `MEDUSA-QUERY-LOCK-UNREADABLE`; ordinary comment text and foreign package peer-resolution substrings are not Medusa package records. Four positive/negative tests guard prerelease package, prerelease transitive snapshot, replaced critical key and legitimate foreign/comment text. **Expected 51 Python tests, exact new CI PENDING**. This is a deliberately narrow static reader, not general YAML parsing, dependency-signature verification or a Medusa security patch.

**Unchanged authorization/release:** no manifests, pnpm lock, dependency versions, actual runtime code, finance policy, real PSP, prod settings, main merge or deploy modified. Medusa 2.22.0 unsafe dotted query, native uncaptured/+1 ALL P0, T05/S13 and RG-01/02/03/G3/G5 remain **BLOCKED**. Next check exact-HEAD security CI log and real financial sentinel behavior; any 2.22.6 candidate or native finance fix requires separate explicit authorization.


## 2026-11-09 — Stage 12H storefront Medusa release-train coherence (IMPLEMENTED; EXACT-HEAD CI PENDING; RELEASE BLOCKED)

**Evidence and gap:** [Stage12G security baseline 42678555253](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42678555253) on [3e6cd034](https://github.com/titanfit102-bit/ShqipShop/commit/3e6cd034455d1fba7688abf923732aaf0bf6e351) verified **41/41 Python tests PASS** and correct recognition of real pnpm v9 importers, with pinned 2.22.0 exposure still flagged. Source inspection confirmed `medusa-backend-poc/apps/storefront/package.json` directly pins `@medusajs/icons`, `@medusajs/instantsearch-adapter`, `@medusajs/js-sdk`, `@medusajs/ui-preset`, and `@medusajs/types` at **2.22.0**, with corresponding `apps/storefront` pnpm importers. The prior static candidate gate checked only root and backend manifests, so a future Medusa candidate could be declared coherent despite leaving storefront Medusa packages on the older release train.

**Stage12H implementation:** extend `MANIFESTS` and explicit importer mapping to the existing Medusa storefront manifest and pnpm `apps/storefront` importer; require the `@medusajs/js-sdk` storefront package as an ownership boundary and validate all direct non-UI Medusa version specifiers and resolved lock entries there (independent `@medusajs/ui` exemption unchanged; transitive `icons` exception unchanged). Existing positive fixture now includes genuine storefront importer and `instantsearch.js` bare key. Six positive/negative regressions cover consistent storefront, stale direct SDK version, wrong lock resolution, missing importer, missing manifest and removal of required SDK. **Expected 47/47 Python tests; NOT VERIFIED until source-HEAD CI runs.** This is a static future-release prerequisite only, not installation or native query-path/PSP safety.

**Preserved limits:** current Medusa runtime is still `2.22.0`; query path security gap, native ALL +1 and uncaptured refund P0 (T05/S13), RG-01/02/03 and G3/G5 remain **BLOCKED**. No actual package.json/lockfile mutations, Medusa upgrade, storefront UI behavior, payment policy, PSP, tenant data, main merge or deployment. No pre-existing known-red finance sentinel was disabled. After security CI, check all exact-SHA checks and preserve native P0 failure. A disposable Medusa 2.22.6 upgrade and production finance changes still require separate authorization.


## 2026-11-09 — Stage 12G corrective pnpm plain-key parsing (IMPLEMENTED / CI PENDING; RELEASE BLOCKED)

[First Stage12G security run 42678088052](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42678088052) on [00de9906](https://github.com/titanfit102-bit/ShqipShop/commit/00de9906a34058b92382d15deed0e89b559ec63f) executed **39/39 Python tests PASS**, but the actual pinned pnpm v9 baseline step FAILED `MEDUSA-QUERY-LOCK-UNREADABLE`. Root cause was a scanner false positive, **NOT evidence that the real lockfile was tampered with**: the legitimate storefront dependency `instantsearch.js` appears as a plain unquoted key in real `apps/storefront` importers; the checker only recognized bare names without dots and erroneously associated the next resolved version with the preceding key, falsely reporting a duplicate. Source inspection of real importer keys found this one previously unrecognized dotted name.

**Correction:** accept valid dots in unquoted pnpm importer dependency names while still rejecting duplicate importer sections, names, dependency keys, scalar version/specifier fields and conflicting lock headers. Added positive fixture with `instantsearch.js` and negative fixture with an actual duplicate dotted dependency. Expected **41/41 Python tests**; exact corrective CI and actual pinned-lock preflight **PENDING**. No npm/pnpm install, vendor-version/lock edit or financial release remediation was performed. Original Stage12F static gate [42674706998](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42674706998) remains last fully successful 34/34 baseline before Stage12G.

**Boundaries:** Medusa 2.22.0 unsafe dotted query and native T05/S13 P0 excess ALL/uncaptured refunds remain unresolved, RG-01/02/03 and G3/G5 **BLOCKED**. No production system, real PSP, financial/auth tenant policy, main or deploy changed. Re-check actual corrective CI before status VERIFIED; all genuine unguarded refund probes must remain RED.


## 2026-11-09 — Stage 12G pnpm importer ambiguity guard (IMPLEMENTED / EXACT-HEAD CI PENDING; RELEASE BLOCKED)

**Motivation:** Stage12F [security run 42676761105](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42676761105) on SHA [1edafcac](https://github.com/titanfit102-bit/ShqipShop/commit/1edafcac39bb2ce8d78efbd4190883f79243f42b) logged **34/34 Python tests PASS**, while 7/8 workflows were SUCCESS and backend had entered its long-running disposable financial sequence at initial readback. The structural pnpm scanner still accepted one valid lockfile version anywhere in a lock containing a conflicting second header, and its importer scanner silently replaced duplicate importer/dependency/version mappings. These are **static gate ambiguity risks**, not proof that pnpm would install malformed locks.

**Implementation:** within the existing read-only `scripts/security/medusa_query_preflight.py`, require a single exact pnpm v9 lockfile-version header and a single importer section; reject duplicate importer identities, duplicate dependency keys and duplicate specifier/version scalars, failing closed with `MEDUSA-QUERY-LOCK-UNREADABLE`. Five negative fixture tests added to `scripts/security/test_medusa_query_preflight.py` alongside existing valid baseline/candidate fixtures. **Expected security suite 39 tests; NOT VERIFIED until exact-code CI completes.** Frozen-pnpm install in existing CI remains the runtime lock validation; this is only a static defense-in-depth preflight, not a Medusa vulnerability fix.

**Boundaries:** no manifest or lockfile edits, Medusa version upgrade, payment/refund, auth/tenant, PSP, production settings, main merge or deploy. The pinned 2.22.0 dotted-query exposure and native ALL/uncaptured refund P0 remain unresolved; T05/S13, RG-01/02/03, G3/G5 and release **BLOCKED**. Next inspect 39-test CI logs and real backend sentinel failures; 2.22.6 disposable candidate and actual finance remediation require separate explicit authorization.


## 2026-11-09 — Stage 12F static CI VERIFIED; financial release P0 BLOCKED

[Exact source 5f0843f](https://github.com/titanfit102-bit/ShqipShop/commit/5f0843f284f57cd9906218c1b281d014b08583df): [security CI 42674706998](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42674706998) executed a real job, **34/34 Python tests PASS**, Medusa 2.22.0 dependency exposure correctly detected and mandatory finance source contract verified. Manual `guard.py --release` job step was SKIPPED; passing static checks is **not** release approval. Seven of eight exact-SHA workflows completed SUCCESS: security, pilot, native, Redis worker, Redis cache, two isolated databases, parallel merchant. [Medusa backend 42674706996](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42674706996) ran real disposable checkout/PG/restart tests, then correctly FAILED on unguarded P0 payment refund regressions: uncaptured Admin refund (Stage11P), excess 1 ALL (11J/11O) and direct module over-refund (11I). CI-only strict guards passed; no production finance protection is established. Earlier d5bf8a11/ed54bccd zero-job failures did NOT test code; their cause remains unknown, while this subsequent run proves GitHub Actions can execute jobs.

**Status:** Stage12F pnpm packages+snapshots static preflight **VERIFIED** on source 5f0843f; pinned Medusa 2.22.0 dotted-query issue and financial T05/S13 P0 still **OPEN**. RG-01/02/03, G3/G5 and release remain **BLOCKED**. No vendor upgrade, real PSP, finance policy, main merge, production deploy or security setting change. Future 2.22.6 disposable candidate and native payment correction require separate explicit authorization. This documentation update has a distinct new HEAD whose CI must be classified separately.


## 2026-11-09 — Stage 12F paired pnpm critical snapshots (IMPLEMENTED / EXACT-HEAD CI PENDING; RELEASE BLOCKED)

**Source baseline:** [b507a512](https://github.com/titanfit102-bit/ShqipShop/commit/b507a512845131686cc36ba7382ab32e77ff383f) has [security run 42673090384](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42673090384) **SUCCESS with 30/30 Python tests**. Pilot, native, worker, parallel merchant and isolated-database workflows completed successfully; b507 Medusa and Redis cache failed **before creating any jobs**, so those two are **UNKNOWN runtime**. All eight docs-only [ed54bccd](https://github.com/titanfit102-bit/ShqipShop/commit/ed54bccd2deb6b4bedff7d73789861fefad533fb) workflows similarly failed with zero jobs and check-runs; no evidence indicates code defects or confirms the platform/billing cause. Separate actual-execution [Medusa run 42670620465](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42670620465) previously reproduced known mandatory-red 11I/J/O/P financial P0.

**New change:** Stage12F static checker now requires actual pnpm v9 package AND snapshot records of the approved version for all four critical `@medusajs/{medusa,framework,query,utils}` modules. Missing or duplicate `packages:` or `snapshots:` top-level sections fail closed. Four negative regression tests added; fixture updated to include legitimate paired snapshot records; existing tests adjusted to avoid invalid duplicated sections. Real pinned lock source inspection found these four critical modules in both sections at Medusa 2.22.0. The full expected **34 Python tests have not yet been verified on new exact SHA**; do not mark Stage12F VERIFIED until GitHub logs confirm.

**Limits / next:** static source check only, not full YAML parsing or installed runtime verification. No Medusa dependency upgrade, pnpm-lock mutation, auth/finance policy, PSP, production system, main merge, CI workflow or deploy. Query security gap in pinned 2.22.0 and ALL refund T05/S13 P0 persist; RG-01/02/03, G3/G5 remain **BLOCKED**. Next: inspect exact-SHA baseline test results and check whether no-job failures persist; authorized new vendor dependency candidate still requires separate approval.


## 2026-11-09 — Stage 12E pnpm lockfile evidence integrity (STATIC CI VERIFIED; RELEASE BLOCKED)

**Trigger:** after documentation-only checkpoint [d7a2ed32](https://github.com/titanfit102-bit/ShqipShop/commit/d7a2ed32edb24005c8b2fc0d6cc1949f9b1dbf21), all eight associated Actions runs reported `failure` but the GitHub jobs API returned **zero scheduled/executed jobs** for each workflow. [Security run 42672172893](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42672172893) and [backend run 42672173303](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42672173303) therefore provide **NO new code-test result**; the cause of the no-job state is UNKNOWN (do not assert billing, security failure, or a passing test). The previous exact-source 227df50c security run [42670620627](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42670620627) passed 26/26 Python tests; Medusa [42670620465](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42670620465) genuinely reproduced preserved unguarded refund P0 failure. Do not conflate those results with the no-job checkpoint.

**Narrow technical change:** the Stage12C/D static `scripts/security/medusa_query_preflight.py` previously counted every `@medusajs/pkg@version` substring anywhere in the pnpm lock as evidence of an installed module. A comment or an unrelated package's peer-resolution text could therefore misstate the presence/version of a critical package. Stage12E now recognizes only actual two-space, quoted Medusa keys under pnpm v9's top-level `packages:` and `snapshots:` records. Mandatory `medusa/framework/query/utils` versions must each be evidenced in real `packages:` records; actual mixed non-UI snapshot versions remain denied. Four new regression cases cover comment spoofing, unrelated peer-only text, genuine mixed snapshot and missing package section. A separate local Python parser-focused test with four assertions passed. **Subsequently the exact-code [security baseline 42673090384](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42673090384) on [b507a512](https://github.com/titanfit102-bit/ShqipShop/commit/b507a512845131686cc36ba7382ab32e77ff383f) completed 30/30 Python tests PASS**, plus the tracked-source scanner, financial sentinel source-contract check and informational old-Medusa dependency exposure detection. The manual --release step was SKIPPED; this is static preflight verification, not a release. Any future unexpected pnpm lock syntax must fail closed, not silently waive release checks.

**Scope / next:** no backend manifests or lock versions changed, no 2.22.6 installation, PSP, refund policy, tenant settings, new schema, `main` merge or deployment. Current 2.22.0 query-path release blocker and T05/S13 P0 refund blocker, RG-01/02/03 and G3/G5 remain **BLOCKED**. PR #12 remains Draft. Stage12E static preflight is **VERIFIED on b507a512**. At this readback, pilot [42673090063](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42673090063) and native [42673090401](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42673090401) also succeeded; the b507 Medusa [42673090015](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42673090015) and Redis-cache [42673090447](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42673090447) runs reported failure with **zero jobs**, providing no new runtime verdict. Other b507 workflows were still in progress at this checkpoint. Determine why some runs fail before job creation and check their later completion; do not suppress actual known-red P0 sentinels. This documentation checkpoint has its own new SHA and needs separate CI classification. Separately authorized 2.22.6 disposable candidate and native financial remediation are still future work.


## 2026-11-09 — Stage 12D corrective preflight for transitive UI icon versions (IMPLEMENTED / CI PENDING; RELEASE BLOCKED)

[First Stage12D security CI 42669664748](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42669664748) on SHA `6ecd5a3`: **23/23 Python unit tests PASS** including direct `guard.py --release` negative/positive fixtures. The baseline-status step FAILED with `MEDUSA-QUERY-TRANSITIVE-VERSION-MISMATCH` because a broadened version regex saw **`@medusajs/icons@2.21.2` alongside `2.22.0`** in the actual pinned pnpm lock. The older icons package is a **transitive React UI asset** (observed with React peer dependency), not a duplicate of the Medusa query-security modules; falsely treating it as the security-relevant runtime caused a classification defect in the Stage12D scanner. It is NOT evidence that the original dependency security gap has been repaired.

**Correction awaiting exact-HEAD CI:** restrict the transitive-version exception to **`@medusajs/ui` and `@medusajs/icons`** only, never to native query/HTTP/payment services. Require `@medusajs/framework`, `@medusajs/query`, `@medusajs/utils` and `@medusajs/medusa` each appear in pnpm transitive package records **exactly at the target version**; every other Medusa non-UI transitive package must also match. Direct dependency versions remain strictly checked in both manifests; missing/corrupt lockfile, missing critical module, foreign release train and malformed importer still fail closed. Added three unit tests: allow observed legacy UI icon only, deny a legacy non-UI module, deny absent query utility. The adjusted suite now has **26 Python tests** (previous 23 + 3), subject to GitHub verification. The CLI release gate must keep denying the current vulnerable `2.22.0` manifest with `SEC-MEDUSA-QUERY-PATCHED-TRAIN-UNVERIFIED`; passing the informational baseline has NEVER meant the vulnerability was fixed.

No Medusa package versions, pnpm lockfile, Node runtime, payment path, external PSP, live data, main merge or deploy changed. No Stage11I/J/O/P mandatory-red finance sentinel was changed. Continue to block T05/S13 P0, RG-01/02/03, G3/G5 and query dependency release approval. PR #12 Draft; next inspect new exact-HEAD security baseline success and financial-red preservation before declaring the scanner VERIFIED.


## 2026-11-09 — Stage 12D static release dependency veto regression (IMPLEMENTED / CI PENDING)

| Case | Expected assertion | Status |
| --- | --- | --- |
| Current Medusa 2.22.0 | `guard.py --release` emits `SEC-MEDUSA-QUERY-PATCHED-TRAIN-UNVERIFIED` and exits nonzero (other gates deliberately mocked PASS in isolated unit fixture) | IMPLEMENTED, exact-HEAD CI PENDING |
| Hypothetical consistent Medusa 2.22.6 manifest/lock | New **static prerequisite only** has no additional version error; does NOT certify release | IMPLEMENTED, exact-HEAD CI PENDING |
| Incomplete/missing pnpm lock, mixed direct versions, transitive 2.23.0 or missing transitive evidence | Fail closed with sanitized dependency diagnostics | IMPLEMENTED, exact-HEAD CI PENDING |
| Existing finance P0 and baseline scan | No modification to 11I/J/O/P assertions, RG-03, secret scan or unchanged 2.22.0 baseline flag | SOURCE INSPECTED; confirm CI |
| Genuine installed 2.22.6 query behavior, tenant isolation, PSP or runtime finance | Out of scope; separate authorization and CI candidate required | **NOT VERIFIED / RELEASE BLOCKED** |

Relevant source: `scripts/security/guard.py`, `scripts/security/medusa_query_preflight.py`, `scripts/security/test_medusa_query_preflight.py`. Added seven positive/negative test methods, including CLI wiring, without introducing an alternate financial ledger.


## 2026-11-09 — Stage 12C static baseline and candidate-only query regression harness (IMPLEMENTED; CI PENDING)

**Implemented:** `scripts/security/medusa_query_preflight.py` checks two direct Medusa package manifests, pnpm v9 importer specifiers/resolved versions, and transitive 2.22.x references. Default `--baseline` behavior is read-only and explicitly reports **pinned 2.22.0 vulnerable/RELEASE BLOCKED**; `--candidate` fails unless all Medusa release-train dependencies consistently resolve to 2.22.6 (excluding independently versioned `@medusajs/ui`). Nine isolated Python positive/negative unit regressions PASS locally (including mixed, missing and transitive older-version fixtures); new baseline workflow step and tests **await exact-head CI**. The separate candidate-only Node harness validates legitimate nested query field composition and rejects unsafe dotted fields in actual `@medusajs/framework/utils` **only once an approved 2.22.6 candidate is installed**; not executed against actual Medusa 2.22.6 yet. No unsafe-payload values are printed in CI logs. This is a source/dependency acceptance scaffold, NOT HTTP/provider/tenant/PSP evidence.

**Unchanged:** Medusa 2.22.0 manifest/lock, existing 11I/J/O/P mandatory-red financial sentinels, P0 and all release gates. Positive runtime candidate, HTTP 4xx malformed query tests, A/B tenant/regression and frozen-dependency install are **NOT VERIFIED** and need separate authorization.


## 2026-11-09 — Stage 12B pinned Medusa query-path hardening acceptance plan (NOT YET TESTED)

[Official Medusa release](https://github.com/medusajs/medusa/releases/tag/v2.22.6) and [merged fix PR #17712](https://github.com/medusajs/medusa/pull/17712): current backend manifest + pnpm lockfile use **2.22.0**; upstream fixes query path handling in **2.22.6**, not the native refund amount policy. These are required tests for a **future, separately authorized, isolated dependency candidate**, not claims that tests have already run.

| Test | Positive | Fail-closed negative | State |
| --- | --- | --- | --- |
| Dependency coherence | all runtime Medusa modules on one pinned 2.22.6 train, reproducible frozen lock install | mixed versions / unreviewed tarball rejected | PROPOSED |
| Query path safety | valid nested fields, filters, sorting, pagination unaffected | unsafe dotted segments and inherited keys rejected/skipped; malformed values result in expected 4xx, no shared-state mutation | PROPOSED |
| Tenant/auth regression | merchant A/B and genuine JWT admin/customer access still correct | foreign tenant, unauthenticated, revoked principal and forged scope blocked | PROPOSED |
| Checkout/payment | mock order capture and valid partial/exact full refund still work in disposable native ledger | known-red unguarded exact +1 ALL and no-capture tests 11I/J/O/P **remain unchanged and must still fail** until separate genuine finance fix | PROPOSED |
| Supply chain/deploy | verified upstream release provenance, diff, lock rebuild and rollback rehearsal | no production access, real PSP, secrets, signing, main merge, deployment or release gate override | PROPOSED |

Original full source comparison is in [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md). **None of these planned candidate tests were executed during Stage12B.** Financial S13/T05 P0 and RG-01/02/03/G3/G5 remain BLOCKED.


## 2026-11-09 — F08 Stage 11Z distinct-key two-API Medusa refund contention VERIFIED (CI ONLY; P0 BLOCKED)

**Proven on exact-source HEAD [fe8f578](https://github.com/titanfit102-bit/ShqipShop/commit/fe8f578d602e574b8b2ec78646ed9b171c248a99), [Medusa CI 42661306711](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42661306711):** two independent locally running Medusa 2.22.0 APIs (9220/9221), same disposable PostgreSQL/Redis, authenticated Admin JWT, linked fully captured mock payment, distinct refund body idempotency keys. Each request was independently within available captured ALL; combined proposed amounts exceeded captured total by at least 3 ALL to avoid conflating this test with the already-confirmed upstream 1 ALL epsilon defect. Observed **200/400**, exactly ONE successful authoritative Medusa refund row for the winning amount, no capture mutation: `SHQIPSHOP_F08_STAGE11Z_ONE_WIN_ONE_DENIED_LEDGER_PASSED`. Winning-key replay returned **409** at the narrow CI preflight (not native replay) with no mutation: `SHQIPSHOP_F08_STAGE11Z_WINNING_KEY_REPLAY_DENIED_NO_MUTATION`. A new, legitimate exact-remaining-ALL refund persisted, then after full refund a fresh +1 ALL was **409** with unchanged ledger. Markers `SHQIPSHOP_F08_STAGE11Z_LEGITIMATE_REMAINDER_PERSISTED`, `SHQIPSHOP_F08_STAGE11Z_AFTER_FULL_ONE_ALL_DENIED`, `SHQIPSHOP_F08_STAGE11Z_DISTINCT_KEY_TWO_API_CONTRACT_PASSED` were present. The first test at 42660058320 proved the 200/400 ledger result but had an incorrect replay-2xx expectation; [9422f70](https://github.com/titanfit102-bit/ShqipShop/commit/9422f7002479b73b088472d35bc6143507916352) correctly requires the CI guard's 409, not a bypass, and this retest passed.

**CI summary:** 7 distinct workflows SUCCESS at source HEAD fe8f578; Medusa backend workflow **FAILURE by preserved financial P0**, because unguarded 11I/J/O/P mock +1 ALL / zero-capture refund sentinels remain reproducible. Stage11W/X/Y/Z narrow CI proofs passed but do NOT resolve production. The 2-API requests were started concurrently without an explicit barrier forcing lock overlap. No live PSP/settlement, signed provider webhook, durable outbox linked to Medusa authoritative ledger, effective merchant finance RBAC, multi-region protection or real payment was verified. **S13/T05 P0, RG-01/02/03, G3/G5 BLOCKED; no merge, release or Production authorization.** PR #12 Draft, `main` untouched.

**Next:** review an exact-integer, single-authority Medusa refund policy under native payment-row locking, stable operation identities, provider ACK ambiguity and PSP reconciliation, with real tenant/finance permission checks. Keep fail-closed original P0 regressions; any production financial remediation or deployment needs separate explicit authorization. Further disposable CI validation may characterize the exactly-1-ALL excess boundary, but must not be represented as a fix.


## 2026-11-09 — Stage 11Z first CI diagnostic and replay-assertion correction (IMPLEMENTED; RETEST PENDING, P0 BLOCKED)

[First exact-code Medusa CI 42660058320](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42660058320) on source SHA a67c287 (containing test code 177e2ea) showed two independent authenticated Admin API requests with **distinct keys** returned **200 / 400**, then an authoritative linked Medusa refund ledger readback passed `SHQIPSHOP_F08_STAGE11Z_ONE_WIN_ONE_DENIED_LEDGER_PASSED`: one successful stored refund of the winning amount and no duplicate. The Stage11Z script then FAILED because it incorrectly expected HTTP 2xx on the winning-key replay: the disposable CI **read-before-write amount guard** rejects the already-refunded amount with 409 before Medusa's native idempotency handler. This is a Stage11Z test-contract error, **not** evidence of a second refund or proof of a live PSP vulnerability. Do not claim full Stage11Z verification: legitimate remaining-balance refund and post-full +1 negative had not yet executed.

[Correction 9422f70](https://github.com/titanfit102-bit/ShqipShop/commit/9422f7002479b73b088472d35bc6143507916352) explicitly requires HTTP **409** on that CI-only replay and asserts the actual Medusa persisted ledger remains unchanged; it does not disable, relax or skip any Stage11Z amount, race, key or 11I/J/O/P financial assertion. Existing Stage11X/Y verified native key replays while sufficient remaining capture existed. **RETEST PENDING** on corrected code; check marker `SHQIPSHOP_F08_STAGE11Z_WINNING_KEY_REPLAY_DENIED_NO_MUTATION`, then legitimate exact remainder, post-full +1 rejection and final contract marker. Seven other workflows were SUCCESS in initial Stage11Z run; backend overall FAILURE also includes original P0 unguarded 11I/J/O/P sentinels. S13/T05 and RG-01/02/03 G3/G5 still BLOCKED. PR #12 Draft; main and Production untouched.


## 2026-11-09 — F08 Stage 11Z distinct-key, two-API native Medusa refund amount contention (IMPLEMENTED; CI PENDING, P0 BLOCKED)

**Code:** [177e2ea](https://github.com/titanfit102-bit/ShqipShop/commit/177e2ea8e87077a7b3420608a5dec0e63b6d54a4), scoped to the existing disposable Medusa 2.22.0 Admin HTTP proof and backend CI workflow only. This is the next independent fixture after Stage11Y. Two genuine Admin-JWT requests go simultaneously to two separate Medusa API processes (ports 9220/9221, common runner-local PostgreSQL and Redis), using **distinct request-body idempotency keys** against ONE actually captured mock Medusa payment. Each requested amount is individually valid; their sum exceeds the captured amount by at least 3 ALL, deliberately beyond the known upstream ALL zero-decimal epsilon of 1. The expected contract is **exactly one successful HTTP response, one 400/409/422 denial**, precisely one successful persisted Medusa refund totaling the winning amount, with unchanged capture. A replay of the accepted key must not mutate; the legitimate exact remainder must succeed; a post-full +1 ALL must be 409 without mutation. The independent Stage11B and known-red 11I/J/O/P cases stay mandatory and separate.

**STATUS: IMPLEMENTED / NOT VERIFIED.** The new Stage11Z assertions must be read from the exact SHA's backend CI logs before upgrading status. Requests are initiated concurrently but there is **no explicit in-flight barrier**, and this does not prove strict atomic serializability across all scheduling interleavings, real PSP settlement, privileged multi-merchant finance RBAC, signed webhook reconciliation, lost provider acknowledgements or a production remedy. The CI-only strict preflight is still disabled in non-CI environments. Native Medusa locks and keyed replay remain distinct from the confirmed upstream +1 ALL financial cap defect. **S13/T05 P0, RG-01/02/03 and G3/G5 BLOCKED; no merge, main mutation, deploy, secrets, real payment or schema change.**

**Next:** inspect the first exact-code Stage11Z CI run, including the positive/negative HTTP statuses and authoritative Medusa payment/refund ledger. If the new test fails, distinguish implementation/test faults from genuine native Medusa flaws, without weakening any P0 sentinel. Record verified code SHA, run ID and residual risks in these same canonical files.


## 2026-11-09 — F08 Stage 11Y two-API keyed Admin refund proof VERIFIED (DISPOSABLE CI ONLY; P0 BLOCKED)

**Evidence at exact code SHA:** [Medusa CI 42657814465](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42657814465), [source 0fdeb86](https://github.com/titanfit102-bit/ShqipShop/commit/0fdeb861206b29c560bd9d5b3eba1f728f8c08c0). Two independent Medusa API processes (ports 9220/9221), on a shared disposable PostgreSQL/Redis environment, accepted simultaneous genuine Admin JWT mock refund requests of 1 ALL with the SAME request-body idempotency_key (HTTP 200 / 200); Query Graph/PostgreSQL observed **one persisted Medusa refund row totaling 1 ALL**. A completed same-key retry added no second row; a different amount reusing the key was rejected without mutation; a new key permitted a second legitimate 1 ALL partial refund, with two unique records totaling 2 ALL. Markers: SHQIPSHOP_F08_STAGE11Y_TWO_APIS_ONE_REFUND_PERSISTED, SHQIPSHOP_F08_STAGE11Y_REPLAY_NO_SECOND_REFUND, SHQIPSHOP_F08_STAGE11Y_SAME_KEY_DIFFERENT_AMOUNT_DENIED, SHQIPSHOP_F08_STAGE11Y_DISTINCT_KEY_PARTIAL_REFUND_PERSISTED, SHQIPSHOP_F08_STAGE11Y_TWO_API_KEY_CONTRACT_PASSED. Stage 11X and 11W serial proofs also passed. This was concurrent dispatch **without an explicit in-flight critical-section barrier**, using the Medusa module and manual mock provider; it is not PSP external settlement, distributed failover, merchant-finance authorization or deterministic crash-in-provider proof.

**CI outcome and unclosed P0:** seven distinct workflows SUCCESS at source SHA 0fdeb86; Medusa backend workflow FAILURE because preserved unguarded 11I/J/O/P zero-decimal ALL +1 excessive/uncaptured refund regressions still persist. Never suppress those failures; Medusa native row locks and same-key idempotency do not fix captured-minus-refunded amount policy. Real PSP sandbox, signed webhooks, uncertain provider acknowledgements, distinct-key contention, effective merchant finance RBAC and production authorizations remain OPEN. S13/T05 P0 and RG-01/02/03, G3/G5 **BLOCKED**.

**Next (NOT IMPLEMENTED):** test two-API distinct-key contention against the real Medusa amount boundary with positive/negative mutation evidence, then design one authoritative exact-integer financial pre-dispatch constraint, stable operation records, PSP reconciliation and privileged merchant/actor checks. No production financial changes without separate approval. PR #12 Draft, main unchanged; no live payment, deploy, signing or schema change.


## 2026-11-09 — F08 Stage11X VERIFIED; Stage11Y two-API keyed refund CI PENDING (finance P0 BLOCKED)

[Medusa CI 42655863596](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42655863596) at [code 660d52f](https://github.com/titanfit102-bit/ShqipShop/commit/660d52f1e2def4208fb71ed6adbe60ba9bfef096) demonstrated authentic disposable Admin HTTP body idempotency_key replay 200 with no extra Medusa PostgreSQL refund row, denied same-key/different-amount, and successful legitimate distinct-key partial mock refund. Stage11X and 11W narrow positives PASS; the old unguarded 11I/J/O/P financial P0 sentinels still FAIL, so release remains BLOCKED.

[Stage11Y code 995dfbc](https://github.com/titanfit102-bit/ShqipShop/commit/995dfbcf059d80dff236e32e56c022cd7ef9c644), [workflow 389c135](https://github.com/titanfit102-bit/ShqipShop/commit/389c13530d4b71c4f2264742ff2ba7ed3cc4873f): two independent disposable local Medusa APIs sharing PostgreSQL/Redis send the same authorized mock refund body key concurrently to one linked captured payment. Require at least one successful HTTP response (other may be replay success or 409 pending), one persisted authoritative refund of exactly 1 ALL, no mutation on replay or mismatched amount, valid new-key second partial refund. **IMPLEMENTED, CI not yet verified**. No explicit in-flight lock barrier, true PSP callback/settlement, merchant permission or production finance policy; this test cannot pass RG-03. Keep all financial P0 gates and original RED sentinels.


## 2026-11-09 — Stage 11W verified and 11X replay diagnostic pending (P0 BLOCKED)

[Medusa run 42653606429](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42653606429) emitted all Stage11W serial exact-integer ALL Admin HTTP positive/negative markers on [code 75a1347](https://github.com/titanfit102-bit/ShqipShop/commit/75a13472e79718b1af7be2dc15b056c8a57c1233): uncaptured and invalid requests 409/4xx with immutable PG ledger, positive partial/full mock refunds persisted, +1 above capture/remaining and exhausted same/new-key denied. **11W VERIFIED CI only**; concurrent stable-key behavior was NOT tested by 11W. Unmodified unguarded 11I/J/O/P diagnostics still persist, so aggregate Medusa backend CI is expected RED and financial S13/T05 remains **P0/BLOCKED**. New [Stage11X source 3acb620](https://github.com/titanfit102-bit/ShqipShop/commit/3acb620c42ee8ea35ca2d4ac061c75ac4e0ef485) and [workflow fd003cf](https://github.com/titanfit102-bit/ShqipShop/commit/fd003cf62462b50a4de53a723081ca628afd2a01) add an independent captured-but-not-exhausted same-body-key Admin HTTP replay regression; **CI PENDING**. This only characterizes the exact built-in Admin route with a body idempotency_key under mock provider and cannot certify PSP idempotency or authorize production policy. No gate changes.


## 2026-11-09 — Stage 11V installed Medusa native payment-writer locks (VERIFIED CI; P0 BLOCKED)

[Code b6a45e9](https://github.com/titanfit102-bit/ShqipShop/commit/b6a45e94c430c3e78d3f61b3a85f68a7f5765cb3), [Medusa CI run 42649347776](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42649347776). **Verified with actual installed Medusa 2.22.0 Payment Module**: independent PostgreSQL transaction A locked an existing Medusa `payment` row; native `capturePayment` on another genuine un-captured Stage11B mock payment, and `refundPayment` on an independent fully refunded mock payment, each attempted the SAME native payment-row lock and rejected with PostgreSQL lock timeout (~3s, SQLSTATE 55P03). Confirmed `SHQIPSHOP_F08_STAGE11V_NATIVE_CAPTURE_WRITER_LOCK_TIMEOUT_NO_MUTATION`, `SHQIPSHOP_F08_STAGE11V_NATIVE_REFUND_WRITER_LOCK_TIMEOUT_NO_MUTATION`, `SHQIPSHOP_F08_STAGE11V_INSTALLED_NATIVE_PAYMENT_WRITER_LOCKS_PASSED`; independent Medusa Query Graph/Pg readbacks found no payment, capture or refund changes. On the exact code SHA: **7 distinct workflows SUCCESS**, Medusa backend **FAIL** because preserved unguarded 11I/J/O/P financial amount sentinels remain reproducible.

**Critical upstream source finding:** pinned [Medusa v2.22.0 Payment Module](https://github.com/medusajs/medusa/blob/v2.22.0/packages/modules/payment/src/services/payment-module.ts) already serializes native capture and refund record reservation with `FOR UPDATE` but performs provider calls after releasing the lock. Its refund amount validation uses `MathBN.lt(captured - (refunded+requested), -currencyEpsilon)`; [Medusa's currency utility](https://github.com/medusajs/medusa/blob/v2.22.0/packages/core/utils/src/totals/big-number.ts) returns epsilon `1/10^decimal_digits` and [ALL is defined with `decimal_digits: 0`](https://github.com/medusajs/medusa/blob/v2.22.0/packages/core/utils/src/defaults/currencies.ts), so **epsilon=1 ALL** and exactly **1 ALL over the captured amount does NOT satisfy the strict less-than rejection**. This explains the independently observed unguarded +1 ALL persisted regressions; do not mistake native locking for accurate monetary bounds. Separately, missing/unstable idempotency keys and provider uncertainty require audited reconciliation. No live PSP, true merchant/finance RBAC or production refund remediation was implemented. S13/T05 P0, RG-01/02/03 and G3/G5 **BLOCKED**. PR #12 Draft, `main` unchanged.

**Next 11W (NOT IMPLEMENTED):** narrow fail-closed zero-decimal ALL exact-integer amount policy test at the authorized Admin/Payment Module boundary, preserve all native locks, prove positive legitimate partial/full refund plus negative zero capture/+1 ALL/new-key/replay, and design PSP stable-key/reconciliation before separately approved production financial policy changes.

## 2026-11-09 — Stage 11U actual Medusa payment row-lock contention (VERIFIED disposable CI; P0 OPEN)

[Code 34e02d3](https://github.com/titanfit102-bit/ShqipShop/commit/34e02d395b049331f5285a4ad671c8268a5a5478), [backend run 42646934878](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42646934878). Following successful Stage 11K full mock capture/refund and 11T's authoritative PostgreSQL–Query Graph read-only comparison, Stage 11U locked the **actual Medusa `payment` table row** in PostgreSQL connection A (`FOR UPDATE`), proved independent connection B could **not** acquire that same row (`NOWAIT`, SQLSTATE 55P03), and proved a different Medusa payment row remained independently lockable. After forced transaction rollback, the original payment row could be locked again. Exact Medusa payment/capture/refund records and counts remained unchanged; no DML/PSP operation was executed by this proof. Positive markers: `SHQIPSHOP_F08_STAGE11U_SECOND_PG_CONNECTION_LOCK_DENIED`, `SHQIPSHOP_F08_STAGE11U_UNRELATED_PAYMENT_LOCK_ALLOWED`, `SHQIPSHOP_F08_STAGE11U_PAYMENT_ROW_LOCK_RELEASED_AFTER_ROLLBACK`, `SHQIPSHOP_F08_STAGE11U_REAL_PAYMENT_LOCK_NO_FINANCE_MUTATION`, `SHQIPSHOP_F08_STAGE11U_POSTGRES_ROW_LOCK_CONTRACT_PASSED`.

On the exact code SHA, seven **distinct** workflows SUCCESS; Medusa backend FAILURE by design because original unguarded 11I/J/O/P mock refund regressions still persist. Stage 11U does **not** prove that Medusa's built-in capture/refund workflows, PSP adapter or webhooks obtain this payment-row lock, nor that provider side effects and database commits are atomic. Medusa payment records remain the only authoritative finance source; Stage 11R/S outbox still synthetic and separate. S13/T05 P0, RG-01/02/03, G3/G5 remain **BLOCKED**. Next: independent review of real Medusa payment writer transaction hooks and PSP reconciliation semantics before any separately approved integration. PR #12 Draft, `main` unchanged; no production payment, schema, signing or deploy action.

## 2026-11-09 — Stage 11T actual Medusa payment authority read-only audit (VERIFIED CI; financial P0 OPEN)

[Code 3d24148](https://github.com/titanfit102-bit/ShqipShop/commit/3d2414808fa22e9d2206958a937c9e2663475458), [Medusa CI 42644438523](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42644438523). **Stage 11T passed on disposable Medusa 2.22.0:** after Stage11K had fully captured and refunded an independent linked Stage11B order via the manual mock provider, a read-only `REPEATABLE READ` PostgreSQL transaction checked the actual Medusa `payment`, `payment_collection`, `capture`, and `refund` rows against independent Medusa Query Graph fields, including IDs, ALL amounts, provider, capture/refund rows and succeeded status. The two views matched exactly; positive markers `SHQIPSHOP_F08_STAGE11T_MEDUSA_GRAPH_AUTHORITATIVE_PAYMENT_LINKED`, `SHQIPSHOP_F08_STAGE11T_POSTGRES_PAYMENT_CAPTURE_REFUND_GRAPH_MATCH`, `SHQIPSHOP_F08_STAGE11T_READ_ONLY_MEDUSA_PAYMENT_AUTHORITY_PASSED`. Negative in-memory mutation probes for wrong amount, currency, missing refund, duplicate capture and incorrect payment ID rejected; the database was not changed by 11T. Seven other distinct workflows SUCCESS; Medusa overall FAILURE because separate Stage11I/J/O/P unguarded P0 refund sentinels still reproduce and must stay red.

**Evidence is a stable-source comparison, NOT a transactional financial remedy.** The Query Graph read and PostgreSQL snapshot are not joined to real concurrent Payment Module/PSP writers; Stage11R/S atomic reservations remain on separate synthetic tables. No actual refund/provider action was initiated by 11T, no live merchant/admin RBAC, signed PSP webhook, provider reconciliation, or race against actual Medusa capture/refund writes was tested. S13/T05 P0, RG-01/02/03 and G3/G5 **BLOCKED**. PR #12 Draft, `main` untouched. Next: formally design a single authoritative per-payment lock/reservation contract integrated with Medusa payment writers, trusted tenant/finance permissions and PSP state reconciliation; separate approval is required before financial implementation.

## 2026-11-09 — Stage 11S 2-API atomic refund reservation test (VERIFIED CI, not production)

At [CI 42641468095](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42641468095), two independent live Medusa APIs (9220/9221) authenticated the same real Admin JWT and shared a disposable PostgreSQL ledger. Positive: finance-role fixture, permitted reserve, replay, transaction rollback and one accepted 60 ALL request. Negative: competing 60 ALL request rejected with 409 against 100 ALL; persisted exactly 60 ALL and one outbox operation, plus no foreign merchant/uncaptured/disabled-role/invalid amount mutation. Required markers `SHQIPSHOP_F08_STAGE11S_SECOND_INDEPENDENT_MEDUSA_API_READY`, `SHQIPSHOP_F08_STAGE11S_TWO_API_PROCESSES_SINGLE_REFUND_RESERVATION`, `SHQIPSHOP_F08_STAGE11S_CROSS_PROCESS_ATOMIC_CI_PASSED`. **Limits:** synthetic finance table/merchant role, no authoritative Medusa payment capture/refund lock or genuine PSP. Medusa backend smoke stays RED because 11I/J/O/P persist; risk S13/T05 and RG-03 BLOCKED.

## 2026-11-09 — Stage 11R: authenticated Admin + atomic synthetic refund reservation (CI VERIFIED; P0 BLOCKED)

[Code 3fcb13a](https://github.com/titanfit102-bit/ShqipShop/commit/3fcb13af30a5da5b2c2f94939fbd0834329095d3), [Medusa CI 42638458718](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42638458718). CI-only synthetic PostgreSQL ledger with real Medusa Admin JWT and fixture-linked finance permission/merchant scope: row lock, strict ALL cap, unique key, and transactional reserve/operation/outbox. Negative missing/invalid JWT, inactive/viewer, foreign merchant, zero capture, invalid/overfull amount, key conflict and rollback stayed immutable. Two concurrent HTTP requests for 60 ALL against 100 ALL capacity: 202 + 409, exactly one outbox and 60 ALL reserved; replay no duplicate. Markers `SHQIPSHOP_F08_STAGE11R_TWO_REAL_HTTP_REQUESTS_AT_MOST_ONE_RESERVATION` and `SHQIPSHOP_F08_STAGE11R_AUTHENTICATED_ATOMIC_HTTP_CI_PASSED`. **No actual Medusa refund or PSP provider was invoked by this proof.** Seven other workflow SUCCESS; Medusa overall FAIL because original unguarded 11I/J/O/P financial P0 persists. Not production-ready: no actual Medusa finance ledger synchronization, real merchant RBAC, PSP settlement, webhooks, or multi-process payment lock contract. S13/T05 and RG-01/02/03 G3/G5 BLOCKED. Next test authentic Medusa capture/refund authority in a transaction and reconcile provider results; require separate production-payment authorization.

## 2026-11-09 — Stage 11Q CI-only live Admin refund serial preflight (VERIFIED NARROW POSITIVE; P0 STILL OPEN)

**Proven only on disposable Medusa 2.22.0 / `pp_system_default` mock:** [code 560a59b](https://github.com/titanfit102-bit/ShqipShop/commit/560a59bae88cb6cd18cd0149e36182788192c752), [exact-SHA backend CI 42635633381](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42635633381). Added `src/api/middlewares/f08-refund-amount-ci.ts` and wired it to the built-in `POST /admin/payments/:id/refund` only behind the exact existing disposable CI identity/environment plus `SHQIPSHOP_F08_STRICT_REFUND_CI=true`; every normal environment remains a pass-through. After first proving the original **unguarded** real Admin HTTP case still accepted a refund without capture and persisted 1 ALL (11P P0 sentinel RED), the workflow shut down that server, started a new CI-guarded server, and used a separate linked customer/order/payment fixture. With genuine Medusa Admin JWT, uncaptured 1 ALL returned **HTTP 409 and no PostgreSQL refund mutation**, then a valid full capture + full refund **succeeded and persisted**, and a further +1 ALL returned **HTTP 409 with no new PostgreSQL refund**. Exact markers: `SHQIPSHOP_F08_STAGE11Q_UNCAPTURED_HTTP_DENIED_NO_PG_MUTATION`, `SHQIPSHOP_F08_STAGE11Q_AUTH_ADMIN_FULL_REFUND_PERSISTED`, `SHQIPSHOP_F08_STAGE11Q_POST_FULL_ONE_ALL_DENIED_NO_PG_MUTATION`, `SHQIPSHOP_F08_STAGE11Q_SERIAL_HTTP_GUARD_PASSED`.

**Scope cannot be overstated:** this is a serial **read-then-write** validation, NOT atomic under concurrent requests, not effective merchant/finance RBAC, not durable operation reservation/idempotency/outbox and not a provider-verified PSP refund. It is explicitly disabled for non-CI and does **not remediate production**, so no release gate can change. Independent Stage 11K strict-amount test PASSED; Stage 11I direct-module, 11J plural-workflow, 11O singular-workflow and 11P unguarded Admin HTTP financial over-refund cases continued to persist and FAIL. CI: **seven distinct workflows SUCCESS, one Medusa backend smoke FAILURE** by design (its final invariant combines both passing and failing probes). No merge, deploy, live payment, admin settings or schema changes; PR #12 Draft and `main` unchanged.

**Next technical stage (NOT IMPLEMENTED):** authenticated tenant/permission-scoped PostgreSQL atomic per-payment reservation and operation/outbox boundary, exact currency integer bounds including zero captured, concurrent attempts, retries, failure rollback and provider reconciliation. Validate real RBAC, tenant ownership, and signed PSP sandbox signals before requesting any production payment-policy approval. S13/T05 P0, RG-01/02/03, G3/G5 remain **BLOCKED**. Subsequent docs-only HEAD CI is independent of the verified `560a59b` code result.

## 2026-11-09 — Stage 11Q-0 source sentinel protection and manual RG-03 veto (SECURITY CI VERIFIED)

**Verified on GitHub:** [code ff33fbb](https://github.com/titanfit102-bit/ShqipShop/commit/ff33fbb70281de693e1808d0c741a60b282a354c), [security baseline 42633816780](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42633816780) SUCCESS; [code 2aea78d](https://github.com/titanfit102-bit/ShqipShop/commit/2aea78decd43876cc0852c49e5e27dd81378d97e), [security baseline 42634361096](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42634361096) SUCCESS. Python unit and deliberate deletion/status-change tests, mandatory Stage11I/J/O/P failing-sentinel source checks and narrow tracked-source credential scans passed. The manual `--release` command now fails closed unless the canonical financial RG-03 state is exactly `PASS`; the GitHub Actions manual release step itself was **SKIPPED** (no release dispatched). This is a narrow static governance check, NOT a payment fix, runtime proof, complete tamper defense or authorization to merge/deploy.

**Risk remains P0 / BLOCKED:** Stage 11P authentic Admin HTTP on a linked `pp_system_default` order persisted a refund without capture ([CI 42630328830](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42630328830)); Stage 11I/J/O over-refund regressions remain known RED. Stage 11K/L/M/N strict-amount/locking/outbox results are synthetic and not integrated into the real Admin route. Production, merchant/PSP, main, financial policy and branch admin settings untouched. Next work requires reviewed per-merchant Admin RBAC and atomic refund balance enforcement, persistent idempotency/outbox, and external PSP reconciliation with positive/negative tests. PR #12 Draft; separate latest-HEAD Medusa workflow result must be inspected.

## 2026-11-09 — Stage 11P: real authenticated Admin refund HTTP test (VERIFIED FAILURE, disposable only)

[Medusa backend CI 42630328830](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42630328830) / [code 61f8872](https://github.com/titanfit102-bit/ShqipShop/commit/61f88721d6ff6173b31b4a4a6d940e437af77374): real Medusa Admin login/profile positive and real customer register + fresh login + Store profile positive. Third independent *linked order* with `pp_system_default`: authorized payment with **0 captures, 0 refunds**, then real Admin `POST /admin/payments/:id/refund` `amount=1 ALL` returned 2xx and a new refund row persisted by PostgreSQL Query Graph readback (**CRITICAL FAIL**). Real customer JWT as Admin 401/403 + PG unchanged; negative Admin amount 400/422 + PG unchanged; missing/invalid bearer 401/403 + PG unchanged. A standalone unlinked collection 404 was **inconclusive**, superseded by linked-order proof. Stage11O omitted-amount denied/no mutation. Stage11K strict guard success; 11I/J/O persisted over-refunds and failed sentinels. No real provider, merchant/role matrix, replay/races under the authenticated route or production authorization tested. S13/T05 P0 / release RG-01/02/03 BLOCKED.


## 2026-11-09 — Stage 11O: singular refund workflow +1 ALL persisted; unauthenticated Admin denied (CONFIRMED CI)

**CONFIRMED internal payment failure and scoped HTTP auth negative only**, [CI 42543583104](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42543583104). Stage 11O `http-deny`: no/invalid JWT requests to live `/admin/payments/:id/refund` 401/403; PostgreSQL capture/refund rows unchanged. Stage 11O singular workflow (the one upstream Admin route invokes) denied +2 ALL and persisted **+1 ALL beyond full refund** on disposable mock; failing sentinel remains RED. Omitted amount attempted with no accept/persist marker; explicit separate verdict pending. Positive/forbidden **authenticated Admin role/tenant HTTP cases not verified**; real PSP not tested. Stage 11I/J direct/plural regressions persisted again; S13/T05 FAILED, RG-01/RG-02/RG-03 BLOCKED. Next authenticated authorization and object/merchant boundary verification.


## 2026-11-09 — Stage 11O Admin HTTP auth-negative and singular payment workflow (IMPLEMENTED, CI PENDING)

Two-phase script `f08-refund-admin-boundary-ci.ts`: live local Admin refund HTTP no/invalid JWT must deny and leave PG unchanged; Medusa `refundPaymentWorkflow` singular over-total +2, +1 epsilon and omitted amount cases get independent persisted refund checks. **Positive authenticated Admin with real role/tenant is not covered; only negative auth and internal workflow.** Both existing direct/plural overrefund regressions retained; S13/T05 RG-02/RG-03 BLOCKED.


## 2026-11-09 — Stage 11N finance-scope/outbox proof VERIFIED; Admin refund route traced

**Stage 11N POSITIVE/NEGATIVE CI VERIFIED (strictly synthetic):** [42540291032](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42540291032) role/tenant denials, exact ALL bound, atomic reserve+outbox, same-key replay/conflict, rollback, concurrent claims/worker lease, unknown provider outcome and fake confirmation checks passed. No live Admin auth, signed PSP callback, provider contract or deployed outbox. 11I/J persisted over-refunds and RED overall backend; S13/T05 remains FAILED/PARTIAL; RG-03 blocked. **Next security gap:** distinguish the built-in *singular* Admin `refundPaymentWorkflow` and its `refund:create` route policy from tested *plural* workflow; validate actual HTTP auth and tenant boundaries plus PG mutation, not source inspection alone.


## 2026-11-09 — Stage 11N finance identity + outbox S13/T06 proof (IMPLEMENTED; CI PENDING)

Early Medusa smoke script `f08-refund-authorized-outbox-ci.ts`: synthetic trusted actor/merchant fixture, finance-only permission with negative caller cases, exact zero-decimal ALL remaining bound, unique operation keys, atomic reserve + outbox, row-lock concurrency, rollback, no automatic resend after unknown mock provider outcome, and fake trusted confirmation/replay mismatch tests. **NOT real Medusa Admin auth/PSP/provider verification and NOT production bound.** Stage 11I/J regressions remain RED; S13/T05/T06 release gates BLOCKED.


## 2026-11-09 — F08 Stage 11M: synthetic provider ACK-loss reconciliation VERIFIED (CI ONLY)

**Stage 11M narrow VERIFIED:** [Medusa CI 42539022390](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42539022390) five processes, separate fake provider/local commits, discarded ACK, same-key replay without duplicate simulated effect, unknown result remaining reserved, dual reconciler idempotency, merchant scope and cleanup. No real PSP/provider lookup, permissions, webhook or production integration. Stage 11K PASS; Stage 11I/J direct/workflow over-refund PERSISTED/FAILED, backend smoke RED. S13/T05 still FAILED/PARTIAL, release BLOCKED.


## 2026-11-09 — Stage 11M S13 provider acknowledgement ambiguity (IMPLEMENTED; CI PENDING)

A mandatory disposable `medusa exec` script uses five distinct processes with fake provider table, persisted refund reservation and operation key; tests no resend on lost ACK, cross-merchant/key conflict, unknown provider result remaining reserved, repeated/concurrent reconciliation and cleanup. **Not a real PSP/provider, webhook/3DS, production auth or real process crash proof.** Stage 11I/J payment bugs remain RED; S13 FAILED/PARTIAL and RG-03 BLOCKED.


## 2026-11-09 — Stage 11L atomic refund reservation proof VERIFIED (DISPOSABLE PostgreSQL ONLY)

**VERIFIED as isolated DB reservation POC only:** [Medusa CI 42537695571](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42537695571) Stage 11L success with two PG sessions and NOWAIT row-lock proof; atomic new-key reservation, same-key replay, mismatched-key-amount denial, rollback, parallel 60+60 vs 100 ALL yielding at most one accepted, simulated merchant A/B scope checks. **NOT production refund route, RBAC, PSP or multi-process API proof.** Stage 11K serial bound SUCCESS; 11I/J over-refund tests FAILED by design and overall backend smoke RED. S13/T05 remains FAILED/PARTIAL; RG-02/RG-03 release BLOCKED.


## 2026-11-09 — Stage 11L S13/T05 atomic reservation primitive (IMPLEMENTED, UNVERIFIED)

New `f08-refund-reservation-race-ci.ts` uses two distinct PostgreSQL sessions, `FOR UPDATE NOWAIT` denial, transactional atomic balance+operation write, cross-tenant synthetic scoped checks, key replay/conflict and rollback, plus parallel over-cap claims. **CI PENDING**; this is database reservation evidence only, NOT a real provider refund or production permission. Retain mandatory Stage 11I/J failing checks. S13 P0/RG-03 BLOCKED.


## 2026-11-09 — F08 Stage 11K: strict serial ALL refund guard verified (DISPOSABLE CI ONLY)

**VERIFIED scope: TEST-ONLY serial pre-call amount guard, NOT fixed S13.** [CI 42536108473](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42536108473) Stage 11K showed successful exact integer ALL remaining-balance validation and PostgreSQL effects for positive partial/full and negative invalid/+1 ALL requests on independent second Stage 11B mock order. Known-red Stage 11J and 11I still persisted extra refunds and failed backend smoke. **S13/T05 remains FAILED/PARTIAL; RG-03 BLOCKED.** NEXT: scoped server RBAC/tenant, transactional idempotent serialization across processes, real PSP and webhook test suite.


## 2026-11-09 — Stage 11K narrow S13 guard test (IMPLEMENTED, CI PENDING)

`f08-refund-exact-bound-ci.ts` checks positive partial/full and negative invalid/over-remaining requests before the `pp_system_default` direct module call on an independent synthetic order. **Serial CI-only amount policy**; no production enforcement, auth, distributed lock or PSP evidence. Both confirmed 11I/11J regressions remain mandatory and red. S13/T05 remain FAILED/PARTIAL; RG-03 BLOCKED.


## 2026-11-09 — F08 Stage 11J: zero-decimal ALL workflow over-refund persisted (CONFIRMED CI FAILURE)

**S13/T05 updated, P0:** [CI 42534844309](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42534844309) confirmed a persisted extra `+1 ALL` refund through `refundPaymentsWorkflow` on a fully refunded separate Stage 11B mock payment, and independently confirmed direct module over-refund in Stage 11I. Normal partial/full workflow paths and `+2 ALL` denial passed. Zero-decimal epsilon=1 from pinned Medusa. **Status remains FAILED/PARTIAL, release BLOCKED**; no live PSP/sandbox, concurrent race, Admin authorization or real settlement proof. Keep both regressions enabled.


## 2026-11-08 — Stage 11J additional S13 workflow test (IMPLEMENTED, UNVERIFIED)

`f08-refund-workflow-ci.ts` uses the independent Stage 11B disposable payment with `refundPaymentsWorkflow` for over-total, partial, over-remaining, exact remaining, and fully-refunded negative checks; PostgreSQL Query proves persisted records. Runs **before** the existing Stage 11I direct-Payment-Module confirmed-red regression. Its passing log markers must be checked at exact SHA; the documented red low-level module risk and S13 **FAILED/PARTIAL** release status cannot be changed by a narrower green workflow.


## 2026-11-08 — F08 Stage 11I: direct module over-refund persisted (CONFIRMED CI FAILURE)

**CONFIRMED IN DISPOSABLE MEDUSA 2.22.0 CI, NOT A LIVE PSP TEST:** [diagnostic code ae65f20](https://github.com/titanfit102-bit/ShqipShop/commit/ae65f201bda12718184391d1d4ec3dfc57f5f777), [backend CI run 42533394638](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42533394638). After Stage 11G's full manual-provider capture and one legitimate keyed partial refund, the **direct** Payment Module `paymentService.refundPayment` accepted a fresh-key refund requested at **remaining captured amount + 1**. Independent Medusa PostgreSQL Query immediately found **two persisted refund rows, not one** and the CI emitted both `SHQIPSHOP_F08_STAGE11I_DIRECT_MODULE_OVER_REFUND_CALL_ACCEPTED` and `SHQIPSHOP_F08_STAGE11I_DIRECT_MODULE_OVER_REFUND_PERSISTED`. Its critical no-extra-refund assertion FAILED (2 !== 1). This confirms a persisted extra refund on this **direct low-level module invocation with `pp_system_default`**. It does **NOT** establish an exploitable standard Admin API path, real bank/card refund, external settlement loss, production behavior, or whether Medusa's higher-level workflows enforce the bound.

**Security decision:** Stage 11I = **FAILED / RELEASE-BLOCKING RISK for direct refund calls**; no code/config/role policy change is authorized for Production. Preserve the failing CI assertion; do NOT bypass, skip, weaken or relabel red as green. Other seven distinct workflows passed on the diagnostic SHA, while backend smoke remained RED. Medusa documentation describes a refund-amount validation step in [`refundPaymentsWorkflow`](https://docs.medusajs.com/resources/references/medusa-workflows/refundPaymentsWorkflow); it is a **candidate safe boundary**, NOT VERIFIED against pinned 2.22.0/our app. **NEXT:** separately test validated workflow over-amount and valid partial/full refund against fresh disposable payment/DB fixtures (positive+negative), confirm admin and programmatic refund call graph/RBAC, analyze refund idempotency/provider timeout and concurrency; decide on production policy/adapter only with separate authorization. RG-02/RG-03/F07g/F08/F09/G3/G5 **BLOCKED**. No main merge, live payments or production deployment.

## 2026-11-08 — F08 Stage 11H acceptance design pointer

[Existing F07g checkout design](../checkout/F07G_DURABLE_QUOTE_DESIGN.md) now enumerates provider eligibility and P01–P14 sandbox reconciliation/negative conditions. **No new execution evidence:** S13 remains PARTIAL and all relevant release gates remain BLOCKED; Stage 11G manual `pp_system_default` remains the last verified capture/refund scope.


The **minimum security tests depend on changed trust boundaries**. These are pointers to existing executable evidence and open acceptance conditions; do not duplicate entire scripts. Exact SHA/run needed before marking VERIFIED. CI jobs use synthetic tenants and disposable keys only.

| Test ID | Requirement / layer | Existing automated proof (scope) | Status | Next gate |
| --- | --- | --- | --- | --- |
| S01 | Pilot merchant auth/CSRF/idempotent checkout | `.github/workflows/verify.yml` runs pytest; [CI 40178952066](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178952066) | VERIFIED (pilot CI only) | HTTPS browser E2E |
| S02 | A/B backend/DB role and cross-order denial | `parallel-medusa-isolation-ci.yml`, `two-medusa-isolated-ci.yml`; [40178952139](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178952139) | VERIFIED (scoped A/B CI) | full admin/refund/media/tenant deprovision |
| S03 | F08 disposable CI registered cart auth, checkout and payment lifecycle | [CI 42529315731](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42529315731), `f08-psp-contract-ci.ts` plus 11F DB checks | VERIFIED narrow CI 8/8: full mock capture repeated without second persisted row, partial keyed refund repeated without duplicate, invalid amounts/conflicting key rejected | F08 P0 OPEN: real PSP, global/device JWT revoke, guest expiry, CSRF/cookies, production policy |
| S04 | Guest receipt ID not sufficient | `ensure-order-reader.ts` + checkout A/B tests | VERIFIED (GET covered) | returns and other order routes, restart |
| S05 | Redis session/cache, workers, locks and bounded outage recovery | F07c/F07d plus [CI 41328337308](https://github.com/titanfit102-bit/ShqipShop/actions/runs/41328337308) | Synthetic subsets VERIFIED; controlled Redis 10s pause + API crash/restart passed | Redis full loss/failover/HA, TLS/ACL, backups and queue retry idempotency OPEN |
| S06 | Client-local JWT logout + private cache isolation | `native-medusa/__tests__/auth-token-storage.test.ts`, other native cache tests, `verify-native.yml` | VERIFIED (Jest), PARTIAL system | Keystore/Keychain + emulator/device, revocation |
| S07 | Live synthetic Medusa payment mismatch HTTP 409 | `medusa-backend-smoke.yml` F07f injection; [CI 40178570633](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40178570633) | VERIFIED (opt-in CI only) | default production guard policy and PSP |
| S08 | F07g real Medusa guest/customer HTTP review and atomic accept, plus one per-cart PostgreSQL claim across distinct accepted quotes | `quote-claim-ci.ts`, `f07g-live-cart-snapshot-ci.ts`; [CI 40499708458](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40499708458) | VERIFIED disposable CI ONLY | Durable per-cart intent model, real Medusa stock/order/payment lock and PSP exactly-once business effects, CSRF/full pricing/UI |
| S09 | Production Android signed build, secure token at rest, certificate policy | Android `build.gradle`, manifest and token storage inspected | FAILED (debug release signing), PARTIAL/UNKNOWN elsewhere | signed release on isolated device + MASVS |
| S10 | Dependency security and provenance | Existing `native-dependency-audit.yml` is **report-only**, frozen installs and SHA-pinned actions in tested workflows | PARTIAL | risk-tuned blocking advisories, SBOM, verified CodeQL |
| S11 | High-confidence credential markers in tracked plaintext | `scripts/security/guard.py --scan`, 5 unittest cases, [run 40181786360](https://github.com/titanfit102-bit/ShqipShop/actions/runs/40181786360): 601 files, no matches | VERIFIED (narrow PR guard only) | Add historical/entropy/host secret scanning and workflow privilege/security scanning; never treat as complete secret audit |
| S12 | Live production domain/TLS/CSRF/rate limit/observability | No live environment evidence | UNKNOWN | independent staging/production validation |
| S13 | Real PSP charge/refund/webhook exactly-once and reconciliation | [CI 42529315731](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42529315731): Medusa Payment Module `pp_system_default` synthetic capture/refund + independent PostgreSQL | PARTIAL Stage 11G mock same-key replay; **FAILED Stage 11I** direct module over-refund persisted; **FAILED Stage 11J** validated workflow persisted +1 ALL after full refund (zero-decimal epsilon=1); +2 ALL rejected and valid partial/full persisted ([CI 42534844309](https://github.com/titanfit102-bit/ShqipShop/actions/runs/42534844309)); Admin/PSP unverified | PSP sandbox: external provider ID/ledger, signed webhook replay and 3DS, ambiguous timeout after external success, crash during PSP call, durable keys, merchant currency/stock reconciliation UNKNOWN/BLOCKED |
| S14 | Privacy retention/media upload/backup/restore | No live infra evidence | UNKNOWN | tenant-aware operator runbooks and drill |

## Incremental test selection

- **Docs/copy/theme:** S11 baseline + changed-doc review; no Medusa migrations or Android emulator unless security claims/code changed.
- **Frontend/native logic:** S11 + `verify-native`, affected Jest, cache and auth negative tests; mobile network/storage controls if relevant.
- **Server/API/auth/DB/Redis/checkout:** S11 + relevant Medusa A/B isolation, payment/guest/session paths and synthetic negative/positive tests. Any payment amount or tenancy change expands S02–S08.
- **Dependencies/build/CI:** S11 + lockfile audit/SAST and supply-chain review, signed Android release check for distribution-related changes.
- **Release/prod:** ALL applicable gates in [SECURITY_RELEASE_GATES](SECURITY_RELEASE_GATES.md), real HTTPS/device/PSP/restore rehearsal and independent review.

No tests may be marked GREEN by skipping, suppressing or weakening security assertions. An intentionally red historical diagnostic is retained as evidence of the rejected architecture.
