/**
 * F08 Stage 11N — disposable PostgreSQL refund RBAC/transactional outbox.
 *
 * This is a design/proof CONTRACT ONLY. Synthetic staff records are NOT
 * Medusa-authenticated Admin sessions; trusted subject and deployment tenant
 * are fixture inputs, NOT proof of validated JWT/RBAC or production tenancy.
 * No actual provider is called and no production schema/route is changed.
 * Keep existing Stage 11I/J failing regression tests enabled and red.
 */
import assert from "node:assert/strict"
import type {ExecArgs} from "@medusajs/framework/types"
import {ContainerRegistrationKeys} from "@medusajs/framework/utils"

const BAL="shqipshop_f08_stage11n_ci_balances"
const OPS="shqipshop_f08_stage11n_ci_operations"
const OUT="shqipshop_f08_stage11n_ci_outbox"
const STAFF="shqipshop_f08_stage11n_ci_staff"
const tenantA="merchant_ci_a",tenantB="merchant_ci_b"
const pA="payment_ci_auth",pRace="payment_ci_race"
const scope=(tenant:string,payment:string)=>({tenant_id:tenant,payment_id:payment})
const trustedA={subject:"staff_a_finance",deploymentTenant:tenantA}
const trustedB={subject:"staff_b_finance",deploymentTenant:tenantB}

export default async function proof({container}:ExecArgs){
 for(const [n,v] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
  SHQIPSHOP_F08_AUTH_OUTBOX_CI:"true",WORKER_MODE:"server",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
 }))assert.equal(process.env[n],v,n)
 const db:any=container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
 for(const name of [BAL,OPS,OUT,STAFF])
  assert.equal(await db.schema.hasTable(name),false,
   "Refuse to overwrite a pre-existing table in CI")
 await db.schema.createTable(BAL,(t:any)=>{
  t.string("tenant_id",80).notNullable()
  t.string("payment_id",80).notNullable()
  t.string("currency",3).notNullable()
  t.bigInteger("captured_all").notNullable()
  t.bigInteger("reserved_all").notNullable().defaultTo(0)
  t.primary(["tenant_id","payment_id"])
 })
 try{
  await db.schema.createTable(STAFF,(t:any)=>{
   t.string("subject",80).primary()
   t.string("tenant_id",80).notNullable()
   t.string("role",30).notNullable()
   t.boolean("active").notNullable()
  })
  await db.schema.createTable(OPS,(t:any)=>{
   t.string("tenant_id",80).notNullable()
   t.string("payment_id",80).notNullable()
   t.string("operation_key",100).notNullable()
   t.string("actor_subject",80).notNullable()
   t.bigInteger("amount_all").notNullable()
   t.string("status",25).notNullable()
   t.string("provider_ref",80).nullable()
   t.primary(["tenant_id","payment_id","operation_key"])
   t.foreign(["tenant_id","payment_id"]).references(["tenant_id","payment_id"]).inTable(BAL)
  })
  await db.schema.createTable(OUT,(t:any)=>{
   t.string("tenant_id",80).notNullable()
   t.string("payment_id",80).notNullable()
   t.string("operation_key",100).notNullable()
   t.bigInteger("amount_all").notNullable()
   t.string("status",25).notNullable()
   t.primary(["tenant_id","payment_id","operation_key"])
   t.foreign(["tenant_id","payment_id","operation_key"])
    .references(["tenant_id","payment_id","operation_key"]).inTable(OPS)
  })
  await db.raw('ALTER TABLE "'+BAL+'" ADD CONSTRAINT "stage11n_balance_invariant" CHECK ("captured_all">0 AND "reserved_all">=0 AND "reserved_all"<="captured_all")')
  await db.raw('ALTER TABLE "'+OPS+'" ADD CONSTRAINT "stage11n_operation_amount" CHECK ("amount_all">0)')
  await db(BAL).insert([
   {...scope(tenantA,pA),currency:"all",captured_all:"100",reserved_all:"0"},
   {...scope(tenantA,pRace),currency:"all",captured_all:"100",reserved_all:"0"},
   {...scope(tenantB,pA),currency:"all",captured_all:"100",reserved_all:"0"},
  ])
  await db(STAFF).insert([
   {subject:trustedA.subject,tenant_id:tenantA,role:"finance_admin",active:true},
   {subject:trustedB.subject,tenant_id:tenantB,role:"finance_admin",active:true},
   {subject:"staff_a_viewer",tenant_id:tenantA,role:"viewer",active:true},
   {subject:"staff_a_restricted",tenant_id:tenantA,role:"finance_admin",active:false},
   {subject:"staff_a_support",tenant_id:tenantA,role:"support",active:true},
  ])
  type Principal={subject:string,deploymentTenant:string}
  const request=async(
   principal:Principal,targetTenant:string,payment:string,
   key:string,amount:number,injectRollback=false
  ):Promise<"new"|"replay">=>db.transaction(async(trx:any)=>{
   // The subject and deploymentTenant are trusted *only within this fixture*.
   // Real auth must derive these from validated Medusa Admin identity and
   // backend-specific deployment config, never from JSON/headers or API keys.
   if(principal.deploymentTenant!==targetTenant)
    throw Error("Cross-merchant scope")
   const actor=await trx(STAFF).where({
    subject:principal.subject,tenant_id:principal.deploymentTenant,
   }).first()
   if(!actor||actor.active!==true||actor.role!=="finance_admin")
    throw Error("Finance permission missing")
   if(!/^[a-z0-9_]{8,90}$/.test(key)||
      !Number.isSafeInteger(amount)||amount<=0)
    throw Error("Invalid key or ALL amount")
   const s=scope(principal.deploymentTenant,payment)
   const balance=await trx(BAL).where(s).forUpdate().first()
   if(!balance||balance.currency!=="all")throw Error("No permitted ALL payment")
   const prior=await trx(OPS).where({...s,operation_key:key}).first()
   if(prior){
    if(prior.actor_subject!==principal.subject||
       BigInt(prior.amount_all)!==BigInt(amount))
     throw Error("Idempotency key conflicts with actor or amount")
    return "replay"
   }
   const captured=BigInt(balance.captured_all)
   const reserved=BigInt(balance.reserved_all)
   const next=reserved+BigInt(amount)
   if(captured<=0n||reserved<0n||reserved>captured||next>captured)
    throw Error("Strict whole-ALL available amount exceeded")
   await trx(BAL).where(s).update({reserved_all:next.toString()})
   await trx(OPS).insert({...s,operation_key:key,
    actor_subject:principal.subject,amount_all:String(amount),status:"pending"})
   await trx(OUT).insert({...s,operation_key:key,
    amount_all:String(amount),status:"ready"})
   if(injectRollback)throw Error("Simulated atomic write failure")
   return "new"
  })
  const ledger=async(tenant:string,payment:string)=>{
   const s=scope(tenant,payment)
   const balance=await db(BAL).where(s).first()
   assert(balance)
   const operations=await db(OPS).where(s).orderBy("operation_key")
   const outbox=await db(OUT).where(s).orderBy("operation_key")
   const reserved=operations.reduce((a:bigint,o:any)=>a+BigInt(o.amount_all),0n)
   assert.equal(reserved,BigInt(balance.reserved_all))
   assert(reserved<=BigInt(balance.captured_all))
   assert.equal(operations.length,outbox.length)
   assert.deepEqual(operations.map((o:any)=>o.operation_key),
    outbox.map((o:any)=>o.operation_key))
   return {reserved,operations,outbox}
  }
  const validKey="refund_valid_one"
  const remainingKey="refund_valid_two"

  await assert.rejects(()=>request(
   {subject:"staff_a_viewer",deploymentTenant:tenantA},tenantA,pA,"viewer_req",1))
  await assert.rejects(()=>request(
   {subject:"staff_a_restricted",deploymentTenant:tenantA},tenantA,pA,"disabled_req",1))
  await assert.rejects(()=>request(
   {subject:"staff_a_support",deploymentTenant:tenantA},tenantA,pA,"support_req",1))
  await assert.rejects(()=>request(
   {subject:"missing_subject",deploymentTenant:tenantA},tenantA,pA,"missing_actor",1))
  await assert.rejects(()=>request(trustedB,tenantA,pA,"foreign_tenant",1))
  await assert.rejects(()=>request(trustedA,tenantB,pA,"foreign_target",1))
  await assert.rejects(()=>request(
   {subject:trustedB.subject,deploymentTenant:tenantA},tenantA,pA,"forged_actor",1))
  await assert.rejects(()=>request(trustedA,tenantA,"unknown_pay","unknown_pay",1))
  await assert.rejects(()=>request(trustedA,tenantA,pA,"invalid_amount",0))
  await assert.rejects(()=>request(trustedA,tenantA,pA,"invalid_amount",1.5))
  assert.equal((await ledger(tenantA,pA)).reserved,0n)
  assert.equal((await ledger(tenantB,pA)).reserved,0n)
  console.log("SHQIPSHOP_F08_STAGE11N_SCOPED_FINANCE_PERMISSION_DENIALS")

  assert.equal(await request(trustedA,tenantA,pA,validKey,60),"new")
  assert.equal(await request(trustedA,tenantA,pA,validKey,60),"replay")
  await assert.rejects(()=>request(trustedA,tenantA,pA,validKey,61))
  assert.equal((await ledger(tenantA,pA)).reserved,60n)
  assert.equal((await ledger(tenantA,pA)).outbox.length,1)
  await assert.rejects(()=>request(trustedA,tenantA,pA,"refund_too_large",41))
  assert.equal((await ledger(tenantA,pA)).outbox.length,1)
  console.log("SHQIPSHOP_F08_STAGE11N_ATOMIC_OUTBOX_AND_REPLAY_SAFE")

  await assert.rejects(()=>request(trustedA,tenantA,pA,"refund_rollback",20,true))
  assert.equal((await ledger(tenantA,pA)).reserved,60n)
  assert.equal((await ledger(tenantA,pA)).outbox.length,1)
  assert.equal(await request(trustedA,tenantA,pA,remainingKey,40),"new")
  assert.equal((await ledger(tenantA,pA)).reserved,100n)
  await assert.rejects(()=>request(trustedA,tenantA,pA,"refund_after_full",1))
  console.log("SHQIPSHOP_F08_STAGE11N_TRANSACTION_ROLLBACK_NO_ORPHAN_OUTBOX")

  const parallel=await Promise.allSettled([
   request(trustedA,tenantA,pRace,"refund_parallel_a",60),
   request(trustedA,tenantA,pRace,"refund_parallel_b",60),
  ])
  assert.equal(parallel.filter(r=>r.status==="fulfilled").length,1)
  assert.equal(parallel.filter(r=>r.status==="rejected").length,1)
  assert.equal((await ledger(tenantA,pRace)).reserved,60n)
  assert.equal((await ledger(tenantA,pRace)).outbox.length,1)
  console.log("SHQIPSHOP_F08_STAGE11N_PARALLEL_REFUNDS_AT_MOST_ONE_OUTBOX")

  // Workers may select a queued operation once. After dispatch is marked
  // unknown, automatic resend is forbidden until provider reconciliation.
  const lease=async()=>{
   return db.transaction(async(trx:any)=>{
    const row=await trx(OUT).where({...scope(tenantA,pA),
     operation_key:validKey,status:"ready"}).forUpdate().skipLocked().first()
    if(!row)return null
    const changed=await trx(OUT).where({...scope(tenantA,pA),
     operation_key:validKey,status:"ready"})
     .update({status:"awaiting_provider"}).returning("operation_key")
    assert.equal(changed.length,1)
    return row.operation_key
   })
  }
  const leases=await Promise.all([lease(),lease()])
  assert.equal(leases.filter(x=>x===validKey).length,1)
  assert.equal(leases.filter(x=>x===null).length,1)
  assert.equal(await lease(),null,"No second dispatch after unknown result")
  const pending=await ledger(tenantA,pA)
  assert.equal(pending.operations.find((x:any)=>x.operation_key===validKey)?.status,
   "pending","Provider unknown must not imply local success")
  assert.equal(pending.outbox.find((x:any)=>x.operation_key===validKey)?.status,
   "awaiting_provider")
  assert.equal(pending.reserved,100n,"No capacity released on missing ACK")
  console.log("SHQIPSHOP_F08_STAGE11N_UNKNOWN_PROVIDER_RESULT_NO_AUTO_RESEND")

  // Synthetic trusted provider confirmation: this boolean is NOT a signature.
  // Actual adapter must check remote provider transaction/ref/account/amount,
  // webhook signatures and merchant credentials before this transition.
  const confirm=async(args:{
   trustedProvider:boolean,tenant:string,payment:string,
   key:string,amount:number,providerRef:string
  })=>db.transaction(async(trx:any)=>{
   if(!args.trustedProvider||args.tenant!==tenantA||args.payment!==pA)
    throw Error("Unverified provider/merchant event")
   const s=scope(args.tenant,args.payment)
   const balance=await trx(BAL).where(s).forUpdate().first()
   assert(balance)
   const op=await trx(OPS).where({...s,operation_key:args.key}).first()
   const out=await trx(OUT).where({...s,operation_key:args.key}).first()
   if(!op||!out||BigInt(op.amount_all)!==BigInt(args.amount)||
      out.status!=="awaiting_provider"&&out.status!=="confirmed"||
      !/^fake_ref_[a-z0-9_]{6,60}$/.test(args.providerRef))
    throw Error("Unmatched or untrusted PSP outcome")
   if(op.status==="succeeded"){
    if(op.provider_ref!==args.providerRef||out.status!=="confirmed")
     throw Error("Conflicting successful provider replay")
    return "duplicate"
   }
   if(op.status!=="pending"||out.status!=="awaiting_provider")
    throw Error("Unexpected unresolved state")
   await trx(OPS).where({...s,operation_key:args.key})
    .update({status:"succeeded",provider_ref:args.providerRef})
   await trx(OUT).where({...s,operation_key:args.key})
    .update({status:"confirmed"})
   return "confirmed"
  })
  const event={trustedProvider:true,tenant:tenantA,payment:pA,key:validKey,
   amount:60,providerRef:"fake_ref_ci_expected"}
  await assert.rejects(()=>confirm({...event,trustedProvider:false}))
  await assert.rejects(()=>confirm({...event,amount:61}))
  await assert.rejects(()=>confirm({...event,tenant:tenantB}))
  assert.equal(await confirm(event),"confirmed")
  assert.equal(await confirm(event),"duplicate")
  await assert.rejects(()=>confirm({...event,providerRef:"fake_ref_ci_changed"}))
  const final=await ledger(tenantA,pA)
  assert.equal(final.operations.find((o:any)=>o.operation_key===validKey)?.status,"succeeded")
  assert.equal(final.outbox.find((o:any)=>o.operation_key===validKey)?.status,"confirmed")
  assert.equal(final.operations.find((o:any)=>o.operation_key===remainingKey)?.status,"pending")
  assert.equal(final.outbox.find((o:any)=>o.operation_key===remainingKey)?.status,"ready")
  assert.equal(final.reserved,100n)
  console.log("SHQIPSHOP_F08_STAGE11N_STRICT_MOCK_PROVIDER_RECONCILIATION")

  assert.equal(await request(trustedB,tenantB,pA,"refund_merchant_b",100),"new")
  assert.equal((await ledger(tenantB,pA)).reserved,100n)
  assert.equal((await ledger(tenantA,pA)).reserved,100n)
  console.log("SHQIPSHOP_F08_STAGE11N_MERCHANT_ISOLATION_PRESERVED")
  console.log("SHQIPSHOP_F08_STAGE11N_DISPOSABLE_AUTH_OUTBOX_PROOF_PASSED")
 }finally{
  for(const table of [OUT,OPS,STAFF,BAL])
   if(await db.schema.hasTable(table))await db.schema.dropTable(table)
 }
}
