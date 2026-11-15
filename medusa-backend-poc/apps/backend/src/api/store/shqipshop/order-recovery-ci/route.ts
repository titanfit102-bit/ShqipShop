import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * N03 Stage 2a: read-only, registered-customer cart -> persisted-order proof.
 * Disposable A/B PostgreSQL/Redis CI ONLY. No guest route, no mutations,
 * no payment replay and NO production recovery policy.
 *
 * A missing linked order is UNKNOWN (never proof that completion did not occur).
 * An order ID is returned only after Medusa validates the customer bearer and
 * both sides of the cart <-> order relation have the same owner.
 */
const disposableEnvironments = new Map([
  [
    "postgres://shqipshop_ci_a:merchantA_disposable@127.0.0.1:5432/shqipshop_ci_a",
    "redis://127.0.0.1:6379",
  ],
  [
    "postgres://shqipshop_ci_b:merchantB_disposable@127.0.0.1:5432/shqipshop_ci_b",
    "redis://127.0.0.1:6381",
  ],
])

const enabled = () => {
  const expectedRedis = disposableEnvironments.get(process.env.DATABASE_URL ?? "")
  return expectedRedis !== undefined &&
    process.env.CI === "true" &&
    process.env.NODE_ENV === "development" &&
    process.env.SHQIPSHOP_REQUIRE_REDIS === "true" &&
    process.env.SHQIPSHOP_N03_RECOVERY_CI === "true" &&
    expectedRedis === process.env.REDIS_URL &&
    /^[a-f0-9]{64}$/.test(process.env.JWT_SECRET ?? "")
}

const cartPattern = /^cart_[A-Za-z0-9_-]{8,}$/
const orderPattern = /^order_[A-Za-z0-9_-]{8,}$/

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "private, no-store, max-age=0")
  res.setHeader("Pragma", "no-cache")
  if (!enabled()) return res.sendStatus(404)

  // Bearer-only evidence. Never treat cookie, public key, cart ID or
  // a user-supplied merchant identifier as customer/tenant authority.
  if (req.headers.cookie ||
      typeof req.headers.authorization !== "string" ||
      !/^Bearer [A-Za-z0-9._-]+$/i.test(req.headers.authorization) ||
      req.headers["x-shqipshop-tenant-id"] !== undefined ||
      req.headers["x-merchant-id"] !== undefined) {
    return res.sendStatus(401)
  }

  const cartId = req.query?.cart_id
  if (typeof cartId !== "string" || !cartPattern.test(cartId) ||
      Object.keys(req.query ?? {}).length !== 1) {
    return res.sendStatus(404)
  }
  const actorId = req.auth_context?.actor_id
  if (req.auth_context?.actor_type !== "customer" || !actorId) {
    return res.sendStatus(401)
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: ["id", "customer_id", "order.id"],
      filters: { id: cartId },
    })
    if (carts.length !== 1 || carts[0].id !== cartId ||
        carts[0].customer_id !== actorId) return res.sendStatus(404)

    // A Medusa guest checkout may also have a customer row. Only registered
    // accounts can enter this Stage 2a proof; the guest path is still CLOSED.
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id", "has_account"],
      filters: { id: actorId },
    })
    if (customers.length !== 1 || customers[0].id !== actorId ||
        typeof customers[0].has_account !== "boolean") return res.sendStatus(503)
    if (!customers[0].has_account) return res.sendStatus(404)

    const linkedOrderId = carts[0].order?.id
    if (linkedOrderId === undefined || linkedOrderId === null) {
      return res.status(200).json({ state: "unknown" })
    }
    if (typeof linkedOrderId !== "string" || !orderPattern.test(linkedOrderId)) {
      return res.sendStatus(503)
    }

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id", "cart.id"],
      filters: { id: linkedOrderId },
    })
    if (orders.length !== 1 || orders[0].id !== linkedOrderId ||
        orders[0].customer_id !== actorId || orders[0].cart?.id !== cartId) {
      // Broken link / stale read: do not assert a negative outcome.
      return res.sendStatus(503)
    }
    return res.status(200).json({ state: "confirmed", order_id: linkedOrderId })
  } catch {
    // No account/tenant/order identifiers or SQL errors leave the response.
    return res.sendStatus(503)
  }
}
