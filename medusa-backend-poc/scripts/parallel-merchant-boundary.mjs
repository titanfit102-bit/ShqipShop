/** CI-only two-live-backend cross-merchant Store API checks.
 * Two disposable Medusa processes must be healthy throughout this test.
 * No private customer data, live payments, external hosts, or production keys.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

assert.equal(process.env.CI, "true", "Only isolated GitHub CI is permitted")
assert.equal(process.env.NODE_ENV, "development", "Production use is forbidden")

const merchant = (id, port) => {
  const read = (name) => {
    const path = process.env["SHQIPSHOP_" + id + "_" + name + "_FILE"]
    assert(path, "Missing CI file for " + id + "/" + name)
    return readFileSync(path, "utf8").trim()
  }
  return {
    name: id,
    base: "http://127.0.0.1:" + port,
    key: read("KEY"),
    order: read("ORDER"),
  }
}
const a = merchant("A", 9000)
const b = merchant("B", 9001)
assert(a.key.length > 10 && b.key.length > 10 && a.key !== b.key)
assert(/^order_[a-zA-Z0-9]+$/.test(a.order))
assert(/^order_[a-zA-Z0-9]+$/.test(b.order))
assert.notEqual(a.order, b.order, "Merchants generated identical order IDs")

async function query(m, path, key) {
  const response = await fetch(m.base + path, {
    headers: key ? { "x-publishable-api-key": key } : {},
    signal: AbortSignal.timeout(20000),
  })
  const data = response.ok ? await response.json() : null
  return { status: response.status, data }
}
for (const own of [a, b]) {
  const other = own === a ? b : a
  const health = await fetch(own.base + "/health", { signal: AbortSignal.timeout(5000) })
  assert.equal(health.status, 200, own.name + " not healthy during concurrent probe")

  const catalog = await query(own, "/store/products", own.key)
  assert.equal(catalog.status, 200, own.name + " own catalog unavailable")
  assert((catalog.data?.products?.length ?? 0) > 0, "Empty seeded catalog for " + own.name)
  own.product = catalog.data.products[0].id
  assert(own.product?.startsWith("prod_"), "Missing product ID on " + own.name)

  const ownOrder = await query(own, "/store/orders/" + encodeURIComponent(own.order), own.key)
  assert.equal(ownOrder.status, 200, own.name + " cannot fetch own order")

  const wrongKey = await query(own, "/store/products", other.key)
  assert([400, 401, 403].includes(wrongKey.status), "Foreign publishable key accepted on " + own.name)

  const foreignOrder = await query(own, "/store/orders/" + encodeURIComponent(other.order), own.key)
  assert.equal(foreignOrder.status, 404, "Cross-merchant order visible at " + own.name)

  const absentKey = await query(own, "/store/products")
  assert([400, 401, 403].includes(absentKey.status), "Missing key accepted on " + own.name)
  console.log("SHQIPSHOP_PARALLEL_MERCHANT_" + own.name + "_ORDER_BOUNDARY_PASSED",
    JSON.stringify({ownOrder:ownOrder.status,foreignOrder:foreignOrder.status,foreignKey:wrongKey.status,missingKey:absentKey.status}))
}
assert.notEqual(a.product, b.product, "Independent merchant product IDs unexpectedly matched")
for (const own of [a, b]) {
  const other = own === a ? b : a
  const foreignProduct = await query(own, "/store/products/" + encodeURIComponent(other.product), own.key)
  assert([403, 404].includes(foreignProduct.status), "Cross-merchant product ID visible at " + own.name)
}
const again = await Promise.all([a, b].map(m => fetch(m.base + "/health", {signal: AbortSignal.timeout(5000)})))
assert(again.every(x => x.status === 200), "Both Medusa backends must remain alive simultaneously")
console.log("SHQIPSHOP_TWO_LIVE_MEDUSA_BACKENDS_PASSED")
console.log("SHQIPSHOP_PARALLEL_CROSS_MERCHANT_BOUNDARY_PASSED")
