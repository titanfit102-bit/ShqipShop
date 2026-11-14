/**
 * F08 Stage 11K: disposable proof of strict zero-decimal ALL refund amount
 * authorization BEFORE calling Medusa's lower-level Payment Module.
 *
 * This is a CI-only serial validation probe on the second Stage 11B order.
 * It is NOT a production entry point, lock, entitlement/RBAC decision,
 * durable idempotency ledger, bank reconciliation or PSP integration.
 * Stage 11I/11J failing tests remain mandatory and unmodified.
 */
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {resolve,sep} from "node:path"
import type {ExecArgs} from "@medusajs/framework/types"
import {ContainerRegistrationKeys,Modules} from "@medusajs/framework/utils"

type MoneyRow={id:string,amount:unknown,status?:string}
type Snapshot={paymentId:string,currency:string,paymentAmount:unknown,
  captures:MoneyRow[],refunds:MoneyRow[]}

/** Fail closed on fractions, unsafe floats, malformed strings and unknown values. */
function exactAllInteger(value:unknown):bigint {
 if(typeof value==="number"){
  if(!Number.isSafeInteger(value)||value<0)
   throw new Error("ALL amount must be a nonnegative safe integer")
  return BigInt(value)
 }
 if(typeof value==="string" && /^(0|[1-9][0-9]*)(?:[.]0+)?$/.test(value)){
  return BigInt(value.split(".")[0])
 }
 throw new Error("Unrepresentable integer ALL amount")
}

function requireStrictRemaining(s:Snapshot,requested:unknown):bigint {
 if(s.currency!=="all")throw new Error("Unexpected currency")
 if(typeof requested!=="number" || !Number.isSafeInteger(requested) || requested<=0)
  throw new Error("Invalid requested whole-ALL amount")
 const limit=exactAllInteger(s.paymentAmount)
 if(limit<=0n||s.captures.length===0)
  throw new Error("No eligible positive capture")
 let captured=0n
 for(const c of s.captures) {
  const amount=exactAllInteger(c.amount)
  if(amount<=0n)throw new Error("Invalid capture")
  captured+=amount
 }
 if(captured<=0n||captured>limit)throw new Error("Inconsistent capture ledger")
 // Reserve ALL recorded refund amounts, including unresolved/failed states,
 // until authoritative reconciliation. This deliberately blocks rather
 // than risks another external financial effect.
 let reserved=0n
 for(const r of s.refunds) {
  const amount=exactAllInteger(r.amount)
  if(amount<=0n)throw new Error("Invalid refund ledger")
  reserved+=amount
 }
 if(reserved>captured)throw new Error("Refund ledger already overdrawn")
 const remaining=captured-reserved
 if(BigInt(requested)>remaining)
  throw new Error("Strict remaining balance exceeded")
 return remaining
}

export default async function proveStrictRefundBoundary({container}:ExecArgs){
 for(const [name,value] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
  SHQIPSHOP_F08_MULTIPROC_CI:"true",SHQIPSHOP_F08_ACK_LOSS_CI:"true",
  SHQIPSHOP_F08_PAYMENT_CHAIN_CI:"true",
  SHQIPSHOP_F08_PSP_CONTRACT_CI:"true",
  SHQIPSHOP_F08_EXACT_REFUND_CI:"true",WORKER_MODE:"server",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
 }))assert.equal(process.env[name],value,name)
 const root=process.env.RUNNER_TEMP
 const file=process.env.SHQIPSHOP_F08_COMPLETE_PROOF_FILE
 assert(root&&file&&resolve(file).startsWith(resolve(root)+sep))
 const proof=JSON.parse(readFileSync(file,"utf8")) as {
  customerId:string,orderIds:string[],cartIds:string[]
 }
 assert(/^cus_[A-Za-z0-9_-]{8,}$/.test(proof.customerId))
 assert(Array.isArray(proof.orderIds)&&proof.orderIds.length===2)
 assert(Array.isArray(proof.cartIds)&&proof.cartIds.length===2)
 assert.equal(new Set(proof.orderIds).size,2)
 assert.equal(new Set(proof.cartIds).size,2)
 for(const id of proof.orderIds)assert(/^order_[A-Za-z0-9_-]{8,}$/.test(id))
 for(const id of proof.cartIds)assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(id))
 const query=container.resolve(ContainerRegistrationKeys.QUERY)
 const service=container.resolve(Modules.PAYMENT)
 const {data:orders}=await query.graph({
  entity:"order",fields:["id","customer_id","currency_code","total",
   "cart.id","payment_collections.id"],
  filters:{customer_id:proof.customerId},
 })
 assert.equal(orders.length,2)
 // Stage 11J runs on orderIds[0]; this proof uses orderIds[1].
 const order=orders.find(o=>o.id===proof.orderIds[1])
 assert(order)
 assert.equal(order.cart?.id,proof.cartIds[1])
 assert.equal(order.customer_id,proof.customerId)
 assert.equal(order.currency_code,"all")
 const total=Number(order.total)
 assert(Number.isSafeInteger(total)&&total>=2)
 assert.equal(order.payment_collections?.length,1)
 const collectionId=order.payment_collections[0].id
 assert(/^pay_?col_[A-Za-z0-9_-]{8,}$/.test(collectionId))
 const snapshot=async():Promise<Snapshot>=>{
  const {data}=await query.graph({
   entity:"payment_collection",
   fields:["id","currency_code","amount","payments.id",
    "payments.provider_id","payments.amount","payments.captures.id",
    "payments.captures.amount","payments.refunds.id",
    "payments.refunds.amount","payments.refunds.status"],
   filters:{id:collectionId},
  })
  assert.equal(data.length,1)
  const pc=data[0]
  assert.equal(pc.currency_code,"all")
  assert.equal(Number(pc.amount),total)
  assert.equal(pc.payments?.length,1)
  const payment=pc.payments[0]
  assert(/^pay_[A-Za-z0-9_-]{8,}$/.test(payment.id))
  assert.equal(payment.provider_id,"pp_system_default")
  assert.equal(Number(payment.amount),total)
  return {paymentId:payment.id,currency:pc.currency_code,
   paymentAmount:payment.amount,
   captures:payment.captures??[],refunds:payment.refunds??[]}
 }
 const initial=await snapshot()
 assert.equal(initial.captures.length,0)
 assert.equal(initial.refunds.length,0)
 assert.throws(()=>requireStrictRemaining(initial,1))
 const paymentId=initial.paymentId
 await service.capturePayment({payment_id:paymentId,amount:total})
 const captured=await snapshot()
 assert.equal(captured.captures.length,1)
 assert.equal(exactAllInteger(captured.captures[0].amount),BigInt(total))
 const captureId=captured.captures[0].id
 assert(/^capt_[A-Za-z0-9_-]{8,}$/.test(captureId))

 // Invalid values MUST be denied BEFORE invoking the payment provider.
 const badValues:unknown[]=[0,-1,0.5,1.5,Number.MAX_SAFE_INTEGER+1,
  "1","1e3",null,undefined]
 for(const invalid of badValues)
  assert.throws(()=>requireStrictRemaining(captured,invalid))
 assert.throws(()=>requireStrictRemaining({...captured,currency:"eur"},1))
 assert.throws(()=>requireStrictRemaining(captured,total+1))
 assert.throws(()=>requireStrictRemaining(captured,total+2))
 const before=await snapshot()
 assert.deepEqual(before.refunds,[])
 console.log("SHQIPSHOP_F08_STAGE11K_STRICT_INITIAL_INVALID_REFUNDS_DENIED")

 const guarded=async(amount:number,key:string)=>{
  const fresh=await snapshot()
  assert.equal(fresh.paymentId,paymentId)
  requireStrictRemaining(fresh,amount)
  await service.refundPayment({
   payment_id:paymentId,amount,idempotency_key:key,
  })
 }
 const assertLedger=async(expected:number[])=>{
  const now=await snapshot()
  assert.equal(now.paymentId,paymentId)
  assert.equal(now.captures.length,1)
  assert.equal(now.captures[0].id,captureId)
  assert.equal(exactAllInteger(now.captures[0].amount),BigInt(total))
  assert.equal(now.refunds.length,expected.length)
  assert.equal(new Set(now.refunds.map(r=>r.id)).size,expected.length)
  const actual=now.refunds.map(r=>exactAllInteger(r.amount)).sort()
  assert.deepEqual(actual,expected.map(a=>BigInt(a)).sort())
  assert(now.refunds.every(r=>r.status==="succeeded"))
  const sum=actual.reduce((a,b)=>a+b,0n)
  assert(sum<=BigInt(total))
  return now.refunds.map(r=>r.id).sort()
 }
 const first=Math.floor(total/2)
 const remaining=total-first
 assert(first>0&&remaining>0)
 await guarded(first,"shqipshop-stage11k-first-"+paymentId)
 const firstIds=await assertLedger([first])
 assert.equal(firstIds.length,1)
 console.log("SHQIPSHOP_F08_STAGE11K_GUARDED_PARTIAL_REFUND_PERSISTED")

 await assert.rejects(()=>guarded(remaining+1,
  "shqipshop-stage11k-over-remaining-"+paymentId))
 assert.deepEqual(await assertLedger([first]),firstIds)
 console.log("SHQIPSHOP_F08_STAGE11K_STRICT_ONE_ALL_OVER_REMAINING_DENIED")

 await guarded(remaining,"shqipshop-stage11k-remaining-"+paymentId)
 const fullIds=await assertLedger([first,remaining])
 assert.equal(fullIds.length,2)
 assert(fullIds.includes(firstIds[0]))
 console.log("SHQIPSHOP_F08_STAGE11K_EXACT_REMAINDER_PERSISTED")

 await assert.rejects(()=>guarded(1,
  "shqipshop-stage11k-after-full-"+paymentId))
 assert.deepEqual(await assertLedger([first,remaining]),fullIds)
 console.log("SHQIPSHOP_F08_STAGE11K_POST_FULL_REFUND_ONE_ALL_DENIED")
 console.log("SHQIPSHOP_F08_STAGE11K_SERIAL_CI_AMOUNT_POLICY_PASSED")
}
