/**
 * F07g 2B-2C: true Medusa bearer + cookie customer HTTP positive and
 * foreign/expired-session denial. Disposable CI only, no payment/checkout.
 * Credentials remain process-local and are NEVER logged or stored in Git.
 */
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve, sep } from "node:path"

const required = {
  CI: "true",
  NODE_ENV: "development",
  SHQIPSHOP_REQUIRE_REDIS: "true",
  SHQIPSHOP_F07G_HTTP_CI: "true",
  DATABASE_URL: "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL: "redis://127.0.0.1:6379",
}
for (const [key,value] of Object.entries(required)) assert.equal(process.env[key],value)
const path = process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
const tmp = process.env.RUNNER_TEMP
assert(path && tmp && resolve(path).startsWith(resolve(tmp) + sep))
const key = readFileSync(path, "utf8").trim()
assert(key.length > 10)
const base = "http://127.0.0.1:9000"
const probe = "/store/shqipshop/quote-boundary-ci"
const denyStatus = status => [400,401,403,404].includes(status)
async function http(method, path, { token, cookie, headers={}, body }={}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "x-publishable-api-key": key,
      ...token ? { authorization: "Bearer " + token } : {},
      ...cookie ? { cookie } : {},
      ...body ? { "content-type": "application/json" } : {},
      ...headers,
    },
    ...body ? { body: JSON.stringify(body) } : {},
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  })
  let data = null
  const responseText = await response.text()
  try { data = responseText ? JSON.parse(responseText) : null } catch {}
  // Medusa route middleware may return JSON or no body on security failure.
  return {
    status: response.status, data,
    cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
  }
}
async function createCustomer(label) {
  const email = "f07g-"+label+"-"+randomBytes(7).toString("hex")+"@example.invalid"
  const password = randomBytes(28).toString("hex")
  const reg = await http("POST", "/auth/customer/emailpass/register", {
    body: { email,password },
  })
  assert([200,201].includes(reg.status) && reg.data?.token, "Customer auth register failed")
  const created = await http("POST", "/store/customers", {
    token: reg.data.token,
    body: { email,first_name:"Synthetic",last_name:"F07g-"+label },
  })
  assert([200,201].includes(created.status) && created.data?.customer?.id,
    "Account creation failed")
  const id = created.data.customer.id
  const login = await http("POST", "/auth/customer/emailpass", {
    body: { email,password },
  })
  assert.equal(login.status,200,"Registered login failed")
  assert(login.data?.token?.length > 20)
  const token = login.data.token
  const me = await http("GET", "/store/customers/me", {token})
  assert.equal(me.status,200)
  assert.equal(me.data?.customer?.id,id)
  return {id,token}
}
const a = await createCustomer("owner")
const b = await createCustomer("stranger")
const regions = await http("GET", "/store/regions")
assert.equal(regions.status,200)
const region = regions.data.regions?.find(r=>r.currency_code==="all"&&r.name==="Shqipëri")
assert(region?.id,"Albanian region not seeded")
const made = await http("POST", "/store/carts", { token:a.token,body:{region_id:region.id} })
assert.equal(made.status,200,"Authenticated cart create failed")
const cartId = made.data?.cart?.id
assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(cartId||""))
const retrieved = await http("GET","/store/carts/"+encodeURIComponent(cartId),{token:a.token})
assert.equal(retrieved.status,200,"Authenticated cart retrieve failed")
assert.equal(retrieved.data.cart?.customer_id,a.id,
  "Authenticated cart must be owned by real Medusa customer; do not emulate owner")
const own = async args=>http("POST",probe,{
  ...args, headers:{"x-shqipshop-cart-id":cartId,...args?.headers},
})
const bearer = await own({token:a.token})
assert.equal(bearer.status,200,"Customer bearer must access OWN cart")
assert.equal(bearer.data?.kind,"customer")
assert.equal(bearer.data?.scope_fingerprint,"authenticated")
console.log("SHQIPSHOP_F07G_REAL_CUSTOMER_BEARER_OWN_CART_HTTP_PASSED")
for(const [name,opts] of [
  ["foreign bearer", {token:b.token,headers:{"x-shqipshop-cart-proof":cartId}}],
  ["guest downgrade of owned cart", {headers:{"x-shqipshop-cart-proof":cartId}}],
  ["wrong tenant spoof", {token:a.token,headers:{"x-shqipshop-tenant-id":"merchant_foreign"}}],
  ["invalid bearer with proof", {token:"invalid_jwt_ci",headers:{"x-shqipshop-cart-proof":cartId}}],
]) {
  const result=await own(opts)
  assert(denyStatus(result.status),name+" unexpectedly authorized: "+result.status)
}
console.log("SHQIPSHOP_F07G_REAL_CUSTOMER_FOREIGN_BEARER_AND_GUEST_DOWNGRADE_DENIED")

const session = await http("POST","/auth/session",{token:a.token})
assert.equal(session.status,200,"Valid bearer must create real Medusa session")
assert(session.cookie.startsWith("connect.sid="),"Signed Medusa session missing")
const ownerCookie = await own({cookie:session.cookie})
assert.equal(ownerCookie.status,200,"Valid Medusa session cookie must access owner's cart")
assert.equal(ownerCookie.data?.kind,"customer")
const tampered = session.cookie.slice(0,-1)+(session.cookie.endsWith("a")?"b":"a")
assert(denyStatus((await own({cookie:tampered})).status),"Tampered session cookie accepted")

const logout = await http("DELETE","/auth/session",{cookie:session.cookie})
assert.equal(logout.status,200,"Medusa session logout failed")
assert.equal(logout.data?.success,true,"Medusa logout did not confirm success")
assert(denyStatus((await own({cookie:session.cookie,headers:{"x-shqipshop-cart-proof":cartId}})).status),
  "Logged-out session must not recover using cart possession header")
console.log("SHQIPSHOP_F07G_REAL_CUSTOMER_COOKIE_SESSION_AND_LOGOUT_DENIAL_PASSED")
// F08 policy remains OPEN: session logout does not revoke original bearer JWT.
// Never claim JWT revocation, never show actual token.
const replay = await own({token:a.token})
assert([200,401,403,404].includes(replay.status))
console.log("SHQIPSHOP_F07G_POST_COOKIE_LOGOUT_BEARER_STATUS",replay.status)
