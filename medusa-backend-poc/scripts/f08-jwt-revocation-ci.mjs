/** F08: synthetic CI-only token revocation and owner-cart access proofs.
 * Stage 10 verifies CI-only cart/customer association (guest to authenticated
 * account and registered owner preservation). Guest capability expiry,
 * completion/payment and production F08 remain UNSOLVED.
 */
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {resolve,sep} from "node:path"
for(const [key,val] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_F08_REVOCATION_CI:"true",
  SHQIPSHOP_F08_OWNER_CART_CI:"true",
  SHQIPSHOP_F07G_HTTP_CI:"true",SHQIPSHOP_REQUIRE_REDIS:"true",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
})) assert.equal(process.env[key],val)
const temp=process.env.RUNNER_TEMP
const file=process.env.SHQIPSHOP_F07G_REGISTERED_QUOTE_PROOF_FILE
const pk=process.env.SHQIPSHOP_CI_PUBLISHABLE_KEY_FILE
assert(temp&&file&&pk&&[file,pk].every(p=>resolve(p).startsWith(resolve(temp)+sep)))
const {owner,stranger,cartId}=JSON.parse(readFileSync(file,"utf8"))
const key=readFileSync(pk,"utf8").trim()
assert(owner?.token?.length>20 && stranger?.token?.length>20)
assert(owner?.secondToken?.length>20 && owner.secondToken!==owner.token,
  "Runner must produce TWO distinct JWTs for the same customer")
assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(cartId))
const origin="http://127.0.0.1:9000"
async function request(method,path,token,{headers={},body}={}){
  const res=await fetch(origin+path,{
    method,
    headers:{
      "x-publishable-api-key":key,
      ...(token?{authorization:"Bearer "+token}:{}),
      ...(body?{"content-type":"application/json"}:{}),
      ...headers,
    },
    ...(body?{body:JSON.stringify(body)}:{}),
    cache:"no-store",signal:AbortSignal.timeout(20000),
  })
  let payload=null
  try{payload=await res.json()}catch{}
  return {status:res.status,payload}
}
const protectedQuote=token=>request("POST","/store/shqipshop/quote-boundary-ci",token,{
  headers:{"x-shqipshop-cart-id":cartId},
})
// CI diagnostic only: Medusa's built-in cart GET may use cart-ID possession
// rather than customer JWT authentication. Probe that assumption explicitly.
// Report status and synthetic cart ownership only; never log tokens or PII.
const customerCartPath="/store/carts/"+encodeURIComponent(cartId)
async function probeBuiltInCart(label,token) {
  const result=await request("GET",customerCartPath,token)
  assert([200,401,403,404].includes(result.status),
    "Unexpected built-in Medusa cart response during read-only authorization probe")
  if (result.status===200) {
    assert.equal(result.payload?.cart?.id,cartId)
    assert.equal(result.payload?.cart?.customer_id,owner.id)
  }
  console.log("SHQIPSHOP_F08_CART_"+label+"_HTTP_"+result.status)
  return result.status
}
const phase=process.argv[2] ?? "revocation"
assert(["revocation","outage"].includes(phase),"Only CI revocation/outage test phases allowed")
const revocation=(token,options={})=>request("POST","/store/shqipshop/f08-token-revoke-ci",token,options)
if (phase === "outage") {
  // A missing deny-list MUST block guarded private access (503), never
  // silently treat the bearer as unrevoked. Guest access is out of scope.
  assert.equal((await protectedQuote(owner.token)).status,503,
    "Revoked bearer must fail closed on missing PostgreSQL deny-list table")
  assert.equal((await protectedQuote(stranger.token)).status,503,
    "Even a valid unrevoked bearer must fail closed during deny-list outage")
  assert.equal((await protectedQuote(owner.secondToken)).status,503,
    "A second-device JWT also must fail closed during deny-list outage")
  assert.equal((await request("GET","/store/customers/me",owner.token)).status,503,
    "Guarded built-in private profile MUST deny on absent deny-list")
  assert.equal((await request("GET","/store/customers/me",stranger.token)).status,503,
    "Valid second customer must also fail closed during deny-list outage")
  console.log("SHQIPSHOP_F08_CI_DENYLIST_UNAVAILABLE_GUARDED_BEARER_503")
  // Stage 7: customer-bound cart reads fail closed during deny-list outage.
  const outageRead=await request("GET",customerCartPath,owner.token)
  assert.equal(outageRead.status,503,"Owner cart must fail closed if deny-list is unavailable")
  assert([401,403,404].includes((await probeBuiltInCart("NO_BEARER_OUTAGE",null)),
    "Known cart ID must not bypass customer ownership during outage"))
  console.log("SHQIPSHOP_F08_CI_GUARDED_BUILTIN_PROFILE_OUTAGE_FAIL_CLOSED_503")
  console.log("SHQIPSHOP_F08_CI_OWNED_CART_OUTAGE_FAIL_CLOSED_503")
  process.exit(0)
}
const ownerBefore=await probeBuiltInCart("OWNER_BEFORE_REVOKE",owner.token)
assert.equal(ownerBefore,200,"Correct owner bearer must read cart")
const anonymousBefore=await probeBuiltInCart("NO_BEARER_BEFORE_REVOKE",null)
const foreignBefore=await probeBuiltInCart("FOREIGN_CUSTOMER_BEARER_BEFORE_REVOKE",stranger.token)
assert([401,403,404].includes(anonymousBefore))
assert([401,403,404].includes(foreignBefore))
const invalidBefore=await probeBuiltInCart("INVALID_BEARER_BEFORE_REVOKE","invalid_f08_ci_token")
assert([401,403,404].includes(invalidBefore))
console.log("SHQIPSHOP_F08_CI_OWNER_CART_READ_SCOPE_POSITIVE_NEGATIVE_PASSED")
assert.equal((await protectedQuote(owner.token)).status,200,
  "Medusa authenticated bearer must be accepted BEFORE CI revocation")
assert.equal((await protectedQuote(owner.secondToken)).status,200,
  "Distinct second-device bearer must also authenticate as cart owner")
assert.equal((await request("GET","/store/customers/me",owner.secondToken)).payload?.customer?.id,
  owner.id,"Second token must correspond to the SAME verified customer")
assert([401,403,404].includes((await revocation("bad_ci_bearer")).status),
  "Unverified bearer must not create a revocation entry")
assert.equal((await revocation(owner.token,{headers:{"x-shqipshop-tenant-id":"merchant_foreign"}})).status,400)
assert.equal((await revocation(owner.token,{body:{customer_id:stranger.id}})).status,400)
assert.equal((await revocation(owner.token,{body:{all_devices:true}})).status,400,
  "The current CI endpoint has NO approved all-device logout semantics")
assert.equal((await protectedQuote(owner.token)).status,200,
  "Rejected revocation requests must not invalidate the legitimate JWT")
// Stage 6: controlled mutation diagnostic on NEW disposable customer-owned
// carts, never on the quoted/order carts. This tests Medusa's real access
// boundary, not a proposed production policy. No stock reservation, checkout,
// payment or customer PII is authorized by this diagnostic.
const proofForMutation=JSON.parse(readFileSync(file,"utf8"))
const syntheticVariant=proofForMutation.variantId
assert(/^variant_[A-Za-z0-9_-]{8,}$/.test(syntheticVariant??""))
const regions=await request("GET","/store/regions",null)
assert.equal(regions.status,200)
const region=regions.payload?.regions?.find(
  r=>r.currency_code==="all"&&r.name==="Shqipëri")
assert(region?.id)
async function newSyntheticOwnedCart() {
  const created=await request("POST","/store/carts",owner.token,{
    body:{region_id:region.id},
  })
  assert.equal(created.status,200,"Synthetic owner must create cart")
  const id=created.payload?.cart?.id
  assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(id??""))
  const linked=await request("POST","/store/carts/"+encodeURIComponent(id)+"/customer",owner.token)
  assert.equal(linked.status,200,"Real Medusa must link owner to synthetic cart")
  const before=await request("GET","/store/carts/"+encodeURIComponent(id),owner.token)
  assert.equal(before.status,200)
  assert.equal(before.payload?.cart?.customer_id,owner.id)
  assert.equal(before.payload?.cart?.items?.length??0,0)
  return id
}
const mutateSyntheticCart=(id,token)=>
  request("POST","/store/carts/"+encodeURIComponent(id)+"/line-items",token,{
    body:{variant_id:syntheticVariant,quantity:1},
  })
const controlCart=await newSyntheticOwnedCart()
const control=await mutateSyntheticCart(controlCart,owner.token)
assert.equal(control.status,200,
  "Positive owner mutation must succeed, avoiding invalid-variant false positives")
const controlRead=await request("GET","/store/carts/"+encodeURIComponent(controlCart),owner.token)
assert.equal(controlRead.payload?.cart?.customer_id,owner.id)
assert.equal(controlRead.payload?.cart?.items?.length,1)
assert.equal(controlRead.payload.cart.items[0].variant_id,syntheticVariant)
console.log("SHQIPSHOP_F08_CI_OWNER_CART_WRITE_POSITIVE_CONTROL_200")
for (const [label,token] of [
  ["NO_BEARER",null],["FOREIGN_CUSTOMER_BEARER",stranger.token],
  ["INVALID_BEARER","invalid_f08_ci_token"],
]) {
  const id=await newSyntheticOwnedCart()
  const attempted=await mutateSyntheticCart(id,token)
  assert([400,401,403,404].includes(attempted.status),
    "Non-owner or invalid bearer MUST be denied cart mutation: "+label)
  const inspected=await request("GET","/store/carts/"+encodeURIComponent(id),owner.token)
  assert.equal(inspected.status,200)
  assert.equal(inspected.payload?.cart?.customer_id,owner.id)
  const items=inspected.payload?.cart?.items??[]
  assert.equal(items.length,0,"Denied mutation must not change owner cart")
  console.log("SHQIPSHOP_F08_CI_OWNED_CART_WRITE_"+label+"_DENIED_HTTP_"+attempted.status)
}

// Guest-cart positive control retains Medusa's existing guest behavior;
 // no new guest possession/expiry policy is claimed by this CI proof.
const guest=await request("POST","/store/carts",null,{body:{region_id:region.id}})
assert.equal(guest.status,200)
const guestCartId=guest.payload?.cart?.id
assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(guestCartId??""))
const guestRead=await request("GET","/store/carts/"+encodeURIComponent(guestCartId),null)
assert.equal(guestRead.status,200)
assert.equal(guestRead.payload?.cart?.customer_id??null,null)
const guestWrite=await mutateSyntheticCart(guestCartId,null)
assert.equal(guestWrite.status,200)
const guestUpdated=await request("GET","/store/carts/"+encodeURIComponent(guestCartId),null)
assert.equal(guestUpdated.payload?.cart?.items?.length,1)
console.log("SHQIPSHOP_F08_CI_GUEST_CART_BASELINE_READ_WRITE_PASSED")
// Stage 8: existing Medusa cart item update/delete with real response and
// persisted-state checks. No checkout, stock reservation or payment effect.
// Cart IDs/line IDs stay in memory; no tokens or customer data in logs.
const linePath=(id,lineId)=>
  "/store/carts/"+encodeURIComponent(id)+"/line-items/"+encodeURIComponent(lineId)
const readCart=(id,token)=>
  request("GET","/store/carts/"+encodeURIComponent(id),token)
async function lineItemOf(id,token) {
  const retrieved=await readCart(id,token)
  assert.equal(retrieved.status,200)
  const items=retrieved.payload?.cart?.items
  assert.equal(items?.length,1)
  const item=items[0]
  assert(/^cali_[A-Za-z0-9_-]{8,}$/.test(item.id))
  return item
}
const stage8Cart=await newSyntheticOwnedCart()
assert.equal((await mutateSyntheticCart(stage8Cart,owner.token)).status,200)
const stage8Item=await lineItemOf(stage8Cart,owner.token)
const updateLine=(id,lineId,token,quantity)=>
  request("POST",linePath(id,lineId),token,{body:{quantity}})
const removeLine=(id,lineId,token)=>
  request("DELETE",linePath(id,lineId),token)
for (const [label,token] of [
  ["NO_BEARER",null],
  ["FOREIGN_CUSTOMER_BEARER",stranger.token],
  ["INVALID_BEARER","invalid_f08_ci_token"],
]) {
  const updated=await updateLine(stage8Cart,stage8Item.id,token,2)
  const removed=await removeLine(stage8Cart,stage8Item.id,token)
  for(const [method,response] of [["UPDATE",updated],["DELETE",removed]]) {
    assert([401,403,404].includes(response.status),
      "Unverified "+label+" must not "+method+" registered cart item")
  }
  const unchanged=await lineItemOf(stage8Cart,owner.token)
  assert.equal(unchanged.id,stage8Item.id)
  assert.equal(Number(unchanged.quantity),1,
    "Denied update/delete must not modify registered customer cart")
  console.log("SHQIPSHOP_F08_CI_STAGE8_"+label+"_UPDATE_DELETE_DENIED")
}
const ownerUpdated=await updateLine(stage8Cart,stage8Item.id,owner.token,2)
assert.equal(ownerUpdated.status,200)
assert.equal(Number((await lineItemOf(stage8Cart,owner.token)).quantity),2,
  "Owner update must persist the quantity")
const ownerDeleted=await removeLine(stage8Cart,stage8Item.id,owner.token)
assert.equal(ownerDeleted.status,200)
const emptyOwner=await readCart(stage8Cart,owner.token)
assert.equal(emptyOwner.payload?.cart?.items?.length,0,
  "Owner delete must persist line-item removal")
console.log("SHQIPSHOP_F08_CI_STAGE8_OWNER_UPDATE_DELETE_PERSISTED")
const guestLine=await lineItemOf(guestCartId,null)
assert.equal((await updateLine(guestCartId,guestLine.id,null,2)).status,200)
assert.equal(Number((await lineItemOf(guestCartId,null)).quantity),2)
assert.equal((await removeLine(guestCartId,guestLine.id,null)).status,200)
assert.equal((await readCart(guestCartId,null)).payload?.cart?.items?.length,0)
console.log("SHQIPSHOP_F08_CI_STAGE8_GUEST_UPDATE_DELETE_UNCHANGED_BASELINE")

// Stage 9: synthetic address and shipping-option mutation authorization.
// The normal guest checkout already exercises these same Medusa built-in
// routes; none of these probes completes checkout or creates an order.
const cartRoute=id=>"/store/carts/"+encodeURIComponent(id)
const stage9Address={
  first_name:"CI",last_name:"Buyer",address_1:"Rruga Test 12",
  city:"Tirane",postal_code:"1001",country_code:"al",
}
const stage9ForbiddenAddress={...stage9Address,address_1:"Rruga Other 90"}
const stage9Update=(id,token,address)=>
  request("POST",cartRoute(id),token,{body:{shipping_address:address}})
const stage9Ship=(id,token,optionId)=>
  request("POST",cartRoute(id)+"/shipping-methods",token,{
    body:{option_id:optionId},
  })
const stage9Options=async(id,token)=>{
  const response=await request("GET","/store/shipping-options?cart_id="+encodeURIComponent(id),token)
  assert.equal(response.status,200)
  const options=response.payload?.shipping_options
  assert(Array.isArray(options)&&options.length>0)
  const standard=options.find(o=>o.name==="Transport standard")??options[0]
  assert(/^so_[A-Za-z0-9_-]{8,}$/.test(standard.id))
  return standard.id
}
const stage9Id=await newSyntheticOwnedCart()
assert.equal((await mutateSyntheticCart(stage9Id,owner.token)).status,200)
for(const [label,token] of [
  ["ANONYMOUS",null],["FOREIGN_CUSTOMER",stranger.token],
  ["INVALID_JWT","invalid_f08_ci_token"],
]){
  const denied=await stage9Update(stage9Id,token,stage9ForbiddenAddress)
  assert([401,403,404].includes(denied.status),"Only owner may update shipping address")
  const current=await readCart(stage9Id,owner.token)
  assert.equal(current.status,200)
  assert.notEqual(current.payload?.cart?.shipping_address?.address_1,
    stage9ForbiddenAddress.address_1,"Denied address write must not persist")
  assert.equal(current.payload?.cart?.customer_id,owner.id)
  console.log("SHQIPSHOP_F08_STAGE9_"+label+"_ADDRESS_WRITE_DENIED")
}
assert.equal((await stage9Update(stage9Id,owner.token,stage9Address)).status,200)
const ownerAddress=await readCart(stage9Id,owner.token)
assert.equal(ownerAddress.payload?.cart?.shipping_address?.address_1,stage9Address.address_1)
assert.equal(ownerAddress.payload?.cart?.customer_id,owner.id)
console.log("SHQIPSHOP_F08_STAGE9_OWNER_ADDRESS_PERSISTED")
const stage9Option=await stage9Options(stage9Id,owner.token)
for(const [label,token] of [
  ["ANONYMOUS",null],["FOREIGN_CUSTOMER",stranger.token],
  ["INVALID_JWT","invalid_f08_ci_token"],
]){
  const denied=await stage9Ship(stage9Id,token,stage9Option)
  assert([401,403,404].includes(denied.status),"Only owner may select shipping method")
  const current=await readCart(stage9Id,owner.token)
  assert.equal(current.status,200)
  assert.equal(current.payload?.cart?.shipping_methods?.length??0,0,
    "Denied shipping-method mutation must have no persisted effect")
  console.log("SHQIPSHOP_F08_STAGE9_"+label+"_SHIPPING_METHOD_DENIED")
}
assert.equal((await stage9Ship(stage9Id,owner.token,stage9Option)).status,200)
const ownerShipped=await readCart(stage9Id,owner.token)
assert((ownerShipped.payload?.cart?.shipping_methods?.length??0)>=1)
console.log("SHQIPSHOP_F08_STAGE9_OWNER_SHIPPING_METHOD_PERSISTED")
// Guest positive control, including customer_id created during anonymous checkout.
const stage9Guest=await request("POST","/store/carts",null,{body:{region_id:region.id}})
assert.equal(stage9Guest.status,200)
const stage9GuestId=stage9Guest.payload?.cart?.id
assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(stage9GuestId??""))
assert.equal((await mutateSyntheticCart(stage9GuestId,null)).status,200)
assert.equal((await stage9Update(stage9GuestId,null,stage9Address)).status,200)
const guestShipping=await stage9Options(stage9GuestId,null)
assert.equal((await stage9Ship(stage9GuestId,null,guestShipping)).status,200)
const guestAfterShip=await readCart(stage9GuestId,null)
assert.equal(guestAfterShip.payload?.cart?.shipping_address?.address_1,stage9Address.address_1)
assert((guestAfterShip.payload?.cart?.shipping_methods?.length??0)>=1)
console.log("SHQIPSHOP_F08_STAGE9_GUEST_ADDRESS_AND_SHIPPING_CONTROL_PASSED")

// Stage 10 — customer association is protected by a separate synthetic
// positive/negative test; guest capability/claim expiry is NOT decided here.
const associateCart=(id,token)=>
  request("POST",cartRoute(id)+"/customer",token)
for(const [label,token] of [
  ["ANONYMOUS",null],
  ["FOREIGN_BEARER",stranger.token],
  ["INVALID_BEARER","invalid_f08_ci_token"],
]){
  const response=await associateCart(controlCart,token)
  assert([401,403,404].includes(response.status),
    "Registered customer cart association must deny "+label)
  const checked=await readCart(controlCart,owner.token)
  assert.equal(checked.status,200)
  assert.equal(checked.payload?.cart?.customer_id,owner.id)
  console.log("SHQIPSHOP_F08_STAGE10_REGISTERED_CART_"+label+"_DENIED")
}
assert.equal((await associateCart(controlCart,owner.token)).status,200)
assert.equal((await readCart(controlCart,owner.token)).payload?.cart?.customer_id,owner.id)
console.log("SHQIPSHOP_F08_STAGE10_OWNER_IDEMPOTENT_ASSOCIATION_PASSED")
const unlinked=await request("POST","/store/carts",null,{body:{region_id:region.id}})
assert.equal(unlinked.status,200)
const unlinkedId=unlinked.payload?.cart?.id
assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(unlinkedId??""))
assert.equal((await mutateSyntheticCart(unlinkedId,null)).status,200)
for(const [label,token] of [
  ["ANONYMOUS",null],["INVALID_BEARER","invalid_f08_ci_token"],
]){
  const result=await associateCart(unlinkedId,token)
  assert([401,403,404].includes(result.status,
    "Unverified guest to account link must fail: "+label))
  const unchanged=await readCart(unlinkedId,null)
  assert.equal(unchanged.status,200)
  assert.equal(unchanged.payload?.cart?.customer_id??null,null)
  console.log("SHQIPSHOP_F08_STAGE10_GUEST_CLAIM_"+label+"_DENIED")
}
assert.equal((await associateCart(unlinkedId,owner.token)).status,200)
const nowOwned=await readCart(unlinkedId,owner.token)
assert.equal(nowOwned.status,200)
assert.equal(nowOwned.payload?.cart?.customer_id,owner.id)
assert.equal(nowOwned.payload?.cart?.items?.length,1)
for(const token of [null,stranger.token]){
  assert([401,403,404].includes((await readCart(unlinkedId,token)).status),
    "Claimed registered cart must no longer be accessible as a guest/foreign customer")
}
console.log("SHQIPSHOP_F08_STAGE10_GUEST_TO_OWNER_LINK_PASSED")

const done=await revocation(owner.token)
assert.equal(done.status,200)
assert.equal(done.payload?.revoked,true)
assert.equal((await revocation(owner.token)).status,200,
  "Explicit per-token CI revocation must be idempotent")
assert.equal((await protectedQuote(owner.token)).status,401,
  "Revoked JWT must be denied by guarded CI quote boundary")
assert.equal((await protectedQuote(owner.secondToken)).status,200,
  "Revocation of ONE JWT must not revoke a distinct JWT from same account")
assert.equal((await request("GET","/store/customers/me",owner.secondToken)).payload?.customer?.id,
  owner.id,"Independently authenticated device must remain usable")
assert.equal((await request("GET","/store/customers/me",owner.token)).status,401,
  "Revoked JWT must be denied even on the built-in customer profile")
console.log("SHQIPSHOP_F08_CI_TWO_DEVICES_ONE_TOKEN_REVOKED_OTHER_STILL_ALLOWED")
console.log("SHQIPSHOP_F08_CI_BUILTIN_PROFILE_DENIES_REVOKED_BEARER_401")
assert.equal((await request("GET",customerCartPath,owner.token)).status,401,
  "Explicitly revoked owner JWT must not read linked cart")
assert.equal((await request("GET",customerCartPath,owner.secondToken)).status,200,
  "Distinct still-valid same-owner JWT must read linked cart")
assert.equal((await mutateSyntheticCart(controlCart,owner.token)).status,401,
  "Revoked owner JWT must not mutate own linked cart")
console.log("SHQIPSHOP_F08_CI_REVOKED_OWNER_CART_READ_WRITE_DENIED")
const stillOwnedLine=await lineItemOf(controlCart,owner.secondToken)
assert.equal((await updateLine(controlCart,stillOwnedLine.id,owner.token,2)).status,401)
assert.equal((await removeLine(controlCart,stillOwnedLine.id,owner.token)).status,401)
assert.equal(Number((await lineItemOf(controlCart,owner.secondToken)).quantity),1,
  "Revoked JWT must not update or delete cart items")
console.log("SHQIPSHOP_F08_CI_STAGE8_REVOKED_OWNER_UPDATE_DELETE_401")
assert.equal((await stage9Update(stage9Id,owner.token,stage9ForbiddenAddress)).status,401,
  "Revoked JWT must not modify own shipping address")
assert.equal((await stage9Ship(stage9Id,owner.token,stage9Option)).status,401,
  "Revoked JWT must not select shipping option")
const stage9Unchanged=await readCart(stage9Id,owner.secondToken)
assert.equal(stage9Unchanged.status,200)
assert.equal(stage9Unchanged.payload?.cart?.shipping_address?.address_1,stage9Address.address_1)
console.log("SHQIPSHOP_F08_STAGE9_REVOKED_ADDRESS_AND_SHIPPING_401")
// Revocation must cover association whether or not a guest cart has
// registered ownership before the request.
assert.equal((await associateCart(controlCart,owner.token)).status,401)
const postRevokeCart=await request("POST","/store/carts",null,{body:{region_id:region.id}})
assert.equal(postRevokeCart.status,200)
const postRevokeId=postRevokeCart.payload?.cart?.id
assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(postRevokeId??""))
assert.equal((await associateCart(postRevokeId,owner.token)).status,401)
assert.equal((await readCart(postRevokeId,null)).payload?.cart?.customer_id??null,null)
console.log("SHQIPSHOP_F08_STAGE10_REVOKED_REGISTERED_AND_GUEST_ASSOCIATION_401")

assert.equal((await revocation(owner.secondToken)).status,200,
  "Second device must be revocable independently on explicit request")
assert.equal((await protectedQuote(owner.secondToken)).status,401,
  "Second device must be denied after its OWN bearer is explicitly revoked")
assert.equal((await request("GET","/store/customers/me",owner.secondToken)).status,401,
  "Second-device JWT must be denied on the guarded built-in profile too")
assert.equal((await protectedQuote(owner.token)).status,401,
  "First device must remain revoked after independent second revocation")
console.log("SHQIPSHOP_F08_CI_SECOND_DEVICE_EXPLICIT_REVOCATION_DENIED")
assert.equal((await request("GET","/store/shqipshop/quote-review-accept-ci?quote_id=quote_00000000-0000-4000-8000-000000000000",owner.token,{
  headers:{"x-shqipshop-cart-id":cartId},
})).status,401,"Second guarded quote endpoint must deny revoked bearer")
console.log("SHQIPSHOP_F08_DISPOSABLE_PER_TOKEN_HTTP_REVOCATION_DENIES_GUARDED_QUOTE")
const guarded=await request("GET","/store/customers/me",owner.token)
assert.equal(guarded.status,401,
  "Explicitly revoked JWT must be denied on built-in profile under exact CI guard")
console.log("SHQIPSHOP_F08_CI_BUILTIN_PROFILE_REVOKED_JWT_401")
// Narrow Stage 7 built-in cart guard denies revoked customer access in CI.
const cart=await request("GET",customerCartPath,owner.token)
assert.equal(cart.status,401,"Revoked owner JWT must fail on guarded built-in cart")
console.log("SHQIPSHOP_F08_CI_REVOKED_OWNER_CART_GET_401")
// Compare the SAME customer-owned synthetic cart after explicit owner JWT
// revocation: this distinguishes bearer revocation from ID/capability access.
const anonymousAfter=await probeBuiltInCart("NO_BEARER_AFTER_REVOKE",null)
const foreignAfter=await probeBuiltInCart("FOREIGN_CUSTOMER_BEARER_AFTER_REVOKE",stranger.token)
assert.equal(anonymousAfter,anonymousBefore,"Revoking the owner's JWT must not rewrite anonymous cart access semantics")
assert.equal(foreignAfter,foreignBefore,"Revoking the owner's JWT must not change a different customer's cart read policy")
assert([401,403,404].includes(anonymousAfter))
assert([401,403,404].includes(foreignAfter))
console.log("SHQIPSHOP_F08_CI_OWNED_CART_REQUIRES_CUSTOMER_AUTH")

