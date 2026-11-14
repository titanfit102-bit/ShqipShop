/** F08 Stage 11B: synthetic Medusa registered checkout and concurrency.
 * Only exact disposable CI/PostgreSQL, pp_system_default, no external PSP.
 * Independent of F08 revoked JWT fixtures; never logs credentials or IDs.
 */
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve, sep } from "node:path"
for(const [name,value] of Object.entries({
 CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
 SHQIPSHOP_F07G_HTTP_CI:"true",SHQIPSHOP_F08_REVOCATION_CI:"true",
 SHQIPSHOP_F08_OWNER_CART_CI:"true",SHQIPSHOP_F08_COMPLETE_CI:"true",
 DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
 REDIS_URL:"redis://127.0.0.1:6379",
})) assert.equal(process.env[name],value)
const temp=process.env.RUNNER_TEMP
const keyFile=process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
const repricing=process.env.SHQIPSHOP_F07E_REPRICE_PROOF_FILE
const output=process.env.SHQIPSHOP_F08_COMPLETE_PROOF_FILE
assert(temp&&keyFile&&repricing&&output)
for(const p of [keyFile,repricing,output])
 assert(resolve(p).startsWith(resolve(temp)+sep),"Only runner-private files")
const key=readFileSync(keyFile,"utf8").trim()
assert(key.length>10)
const variant=JSON.parse(readFileSync(repricing,"utf8")).variantId
assert(/^variant_[A-Za-z0-9_-]{8,}$/.test(variant))
const base="http://127.0.0.1:9000"
async function http(method,path,token,body){
 const response=await fetch(base+path,{
  method,
  headers:{"x-publishable-api-key":key,
   ...(token?{authorization:"Bearer "+token}:{}),
   ...(body!==undefined?{"content-type":"application/json"}:{})},
  ...(body!==undefined?{body:JSON.stringify(body)}:{}),
  cache:"no-store",signal:AbortSignal.timeout(30000),
 })
 let data=null
 try{data=await response.json()}catch{}
 return {status:response.status,data}
}
const required=async(method,path,token,body)=>{
 const result=await http(method,path,token,body)
 assert.equal(result.status,200,"Expected HTTP 200 on synthetic "+method+" "+path.split("?")[0])
 return result.data
}
const email="f08-complete-"+randomBytes(8).toString("hex")+"@example.invalid"
const password=randomBytes(20).toString("hex")
const registration=await required("POST","/auth/customer/emailpass/register",null,{email,password})
assert(registration?.token?.length>20)
const created=await required("POST","/store/customers",registration.token,{
 email,first_name:"Synthetic",last_name:"Buyer"})
const customerId=created?.customer?.id
assert(/^cus_[A-Za-z0-9_-]{8,}$/.test(customerId??""))
const firstLogin=await required("POST","/auth/customer/emailpass",null,{email,password})
const tokenA=firstLogin?.token
assert(tokenA?.length>20)
await new Promise(resolve=>setTimeout(resolve,1500))
const secondLogin=await required("POST","/auth/customer/emailpass",null,{email,password})
const tokenB=secondLogin?.token
assert(tokenB?.length>20&&tokenB!==tokenA,"Two distinct JWTs required")
const profile=await required("GET","/store/customers/me",tokenB)
assert.equal(profile?.customer?.id,customerId)
const regions=await required("GET","/store/regions")
const region=regions?.regions?.find(r=>r.currency_code==="all"&&r.name==="Shqipëri")
assert(region?.id)
const providers=await required("GET","/store/payment-providers?region_id="+encodeURIComponent(region.id))
assert(providers?.payment_providers?.some(p=>p.id==="pp_system_default"))
const address={
 first_name:"Synthetic",last_name:"Buyer",address_1:"Rruga Test 12",
 city:"Tirane",postal_code:"1001",country_code:"al",
}
async function preparedCart(){
 const initial=await required("POST","/store/carts",tokenA,{region_id:region.id})
 const id=initial?.cart?.id
 assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(id??""))
 await required("POST","/store/carts/"+id+"/customer",tokenA)
 await required("POST","/store/carts/"+id+"/line-items",tokenA,{
  variant_id:variant,quantity:1})
 const update=await required("POST","/store/carts/"+id,tokenA,{
  email,shipping_address:address,billing_address:address})
 assert.equal(update?.cart?.customer_id,customerId)
 const methods=await required("GET","/store/shipping-options?cart_id="+encodeURIComponent(id),tokenA)
 const shipping=methods?.shipping_options?.find(o=>o.name==="Transport standard")??methods?.shipping_options?.[0]
 assert(shipping?.id)
 await required("POST","/store/carts/"+id+"/shipping-methods",tokenA,{option_id:shipping.id})
 const payment=await required("POST","/store/payment-collections",tokenA,{cart_id:id})
 const paymentId=payment?.payment_collection?.id
 assert(/^pay_?col_[A-Za-z0-9_-]{8,}$/.test(paymentId??""),
  "Disposable payment collection must have a Medusa-generated ID")
 await required("POST","/store/payment-collections/"+paymentId+"/payment-sessions",tokenA,{
  provider_id:"pp_system_default"})
 const verified=await required("GET","/store/carts/"+id+"?fields="+
  encodeURIComponent("+payment_collection.payment_sessions,+shipping_methods.name"),tokenA)
 assert.equal(verified?.cart?.customer_id,customerId)
 assert.equal(verified?.cart?.items?.length,1)
 assert(verified?.cart?.payment_collection?.payment_sessions?.some(
  s=>s.provider_id==="pp_system_default"&&["pending","authorized"].includes(s.status)))
 return id
}
const complete=(id,token)=>http("POST","/store/carts/"+id+"/complete",token,{})
const singleCart=await preparedCart()
const single=await complete(singleCart,tokenA)
assert.equal(single.status,200,"Authenticated Medusa owner must complete mock checkout")
assert.equal(single.data?.type,"order")
const singleId=single.data?.order?.id
assert(/^order_[A-Za-z0-9_-]{8,}$/.test(singleId??""))
// Store response may omit private customer_id. Independently verify it
// from PostgreSQL with the cart/order link after all HTTP probes.
assert.equal(single.data?.order?.currency_code,"all")
console.log("SHQIPSHOP_F08_STAGE11B_OWNER_MOCK_ORDER_HTTP_200")
const raceCart=await preparedCart()
for(const [label,who] of [
 ["ANONYMOUS",null],["FOREIGN_JWT","invalid_foreign_ci_jwt"],
]){
 const denied=await complete(raceCart,who)
 assert([401,403,404].includes(denied.status),"Unverified completion "+label)
}
const preRace=await required("GET","/store/carts/"+raceCart,tokenB)
assert.equal(preRace?.cart?.customer_id,customerId)
assert.equal(preRace?.cart?.items?.length,1)
console.log("SHQIPSHOP_F08_STAGE11B_NONOWNER_MOCK_COMPLETE_DENIED")
const attempts=await Promise.all([complete(raceCart,tokenA),complete(raceCart,tokenB)])
assert(attempts.every(r=>r.status<500),"Concurrent completion must not error with HTTP 5xx")
const successful=attempts.filter(r=>r.status===200&&r.data?.type==="order")
assert(successful.length>=1,"At least one valid concurrent completion must create an order")
const ids=[...new Set(successful.map(r=>r.data?.order?.id))]
assert.equal(ids.length,1,"Concurrent HTTP responses must not refer to different orders")
assert(/^order_[A-Za-z0-9_-]{8,}$/.test(ids[0]??""))
assert(attempts.every(r=>r.status!==200 || r.data?.type==="order"),
 "Successful completion cannot silently return a different result type")
const retry=await complete(raceCart,tokenB)
assert(retry.status<500,"Sequential retry must not crash")
if(retry.status===200&&retry.data?.type==="order")
 assert.equal(retry.data?.order?.id,ids[0],"Retry must not create a second order")
else assert([400,404,409].includes(retry.status),"Unexpected retry outcome")
writeFileSync(output,JSON.stringify({
 customerId,cartIds:[singleCart,raceCart],orderIds:[singleId,ids[0]],
}),{flag:"wx",mode:0o600,encoding:"utf8"})
console.log("SHQIPSHOP_F08_STAGE11B_PARALLEL_HTTP_AT_MOST_ONE_ORDER_ID")
