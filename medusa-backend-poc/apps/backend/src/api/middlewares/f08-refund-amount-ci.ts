/**
 * Stage 11Q — STRICTLY DISPOSABLE CI-ONLY, serial refund amount probe.
 * No merchant/PSP production implementation. A read-before-write guard is
 * NOT atomic, and cannot prevent concurrent over-refunds or provider retries.
 */
import type {AuthenticatedMedusaRequest,MedusaResponse,MedusaNextFunction} from "@medusajs/framework/http"
import {ContainerRegistrationKeys} from "@medusajs/framework/utils"
import {isF08DisposableCi} from "./f08-revocation-ci"

const exactCi=()=>isF08DisposableCi()&&
  process.env.SHQIPSHOP_F08_ADMIN_REFUND_BOUNDARY_CI==="true"&&
  process.env.SHQIPSHOP_F08_STRICT_REFUND_CI==="true"&&
  process.env.SHQIPSHOP_F08_ACK_LOSS_CI==="true"&&
  process.env.WORKER_MODE==="server"

const whole=(value:unknown):bigint=>{
  const n=Number(value)
  if(value===null||value===undefined||typeof value==="boolean"||
     !Number.isSafeInteger(n)||n<0)throw Error("Unsafe monetary value")
  return BigInt(n)
}

export async function verifyF08StrictRefundCi(
  req:AuthenticatedMedusaRequest,res:MedusaResponse,next:MedusaNextFunction
){
  if(!exactCi())return next()
  // Built-in /admin middleware authenticates the actual actor.
  if(req.auth_context?.actor_type!=="user"||!req.auth_context.actor_id)
    return res.sendStatus(401)
  const route=/^\/admin\/payments\/(pay_[A-Za-z0-9_-]{8,})\/refund\/?$/
    .exec(String(req.originalUrl??req.path??"").split("?")[0])
  if(!route)return res.sendStatus(404)
  const amount=(req.body as {amount?:unknown}|undefined)?.amount
  if(typeof amount!=="number"||!Number.isSafeInteger(amount)||amount<=0)
    return res.sendStatus(400)
  try{
    const query=req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const {data}=await query.graph({
      entity:"payment",
      fields:["id","amount","currency_code","provider_id",
        "captures.id","captures.amount",
        "refunds.id","refunds.amount","refunds.status"],
      filters:{id:route[1]},
    })
    if(data.length!==1||data[0].id!==route[1])return res.sendStatus(404)
    const payment=data[0]
    if(payment.currency_code!=="all"||payment.provider_id!=="pp_system_default")
      return res.sendStatus(409)
    const maximum=whole(payment.amount)
    if(maximum<=0n)return res.sendStatus(409)
    const captures=payment.captures??[],refunds=payment.refunds??[]
    if(new Set(captures.map((c:any)=>c.id)).size!==captures.length||
       new Set(refunds.map((c:any)=>c.id)).size!==refunds.length)
      return res.sendStatus(503)
    let captured=0n,held=0n
    for(const row of captures){
      const n=whole(row.amount)
      if(n<=0n)return res.sendStatus(409)
      captured+=n
    }
    for(const row of refunds){
      const n=whole(row.amount)
      if(n<=0n)return res.sendStatus(409)
      held+=n // Includes pending/unreconciled states conservatively.
    }
    if(captured<=0n||captured>maximum||held>captured||
       BigInt(amount)>captured-held){
      console.log("SHQIPSHOP_F08_STAGE11Q_CI_STRICT_AMOUNT_DENIED")
      return res.sendStatus(409)
    }
    console.log("SHQIPSHOP_F08_STAGE11Q_CI_STRICT_AMOUNT_ALLOWED")
    return next()
  }catch{
    console.log("SHQIPSHOP_F08_STAGE11Q_CI_GUARD_FAIL_CLOSED")
    return res.sendStatus(503)
  }
}
