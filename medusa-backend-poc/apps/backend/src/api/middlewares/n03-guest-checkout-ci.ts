import type { MedusaNextFunction, MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  activeProof, ATTEMPT_TABLE, DISPATCH_CLAIMED, forbiddenCredentialMode,
  GUEST_TABLE, isN03GuestCi, proofPattern,
} from "./n03-guest-ci"

/** Commit one dispatch claim before allowing the built-in Medusa checkout to run. */
export async function claimN03GuestCheckoutCi(
  req: MedusaStoreRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  if (!isN03GuestCi()) return next()

  const path = String(req.originalUrl ?? req.path ?? "").split("?")[0]
  const cartId = /^\/store\/carts\/(cart_[A-Za-z0-9_-]{8,})\/complete\/?$/.exec(path)?.[1]
  if (!cartId || (req.params?.id && req.params.id !== cartId)) return res.sendStatus(404)

  try {
    const db: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const capability = await db(GUEST_TABLE).where({ cart_id: cartId }).first("cart_id")
    if (!capability) return next()
    res.setHeader("Cache-Control", "private, no-store")

    const token = req.headers["x-shqipshop-recovery-proof"]
    if (forbiddenCredentialMode(req) || typeof token !== "string" || !proofPattern.test(token)) {
      return res.sendStatus(404)
    }
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carts } = await query.graph({
      entity: "cart", fields: ["id", "customer_id", "sales_channel_id"], filters: { id: cartId },
    })
    const cart = carts[0]
    if (carts.length !== 1 || cart?.id !== cartId || !cart.sales_channel_id ||
        !req.publishable_key_context?.sales_channel_ids?.includes(cart.sales_channel_id)) {
      return res.sendStatus(404)
    }

    if (cart.customer_id) {
      const { data: customers } = await query.graph({
        entity: "customer", fields: ["id", "has_account"], filters: { id: cart.customer_id },
      })
      if (customers.length !== 1 || customers[0].id !== cart.customer_id ||
          typeof customers[0].has_account !== "boolean") return res.sendStatus(503)
      if (customers[0].has_account) return res.sendStatus(404)
    }

    const status = await db.transaction(async (trx: typeof db) => {
      // Serialize against changes to this credential, including revocation.
      const proof = await activeProof(trx, cartId, token).forUpdate().first("cart_id")
      if (!proof) return 404
      const changed = await trx(ATTEMPT_TABLE)
        .where({ cart_id: cartId, phase: "prepared" })
        .update({ phase: DISPATCH_CLAIMED })
      return changed === 1 ? 200 : 409
    })
    if (status !== 200) return res.sendStatus(status)
  } catch {
    return res.sendStatus(503)
  }

  return next()
}
