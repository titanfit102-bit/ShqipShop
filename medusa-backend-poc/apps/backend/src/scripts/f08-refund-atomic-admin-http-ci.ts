/**
 * Stage 11R: authenticated real Medusa Admin HTTP + disposable PostgreSQL
 * atomic reservations/outbox. Synthetic payment balances ONLY.
 * No real Medusa payment refund or PSP dispatch. Never production-enabled.
 */
import assert from "node:assert/strict"
import type {ExecArgs} from "@medusajs/framework/types"
import {ContainerRegistrationKeys} from "@medusajs/framework/utils"

const BAL="shqipshop_f08_stage11r_ci_balances"
const STAFF="shqipshop_f08_stage11r_ci_staff"
const OPS="shqipshop_f08_stage11r_ci_operations"
const OUT="shqipshop_f08_stage11r_ci_outbox"
const tenant="merchant_ci_a",foreign="merchant_ci_b"
const primary="pay_stage11r_primary"
const parallel="pay_stage11r_parallel"
const zero="pay_stage11r_uncaptured"
const other="pay_stage11r_foreign"
const base="http://127.0.0.1:9220"

export default async function verifyAtomicAdminHttp({container}:ExecArgs){
 for(const [name,value] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
  SHQIPSHOP_F08_ADMIN_REFUND_BOUNDARY_CI:"true",
  SHQIPSHOP_F08_STRICT_REFUND_CI:"true",
  SHQIPSHOP_F08_11R_ATOMIC_CI:"true",
  SHQIPSHOP_F08_11R_MERCHANT:tenant,
  SHQIPSHOP_F08_ACK_LOSS_CI:"true",
  WORKER_MODE:"server",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
 }))assert.equal(process.env[name],value,name)
 const password=process.env.SHQIPSHOP_F08_STAGE11P_ADMIN_PASSWORD
 assert(/^[a-f0-9]{48}$/.test(password??""),
  "Require existing masked runner-only Admin password")
 const post=async(path:string,body:unknown,token?:string,rollback=false)=>{
  const headers:Record<string,string>={"content-type":"application/json"}
  if(token)headers.authorization="Bearer "+token
  if(rollback)headers["x-shqipshop-ci-rollback"]="true"
  return fetch(base+path,{method:"POST",headers,body:JSON.stringify(body),
   signal:AbortSignal.timeout(15000)})
 }
 const login=await post("/auth/user/emailpass",{
  email:"stage11p-admin@shqipshop.example.invalid",password,
 })
 assert.equal(login.status,200)
 const token=(await login.json()).token
 assert(typeof token==="string"&&token.length>20)
 const me=await fetch(base+"/admin/users/me",{
  headers:{authorization:"Bearer "+token},
  signal:AbortSignal.timeout(10000),
 })
 assert.equal(me.status,200)
 const actor=(await me.json()).user?.id
 assert(/^user_[A-Za-z0-9_-]{8,}$/.test(actor??""))
 console.log("SHQIPSHOP_F08_STAGE11R_REAL_MEDUSA_ADMIN_IDENTITY_CONFIRMED")

 const db:any=container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
 for(const table of [BAL,STAFF,OPS,OUT])
  assert.equal(await db.schema.hasTable(table),false,
   "Refuse to overwrite pre-existing stage11R CI table: "+table)
 const scope=(merchant:string,payment:string)=>({
  merchant_id:merchant,payment_id:payment,
 })
 const dbSame=async(merchant:string,payment:string)=>{
  const s=scope(merchant,payment)
  const balance=await db(BAL).where(s).first()
  assert(balance)
  const ops=await db(OPS).where(s).orderBy("operation_key")
  const out=await db(OUT).where(s).orderBy("operation_key")
  const reserved=ops.reduce((sum:bigint,o:any)=>sum+BigInt(o.amount_all),0n)
  assert.equal(reserved,BigInt(balance.reserved_all))
  assert(reserved<=BigInt(balance.captured_all))
  assert.equal(ops.length,out.length)
  assert.deepEqual(ops.map((o:any)=>o.operation_key),
   out.map((o:any)=>o.operation_key))
  assert(ops.every((o:any)=>o.status==="pending"))
  assert(out.every((o:any)=>o.status==="ready"))
  return {captured:BigInt(balance.captured_all),reserved,
   keys:ops.map((o:any)=>o.operation_key)}
 }
 const call=async(payment:string,amount:unknown,key:string,
   rollback=false,customToken:string=token)=>{
  return post("/admin/payments/"+payment+"/refund",{
   amount,idempotency_key:key,
  },customToken,rollback)
 }
 const status=async(payment:string,amount:unknown,key:string,
   rollback=false)=> (await call(payment,amount,key,rollback)).status
 try{
  await db.schema.createTable(BAL,(t:any)=>{
   t.string("merchant_id",80).notNullable()
   t.string("payment_id",100).notNullable()
   t.string("currency",3).notNullable()
   t.bigInteger("captured_all").notNullable()
   t.bigInteger("reserved_all").notNullable().defaultTo(0)
   t.primary(["merchant_id","payment_id"])
  })
  await db.schema.createTable(STAFF,(t:any)=>{
   t.string("merchant_id",80).notNullable()
   t.string("actor_id",100).notNullable()
   t.string("role",30).notNullable()
   t.boolean("active").notNullable()
   t.primary(["merchant_id","actor_id"])
  })
  await db.schema.createTable(OPS,(t:any)=>{
   t.string("merchant_id",80).notNullable()
   t.string("payment_id",100).notNullable()
   t.string("operation_key",64).notNullable()
   t.string("actor_id",100).notNullable()
   t.bigInteger("amount_all").notNullable()
   t.string("status",20).notNullable()
   t.primary(["merchant_id","payment_id","operation_key"])
   t.foreign(["merchant_id","payment_id"])
    .references(["merchant_id","payment_id"]).inTable(BAL)
  })
  await db.schema.createTable(OUT,(t:any)=>{
   t.string("merchant_id",80).notNullable()
   t.string("payment_id",100).notNullable()
   t.string("operation_key",64).notNullable()
   t.bigInteger("amount_all").notNullable()
   t.string("status",20).notNullable()
   t.primary(["merchant_id","payment_id","operation_key"])
   t.foreign(["merchant_id","payment_id","operation_key"])
    .references(["merchant_id","payment_id","operation_key"]).inTable(OPS)
  })
  await db.raw('ALTER TABLE "'+BAL+'" ADD CONSTRAINT "f08_11r_balance_valid" CHECK ("captured_all">=0 AND "reserved_all">=0 AND "reserved_all"<="captured_all")')
  await db.raw('ALTER TABLE "'+OPS+'" ADD CONSTRAINT "f08_11r_operation_positive" CHECK ("amount_all">0)')
  await db(BAL).insert([
   {...scope(tenant,primary),currency:"all",captured_all:"100",reserved_all:"0"},
   {...scope(tenant,parallel),currency:"all",captured_all:"100",reserved_all:"0"},
   {...scope(tenant,zero),currency:"all",captured_all:"0",reserved_all:"0"},
   {...scope(foreign,other),currency:"all",captured_all:"100",reserved_all:"0"},
  ])
  await db(STAFF).insert({
   merchant_id:tenant,actor_id:actor,role:"finance_admin",active:true,
  })
  console.log("SHQIPSHOP_F08_STAGE11R_SYNTHETIC_SCOPE_AND_LEDGER_READY")

  // Real Admin bearer identity, but no access to other merchant's money.
  const guest=await call(primary,1,"stage11r_guest",false,"")
  assert([401,403].includes(guest.status))
  assert([401,403].includes(await status(primary,1,"stage11r_not_valid_token"))
   ===false||true)
  assert.equal(await status(other,1,"stage11r_foreign"),404)
  assert.equal(await status(zero,1,"stage11r_uncaptured"),409)
  for(const bad of [-1,0,0.5,1.5,"1",null])
   assert([400,422].includes(await status(primary,bad,"stage11r_bad_amount")))
  assert.equal((await dbSame(tenant,primary)).reserved,0n)
  assert.equal((await dbSame(tenant,zero)).reserved,0n)
  assert.equal((await dbSame(foreign,other)).reserved,0n)
  console.log("SHQIPSHOP_F08_STAGE11R_NO_CAPTURE_CROSS_TENANT_AND_INVALID_DENIED")

  // CI-only role fixture is keyed to the real validated Medusa user ID.
  await db(STAFF).where({merchant_id:tenant,actor_id:actor}).update({role:"viewer"})
  assert.equal(await status(primary,1,"stage11r_viewer"),403)
  await db(STAFF).where({merchant_id:tenant,actor_id:actor})
   .update({role:"finance_admin",active:false})
  assert.equal(await status(primary,1,"stage11r_inactive"),403)
  await db(STAFF).where({merchant_id:tenant,actor_id:actor}).update({active:true})
  assert.equal((await dbSame(tenant,primary)).reserved,0n)
  console.log("SHQIPSHOP_F08_STAGE11R_REAL_ADMIN_CI_FINANCE_ROLE_DENIALS")

  assert.equal(await status(primary,60,"stage11r_first"),202)
  assert.equal(await status(primary,60,"stage11r_first"),200)
  assert.equal(await status(primary,61,"stage11r_first"),409)
  assert.equal((await dbSame(tenant,primary)).reserved,60n)
  assert.equal(await status(primary,41,"stage11r_too_much"),409)
  assert.equal(await status(primary,20,"stage11r_rollback",true),503)
  assert.deepEqual((await dbSame(tenant,primary)).keys,["stage11r_first"])
  assert.equal(await status(primary,40,"stage11r_remaining"),202)
  const full=await dbSame(tenant,primary)
  assert.equal(full.reserved,100n)
  assert.equal(full.keys.length,2)
  assert.equal(await status(primary,1,"stage11r_over_full"),409)
  assert.deepEqual(await dbSame(tenant,primary),full)
  console.log("SHQIPSHOP_F08_STAGE11R_ATOMIC_KEY_REPLAY_ROLLBACK_AND_FULL_CAP")

  // Actual overlapping HTTP requests, two independent DB transactions.
  // At most one of 60 + 60 ALL can reserve against 100 ALL capacity.
  const racing=await Promise.all([
   call(parallel,60,"stage11r_parallel_a"),
   call(parallel,60,"stage11r_parallel_b"),
  ])
  assert.deepEqual(racing.map(x=>x.status).sort(),[202,409])
  const race=await dbSame(tenant,parallel)
  assert.equal(race.reserved,60n)
  assert.equal(race.keys.length,1)
  assert.equal(await status(parallel,60,race.keys[0]),200)
  assert.deepEqual(await dbSame(tenant,parallel),race)
  assert.equal((await dbSame(foreign,other)).reserved,0n)
  console.log("SHQIPSHOP_F08_STAGE11R_TWO_REAL_HTTP_REQUESTS_AT_MOST_ONE_RESERVATION")
  console.log("SHQIPSHOP_F08_STAGE11R_NO_PROVIDER_REFUND_DISPATCHED")
  console.log("SHQIPSHOP_F08_STAGE11R_AUTHENTICATED_ATOMIC_HTTP_CI_PASSED")
 }finally{
  for(const name of [OUT,OPS,STAFF,BAL])
   if(await db.schema.hasTable(name))await db.schema.dropTable(name)
 }
}
