import type {AuthenticatedMedusaRequest, MedusaResponse} from "@medusajs/framework/http"
import {ContainerRegistrationKeys} from "@medusajs/framework/utils"
import {F08_CI_TABLE,isF08DisposableCi,tokenDigest,verifiedBearer} from "../../../middlewares/f08-revocation-ci"

/** Test-only explicit per-JWT revocation. NOT Medusa /auth/session logout. */
export const POST=async (req:AuthenticatedMedusaRequest,res:MedusaResponse)=>{
  res.setHeader("Cache-Control","no-store, max-age=0")
  if(!isF08DisposableCi()) return res.sendStatus(404)
  if(req.headers.cookie||req.headers["x-shqipshop-tenant-id"]!==undefined||
     req.headers["x-merchant-id"]!==undefined||
     (req.body && (typeof req.body!=="object" ||
       Object.keys(req.body as object).length!==0))) return res.sendStatus(400)
  const actor=req.auth_context
  const token=verifiedBearer(req.headers.authorization)
  if(!token||actor?.actor_type!=="customer"||!/^cus_[A-Za-z0-9_-]{8,}$/.test(actor.actor_id??""))
    return res.sendStatus(401)
  try {
    const db:any=req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await db(F08_CI_TABLE).insert({
      token_sha256:tokenDigest(token),customer_id:actor.actor_id,
    }).onConflict("token_sha256").ignore()
    return res.status(200).json({revoked:true})
  }catch{
    return res.sendStatus(503)
  }
}
