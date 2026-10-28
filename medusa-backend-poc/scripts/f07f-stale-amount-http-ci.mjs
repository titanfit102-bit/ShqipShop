/**
 * F07f isolated negative checkout proof. Creates one disposable manual payment
 * session, then verifies the Store API refuses a still-active wrong amount.
 * Fault injection itself happens in the companion guarded Medusa CI script.
 */
import assert from "node:assert/strict"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
const required = {
  CI: "true", NODE_ENV: "development", SHQIPSHOP_REQUIRE_REDIS: "true",
  SHQIPSHOP_ENFORCE_PAYMENT_TOTAL_MATCH: "true",
  SHQIPSHOP_F07F_INJECT_TEST: "true",
  DATABASE_URL: "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL: "redis://127.0.0.1:6379",
}
for(const [key,value] of Object.entries(required)) assert.equal(process.env[key],value,key)
const mode=process.argv[2]
assert(["prepare","verify"].includes(mode))
const temp=process.env.RUNNER_TEMP
const proof=process.env.SHQIPSHOP_F07F_PROOF_FILE
const keyFile=process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
assert(temp && proof && keyFile && resolve(proof).startsWith(resolve(temp)+"/"))
assert(resolve(keyFile).startsWith(resolve(temp)+"/"))
const key=readFileSync(keyFile,"utf8").trim()
assert(key.length>10)
async function api(method,path,body,requireOk=true){
  const response=await fetch("http://127.0.0.1:9000"+path,{
    method,
    headers:{"x-publishable-api-key":key,...(body===undefined?{}:{"content-type":"application/json"})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    cache:"no-store",signal:AbortSignal.timeout(20000),
  })
  const raw=await response.text()
  let data
  try{data=JSON.parse(raw)}catch{data={}}
  if(requireOk)assert(response.ok,"Store HTTP "+response.status+" "+path.split("?")[0]+" "+raw.slice(0,300))
  return {status:response.status,data}
}
async function readCart(id){
  const result=await api("GET","/store/carts/"+encodeURIComponent(id)+
    "?fields="+encodeURIComponent("*items,+payment_collection.payment_sessions"))
  assert.equal(result.data.cart?.id,id)
  return result.data.cart
}
const active=c=>(c.payment_collection?.payment_sessions||[]).filter(s=>
  ["pending","requires_more","authorized","captured","pending_authorization"].includes(s.status))
if(mode==="prepare"){
  const regions=(await api("GET","/store/regions")).data.regions||[]
  const region=regions.find(r=>r.name==="Shqipëri"&&r.currency_code==="all")
  assert(region?.id,"Disposable ALL region missing")
  const params=new URLSearchParams({region_id:region.id,fields:"*variants.calculated_price,+variants.id"})
  const products=(await api("GET","/store/products?"+params)).data.products||[]
  const variant=products.flatMap(p=>p.variants||[]).find(v=>
    Number.isSafeInteger(v.calculated_price?.calculated_amount)&&v.calculated_price.calculated_amount>0)
  assert(variant?.id,"No priced CI variant")
  const cart=(await api("POST","/store/carts",{region_id:region.id})).data.cart
  assert(cart?.id?.startsWith("cart_"))
  await api("POST","/store/carts/"+cart.id+"/line-items",{variant_id:variant.id,quantity:1})
  const address={first_name:"CI",last_name:"Test",address_1:"Rruga Demo 1",
    city:"Tiranë",postal_code:"1001",country_code:"al",phone:"+355690000001"}
  await api("POST","/store/carts/"+cart.id,{
    email:"stale-amount-ci@example.invalid",shipping_address:address,billing_address:address,
  })
  const options=(await api("GET","/store/shipping-options?cart_id="+cart.id)).data.shipping_options||[]
  const option=options.find(o=>o.name==="Transport standard")??options[0]
  assert(option?.id)
  await api("POST","/store/carts/"+cart.id+"/shipping-methods",{option_id:option.id})
  const collection=(await api("POST","/store/payment-collections",{cart_id:cart.id})).data.payment_collection
  assert(collection?.id)
  await api("POST","/store/payment-collections/"+collection.id+"/payment-sessions",
    {provider_id:"pp_system_default"})
  const current=await readCart(cart.id)
  const sessions=active(current)
  assert.equal(sessions.length,1,"Exactly one processable session required")
  assert.equal(sessions[0].provider_id,"pp_system_default")
  const total=current.total
  assert(Number.isSafeInteger(total)&&total>0&&total<1000000)
  assert.equal(Number(sessions[0].amount),total)
  assert(sessions[0].id?.startsWith("payses_"))
  writeFileSync(proof,JSON.stringify({
    cartId:cart.id,sessionId:sessions[0].id,total,staleAmount:total+23,currency:"all",
  }),{flag:"wx",mode:0o600})
  console.log("SHQIPSHOP_F07F_HTTP_MISMATCH_PREPARED")
}else{
  const fixture=JSON.parse(readFileSync(proof,"utf8"))
  assert(fixture.cartId?.startsWith("cart_")&&fixture.sessionId?.startsWith("payses_"))
  assert.equal(fixture.staleAmount,fixture.total+23)
  const current=await readCart(fixture.cartId)
  assert.equal(current.total,fixture.total,"Cart changed during fault injection")
  const sessions=active(current)
  assert.equal(sessions.length,1,"Injected payment became unprocessable")
  assert.equal(sessions[0].id,fixture.sessionId)
  assert.equal(Number(sessions[0].amount),fixture.staleAmount)
  console.log("SHQIPSHOP_F07F_HTTP_PROCESSABLE_STALE_SESSION_OBSERVED")
  for(let n=0;n<2;n++){
    const result=await api("POST","/store/carts/"+fixture.cartId+"/complete",{},false)
    assert.equal(result.status,409,"Mismatched processable session must return 409, got "+result.status)
    assert(!result.data.order?.id,"Unexpected order for stale session")
  }
  const after=await readCart(fixture.cartId)
  assert(!after.completed_at,"Rejected stale cart completed")
  assert.equal(after.total,fixture.total)
  console.log("SHQIPSHOP_F07F_HTTP_ACTIVE_STALE_AMOUNT_REJECTED_409_TWICE")
}
