/**
 * F07e: live Store API repricing with a pre-existing, uncompleted cart.
 * Strict disposable CI contract: no real customers, orders or payments.
 * Phases: prepare (HTTP) -> Medusa workflow CLI -> verify (HTTP).
 */
import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

assert.equal(process.env.CI, "true", "Only isolated GitHub CI")
assert.equal(process.env.NODE_ENV, "development")
assert.equal(process.env.SHQIPSHOP_REQUIRE_REDIS, "true")
assert.equal(process.env.SHQIPSHOP_F07E_REPRICE_PROBE, "true")
assert.equal(process.env.DATABASE_URL, "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci")
assert.equal(process.env.REDIS_URL, "redis://127.0.0.1:6379")
const mode = process.argv[2]
assert(["prepare", "verify"].includes(mode), "Invalid F07e proof mode")
const proofPath = process.env.SHQIPSHOP_F07E_REPRICE_PROOF_FILE
const keyFile = process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
const runner = process.env.RUNNER_TEMP
assert(runner && proofPath && keyFile, "Missing runner-local proof/key")
assert(resolve(proofPath).startsWith(resolve(runner) + "/"), "Proof must be runner-local")
assert(resolve(keyFile).startsWith(resolve(runner) + "/"), "Key must be runner-local")
const key = readFileSync(keyFile, "utf8").trim()
assert(key.length > 10, "Invalid ephemeral key")
const host = "http://127.0.0.1:9000"

async function request(method, path, body) {
  const res = await fetch(host + path, {
    method,
    headers: {
      "x-publishable-api-key": key,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  })
  const raw = await res.text()
  let data
  try { data = JSON.parse(raw) } catch { data = { raw: raw.slice(0, 200) } }
  assert(res.ok, `HTTP ${res.status} ${method} ${path.split("?")[0]} ${JSON.stringify(data).slice(0, 370)}`)
  return data
}
const money = (value, label) => {
  assert(typeof value === "number" && Number.isFinite(value) && value >= 0, `Invalid ${label}: ${String(value)}`)
  return value
}
async function catalog(regionId, productId) {
  const params = new URLSearchParams({
    region_id: regionId,
    fields: "*variants.calculated_price,+variants.id",
  })
  if (productId) {
    const response = await request("GET", `/store/products/${encodeURIComponent(productId)}?${params}`)
    return [response.product]
  }
  const response = await request("GET", "/store/products?" + params)
  return response.products || []
}
const cart = async id => {
  const data = await request("GET", "/store/carts/" + encodeURIComponent(id))
  assert.equal(data.cart?.id, id, "Unexpected cart ID")
  return data.cart
}
const line = (c, v) => {
  const items = (c.items || []).filter(i => i.variant_id === v)
  assert.equal(items.length, 1, "Missing or duplicated variant line item")
  return items[0]
}
async function freshCart(regionId, variantId) {
  const { cart: created } = await request("POST", "/store/carts", { region_id: regionId })
  assert.equal(created?.currency_code, "all")
  await request("POST", `/store/carts/${encodeURIComponent(created.id)}/line-items`, {
    variant_id: variantId, quantity: 1,
  })
  return cart(created.id)
}

if (mode === "prepare") {
  const { regions } = await request("GET", "/store/regions")
  const region = regions?.find(r => r.name === "Shqipëri" && r.currency_code === "all")
  assert(region?.id, "Albanian region missing")
  const products = await catalog(region.id)
  const candidate = products.flatMap(p =>
    (p.variants || []).map(v => ({
      productId: p.id, variantId: v.id,
      amount: v.calculated_price?.calculated_amount,
    }))
  ).find(x => typeof x.amount === "number" && Number.isFinite(x.amount) && x.amount > 0)
  assert(candidate?.productId && candidate.variantId, "No region-priced product variant")
  const active = await freshCart(region.id, candidate.variantId)
  const cartLine = line(active, candidate.variantId)
  assert.equal(cartLine.quantity, 1)
  assert.equal(money(cartLine.unit_price, "initial cart unit"), candidate.amount)
  assert.equal(money(active.subtotal, "initial cart subtotal"), candidate.amount)
  const snapshot = {
    regionId: region.id, productId: candidate.productId, variantId: candidate.variantId,
    originalAmount: candidate.amount, expectedAmount: candidate.amount + 17,
    cartId: active.id, lineId: cartLine.id, initialTotal: money(active.total, "initial cart total"),
  }
  writeFileSync(proofPath, JSON.stringify(snapshot), { flag: "wx", encoding: "utf8", mode: 0o600 })
  console.log("SHQIPSHOP_F07E_HTTP_REPRICE_ACTIVE_CART_PRIMED")
} else {
  const proof = JSON.parse(readFileSync(proofPath, "utf8"))
  const products = await catalog(proof.regionId, proof.productId)
  const currentVariant = products[0]?.variants?.find(v => v.id === proof.variantId)
  assert(currentVariant, "Priced variant is not available in Store API")
  const newAmount = money(currentVariant.calculated_price?.calculated_amount, "new calculated price")
  assert.equal(newAmount, proof.expectedAmount, "Store API does not reflect new variant price")
  console.log("SHQIPSHOP_F07E_HTTP_REPRICED_CALCULATED_PRICE_PASSED")

  const newlyCreated = await freshCart(proof.regionId, proof.variantId)
  assert.equal(money(line(newlyCreated, proof.variantId).unit_price, "new cart unit"), newAmount,
    "New cart does not use current selling price")
  assert.equal(money(newlyCreated.subtotal, "new cart subtotal"), newAmount,
    "New cart subtotal uses obsolete price")
  console.log("SHQIPSHOP_F07E_HTTP_NEW_CART_CURRENT_PRICE_PASSED")

  const old = await cart(proof.cartId)
  const existing = line(old, proof.variantId)
  assert.equal(existing.quantity, 1, "Original cart quantity unexpectedly changed")
  const oldUnit = money(existing.unit_price, "active-cart unit price")
  assert.equal(money(old.subtotal, "active cart subtotal"), oldUnit,
    "Existing cart subtotal inconsistent with displayed line price")
  assert([proof.originalAmount, newAmount].includes(oldUnit),
    "Existing cart has unexpected third price")
  const snapshotPolicy = oldUnit === proof.originalAmount
  console.log(snapshotPolicy ?
    "SHQIPSHOP_F07E_HTTP_ACTIVE_CART_PRICE_SNAPSHOT_OBSERVED" :
    "SHQIPSHOP_F07E_HTTP_ACTIVE_CART_AUTO_REPRICE_OBSERVED")

  // Trigger a legitimate cart mutation and re-read, without payment or checkout.
  await request("POST",
    `/store/carts/${encodeURIComponent(proof.cartId)}/line-items/${encodeURIComponent(proof.lineId)}`,
    { quantity: 2 },
  )
  const updated = await cart(proof.cartId)
  const updatedLine = line(updated, proof.variantId)
  assert.equal(updatedLine.quantity, 2, "Active cart quantity did not update")
  const effectiveUnit = money(updatedLine.unit_price, "after quantity edit unit")
  assert([proof.originalAmount, newAmount].includes(effectiveUnit),
    "Active cart has unknown price after quantity update")
  assert.equal(money(updated.subtotal, "after edit subtotal"), 2 * effectiveUnit,
    "Subtotal does not match line quantity times effective unit price")
  assert(Number.isFinite(updated.total), "Active cart total missing after price mutation")
  console.log("SHQIPSHOP_F07E_HTTP_ACTIVE_CART_AFTER_REPRICE_INVARIANTS_PASSED")
  console.log("SHQIPSHOP_F07E_HTTP_LIVE_REPRICE_OBSERVATION_COMPLETE")
}
