/** Synthetic CI-only mutation checks, consuming authenticated in-memory A/B identities. */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { request, isDenied, unchanged } from "./boundary-http.mjs"

const ok = (res, context) => assert.equal(res.status, 200, context + ": expected HTTP 200")

async function snapshot(m) {
  const customer = await request(m,"GET","/admin/customers/" + m.customerId,{token:m.adminJwt})
  const order = await request(m,"GET","/admin/orders/" + m.orderId,{token:m.adminJwt})
  const inventory = await request(m,"GET","/admin/inventory-items/" + m.inventoryId + "?fields=id,title,*location_levels",{token:m.adminJwt})
  for (const res of [customer,order,inventory]) ok(res,"Snapshot read")
  assert.equal(customer.data.customer?.id,m.customerId,"Snapshot customer missing")
  assert.equal(order.data.order?.id,m.orderId,"Snapshot order missing")
  assert.equal(inventory.data.inventory_item?.id,m.inventoryId,"Snapshot inventory missing")
  assert(Array.isArray(inventory.data.inventory_item.location_levels) && inventory.data.inventory_item.location_levels.length > 0,
    "Stock/reservation snapshot requires seeded location levels")
  const levels = inventory.data.inventory_item.location_levels.map(level => {
    assert(Number.isFinite(level.stocked_quantity) && Number.isFinite(level.reserved_quantity),"Stock snapshot incomplete")
    return {id:level.id,location:level.location_id,stocked:level.stocked_quantity,reserved:level.reserved_quantity}
  }).sort((a,b) => a.id.localeCompare(b.id))
  return {
    customer:{id:m.customerId,first_name:customer.data.customer.first_name,metadata:customer.data.customer.metadata},
    order:{id:m.orderId,currency:order.data.order.currency_code,total:order.data.order.total,metadata:order.data.order.metadata},
    inventory:{id:m.inventoryId,title:inventory.data.inventory_item.title,levels},
  }
}

export async function verifyMutations(merchants) {
  assert.equal(process.env.CI,"true","CI only")
  assert.equal(process.env.NODE_ENV,"development","Development fixtures only")
  for (const m of merchants) {
    m.orderId = readFileSync(process.env["SHQIPSHOP_" + m.id + "_ORDER_FILE"],"utf8").trim()
    assert(/^order_[a-zA-Z0-9]+$/.test(m.orderId),"Invalid synthetic order ID")
    const inventory = await request(m,"GET","/admin/inventory-items",{token:m.adminJwt})
    ok(inventory,"Inventory list")
    m.inventoryId = inventory.data.inventory_items?.[0]?.id
    assert(m.inventoryId?.startsWith("iitem_"),"Seeded inventory ID missing")
    const routes = [
      {path:"/store/customers/me",body:{first_name:"CI-own-"+m.id},key:true,auth:{cookie:m.customerCookie}},
      {path:"/admin/customers/"+m.customerId,body:{first_name:"CI-admin-own-"+m.id},auth:{cookie:m.adminCookie}},
      {path:"/admin/orders/"+m.orderId,body:{metadata:{ci_boundary:"own-"+m.id}},auth:{token:m.adminJwt}},
      {path:"/admin/inventory-items/"+m.inventoryId,body:{title:"CI-own-"+m.id},auth:{token:m.adminJwt}},
    ]
    for (const route of routes) {
      const response = await request(m,"POST",route.path,{...route.auth,key:route.key,body:route.body})
      ok(response,m.id+" positive mutation "+route.path)
      if (route.path === "/store/customers/me") {
        assert.equal(response.data.customer?.id,m.customerId,"Own profile ID changed")
        assert.equal(response.data.customer?.first_name,"CI-own-"+m.id,"Positive profile update missing")
      }
    }
    const after = await snapshot(m)
    assert.equal(after.customer.first_name,"CI-admin-own-"+m.id,"Positive admin customer update missing")
    assert.equal(after.order.metadata?.ci_boundary,"own-"+m.id,"Positive order update missing")
    assert.equal(after.order.currency,"all","Synthetic order currency changed")
    assert.equal(after.order.total,1510,"Synthetic order amount changed")
    assert.equal(after.inventory.title,"CI-own-"+m.id,"Positive inventory update missing")
    console.log("SHQIPSHOP_MERCHANT_"+m.id+"_POSITIVE_MUTATIONS_PASSED")
  }
  assert.notEqual(merchants[0].inventoryId,merchants[1].inventoryId,"Inventory IDs must be independent")
  const baseline = await Promise.all(merchants.map(snapshot))
  async function noSideEffects(context) {
    for (let index=0;index<merchants.length;index++) {
      unchanged(await snapshot(merchants[index]),baseline[index],context+" tenant "+merchants[index].id)
    }
  }
  for (const m of merchants) {
    const other = merchants.find(candidate => candidate !== m)
    const adminNegativeAuth = [
      {},{token:m.customerJwt},{cookie:m.customerCookie},{token:other.adminJwt},
      {cookie:other.adminCookie},{token:other.customerJwt},{cookie:other.customerCookie},
    ]
    const routes = [
      {path:"/store/customers/me",key:true,body:{first_name:"CI-MUST-NOT-WRITE"},
        auth:[{},{token:other.customerJwt},{cookie:other.customerCookie},{token:m.adminJwt},{cookie:m.adminCookie}]},
      {path:"/admin/customers/"+m.customerId,body:{first_name:"CI-MUST-NOT-WRITE"},auth:adminNegativeAuth},
      {path:"/admin/orders/"+m.orderId,body:{metadata:{ci_boundary:"CI-MUST-NOT-WRITE"}},auth:adminNegativeAuth},
      {path:"/admin/inventory-items/"+m.inventoryId,body:{title:"CI-MUST-NOT-WRITE"},auth:adminNegativeAuth},
    ]
    for (const route of routes) {
      for (const auth of route.auth) {
        isDenied(await request(m,"POST",route.path,{...auth,key:route.key,body:route.body}),m.id+" negative mutation "+route.path)
        await noSideEffects("Denied mutation")
      }
    }
    // Correctly authenticated local admin with foreign IDs must not reach foreign data.
    for (const [resource,id,body] of [
      ["customers",other.customerId,{first_name:"CI-MUST-NOT-WRITE"}],
      ["orders",other.orderId,{metadata:{ci_boundary:"CI-MUST-NOT-WRITE"}}],
      ["inventory-items",other.inventoryId,{title:"CI-MUST-NOT-WRITE"}],
    ]) {
      for (const method of ["GET","POST"]) {
        const res = await request(m,method,"/admin/"+resource+"/"+id,{token:m.adminJwt,...(method==="POST"?{body}:{})})
        assert.equal(res.status,404,m.id+" foreign object ID "+resource+" "+method)
        await noSideEffects("Foreign object ID")
      }
    }
    // The customer ID comes from auth_context, never from client-supplied body fields.
    const spoof = await request(m,"POST","/store/customers/me",{key:true,cookie:m.customerCookie,
      body:{id:other.customerId,customer_id:other.customerId,first_name:"CI-SPOOF"}})
    assert([200,400].includes(spoof.status),"Unexpected customer ID spoof response")
    if (spoof.status===200) {
      assert.equal(spoof.data.customer?.id,m.customerId,"Customer ID spoof switched actor")
      const foreignIndex=merchants.indexOf(other)
      unchanged(await snapshot(other),baseline[foreignIndex],"Spoof changed foreign tenant")
      ok(await request(m,"POST","/store/customers/me",{key:true,cookie:m.customerCookie,
        body:{first_name:baseline[merchants.indexOf(m)].customer.first_name}}),"Restore own synthetic profile")
    }
    await noSideEffects("Customer ID spoof")
    console.log("SHQIPSHOP_MERCHANT_"+m.id+"_NEGATIVE_MUTATIONS_NO_SIDE_EFFECTS_PASSED")

    // DELETE targets only a separately-created disposable customer, never the auth identity above.
    const fixture = await request(m,"POST","/admin/customers",{token:m.adminJwt,
      body:{email:"delete-"+m.id.toLowerCase()+"@shqipshop.example.invalid",first_name:"Disposable"}})
    assert([200,201].includes(fixture.status) && fixture.data.customer?.id,"Disposable customer creation failed")
    const path = "/admin/customers/" + fixture.data.customer.id
    for (const auth of adminNegativeAuth) {
      isDenied(await request(m,"DELETE",path,auth),m.id+" unauthorized customer DELETE")
      const stillPresent = await request(m,"GET",path,{token:m.adminJwt})
      ok(stillPresent,"Denied DELETE removed customer")
      assert.equal(stillPresent.data.customer?.id,fixture.data.customer.id,"DELETE fixture identity changed")
      await noSideEffects("Denied DELETE")
    }
    const removed = await request(m,"DELETE",path,{token:m.adminJwt})
    ok(removed,"Positive disposable DELETE")
    assert.equal(removed.data.deleted,true,"Disposable customer not deleted")
    assert.equal((await request(m,"GET",path,{token:m.adminJwt})).status,404,"Deleted fixture still available")
    console.log("SHQIPSHOP_MERCHANT_"+m.id+"_DISPOSABLE_DELETE_BOUNDARY_PASSED")
  }
  console.log("SHQIPSHOP_TWO_MERCHANT_MUTATION_AUTHORIZATION_PASSED")
}
