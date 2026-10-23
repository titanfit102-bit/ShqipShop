/**
 * Medusa Store API cross-sales-channel ORDER ID probe, in disposable CI only.
 * Publishable keys / sales channels scope catalogs, NOT necessarily orders.
 * A failed positive-control probe is reported INCONCLUSIVE, never as isolation proof.
 * No real users, real order data, credentials, or real merchant IDs.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

assert.equal(process.env.CI, "true")
assert.equal(process.env.NODE_ENV, "development")
const originalKeyFile = process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
const alternateKeyFile = process.env.SHQIPSHOP_CI_EMPTY_CHANNEL_KEY_FILE
const orderFile = process.env.SHQIPSHOP_CI_ORDER_ID_FILE
assert(originalKeyFile && alternateKeyFile && orderFile, "CI-only fixture paths are required")
const main = readFileSync(originalKeyFile, "utf8").trim()
const alt = readFileSync(alternateKeyFile, "utf8").trim()
const orderId = readFileSync(orderFile, "utf8").trim()
assert(main.length > 10 && alt.length > 10 && main !== alt)
assert(/^order_[a-zA-Z0-9]+$/.test(orderId))
const url = "http://127.0.0.1:9000/store/orders/" + encodeURIComponent(orderId)
async function probe(key) {
  const r = await fetch(url, {
    headers: { "x-publishable-api-key": key },
    signal: AbortSignal.timeout(15000),
  })
  return r.status
}
const ownStatus = await probe(main)
const otherStatus = await probe(alt)
console.log("SHQIPSHOP_STORE_ORDER_ACCESS_STATUSES", JSON.stringify({
  originalChannelStatus: ownStatus,
  otherChannelStatus: otherStatus,
}))
if (otherStatus === 200) {
  console.error("SHQIPSHOP_CROSS_CHANNEL_ORDER_ID_EXPOSED")
  throw new Error(
    "A second sales-channel publishable key retrieved the synthetic order. " +
    "Do not use sales channels as merchant tenant isolation."
  )
}
if (ownStatus !== 200) {
  console.log("SHQIPSHOP_STORE_ORDER_SCOPE_INCONCLUSIVE", JSON.stringify({
    reason: "Even the original key cannot read order ID without further user authentication",
    status: ownStatus,
  }))
} else {
  assert([400, 401, 403, 404].includes(otherStatus), "Unexpected cross-channel access status")
  console.log("SHQIPSHOP_STORE_ORDER_CROSS_CHANNEL_DENIED_ON_ID_PROBE")
}
// This tests one Store endpoint only. Admin, customer, storage and events remain untested.
