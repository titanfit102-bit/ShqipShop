/** N03 Stage 2b: disposable A/B Medusa guest capability contract.
 * No real PSP, no production hosts, no secret/PII in logs. */
import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join } from "node:path"
import { request } from "./boundary-http.mjs"

assert.equal(process.env.CI, "true")
assert.equal(process.env.NODE_ENV, "development")
assert.equal(process.env.SHQIPSHOP_N03_GUEST_RECOVERY_PROBE, "true")
const guests = [
  {id:"A",base:"http://127.0.0.1:9000"},
  {id:"B",base:"http://127.0.0.1:9001"},
]
const denied = (r, reason) => assert([401,403,404].includes(r.status),reason+": must deny")
const handoffFile = process.env.SHQIPSHOP_N03_HANDOFF_FILE
assert(process.env.RUNNER_TEMP)
assert.equal(handoffFile, join(process.env.RUNNER_TEMP, "n03-guest-handoff.json"))
const recoveryEndpoint = "/store/shqipshop/guest-recovery-ci"
const recoveryPath = cart => recoveryEndpoint + "?cart_id=" + encodeURIComponent(cart)
const receiptPath = order => "/store/orders/" + encodeURIComponent(order)
const proofOptions = proof => ({key:true, headers:{"x-shqipshop-recovery-proof":proof}})
const completePath = cart => "/store/carts/" + encodeURIComponent(cart) + "/complete"

function fixtureQuery(merchant, cart, sql) {
  assert(["A", "B"].includes(merchant.id))
  assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(cart))
  const db = "shqipshop_ci_" + merchant.id.toLowerCase()
  return execFileSync("psql", ["-X", "-qAt", "-w", "-v", "ON_ERROR_STOP=1",
    "-h", "127.0.0.1", "-p", "5432", "-U", db, "-d", db, "-v", "cart=" + cart], {
    env:{PATH:process.env.PATH, PGPASSWORD:"merchant" + merchant.id + "_disposable"},
    input:sql, encoding:"utf8", timeout:10000, stdio:["pipe", "pipe", "pipe"],
  }).trim()
}

function assertPhase(merchant, cart, phase) {
  assert.equal(fixtureQuery(merchant, cart, `
    SELECT phase FROM shqipshop_n03_disposable_attempt WHERE cart_id = :'cart';
  `), phase)
}

function onlyPersistedOrder(merchant, cart) {
  // Each fixture checks out with its own guest customer. Count even orders
  // without a cart link, so a duplicate cannot be hidden by the recovery query.
  const observed = fixtureQuery(merchant, cart, `
    SELECT o.id
    FROM "order" o JOIN cart c ON c.customer_id = o.customer_id
    WHERE c.id = :'cart' AND o.deleted_at IS NULL;
  `)
  assert(/^order_[A-Za-z0-9_-]{8,}$/.test(observed), "Expected exactly one guest order in PostgreSQL")
  return observed
}

async function dispatch(merchant, fixture) {
  return request(merchant, "POST", completePath(fixture.cart), {
    ...proofOptions(fixture.proof), body:{},
  })
}

async function verifyConfirmed(merchant, fixture) {
  const options = proofOptions(fixture.proof)
  const recovery = await request(merchant, "GET", recoveryPath(fixture.cart), options)
  assert.equal(recovery.status, 200, "The persisted guest credential must recover the order")
  assert.deepEqual(recovery.data, {state:"confirmed", order_id:fixture.order})
  const receipt = await request(merchant, "GET", receiptPath(fixture.order), options)
  assert.equal(receipt.status, 200, "The persisted guest credential must read its receipt")
  assert.equal(receipt.data?.order?.id, fixture.order)
}

async function mintPendingCart(merchant) {
  const response = await request(merchant, "POST", recoveryEndpoint, {
    key:true, body:{region_id:merchant.region},
  })
  assert.equal(response.status, 201)
  assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(response.data?.cart_id))
  assert(/^[A-Za-z0-9_-]{43}$/.test(response.data?.recovery_proof))
  return {cart:response.data.cart_id, proof:response.data.recovery_proof}
}

async function verifyRegisteredCart(merchant, fixture, token) {
  const owner = await request(merchant, "GET",
    "/store/shqipshop/order-recovery-ci?cart_id=" + encodeURIComponent(fixture.cart),
    {key:true, token})
  assert.equal(owner.status, 200, "The registered owner must read the pending state")
  assert.deepEqual(owner.data, {state:"unknown"})
  denied(await request(merchant, "GET", recoveryPath(fixture.cart), proofOptions(fixture.proof)),
    "Guest credential after registered ownership was confirmed")
}

async function loginMerchantA(merchant) {
  const password = process.env.SHQIPSHOP_A_CUSTOMER_PASSWORD
  assert(password?.length >= 12)
  const login = await request(merchant, "POST", "/auth/customer/emailpass", {
    body:{email:"shopper-a@shqipshop.example.invalid", password},
  })
  assert.equal(login.status, 200)
  assert(login.data.token?.length > 20, "Expected registered customer credential")
  return login.data.token
}

async function verifyBeforeRestart() {
  for (const m of guests) {
    const keyPath=process.env["SHQIPSHOP_"+m.id+"_KEY_FILE"]
    assert(keyPath)
    m.key=readFileSync(keyPath,"utf8").trim()
    assert(m.key.length>10)
    const regions=await request(m,"GET","/store/regions",{key:true})
    assert.equal(regions.status,200)
    const region=regions.data.regions.find(r=>r.name==="Shqipëri")
    assert(region?.id)
    const catalog=await request(m,"GET","/store/products?region_id="+encodeURIComponent(region.id)+"&fields=%2Bvariants.*",{key:true})
    assert.equal(catalog.status,200)
    m.region=region.id
    m.variant=catalog.data.products.find(p=>p.variants?.length)?.variants[0]?.id
    assert(m.variant)

    const start=await request(m,"POST","/store/shqipshop/guest-recovery-ci",{
      key:true,body:{region_id:region.id},
    })
    assert.equal(start.status,201,m.id+": must provision cart and distinct guest recovery proof")
    assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(start.data?.cart_id))
    assert(typeof start.data?.recovery_proof==="string" && /^[A-Za-z0-9_-]{43}$/.test(start.data.recovery_proof))
    assert(start.data.recovery_proof !== start.data.cart_id, "Guest credential must differ from its cart ID")
    m.cart=start.data.cart_id
    m.proof=start.data.recovery_proof
    m.path="/store/shqipshop/guest-recovery-ci?cart_id="+encodeURIComponent(m.cart)
    const get=(proof,opts={})=>request(m,"GET",m.path,{
      key:true,headers:{...(proof?{"x-shqipshop-recovery-proof":proof}:{}),...(opts.headers??{})},
      ...(opts.cookie?{cookie:opts.cookie}:{}),
      ...(opts.token?{token:opts.token}:{}),
    })
    const initial=await get(m.proof)
    assert.equal(initial.status,200)
    assert.deepEqual(initial.data,{state:"unknown"})
    denied(await get(null),m.id+" cart ID alone")
    denied(await get(m.cart),m.id+" cart ID as a proof")
    denied(await get("A".repeat(43)),m.id+" guessed token")
    denied(await get(m.proof,{headers:{"x-shqipshop-tenant-id":"foreign"}}),m.id+" fake tenant")
    denied(await get(m.proof,{cookie:"connect.sid=fake"}),m.id+" cookie mode")
    denied(await get(m.proof,{token:"synthetic.invalid.jwt"}),m.id+" mixed bearer mode")
  }
  assert.notEqual(guests[0].cart,guests[1].cart)
  assert(guests[0].proof !== guests[1].proof, "Guest credentials must be independently issued")
  for(const m of guests){
    const foreign=guests.find(q=>q!==m)
    denied(await request(m,"GET",
      "/store/shqipshop/guest-recovery-ci?cart_id="+encodeURIComponent(foreign.cart),{
        key:true,headers:{"x-shqipshop-recovery-proof":foreign.proof},
      }),"cross merchant guest cart+proof")
    denied(await request(m,"GET",m.path,{
      key:true,headers:{"x-shqipshop-recovery-proof":foreign.proof},
    }),"same host foreign credential")
  }
  console.log("SHQIPSHOP_N03_GUEST_PRECOMPLETE_CAPABILITY_BOUNDARY_A_B_PASSED")

  for(const m of guests){
    const write=async(method,path,body)=>{
      const response=await request(m,method,path,{key:true,body})
      assert.equal(response.status,200,m.id+" guest cart mutation failed")
      return response.data
    }
    await write("POST","/store/carts/"+m.cart+"/line-items",{variant_id:m.variant,quantity:1})
    const address={first_name:"Synthetic",last_name:"Guest",address_1:"CI street",
      city:"Tirane",postal_code:"1001",country_code:"al"}
    await write("POST","/store/carts/"+m.cart,{
      email:"guest-"+m.id.toLowerCase()+"@example.invalid",
      shipping_address:address,billing_address:address,
    })
    const options=await request(m,"GET","/store/shipping-options?cart_id="+encodeURIComponent(m.cart),{key:true})
    assert.equal(options.status,200)
    assert(options.data.shipping_options?.length)
    await write("POST","/store/carts/"+m.cart+"/shipping-methods",
      {option_id:options.data.shipping_options[0].id})
    const payCollection=await request(m,"POST","/store/payment-collections",{
      key:true,body:{cart_id:m.cart},
    })
    assert.equal(payCollection.status,200)
    const collectionId=payCollection.data.payment_collection?.id
    assert(collectionId)
    const session=await request(m,"POST","/store/payment-collections/"+collectionId+"/payment-sessions",{
      key:true,body:{provider_id:"pp_system_default"},
    })
    assert([200,201].includes(session.status))
    denied(await request(m, "POST", completePath(m.cart), {key:true, body:{}}),
      "Checkout of a minted cart requires the guest credential")
    assertPhase(m, m.cart, "prepared")
    if (m.id === "A") {
      const clone = {...m, base:"http://127.0.0.1:9002"}
      const results = await Promise.all([dispatch(m, m), dispatch(clone, m)])
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409],
        "Only one process may dispatch the checkout")
      // Discard response bodies. Recovery uses only the credential and the database.
      m.order = onlyPersistedOrder(m, m.cart)
    } else {
      const completed = await dispatch(m, m)
      assert.equal(completed.status, 200)
      assert.equal(completed.data.type, "order")
      m.order = onlyPersistedOrder(m, m.cart)
      assert.equal(completed.data.order?.id, m.order)
    }
    assertPhase(m, m.cart, "claimed_for_dispatch")
    const opts={key:true,headers:{"x-shqipshop-recovery-proof":m.proof}}
    const recovered=await request(m,"GET",m.path,opts)
    assert.equal(recovered.status,200)
    assert.deepEqual(recovered.data,{state:"confirmed",order_id:m.order})
    assert.deepEqual((await request(m,"GET",m.path,opts)).data,recovered.data)
    // A newly issued guest recovery secret must also protect the private receipt.
    // Legacy cart ID alone is NOT an alternative authority for this new cart.
    const receiptPath="/store/orders/"+encodeURIComponent(m.order)
    denied(await request(m,"GET",receiptPath,{key:true,
      headers:{"x-shqipshop-cart-proof":m.cart}}),"legacy cart-id proof cannot read N03 receipt")
    denied(await request(m,"GET",receiptPath,{key:true,
      headers:{"x-shqipshop-recovery-proof":"A".repeat(43)}}),"wrong N03 receipt proof")
    const receipt=await request(m,"GET",receiptPath,{key:true,
      headers:{"x-shqipshop-recovery-proof":m.proof}})
    assert.equal(receipt.status,200,m.id+" new capability must read its own receipt")
    assert.equal(receipt.data?.order?.id,m.order)
    console.log("SHQIPSHOP_N03_GUEST_CAPABILITY_ONLY_RECEIPT_"+m.id)
    console.log("SHQIPSHOP_N03_GUEST_ORDER_PERSISTED_RECOVERY_"+m.id)
  }
  const b=guests[1],a=guests[0]
  const revoke=await request(b,"DELETE","/store/shqipshop/guest-recovery-ci",{
    key:true,headers:{"x-shqipshop-recovery-proof":b.proof},body:{cart_id:b.cart},
  })
  assert.equal(revoke.status,200)
  assert.equal(revoke.data?.revoked,true)
  denied(await request(b,"GET",b.path,{key:true,headers:{"x-shqipshop-recovery-proof":b.proof}}),
    "revoked capability")
  denied(await request(b,"GET","/store/orders/"+encodeURIComponent(b.order),{key:true,
    headers:{"x-shqipshop-recovery-proof":b.proof}}),"revoked capability cannot read receipt")
  console.log("SHQIPSHOP_N03_GUEST_REVOCATION_DENIED")


  const clone = {...a, base:"http://127.0.0.1:9002"}
  await verifyConfirmed(clone, a)
  console.log("SHQIPSHOP_N03_GUEST_CONFIRMED_ON_SECOND_PROCESS")

  const revoked = await mintPendingCart(a)
  const pending = await request(clone, "GET", recoveryPath(revoked.cart), proofOptions(revoked.proof))
  assert.equal(pending.status, 200)
  assert.deepEqual(pending.data, {state:"unknown"})
  const revocation = await request(clone, "DELETE", recoveryEndpoint, {
    ...proofOptions(revoked.proof), body:{cart_id:revoked.cart},
  })
  assert.equal(revocation.status, 200)
  assert.equal(revocation.data?.revoked, true)
  denied(await request(a, "GET", recoveryPath(revoked.cart), proofOptions(revoked.proof)),
    "Original process must observe revocation made on second process")

  const registered = await mintPendingCart(a)
  const guestState = await request(a, "GET", recoveryPath(registered.cart), proofOptions(registered.proof))
  assert.equal(guestState.status, 200)
  assert.deepEqual(guestState.data, {state:"unknown"})
  const token = await loginMerchantA(a)
  const association = await request(a, "POST", "/store/carts/" + registered.cart + "/customer", {
    key:true, token,
  })
  assert.equal(association.status, 200, "Guest cart must be assigned to the authenticated account")
  await verifyRegisteredCart(clone, registered, token)
  console.log("SHQIPSHOP_N03_GUEST_TO_REGISTERED_SECOND_PROCESS_PASSED")

  const unresolved = await mintPendingCart(a)
  const incomplete = await dispatch(a, unresolved)
  assert([200, 400, 409, 422].includes(incomplete.status) && incomplete.data.type !== "order",
    "An incomplete checkout must not report a completed order")
  assertPhase(a, unresolved.cart, "claimed_for_dispatch")
  const unconfirmed = await request(a, "GET", recoveryPath(unresolved.cart), proofOptions(unresolved.proof))
  assert.equal(unconfirmed.status, 200)
  assert.deepEqual(unconfirmed.data, {state:"unknown"})

  // This file exists only on the runner, with access restricted to its owner.
  const {cart, proof, order} = a
  writeFileSync(handoffFile, JSON.stringify({active:{cart, proof, order}, revoked, registered, unresolved}),
    {mode:0o600, flag:"wx"})
}

async function verifyAfterRestart() {
  const a = guests[0]
  a.key = readFileSync(process.env.SHQIPSHOP_A_KEY_FILE, "utf8").trim()
  assert(a.key.length > 10)
  const {active, revoked, registered, unresolved} = JSON.parse(readFileSync(handoffFile, "utf8"))
  await verifyConfirmed(a, active)
  const unconfirmed = await request(a, "GET", recoveryPath(unresolved.cart), proofOptions(unresolved.proof))
  assert.equal(unconfirmed.status, 200)
  assert.deepEqual(unconfirmed.data, {state:"unknown"})
  assertPhase(a, active.cart, "claimed_for_dispatch")
  assertPhase(a, unresolved.cart, "claimed_for_dispatch")
  assert.equal((await dispatch(a, active)).status, 409)
  assert.equal((await dispatch(a, unresolved)).status, 409)
  await verifyConfirmed(a, active)
  assert.equal(onlyPersistedOrder(a, active.cart), active.order)
  console.log("SHQIPSHOP_N03_MEDUSA_ATTEMPT_RECOVERY_NO_REDISPATCH_PASSED")
  denied(await request(a, "GET", recoveryPath(revoked.cart), proofOptions(revoked.proof)),
    "Restarted process must observe persisted guest revocation")
  await verifyRegisteredCart(a, registered, await loginMerchantA(a))
  console.log("SHQIPSHOP_N03_GUEST_RECOVERY_REVOCATION_AND_OWNERSHIP_AFTER_RESTART_PASSED")

  // An expired row is advanced only inside the disposable A CI database;
  // it is never an external user or production database.
  assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(active.cart))
  const sql="UPDATE shqipshop_n03_disposable_guest_recovery SET expires_at = now() - interval '1 second' WHERE cart_id = '"+active.cart+"';"
  execFileSync("psql",["-v","ON_ERROR_STOP=1","-h","127.0.0.1","-U","shqipshop_ci_a",
    "-d","shqipshop_ci_a"],{
      env:{...process.env,PGPASSWORD:"merchantA_disposable"},
      input:sql,encoding:"utf8",stdio:["pipe","pipe","pipe"],
    })
  denied(await request(a,"GET",recoveryPath(active.cart),{key:true,headers:{"x-shqipshop-recovery-proof":active.proof}}),
    "expired capability")
  denied(await request(a,"GET","/store/orders/"+encodeURIComponent(active.order),{key:true,
    headers:{"x-shqipshop-recovery-proof":active.proof}}),"expired capability cannot read receipt")
  console.log("SHQIPSHOP_N03_GUEST_EXPIRY_DENIED")
  console.log("SHQIPSHOP_N03_GUEST_RECOVERY_A_B_CI_PASSED")
}

const phase = process.argv[2]
assert(phase === undefined || phase === "after-restart")
if (phase === "after-restart") {
  await verifyAfterRestart()
} else {
  await verifyBeforeRestart()
}
