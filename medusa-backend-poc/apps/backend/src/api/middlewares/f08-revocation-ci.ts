import {authenticate} from "@medusajs/framework/http"
import type {AuthenticatedMedusaRequest, MedusaResponse, MedusaNextFunction} from "@medusajs/framework/http"
import {ContainerRegistrationKeys} from "@medusajs/framework/utils"
import {createHash} from "node:crypto"

/**
 * F08 CI-only proof of per-JWT server deny-list enforcement.
 * Attached to disposable quote routes and, in Stage 4, an EXACT-CI gated
 * built-in Store customer-profile GET. NOT global Medusa authorization,
 * multi-device logout, token rotation or a production security mechanism.
 */
export const isF08DisposableCi = () =>
  process.env.CI === "true" &&
  process.env.NODE_ENV === "development" &&
  process.env.SHQIPSHOP_F08_REVOCATION_CI === "true" &&
  process.env.SHQIPSHOP_F07G_HTTP_CI === "true" &&
  process.env.SHQIPSHOP_REQUIRE_REDIS === "true" &&
  process.env.DATABASE_URL === "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci" &&
  process.env.REDIS_URL === "redis://127.0.0.1:6379" &&
  /^[a-f0-9]{64}$/.test(process.env.JWT_SECRET ?? "")

export const F08_CI_TABLE = "shqipshop_f08_disposable_ci_revoked_bearers"
export const verifiedBearer = (h: unknown): string | null => {
  if (typeof h !== "string") return null
  const match=/^Bearer ([A-Za-z0-9._-]+)$/i.exec(h)
  return match && match[1].length < 8192 ? match[1] : null
}
export const tokenDigest = (token: string): string =>
  createHash("sha256").update(token,"utf8").digest("hex")

export async function enforceF08CiBearerPolicy(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  if (!isF08DisposableCi()) return next()
  if (!req.headers.authorization) return next() // Guest checks are separate.
  const token=verifiedBearer(req.headers.authorization)
  if (!token || req.auth_context?.actor_type !== "customer" ||
      !req.auth_context.actor_id) return res.sendStatus(401)
  try {
    const db:any=req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const hit=await db(F08_CI_TABLE)
      .where({token_sha256:tokenDigest(token),customer_id:req.auth_context.actor_id})
      .first("token_sha256")
    if (hit) return res.sendStatus(401)
    return next()
  } catch {
    // A missing store/DB failure must NEVER become an authentication bypass.
    return res.sendStatus(503)
  }
}

/**
 * F08 Stage 4 — CI-only proof that Medusa's built-in private customer profile
 * can be protected by a middleware-chain hook. In all non-disposable CI
 * environments this is strictly a pass-through (no authentication override).
 *
 * Explicitly run Medusa auth BEFORE checking req.auth_context. Any Medusa
 * auth error is forwarded; never infer identity from a request header.
 * Built-in cart/order routes are intentionally NOT covered by this proof.
 */
const ciCustomerAuth = authenticate("customer", ["session", "bearer"], {
  allowUnauthenticated: true,
})
export const enforceF08CiProfilePolicy = (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) => {
  if (!isF08DisposableCi()) return next()
  return ciCustomerAuth(req, res, (err?: Error) => {
    if (err) return next(err)
    return enforceF08CiBearerPolicy(req, res, next)
  })
}

/**
 * F08 Stage 7 — disposable CI ONLY: prove that a known cart ID does not
 * authorize reading or modifying a cart once it belongs to a customer.
 * Guest carts deliberately retain original Medusa semantics in this probe;
 * their capability/expiry contract is NOT a production security decision.
 */
export const enforceF08CiOwnerCartPolicy = (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) => {
  if (!isF08DisposableCi() ||
      process.env.SHQIPSHOP_F08_OWNER_CART_CI !== "true") return next()
  return ciCustomerAuth(req, res, async (err?: Error) => {
    if (err) return next(err)
    try {
      // Medusa may run a matcher before its final route populates req.params;
      // extract only from the exact normalized path, never from a client header.
      const rawPath=String(req.originalUrl ?? req.path ?? "").split("?")[0]
      const pathMatch=/^\/store\/carts\/(cart_[A-Za-z0-9_-]{8,})(?:\/line-items)?\/?$/.exec(rawPath)
      const cartId=pathMatch?.[1]
      if (!cartId || (req.params?.id && req.params.id !== cartId)) {
        console.log("SHQIPSHOP_F08_CI_DEBUG_CART_ROUTE_MISMATCH")
        return res.sendStatus(404)
      }
      const query=req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const {data:carts}=await query.graph({
        entity:"cart",
        fields:["id","customer_id"],
        filters:{id:cartId},
      })
      if (carts.length !== 1) {
        console.log("SHQIPSHOP_F08_CI_DEBUG_CART_QUERY_COUNT_"+carts.length)
        return res.sendStatus(404)
      }
      const customerId=carts[0].customer_id
      // Guest checkout can create a customer row without an account. Treating
      // ANY customer_id as a logged-in owner breaks ordinary Medusa checkout.
      // Query Medusa's authoritative account classification, never a header.
      let registeredAccount=false
      if (customerId) {
        const {data:customers}=await query.graph({
          entity:"customer",
          fields:["id","has_account"],
          filters:{id:String(customerId)},
        })
        if (customers.length!==1 ||
            customers[0].id!==customerId ||
            typeof customers[0].has_account!=="boolean") {
          console.log("SHQIPSHOP_F08_CI_DEBUG_CUSTOMER_ACCOUNT_LOOKUP_INVALID")
          return res.sendStatus(503)
        }
        registeredAccount=customers[0].has_account
      }
      const attempted=Boolean(req.headers.authorization || req.headers.cookie)
      const actor=req.auth_context?.actor_type==="customer"
        ? req.auth_context?.actor_id : null
      // A failed bearer/cookie is not a valid guest possession credential.
      if (attempted && !actor) {
        console.log("SHQIPSHOP_F08_CI_DEBUG_AUTHENTICATION_REJECTED")
        return res.sendStatus(401)
      }
      if (registeredAccount && (!actor || actor!==customerId)) {
        console.log("SHQIPSHOP_F08_CI_DEBUG_REGISTERED_OWNER_MISMATCH")
        return res.sendStatus(404)
      }
      console.log(registeredAccount
        ? "SHQIPSHOP_F08_CI_DEBUG_REGISTERED_CART_ALLOWED"
        : "SHQIPSHOP_F08_CI_DEBUG_GUEST_CART_ALLOWED")
      // Only registered accounts are protected by the experimental bearer
      // deny-list. Guest cart possession/expiry remains unapproved/open.
      if (registeredAccount && req.headers.authorization)
        return enforceF08CiBearerPolicy(req,res,next)
      return next()
    } catch {
      // Diagnostics are CI-only and never expose IDs, tokens or PII.
      console.log("SHQIPSHOP_F08_CI_DEBUG_CART_QUERY_ERROR")
      return res.sendStatus(503)
    }
  })
}
