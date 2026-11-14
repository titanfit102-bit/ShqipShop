/**
 * F07e follow-up: real Medusa HTTP Store API calculated price and cart quantity
 * arithmetic. Uses only seeded demo products, an uncompleted disposable cart,
 * and a runner-local publishable key. No live payment, production or PII.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

assert.equal(process.env.CI, "true", "Store total proof requires isolated GitHub CI")
assert.equal(process.env.NODE_ENV, "development", "Only development-mode CI")
assert.equal(process.env.SHQIPSHOP_REQUIRE_REDIS, "true", "Redis must be mandatory")
const keyFile = process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
assert(keyFile && keyFile.startsWith(process.env.RUNNER_TEMP + "/"), "Only runner-local key file allowed")
const key = readFileSync(keyFile, "utf8").trim()
assert(key.length > 10, "Invalid ephemeral publishable key")
const host = "http://127.0.0.1:9000"

async function request(method, path, body) {
  const response = await fetch(host + path, {
    method,
    headers: {
      "x-publishable-api-key": key,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  })
  const value = await response.text()
  let parsed
  try { parsed = JSON.parse(value) } catch { parsed = { raw: value.slice(0, 220) } }
  assert(response.ok,
    `Store API ${method} ${path.split("?")[0]} HTTP ${response.status}: ${JSON.stringify(parsed).slice(0, 400)}`)
  return parsed
}

const asMoney = (x, label) => {
  assert(typeof x === "number" && Number.isFinite(x) && x >= 0,
    `Invalid Store API ${label}: ${String(x)}`)
  return x
}
const getCart = async id => {
  const { cart } = await request("GET", "/store/carts/" + encodeURIComponent(id))
  assert(cart?.id === id && cart.currency_code === "all",
    "Cart read must return the correct ALL-currency cart")
  return cart
}
const getLine = (cart, variantId) => {
  const matching = (cart.items ?? []).filter(item => item.variant_id === variantId)
  assert.equal(matching.length, 1, "Expected exactly one line item for selected variant")
  return matching[0]
}

const { regions } = await request("GET", "/store/regions")
const region = regions?.find(r => r.currency_code === "all" && r.name === "Shqipëri")
assert(region?.id, "Disposable Albania / ALL region required")
const query = new URLSearchParams({
  region_id: region.id,
  fields: "*variants.calculated_price,+variants.id",
})
const { products } = await request("GET", "/store/products?" + query.toString())
const candidate = (products ?? []).flatMap(p =>
  (p.variants ?? []).map(v => ({ productId: p.id, variant: v }))
).find(v => Number.isFinite(v.variant.calculated_price?.calculated_amount) &&
            v.variant.calculated_price.calculated_amount > 0)
assert(candidate?.variant?.id, "No region-priced variant.calculated_price in Store API")
const variantId = candidate.variant.id
const calculated = asMoney(candidate.variant.calculated_price.calculated_amount, "calculated_amount")
assert(calculated > 0, "Variant must have a nonzero selling price")
console.log("SHQIPSHOP_F07E_HTTP_CALCULATED_ALL_PRICE_PASSED")

const { cart: created } = await request("POST", "/store/carts", { region_id: region.id })
assert(created?.id && created.currency_code === "all", "Failed to create disposable cart")
const cartId = created.id
await request("POST", `/store/carts/${encodeURIComponent(cartId)}/line-items`, {
  variant_id: variantId, quantity: 1,
})
const cartOne = await getCart(cartId)
const itemOne = getLine(cartOne, variantId)
assert.equal(itemOne.quantity, 1, "First cart item quantity is not 1")
const unit = asMoney(itemOne.unit_price, "line-item unit_price")
const subtotalOne = asMoney(cartOne.subtotal, "cart subtotal qty1")
const totalOne = asMoney(cartOne.total, "cart total qty1")
assert.equal(unit, calculated, "Store API unit price differs from region calculated price")
assert(Math.abs(subtotalOne - calculated) < 0.001,
  "One-unit cart subtotal does not match calculated selling price")
assert(totalOne >= subtotalOne, "Cart total cannot be below subtotal without promotions")
console.log("SHQIPSHOP_F07E_HTTP_CART_QUANTITY_ONE_PASSED")

await request("POST",
  `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(itemOne.id)}`,
  { quantity: 2 },
)
const cartTwo = await getCart(cartId)
const itemTwo = getLine(cartTwo, variantId)
assert.equal(itemTwo.quantity, 2, "Cart update to 2 units failed")
assert.equal(asMoney(itemTwo.unit_price, "qty2 unit_price"), unit, "Unit price changed on quantity edit")
const subtotalTwo = asMoney(cartTwo.subtotal, "cart subtotal qty2")
const totalTwo = asMoney(cartTwo.total, "cart total qty2")
assert(Math.abs(subtotalTwo - 2 * subtotalOne) < 0.001,
  "Two-unit subtotal is not exactly twice the original, in absence of discounts")
assert(totalTwo >= totalOne, "Cart total failed to increase after doubling quantity")
console.log("SHQIPSHOP_F07E_HTTP_CART_QUANTITY_TWO_RECALCULATED_PASSED")

await request("POST",
  `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(itemOne.id)}`,
  { quantity: 1 },
)
const restored = await getCart(cartId)
assert.equal(getLine(restored, variantId).quantity, 1, "Cart item quantity did not restore")
assert(Math.abs(asMoney(restored.subtotal, "restored subtotal") - subtotalOne) < 0.001,
  "Subtotal not restored on 2->1 quantity update")
assert(Math.abs(asMoney(restored.total, "restored total") - totalOne) < 0.001,
  "Cart total not restored on 2->1 quantity update")
console.log("SHQIPSHOP_F07E_HTTP_CART_TOTALS_RESTORED_PASSED")
console.log("SHQIPSHOP_F07E_HTTP_PRICE_AND_CART_ARITHMETIC_PASSED")
