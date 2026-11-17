/** N03 Stage 2b: disposable A/B Medusa guest capability contract.
 * No real PSP, no production hosts, no secret/PII in logs. */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { request } from "./boundary-http.mjs"

assert.equal(process.env.CI, "true")
assert.equal(process.env.NODE_ENV, "development")
assert.equal(process.env.SHQIPSHOP_N03_GUEST_RECOVERY_PROBE, "true")
const guests = [
  {id:"A",base:"http://127.0.0.1:9000"},
  {id:"B",base:"http://127.0.0.1:9001"},
]
const denied = (r, reason) => assert([401,403,404].includes(r.status),reason+": must deny")
for (const m of guests) {
  const keyPath=process.env["SHQIPSHOP_"+m.id+"_KEY_FILE"]
  assert(keyPath)
  m.key=readFileSync(keyPath,"utf8").trim()
  assert(m.key.length>10)
  const regions=await request(m,"GET","/store/regions",{key:true})
  assert.equal(regions.status,200)
  const region=regions.data.regions.find(r=>r.name==="Shqipëri")
  assert(region?.id)
  const catalog=await request(m,"GET","/store/products?region_id="+encodeURIComponent(region.id)+"&fields=%2Bvariants.*",{key:true})
  assert.equal(catalog.status,200)
  m.variant=catalog.data.products.find(p=>p.variants?.length)?.variants[0]?.id
  assert(m.variant)

  const start=await request(m,"POST","/store/shqipshop/guest-recovery-ci",{
    key:true,body:{region_id:region.id},
  })
  assert.equal(start.status,201,m.id+": must provision cart and distinct guest recovery proof")
  assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(start.data?.cart_id))
  assert(typeof start.data?.recovery_proof==="string" && /^[A-Za-z0-9_-]{43}$/.test(start.data.recovery_proof))
  assert.notEqual(start.data.recovery_proof,start.data.cart_id)
  m.cart=start.data.cart_id
  m.proof=start.data.recovery_proof
  m.path="/store/shqipshop/guest-recovery-ci?cart_id="+encodeURIComponent(m.cart)
  const get=(proof,opts={})=>request(m,"GET",m.path,{
    key:true,headers:{...(proof?{"x-shqipshop-recovery-proof":proof}:{}),...(opts.headers??{})},
    ...(opts.cookie?{cookie:opts.cookie}:{}),
    ...(opts.token?{token:opts.token}:{}),
  })
  const initial=await get(m.proof)
  assert.equal(initial.status,200)
  assert.deepEqual(initial.data,{state:"unknown"})
  denied(await get(null),m.id+" cart ID alone")
  denied(await get(m.cart),m.id+" cart ID as a proof")
  denied(await get("A".repeat(43)),m.id+" guessed token")
  denied(await get(m.proof,{headers:{"x-shqipshop-tenant-id":"foreign"}}),m.id+" fake tenant")
  denied(await get(m.proof,{cookie:"connect.sid=fake"}),m.id+" cookie mode")
  denied(await get(m.proof,{token:"synthetic.invalid.jwt"}),m.id+" mixed bearer mode")
}
assert.notEqual(guests[0].cart,guests[1].cart)
assert.notEqual(guests[0].proof,guests[1].proof)
for(const m of guests){
  const foreign=guests.find(q=>q!==m)
  denied(await request(m,"GET",
    "/store/shqipshop/guest-recovery-ci?cart_id="+encodeURIComponent(foreign.cart),{
      key:true,headers:{"x-shqipshop-recovery-proof":foreign.proof},
    }),"cross merchant guest cart+proof")
  denied(await request(m,"GET",m.path,{
    key:true,headers:{"x-shqipshop-recovery-proof":foreign.proof},
  }),"same host foreign credential")
}
console.log("SHQIPSHOP_N03_GUEST_PRECOMPLETE_CAPABILITY_BOUNDARY_A_B_PASSED")

for(const m of guests){
  const write=async(method,path,body)=>{
    const response=await request(m,method,path,{key:true,body})
    assert.equal(response.status,200,m.id+" guest cart mutation failed")
    return response.data
  }
  await write("POST","/store/carts/"+m.cart+"/line-items",{variant_id:m.variant,quantity:1})
  const address={first_name:"Synthetic",last_name:"Guest",address_1:"CI street",
    city:"Tirane",postal_code:"1001",country_code:"al"}
  await write("POST","/store/carts/"+m.cart,{
    email:"guest-"+m.id.toLowerCase()+"@example.invalid",
    shipping_address:address,billing_address:address,
  })
  const options=await request(m,"GET","/store/shipping-options?cart_id="+encodeURIComponent(m.cart),{key:true})
  assert.equal(options.status,200)
  assert(options.data.shipping_options?.length)
  await write("POST","/store/carts/"+m.cart+"/shipping-methods",
    {option_id:options.data.shipping_options[0].id})
  const payCollection=await request(m,"POST","/store/payment-collections",{
    key:true,body:{cart_id:m.cart},
  })
  assert.equal(payCollection.status,200)
  const collectionId=payCollection.data.payment_collection?.id
  assert(collectionId)
  const session=await request(m,"POST","/store/payment-collections/"+collectionId+"/payment-sessions",{
    key:true,body:{provider_id:"pp_system_default"},
  })
  assert([200,201].includes(session.status))
  const completed=await request(m,"POST","/store/carts/"+m.cart+"/complete",{key:true,body:{}})
  assert.equal(completed.status,200)
  assert.equal(completed.data.type,"order")
  m.order=completed.data.order?.id
  assert(/^order_[A-Za-z0-9_-]{8,}$/.test(m.order))
  // Simulate lost acknowledgement: never invoke complete again.
  const opts={key:true,headers:{"x-shqipshop-recovery-proof":m.proof}}
  const recovered=await request(m,"GET",m.path,opts)
  assert.equal(recovered.status,200)
  assert.deepEqual(recovered.data,{state:"confirmed",order_id:m.order})
  assert.deepEqual((await request(m,"GET",m.path,opts)).data,recovered.data)
  // A newly issued guest recovery secret must also protect the private receipt.
  // Legacy cart ID alone is NOT an alternative authority for this new cart.
  const receiptPath="/store/orders/"+encodeURIComponent(m.order)
  denied(await request(m,"GET",receiptPath,{key:true,
    headers:{"x-shqipshop-cart-proof":m.cart}}),"legacy cart-id proof cannot read N03 receipt")
  denied(await request(m,"GET",receiptPath,{key:true,
    headers:{"x-shqipshop-recovery-proof":"A".repeat(43)}}),"wrong N03 receipt proof")
  const receipt=await request(m,"GET",receiptPath,{key:true,
    headers:{"x-shqipshop-recovery-proof":m.proof}})
  assert.equal(receipt.status,200,m.id+" new capability must read its own receipt")
  assert.equal(receipt.data?.order?.id,m.order)
  console.log("SHQIPSHOP_N03_GUEST_CAPABILITY_ONLY_RECEIPT_"+m.id)
  console.log("SHQIPSHOP_N03_GUEST_ORDER_PERSISTED_RECOVERY_"+m.id)
}
const b=guests[1],a=guests[0]
const revoke=await request(b,"DELETE","/store/shqipshop/guest-recovery-ci",{
  key:true,headers:{"x-shqipshop-recovery-proof":b.proof},body:{cart_id:b.cart},
})
assert.equal(revoke.status,200)
assert.equal(revoke.data?.revoked,true)
denied(await request(b,"GET",b.path,{key:true,headers:{"x-shqipshop-recovery-proof":b.proof}}),
  "revoked capability")
denied(await request(b,"GET","/store/orders/"+encodeURIComponent(b.order),{key:true,
  headers:{"x-shqipshop-recovery-proof":b.proof}}),"revoked capability cannot read receipt")
console.log("SHQIPSHOP_N03_GUEST_REVOCATION_DENIED")

// An expired row is advanced only inside the disposable A CI database;
// it is never an external user or production database.
assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(a.cart))
const sql="UPDATE shqipshop_n03_disposable_guest_recovery SET expires_at = now() - interval '1 second' WHERE cart_id = '"+a.cart+"';"
execFileSync("psql",["-v","ON_ERROR_STOP=1","-h","127.0.0.1","-U","shqipshop_ci_a",
  "-d","shqipshop_ci_a"],{
    env:{...process.env,PGPASSWORD:"merchantA_disposable"},
    input:sql,encoding:"utf8",stdio:["pipe","pipe","pipe"],
  })
denied(await request(a,"GET",a.path,{key:true,headers:{"x-shqipshop-recovery-proof":a.proof}}),
  "expired capability")
console.log("SHQIPSHOP_N03_GUEST_EXPIRY_DENIED")
console.log("SHQIPSHOP_N03_GUEST_RECOVERY_A_B_CI_PASSED")
