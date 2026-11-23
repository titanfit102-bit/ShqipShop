import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  DISPATCH_CLAIMED, hasN03CartChannel, isN03DisposableCi, SEALED_BEFORE_DISPATCH, updateN03Attempt,
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
  req: AuthenticatedMedusaRequest,
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
    return updateN03Attempt(trx, cartId, actor, phase)
  })
}
