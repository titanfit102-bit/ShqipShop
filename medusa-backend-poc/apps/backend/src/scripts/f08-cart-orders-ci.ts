/** F08 Stage 11B: independent persisted-order proof after HTTP concurrency.
 * Exact disposable CI database only. Reads real Medusa PostgreSQL via Query;
 * no payment mutations, no tokens, no user/customer data in logs.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve, sep } from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export default async function verifyCartOrders({container}:ExecArgs) {
 for(const [name,value] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_F08_COMPLETE_CI:"true",
  SHQIPSHOP_REQUIRE_REDIS:"true",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
 })) assert.equal(process.env[name],value)
 const temp=process.env.RUNNER_TEMP
 const file=process.env.SHQIPSHOP_F08_COMPLETE_PROOF_FILE
 assert(temp&&file&&resolve(file).startsWith(resolve(temp)+sep))
 const evidence=JSON.parse(readFileSync(file,"utf8")) as {
  customerId:string;cartIds:string[];orderIds:string[]
 }
 assert(/^cus_[A-Za-z0-9_-]{8,}$/.test(evidence.customerId))
 assert(Array.isArray(evidence.cartIds)&&evidence.cartIds.length===2)
 assert(Array.isArray(evidence.orderIds)&&evidence.orderIds.length===2)
 for(const id of evidence.cartIds) assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(id))
 for(const id of evidence.orderIds) assert(/^order_[A-Za-z0-9_-]{8,}$/.test(id))
 assert.equal(new Set(evidence.cartIds).size,2)
 assert.equal(new Set(evidence.orderIds).size,2)

 const query=container.resolve(ContainerRegistrationKeys.QUERY)
 // Enumerate ALL orders of this unique synthetic customer, not only the
 // expected order IDs: a duplicate/unlinked order must not be overlooked.
 const {data:orders}=await query.graph({
  entity:"order",
  fields:["id","customer_id","currency_code","total","cart.id"],
  filters:{customer_id:evidence.customerId},
 })
 assert.equal(orders.length,2,
  "A synthetic customer with two completed carts must have exactly two persisted orders")
 const expected=new Set(evidence.orderIds)
 assert.equal(new Set(orders.map(o=>o.id)).size,2,"Distinct DB order IDs required")
 assert(orders.every(o=>expected.has(o.id)),"Unexpected/orphan synthetic order persisted")
 for(let i=0;i<evidence.cartIds.length;i++){
  const matching=orders.filter(o=>o.cart?.id===evidence.cartIds[i])
  assert.equal(matching.length,1,"Each completed cart must have exactly ONE linked Medusa order")
  assert.equal(matching[0].id,evidence.orderIds[i],"HTTP and persisted order ID disagree")
  assert.equal(matching[0].customer_id,evidence.customerId)
  assert.equal(matching[0].currency_code,"all")
  assert(Number(matching[0].total)>0,"Order total must be server-calculated and positive")
 }
 const {data:carts}=await query.graph({
  entity:"cart",fields:["id","customer_id","order.id"],
  filters:{id:evidence.cartIds},
 })
 assert.equal(carts.length,2)
 for(let i=0;i<evidence.cartIds.length;i++){
  const row=carts.find(c=>c.id===evidence.cartIds[i])
  assert(row,"Missing completed source cart")
  assert.equal(row.customer_id,evidence.customerId)
  assert.equal(row.order?.id,evidence.orderIds[i],"Inverse cart-to-order link mismatch")
 }
 console.log("SHQIPSHOP_F08_STAGE11B_POSTGRES_TWO_CARTS_TWO_UNIQUE_ORDERS_VERIFIED")
 console.log("SHQIPSHOP_F08_STAGE11B_POSTGRES_NO_DUPLICATE_OR_ORPHAN_ORDERS")
}
