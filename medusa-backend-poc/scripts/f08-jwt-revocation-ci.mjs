/** F08: prove a disposed JWT can be denied only by scoped CI policy.
 * A different Store route still accepts it — explicitly demonstrating
 * that global bearer revocation and production F08 remain UNSOLVED.
 */
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {resolve,sep} from "node:path"
for(const [key,val] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_F08_REVOCATION_CI:"true",
  SHQIPSHOP_F07G_HTTP_CI:"true",SHQIPSHOP_REQUIRE_REDIS:"true",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
})) assert.equal(process.env[key],val)
const temp=process.env.RUNNER_TEMP
const file=process.env.SHQIPSHOP_F07G_REGISTERED_QUOTE_PROOF_FILE
const pk=process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
assert(temp&&file&&pk&&[file,pk].every(p=>resolve(p).startsWith(resolve(temp)+sep)))
const {owner,stranger,cartId}=JSON.parse(readFileSync(file,"utf8"))
const key=readFileSync(pk,"utf8").trim()
assert(owner?.token?.length>20 && stranger?.token?.length>20)
assert(owner?.secondToken?.length>20 && owner.secondToken!==owner.token,
  "Runner must produce TWO distinct JWTs for the same customer")
assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(cartId))
const origin="http://127.0.0.1:9000"
async function request(method,path,token,{headers={},body}={}){
  const res=await fetch(origin+path,{
    method,
    headers:{
      "x-publishable-api-key":key,
      ...(token?{authorization:"Bearer "+token}:{}),
      ...(body?{"content-type":"application/json"}:{}),
      ...headers,
    },
    ...(body?{body:JSON.stringify(body)}:{}),
    cache:"no-store",signal:AbortSignal.timeout(20000),
  })
  let payload=null
  try{payload=await res.json()}catch{}
  return {status:res.status,payload}
}
const protectedQuote=token=>request("POST","/store/shqipshop/quote-boundary-ci",token,{
  headers:{"x-shqipshop-cart-id":cartId},
})
// CI diagnostic only: Medusa's built-in cart GET may use cart-ID possession
// rather than customer JWT authentication. Probe that assumption explicitly.
// Report status and synthetic cart ownership only; never log tokens or PII.
const customerCartPath="/store/carts/"+encodeURIComponent(cartId)
async function probeBuiltInCart(label,token) {
  const result=await request("GET",customerCartPath,token)
  assert([200,401,403,404].includes(result.status),
    "Unexpected built-in Medusa cart response during read-only authorization probe")
  if (result.status===200) {
    assert.equal(result.payload?.cart?.id,cartId)
    assert.equal(result.payload?.cart?.customer_id,owner.id)
  }
  console.log("SHQIPSHOP_F08_CART_"+label+"_HTTP_"+result.status)
  return result.status
}
const phase=process.argv[2] ?? "revocation"
assert(["revocation","outage"].includes(phase),"Only CI revocation/outage test phases allowed")
const revocation=(token,options={})=>request("POST","/store/shqipshop/f08-token-revoke-ci",token,options)
if (phase === "outage") {
  // A missing deny-list MUST block guarded private access (503), never
  // silently treat the bearer as unrevoked. Guest access is out of scope.
  assert.equal((await protectedQuote(owner.token)).status,503,
    "Revoked bearer must fail closed on missing PostgreSQL deny-list table")
  assert.equal((await protectedQuote(stranger.token)).status,503,
    "Even a valid unrevoked bearer must fail closed during deny-list outage")
  assert.equal((await protectedQuote(owner.secondToken)).status,503,
    "A second-device JWT also must fail closed during deny-list outage")
  assert.equal((await request("GET","/store/customers/me",owner.token)).status,503,
    "Guarded built-in private profile MUST deny on absent deny-list")
  assert.equal((await request("GET","/store/customers/me",stranger.token)).status,503,
    "Valid second customer must also fail closed during deny-list outage")
  console.log("SHQIPSHOP_F08_CI_DENYLIST_UNAVAILABLE_GUARDED_BEARER_503")
  // A different built-in Store private cart route is intentionally outside
  // this CI guard. Global revocation and outage coverage remain UNSOLVED.
  const unguarded=await request("GET","/store/carts/"+encodeURIComponent(cartId),owner.token)
  assert.equal(unguarded.status,200,"Unguarded private cart remains a global blocker")
  assert.equal(unguarded.payload?.cart?.customer_id,owner.id)
  console.log("SHQIPSHOP_F08_CI_GUARDED_BUILTIN_PROFILE_OUTAGE_FAIL_CLOSED_503")
  console.log("SHQIPSHOP_F08_CI_OUTAGE_PRIVATE_CART_STILL_UNGUARDED")
  process.exit(0)
}
const anonymousBefore=await probeBuiltInCart("NO_BEARER_BEFORE_REVOKE",null)
const foreignBefore=await probeBuiltInCart("FOREIGN_CUSTOMER_BEARER_BEFORE_REVOKE",stranger.token)
assert.equal((await protectedQuote(owner.token)).status,200,
  "Medusa authenticated bearer must be accepted BEFORE CI revocation")
assert.equal((await protectedQuote(owner.secondToken)).status,200,
  "Distinct second-device bearer must also authenticate as cart owner")
assert.equal((await request("GET","/store/customers/me",owner.secondToken)).payload?.customer?.id,
  owner.id,"Second token must correspond to the SAME verified customer")
assert([401,403,404].includes((await revocation("bad_ci_bearer")).status),
  "Unverified bearer must not create a revocation entry")
assert.equal((await revocation(owner.token,{headers:{"x-shqipshop-tenant-id":"merchant_foreign"}})).status,400)
assert.equal((await revocation(owner.token,{body:{customer_id:stranger.id}})).status,400)
assert.equal((await revocation(owner.token,{body:{all_devices:true}})).status,400,
  "The current CI endpoint has NO approved all-device logout semantics")
assert.equal((await protectedQuote(owner.token)).status,200,
  "Rejected revocation requests must not invalidate the legitimate JWT")
const done=await revocation(owner.token)
assert.equal(done.status,200)
assert.equal(done.payload?.revoked,true)
assert.equal((await revocation(owner.token)).status,200,
  "Explicit per-token CI revocation must be idempotent")
assert.equal((await protectedQuote(owner.token)).status,401,
  "Revoked JWT must be denied by guarded CI quote boundary")
assert.equal((await protectedQuote(owner.secondToken)).status,200,
  "Revocation of ONE JWT must not revoke a distinct JWT from same account")
assert.equal((await request("GET","/store/customers/me",owner.secondToken)).payload?.customer?.id,
  owner.id,"Independently authenticated device must remain usable")
assert.equal((await request("GET","/store/customers/me",owner.token)).status,401,
  "Revoked JWT must be denied even on the built-in customer profile")
console.log("SHQIPSHOP_F08_CI_TWO_DEVICES_ONE_TOKEN_REVOKED_OTHER_STILL_ALLOWED")
console.log("SHQIPSHOP_F08_CI_BUILTIN_PROFILE_DENIES_REVOKED_BEARER_401")
assert.equal((await revocation(owner.secondToken)).status,200,
  "Second device must be revocable independently on explicit request")
assert.equal((await protectedQuote(owner.secondToken)).status,401,
  "Second device must be denied after its OWN bearer is explicitly revoked")
assert.equal((await request("GET","/store/customers/me",owner.secondToken)).status,401,
  "Second-device JWT must be denied on the guarded built-in profile too")
assert.equal((await protectedQuote(owner.token)).status,401,
  "First device must remain revoked after independent second revocation")
console.log("SHQIPSHOP_F08_CI_SECOND_DEVICE_EXPLICIT_REVOCATION_DENIED")
assert.equal((await request("GET","/store/shqipshop/quote-review-accept-ci?quote_id=quote_00000000-0000-4000-8000-000000000000",owner.token,{
  headers:{"x-shqipshop-cart-id":cartId},
})).status,401,"Second guarded quote endpoint must deny revoked bearer")
console.log("SHQIPSHOP_F08_DISPOSABLE_PER_TOKEN_HTTP_REVOCATION_DENIES_GUARDED_QUOTE")
const guarded=await request("GET","/store/customers/me",owner.token)
assert.equal(guarded.status,401,
  "Explicitly revoked JWT must be denied on built-in profile under exact CI guard")
console.log("SHQIPSHOP_F08_CI_BUILTIN_PROFILE_REVOKED_JWT_401")
// Deliberately read-only: prove a second built-in PRIVATE Store resource
// accepts the same revoked JWT; never mutate a real customer or inventory.
const cart=await request("GET","/store/carts/"+encodeURIComponent(cartId),owner.token)
assert.equal(cart.status,200,"Unguarded Medusa cart read should still accept revoked bearer")
assert.equal(cart.payload?.cart?.id,cartId)
assert.equal(cart.payload?.cart?.customer_id,owner.id)
console.log("SHQIPSHOP_F08_GLOBAL_BEARER_REVOCATION_REMAINS_OPEN_STORE_CART_200")
// Compare the SAME customer-owned synthetic cart after explicit owner JWT
// revocation: this distinguishes bearer revocation from ID/capability access.
const anonymousAfter=await probeBuiltInCart("NO_BEARER_AFTER_REVOKE",null)
const foreignAfter=await probeBuiltInCart("FOREIGN_CUSTOMER_BEARER_AFTER_REVOKE",stranger.token)
assert.equal(anonymousAfter,anonymousBefore,"Revoking the owner's JWT must not rewrite anonymous cart access semantics")
assert.equal(foreignAfter,foreignBefore,"Revoking the owner's JWT must not change a different customer's cart read policy")
if (anonymousAfter===200) console.log("SHQIPSHOP_F08_CART_ID_ACCESS_WITHOUT_JWT_REQUIRES_SEPARATE_POLICY")
if (foreignAfter===200) console.log("SHQIPSHOP_F08_FOREIGN_BEARER_CAN_READ_CUSTOMER_CART_REQUIRES_OWNERSHIP_REVIEW")
