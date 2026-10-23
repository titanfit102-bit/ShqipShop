/** Isolated Medusa v2 HTTP Store API contract test. Never contacts real payment providers. */
import { readFileSync } from "node:fs"
import assert from "node:assert/strict"

// Explicit local-only override enables checkout on two simultaneous CI merchants.
const selectedPort = process.env.SHQIPSHOP_CI_MEDUSA_PORT || "9000"
assert(["9000", "9001"].includes(selectedPort), "Only disposable CI ports are permitted")
const base = "http://127.0.0.1:" + selectedPort
const keyPath = process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
assert(keyPath, "Missing ephemeral publishable-key path")
const publishableKey = readFileSync(keyPath, "utf8").trim()
assert(publishableKey.length > 10, "Invalid publishable API key")

async function request(method, path, body, withKey = true) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(withKey ? { "x-publishable-api-key": publishableKey } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
  })
  const text = await response.text()
  let data
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text.slice(0, 250) } }
  if (!response.ok) {
    throw new Error(`${method} ${path.split("?")[0]} -> HTTP ${response.status}: ${JSON.stringify(data).slice(0, 750)}`)
  }
  return data
}

const denial = await fetch(base + "/store/products")
assert([400,401,403].includes(denial.status), "Store API must require a publishable API key")
console.log("SHQIPSHOP_MISSING_KEY_REJECTED", denial.status)

const regions = (await request("GET", "/store/regions")).regions ?? []
const region = regions.find((r) => r.name === "Shqipëri")
assert(region?.id && region.currency_code === "all", "Albania / ALL region not listed via HTTP")

const productResponse = await request("GET", `/store/products?region_id=${encodeURIComponent(region.id)}&fields=%2Bvariants.*`)
const products = productResponse.products ?? []
const product = products.find((p) => p.variants?.length)
assert(product?.id && product.variants[0]?.id, "No priced available product variant via Store API")
const emptyChannelKeyFile = process.env.SHQIPSHOP_CI_EMPTY_CHANNEL_KEY_FILE
assert(emptyChannelKeyFile, "Missing alternate CI sales-channel key path")
const emptyChannelKey = readFileSync(emptyChannelKeyFile, "utf8").trim()
assert(emptyChannelKey.length > 10 && emptyChannelKey !== publishableKey, "Invalid alternate channel key")
const isolatedResponse = await fetch(base + `/store/products?region_id=${encodeURIComponent(region.id)}`, {
  headers: { "x-publishable-api-key": emptyChannelKey },
  signal: AbortSignal.timeout(20000),
})
assert.equal(isolatedResponse.status, 200, "Second channel key must be accepted")
const isolatedProducts = (await isolatedResponse.json()).products ?? []
assert.equal(isolatedProducts.length, 0, "An empty sales channel must not see demo products")
// Stronger negative test: listing restrictions must not be bypassable by knowing a product ID.
const crossProductResponse = await fetch(
  base + `/store/products/${encodeURIComponent(product.id)}?region_id=${encodeURIComponent(region.id)}`,
  {
    headers: { "x-publishable-api-key": emptyChannelKey },
    signal: AbortSignal.timeout(20000),
  },
)
assert(
  [403, 404].includes(crossProductResponse.status),
  `Cross-channel product detail must be denied, got HTTP ${crossProductResponse.status}`,
)
console.log("SHQIPSHOP_CROSS_CHANNEL_DIRECT_PRODUCT_DENIED", crossProductResponse.status)
console.log("SHQIPSHOP_SALES_CHANNEL_CATALOG_SCOPE_PASSED")
console.log("SHQIPSHOP_STORE_HTTP_CATALOG_PASSED", JSON.stringify({ region:region.name,currency:region.currency_code,products:products.length }))

const created = await request("POST", "/store/carts", { region_id: region.id })
assert(created.cart?.id && created.cart.currency_code === "all", "Cart creation failed for ALL region")
const cartId = created.cart.id
const added = await request("POST", `/store/carts/${cartId}/line-items`, {
  variant_id: product.variants[0].id,
  quantity: 1,
})
assert(added.cart?.items?.length, "Adding product variant did not create a line item")
console.log("SHQIPSHOP_STORE_HTTP_CART_PASSED")

const address = {
  first_name: "Test",
  last_name: "Klient",
  address_1: "Rruga Demo 1",
  city: "Tiranë",
  postal_code: "1001",
  country_code: "al",
  phone: "+355690000001",
}
const updated = await request("POST", `/store/carts/${cartId}`, {
  email: "shopper-ci@example.invalid",
  shipping_address: address,
  billing_address: address,
})
assert(updated.cart?.shipping_address?.country_code === "al", "Country on cart did not persist")

const options = (await request("GET", `/store/shipping-options?cart_id=${cartId}`)).shipping_options ?? []
const shipping = options.find((o) => o.name === "Transport standard") ?? options[0]
assert(shipping?.id, "No shipping option available for Albanian cart")
const shipped = await request("POST", `/store/carts/${cartId}/shipping-methods`, {
  option_id: shipping.id,
})
assert(shipped.cart?.shipping_methods?.length, "Shipping method not applied")
console.log("SHQIPSHOP_STORE_HTTP_SHIPPING_PASSED")

const providers = (await request("GET", `/store/payment-providers?region_id=${region.id}`)).payment_providers ?? []
assert(providers.some((p) => p.id === "pp_system_default"), "Manual system payment provider unavailable")
const collection = await request("POST", "/store/payment-collections", { cart_id: cartId })
const paymentCollectionId = collection.payment_collection?.id
assert(paymentCollectionId, "Payment collection was not created")
await request("POST", `/store/payment-collections/${paymentCollectionId}/payment-sessions`, {
  provider_id: "pp_system_default",
})
console.log("SHQIPSHOP_STORE_HTTP_MANUAL_PAYMENT_PASSED")

const completion = await request("POST", `/store/carts/${cartId}/complete`, {})
assert(completion.type === "order" && completion.order?.id, "Cart did not produce an order")
assert(completion.order.currency_code === "all", "Order currency not ALL")
assert(completion.order.items?.length, "Order has no items")
const orderIdFile = process.env.SHQIPSHOP_CI_ORDER_ID_FILE
assert(orderIdFile, "Missing CI test order id path")
const { writeFileSync } = await import("node:fs")
writeFileSync(orderIdFile, completion.order.id, {encoding:"utf8",mode:0o600,flag:"wx"})
const cartIdFile = process.env.SHQIPSHOP_CI_CART_ID_FILE
assert(cartIdFile, "Missing CI test cart proof output path")
writeFileSync(cartIdFile, cartId, { encoding: "utf8", mode: 0o600, flag: "wx" })

const receiptPath = "/store/orders/" + encodeURIComponent(completion.order.id)
const header = { "x-publishable-api-key": publishableKey }
const noProof = await fetch(base + receiptPath, { headers: header, signal: AbortSignal.timeout(20000) })
assert([401,403,404].includes(noProof.status), "Order ID alone exposed a private receipt")
const wrongProof = await fetch(base + receiptPath, {
  headers: { ...header, "x-shqipshop-cart-proof": "cart_wrong_credential" },
  signal: AbortSignal.timeout(20000),
})
assert([401,403,404].includes(wrongProof.status), "Invalid guest cart proof exposed receipt")
const ownReceipt = await fetch(base + receiptPath, {
  headers: { ...header, "x-shqipshop-cart-proof": cartId },
  signal: AbortSignal.timeout(20000),
})
assert.equal(ownReceipt.status, 200, "Genuine guest checkout cannot retrieve receipt")
const ownData = await ownReceipt.json()
assert.equal(ownData.order?.id, completion.order.id, "Guest receipt returned wrong order")
console.log("SHQIPSHOP_GUEST_RECEIPT_CART_PROOF_PASSED")
console.log("SHQIPSHOP_STORE_HTTP_ORDER_PASSED", JSON.stringify({
  currency: completion.order.currency_code,
  items: completion.order.items.length,
  total: completion.order.total,
}))
