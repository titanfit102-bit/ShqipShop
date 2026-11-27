import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const verifier = fileURLToPath(new URL("./verify-merchant-order-fixture.mjs", import.meta.url))
const fixture = () => ({
  schema_version: 1,
  merchant: "merchant_a_ci",
  order: { id: "order_example", currency_code: "all", total: "1510" },
  lines: [{
    id: "line_example", product_id: "prod_example", variant_id: "variant_example",
    quantity: "1", unit_amount: "1500",
  }],
  stock: [{
    product_id: "prod_example", variant_id: "variant_example", inventory_item_id: "iitem_example",
    inventory_level_id: "ilev_example", location_id: "sloc_example",
    stocked_quantity: "10", reserved_quantity: "1",
  }],
  payments: [{
    id: "pay_example", collection_id: "paycol_example", currency_code: "all",
    provider_id: "pp_system_default", amount: "1510", collection_amount: "1510",
    captured_amount: "0", refunded_amount: "0",
  }],
})

function verify(value) {
  return spawnSync(process.execPath, [verifier, "order_example"], {
    input: JSON.stringify(value), encoding: "utf8", timeout: 5000,
  })
}

test("verifies a versioned fixture and emits only its checksum", () => {
  const result = verify(fixture())
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /^[0-9a-f]{64}\n$/)
})

test("rejects a stock record disconnected from the exported order line", () => {
  const value = fixture()
  value.stock[0].variant_id = "variant_wrong"
  const result = verify(value)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /missing its product\/variant stock relationship/)
})

test("rejects a payment that differs from the order by one lek", () => {
  const value = fixture()
  value.payments[0].amount = "1511"
  const result = verify(value)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Payment and order totals differ/)
})

test("rejects a refund against an uncaptured payment", () => {
  const value = fixture()
  value.payments[0].refunded_amount = "1"
  const result = verify(value)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Invalid captured and refunded amounts/)
})
