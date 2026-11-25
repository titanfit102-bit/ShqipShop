/** N03 Stage 2b: disposable A/B Medusa guest capability contract.
 * No real PSP, no production hosts, no secret/PII in logs. */
import assert from "node:assert/strict"
import { readFileSync, renameSync, writeFileSync } from "node:fs"
import { execFileSync, spawn } from "node:child_process"
import { createInterface } from "node:readline"
import { setTimeout as delay } from "node:timers/promises"
import { join } from "node:path"
import { request } from "./boundary-http.mjs"
import { readCheckoutQuote } from "../../native-medusa/app/data/checkout-quote.ts"
import {
  createCheckoutRecoveryClient,
  ORDER_COMPLETION_PENDING_KEY,
  reserveOrderCompletion,
} from "../../native-medusa/app/data/order-completion-recovery.ts"

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
const blockedFile = join(process.env.RUNNER_TEMP, "n03-checkout-blocked")
const a = guests[0]

function loadMerchantKey(merchant) {
  merchant.key = readFileSync(process.env["SHQIPSHOP_" + merchant.id + "_KEY_FILE"], "utf8").trim()
  assert(merchant.key.length > 10)
}
const recoveryEndpoint = "/store/shqipshop/guest-recovery-ci"
const recoveryPath = cart => recoveryEndpoint + "?cart_id=" + encodeURIComponent(cart)
const receiptPath = order => "/store/orders/" + encodeURIComponent(order)
const proofOptions = proof => ({key:true, headers:{"x-shqipshop-recovery-proof":proof}})
const completePath = cart => "/store/carts/" + encodeURIComponent(cart) + "/complete"

function fixtureConnection(merchant, cart) {
  assert(["A", "B"].includes(merchant.id))
  assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(cart))
  const db = "shqipshop_ci_" + merchant.id.toLowerCase()
  return {
    args:["-X", "-qAt", "-w", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "5432",
      "-U", db, "-d", db, "-v", "cart=" + cart],
    env:{PATH:process.env.PATH, PGPASSWORD:"merchant" + merchant.id + "_disposable"},
  }
}

function fixtureQuery(merchant, cart, sql) {
  const {args, env} = fixtureConnection(merchant, cart)
  return execFileSync("psql", args, {
    env, input:sql, encoding:"utf8", timeout:10000, stdio:["pipe", "pipe", "pipe"],
  }).trim()
}

function assertPhase(merchant, cart, phase) {
  assert.equal(fixtureQuery(merchant, cart, `
    SELECT phase FROM shqipshop_n03_disposable_attempt WHERE cart_id = :'cart';
  `), phase)
}

function persistedGuestOrders(merchant, cart) {
  // Each fixture checks out with its own guest customer. Count even orders
  // without a cart link, so a duplicate cannot be hidden by the recovery query.
  return fixtureQuery(merchant, cart, `
    SELECT o.id
    FROM "order" o JOIN cart c ON c.customer_id = o.customer_id
    WHERE c.id = :'cart' AND o.deleted_at IS NULL;
  `)
}

function onlyPersistedOrder(merchant, cart) {
  const observed = persistedGuestOrders(merchant, cart)
  assert(/^order_[A-Za-z0-9_-]{8,}$/.test(observed), "Expected exactly one guest order in PostgreSQL")
  return observed
}

const localCartKey = "cart_id"
const recoveryScenarios = new Set([
  "guest-confirmed", "guest-sealed", "guest-interrupted", "registered-confirmed", "registered-sealed", "registered-repriced",
])

function recoveryStorage(scenario) {
  assert(recoveryScenarios.has(scenario))
  const path = join(process.env.RUNNER_TEMP, "n03-client-" + scenario + ".json")
  const read = () => JSON.parse(readFileSync(path, "utf8"))
  function write(data) {
    const replacement = path + ".next"
    writeFileSync(replacement, JSON.stringify(data), {mode:0o600, flag:"wx"})
    renameSync(replacement, path)
  }
  return {
    initialize(cartId) {
      writeFileSync(path, JSON.stringify({[localCartKey]:cartId}), {mode:0o600, flag:"wx"})
    },
    async getItem(key) { return read()[key] ?? null },
    async setItem(key, value) { write({...read(), [key]:value}) },
    async removeItem(key) {
      const data = read()
      delete data[key]
      write(data)
    },
  }
}

async function reserveClientAttempt(scenario, cartId) {
  const storage = recoveryStorage(scenario)
  storage.initialize(cartId)
  await reserveOrderCompletion(cartId, storage)
}

async function verifyClientRecovery(merchant, scenario, cart, options, expected) {
  const storage = recoveryStorage(scenario)
  assert.equal(await storage.getItem(ORDER_COMPLETION_PENDING_KEY), cart)
  let reads = 0
  let receipts = 0
  const client = createCheckoutRecoveryClient({
    storage,
    readOutcome: id => {
      reads++
      const path = scenario.startsWith("registered-")
        ? registeredEndpoint + "?cart_id=" + encodeURIComponent(id)
        : recoveryPath(id)
      return request(merchant, "GET", path, options)
    },
    readReceipt: id => {
      receipts++
      return request(merchant, "GET", receiptPath(id), options)
    },
    async discardCart(id) {
      const saved = await storage.getItem(localCartKey)
      assert(saved === id || saved === null, "Disposable client may discard only its original cart")
      await storage.removeItem(localCartKey)
    },
    isCurrent: () => merchant.base === "http://127.0.0.1:9000",
  })
  assert.deepEqual(await client.recover(), expected)
  assert.equal(reads, 1)
  assert.equal(receipts, expected.state === "confirmed" ? 1 : 0)
  if (expected.state === "pending") {
    assert.equal(await storage.getItem(ORDER_COMPLETION_PENDING_KEY), cart)
    assert.equal(await storage.getItem(localCartKey), cart)
    await assert.rejects(reserveOrderCompletion(cart, storage), /confirmation pending/)
  } else {
    assert.equal(await storage.getItem(ORDER_COMPLETION_PENDING_KEY), null)
    assert.equal(await storage.getItem(localCartKey), null)
    assert.deepEqual(await client.recover(), {state:"idle"})
    assert.equal(reads, 1, "A terminal result is not replayed")
  }
}

async function dispatch(merchant, fixture) {
  return request(merchant, "POST", completePath(fixture.cart), {
    ...proofOptions(fixture.proof), body:{},
  })
}

function cancel(merchant, fixture) {
  return request(merchant, "POST", recoveryEndpoint + "/cancel", {
    ...proofOptions(fixture.proof), body:{cart_id:fixture.cart},
  })
}

async function verifySealed(merchant, fixture) {
  const recovered = await request(merchant, "GET", recoveryPath(fixture.cart), proofOptions(fixture.proof))
  assert.equal(recovered.status, 200)
  assert.deepEqual(recovered.data, {state:"no_order"})
  assertPhase(merchant, fixture.cart, "sealed_before_dispatch")
  assert.equal((await dispatch(merchant, fixture)).status, 409)
  assert.equal(persistedGuestOrders(merchant, fixture.cart), "")
}

async function verifyCancellation(merchant, clone) {
  const sealed = await mintPendingCart(merchant)
  await prepareCheckout(merchant, sealed, "guest-n03-sealed@example.invalid")
  const forbidden = await request(merchant, "POST", recoveryEndpoint + "/cancel", {
    key:true, body:{cart_id:sealed.cart},
  })
  denied(forbidden, "Cancellation requires the guest credential")
  assertPhase(merchant, sealed.cart, "prepared")

  await reserveClientAttempt("guest-sealed", sealed.cart)
  const cancelled = await cancel(merchant, sealed)
  assert.equal(cancelled.status, 200)
  assert.deepEqual(cancelled.data, {state:"no_order"})
  const repeated = await cancel(clone, sealed)
  assert.equal(repeated.status, 200)
  assert.deepEqual(repeated.data, cancelled.data)
  await verifySealed(clone, sealed)

  const competing = await mintPendingCart(merchant)
  await prepareCheckout(merchant, competing, "guest-n03-competing@example.invalid")
  const [cancellation, completion] = await Promise.all([
    cancel(clone, competing),
    dispatch(merchant, competing),
  ])
  assert.deepEqual([cancellation.status, completion.status].sort(), [200, 409])
  if (cancellation.status === 200) {
    assert.deepEqual(cancellation.data, {state:"no_order"})
    await verifySealed(merchant, competing)
  } else {
    assert.equal(completion.data.type, "order")
    assertPhase(merchant, competing.cart, "claimed_for_dispatch")
    const order = onlyPersistedOrder(merchant, competing.cart)
    assert.equal(completion.data.order?.id, order)
    await verifyConfirmed(clone, {...competing, order})
  }

  assert.equal((await cancel(clone, merchant)).status, 409)
  await verifyConfirmed(clone, merchant)
  console.log("SHQIPSHOP_N03_CANCEL_AND_DISPATCH_EXCLUSION_PASSED")
  return sealed
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

const registeredEndpoint = "/store/shqipshop/order-recovery-ci"
const registeredEmail = "n03-owner-a@example.invalid"
const shopperEmail = "shopper-a@shqipshop.example.invalid"

async function loginBuyer(merchant, email, password = process.env.SHQIPSHOP_A_CUSTOMER_PASSWORD) {
  assert(password?.length >= 12)
  const login = await request(merchant, "POST", "/auth/customer/emailpass", {
    body:{email, password},
  })
  assert.equal(login.status, 200)
  assert(login.data.token?.length > 20, "Expected registered customer credential")
  return login.data.token
}

const loginMerchantA = merchant => loginBuyer(merchant, shopperEmail)

async function createRegisteredTestOwner(merchant, email = registeredEmail) {
  const password = process.env.SHQIPSHOP_A_CUSTOMER_PASSWORD
  const identity = await request(merchant, "POST", "/auth/customer/emailpass/register", {
    body:{email, password},
  })
  assert([200, 201].includes(identity.status))
  assert(identity.data.token?.length > 20)
  const customer = await request(merchant, "POST", "/store/customers", {
    key:true, token:identity.data.token,
    body:{email, first_name:"Synthetic", last_name:"Owner"},
  })
  assert([200, 201].includes(customer.status))
  return loginBuyer(merchant, email)
}

async function mintRegisteredCart(merchant, token) {
  const response = await request(merchant, "POST", registeredEndpoint, {
    key:true, token, body:{region_id:merchant.region},
  })
  assert.equal(response.status, 201, "Registered N03 cart creation")
  const cart = response.data.cart_id
  assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(cart))
  return cart
}

const cancelRegistered = (merchant, cart, token) => request(merchant, "POST", registeredEndpoint + "/cancel", {
  key:true, token, body:{cart_id:cart},
})
const recoverRegistered = (merchant, cart, token) => request(merchant, "GET",
  registeredEndpoint + "?cart_id=" + encodeURIComponent(cart), {key:true, token})
const completeRegistered = (merchant, cart, token) => request(merchant, "POST", completePath(cart), {
  key:true, token, body:{},
})

async function verifyRegisteredSeal(merchant, cart, token) {
  const recovered = await recoverRegistered(merchant, cart, token)
  assert.equal(recovered.status, 200)
  assert.deepEqual(recovered.data, {state:"no_order"})
  assertPhase(merchant, cart, "sealed_before_dispatch")
  assert.equal((await completeRegistered(merchant, cart, token)).status, 409)
}

async function verifyRegisteredCancellation(merchant, clone) {
  const owner = await createRegisteredTestOwner(merchant)
  const shopper = await loginMerchantA(merchant)
  const cart = await mintRegisteredCart(merchant, owner)
  await prepareCheckout(merchant, {cart}, registeredEmail, owner)
  assert.equal(fixtureQuery(merchant, cart,
    `SELECT count(*) FROM cart WHERE id = :'cart' AND customer_id IS NOT NULL;`), "1")

  const pending = await recoverRegistered(merchant, cart, owner)
  assert.equal(pending.status, 200)
  assert.deepEqual(pending.data, {state:"unknown"})
  denied(await cancelRegistered(clone, cart, shopper), "Only the owning customer can cancel")
  denied(await recoverRegistered(clone, cart, shopper), "Only the owning customer can recover")
  denied(await cancelRegistered(merchant, cart), "Anonymous cancellation")
  denied(await completeRegistered(merchant, cart, shopper), "Only the owning customer can dispatch")
  assertPhase(merchant, cart, "prepared")

  await reserveClientAttempt("registered-sealed", cart)
  const [first, repeat] = await Promise.all([
    cancelRegistered(merchant, cart, owner),
    cancelRegistered(clone, cart, owner),
  ])
  for (const result of [first, repeat]) {
    assert.equal(result.status, 200)
    assert.deepEqual(result.data, {state:"no_order"})
  }
  await verifyRegisteredSeal(clone, cart, owner)
  assert.equal(persistedGuestOrders(merchant, cart), "")

  const competing = await mintRegisteredCart(merchant, shopper)
  await prepareCheckout(merchant, {cart:competing}, shopperEmail, shopper)
  const [cancelled, completed] = await Promise.all([
    cancelRegistered(clone, competing, shopper),
    completeRegistered(merchant, competing, shopper),
  ])
  assert.deepEqual([cancelled.status, completed.status].sort(), [200, 409])
  if (cancelled.status === 200) {
    await verifyRegisteredSeal(merchant, competing, shopper)
  } else {
    assert.equal(completed.data.type, "order")
    assertPhase(merchant, competing, "claimed_for_dispatch")
    const recovered = await recoverRegistered(clone, competing, shopper)
    assert.equal(recovered.status, 200)
    assert.deepEqual(recovered.data, {state:"confirmed", order_id:completed.data.order?.id})
  }
  // Independently cover the dispatch-first result even when cancellation wins the race.
  const dispatched = await mintRegisteredCart(merchant, shopper)
  await prepareCheckout(merchant, {cart:dispatched}, shopperEmail, shopper)
  await reserveClientAttempt("registered-confirmed", dispatched)
  const order = await completeRegistered(merchant, dispatched, shopper)
  assert.equal(order.status, 200)
  assert.equal(order.data.type, "order")
  assert(/^order_[A-Za-z0-9_-]{8,}$/.test(order.data.order?.id))
  assertPhase(merchant, dispatched, "claimed_for_dispatch")
  assert.equal((await cancelRegistered(clone, dispatched, shopper)).status, 409)
  const confirmed = await recoverRegistered(clone, dispatched, shopper)
  assert.equal(confirmed.status, 200)
  assert.deepEqual(confirmed.data, {state:"confirmed", order_id:order.data.order.id})
  console.log("SHQIPSHOP_N03_REGISTERED_CANCEL_OR_DISPATCH_PASSED")
  return {cart, dispatched, order:order.data.order.id}
}

async function prepareCheckout(merchant, fixture, email, token) {
  const write=async(method,path,body)=>{
    const response=await request(merchant,method,path,{key:true,token,body})
    assert.equal(response.status,200,merchant.id+" checkout cart mutation failed")
    return response.data
  }
  await write("POST","/store/carts/"+fixture.cart+"/line-items",{variant_id:merchant.variant,quantity:1})
  const address={first_name:"Synthetic",last_name:"Guest",address_1:"CI street",
    city:"Tirane",postal_code:"1001",country_code:"al"}
  await write("POST","/store/carts/"+fixture.cart,{
    email,
    shipping_address:address,billing_address:address,
  })
  const options=await request(merchant,"GET","/store/shipping-options?cart_id="+encodeURIComponent(fixture.cart),{key:true,token})
  assert.equal(options.status,200)
  assert(options.data.shipping_options?.length)
  await write("POST","/store/carts/"+fixture.cart+"/shipping-methods",
    {option_id:options.data.shipping_options[0].id})
  await prepareManualPayment(merchant, fixture.cart, token)
}

async function prepareManualPayment(merchant, cart, token) {
  const payCollection=await request(merchant,"POST","/store/payment-collections",{
    key:true,token,body:{cart_id:cart},
  })
  assert.equal(payCollection.status,200)
  const collectionId=payCollection.data.payment_collection?.id
  assert(collectionId)
  const session=await request(merchant,"POST","/store/payment-collections/"+collectionId+"/payment-sessions",{
    key:true,token,body:{provider_id:"pp_system_default"},
  })
  assert([200,201].includes(session.status))
}

async function verifyRepricedRegisteredCheckout(merchant, clone) {
  const email = "n03-quote-buyer@example.invalid"
  const token = await createRegisteredTestOwner(merchant, email)
  const cart = await mintRegisteredCart(merchant, token)
  fixtureQuery(merchant, cart, `
    UPDATE shqipshop_n03_disposable_attempt SET quote_required = true WHERE cart_id = :'cart';
  `)
  await prepareCheckout(merchant, {cart}, email, token)

  const quotePath = "/store/shqipshop/quote-review-accept-ci"
  const buyer = {key:true, token, headers:{"x-shqipshop-cart-id":cart}}
  const review = async () => {
    const result = await request(merchant, "POST", quotePath, {...buyer, body:{review:true}})
    assert.equal(result.status, 200, "Expected authoritative ALL quote")
    assert.equal(result.data.currency, "all")
    assert.equal(readCheckoutQuote(result.data).total, result.data.total)
    return result.data
  }
  const accept = quote => request(merchant, "POST", quotePath, {
    ...buyer, body:{quote_id:quote.quote_id, fingerprint:quote.fingerprint},
  })
  const complete = (backend, quote) => request(backend, "POST", completePath(cart), {
    key:true, token, body:{}, headers: quote ? {
      "x-shqipshop-quote-id":quote.quote_id, "x-shqipshop-quote-fingerprint":quote.fingerprint,
    } : {},
  })
  const otherBuyer = await loginMerchantA(merchant)
  denied(await request(merchant, "POST", quotePath, {...buyer, token:otherBuyer, body:{review:true}}),
    "Only the enrolled buyer may see the quote")
  denied(await request(guests[1], "POST", quotePath, {...buyer, body:{review:true}}),
    "A merchant A quote is unavailable in merchant B")
  const old = await review()
  assert.equal((await complete(merchant, old)).status, 412, "Displayed quote needs explicit acceptance")
  assert.equal((await accept(old)).status, 200)
  const cartPath = "/store/carts/" + encodeURIComponent(cart)
  const current = await request(merchant, "GET", cartPath, {key:true, token})
  const line = current.data.cart?.items?.[0]
  assert(line?.id)
  const changed = await request(merchant, "POST", cartPath + "/line-items/" + encodeURIComponent(line.id), {
    key:true, token, body:{quantity:2},
  })
  assert.equal(changed.status, 200)
  await prepareManualPayment(merchant, cart, token)

  const stale = await complete(merchant, old)
  assert.equal(stale.status, 412)
  assert.equal(stale.data.message, "F07G_QUOTE_REVIEW_REQUIRED")
  assert.equal((await complete(merchant)).status, 412)
  assertPhase(merchant, cart, "prepared")
  assert.equal(persistedGuestOrders(merchant, cart), "")
  const fresh = await review()
  assert.notEqual(fresh.fingerprint, old.fingerprint)
  assert(Number(fresh.total) > Number(old.total))
  assert.equal((await complete(merchant, fresh)).status, 412)
  assert.equal((await accept(fresh)).status, 200)

  await reserveClientAttempt("registered-repriced", cart)
  // Discard the winning response as a client would after losing communication.
  const results = await Promise.all([complete(merchant, fresh), complete(clone, fresh)])
  assert.deepEqual(results.map(response => response.status).sort(), [200, 409])
  const winner = results.find(response => response.status === 200)
  assert.equal(winner.data.type, "order")
  const order = onlyPersistedOrder(merchant, cart)
  assert.equal(winner.data.order?.id, order)
  const receipt = await request(clone, "GET", receiptPath(order), {key:true, token})
  assert.equal(receipt.status, 200)
  assert.equal(receipt.data.order.currency_code, "all")
  assert.equal(String(receipt.data.order.total), fresh.total)
  await verifyClientRecovery(merchant, "registered-repriced", cart, {key:true, token},
    {state:"confirmed", orderId:order})
  assert.equal(onlyPersistedOrder(merchant, cart), order)
  console.log("SHQIPSHOP_F07G_N03_REPRICED_QUOTE_AND_ONE_ORDER_VERIFIED")
}

async function verifyBeforeRestart() {
  for (const m of guests) {
    loadMerchantKey(m)
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
    await prepareCheckout(m, m, "guest-" + m.id.toLowerCase() + "@example.invalid")
    denied(await request(m, "POST", completePath(m.cart), {key:true, body:{}}),
      "Checkout of a minted cart requires the guest credential")
    assertPhase(m, m.cart, "prepared")
    if (m.id === "A") {
      await reserveClientAttempt("guest-confirmed", m.cart)
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
  const b=guests[1]
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

  const sealed = await verifyCancellation(a, clone)
  await verifyRepricedRegisteredCheckout(a, clone)
  const registeredAttempt = await verifyRegisteredCancellation(a, clone)

  const interrupted = await mintPendingCart(a)
  await prepareCheckout(a, interrupted, "guest-n03-interrupted@example.invalid")
  assertPhase(a, interrupted.cart, "prepared")
  assert.equal(fixtureQuery(a, interrupted.cart,
    `SELECT count(*) FROM cart WHERE id = :'cart' AND customer_id IS NOT NULL;`), "1")
  assert.equal(persistedGuestOrders(a, interrupted.cart), "")
  await reserveClientAttempt("guest-interrupted", interrupted.cart)

  // This file exists only on the runner, with access restricted to its owner.
  const {cart, proof, order} = a
  writeFileSync(handoffFile, JSON.stringify({active:{cart, proof, order}, revoked, registered, unresolved, interrupted, sealed, registeredAttempt}),
    {mode:0o600, flag:"wx"})
}

async function interruptDuringOrderInsert() {
  loadMerchantKey(a)
  const {interrupted} = JSON.parse(readFileSync(handoffFile, "utf8"))
  const {args, env} = fixtureConnection(a, interrupted.cart)
  // SHARE allows reads but blocks the RowExclusiveLock PostgreSQL needs for INSERT.
  const holder = spawn("psql", args, {env, stdio:["pipe", "pipe", "inherit"]})
  const lines = createInterface({input:holder.stdout})
  try {
    holder.stdin.write(`BEGIN; SET LOCAL lock_timeout = '5s'; LOCK TABLE "order" IN SHARE MODE; SELECT pg_backend_pid();\n`)
    const readPid = async () => (await lines[Symbol.asyncIterator]().next()).value
    const blocker = Number(await Promise.race([readPid(), delay(6000, undefined, {ref:false})]))
    assert(Number.isInteger(blocker) && blocker > 0, "The order table lock must be held")

    const completion = dispatch(a, interrupted).then(
      response => ({status:response.status}),
      error => ({code:error.cause?.code}),
    )
    let writer
    for (let i = 0; i < 50 && !writer; i++) {
      writer = fixtureQuery(a, interrupted.cart, `
        SELECT a.pid FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.relation = '"order"'::regclass AND l.mode = 'RowExclusiveLock'
          AND NOT l.granted AND ${blocker} = ANY(pg_blocking_pids(a.pid))
          AND a.query ~* '^[[:space:]]*insert[[:space:]]+into';
      `)
      if (!writer) await delay(150)
    }
    assert(/^[1-9][0-9]*$/.test(writer ?? ""), "Expected one Medusa INSERT waiting on the fixture lock")
    assertPhase(a, interrupted.cart, "claimed_for_dispatch")
    assert.equal(persistedGuestOrders(a, interrupted.cart), "")
    writeFileSync(blockedFile, "", {mode:0o600, flag:"wx"})

    const result = await completion
    assert(["UND_ERR_SOCKET", "ECONNRESET"].includes(result.code), "Expected API connection loss after SIGKILL")

    // The database may still be waiting after its client disappears. End any
    // surviving queued writer before releasing the lock so it cannot resume.
    const stopped = fixtureQuery(a, interrupted.cart, `
      SELECT pg_terminate_backend(a.pid, 5000)
      FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.relation = '"order"'::regclass AND l.mode = 'RowExclusiveLock'
        AND NOT l.granted AND a.pid = ${writer}
        AND ${blocker} = ANY(pg_blocking_pids(a.pid));
    `)
    assert(["", "t"].includes(stopped), "The queued database session must have ended")
    assert.equal(persistedGuestOrders(a, interrupted.cart), "")
    console.log("SHQIPSHOP_N03_ORDER_INSERT_INTERRUPTED_AFTER_CLAIM")
  } finally {
    lines.close()
    holder.stdin.end()
    holder.kill()
  }
}

async function verifyAfterRestart() {
  loadMerchantKey(a)
  const {active, revoked, registered, unresolved, interrupted, sealed, registeredAttempt} = JSON.parse(readFileSync(handoffFile, "utf8"))
  await verifySealed(a, sealed)
  const owner = await loginBuyer(a, registeredEmail)
  await verifyRegisteredSeal(a, registeredAttempt.cart, owner)
  assert.equal(persistedGuestOrders(a, registeredAttempt.cart), "")
  const shopper = await loginMerchantA(a)
  const registeredOrder = await recoverRegistered(a, registeredAttempt.dispatched, shopper)
  assert.equal(registeredOrder.status, 200)
  assert.deepEqual(registeredOrder.data, {state:"confirmed", order_id:registeredAttempt.order})
  assert.equal((await completeRegistered(a, registeredAttempt.dispatched, shopper)).status, 409)
  console.log("SHQIPSHOP_N03_REGISTERED_CANCEL_AND_CONFIRM_DURABLE_AFTER_RESTART")
  const repeated = await cancel(a, sealed)
  assert.equal(repeated.status, 200)
  assert.deepEqual(repeated.data, {state:"no_order"})
  assert.equal((await cancel(a, interrupted)).status, 409)
  console.log("SHQIPSHOP_N03_CANCELLED_NO_ORDER_DURABLE_AFTER_RESTART")
  const interruptedOutcome = await request(a, "GET", recoveryPath(interrupted.cart), proofOptions(interrupted.proof))
  assert.equal(interruptedOutcome.status, 200)
  assert.deepEqual(interruptedOutcome.data, {state:"unknown"})
  assertPhase(a, interrupted.cart, "claimed_for_dispatch")
  assert.equal((await dispatch(a, interrupted)).status, 409)
  assert.equal(persistedGuestOrders(a, interrupted.cart), "")
  console.log("SHQIPSHOP_N03_INTERRUPTED_INSERT_RESTART_UNKNOWN_NO_REPLAY_PASSED")
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
  await verifyClientRecovery(a, "guest-confirmed", active.cart, proofOptions(active.proof),
    {state:"confirmed", orderId:active.order})
  await verifyClientRecovery(a, "guest-sealed", sealed.cart, proofOptions(sealed.proof), {state:"no_order"})
  await verifyClientRecovery(a, "guest-interrupted", interrupted.cart, proofOptions(interrupted.proof),
    {state:"pending"})
  await verifyClientRecovery(a, "registered-confirmed", registeredAttempt.dispatched, {key:true, token:shopper},
    {state:"confirmed", orderId:registeredAttempt.order})
  await verifyClientRecovery(a, "registered-sealed", registeredAttempt.cart, {key:true, token:owner},
    {state:"no_order"})
  assert.equal(onlyPersistedOrder(a, active.cart), active.order)
  assert.equal(persistedGuestOrders(a, interrupted.cart), "")
  console.log("SHQIPSHOP_N03_DISPOSABLE_CLIENT_TERMINAL_AND_PENDING_RECOVERY_PASSED")
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
assert([undefined, "interrupt", "after-restart"].includes(phase))
if (phase === "after-restart") {
  await verifyAfterRestart()
} else if (phase === "interrupt") {
  await interruptDuringOrderInsert()
} else {
  await verifyBeforeRestart()
}
