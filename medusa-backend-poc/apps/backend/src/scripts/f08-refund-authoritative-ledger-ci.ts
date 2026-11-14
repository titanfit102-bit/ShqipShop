/**
 * F08 Stage 11T: READ-ONLY consistency audit of real Medusa's persisted
 * Payment / Capture / Refund rows and the Medusa Query Graph for a disposable
 * Stage 11B order already captured and fully refunded by Stage 11K.
 *
 * This does NOT reserve or refund money, enforce concurrent financial locks,
 * call a PSP, add tables, grant Admin permissions or certify production.
 * A PG read snapshot alone is NOT coordinated with all Medusa writers.
 */
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {resolve,sep} from "node:path"
import type {ExecArgs} from "@medusajs/framework/types"
import {ContainerRegistrationKeys,Modules} from "@medusajs/framework/utils"

type Entry={id:string;amount:bigint;status?:string}
type Ledger={id:string;amount:bigint;currency:string;provider:string;
  captures:Entry[];refunds:Entry[]}
const exact=(v:unknown):bigint=>{
 if(v===null||v===undefined||typeof v==="boolean")
  throw Error("Absent money")
 const n=Number(v)
 if(!Number.isSafeInteger(n)||n<0)throw Error("Unsafe ALL money")
 return BigInt(n)
}
const sorted=(rows:Entry[])=>rows.sort((a,b)=>a.id.localeCompare(b.id))
const distinct=(rows:Entry[])=>{
 assert.equal(new Set(rows.map(x=>x.id)).size,rows.length,"Duplicate ledger IDs")
}
const cap=(l:Ledger)=>l.captures.reduce((sum,r)=>sum+r.amount,0n)
const used=(l:Ledger)=>l.refunds.reduce((sum,r)=>sum+r.amount,0n)
function verifyLedger(l:Ledger,expectedPayment:string,expectedTotal:bigint){
 assert.equal(l.id,expectedPayment)
 assert.equal(l.currency,"all")
 assert.equal(l.provider,"pp_system_default")
 assert.equal(l.amount,expectedTotal)
 assert(expectedTotal>0n)
 distinct(l.captures);distinct(l.refunds)
 assert.equal(l.captures.length,1)
 assert.equal(l.refunds.length,2)
 assert(l.captures.every(x=>x.amount>0n))
 assert(l.refunds.every(x=>x.amount>0n&&x.status==="succeeded"))
 assert.equal(cap(l),expectedTotal)
 assert.equal(used(l),expectedTotal)
 assert.equal(cap(l)-used(l),0n)
}
export default async function auditAuthoritativeMedusaLedger({container}:ExecArgs){
 for(const [name,value] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
  SHQIPSHOP_F08_MULTIPROC_CI:"true",SHQIPSHOP_F08_ACK_LOSS_CI:"true",
  SHQIPSHOP_F08_PAYMENT_CHAIN_CI:"true",SHQIPSHOP_F08_PSP_CONTRACT_CI:"true",
  SHQIPSHOP_F08_EXACT_REFUND_CI:"true",
  SHQIPSHOP_F08_11T_LEDGER_CI:"true",
  SHQIPSHOP_F08_11U_LOCK_CI:"true",
  SHQIPSHOP_F08_11V_NATIVE_WRITER_CI:"true",WORKER_MODE:"server",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
 }))assert.equal(process.env[name],value,name)
 const file=process.env.SHQIPSHOP_F08_COMPLETE_PROOF_FILE
 const root=process.env.RUNNER_TEMP
 assert(file&&root&&resolve(file).startsWith(resolve(root)+sep))
 const proof=JSON.parse(readFileSync(file,"utf8")) as {
  customerId:string;orderIds:string[];cartIds:string[]
 }
 assert(/^cus_[A-Za-z0-9_-]{8,}$/.test(proof.customerId))
 assert(Array.isArray(proof.orderIds)&&proof.orderIds.length===2)
 assert(Array.isArray(proof.cartIds)&&proof.cartIds.length===2)
 const db:any=container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
 const query=container.resolve(ContainerRegistrationKeys.QUERY)
 for(const name of ["payment","capture","refund","payment_collection"]){
  assert.equal(await db.schema.hasTable(name),true,
   "Medusa payment authority table is missing: "+name)
 }
 // Same independent Stage 11B order as 11K. No synthetic shadow balance.
 const {data:orders}=await query.graph({
  entity:"order",fields:["id","customer_id","currency_code","total",
   "cart.id","payment_collections.id"],
  filters:{id:proof.orderIds[1]},
 })
 assert.equal(orders.length,1)
 const order=orders[0]
 assert.equal(order.customer_id,proof.customerId)
 assert.equal(order.cart?.id,proof.cartIds[1])
 assert.equal(order.currency_code,"all")
 const total=exact(order.total)
 assert(total>=2n)
 assert.equal(order.payment_collections?.length,1)
 const collectionId=order.payment_collections[0].id
 assert(/^pay_?col_[A-Za-z0-9_-]{8,}$/.test(collectionId))
 const graph=async():Promise<Ledger>=>{
  const {data}=await query.graph({
   entity:"payment_collection",filters:{id:collectionId},
   fields:["id","currency_code","amount","payments.id",
    "payments.amount","payments.currency_code","payments.provider_id",
    "payments.captures.id","payments.captures.amount",
    "payments.refunds.id","payments.refunds.amount","payments.refunds.status"],
  })
  assert.equal(data.length,1)
  const collection=data[0]
  assert.equal(collection.id,collectionId)
  assert.equal(collection.currency_code,"all")
  assert.equal(exact(collection.amount),total)
  assert.equal(collection.payments?.length,1)
  const payment=collection.payments[0]
  assert(/^pay_[A-Za-z0-9_-]{8,}$/.test(payment.id))
  return {id:payment.id,amount:exact(payment.amount),
   currency:payment.currency_code,provider:payment.provider_id,
   captures:sorted((payment.captures??[]).map((x:any)=>({
    id:x.id,amount:exact(x.amount)}))),
   refunds:sorted((payment.refunds??[]).map((x:any)=>({
    id:x.id,amount:exact(x.amount),status:String(x.status)})))}
 }
 const observed=await graph()
 verifyLedger(observed,observed.id,total)
 console.log("SHQIPSHOP_F08_STAGE11T_MEDUSA_GRAPH_AUTHORITATIVE_PAYMENT_LINKED")
 // A consistent committed PostgreSQL snapshot of the underlying Medusa
 // PAYMENT module records, NOT copies in our Stage 11R synthetic tables.
 const pg=await db.transaction(async(trx:any)=>{
  await trx.raw("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
  const collection=await trx("payment_collection").where({id:collectionId}).first()
  assert(collection)
  assert.equal(collection.currency_code,"all")
  assert.equal(exact(collection.amount),total)
  const p=await trx("payment").where({id:observed.id}).first()
  assert(p,"Payment must exist in the actual Medusa payment table")
  assert.equal(p.payment_collection_id,collectionId)
  const captureRows=await trx("capture").where({payment_id:observed.id})
   .orderBy("id")
  const refundRows=await trx("refund").where({payment_id:observed.id})
   .orderBy("id")
  return {id:p.id,amount:exact(p.amount),currency:p.currency_code,
   provider:p.provider_id,
   captures:sorted(captureRows.map((row:any)=>({
    id:row.id,amount:exact(row.amount)}))),
   refunds:sorted(refundRows.map((row:any)=>({
    id:row.id,amount:exact(row.amount),status:String(row.status)})))}
 }) as Ledger
 verifyLedger(pg,observed.id,total)
 assert.deepEqual(pg,observed,
  "Medusa Query Graph and its native PostgreSQL capture/refund authority disagree")
 console.log("SHQIPSHOP_F08_STAGE11T_POSTGRES_PAYMENT_CAPTURE_REFUND_GRAPH_MATCH")
 // Deterministic fail-closed mutation tests, NO UPDATE/INSERT/DELETE.
 assert.throws(()=>verifyLedger({...pg,amount:pg.amount+1n},observed.id,total))
 assert.throws(()=>verifyLedger({...pg,refunds:pg.refunds.slice(0,1)},observed.id,total))
 assert.throws(()=>verifyLedger({...pg,currency:"eur"},observed.id,total))
 assert.throws(()=>verifyLedger({...pg,captures:[...pg.captures,pg.captures[0]]},
  observed.id,total))
 assert.throws(()=>verifyLedger(pg,"pay_missing_stage11t",total))
 assert.equal((await db("payment").where({id:"pay_missing_stage11t"})).length,0)
 assert.deepEqual(await graph(),observed,
  "Read-only finance authority audit must not mutate actual Medusa ledger")
 console.log("SHQIPSHOP_F08_STAGE11T_AUTHORITY_MISMATCH_FAIL_CLOSED")
 console.log("SHQIPSHOP_F08_STAGE11T_READ_ONLY_MEDUSA_PAYMENT_AUTHORITY_PASSED")

 // Stage 11U: ACTUAL Medusa payment-row lock contention across two
 // independent PostgreSQL transactions. No DML, no provider call, and no
 // claim that Medusa's own capture/refund writers honor this lock.
 const {data:otherOrders}=await query.graph({
  entity:"order",fields:["id","payment_collections.id"],
  filters:{id:proof.orderIds[0]},
 })
 assert.equal(otherOrders.length,1)
 assert.equal(otherOrders[0].payment_collections?.length,1)
 const otherCollectionId=otherOrders[0].payment_collections[0].id
 assert.notEqual(otherCollectionId,collectionId)
 const {data:otherCollections}=await query.graph({
  entity:"payment_collection",fields:["id","payments.id"],
  filters:{id:otherCollectionId},
 })
 assert.equal(otherCollections.length,1)
 assert.equal(otherCollections[0].payments?.length,1)
 const independentId=otherCollections[0].payments[0].id
 assert(/^pay_[A-Za-z0-9_-]{8,}$/.test(independentId))
 assert.notEqual(independentId,observed.id)

 // The first connection locks only the authoritative Medusa payment row;
 // a second connection MUST fail NOWAIT with PostgreSQL 55P03. A different
 // payment must remain independently lockable while the first is held.
 const rollbackLabel="SHQIPSHOP_F08_STAGE11U_ROLLBACK_SENTINEL"
 await assert.rejects(()=>db.transaction(async(holding:any)=>{
  const locked=await holding("payment").where({id:observed.id})
   .forUpdate().first()
  assert(locked&&locked.id===observed.id)
  assert.equal(exact(locked.amount),total)
  await assert.rejects(
   ()=>db.transaction(async(contender:any)=>{
    const row=await contender("payment").where({id:observed.id})
     .forUpdate().noWait().first()
    assert(row,"Unexpected missing authoritative payment")
   }),
   (error:any)=>error?.code==="55P03",
   "Competing transaction must not acquire same authoritative payment row"
  )
  console.log("SHQIPSHOP_F08_STAGE11U_SECOND_PG_CONNECTION_LOCK_DENIED")
  await db.transaction(async(unrelated:any)=>{
   const other=await unrelated("payment").where({id:independentId})
    .forUpdate().noWait().first()
   assert(other&&other.id===independentId)
  })
  console.log("SHQIPSHOP_F08_STAGE11U_UNRELATED_PAYMENT_LOCK_ALLOWED")
  // Intentional rollback releases the lock; no amount is ever updated.
  throw new Error(rollbackLabel)
 }),new RegExp(rollbackLabel))
 await db.transaction(async(afterRelease:any)=>{
  const freed=await afterRelease("payment").where({id:observed.id})
   .forUpdate().noWait().first()
  assert(freed&&freed.id===observed.id)
  assert.equal(exact(freed.amount),total)
 })
 console.log("SHQIPSHOP_F08_STAGE11U_PAYMENT_ROW_LOCK_RELEASED_AFTER_ROLLBACK")
 assert.deepEqual(await graph(),observed,
  "Lock-only probe may not change actual Medusa financial records")
 const finalCounts={
  captures:await db("capture").where({payment_id:observed.id}).count("* as n").first(),
  refunds:await db("refund").where({payment_id:observed.id}).count("* as n").first(),
 }
 assert.equal(Number(finalCounts.captures?.n),observed.captures.length)
 assert.equal(Number(finalCounts.refunds?.n),observed.refunds.length)
 console.log("SHQIPSHOP_F08_STAGE11U_REAL_PAYMENT_LOCK_NO_FINANCE_MUTATION")
 console.log("SHQIPSHOP_F08_STAGE11U_POSTGRES_ROW_LOCK_CONTRACT_PASSED")

 // Stage 11V: verify that the INSTALLED Medusa 2.22.0 payment module
 // actually requests the very same PostgreSQL payment-row lock used in 11U.
 // This runs on a disposable runner with the MANUAL provider only.
 // Hold a real row via independent PG connection while invoking an actual
 // native capture/refund writer. Both MUST fail with PostgreSQL lock timeout
 // (55P03), not some unrelated guard, and must leave DB state unchanged.
 const service:any=container.resolve(Modules.PAYMENT)
 const lockError=(value:unknown):boolean=>{
  let cursor:any=value
  for(let depth=0;depth<7 && cursor;depth++){
   if(cursor.code==="55P03" || cursor.sqlState==="55P03")
    return true
   const desc=String(cursor.message??"")
   if(/canceling statement due to lock timeout|could not obtain lock on row/i.test(desc))
    return true
   cursor=cursor.cause??cursor.originalError??cursor.driverError
  }
  return false
 }
 const expectNativeWriterBlocked=async(
  paymentId:string,write:()=>Promise<unknown>,label:string
 )=>{
  await db.transaction(async(holding:any)=>{
   const payment=await holding("payment").where({id:paymentId})
    .forUpdate().first()
   assert(payment&&payment.id===paymentId)
   const since=Date.now()
   await assert.rejects(write,(error:unknown)=>{
    assert(lockError(error),
     label+" must fail on the PostgreSQL payment-row lock, not another error")
    return true
   })
   assert(Date.now()-since>=1800,
    label+" did not wait for the installed module lock timeout")
  })
 }
 // Stage11J uses this separate order AFTER 11V: ensure the capture probe
 // does not change its capture/refund state.
 const beforeCapture=await query.graph({
  entity:"payment",fields:["id","amount","captures.id","refunds.id"],
  filters:{id:independentId},
 })
 assert.equal(beforeCapture.data.length,1)
 assert.equal(beforeCapture.data[0].captures?.length??0,0)
 assert.equal(beforeCapture.data[0].refunds?.length??0,0)
 await expectNativeWriterBlocked(independentId,
  ()=>service.capturePayment({payment_id:independentId,amount:1}),
  "native capturePayment")
 const afterCapture=await query.graph({
  entity:"payment",fields:["id","amount","captures.id","refunds.id"],
  filters:{id:independentId},
 })
 assert.deepEqual(afterCapture.data,beforeCapture.data)
 console.log("SHQIPSHOP_F08_STAGE11V_NATIVE_CAPTURE_WRITER_LOCK_TIMEOUT_NO_MUTATION")
 // Stage11K has already fully refunded the *other* order. A new-key
 // +1 attempt is intentionally locked out before any provider dispatch.
 const beforeRefund=await graph()
 assert.deepEqual(beforeRefund,observed)
 await expectNativeWriterBlocked(observed.id,
  ()=>service.refundPayment({
   payment_id:observed.id,amount:1,
   idempotency_key:"stage11v_locked_"+observed.id,
  }),
  "native refundPayment")
 assert.deepEqual(await graph(),observed)
 console.log("SHQIPSHOP_F08_STAGE11V_NATIVE_REFUND_WRITER_LOCK_TIMEOUT_NO_MUTATION")
 console.log("SHQIPSHOP_F08_STAGE11V_INSTALLED_NATIVE_PAYMENT_WRITER_LOCKS_PASSED")
 // CRITICAL LIMIT: provider calls run AFTER these locks are released.
 // Existing 11I/J/O/P known-red finance amount sentinels remain mandatory.


}
