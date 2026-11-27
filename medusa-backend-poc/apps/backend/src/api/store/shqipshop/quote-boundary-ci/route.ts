import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { bindVerifiedQuotePrincipal } from "../../../../lib/checkout/quote-principal"

/**
 * CI-ONLY authenticated/guest HTTP boundary probe. This is never a quote
 * issuance or acceptance endpoint. The server does NOT persist/charge/complete
 * carts. This file must remain disabled in all non-disposable environments.
 * Its only purpose is real Medusa middleware/request/DB integration evidence.
 */
const enabled = (): boolean =>
  process.env.CI === "true" &&
  process.env.NODE_ENV === "development" &&
  process.env.SHQIPSHOP_REQUIRE_REDIS === "true" &&
  process.env.SHQIPSHOP_F07G_HTTP_CI === "true" &&
  process.env.DATABASE_URL === "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci" &&
  process.env.REDIS_URL === "redis://127.0.0.1:6379" &&
  /^[a-f0-9]{64}$/.test(process.env.JWT_SECRET ?? "")

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.setHeader("Cache-Control", "no-store, max-age=0")
  if (!enabled()) return res.sendStatus(404)

  // A frontend must never choose its merchant. All CI merchant identity
  // is provisioned by this per-run backend instance, never a URL/header/body.
  if (req.headers["x-shqipshop-tenant-id"] !== undefined ||
    req.headers["x-merchant-id"] !== undefined ||
    (req.body && typeof req.body === "object" &&
      Object.keys(req.body as object).length !== 0)) {
    return res.sendStatus(400)
  }

  const cartId = req.headers["x-shqipshop-cart-id"]
  const proof = req.headers["x-shqipshop-cart-proof"]
  if (typeof cartId !== "string" || !/^cart_[a-zA-Z0-9_-]{8,}$/.test(cartId) ||
    (proof !== undefined && typeof proof !== "string")) {
    return res.sendStatus(404)
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "customer_id"],
    filters: { id: cartId },
  })
  if (carts.length !== 1) return res.sendStatus(404)

  try {
    // Middleware validates bearer/session before populating req.auth_context.
    // Any nonempty Authorization/Cookie that fails authentication must never
    // silently downgrade to a guest capability.
    const authorizationAttempted = Boolean(req.headers.authorization) ||
      Boolean(req.headers.cookie)
    const actorType = req.auth_context?.actor_type
    const actorId = req.auth_context?.actor_id
    const principal = bindVerifiedQuotePrincipal({
      deploymentTenantId: "merchant_ci_isolated",
      trustedCart: {
        id: String(carts[0].id),
        customerId: carts[0].customer_id ? String(carts[0].customer_id) : null,
      },
      validatedAuthContext: actorType && actorId
        ? { actorType, actorId }
        : null,
      authorizationAttempted,
      guestCartProof: typeof proof === "string" ? proof : null,
      serverSecret: process.env.JWT_SECRET!,
    })
    // Do not return customer IDs, cart capabilities, tokens or private data.
    return res.status(200).json({
      allowed: true,
      kind: principal.buyerBinding.startsWith("guest:") ? "guest" : "customer",
      scope_fingerprint: principal.buyerBinding.startsWith("guest:")
        ? principal.buyerBinding.slice("guest:sha256:".length)
        : "authenticated",
    })
  } catch {
    // Never leak tenant, customer IDs or whether another customer's cart
    // exists. 404 also avoids giving a token enumeration oracle.
    return res.sendStatus(404)
  }
}
