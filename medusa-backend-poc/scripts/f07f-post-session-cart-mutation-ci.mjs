/**
 * F07f: HTTP-only observation of Medusa's payment-session freshness after a
 * normal shopper cart-quantity update. Every resource is disposable.
 *
 * If a genuinely stale session appears, prove the actual checkout returns
 * HTTP 409 and a repeat attempt cannot silently create an order. If Medusa
 * updates the session automatically, explicitly mark the negative gate OPEN.
 * Never forge or manually overwrite session records.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

for (const [key, value] of Object.entries({
  CI: "true",
  NODE_ENV: "development",
  SHQIPSHOP_ENFORCE_PAYMENT_TOTAL_MATCH: "true",
  SHQIPSHOP_REQUIRE_REDIS: "true",
  DATABASE_URL: "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL: "redis://127.0.0.1:6379",
})) {
  assert.equal(process.env[key], value, `Unsafe CI environment: ${key}`)
}
const runner = resolve(process.env.RUNNER_TEMP || "")
const file = resolve(process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE || "")
assert(runner !== "." && file.startsWith(runner + "/"), "Requires runner-local key")
const key = readFileSync(file, "utf8").trim()
assert(key.length > 10, "Invalid disposable key")
const origin = "http://127.0.0.1:9000"

async function call(method, path, body, ok = true) {
  const res = await fetch(origin + path, {
    method,
    headers: {
      "x-publishable-api-key": key,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  })
  const raw = await res.text()
  let data
  try { data = JSON.parse(raw) } catch { data = {} }
  if (ok) assert(res.ok,
    `Unexpected HTTP ${res.status} from ${method} ${path.split("?")[0]}: ${raw.slice(0, 300)}`)
  return { status: res.status, data }
}
const getCart = async id => {
  const { data } = await call("GET", "/store/carts/" + encodeURIComponent(id) +
    "?fields=" + encodeURIComponent("*items,+payment_collection.payment_sessions"))
  assert.equal(data.cart?.id, id, "Incorrect cart")
  return data.cart
}
const currentSession = cart => {
  const sessions = cart.payment_collection?.payment_sessions || []
  const active = sessions.filter(s => ["pending", "requires_more", "authorized", "captured", "pending_authorization"].includes(s.status))
  assert.equal(active.length, 1, "Expected one processable manual CI session")
  return active[0]
}
const money = (value, name) => {
  const amount = Number(value)
  assert(Number.isFinite(amount) && amount >= 0, `Invalid ${name}`)
  return amount
}

const regions = (await call("GET", "/store/regions")).data.regions
const region = regions.find(r => r.name === "Shqipëri" && r.currency_code === "all")
assert(region?.id, "Missing seeded ALL region")
const products = (await call("GET", "/store/products?" + new URLSearchParams({
  region_id: region.id, fields: "*variants.calculated_price,+variants.id",
}))).data.products || []
const variant = products.flatMap(p => p.variants || [])
  .find(v => money(v.calculated_price?.calculated_amount, "variant price") > 0)
assert(variant?.id, "Missing disposable region-priced variant")
const { data: created } = await call("POST", "/store/carts", { region_id: region.id })
const id = created.cart?.id
assert(id?.startsWith("cart_"), "Missing temporary cart")
await call("POST", `/store/carts/${id}/line-items`, { variant_id: variant.id, quantity: 1 })
const address = { first_name: "Test", last_name: "Klient", address_1: "Rruga Demo 1",
  city: "Tiranë", postal_code: "1001", country_code: "al", phone: "+355690000001" }
await call("POST", `/store/carts/${id}`, {
  email: "post-session-ci@example.invalid", shipping_address: address, billing_address: address,
})
const options = (await call("GET", `/store/shipping-options?cart_id=${id}`)).data.shipping_options || []
const option = options.find(x => x.name === "Transport standard") ?? options[0]
assert(option?.id, "Missing disposable shipping method")
await call("POST", `/store/carts/${id}/shipping-methods`, { option_id: option.id })
const collection = (await call("POST", "/store/payment-collections", { cart_id: id })).data.payment_collection
assert(collection?.id, "Missing disposable payment collection")
await call("POST", `/store/payment-collections/${collection.id}/payment-sessions`, { provider_id: "pp_system_default" })
const before = await getCart(id)
const originalSession = currentSession(before)
assert.equal(money(originalSession.amount, "original session"), money(before.total, "original total"),
  "Baseline payment was already stale")
const item = (before.items || []).find(x => x.variant_id === variant.id)
assert(item?.id && item.quantity === 1, "Missing initial item")
console.log("SHQIPSHOP_F07F_REAL_HTTP_SESSION_MATCHED_BEFORE_CART_MUTATION")

// Legitimate shopper mutation AFTER starting a provider session.
await call("POST", `/store/carts/${id}/line-items/${item.id}`, { quantity: 2 })
const after = await getCart(id)
assert.equal((after.items || []).find(x => x.id === item.id)?.quantity, 2)
const cartTotal = money(after.total, "updated cart total")
const sessionAmount = money(currentSession(after).amount, "updated session amount")
assert(cartTotal > money(before.total, "previous total"), "Cart quantity did not change total")
if (cartTotal === sessionAmount) {
  console.log("SHQIPSHOP_F07F_HTTP_SESSION_AUTO_REFRESHED_AFTER_CART_MUTATION")
  console.log("SHQIPSHOP_F07F_HTTP_NEGATIVE_STALE_COMPLETION_NOT_EXERCISED")
} else {
  console.log("SHQIPSHOP_F07F_HTTP_STALE_SESSION_OBSERVED")
  for (let i = 0; i < 2; i++) {
    const { status, data } = await call("POST", `/store/carts/${id}/complete`, {}, false)
    assert.equal(status, 409, `Stale checkout not rejected: HTTP ${status}`)
    assert(!data.order?.id, "Order created with stale payment session")
  }
  const unchanged = await getCart(id)
  assert(!unchanged.completed_at, "Stale cart was marked completed")
  console.log("SHQIPSHOP_F07F_HTTP_STALE_SESSION_REJECTED_409_TWICE")
}
