/** R01 candidate integration on newly allocated manual-provider fixtures only. */
import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { asValue } from "@medusajs/framework/awilix"
import { capturePaymentWorkflow, refundPaymentsWorkflow } from "@medusajs/medusa/core-flows"

const endpoints = ["http://127.0.0.1:9220", "http://127.0.0.1:9221"]
type Fixture = { orderId: string, collectionId: string, paymentId: string, captureId: string, total: number }

export default async function verify({ container }: ExecArgs) {
  assert.equal(process.env.CI, "true")
  assert.equal(process.env.NODE_ENV, "development")
  assert.equal(process.env.SHQIPSHOP_R01_REFUND_CANDIDATE_CI, "true")
  assert.equal(process.env.WORKER_MODE, "server")
  assert.equal(process.env.SHQIPSHOP_F08_STRICT_REFUND_CI, undefined)
  const database = new URL(process.env.DATABASE_URL!)
  assert.equal(database.protocol, "postgres:")
  assert.equal(database.hostname, "127.0.0.1")
  assert.equal(database.pathname, "/medusa_ci")
  assert.equal(database.username, "medusa_ci")
  const redis = new URL(process.env.REDIS_URL!)
  assert.equal(redis.protocol, "redis:")
  assert.equal(redis.hostname, "127.0.0.1")

  const orders = container.resolve(Modules.ORDER)
  const payments = container.resolve(Modules.PAYMENT)
  const links = container.resolve(ContainerRegistrationKeys.LINK)
  const db = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  async function fixture(total: number): Promise<Fixture> {
    const order = await orders.createOrders({
      currency_code: "all", items: [{ title: "Synthetic refund check", quantity: 1, unit_price: total }],
    })
    const collection = await payments.createPaymentCollections({ amount: total, currency_code: "all" })
    await links.create({ [Modules.ORDER]: {order_id: order.id}, [Modules.PAYMENT]: {payment_collection_id: collection.id} })
    const session = await payments.createPaymentSession(collection.id, {
      amount: total, currency_code: "all", provider_id: "pp_system_default", data: {}, context: {},
    })
    const payment = await payments.authorizePaymentSession(session.id, {})
    assert(payment && payment.provider_id === "pp_system_default")
    await capturePaymentWorkflow(container).run({input: {payment_id: payment.id, amount: total}})
    const captures = await db("capture").where({payment_id: payment.id}).whereNull("deleted_at").select("id", "amount")
    assert.equal(captures.length, 1)
    assert.equal(Number(captures[0].amount), total)
    return { orderId: order.id, collectionId: collection.id, paymentId: payment.id, total, captureId: captures[0].id }
  }

  async function collectionLedger(f: Fixture, refunded: number) {
    const collection = await db("payment_collection").where({id:f.collectionId}).whereNull("deleted_at")
      .first("id","currency_code","raw_amount","raw_authorized_amount","raw_captured_amount","raw_refunded_amount")
    assert(collection)
    assert.equal(collection.currency_code, "all")
    assert.equal(Number(collection.raw_amount.value), f.total)
    assert.equal(Number(collection.raw_authorized_amount.value), f.total)
    assert.equal(Number(collection.raw_captured_amount.value), f.total)
    assert.equal(Number(collection.raw_refunded_amount.value), refunded)
    return collection
  }

  async function ledger(f: Fixture, expected: Record<string, number>, expectedCredits: number[] = []) {
    const captures = await db("capture").where({payment_id: f.paymentId}).select("id","amount","deleted_at")
    assert.equal(captures.length, 1)
    assert.equal(captures[0].id, f.captureId)
    assert.equal(captures[0].deleted_at, null)
    assert.equal(Number(captures[0].amount), f.total)
    const refunds = await db("refund").where({payment_id: f.paymentId}).select("id","idempotency_key","amount","status","deleted_at").orderBy("id")
    const entries = await db("order_transaction").where({order_id:f.orderId, reference:"refund"})
      .select("id","reference_id","amount","currency_code","deleted_at").orderBy("id")
    assert.deepEqual(refunds.map(row => row.idempotency_key).sort(), Object.keys(expected).sort())
    assert.deepEqual(entries.map(entry => entry.reference_id).sort(), refunds.map(row => row.id))
    for (const row of refunds) {
      const entry = entries.find(entry => entry.reference_id === row.id)!
      assert.equal(row.status, "succeeded")
      assert.equal(row.deleted_at, null)
      assert.equal(entry.deleted_at, null)
      assert.equal(entry.currency_code, "all")
      assert.equal(Number(row.amount), expected[row.idempotency_key])
      assert.equal(-Number(entry.amount), Number(row.amount))
    }
    const refunded = refunds.reduce((n, row) => n + Number(row.amount), 0)
    assert(refunded <= f.total)
    const capturePostings = await db("order_transaction").where({order_id:f.orderId, reference:"capture"})
      .select("id","reference_id","amount","currency_code","deleted_at")
    assert.equal(capturePostings.length, 1)
    assert.equal(capturePostings[0].reference_id, f.captureId)
    assert.equal(Number(capturePostings[0].amount), f.total)
    assert.equal(capturePostings[0].currency_code, "all")
    assert.equal(capturePostings[0].deleted_at, null)
    const summary = await db("order_summary").where({order_id:f.orderId}).whereNull("deleted_at")
      .orderBy("version","desc").first("version","totals")
    assert(summary)
    const {totals} = summary
    assert.equal(Number(totals.paid_total), f.total)
    assert.equal(Number(totals.refunded_total), refunded)
    assert.equal(Number(totals.transaction_total), f.total - refunded)
    const credits = await db("order_credit_line").where({order_id:f.orderId, version:summary.version}).whereNull("deleted_at")
      .select("id","amount","version").orderBy("id")
    assert.deepEqual(credits.map(c => Number(c.amount)).sort((a,b) => a-b), [...expectedCredits].sort((a,b) => a-b))
    const credited = expectedCredits.reduce((sum,n) => sum+n,0)
    // Medusa carries credits into each new version. Its summary records the
    // new credit for that revision, while current_order_total is cumulative.
    const changes = await db("order_change").where({order_id:f.orderId, change_type:"credit_line"})
      .whereNull("deleted_at").select("id","status","version").orderBy("version")
    const actions = await db("order_change_action").where({order_id:f.orderId, action:"CREDIT_LINE_ADD"})
      .whereNull("deleted_at").select("order_change_id","amount","applied","version").orderBy("version")
    assert.equal(changes.length, expectedCredits.length)
    assert.deepEqual(actions.map(a => Number(a.amount)).sort((a,b) => a-b), [...expectedCredits].sort((a,b) => a-b))
    for (const [i, change] of changes.entries()) {
      assert.equal(change.status, "confirmed")
      assert.equal(actions[i].order_change_id, change.id)
      assert.equal(actions[i].version, change.version)
      assert.equal(actions[i].applied, true)
    }
    assert.equal(Number(totals.credit_line_total), Number(actions.at(-1)?.amount ?? 0))
    assert.equal(Number(totals.accounting_total), f.total - credited)
    assert.equal(Number(totals.current_order_total), f.total - credited)
    assert.equal(Number(totals.pending_difference), refunded - credited)
    const collection = await collectionLedger(f, refunded)
    return { refunds, entries, collection, capturePostings, credits, changes, actions, summary }
  }

  const single = await fixture(100)
  const plural = (f: Fixture, key: string, amount: number) => {
    const request = {payment_id: f.paymentId, idempotency_key: key, amount}
    return refundPaymentsWorkflow(container).run({input: [request]})
  }
  // Medusa adds registerAdd to child scopes. Awilix types createScope as its base container.
  const scope = container.createScope() as typeof container
  let attempts = 0
  const decliningWriter = Object.create(payments)
  Object.defineProperty(decliningWriter, "refundPayment", { configurable: true, writable: true, value: async () => {
    attempts++
    throw new Error("Synthetic refusal")
  } })
  scope.register({[Modules.PAYMENT]: asValue(decliningWriter)})
  try {
    await assert.rejects(() => refundPaymentsWorkflow(scope).run({
      input: [{payment_id: single.paymentId, amount: 1}],
    }), (error: {message?: string}) => error?.message === "Payment module did not confirm any requested refund")
  } finally { await scope.dispose() }
  assert.equal(attempts, 1)
  await ledger(single, {})
  console.log("R01_PG_LATE_REFUSAL_VERIFIED")

  await plural(single, "first", 20)
  await plural(single, "second", 30)
  await ledger(single, {first:20, second:30})
  await plural(single, "equal", 20)
  await plural(single, "remainder", 30)
  const finished = await ledger(single, {first:20, second:30, equal:20, remainder:30})
  await plural(single, "first", 20)
  assert.deepEqual(await ledger(single, {first:20, second:30, equal:20, remainder:30}), finished)
  console.log("R01_PG_PLURAL_DISTINCT_EQUAL_AMOUNTS_AND_EXHAUSTED_REPLAY_VERIFIED")

  const mixed = await fixture(100)
  await plural(mixed, "already", 70)
  const request = (key: string, amount: number) => ({payment_id:mixed.paymentId, idempotency_key:key, amount})
  await refundPaymentsWorkflow(container).run({input:[request("new", 20), request("already", 70)]})
  await ledger(mixed, {already:70, new:20})
  const partialScope = container.createScope() as typeof container
  const partialWriter = Object.create(payments)
  Object.defineProperty(partialWriter, "refundPayment", { configurable:true, writable:true, value: async (input: ReturnType<typeof request>) => {
    if (input.idempotency_key === "declined") throw new Error("Synthetic refusal")
    return payments.refundPayment(input)
  } })
  partialScope.register({[Modules.PAYMENT]:asValue(partialWriter)})
  try {
    await refundPaymentsWorkflow(partialScope).run({input:[request("accepted", 5), request("declined", 5)]})
  } finally { await partialScope.dispose() }
  await ledger(mixed, {already:70, new:20, accepted:5})
  console.log("R01_PG_MIXED_REPLAY_AND_PARTIAL_APPROVAL_VERIFIED")

  const concurrent = await fixture(100)
  await Promise.all([plural(concurrent,"left",40), plural(concurrent,"right",60)])
  await ledger(concurrent, {left:40, right:60})
  console.log("R01_PG_PLURAL_CONCURRENT_WRITERS_VERIFIED")

  // Build one new synthetic order in the prior payment-level reference format.
  const legacy = await fixture(100)
  await payments.refundPayment({payment_id:legacy.paymentId, amount:20, idempotency_key:"old"})
  await orders.addOrderTransactions([{
    order_id:legacy.orderId, amount:-20, currency_code:"all", reference:"refund", reference_id:legacy.paymentId,
  }])
  const legacySnapshot = async () => ({
    collection: await collectionLedger(legacy,20),
    refunds: await db("refund").where({payment_id:legacy.paymentId}).select("*").orderBy("id"),
    entries: await db("order_transaction").where({order_id:legacy.orderId}).select("*").orderBy("id"),
    summaries: await db("order_summary").where({order_id:legacy.orderId}).select("*").orderBy("version"),
  })
  const beforeLegacy = await legacySnapshot()
  await assert.rejects(() => plural(legacy,"next",5),
    (error: {message?:string}) => error?.message === "Existing payment-level refund posting requires reconciliation")
  assert.deepEqual(await legacySnapshot(), beforeLegacy)
  console.log("R01_PG_LEGACY_POSTING_HELD_WITHOUT_MUTATION_VERIFIED")

  const password = process.env.SHQIPSHOP_F08_STAGE11P_ADMIN_PASSWORD
  assert(password && /^[a-f0-9]{48}$/.test(password))
  const login = await fetch(endpoints[0]+"/auth/user/emailpass", {
    method: "POST", headers: {"content-type":"application/json"},
    body: JSON.stringify({email:"stage11p-admin@shqipshop.example.invalid",password}),
    signal: AbortSignal.timeout(10000),
  })
  assert.equal(login.status, 200)
  const token = (await login.json()).token
  assert.equal(typeof token, "string")
  const refund = async (api: number, f: Fixture, key: string, amount: number) => {
    const response = await fetch(endpoints[api]+"/admin/payments/"+encodeURIComponent(f.paymentId)+"/refund", {
      method:"POST", headers: {authorization:"Bearer "+token,"content-type":"application/json"},
      body: JSON.stringify({idempotency_key:key,amount}), signal:AbortSignal.timeout(20000),
    })
    await response.arrayBuffer()
    return response.status
  }

  const exact = await fixture(100)
  assert.deepEqual(await Promise.all([refund(0,exact,"left",20),refund(1,exact,"right",80)]), [200,200])
  const exactRows = await ledger(exact, {left:20,right:80}, [20,80])
  assert.equal(await refund(0,exact,"right",80), 200)
  assert.deepEqual(await ledger(exact, {left:20,right:80}, [20,80]), exactRows)
  console.log("R01_PG_TWO_API_FULL_BALANCE_AND_REPLAY_VERIFIED")

  const last = await fixture(10)
  await plural(last,"prior",9)
  const statuses = await Promise.all([refund(0,last,"a",1),refund(1,last,"b",1)])
  assert.equal(statuses.filter(s => s === 200).length, 1)
  assert.equal(statuses.filter(s => [400,409,422].includes(s)).length, 1)
  await ledger(last, {prior:9, [statuses[0] === 200 ? "a" : "b"]:1}, [1])
  console.log("R01_PG_TWO_API_ONE_REMAINING_UNIT_VERIFIED")

  const same = await fixture(100)
  const repeated = await Promise.all([refund(0,same,"retry",20),refund(1,same,"retry",20)])
  assert(repeated.includes(200) && repeated.every(s => s === 200 || s === 409))
  const sameRows = await ledger(same, {retry:20}, [20])
  assert.equal(await refund(1,same,"retry",20), 200)
  assert.deepEqual(await ledger(same, {retry:20}, [20]), sameRows)
  console.log("R01_PG_TWO_API_SAME_KEY_VERIFIED")
}
