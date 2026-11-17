/**
 * Inject a processable but wrongly-sized payment session via the official
 * Payment module. Only for ephemeral GitHub CI and manual mock provider.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export default async function inject({container}:ExecArgs) {
  const required={
    CI:"true",NODE_ENV:"development",SHQIPSHOP_REQUIRE_REDIS:"true",
    SHQIPSHOP_ENFORCE_PAYMENT_TOTAL_MATCH:"true",SHQIPSHOP_F07F_INJECT_TEST:"true",
    DATABASE_URL:"postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
    REDIS_URL:"redis://127.0.0.1:6379",
  }
  for(const [k,v] of Object.entries(required)) assert.equal(process.env[k],v,k)
  const temp=process.env.RUNNER_TEMP
  const file=process.env.SHQIPSHOP_F07F_PROOF_FILE
  assert(temp && file && resolve(file).startsWith(resolve(temp)+"/"))
  const data=JSON.parse(readFileSync(file,"utf8")) as {
    cartId:string;sessionId:string;total:number;staleAmount:number;currency:string
  }
  assert(data.cartId?.startsWith("cart_") && data.sessionId?.startsWith("payses_"))
  assert.equal(data.currency,"all")
  assert(Number.isSafeInteger(data.total) && data.total>0 && data.total<1000000)
  assert.equal(data.staleAmount,data.total+23)
  const query=container.resolve(ContainerRegistrationKeys.QUERY)
  const before=await query.graph({entity:"payment_session",
    fields:["id","provider_id","status","amount","currency_code"],
    filters:{id:data.sessionId}})
  assert.equal(before.data.length,1)
  const row=before.data[0]
  assert.equal(row.provider_id,"pp_system_default")
  assert.equal(row.currency_code,"all")
  assert.equal(Number(row.amount),data.total)
  const processable=["pending","requires_more","authorized","captured","pending_authorization"]
  assert(processable.includes(String(row.status)),"Session invalid before injection")
  const payment=container.resolve(Modules.PAYMENT)
  const updated=await payment.updatePaymentSession({
    id:data.sessionId,amount:data.staleAmount,currency_code:"all",data:{},context:{},
  })
  assert.equal(Number(updated.amount),data.staleAmount)
  assert(processable.includes(String(updated.status)),"Injection unexpectedly invalidated session")
  const persisted=await query.graph({entity:"payment_session",
    fields:["id","amount","status"],filters:{id:data.sessionId}})
  assert.equal(Number(persisted.data[0]?.amount),data.staleAmount)
  console.log("SHQIPSHOP_F07F_SYNTHETIC_ACTIVE_MISMATCH_INJECTED")
}
