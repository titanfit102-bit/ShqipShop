/**
 * F08 Stage 11M — runner-local PostgreSQL simulation of a payment provider
 * persisting a refund while the caller discards its acknowledgement.
 *
 * Five medusa exec processes (prepare/dispatch/retry/reconcile/verify) use
 * independent database transactions and a fixed operation key. The provider
 * is ONLY a fake ledger table in disposable PostgreSQL, NOT an actual PSP,
 * Medusa payment module, webhook or production API. All tests fail closed.
 */
import assert from "node:assert/strict"
import type {ExecArgs} from "@medusajs/framework/types"
import {ContainerRegistrationKeys} from "@medusajs/framework/utils"

const BAL="shqipshop_f08_stage11m_ci_balances"
const OPS="shqipshop_f08_stage11m_ci_operations"
const PROVIDER="shqipshop_f08_stage11m_ci_fake_provider"
const tenantA="merchant_ci_a",tenantB="merchant_ci_b"
const payment="payment_ci_refund_ack",key="refund_ci_fixed_key"
const unknownKey="refund_ci_unknown_key"
const scope={tenant_id:tenantA,payment_id:payment}
const amount=70

export default async function recovery({container}:ExecArgs){
 for(const [n,v] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
  SHQIPSHOP_F08_ACK_RECOVERY_CI:"true",WORKER_MODE:"server",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
 }))assert.equal(process.env[n],v,n)
 const phase=process.env.SHQIPSHOP_F08_ACK_RECOVERY_PHASE
 assert(["prepare","dispatch","retry","reconcile","verify","cleanup"].includes(phase??""),
  "Stage 11M requires explicit phase")
 const db:any=container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

 const cleanup=async()=>{
  if(await db.schema.hasTable(PROVIDER))await db.schema.dropTable(PROVIDER)
  if(await db.schema.hasTable(OPS))await db.schema.dropTable(OPS)
  if(await db.schema.hasTable(BAL))await db.schema.dropTable(BAL)
 }
 if(phase==="cleanup"){
  await cleanup()
  console.log("SHQIPSHOP_F08_STAGE11M_DISPOSABLE_TABLES_CLEANED")
  return
 }
 if(phase==="prepare"){
  for(const table of [BAL,OPS,PROVIDER])
   assert.equal(await db.schema.hasTable(table),false,
    "Never overwrite an existing CI/production table")
  await db.schema.createTable(BAL,(t:any)=>{
   t.string("tenant_id",80).notNullable()
   t.string("payment_id",80).notNullable()
   t.string("currency",3).notNullable()
   t.bigInteger("captured_all").notNullable()
   t.bigInteger("reserved_all").notNullable().defaultTo(0)
   t.primary(["tenant_id","payment_id"])
  })
  await db.schema.createTable(OPS,(t:any)=>{
   t.string("tenant_id",80).notNullable()
   t.string("payment_id",80).notNullable()
   t.string("operation_key",100).notNullable()
   t.bigInteger("amount_all").notNullable()
   t.string("status",20).notNullable()
   t.primary(["tenant_id","payment_id","operation_key"])
   t.foreign(["tenant_id","payment_id"]).references(["tenant_id","payment_id"]).inTable(BAL)
  })
  await db.schema.createTable(PROVIDER,(t:any)=>{
   t.string("tenant_id",80).notNullable()
   t.string("payment_id",80).notNullable()
   t.string("operation_key",100).notNullable()
   t.bigInteger("amount_all").notNullable()
   t.string("status",20).notNullable()
   t.string("provider_ref",80).notNullable()
   t.primary(["tenant_id","payment_id","operation_key"])
  })
  await db.raw('ALTER TABLE "'+BAL+'" ADD CONSTRAINT "stage11m_balance_bounds" CHECK ("captured_all">0 AND "reserved_all">=0 AND "reserved_all"<="captured_all")')
  await db.raw('ALTER TABLE "'+OPS+'" ADD CONSTRAINT "stage11m_positive_op" CHECK ("amount_all">0)')
  await db.raw('ALTER TABLE "'+PROVIDER+'" ADD CONSTRAINT "stage11m_positive_mock_effect" CHECK ("amount_all">0)')
  await db(BAL).insert([
   {...scope,currency:"all",captured_all:"100",reserved_all:"0"},
   {tenant_id:tenantB,payment_id:payment,currency:"all",captured_all:"100",reserved_all:"0"},
  ])
  console.log("SHQIPSHOP_F08_STAGE11M_DISPOSABLE_LEDGER_PREPARED")
  return
 }
 for(const table of [BAL,OPS,PROVIDER])
  assert.equal(await db.schema.hasTable(table),true,"Expected prior process fixture")

 // trustedPrincipal is a synthetic server-side fixture, never an HTTP header.
 const reserve=(
  trustedPrincipal:string,targetTenant:string,requestKey:string,
  requested:number
 ):Promise<"new"|"replay">=>db.transaction(async(trx:any)=>{
  if(trustedPrincipal!==targetTenant)throw Error("Foreign tenant principal")
  if(!/^[a-z0-9_]{8,80}$/.test(requestKey))throw Error("Invalid operation key")
  if(!Number.isSafeInteger(requested)||requested<=0)throw Error("Invalid ALL request")
  const s={tenant_id:targetTenant,payment_id:payment}
  const b=await trx(BAL).where(s).forUpdate().first()
  if(!b||b.currency!=="all")throw Error("Unknown currency or payment")
  const prior=await trx(OPS).where({...s,operation_key:requestKey}).first()
  if(prior){
   if(BigInt(prior.amount_all)!==BigInt(requested))
    throw Error("Conflicting replay amount")
   return "replay"
  }
  const captured=BigInt(b.captured_all),already=BigInt(b.reserved_all)
  if(captured<=0n||already<0n||already>captured ||
      already+BigInt(requested)>captured)
   throw Error("Refund reservation exceeds captured balance")
  await trx(BAL).where(s).update({
   reserved_all:(already+BigInt(requested)).toString(),
  })
  await trx(OPS).insert({...s,operation_key:requestKey,
   amount_all:String(requested),status:"pending"})
  return "new"
 })
 const snapshot=async()=>{
  const b=await db(BAL).where(scope).first()
  const ops=await db(OPS).where(scope).orderBy("operation_key")
  const effects=await db(PROVIDER).where(scope).orderBy("operation_key")
  assert(b)
  const sum=ops.reduce((n:bigint,o:any)=>n+BigInt(o.amount_all),0n)
  assert.equal(sum,BigInt(b.reserved_all))
  assert(sum<=BigInt(b.captured_all))
  assert.equal(b.currency,"all")
  return {balance:b,ops,effects}
 }
 const verifyIsolation=async()=>{
  const other=await db(BAL).where({tenant_id:tenantB,payment_id:payment}).first()
  assert(other)
  assert.equal(BigInt(other.reserved_all),0n)
  assert.equal((await db(OPS).where({tenant_id:tenantB,payment_id:payment})).length,0)
  assert.equal((await db(PROVIDER).where({tenant_id:tenantB,payment_id:payment})).length,0)
 }

 if(phase==="dispatch"){
  assert.equal(await reserve(tenantA,tenantA,key,amount),"new")
  // FAKE provider effect is committed in a separate transaction, like a
  // remote processor's irreversible commit. No actual payment is made.
  await db.transaction(async(trx:any)=>{
   const op=await trx(OPS).where({...scope,operation_key:key}).first()
   assert(op&&op.status==="pending")
   await trx(PROVIDER).insert({...scope,operation_key:key,
    amount_all:String(amount),status:"succeeded",
    provider_ref:"fake_provider_ref_ci_one"})
  })
  const s=await snapshot()
  assert.equal(BigInt(s.balance.reserved_all),70n)
  assert.equal(s.ops.length,1)
  assert.equal(s.ops[0].status,"pending",
   "Local operation MUST remain unacknowledged after provider effect")
  assert.equal(s.effects.length,1)
  assert.equal(s.effects[0].status,"succeeded")
  await verifyIsolation()
  // End this medusa exec process without local acknowledgement. A distinct
  // later exec process must recover the durable state without resending.
  console.log("SHQIPSHOP_F08_STAGE11M_PROVIDER_EFFECT_COMMITTED_ACK_DISCARDED")
  return
 }

 if(phase==="retry"){
  const before=await snapshot()
  assert.equal(before.ops[0]?.status,"pending")
  assert.equal(before.effects.length,1)
  assert.equal(await reserve(tenantA,tenantA,key,amount),"replay")
  await assert.rejects(()=>reserve(tenantA,tenantA,key,amount+1))
  await assert.rejects(()=>reserve(tenantB,tenantA,"foreign_refund",1))
  await assert.rejects(()=>reserve(tenantA,tenantA,"invalid_one",0))
  await assert.rejects(()=>reserve(tenantA,tenantA,"over_remaining",31))
  assert.equal(await reserve(tenantA,tenantA,unknownKey,30),"new")
  assert.equal(await reserve(tenantA,tenantA,unknownKey,30),"replay")
  await assert.rejects(()=>reserve(tenantA,tenantA,"after_reserved",1))
  const s=await snapshot()
  assert.equal(BigInt(s.balance.reserved_all),100n)
  assert.equal(s.ops.length,2)
  assert(s.ops.every((o:any)=>o.status==="pending"))
  assert.equal(s.effects.length,1,
   "Retry MUST NOT reissue the already effected provider request")
  assert.equal(s.effects[0].operation_key,key)
  await verifyIsolation()
  console.log("SHQIPSHOP_F08_STAGE11M_NEW_PROCESS_SAME_KEY_NO_RESEND")
  console.log("SHQIPSHOP_F08_STAGE11M_UNKNOWN_PROVIDER_OUTCOME_BALANCE_RESERVED")
  return
 }

 const reconcile=async(targetKey:string)=>{
  return db.transaction(async(trx:any)=>{
   const bal=await trx(BAL).where(scope).forUpdate().first()
   assert(bal)
   const op=await trx(OPS).where({...scope,operation_key:targetKey}).first()
   assert(op)
   if(op.status==="succeeded")return "already_confirmed"
   assert.equal(op.status,"pending")
   // This is a FAKE provider lookup. Real integrations must use authenticated
   // merchant-scoped PSP API with provider transaction verification.
   const provider=await trx(PROVIDER)
    .where({...scope,operation_key:targetKey}).first()
   if(!provider)return "unknown"
   if(provider.status!=="succeeded"||
      BigInt(provider.amount_all)!==BigInt(op.amount_all)||
      provider.provider_ref!=="fake_provider_ref_ci_one")
    throw Error("Provider reconciliation mismatch")
   const rows=await trx(OPS).where({...scope,operation_key:targetKey,status:"pending"})
    .update({status:"succeeded"}).returning("operation_key")
   assert.equal(rows.length,1)
   return "confirmed"
  })
 }
 if(phase==="reconcile"){
  const noEffect=await reconcile(unknownKey)
  assert.equal(noEffect,"unknown","UNKNOWN PSP state must not be called success")
  const both=await Promise.all([reconcile(key),reconcile(key)])
  assert.deepEqual(both.slice().sort(),["already_confirmed","confirmed"])
  assert.equal(await reconcile(key),"already_confirmed")
  assert.equal(await reconcile(unknownKey),"unknown")
  const s=await snapshot()
  assert.equal(BigInt(s.balance.reserved_all),100n)
  assert.equal(s.ops.find((o:any)=>o.operation_key===key)?.status,"succeeded")
  assert.equal(s.ops.find((o:any)=>o.operation_key===unknownKey)?.status,"pending")
  assert.equal(s.effects.length,1)
  assert.equal(s.effects[0].provider_ref,"fake_provider_ref_ci_one")
  await assert.rejects(()=>reserve(tenantA,tenantA,"after_reconcile",1))
  await verifyIsolation()
  console.log("SHQIPSHOP_F08_STAGE11M_TWO_RECONCILERS_CONFIRM_ONCE")
  console.log("SHQIPSHOP_F08_STAGE11M_UNKNOWN_STAYS_PENDING_NO_RELEASE")
  return
 }
 assert.equal(phase,"verify")
 const s=await snapshot()
 assert.equal(BigInt(s.balance.captured_all),100n)
 assert.equal(BigInt(s.balance.reserved_all),100n)
 assert.equal(s.ops.length,2)
 assert.equal(s.ops.find((o:any)=>o.operation_key===key)?.status,"succeeded")
 assert.equal(s.ops.find((o:any)=>o.operation_key===unknownKey)?.status,"pending")
 assert.equal(s.effects.length,1)
 assert.equal(BigInt(s.effects[0].amount_all),70n)
 await verifyIsolation()
 console.log("SHQIPSHOP_F08_STAGE11M_PERSISTED_CROSS_PROCESS_RECONCILIATION_PASSED")
}
