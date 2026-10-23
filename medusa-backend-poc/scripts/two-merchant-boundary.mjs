/** Isolated demo merchant B must not see merchant A's order or use its key.
 * Runs against TWO disposable PostgreSQL databases/Medusa sessions.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

assert.equal(process.env.CI, "true")
assert.equal(process.env.NODE_ENV, "development")
function file(name) {
  const path = process.env[name]
  assert(path, "Missing CI fixture path for " + name)
  return readFileSync(path, "utf8").trim()
}
const keyA = file("SHQIPSHOP_MERCHANT_A_KEY_FILE")
const keyB = file("SHQIPSHOP_MERCHANT_B_KEY_FILE")
const orderA = file("SHQIPSHOP_MERCHANT_A_ORDER_FILE")
assert(keyA.length > 10 && keyB.length > 10 && keyA !== keyB)
assert(/^order_[a-zA-Z0-9]+$/.test(orderA))
const base = "http://127.0.0.1:9001"
async function query(path, key) {
  const response = await fetch(base + path, {
    headers: { "x-publishable-api-key": key },
    signal: AbortSignal.timeout(20000),
  })
  return response.status
}
const statusB = await query("/store/products", keyB)
const statusWrongKey = await query("/store/products", keyA)
const statusForeignOrder = await query("/store/orders/" + encodeURIComponent(orderA), keyB)
console.log("SHQIPSHOP_TWO_DATABASE_BOUNDARY_HTTP", JSON.stringify({
  merchantBCatalogStatus: statusB,
  merchantAKeyAtBStatus: statusWrongKey,
  merchantAOrderAtBStatus: statusForeignOrder,
}))
assert.equal(statusB, 200, "Merchant B catalog should work with B key")
assert([400, 401, 403].includes(statusWrongKey), "Merchant A's API key must not work on B server")
assert.equal(statusForeignOrder, 404, "Merchant A's order must not exist in merchant B's database")
console.log("SHQIPSHOP_SEPARATE_MEDUSA_ORDER_BOUNDARY_PASSED")
