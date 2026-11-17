/**
 * ShqipShop F08 Stage 11J: validate refundPaymentsWorkflow vs the
 * confirmed failing direct Payment Module refundPayment (Stage 11I).
 *
 * Use only an independent, previously created Stage 11B synthetic order,
 * never the Stage 11E/11F/11G payment. No card network, live PSP or PII.
 * The separate direct-module sentinel remains FAILING in the existing CI.
 */
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {resolve,sep} from "node:path"
import type {ExecArgs} from "@medusajs/framework/types"
import {ContainerRegistrationKeys,Modules} from "@medusajs/framework/utils"
import {refundPaymentsWorkflow} from "@medusajs/medusa/core-flows"

export default async function verifyRefundWorkflow({container}:ExecArgs){
 for(const [name,value] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
  SHQIPSHOP_F08_MULTIPROC_CI:"true",
  SHQIPSHOP_F08_ACK_LOSS_CI:"true",
  SHQIPSHOP_F08_PAYMENT_CHAIN_CI:"true",
  SHQIPSHOP_F08_PSP_CONTRACT_CI:"true",
  SHQIPSHOP_F08_REFUND_WORKFLOW_CI:"true",
  WORKER_MODE:"server",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
 }))assert.equal(process.env[name],value,name)
 const root=process.env.RUNNER_TEMP
 const proofPath=process.env.SHQIPSHOP_F08_COMPLETE_PROOF_FILE
 assert(root&&proofPath&&resolve(proofPath).startsWith(resolve(root)+sep),
  "Require existing Stage 11B runner-local proof")
 const proof=JSON.parse(readFileSync(proofPath,"utf8")) as {
  customerId:string,cartIds:string[],orderIds:string[]
 }
 assert(/^cus_[A-Za-z0-9_-]{8,}$/.test(proof.customerId))
 assert(Array.isArray(proof.cartIds)&&proof.cartIds.length===2)
 assert(Array.isArray(proof.orderIds)&&proof.orderIds.length===2)
 for(const id of proof.cartIds) assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(id))
 for(const id of proof.orderIds) assert(/^order_[A-Za-z0-9_-]{8,}$/.test(id))
 assert.equal(new Set(proof.orderIds).size,2)

 const query=container.resolve(ContainerRegistrationKeys.QUERY)
 const service=container.resolve(Modules.PAYMENT)
 const {data:orders}=await query.graph({
  entity:"order",
  fields:["id","customer_id","currency_code","total",
    "cart.id","payment_collections.id"],
  filters:{customer_id:proof.customerId},
 })
 assert.equal(orders.length,2,"Stage 11B must still have two distinct completed orders")
 const order=orders.find(o=>o.id===proof.orderIds[0])
 assert(order,"Independent Stage 11B order missing")
 assert.equal(order.customer_id,proof.customerId)
 assert.equal(order.cart?.id,proof.cartIds[0])
 assert.equal(order.currency_code,"all")
 const total=Number(order.total)
 assert(Number.isSafeInteger(total)&&total>=2)
 assert.equal(order.payment_collections?.length,1)
 const collectionId=order.payment_collections[0].id
 assert(/^pay_?col_[A-Za-z0-9_-]{8,}$/.test(collectionId))

 const snapshot=async()=>{
  const {data}=await query.graph({
   entity:"payment_collection",
   fields:["id","currency_code","amount","payments.id",
    "payments.provider_id","payments.amount",
    "payments.captures.id","payments.captures.amount",
    "payments.refunds.id","payments.refunds.amount","payments.refunds.status"],
   filters:{id:collectionId},
  })
  assert.equal(data.length,1)
  const pc=data[0]
  assert.equal(pc.currency_code,"all")
  assert.equal(Number(pc.amount),total)
  assert.equal(pc.payments?.length,1)
  const pay=pc.payments[0]
  assert(/^pay_[A-Za-z0-9_-]{8,}$/.test(pay.id))
  assert.equal(pay.provider_id,"pp_system_default")
  assert.equal(Number(pay.amount),total)
  return {paymentId:pay.id,captures:pay.captures??[],refunds:pay.refunds??[]}
 }
 let before=await snapshot()
 assert.equal(before.captures.length,0,
  "Independent workflow fixture must start uncaptured")
 assert.equal(before.refunds.length,0,
  "Independent workflow fixture must start unrefunded")
 const paymentId=before.paymentId
 await service.capturePayment({payment_id:paymentId,amount:total})
 before=await snapshot()
 assert.equal(before.captures.length,1)
 assert.equal(Number(before.captures[0].amount),total)
 const captureId=before.captures[0].id
 assert(/^capt_[A-Za-z0-9_-]{8,}$/.test(captureId))

 const assertPersisted=async(expectedAmounts:number[])=>{
  const now=await snapshot()
  assert.equal(now.paymentId,paymentId)
  assert.equal(now.captures.length,1,"Capture must not change during refunds")
  assert.equal(now.captures[0].id,captureId)
  assert.equal(Number(now.captures[0].amount),total)
  const refunds=now.refunds
  assert.equal(refunds.length,expectedAmounts.length,
    "Unexpected successful refund count in PostgreSQL")
  assert.equal(new Set(refunds.map(r=>r.id)).size,refunds.length)
  const actualAmounts=refunds.map(r=>Number(r.amount)).sort((a,b)=>a-b)
  const expectedSorted=[...expectedAmounts].sort((a,b)=>a-b)
  assert.deepEqual(actualAmounts,expectedSorted)
  assert(refunds.every(r=>r.status==="succeeded"),
    "Workflow must not report success with a failed or pending refund")
  assert(actualAmounts.reduce((a,b)=>a+b,0)<=total,
    "Cumulative refunds MUST NOT exceed captured total")
  return refunds.map(r=>r.id).sort()
 }
 const run=async(amount:number)=>
  refundPaymentsWorkflow(container).run({input:[{payment_id:paymentId,amount}]})

 // Negative control: exceed the 1 ALL zero-decimal tolerance by 2 ALL.
 await assert.rejects(()=>run(total+2),
  "Workflow must reject a new refund larger than captured total")
 assert.deepEqual(await assertPersisted([]),[])
 console.log("SHQIPSHOP_F08_STAGE11J_WORKFLOW_INITIAL_OVER_REFUND_DENIED")

 const partial=Math.floor(total/2)
 assert(partial>0&&partial<total)
 await run(partial)
 const firstIds=await assertPersisted([partial])
 assert.equal(firstIds.length,1)
 console.log("SHQIPSHOP_F08_STAGE11J_WORKFLOW_PARTIAL_REFUND_PERSISTED")

 const remaining=total-partial
 await assert.rejects(()=>run(remaining+2),
  "Workflow must reject a new refund greater than remaining amount")
 assert.deepEqual(await assertPersisted([partial]),firstIds)
 console.log("SHQIPSHOP_F08_STAGE11J_WORKFLOW_CUMULATIVE_OVER_REFUND_DENIED")

 await run(remaining)
 const bothIds=await assertPersisted([partial,remaining])
 assert.equal(bothIds.length,2)
 assert(bothIds.includes(firstIds[0]),
  "Original valid refund must remain unchanged")
 console.log("SHQIPSHOP_F08_STAGE11J_WORKFLOW_EXACT_REMAINING_REFUND_PERSISTED")

 // ALL has zero fractional digits in Medusa 2.22.0 and
 // getEpsilonFromDecimalPrecision(0) returns 1. Explicitly measure
 // the 1 ALL borderline after full refund. A tolerant workflow
 // response must NOT be mistaken for safe persisted financial effects.
 let oneAllRequestAccepted=false
 try {
  await run(1)
  oneAllRequestAccepted=true
 } catch {
  // An actual rejection is desirable; confirm PostgreSQL regardless.
 }
 const afterOneAll=await snapshot()
 const totalRefunded=afterOneAll.refunds.reduce(
  (sum,ref)=>sum+Number(ref.amount),0)
 if(oneAllRequestAccepted){
  console.log("SHQIPSHOP_F08_STAGE11J_ZERO_DECIMAL_ONE_ALL_CALL_ACCEPTED")
 }
 if(afterOneAll.refunds.length!==2||totalRefunded!==total){
  console.log("SHQIPSHOP_F08_STAGE11J_ZERO_DECIMAL_ONE_ALL_REFUND_PERSISTED")
 }
 assert.deepEqual(afterOneAll.refunds.map(ref=>ref.id).sort(),bothIds,
  "CRITICAL: 1 ALL extra request cannot change the persisted refund IDs")
 assert.equal(totalRefunded,total,
  "CRITICAL: 1 ALL epsilon cannot exceed the captured order amount")
 assert(!oneAllRequestAccepted,
  "CRITICAL: refund workflow accepted an over-total 1 ALL refund request")
 assert.deepEqual(await assertPersisted([partial,remaining]),bothIds)
 console.log("SHQIPSHOP_F08_STAGE11J_WORKFLOW_AFTER_FULL_REFUND_DENIED")
 console.log("SHQIPSHOP_F08_STAGE11J_WORKFLOW_SCOPED_POSITIVE_AND_NEGATIVE_PASSED")
}
