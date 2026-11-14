/**
 * F08 Stage 11L: DISPOSABLE PostgreSQL two-connection refund reservation race.
 *
 * Proves only the database reservation/operation-key mechanism, NOT Medusa
 * refunds, checkout, authenticated Admin, a real PSP, side-effect delivery
 * or production-grade transactional reconciliation. Separate existing
 * Stage 11I/11J failing regressions must never be bypassed.
 */
import assert from "node:assert/strict"
import type {ExecArgs} from "@medusajs/framework/types"
import {ContainerRegistrationKeys} from "@medusajs/framework/utils"

const BAL="shqipshop_f08_stage11l_ci_balances"
const OPS="shqipshop_f08_stage11l_ci_operations"
const tenantA="merchant_ci_a"
const tenantB="merchant_ci_b"
const paymentA="payment_ci_shared"
const paymentRace="payment_ci_race"

export default async function proveAtomicReservation({container}:ExecArgs){
 for(const [name,value] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
  SHQIPSHOP_F08_RESERVATION_RACE_CI:"true",WORKER_MODE:"server",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
 }))assert.equal(process.env[name],value,name)
 const db:any=container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
 assert.equal(await db.schema.hasTable(BAL),false,"Stage 11L CI balance table must not exist")
 assert.equal(await db.schema.hasTable(OPS),false,"Stage 11L CI operation table must not exist")
 await db.schema.createTable(BAL,(t:any)=>{
  t.string("tenant_id",80).notNullable()
  t.string("payment_id",80).notNullable()
  t.string("currency",3).notNullable()
  t.bigInteger("captured_all").notNullable()
  t.bigInteger("reserved_all").notNullable().defaultTo(0)
  t.primary(["tenant_id","payment_id"])
 })
 try{
  await db.schema.createTable(OPS,(t:any)=>{
   t.string("tenant_id",80).notNullable()
   t.string("payment_id",80).notNullable()
   t.string("operation_key",100).notNullable()
   t.bigInteger("amount_all").notNullable()
   t.string("status",16).notNullable()
   t.primary(["tenant_id","payment_id","operation_key"])
   t.foreign(["tenant_id","payment_id"]).references(["tenant_id","payment_id"]).inTable(BAL)
  })
  await db.raw('ALTER TABLE "'+BAL+'" ADD CONSTRAINT "f08_11l_balance_valid" CHECK ("captured_all">0 AND "reserved_all">=0 AND "reserved_all"<="captured_all")')
  await db.raw('ALTER TABLE "'+OPS+'" ADD CONSTRAINT "f08_11l_op_amount_valid" CHECK ("amount_all">0)')
  await db(BAL).insert([
   {tenant_id:tenantA,payment_id:paymentA,currency:"all",captured_all:"100",reserved_all:"0"},
   {tenant_id:tenantA,payment_id:paymentRace,currency:"all",captured_all:"100",reserved_all:"0"},
   {tenant_id:tenantB,payment_id:paymentA,currency:"all",captured_all:"100",reserved_all:"0"},
  ])

  const claimInTransaction=async(
   trx:any,verifiedTenant:string,targetTenant:string,payment:string,
   key:string,requested:number
  ):Promise<"new"|"replay">=>{
   // verifiedTenant is a synthetic trusted test principal, NOT an HTTP header.
   if(verifiedTenant!==targetTenant)throw Error("Cross-tenant refund request")
   if(!/^[a-z0-9_]{6,80}$/.test(key))throw Error("Invalid operation key")
   if(!Number.isSafeInteger(requested)||requested<=0)throw Error("Invalid ALL amount")
   const scope={tenant_id:targetTenant,payment_id:payment}
   const balance=await trx(BAL).where(scope).forUpdate().first()
   if(!balance)throw Error("Unknown tenant payment")
   if(balance.currency!=="all")throw Error("Unexpected currency")
   const existing=await trx(OPS).where({...scope,operation_key:key}).first()
   if(existing){
    if(BigInt(existing.amount_all)!==BigInt(requested))
     throw Error("Conflicting operation amount")
    // A replay is read-only: downstream provider MUST NOT be called twice.
    return "replay"
   }
   const captured=BigInt(balance.captured_all)
   const reserved=BigInt(balance.reserved_all)
   if(captured<=0n||reserved<0n||reserved>captured)
    throw Error("Invalid capture/reservation ledger")
   const next=reserved+BigInt(requested)
   if(next>captured)throw Error("Insufficient unreserved refund balance")
   await trx(BAL).where(scope).update({reserved_all:next.toString()})
   await trx(OPS).insert({...scope,operation_key:key,
    amount_all:String(requested),status:"reserved"})
   return "new"
  }
  const reserve=(
   verifiedTenant:string,targetTenant:string,payment:string,
   key:string,amount:number
  ):Promise<"new"|"replay">=>db.transaction((trx:any)=>
   claimInTransaction(trx,verifiedTenant,targetTenant,payment,key,amount))

  const state=async(tenant:string,payment:string)=>{
   const scope={tenant_id:tenant,payment_id:payment}
   const balance=await db(BAL).where(scope).first()
   assert(balance)
   const ops=await db(OPS).where(scope).orderBy("operation_key")
   const sum=ops.reduce((acc:bigint,row:any)=>acc+BigInt(row.amount_all),0n)
   assert.equal(sum,BigInt(balance.reserved_all),"Ledger claim/balance totals diverged")
   assert(sum<=BigInt(balance.captured_all))
   assert(ops.every((r:any)=>r.status==="reserved"))
   return {total:BigInt(balance.captured_all),reserved:sum,
    keys:ops.map((o:any)=>o.operation_key)}
  }
  await assert.rejects(()=>reserve(tenantB,tenantA,paymentA,"foreign_try",1))
  await assert.rejects(()=>reserve(tenantA,tenantA,"not_a_payment","unknown_key",1))
  await assert.rejects(()=>reserve(tenantA,tenantA,paymentA,"bad_amount",1.5))
  assert.equal((await state(tenantA,paymentA)).reserved,0n)
  assert.equal((await state(tenantB,paymentA)).reserved,0n)
  console.log("SHQIPSHOP_F08_STAGE11L_TENANT_AND_INVALID_REQUESTS_DENIED")

  // Two separate PG sessions. Tx1 holds a real PostgreSQL row lock;
  // Tx2 must not obtain it with NOWAIT, proving the conflict is DB-backed.
  const tx1=await db.transaction()
  const tx2=await db.transaction()
  try{
   const pid1=Number((await tx1.raw("SELECT pg_backend_pid() AS pid")).rows[0].pid)
   const pid2=Number((await tx2.raw("SELECT pg_backend_pid() AS pid")).rows[0].pid)
   assert(Number.isInteger(pid1)&&Number.isInteger(pid2)&&pid1!==pid2)
   const locked=await tx1(BAL).where({tenant_id:tenantA,payment_id:paymentA})
    .forUpdate().first()
   assert(locked)
   await assert.rejects(
    ()=>tx2.raw('SELECT 1 FROM "'+BAL+'" WHERE tenant_id=? AND payment_id=? FOR UPDATE NOWAIT',
     [tenantA,paymentA]),
    (e:any)=>e?.code==="55P03","Contender must not bypass row lock")
   await tx2.rollback()
   const outcome=await claimInTransaction(
    tx1,tenantA,tenantA,paymentA,"lock_owner",70)
   assert.equal(outcome,"new")
   await tx1.commit()
  }finally{
   if(!tx1.isCompleted())await tx1.rollback()
   if(!tx2.isCompleted())await tx2.rollback()
  }
  assert.equal((await state(tenantA,paymentA)).reserved,70n)
  await assert.rejects(()=>reserve(tenantA,tenantA,paymentA,"contender",40))
  assert.equal((await state(tenantA,paymentA)).reserved,70n)
  console.log("SHQIPSHOP_F08_STAGE11L_TWO_PG_SESSIONS_ROW_LOCK_AND_OVER_CAP_DENIAL")

  assert.equal(await reserve(tenantA,tenantA,paymentA,"lock_owner",70),"replay")
  await assert.rejects(()=>reserve(tenantA,tenantA,paymentA,"lock_owner",71))
  assert.deepEqual((await state(tenantA,paymentA)).keys,["lock_owner"])
  console.log("SHQIPSHOP_F08_STAGE11L_OPERATION_KEY_REPLAY_AND_CONFLICT_VERIFIED")

  // Failure after DB mutation must roll back both reservation and key.
  await assert.rejects(()=>db.transaction(async(trx:any)=>{
   await claimInTransaction(trx,tenantA,tenantA,paymentA,"fault_rollback",20)
   throw Error("Synthetic crash before transaction commit")
  }))
  assert.equal((await state(tenantA,paymentA)).reserved,70n)
  assert.equal(await reserve(tenantA,tenantA,paymentA,"remainder",30),"new")
  assert.equal((await state(tenantA,paymentA)).reserved,100n)
  await assert.rejects(()=>reserve(tenantA,tenantA,paymentA,"over_full",1))
  console.log("SHQIPSHOP_F08_STAGE11L_ATOMIC_ROLLBACK_AND_FULL_RESERVATION")

  // Actual overlapping promises on another payment. At most one distinct
  // 60 ALL operation can consume the shared 100 ALL balance.
  const results=await Promise.allSettled([
   reserve(tenantA,tenantA,paymentRace,"parallel_one",60),
   reserve(tenantA,tenantA,paymentRace,"parallel_two",60),
  ])
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1)
  assert.equal(results.filter(r=>r.status==="rejected").length,1)
  assert.equal((await state(tenantA,paymentRace)).reserved,60n)
  assert.equal((await state(tenantA,paymentRace)).keys.length,1)
  assert.equal(await reserve(tenantB,tenantB,paymentA,"own_merchant",100),"new")
  assert.equal((await state(tenantB,paymentA)).reserved,100n)
  assert.equal((await state(tenantA,paymentA)).reserved,100n)
  console.log("SHQIPSHOP_F08_STAGE11L_PARALLEL_RESERVATIONS_AT_MOST_ONE_ACCEPTED")
  console.log("SHQIPSHOP_F08_STAGE11L_ISOLATED_MERCHANT_BALANCE_PRESERVED")
  console.log("SHQIPSHOP_F08_STAGE11L_DISPOSABLE_PG_RESERVATION_PROOF_PASSED")
 }finally{
  if(await db.schema.hasTable(OPS))await db.schema.dropTable(OPS)
  if(await db.schema.hasTable(BAL))await db.schema.dropTable(BAL)
 }
}
