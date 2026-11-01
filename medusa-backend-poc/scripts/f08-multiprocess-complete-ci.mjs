/**
 * F08 Stage 11C — two ACTUAL Medusa API processes sharing disposable
 * PostgreSQL/Redis, plus restart/replay. Synthetic pp_system_default ONLY.
 * Never logs JWTs, IDs, customer contact details, or request payloads.
 */
import assert from "node:assert/strict"
import {randomBytes} from "node:crypto"
import {readFileSync,writeFileSync} from "node:fs"
import {resolve,sep} from "node:path"

for(const [name,value] of Object.entries({
 CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
 SHQIPSHOP_F07G_HTTP_CI:"true",SHQIPSHOP_F08_REVOCATION_CI:"true",
 SHQIPSHOP_F08_OWNER_CART_CI:"true",SHQIPSHOP_F08_MULTIPROC_CI:"true",
 WORKER_MODE:"server",
 DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
 REDIS_URL:"redis://127.0.0.1:6379",
})) assert.equal(process.env[name],value)
const phase=process.argv[2]
assert(["prepare","race","replay","fault-attempt","recover","ack-discard","ack-retry"].includes(phase))
if(["fault-attempt","recover"].includes(phase))
 assert.equal(process.env.SHQIPSHOP_F08_FAILURE_CI,"true")
const root=process.env.RUNNER_TEMP
const keyFile=process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
const variantFile=process.env.SHQIPSHOP_F07E_REPRICE_PROOF_FILE
const stateFile=process.env.SHQIPSHOP_F08_MULTIPROC_PROOF_FILE
assert(root&&keyFile&&variantFile&&stateFile)
for(const f of [keyFile,variantFile,stateFile])
 assert(resolve(f).startsWith(resolve(root)+sep),"CI proof path must be runner-local")
const key=readFileSync(keyFile,"utf8").trim()
assert(key.length>10)
const base=(port)=>"http://127.0.0.1:"+port
async function request(port,method,path,token,body){
 const response=await fetch(base(port)+path,{
  method,
  headers:{"x-publishable-api-key":key,
   ...(token?{authorization:"Bearer "+token}:{}),
   ...(body!==undefined?{"content-type":"application/json"}:{})},
  ...(body!==undefined?{body:JSON.stringify(body)}:{}),
  cache:"no-store",signal:AbortSignal.timeout(45000),
 })
 let json=null
 try{json=await response.json()}catch{}
 return {status:response.status,data:json}
}
async function ok(port,method,path,token,body){
 const r=await request(port,method,path,token,body)
 assert.equal(r.status,200,"Expected 200: "+method+" "+path.split("?")[0])
 return r.data
}
function validId(id,prefix){
 return typeof id==="string"&&
  new RegExp("^"+prefix+"[A-Za-z0-9_-]{8,}$").test(id)
}
function load(){
 const raw=JSON.parse(readFileSync(stateFile,"utf8"))
 assert(validId(raw.customerId,"cus_")&&validId(raw.cartId,"cart_"))
 assert(raw.tokenA?.length>20&&raw.tokenB?.length>20&&raw.tokenA!==raw.tokenB)
 return raw
}
const complete=(port,id,token)=>request(
 port,"POST","/store/carts/"+encodeURIComponent(id)+"/complete",token,{})

if(phase==="prepare"){
 const variant=JSON.parse(readFileSync(variantFile,"utf8")).variantId
 assert(validId(variant,"variant_"))
 const email="stage11c-"+randomBytes(8).toString("hex")+"@example.invalid"
 const password=randomBytes(20).toString("hex")
 const reg=await ok(9220,"POST","/auth/customer/emailpass/register",null,{email,password})
 assert(reg?.token?.length>20)
 const created=await ok(9220,"POST","/store/customers",reg.token,{
  email,first_name:"Synthetic",last_name:"Customer"})
 const customerId=created?.customer?.id
 assert(validId(customerId,"cus_"))
 const tokenA=(await ok(9220,"POST","/auth/customer/emailpass",null,{email,password})).token
 assert(tokenA?.length>20)
 await new Promise(r=>setTimeout(r,1500))
 const tokenB=(await ok(9220,"POST","/auth/customer/emailpass",null,{email,password})).token
 assert(tokenB?.length>20&&tokenB!==tokenA)
 const regions=await ok(9220,"GET","/store/regions")
 const region=regions?.regions?.find(r=>r.currency_code==="all"&&r.name==="Shqipëri")
 assert(region?.id)
 const providers=await ok(9220,"GET",
  "/store/payment-providers?region_id="+encodeURIComponent(region.id))
 assert(providers?.payment_providers?.some(p=>p.id==="pp_system_default"))
 const cart=await ok(9220,"POST","/store/carts",tokenA,{region_id:region.id})
 const id=cart?.cart?.id
 assert(validId(id,"cart_"))
 await ok(9220,"POST","/store/carts/"+id+"/customer",tokenA)
 await ok(9220,"POST","/store/carts/"+id+"/line-items",tokenA,
  {variant_id:variant,quantity:1})
 const address={first_name:"Synthetic",last_name:"Customer",
  address_1:"Test Address",city:"Tirane",postal_code:"1001",country_code:"al"}
 const update=await ok(9220,"POST","/store/carts/"+id,tokenA,
  {email,shipping_address:address,billing_address:address})
 assert.equal(update?.cart?.customer_id,customerId)
 const options=await ok(9220,"GET",
  "/store/shipping-options?cart_id="+encodeURIComponent(id),tokenA)
 const shipping=options?.shipping_options?.find(o=>o.name==="Transport standard")??
  options?.shipping_options?.[0]
 assert(shipping?.id)
 await ok(9220,"POST","/store/carts/"+id+"/shipping-methods",tokenA,{option_id:shipping.id})
 const collection=await ok(9220,"POST","/store/payment-collections",tokenA,{cart_id:id})
 const paymentId=collection?.payment_collection?.id
 assert(/^pay_?col_[A-Za-z0-9_-]{8,}$/.test(paymentId??""))
 await ok(9220,"POST","/store/payment-collections/"+paymentId+"/payment-sessions",
  tokenA,{provider_id:"pp_system_default"})
 const verify=await ok(9220,"GET","/store/carts/"+id+"?fields="+
  encodeURIComponent("+payment_collection.payment_sessions"),tokenB)
 assert.equal(verify?.cart?.customer_id,customerId)
 assert.equal(verify?.cart?.items?.length,1)
 assert(verify?.cart?.payment_collection?.payment_sessions?.some(
  p=>p.provider_id==="pp_system_default"&&
  ["pending","authorized"].includes(p.status)))
 // The only persisted credentials are synthetic test tokens, in ephemeral
 // runner.temp mode 0600. The workflow securely cleans up this file.
 writeFileSync(stateFile,JSON.stringify({cartId:id,customerId,tokenA,tokenB}),
  {mode:0o600,flag:"wx",encoding:"utf8"})
 console.log("SHQIPSHOP_F08_STAGE11C_SYNTHETIC_REGISTERED_CART_PREPARED")
}else if(phase==="race"){
 const state=load()
 const route="/store/carts/"+encodeURIComponent(state.cartId)
 const [fromA,fromB]=await Promise.all([
  ok(9220,"GET",route,state.tokenA),
  ok(9221,"GET",route,state.tokenB),
 ])
 assert.equal(fromA?.cart?.customer_id,state.customerId)
 assert.equal(fromB?.cart?.customer_id,state.customerId)
 assert.equal(fromA?.cart?.items?.length,1)
 assert.equal(fromB?.cart?.items?.length,1)
 for(const [port,token] of [[9220,null],[9221,"invalid_f08_ci_bearer"]]){
  const denied=await complete(port,state.cartId,token)
  assert([401,403,404].includes(denied.status),
   "Foreign/anonymous completion must be rejected by both Medusa servers")
 }
 console.log("SHQIPSHOP_F08_STAGE11C_BOTH_MEDUSA_PROCESSES_SHARE_OWNER_BOUNDARY")
 // Both requests enter two different running Medusa API processes at once.
 const responses=await Promise.all([
  complete(9220,state.cartId,state.tokenA),
  complete(9221,state.cartId,state.tokenB),
 ])
 assert(responses.every(r=>r.status<500),
  "Concurrent checkout must not produce HTTP 5xx")
 const orders=responses.filter(r=>r.status===200&&r.data?.type==="order")
 assert(orders.length>=1,"At least one concurrent request must complete")
 const unique=[...new Set(orders.map(r=>r.data?.order?.id))]
 assert.equal(unique.length,1,"Concurrent two-process checkout produced different order IDs")
 assert(validId(unique[0],"order_"))
 assert(responses.every(r=>r.status!==200||r.data?.type==="order"),
  "Unexpected successful completion response")
 state.orderId=unique[0]
 writeFileSync(stateFile,JSON.stringify(state),{flag:"w",mode:0o600,encoding:"utf8"})
 console.log("SHQIPSHOP_F08_STAGE11C_TWO_SERVER_CONCURRENT_HTTP_SINGLE_ORDER_ID")
}else if(phase==="ack-discard"){
 const state=load()
 assert(!state.orderId)
 const completed=await complete(9220,state.cartId,state.tokenA)
 assert.equal(completed.status,200,"Synthetic registered checkout must complete")
 assert.equal(completed.data?.type,"order")
 assert(validId(completed.data?.order?.id,"order_"))
 // Simulated lost client acknowledgement: intentionally do NOT persist ID.
 console.log("SHQIPSHOP_F08_STAGE11E_COMMITTED_ORDER_ACK_DISCARDED")
}else if(phase==="ack-retry"){
 const state=load()
 assert(!state.orderId,"Client must still be unaware of original order ID")
 const denied=await complete(9220,state.cartId,null)
 assert([401,403,404].includes(denied.status))
 const replay=await complete(9220,state.cartId,state.tokenB)
 assert(replay.status<500,"Owner replay must not return 5xx")
 if(replay.status===200){
  assert.equal(replay.data?.type,"order")
  assert(validId(replay.data?.order?.id,"order_"))
 }else assert([400,404,409].includes(replay.status))
 console.log("SHQIPSHOP_F08_STAGE11E_OWNER_RETRY_AFTER_LOST_ACK")
}else if(phase==="fault-attempt"){
 const state=load()
 assert(!state.orderId)
 const marker=process.env.SHQIPSHOP_F08_INFLIGHT_STARTED_FILE
 assert(marker&&resolve(marker).startsWith(resolve(root)+sep))
 writeFileSync(marker,"request-issued",{mode:0o600,flag:"wx"})
 // The workflow pauses disposable Redis and terminates the API process
 // while this request is pending. No actual PSP charge can occur.
 try {
  const response=await fetch(base(9220)+"/store/carts/"+
   encodeURIComponent(state.cartId)+"/complete",{
   method:"POST",
   headers:{"x-publishable-api-key":key,
    authorization:"Bearer "+state.tokenA,
    "content-type":"application/json"},
   body:"{}",cache:"no-store",signal:AbortSignal.timeout(7000),
  })
  assert(response.status>=400,
   "A Redis-paused, interrupted checkout must not return success")
 }catch(err){
  if(!(err instanceof TypeError)&&
     !(err instanceof DOMException&&
       ["AbortError","TimeoutError"].includes(err.name)))
   throw err
 }
 console.log("SHQIPSHOP_F08_STAGE11D_INTERRUPTED_CLIENT_DID_NOT_COMPLETE")
}else if(phase==="recover"){
 const state=load()
 assert(!state.orderId)
 const denied=await complete(9220,state.cartId,null)
 assert([401,403,404].includes(denied.status),
  "Restart must not bypass registered-cart owner policy")
 const response=await complete(9220,state.cartId,state.tokenB)
 assert.equal(response.status,200,"Valid owner must recover incomplete cart")
 assert.equal(response.data?.type,"order")
 assert(validId(response.data?.order?.id,"order_"))
 state.orderId=response.data.order.id
 writeFileSync(stateFile,JSON.stringify(state),{
  mode:0o600,flag:"w",encoding:"utf8"})
 console.log("SHQIPSHOP_F08_STAGE11D_RESTARTED_OWNER_COMPLETES_ONCE")
}else{
 const state=load()
 assert(validId(state.orderId,"order_"))
 const repeated=await complete(9220,state.cartId,state.tokenB)
 assert(repeated.status<500,"Post-restart replay must not return HTTP 5xx")
 if(repeated.status===200&&repeated.data?.type==="order")
  assert.equal(repeated.data.order.id,state.orderId,
   "Post-restart replay must not create a different order")
 else assert([400,404,409].includes(repeated.status),
  "Unexpected post-restart checkout response")
 console.log("SHQIPSHOP_F08_STAGE11C_RESTART_REPLAY_NO_SECOND_ORDER_ID")
}
