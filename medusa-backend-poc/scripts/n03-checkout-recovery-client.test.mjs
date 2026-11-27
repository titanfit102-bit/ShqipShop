import assert from "node:assert/strict"
import { test } from "node:test"
import { createCheckoutRecoveryClient, ORDER_COMPLETION_PENDING_KEY } from "../../native-medusa/app/data/order-completion-recovery.ts"

const cart = "cart_fixture123"
const order = "order_fixture123"

function fixture(overrides = {}) {
  const journal = new Map([[ORDER_COMPLETION_PENDING_KEY, cart]])
  const resets = []
  const client = createCheckoutRecoveryClient({
    storage:{
      getItem:async key => journal.get(key) ?? null,
      setItem:async (key, value) => { journal.set(key, value) },
      removeItem:async key => { journal.delete(key) },
    },
    readOutcome:async () => ({status:200, data:{state:"confirmed", order_id:order}}),
    readReceipt:async () => ({status:200, data:{order:{id:order}}}),
    discardCart:async id => { resets.push(id) },
    isCurrent:() => true,
    ...overrides,
  })
  return {client, journal, resets}
}

test("confirmed finalizes once after reading the exact receipt", async () => {
  const {client, journal, resets} = fixture()
  const recovery = client.recover()
  assert.equal(client.recover(), recovery)
  assert.deepEqual(await recovery, {state:"confirmed", orderId:order})
  assert.deepEqual(resets, [cart])
  assert.equal(journal.size, 0)
  assert.deepEqual(await client.recover(), {state:"idle"})
})

test("no_order releases the sealed cart without looking up a receipt", async () => {
  const {client, journal, resets} = fixture({
    readOutcome:async () => ({status:200, data:{state:"no_order"}}),
    readReceipt:async () => assert.fail("no_order has no receipt"),
  })
  assert.deepEqual(await client.recover(), {state:"no_order"})
  assert.equal(journal.size, 0)
  assert.deepEqual(resets, [cart])
})

test("unknown, forbidden, missing and malformed outcomes leave the journal intact", async () => {
  const responses = [
    {status:200, data:{state:"unknown"}},
    {status:403, data:{state:"no_order"}},
    {status:404, data:{}},
    {status:200, data:{state:"confirmed", order_id:"bad"}},
    {status:200, data:{state:"no_order", order_id:order}},
  ]
  for (const response of responses) {
    const {client, journal, resets} = fixture({
      readOutcome:async () => response,
      readReceipt:async () => assert.fail("Cannot fetch a receipt for this outcome"),
    })
    assert.deepEqual(await client.recover(), {state:"pending"})
    assert.equal(journal.get(ORDER_COMPLETION_PENDING_KEY), cart)
    assert.deepEqual(resets, [])
  }
})

test("a wrong receipt, cleanup failure or a stale session retains the pending marker", async () => {
  let current = true
  const attempts = [
    {readReceipt:async () => ({status:200, data:{order:{id:"order_different"}}})},
    {discardCart:async () => { throw new Error("Storage unavailable") }},
    {
      isCurrent:() => current,
      readOutcome:async () => {
        current = false
        return {status:200, data:{state:"no_order"}}
      },
    },
    {readOutcome:async () => { throw new Error("Offline") }},
  ]
  for (const overrides of attempts) {
    const {client, journal} = fixture(overrides)
    assert.deepEqual(await client.recover(), {state:"pending"})
    assert.equal(journal.get(ORDER_COMPLETION_PENDING_KEY), cart)
  }
})
