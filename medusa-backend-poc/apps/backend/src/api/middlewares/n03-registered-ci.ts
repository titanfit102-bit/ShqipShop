import type { AuthenticatedMedusaRequest, MedusaStoreRequest } from "@medusajs/framework/http"
import { claimAcceptedQuoteInDisposableCi } from "../../lib/checkout/quote-claim-ci"
import {
  freshQuoteSnapshot, f07gN03Scope, isF07gN03Ci, QUOTE_TABLE,
  quoteCartFields, quoteFingerprintPattern, quoteIdPattern,
} from "../../lib/checkout/quote-cart-ci"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  ATTEMPT_TABLE, DISPATCH_CLAIMED, hasN03CartChannel, isN03DisposableCi, SEALED_BEFORE_DISPATCH, updateN03Attempt,
} from "./n03-guest-ci"

export const isN03RegisteredCi = () => isN03DisposableCi("SHQIPSHOP_N03_RECOVERY_CI")

export function registeredActor(req: AuthenticatedMedusaRequest) {
  if (req.headers.cookie ||
      typeof req.headers.authorization !== "string" ||
      !/^Bearer [A-Za-z0-9._-]+$/i.test(req.headers.authorization) ||
      req.headers["x-shqipshop-tenant-id"] !== undefined ||
      req.headers["x-merchant-id"] !== undefined ||
      req.headers["x-shqipshop-recovery-proof"] !== undefined ||
      req.headers["x-shqipshop-cart-proof"] !== undefined) return null
  const actor = req.auth_context
  return actor?.actor_type === "customer" && actor.actor_id ? actor.actor_id : null
}

export async function isN03RegisteredCustomer(req: AuthenticatedMedusaRequest, actor: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: customers } = await query.graph({
    entity: "customer", fields: ["id", "has_account"], filters: { id: actor },
  })
  return customers.length === 1 && customers[0].id === actor && customers[0].has_account === true
}

export async function transitionN03RegisteredAttempt(
  req: AuthenticatedMedusaRequest & MedusaStoreRequest,
  cartId: string,
  phase: typeof DISPATCH_CLAIMED | typeof SEALED_BEFORE_DISPATCH,
) {
  const actor = registeredActor(req)
  if (!actor) return 401
  if (!await isN03RegisteredCustomer(req, actor)) return 404

  const db: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  return db.transaction(async (trx: typeof db) => {
    // A change to current Medusa cart ownership must serialize with this transition.
    const cart = await trx("cart").where({ id: cartId, customer_id: actor })
      .whereNull("deleted_at").forUpdate().first("sales_channel_id", "completed_at")
    if (!cart || !hasN03CartChannel(req, cart.sales_channel_id)) return 404
    if (cart.completed_at != null) return 409
    if (phase === DISPATCH_CLAIMED && isF07gN03Ci()) {
      const attempt = await trx(ATTEMPT_TABLE).where({cart_id:cartId}).first("phase", "quote_required")
      if (attempt?.quote_required) {
        if (attempt.phase !== "prepared") return 409
        const quoteId = req.headers["x-shqipshop-quote-id"]
        const fingerprint = req.headers["x-shqipshop-quote-fingerprint"]
        if (typeof quoteId !== "string" || !quoteIdPattern.test(quoteId) ||
            typeof fingerprint !== "string" || !quoteFingerprintPattern.test(fingerprint)) return 412
        const scope = f07gN03Scope(cartId, actor)
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
        const { data } = await query.graph({
          entity:"cart", fields:[...quoteCartFields,"shipping_methods.id","shipping_methods.amount"],
          filters:{id:cartId},
        })
        if (data.length !== 1) return 412
        let snapshot
        try { snapshot = await freshQuoteSnapshot(query, data[0], scope, true) }
        catch { return 412 }
        const claimed = await claimAcceptedQuoteInDisposableCi(trx, QUOTE_TABLE, scope,
          quoteId, fingerprint, snapshot, Date.now())
        if (!claimed) return 412
        // Roll back the quote claim if the paired attempt transition fails.
        const status = await updateN03Attempt(trx, cartId, actor, phase)
        if (status !== 200) throw new Error("Quote and checkout attempt must be claimed together")
        return status
      }
    }
    return updateN03Attempt(trx, cartId, actor, phase)
  })
}
