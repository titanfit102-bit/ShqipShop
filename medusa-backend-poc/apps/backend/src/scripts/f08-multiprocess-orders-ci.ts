/**
 * Stage 11C independent read-only Medusa PostgreSQL evidence after
 * two distinct API processes, an API restart, and an HTTP replay.
 * Synthetic one-customer/one-cart only; never logs tokens or IDs.
 */
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import {resolve,sep} from "node:path"
import type {ExecArgs} from "@medusajs/framework/types"
import {ContainerRegistrationKeys} from "@medusajs/framework/utils"

export default async function verifyMultiProcess({container}:ExecArgs){
 for(const [key,value] of Object.entries({
  CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
  SHQIPSHOP_F08_MULTIPROC_CI:"true",WORKER_MODE:"server",
  DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
  REDIS_URL:"redis://127.0.0.1:6379",
 })) assert.equal(process.env[key],value)
 const root=process.env.RUNNER_TEMP
 const file=process.env.SHQIPSHOP_F08_MULTIPROC_PROOF_FILE
 assert(root&&file&&resolve(file).startsWith(resolve(root)+sep))
 const proof=JSON.parse(readFileSync(file,"utf8")) as {
  customerId:string;cartId:string;orderId:string
 }
 assert(/^cus_[A-Za-z0-9_-]{8,}$/.test(proof.customerId))
 assert(/^cart_[A-Za-z0-9_-]{8,}$/.test(proof.cartId))
 assert(/^order_[A-Za-z0-9_-]{8,}$/.test(proof.orderId))
 const query=container.resolve(ContainerRegistrationKeys.QUERY)
 const {data:orders}=await query.graph({
  entity:"order",
  fields:["id","customer_id","currency_code","total","cart.id"],
  filters:{customer_id:proof.customerId},
 })
 assert.equal(orders.length,1,
  "Exactly one persisted order per synthetic customer/cart after two-process race/restart")
 assert.equal(orders[0].id,proof.orderId)
 assert.equal(orders[0].customer_id,proof.customerId)
 assert.equal(orders[0].cart?.id,proof.cartId)
 assert.equal(orders[0].currency_code,"all")
 assert(Number(orders[0].total)>0,"Expected a positive server-calculated order total")
 const {data:carts}=await query.graph({
  entity:"cart",fields:["id","customer_id","order.id"],
  filters:{id:proof.cartId},
 })
 assert.equal(carts.length,1)
 assert.equal(carts[0].id,proof.cartId)
 assert.equal(carts[0].customer_id,proof.customerId)
 assert.equal(carts[0].order?.id,proof.orderId)
 console.log("SHQIPSHOP_F08_STAGE11C_POSTGRES_SINGLE_CART_SINGLE_ORDER_AFTER_RESTART_VERIFIED")
}
