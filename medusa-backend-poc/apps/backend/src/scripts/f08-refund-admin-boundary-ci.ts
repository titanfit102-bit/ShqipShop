/**
 * F08 Stage 11O — Medusa v2.22.0 built-in Admin route auth-negative HTTP
 * and SINGULAR refundPaymentWorkflow invariants, using disposable payments.
 *
 * Stage 11B order 2 is fully refunded by Stage 11K; order 1 is fully
 * refunded by Stage 11J (which currently also persists +1 ALL). Test
 * only AFTER Stage 11K/11J. No PSP, production code or Admin login.
 */
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {resolve,sep} from "node:path"
import type {ExecArgs} from "@medusajs/framework/types"
import {ContainerRegistrationKeys} from "@medusajs/framework/utils"
import {refundPaymentWorkflow} from "@medusajs/medusa/core-flows"

const whole=(v:unknown):bigint=>{
 if(typeof v==="number"&&Number.isSafeInteger(v)&&v>=0)return BigInt(v)
 if(typeof v==="string"&&/^(0|[1-9][0-9]*)(?:[.]0+)?$/.test(v))
  return BigInt(v.split(".")[0])
 throw Error("Unsafe ALL money representation")
}
type Refund={id:string,amount:unknown,status:string}
type Capture={id:string,amount:unknown}
type View={id:string,total:bigint,captures:Capture[],refunds:Refund[]}
export default async function testSingularAdminRefund({container}:ExecArgs){
 const env={
  CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
  SHQIPSHOP_F08_MULTIPROC_CI:"true",SHQIPSHOP_F08_ACK_LOSS_CI:"true",
  SHQIPSHOP_F08_PAYMENT_CHAIN_CI:"true",SHQIPSHOP_F08_PSP_CONTRACT_CI:"true",
  SHQIPSHOP_F08_REFUND_WORKFLOW_CI:"true",SHQIPSHOP_F08_EXACT_REFUND_CI:"true",
  SHQIPSHOP_F08_ADMIN_REFUND_BOUNDARY_CI:"true",WORKER_MODE:"server",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
 }
 for(const [n,v] of Object.entries(env))assert.equal(process.env[n],v,n)
 const phase=process.env.SHQIPSHOP_F08_ADMIN_REFUND_PHASE
 assert(["http-deny","singular-workflow"].includes(phase??""))
 const root=process.env.RUNNER_TEMP
 const file=process.env.SHQIPSHOP_F08_COMPLETE_PROOF_FILE
 assert(root&&file&&resolve(file).startsWith(resolve(root)+sep))
 const proof=JSON.parse(readFileSync(file,"utf8")) as {
  customerId:string,cartIds:string[],orderIds:string[]
 }
 assert(/^cus_[A-Za-z0-9_-]{8,}$/.test(proof.customerId))
 assert(Array.isArray(proof.cartIds)&&proof.cartIds.length===2)
 assert(Array.isArray(proof.orderIds)&&proof.orderIds.length===2)
 assert.equal(new Set(proof.orderIds).size,2)
 for(const id of proof.cartIds)assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(id))
 for(const id of proof.orderIds)assert(/^order_[A-Za-z0-9_-]{8,}$/.test(id))
 const query=container.resolve(ContainerRegistrationKeys.QUERY)
 const {data:orders}=await query.graph({
  entity:"order",fields:["id","customer_id","currency_code","total",
   "cart.id","payment_collections.id"],
  filters:{customer_id:proof.customerId},
 })
 assert.equal(orders.length,2)
 const collections:string[]=[]
 const totals:bigint[]=[]
 for(let i=0;i<2;i++){
  const o=orders.find(x=>x.id===proof.orderIds[i])
  assert(o&&o.customer_id===proof.customerId)
  assert.equal(o.cart?.id,proof.cartIds[i])
  assert.equal(o.currency_code,"all")
  const total=whole(o.total)
  assert(total>=3n&&total<=BigInt(Number.MAX_SAFE_INTEGER))
  assert.equal(o.payment_collections?.length,1)
  const collection=o.payment_collections[0].id
  assert(/^pay_?col_[A-Za-z0-9_-]{8,}$/.test(collection))
  collections.push(collection);totals.push(total)
 }
 const read=async(i:0|1):Promise<View>=>{
  const {data}=await query.graph({
   entity:"payment_collection",
   fields:["id","currency_code","amount","payments.id",
    "payments.provider_id","payments.amount","payments.captures.id",
    "payments.captures.amount","payments.refunds.id",
    "payments.refunds.amount","payments.refunds.status"],
   filters:{id:collections[i]},
  })
  assert.equal(data.length,1)
  const c=data[0]
  assert.equal(c.currency_code,"all")
  assert.equal(whole(c.amount),totals[i])
  assert.equal(c.payments?.length,1)
  const p=c.payments[0]
  assert(/^pay_[A-Za-z0-9_-]{8,}$/.test(p.id))
  assert.equal(p.provider_id,"pp_system_default")
  assert.equal(whole(p.amount),totals[i])
  const captures=p.captures??[],refunds=p.refunds??[]
  assert.equal(new Set(refunds.map(r=>r.id)).size,refunds.length)
  for(const r of refunds)assert(/^ref_[A-Za-z0-9_-]{8,}$/.test(r.id))
  for(const c of captures)assert(/^capt_[A-Za-z0-9_-]{8,}$/.test(c.id))
  return {id:p.id,total:totals[i],captures,refunds}
 }
 const sum=(v:View)=>v.refunds.reduce((n,r)=>n+whole(r.amount),0n)
 const dbSame=(a:View,b:View)=>{
  assert.equal(a.id,b.id);assert.equal(a.total,b.total)
  const canon=(arr:any[])=>arr.map(x=>[
   x.id,String(whole(x.amount)),x.status??"",
  ].join(":")).sort()
  assert.deepEqual(canon(a.captures),canon(b.captures))
  assert.deepEqual(canon(a.refunds),canon(b.refunds),
   "Refund PostgreSQL records mutated after invalid request")
 }

 if(phase==="http-deny"){
  const before=await read(1)
  assert.equal(before.captures.length,0)
  assert.equal(before.refunds.length,0)
  const health=await fetch("http://127.0.0.1:9220/health",{
   signal:AbortSignal.timeout(6500),
  })
  assert.equal(health.status,200)
  const url="http://127.0.0.1:9220/admin/payments/"+
   encodeURIComponent(before.id)+"/refund"
  const body=JSON.stringify({amount:1,
   idempotency_key:"shqipshop_stage11o_unauthorized"})
  const deny=async(token?:string)=>{
   const headers:Record<string,string>={"Content-Type":"application/json"}
   if(token)headers.Authorization=token
   const response=await fetch(url,{
    method:"POST",headers,body,signal:AbortSignal.timeout(10000),
   })
   assert([401,403].includes(response.status),
    "Admin route must reject missing/invalid JWT while server is live")
  }
  await deny()
  dbSame(before,await read(1))
  console.log("SHQIPSHOP_F08_STAGE11O_ADMIN_UNAUTH_HTTP_DENIED_NO_REFUND")
  await deny("Bearer not-a-valid-medusa-token")
  dbSame(before,await read(1))
  console.log("SHQIPSHOP_F08_STAGE11O_ADMIN_INVALID_JWT_HTTP_DENIED_NO_REFUND")
  return
 }

 const plural=await read(0),exact=await read(1)
 assert.equal(exact.captures.length,1)
 assert.equal(whole(exact.captures[0].amount),exact.total)
 assert.equal(exact.refunds.length,2)
 assert.equal(sum(exact),exact.total)
 assert(exact.refunds.every(r=>r.status==="succeeded"))
 assert.equal(plural.captures.length,1)
 assert.equal(whole(plural.captures[0].amount),plural.total)
 assert(plural.refunds.length>=2&&sum(plural)>=plural.total)
 const run=async(id:string,amount:number|undefined,kind:string)=>{
  const input:{payment_id:string,idempotency_key:string,amount?:number}={
   payment_id:id,idempotency_key:"shqipshop_stage11o_"+kind+"_"+id,
  }
  if(amount!==undefined)input.amount=amount
  return refundPaymentWorkflow(container).run({input})
 }
 await assert.rejects(()=>run(exact.id,2,"material_excess"),
  "Singular workflow must reject material over-refund")
 dbSame(exact,await read(1))
 console.log("SHQIPSHOP_F08_STAGE11O_SINGULAR_MATERIAL_OVER_TOTAL_DENIED")

 // Both independent probes run and emit DB evidence BEFORE failing.
 let oneAccepted=false,omittedAccepted=false
 try{await run(exact.id,1,"one_all");oneAccepted=true}
 catch{/* rejection is allowed; inspect persisted financial state */}
 const oneAfter=await read(1)
 if(oneAccepted)console.log("SHQIPSHOP_F08_STAGE11O_SINGULAR_ONE_ALL_CALL_ACCEPTED")
 if(oneAfter.refunds.length!==exact.refunds.length||sum(oneAfter)!==sum(exact))
  console.log("SHQIPSHOP_F08_STAGE11O_SINGULAR_ONE_ALL_REFUND_PERSISTED")

 try{await run(plural.id,undefined,"amount_missing");omittedAccepted=true}
 catch{/* rejection is allowed; independently inspect financial state */}
 const omittedAfter=await read(0)
 if(omittedAccepted)
  console.log("SHQIPSHOP_F08_STAGE11O_SINGULAR_OMITTED_AMOUNT_CALL_ACCEPTED")
 if(omittedAfter.refunds.length!==plural.refunds.length||
    sum(omittedAfter)!==sum(plural))
  console.log("SHQIPSHOP_F08_STAGE11O_SINGULAR_OMITTED_AMOUNT_REFUND_PERSISTED")

 dbSame(exact,oneAfter)
 assert(!oneAccepted,
  "CRITICAL: singular workflow accepted 1 ALL over fully refunded capture")
 dbSame(plural,omittedAfter)
 assert(!omittedAccepted,
  "CRITICAL: singular workflow accepted missing amount after full refund")
 console.log("SHQIPSHOP_F08_STAGE11O_SINGULAR_REFUND_NEGATIVE_SUITE_PASSED")
}
