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

// Exact zero-decimal ALL: do not round strings or BigNumber values through
// Number(), where a fractional ledger value could silently become an integer.
// This parser is used ONLY by the disposable CI guard, not a production policy.
const whole=(value:unknown):bigint=>{
  if(value===null||value===undefined||typeof value==="boolean")
    throw Error("Unsafe monetary value")
  if(typeof value==="number"){
    if(!Number.isSafeInteger(value)||value<0)throw Error("Unsafe monetary value")
    return BigInt(value)
  }
  if(typeof value!=="string"&&
     (typeof value!=="object"||typeof (value as {toString?:unknown}).toString!=="function"))
    throw Error("Unsafe monetary value")
  const raw=String(value)
  if(!/^(0|[1-9][0-9]*)(?:[.]0+)?$/.test(raw))
    throw Error("Non-integral ALL ledger value")
  const units=BigInt(raw.split(".")[0])
  if(units>BigInt(Number.MAX_SAFE_INTEGER))throw Error("Unsafe monetary value")
  return units
}


/**
 * Stage 11R: a SECOND, exact-disposable-CI-only branch of the same built-in
 * Admin route. Synthetic payment IDs only; it RESERVES ledger capacity and
 * an outbox atomically, but NEVER calls a payment provider or Medusa refund.
 * No production migration, role model, PSP or business side effect is wired.
 */
const stage11rEnabled=()=>exactCi()&&
  process.env.SHQIPSHOP_F08_11R_ATOMIC_CI==="true"&&
  process.env.SHQIPSHOP_F08_11R_MERCHANT==="merchant_ci_a"

const R_BAL="shqipshop_f08_stage11r_ci_balances"
const R_STAFF="shqipshop_f08_stage11r_ci_staff"
const R_OPS="shqipshop_f08_stage11r_ci_operations"
const R_OUT="shqipshop_f08_stage11r_ci_outbox"
const R_SCOPE="merchant_ci_a"

async function reserve11r(
  req:AuthenticatedMedusaRequest,res:MedusaResponse,
  paymentId:string,amount:number
) {
  const actorId=req.auth_context?.actor_id
  if(req.auth_context?.actor_type!=="user"||!actorId)
    return res.sendStatus(401)
  const key=(req.body as {idempotency_key?:unknown}).idempotency_key
  if(typeof key!=="string"||!/^[a-z0-9_]{8,64}$/.test(key))
    return res.sendStatus(400)
  const scope={merchant_id:R_SCOPE,payment_id:paymentId}
  try {
    const db:any=req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const outcome=await db.transaction(async(trx:any)=>{
      // Actor comes from validated Medusa auth context, NOT a request
      // header/body. Finance permission is disposable CI STAFF data only.
      const staff=await trx(R_STAFF).where({
        merchant_id:R_SCOPE,actor_id:actorId,
      }).first()
      if(!staff||staff.role!=="finance_admin"||staff.active!==true)
        return {status:403,state:"forbidden"}
      // PostgreSQL row lock serializes competing reservation attempts
      // for this EXACT synthetic payment on one isolated merchant DB.
      const bal=await trx(R_BAL).where(scope).forUpdate().first()
      if(!bal)return {status:404,state:"missing"}
      if(bal.currency!=="all")return {status:409,state:"currency"}
      const previous=await trx(R_OPS).where({...scope,operation_key:key}).first()
      if(previous) {
        if(previous.actor_id!==actorId||
           BigInt(previous.amount_all)!==BigInt(amount))
          return {status:409,state:"key_conflict"}
        return {status:200,state:"replay"}
      }
      const cap=BigInt(bal.captured_all),reserved=BigInt(bal.reserved_all)
      if(cap<=0n||reserved<0n||reserved>cap||
         reserved+BigInt(amount)>cap)
        return {status:409,state:"amount_exceeded"}
      await trx(R_BAL).where(scope)
        .update({reserved_all:(reserved+BigInt(amount)).toString()})
      await trx(R_OPS).insert({...scope,operation_key:key,
        actor_id:actorId,amount_all:String(amount),status:"pending"})
      await trx(R_OUT).insert({...scope,operation_key:key,
        amount_all:String(amount),status:"ready"})
      // Simulate a failure *before* commit, proving all three changes
      // roll back together; this header never has meaning outside CI.
      if(req.headers["x-shqipshop-ci-rollback"]==="true")
        throw Error("Synthetic precommit rollback")
      return {status:202,state:"reserved"}
    })
    console.log("SHQIPSHOP_F08_STAGE11R_CI_"+outcome.state.toUpperCase())
    return res.status(outcome.status).json({state:outcome.state})
  } catch {
    console.log("SHQIPSHOP_F08_STAGE11R_CI_TRANSACTION_FAIL_CLOSED")
    return res.sendStatus(503)
  }
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
  if(stage11rEnabled()&&route[1].startsWith("pay_stage11r_"))
    return reserve11r(req,res,route[1],amount)
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
