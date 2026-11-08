/**
 * F08 Stage 11G — disposable Medusa PAYMENT MODULE lifecycle probe.
 *
 * Payment authorization/order/linkage was already proven by Stage 11F.
 * This is an isolated CI-only positive/negative capture/refund exercise
 * using pp_system_default; it DOES NOT test any real PSP or webhook.
 * Run ONLY after Stage 11F snapshot comparisons have finished.
 */
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {resolve,sep} from "node:path"
import type {ExecArgs} from "@medusajs/framework/types"
import {ContainerRegistrationKeys,Modules} from "@medusajs/framework/utils"

export default async function provePaymentLifecycle({container}:ExecArgs){
 for(const [k,v] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
  SHQIPSHOP_F08_MULTIPROC_CI:"true",SHQIPSHOP_F08_ACK_LOSS_CI:"true",
  SHQIPSHOP_F08_PAYMENT_CHAIN_CI:"true",SHQIPSHOP_F08_PSP_CONTRACT_CI:"true",
  WORKER_MODE:"server",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
 })) assert.equal(process.env[k],v,k)
 const root=process.env.RUNNER_TEMP
 const input=process.env.SHQIPSHOP_F08_MULTIPROC_PROOF_FILE
 const orderProof=process.env.SHQIPSHOP_F08_ACK_BASELINE_FILE
 if(!root||!input||!orderProof)throw Error("Runner-local proof files missing")
 for(const file of [input,orderProof])
  assert(resolve(file).startsWith(resolve(root)+sep))
 const state=JSON.parse(readFileSync(input,"utf8")) as {
  customerId:string,cartId:string,orderId?:string
 }
 const baseline=JSON.parse(readFileSync(orderProof,"utf8")) as {orderId:string}
 assert(/^cus_[A-Za-z0-9_-]{8,}$/.test(state.customerId))
 assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(state.cartId))
 assert(!state.orderId,"Synthetic client MUST have discarded HTTP confirmation")
 assert(/^order_[A-Za-z0-9_-]{8,}$/.test(baseline.orderId))
 const query=container.resolve(ContainerRegistrationKeys.QUERY)
 const paymentService=container.resolve(Modules.PAYMENT)
 const {data:orders}=await query.graph({
  entity:"order",fields:["id","customer_id","currency_code","total",
   "cart.id","payment_collections.id"],
  filters:{customer_id:state.customerId},
 })
 assert.equal(orders.length,1)
 const order=orders[0]
 assert.equal(order.id,baseline.orderId)
 assert.equal(order.cart?.id,state.cartId)
 assert.equal(order.currency_code,"all")
 const total=Number(order.total)
 assert(Number.isSafeInteger(total)&&total>=2)
 const collections=order.payment_collections??[]
 assert.equal(collections.length,1)
 const collectionId=collections[0].id
 assert(/^pay_?col_[A-Za-z0-9_-]{8,}$/.test(collectionId))
 const retrieve=async()=>{
  const result=await query.graph({
   entity:"payment_collection",
   fields:["id","currency_code","amount",
    "payments.id","payments.provider_id","payments.amount",
    "payments.captures.id","payments.captures.amount",
    "payments.refunds.id","payments.refunds.amount","payments.refunds.status"],
   filters:{id:collectionId},
  })
  assert.equal(result.data.length,1)
  const collection=result.data[0]
  assert.equal(collection.currency_code,"all")
  assert.equal(Number(collection.amount),total)
  assert.equal(collection.payments?.length,1)
  const payment=collection.payments[0]
  assert(/^pay_[A-Za-z0-9_-]{8,}$/.test(payment.id))
  assert.equal(payment.provider_id,"pp_system_default")
  assert.equal(Number(payment.amount),total)
  return {paymentId:payment.id,captures:payment.captures??[],
   refunds:payment.refunds??[]}
 }
 const initial=await retrieve()
 assert.equal(initial.captures.length,0,
  "A manual mock provider must start uncaptured for this fixture")
 assert.equal(initial.refunds.length,0)
 const paymentId=initial.paymentId
 await assert.rejects(
  ()=>paymentService.capturePayment({payment_id:paymentId,amount:0}),
  "Zero-value capture MUST be rejected by pinned Medusa")
 let current=await retrieve()
 assert.equal(current.captures.length,0)
 await paymentService.capturePayment({payment_id:paymentId,amount:total})
 current=await retrieve()
 assert.equal(current.captures.length,1)
 assert.equal(Number(current.captures[0].amount),total)
 const captureId=current.captures[0].id
 assert(/^capt_[A-Za-z0-9_-]{8,}$/.test(captureId))
 console.log("SHQIPSHOP_F08_STAGE11G_MOCK_CAPTURE_ONCE_AT_EXACT_ORDER_TOTAL")
 // A fully captured amount is unavailable for additional captures.
 // Do not hide a duplicate attempt by resetting state between calls.
 // An idempotent module may respond with success instead of an error.
 // The security invariant is the persisted capture side effect, not status.
 try{
  await paymentService.capturePayment({payment_id:paymentId,amount:total})
 }catch{
  // An explicit rejection is also acceptable if no new capture was saved.
 }
 current=await retrieve()
 assert.equal(current.captures.length,1,
  "CRITICAL: repeating full capture MUST NOT persist a duplicate capture")
 assert.equal(current.captures[0].id,captureId,
  "Repeating capture MUST preserve the original persisted capture ID")
 assert.equal(Number(current.captures[0].amount),total)
 console.log("SHQIPSHOP_F08_STAGE11G_CAPTURE_RETRY_NO_SECOND_DB_RECORD")
 const refundAmount=Math.floor(total/2)
 assert(refundAmount>0&&refundAmount<total)
 const refundKey="shqipshop-stage11g-"+paymentId
 await assert.rejects(
  ()=>paymentService.refundPayment({
   payment_id:paymentId,amount:0,idempotency_key:refundKey+"-invalid"}),
  "Zero-value refund MUST be rejected")
 current=await retrieve()
 assert.equal(current.refunds.length,0)
 await paymentService.refundPayment({
  payment_id:paymentId,amount:refundAmount,idempotency_key:refundKey})
 current=await retrieve()
 assert.equal(current.refunds.length,1,
  "First keyed mock refund must create precisely one refund")
 const refund=current.refunds[0]
 const refundId=refund.id
 assert(/^ref_[A-Za-z0-9_-]{8,}$/.test(refundId))
 assert.equal(Number(refund.amount),refundAmount)
 assert.equal(refund.status,"succeeded",
  "Manual mock refund must have succeeded before idempotent retry")
 console.log("SHQIPSHOP_F08_STAGE11G_MOCK_PARTIAL_REFUND_SUCCEEDED")
 await paymentService.refundPayment({
  payment_id:paymentId,amount:refundAmount,idempotency_key:refundKey})
 current=await retrieve()
 assert.equal(current.refunds.length,1,
  "Same-key refund retry MUST NOT persist a second refund")
 assert.equal(current.refunds[0].id,refundId)
 await assert.rejects(
  ()=>paymentService.refundPayment({
   payment_id:paymentId,amount:refundAmount+1,idempotency_key:refundKey}),
  "Same refund key with different amount MUST be denied")
 current=await retrieve()
 assert.equal(current.refunds.length,1)
 assert.equal(current.refunds[0].id,refundId)
 assert.equal(current.captures.length,1)
 assert.equal(current.captures[0].id,captureId)
 console.log("SHQIPSHOP_F08_STAGE11G_SAME_KEY_REFUND_REPLAY_NO_DUPLICATE")
 console.log("SHQIPSHOP_F08_STAGE11G_REFUND_KEY_AMOUNT_CONFLICT_DENIED")
}
