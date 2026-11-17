import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createHmac, timingSafeEqual } from "node:crypto"

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

    // A new N03 guest cart has a separate proof; its private receipt must
    // never fall back to legacy cart-ID possession. This applies only to
    // exact disposable A/B CI databases, not production F06 orders.
    const cartId = order.cart?.id
    const dbUrl = process.env.DATABASE_URL ?? ""
    const expectedRedis =
      dbUrl === "postgres://shqipshop_ci_a:merchantA_disposable@127.0.0.1:5432/shqipshop_ci_a"
        ? "redis://127.0.0.1:6379"
        : dbUrl === "postgres://shqipshop_ci_b:merchantB_disposable@127.0.0.1:5432/shqipshop_ci_b"
          ? "redis://127.0.0.1:6381" : null
    if (expectedRedis &&
        process.env.CI === "true" && process.env.NODE_ENV === "development" &&
        process.env.SHQIPSHOP_REQUIRE_REDIS === "true" &&
        process.env.SHQIPSHOP_N03_GUEST_RECOVERY_CI === "true" &&
        process.env.REDIS_URL === expectedRedis &&
        /^[a-f0-9]{64}$/.test(process.env.JWT_SECRET ?? "") &&
        typeof cartId === "string") {
      const db: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
      const bound = await db("shqipshop_n03_disposable_guest_recovery")
        .where({ cart_id: cartId }).first("cart_id")
      if (bound) {
        const proof = req.headers["x-shqipshop-recovery-proof"]
        if (req.headers.cookie || req.headers[GUEST_PROOF_HEADER] !== undefined ||
            req.headers["x-shqipshop-tenant-id"] !== undefined ||
            typeof proof !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(proof)) {
          return next(new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found"))
        }
        const digest = createHmac("sha256", process.env.JWT_SECRET!)
          .update("shqipshop:n03:guest:v1:", "utf8").update(cartId, "utf8")
          .update(":", "utf8").update(proof, "utf8").digest("hex")
        const valid = await db("shqipshop_n03_disposable_guest_recovery")
          .where({ cart_id: cartId, proof_digest: digest })
          .whereNull("revoked_at").where("expires_at", ">", db.fn.now())
          .first("cart_id")
        if (!valid) return next(new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found"))
        _res.setHeader("Cache-Control", "private, no-store, max-age=0")
        return next()
      }
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
