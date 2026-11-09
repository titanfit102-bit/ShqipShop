/**
 * F08 Stage 11O — Medusa v2.22.0 built-in Admin route auth-negative HTTP
 * and SINGULAR refundPaymentWorkflow invariants, using disposable payments.
 *
 * Stage 11B order 2 is fully refunded by Stage 11K; order 1 is fully
 * refunded by Stage 11J (which currently also persists +1 ALL). Test
 * only AFTER Stage 11K/11J. No PSP, production code or Admin login.
 */
import assert from "node:assert/strict"
import {randomBytes} from "node:crypto"
import {readFileSync} from "node:fs"
import {resolve,sep} from "node:path"
import type {ExecArgs} from "@medusajs/framework/types"
import {ContainerRegistrationKeys,Modules} from "@medusajs/framework/utils"
import {refundPaymentWorkflow} from "@medusajs/medusa/core-flows"

const whole=(v:unknown):bigint=>{
 // Query Graph returns Medusa BigNumber objects, not always primitives.
 // Convert ONLY server-owned Query Graph values, never client-supplied
 // amounts. Reject non-integral, negative and imprecise JS numbers.
 if(v===null||v===undefined||typeof v==="boolean")
  throw Error("Missing or unsafe ALL money representation")
 const n=Number(v)
 if(!Number.isSafeInteger(n)||n<0)
  throw Error("Unsafe ALL money representation")
 return BigInt(n)
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
 assert(["http-deny","http-authenticated","http-guard","singular-workflow"].includes(phase??""))
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

 // Stage 11P: real, runner-local Medusa user JWT + customer JWT against
 // a disposable UNCAPTURED payment. Deliberately no successful refund here:
 // the test verifies authorization and rejected invalid/pre-capture requests
 // without touching the later Stage 11K/J/O financial fixtures.
 if(phase==="http-authenticated"||phase==="http-guard"){
  const strict=phase==="http-guard"
  if(strict)assert.equal(process.env.SHQIPSHOP_F08_STRICT_REFUND_CI,"true")
  const password=process.env.SHQIPSHOP_F08_STAGE11P_ADMIN_PASSWORD
  assert(/^[a-f0-9]{48}$/.test(password??""),
   "Require a masked, randomly generated CI-only Admin password")
  const base="http://127.0.0.1:9220"
  const send=async(path:string,body:unknown,token?:string,key?:string)=>{
   const headers:Record<string,string>={"content-type":"application/json"}
   if(token)headers.authorization="Bearer "+token
   if(key)headers["x-publishable-api-key"]=key
   const res=await fetch(base+path,{
    method:"POST",headers,body:JSON.stringify(body),
    signal:AbortSignal.timeout(10000),
   })
   return res
  }
  const adminLogin=await send("/auth/user/emailpass",{
   email:"stage11p-admin@shqipshop.example.invalid",password,
  })
  assert.equal(adminLogin.status,200,"Actual CI Admin login must succeed")
  const adminJwt=(await adminLogin.json()).token
  assert(typeof adminJwt==="string"&&adminJwt.length>20)
  const adminMe=await fetch(base+"/admin/users/me",{
   headers:{authorization:"Bearer "+adminJwt},
   signal:AbortSignal.timeout(10000),
  })
  assert.equal(adminMe.status,200,"Medusa Admin JWT must resolve a user")
  const me=(await adminMe.json()).user
  assert(typeof me?.id==="string"&&me.id.length>8)
  console.log("SHQIPSHOP_F08_STAGE11P_REAL_ADMIN_IDENTITY_HTTP_VERIFIED")

  const email="stage11p-customer-"+randomBytes(8).toString("hex")+"@example.invalid"
  const customerPassword=randomBytes(24).toString("hex")
  const customerReg=await send("/auth/customer/emailpass/register",{
   email,password:customerPassword,
  })
  assert([200,201].includes(customerReg.status))
  const customerJwt=(await customerReg.json()).token
  assert(typeof customerJwt==="string"&&customerJwt.length>20)
  const keyFile=process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
  assert(root&&keyFile&&resolve(keyFile).startsWith(resolve(root)+sep))
  const publishableKey=readFileSync(keyFile,"utf8").trim()
  assert(publishableKey.length>10)
  const created=await send("/store/customers",{
   email,first_name:"Synthetic",last_name:"AuthBoundary",
  },customerJwt,publishableKey)
  assert([200,201].includes(created.status),
   "Customer JWT must be linked to a real disposable Medusa customer")
  // Medusa registration token identifies a new auth identity; the newly
  // created customer account requires a fresh login JWT for Store API reads.
  // Match the established parallel-auth-boundary.mjs CI flow; no bypass.
  const customerLogin=await send("/auth/customer/emailpass",{
   email,password:customerPassword,
  })
  assert.equal(customerLogin.status,200,
   "Newly created disposable customer must log in before Store API access")
  const customerAuthJwt=(await customerLogin.json()).token
  assert(typeof customerAuthJwt==="string"&&customerAuthJwt.length>20)
  const customerMe=await fetch(base+"/store/customers/me",{
   headers:{authorization:"Bearer "+customerAuthJwt,
    "x-publishable-api-key":publishableKey},
   signal:AbortSignal.timeout(10000),
  })
  assert.equal(customerMe.status,200,"Customer JWT must be valid in Store API")
  console.log("SHQIPSHOP_F08_STAGE11P_REAL_CUSTOMER_IDENTITY_HTTP_VERIFIED")

  // Keep Stage 11B's second order INDEPENDENT: Stage 11K/J/O require its
  // original zero-refund starting state. Do not contaminate their sentinels.
  const original=await read(1)
  assert.equal(original.captures.length,0)
  assert.equal(original.refunds.length,0)

  // Create a THIRD, fully linked but independent synthetic Medusa order.
  // Registration/login was already validated above. This new customer is
  // distinct from Stage 11B and 11E customers; do not contaminate their
  // exact-quantity payment/refund assertions.
  const keyProof=process.env.SHQIPSHOP_F07E_REPRICE_PROOF_FILE
  assert(root&&keyProof&&resolve(keyProof).startsWith(resolve(root)+sep))
  const variant=JSON.parse(readFileSync(keyProof,"utf8")).variantId
  assert(/^variant_[A-Za-z0-9_-]{8,}$/.test(variant))
  const customerId=(await created.json()).customer?.id
  assert(/^cus_[A-Za-z0-9_-]{8,}$/.test(customerId??""))
  const store=async(method:"GET"|"POST",path:string,body?:unknown)=>{
   const headers:Record<string,string>={
    "x-publishable-api-key":publishableKey,
    authorization:"Bearer "+customerAuthJwt,
   }
   if(body!==undefined)headers["content-type"]="application/json"
   const res=await fetch(base+path,{
    method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),
    signal:AbortSignal.timeout(30000),
   })
   assert.equal(res.status,200,
    "Stage 11P independent Medusa Store route failed: "+method+" "+path.split("?")[0])
   return res.json()
  }
  const regions=await store("GET","/store/regions")
  const region=regions.regions?.find((r:any)=>r.currency_code==="all"&&r.name==="Shqipëri")
  assert(typeof region?.id==="string")
  const initial=await store("POST","/store/carts",{region_id:region.id})
  const cartId=initial.cart?.id
  assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(cartId??""))
  await store("POST","/store/carts/"+cartId+"/customer",{})
  await store("POST","/store/carts/"+cartId+"/line-items",{
   variant_id:variant,quantity:1,
  })
  const address={first_name:"Synthetic",last_name:"AuthBoundary",
   address_1:"Rruga Test 12",city:"Tirane",postal_code:"1001",country_code:"al"}
  const updated=await store("POST","/store/carts/"+cartId,{
   email,shipping_address:address,billing_address:address,
  })
  assert.equal(updated.cart?.customer_id,customerId)
  const options=await store("GET","/store/shipping-options?cart_id="+encodeURIComponent(cartId))
  const method=options.shipping_options?.find((o:any)=>o.name==="Transport standard")??
   options.shipping_options?.[0]
  assert(typeof method?.id==="string")
  await store("POST","/store/carts/"+cartId+"/shipping-methods",{option_id:method.id})
  const coll=await store("POST","/store/payment-collections",{cart_id:cartId})
  const collectionId=coll.payment_collection?.id
  assert(/^pay_?col_[A-Za-z0-9_-]{8,}$/.test(collectionId??""))
  await store("POST","/store/payment-collections/"+collectionId+"/payment-sessions",{
   provider_id:"pp_system_default",
  })
  const finished=await store("POST","/store/carts/"+cartId+"/complete",{})
  assert.equal(finished.type,"order")
  const orderId=finished.order?.id
  assert(/^order_[A-Za-z0-9_-]{8,}$/.test(orderId??""))
  const {data:orderRows}=await query.graph({
   entity:"order",fields:["id","customer_id","currency_code","total","cart.id",
    "payment_collections.id"],
   filters:{id:orderId},
  })
  assert.equal(orderRows.length,1)
  const o=orderRows[0]
  assert.equal(o.customer_id,customerId)
  assert.equal(o.cart?.id,cartId)
  assert.equal(o.currency_code,"all")
  assert.equal(o.payment_collections?.length,1)
  assert.equal(o.payment_collections[0].id,collectionId)
  const orderTotal=whole(o.total)
  assert(orderTotal>=3n&&orderTotal<=BigInt(Number.MAX_SAFE_INTEGER))

  const readDedicated=async():Promise<View>=>{
   const {data}=await query.graph({
    entity:"payment_collection",
    fields:["id","currency_code","amount","payments.id",
     "payments.provider_id","payments.amount","payments.captures.id",
     "payments.captures.amount","payments.refunds.id",
     "payments.refunds.amount","payments.refunds.status"],
    filters:{id:collectionId},
   })
   assert.equal(data.length,1)
   const c=data[0]
   assert.equal(c.id,collectionId)
   assert.equal(c.currency_code,"all")
   assert.equal(whole(c.amount),orderTotal)
   assert.equal(c.payments?.length,1)
   const p=c.payments[0]
   assert(/^pay_[A-Za-z0-9_-]{8,}$/.test(p.id))
   assert.equal(p.provider_id,"pp_system_default")
   assert.equal(whole(p.amount),orderTotal)
   return {id:p.id,total:orderTotal,captures:p.captures??[],refunds:p.refunds??[]}
  }
  const before=await readDedicated()
  assert.equal(before.captures.length,0,
   "Stage 11P fixture must have no capture at first")
  assert.equal(before.refunds.length,0)
  console.log("SHQIPSHOP_F08_STAGE11P_INDEPENDENT_LINKED_UNCAPTURED_ORDER_READY")
  const route="/admin/payments/"+encodeURIComponent(before.id)+"/refund"
  const customerAttempt=await send(route,{amount:1},customerAuthJwt)
  assert([401,403].includes(customerAttempt.status),
   "A real customer JWT cannot call Admin refund")
  dbSame(before,await readDedicated())
  console.log("SHQIPSHOP_F08_STAGE11P_CUSTOMER_ADMIN_REFUND_DENIED_NO_MUTATION")
  const invalidAmount=await send(route,{amount:-1},adminJwt)
  assert([400,422].includes(invalidAmount.status),
   "Authenticated Admin invalid refund amount must fail validation")
  dbSame(before,await readDedicated())
  console.log("SHQIPSHOP_F08_STAGE11P_ADMIN_INVALID_AMOUNT_DENIED_NO_MUTATION")

  // Collect independent PG evidence BEFORE the fail-closed assertion.
  // A server 200 is NOT a success when no amount was captured.
  const uncaptured=await send(route,{amount:1},adminJwt)
  const after=await readDedicated()
  if(uncaptured.status>=200&&uncaptured.status<300)
   console.log("SHQIPSHOP_F08_STAGE11P_AUTH_ADMIN_UNCAPTURED_HTTP_ACCEPTED")
  else console.log("SHQIPSHOP_F08_STAGE11P_AUTH_ADMIN_UNCAPTURED_HTTP_STATUS_"+uncaptured.status)
  if(after.refunds.length!==before.refunds.length||sum(after)!==sum(before))
   console.log("SHQIPSHOP_F08_STAGE11P_AUTH_ADMIN_UNCAPTURED_REFUND_PERSISTED")
  if(after.captures.length!==before.captures.length)
   console.log("SHQIPSHOP_F08_STAGE11P_AUTH_ADMIN_UNCAPTURED_CAPTURE_MUTATED")
  dbSame(original,await read(1))
  if(strict){
   assert.equal(uncaptured.status,409,
    "Stage 11Q CI guard must reject real Admin uncaptured refund")
   dbSame(before,after)
   console.log("SHQIPSHOP_F08_STAGE11Q_UNCAPTURED_HTTP_DENIED_NO_PG_MUTATION")
   // An authorized full capture must remain refundable by the guarded
   // built-in Admin HTTP route. Only this independent CI checkout is used.
   const payment=container.resolve(Modules.PAYMENT)
   await payment.capturePayment({payment_id:before.id,amount:Number(orderTotal)})
   const captured=await readDedicated()
   assert.equal(captured.captures.length,1)
   assert.equal(whole(captured.captures[0].amount),orderTotal)
   assert.equal(captured.refunds.length,0)
   const accepted=await send(route,{amount:Number(orderTotal)},adminJwt)
   assert(accepted.status>=200&&accepted.status<300,
    "Stage 11Q positive Admin HTTP captured refund must succeed")
   const fully=await readDedicated()
   assert.equal(fully.captures.length,1)
   assert.equal(whole(fully.captures[0].amount),orderTotal)
   assert.equal(fully.refunds.length,1)
   assert.equal(sum(fully),orderTotal)
   assert(fully.refunds.every(r=>r.status==="succeeded"))
   console.log("SHQIPSHOP_F08_STAGE11Q_AUTH_ADMIN_FULL_REFUND_PERSISTED")
   const extra=await send(route,{amount:1},adminJwt)
   assert.equal(extra.status,409,
    "Stage 11Q CI guard must reject +1 ALL after full refund")
   dbSame(fully,await readDedicated())
   dbSame(original,await read(1))
   console.log("SHQIPSHOP_F08_STAGE11Q_POST_FULL_ONE_ALL_DENIED_NO_PG_MUTATION")
   console.log("SHQIPSHOP_F08_STAGE11Q_SERIAL_HTTP_GUARD_PASSED")
   return
  }
  assert([400,409,422].includes(uncaptured.status),
   "CRITICAL: authenticated Admin refund of uncaptured payment must fail")
  dbSame(before,after)
  console.log("SHQIPSHOP_F08_STAGE11P_ADMIN_UNCAPTURED_REFUND_DENIED_NO_MUTATION")
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
 else if(!omittedAccepted)
  console.log("SHQIPSHOP_F08_STAGE11P_SINGULAR_OMITTED_AMOUNT_REJECTED_NO_MUTATION")

 dbSame(exact,oneAfter)
 assert(!oneAccepted,
  "CRITICAL: singular workflow accepted 1 ALL over fully refunded capture")
 dbSame(plural,omittedAfter)
 assert(!omittedAccepted,
  "CRITICAL: singular workflow accepted missing amount after full refund")
 console.log("SHQIPSHOP_F08_STAGE11O_SINGULAR_REFUND_NEGATIVE_SUITE_PASSED")
}
