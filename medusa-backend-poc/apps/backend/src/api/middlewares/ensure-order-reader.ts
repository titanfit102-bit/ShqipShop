import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { timingSafeEqual } from "node:crypto"

const GUEST_PROOF_HEADER = "x-shqipshop-cart-proof"

/** Compare private cart IDs without a value-dependent string comparison. */
const sameSecret = (left: string, right: string) => {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * F06: Medusa's normal Store Get Order intentionally accepts an order ID alone.
 * For ShqipShop, an authenticated customer must own the order; a guest needs
 * the originating (unpublished) cart ID as a second possession credential.
 *
 * This runs BEFORE the built-in GET /store/orders/:id handler; it never
 * returns the cart ID or the order's private fields itself.
 */
export async function ensureOrderReader(
  req: AuthenticatedMedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction,
) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id", "cart.id"],
      filters: { id: req.params.id },
    })

    if (!order) {
      return next(new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found"))
    }

    const principal = req.auth_context?.actor_id
    if (principal) {
      // A valid customer session must NOT fall back to the guest capability.
      if (order.customer_id === principal) return next()
      return next(new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found"))
    }

    // Do not silently downgrade an invalid bearer JWT to guest access.
    if (req.headers.authorization) {
      return next(new MedusaError(MedusaError.Types.UNAUTHORIZED, "Invalid customer authentication"))
    }

    const proof = req.headers[GUEST_PROOF_HEADER]
    if (typeof proof !== "string" || !/^cart_[a-zA-Z0-9_-]{8,}$/.test(proof)) {
      return next(new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found"))
    }

    const originatingCartId = order.cart?.id
    if (typeof originatingCartId !== "string" || !sameSecret(originatingCartId, proof)) {
      return next(new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found"))
    }

    return next()
  } catch (error) {
    return next(error)
  }
}
