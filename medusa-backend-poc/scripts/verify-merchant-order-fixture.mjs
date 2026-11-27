/** Read and verify the simulated ALL order export without writing commerce data. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

const bytes = readFileSync(0)
const fixture = JSON.parse(bytes)
const { order, lines, stock, payments } = fixture

function whole(value) {
  assert(typeof value === "string" && /^\d+$/.test(value), "Expected whole nonnegative ALL or quantity")
  return BigInt(value)
}

assert.equal(fixture.schema_version, 1)
assert.equal(fixture.merchant, "merchant_a_ci")
assert(/^order_[a-zA-Z0-9]+$/.test(process.argv[2]))
assert.equal(order.id, process.argv[2])
assert.equal(order.currency_code, "all")
const total = whole(order.total)
assert(total > 0n)
assert(Array.isArray(lines) && lines.length > 0)
assert(Array.isArray(stock) && stock.length > 0)
assert.equal(new Set(lines.map(line => line.id)).size, lines.length, "Duplicate order line")
const variantsWithStock = new Set(stock.map(level => {
  assert(level.inventory_item_id && level.inventory_level_id && level.location_id)
  assert(whole(level.reserved_quantity) <= whole(level.stocked_quantity))
  return JSON.stringify([level.product_id, level.variant_id])
}))
for (const line of lines) {
  assert(whole(line.quantity) > 0n && whole(line.unit_amount) > 0n)
  assert(line.product_id && line.variant_id)
  assert(variantsWithStock.has(JSON.stringify([line.product_id, line.variant_id])),
    "Order line is missing its product/variant stock relationship")
}
assert(Array.isArray(payments) && payments.length === 1, "Expected one simulated payment")
const [payment] = payments
assert(payment.id && payment.collection_id)
assert.equal(payment.currency_code, order.currency_code)
assert.equal(payment.provider_id, "pp_system_default")
assert(whole(payment.amount) === total && whole(payment.collection_amount) === total, "Payment and order totals differ")
assert(whole(payment.refunded_amount) <= whole(payment.captured_amount) && whole(payment.captured_amount) <= total,
  "Invalid captured and refunded amounts")

console.log(createHash("sha256").update(bytes).digest("hex"))
