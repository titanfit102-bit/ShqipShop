/** CI-only real Medusa customer + admin JWT isolation between two live merchants.
 * Never log JWTs, passwords, cookies or private customer objects.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { request, isDenied } from "./boundary-http.mjs"
import { verifyMutations } from "./parallel-mutation-boundary.mjs"

assert.equal(process.env.CI, "true")
assert.equal(process.env.NODE_ENV, "development")
const merchants = [
  { id: "A", port: 9000, admin: "admin-a@shqipshop.example.invalid",
    customer: "shopper-a@shqipshop.example.invalid" },
  { id: "B", port: 9001, admin: "admin-b@shqipshop.example.invalid",
    customer: "shopper-b@shqipshop.example.invalid" },
]
for (const m of merchants) {
  const file = process.env["SHQIPSHOP_" + m.id + "_KEY_FILE"]
  assert(file, "Missing ephemeral key file")
  m.key = readFileSync(file, "utf8").trim()
  assert(m.key.length > 10)
  m.base = "http://127.0.0.1:" + m.port
  m.adminPassword = process.env["SHQIPSHOP_" + m.id + "_ADMIN_PASSWORD"]
  m.customerPassword = process.env["SHQIPSHOP_" + m.id + "_CUSTOMER_PASSWORD"]
  assert(m.adminPassword?.length >= 12 && m.customerPassword?.length >= 12,
    "Only disposable CI passwords are permitted")
}
assert.notEqual(merchants[0].key, merchants[1].key)
assert.notEqual(merchants[0].adminPassword, merchants[1].adminPassword)

const isBadLogin = (res, context) =>
  assert([400,401,403].includes(res.status), context + ": rejected identity expected, got " + res.status)

for (const m of merchants) {
  const reg = await request(m, "POST", "/auth/customer/emailpass/register", {
    body:{email:m.customer,password:m.customerPassword}
  })
  assert([200,201].includes(reg.status) && typeof reg.data.token === "string",
    m.id + " customer auth identity registration failed: " + reg.status)

  const customer = await request(m, "POST", "/store/customers", {
    key:true,token:reg.data.token,
    body:{email:m.customer,first_name:"Synthetic",last_name:"Merchant" + m.id}
  })
  assert([200,201].includes(customer.status) && customer.data.customer?.id,
    m.id + " customer account registration failed: " + customer.status)
  m.customerId = customer.data.customer.id

  const login = await request(m, "POST", "/auth/customer/emailpass", {
    body:{email:m.customer,password:m.customerPassword}
  })
  assert.equal(login.status,200,m.id + " customer login failed")
  assert(login.data.token?.length>20,m.id + " customer JWT missing")
  m.customerJwt = login.data.token

  const own = await request(m, "GET", "/store/customers/me", {key:true,token:m.customerJwt})
  assert.equal(own.status,200,m.id + " own customer profile unavailable")
  assert.equal(own.data.customer?.id,m.customerId,m.id + " wrong customer returned")
  isDenied(await request(m,"GET","/store/customers/me",{key:true}),m.id+" customer without session")

  const adminLogin = await request(m, "POST", "/auth/user/emailpass", {
    body:{email:m.admin,password:m.adminPassword}
  })
  assert.equal(adminLogin.status,200,m.id + " admin login failed")
  assert(adminLogin.data.token?.length>20,m.id + " admin JWT missing")
  m.adminJwt = adminLogin.data.token
  const ownAdmin = await request(m,"GET","/admin/users/me",{token:m.adminJwt})
  assert.equal(ownAdmin.status,200,m.id+" own admin profile unavailable")
  assert(ownAdmin.data.user?.id,m.id+" own admin identity missing")
  m.adminId = ownAdmin.data.user.id
  isDenied(await request(m,"GET","/admin/users/me"),m.id+" admin without login")
  isDenied(await request(m,"GET","/admin/users/me",{token:m.customerJwt}),m.id+" customer token used as admin")
  isDenied(await request(m,"GET","/store/customers/me",{key:true,token:m.adminJwt}),m.id+" admin token used as customer")
  console.log("SHQIPSHOP_MERCHANT_"+m.id+"_OWN_AUTH_PASSED")
}

// F06: a registered customer must not read a different guest's order, even
// if a cart possession credential happens to be supplied with the JWT.
for (const m of merchants) {
  const orderPath = process.env["SHQIPSHOP_" + m.id + "_ORDER_FILE"]
  const cartPath = process.env["SHQIPSHOP_" + m.id + "_CART_FILE"]
  assert(orderPath && cartPath, "Missing ephemeral receipt proof files")
  const orderId = readFileSync(orderPath, "utf8").trim()
  const cartId = readFileSync(cartPath, "utf8").trim()
  const uri = "/store/orders/" + encodeURIComponent(orderId)
  const stranger = await request(m, "GET", uri, {key:true,token:m.customerJwt})
  assert([401,403,404].includes(stranger.status),
    m.id + ": registered stranger read another shopper's order")
  const wrongRole = await request(m, "GET", uri, {key:true,token:m.adminJwt})
  assert([401,403,404].includes(wrongRole.status),
    m.id + ": admin JWT used as customer receipt reader")
  const bypass = await request(m, "GET", uri, {
    key:true,token:m.customerJwt,headers:{"x-shqipshop-cart-proof":cartId}
  })
  assert([401,403,404].includes(bypass.status),
    m.id + ": registered stranger fell back to guest proof")
  console.log("SHQIPSHOP_F06_SAME_MERCHANT_STRANGER_DENIED_" + m.id)
}

assert.notEqual(merchants[0].customerId,merchants[1].customerId)
assert.notEqual(merchants[0].adminId,merchants[1].adminId)
for (const target of merchants) {
  const foreign = merchants.find(m=>m!==target)
  isDenied(await request(target,"GET","/store/customers/me",{key:true,token:foreign.customerJwt}),
    target.id+" foreign customer JWT")
  isDenied(await request(target,"GET","/admin/users/me",{token:foreign.adminJwt}),
    target.id+" foreign admin JWT")
  isBadLogin(await request(target,"POST","/auth/customer/emailpass",{
    body:{email:foreign.customer,password:foreign.customerPassword}
  }),target.id+" foreign customer credentials")
  isBadLogin(await request(target,"POST","/auth/user/emailpass",{
    body:{email:foreign.admin,password:foreign.adminPassword}
  }),target.id+" foreign admin credentials")
  console.log("SHQIPSHOP_MERCHANT_"+target.id+"_FOREIGN_AUTH_DENIED")
}

// Establish real cookie sessions. Subsequent probes intentionally omit bearer headers.
const actors = [
  {name:"customer", path:"/store/customers/me", field:"customer", key:true},
  {name:"admin", path:"/admin/users/me", field:"user", key:false},
]
for (const m of merchants) {
  for (const actor of actors) {
    const session = await request(m, "POST", "/auth/session", {token:m[actor.name + "Jwt"]})
    assert.equal(session.status, 200, m.id + " session creation failed")
    assert(session.cookie.includes("connect.sid="), m.id + " session cookie missing")
    m[actor.name + "Cookie"] = session.cookie
    const own = await request(m, "GET", actor.path, {key:actor.key, cookie:session.cookie})
    assert.equal(own.status, 200, m.id + " own cookie rejected")
    assert.equal(own.data[actor.field]?.id, m[actor.name + "Id"], "Cookie actor mismatch")
    isDenied(await request(m, "GET", actor.path, {key:actor.key}), m.id + " no cookie")
    const tampered = session.cookie.slice(0, -1) + (session.cookie.endsWith("a") ? "b" : "a")
    isDenied(await request(m, "GET", actor.path, {key:actor.key,cookie:tampered}), m.id + " tampered cookie")
  }
  isDenied(await request(m,"GET","/admin/users/me",{cookie:m.customerCookie}),m.id + " customer cookie as admin")
  isDenied(await request(m,"GET","/store/customers/me",{key:true,cookie:m.adminCookie}),m.id + " admin cookie as customer")
  console.log("SHQIPSHOP_MERCHANT_" + m.id + "_OWN_COOKIE_AUTH_PASSED")
}
for (const target of merchants) {
  const foreign = merchants.find(m => m !== target)
  for (const actor of actors) {
    isDenied(await request(target,"GET",actor.path,{key:actor.key,cookie:foreign[actor.name + "Cookie"]}),
      target.id + " foreign " + actor.name + " cookie")
  }
  console.log("SHQIPSHOP_MERCHANT_" + target.id + "_FOREIGN_COOKIE_DENIED")
}

await verifyMutations(merchants)

for (const m of merchants) {
  const other = merchants.find(candidate => candidate !== m)
  for (const actor of actors) {
    const cookie = m[actor.name + "Cookie"]
    const logout = await request(m,"DELETE","/auth/session",{cookie})
    assert.equal(logout.status,200,m.id + " cookie logout failed")
    assert.equal(logout.data.success,true,"Logout did not report success")
    assert(logout.cookie.includes("connect.sid=;" ) || logout.cookie === "connect.sid=", "Logout did not clear cookie")
    isDenied(await request(m,"GET",actor.path,{key:actor.key,cookie}),m.id + " logged-out cookie replay")
    // Cookie logout does not certify JWT revocation. Characterize separately, without logging the token.
    const bearer = await request(m,"GET",actor.path,{key:actor.key,token:m[actor.name + "Jwt"]})
    assert([200,401,403].includes(bearer.status),"Unexpected JWT replay status")
    console.log("SHQIPSHOP_POST_LOGOUT_JWT_STATUS", JSON.stringify({merchant:m.id,actor:actor.name,status:bearer.status}))
    const renewed = await request(m,"POST","/auth/session",{token:m[actor.name + "Jwt"]})
    assert.equal(renewed.status,200,"Fresh session creation failed")
    const fresh = await request(m,"GET",actor.path,{key:actor.key,cookie:renewed.cookie})
    assert.equal(fresh.status,200,"Fresh session not usable")
    assert.equal(fresh.data[actor.field]?.id,m[actor.name + "Id"],"Fresh session actor mismatch")
    // Keep the renewed cookie for the later tenant's independence check.
    m[actor.name + "Cookie"] = renewed.cookie
    const independent = await request(other,"GET",actor.path,{key:actor.key,cookie:other[actor.name + "Cookie"]})
    assert.equal(independent.status,200,"Other merchant session affected by logout")
    assert.equal(independent.data[actor.field]?.id,other[actor.name + "Id"],"Other session actor mismatch")
  }
  console.log("SHQIPSHOP_MERCHANT_" + m.id + "_COOKIE_LOGOUT_REPLAY_DENIED")
}
console.log("SHQIPSHOP_TWO_MERCHANT_COOKIE_SESSION_ISOLATION_PASSED")
const health=await Promise.all(merchants.map(m=>fetch(m.base+"/health",{signal:AbortSignal.timeout(5000)})))
assert(health.every(r=>r.status===200),"Both merchant backends must stay live during auth")
console.log("SHQIPSHOP_TWO_MERCHANT_ADMIN_CUSTOMER_JWT_ISOLATION_PASSED")
