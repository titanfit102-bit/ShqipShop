import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * F07g Stage 2B-2A: server-derived principal/tenant binding, NOT authentication.
 *
 * IMPORTANT: Only a trusted Medusa server adapter may supply these inputs:
 * deploymentTenantId from a provisioned service identity, trustedCart from
 * a fresh Medusa Query/Cart Module read, and validatedAuthContext from
 * Medusa's authenticated request middleware. This module does not decode
 * bearer JWTs, verify sessions, authorize carts, or expose HTTP endpoints.
 *
 * For guests, proof is the original unguessable cart capability already used
 * by the isolated CI / ensure-order-reader. It must not be logged or persisted.
 * A domain-separated HMAC stores no raw capability, and invalidates bindings
 * on server-secret rotation; secret management remains an operational gate.
 */
export type VerifiedQuotePrincipalInput = {
  deploymentTenantId: string
  trustedCart: { id: string; customerId?: string | null }
  validatedAuthContext?: { actorType: string; actorId: string } | null
  authorizationAttempted: boolean
  guestCartProof?: string | null
  serverSecret: string
}
export type ScopedQuotePrincipal = {
  tenantId: string
  cartId: string
  buyerBinding: string
}

const denied = (): never => { throw new Error("F07g principal binding denied") }
const tenantPattern = /^[a-zA-Z0-9_.:-]{1,100}$/
const cartPattern = /^cart_[a-zA-Z0-9_-]{8,}$/
const customerPattern = /^cus_[a-zA-Z0-9_-]{8,}$/
const secretPattern = /^[a-fA-F0-9]{64,}$/

export function bindVerifiedQuotePrincipal(input: VerifiedQuotePrincipalInput): ScopedQuotePrincipal {
  if (!input || typeof input !== "object") return denied()
  const { deploymentTenantId, trustedCart, validatedAuthContext,
    authorizationAttempted, guestCartProof, serverSecret } = input
  if (typeof deploymentTenantId !== "string" ||
    !tenantPattern.test(deploymentTenantId) ||
    !trustedCart || typeof trustedCart.id !== "string" ||
    !cartPattern.test(trustedCart.id) ||
    !secretPattern.test(serverSecret) || serverSecret.length % 2 !== 0 ||
    typeof authorizationAttempted !== "boolean") return denied()
  const key = Buffer.from(serverSecret, "hex")
  if (key.length < 32) return denied()
  if (trustedCart.customerId != null &&
    (typeof trustedCart.customerId !== "string" ||
      !customerPattern.test(trustedCart.customerId))) return denied()

  if (validatedAuthContext) {
    // Never downgrade a logged-in/foreign account to the guest capability.
    if (validatedAuthContext.actorType !== "customer" ||
      typeof validatedAuthContext.actorId !== "string" ||
      !customerPattern.test(validatedAuthContext.actorId) ||
      trustedCart.customerId !== validatedAuthContext.actorId) return denied()
    return {
      tenantId: deploymentTenantId,
      cartId: trustedCart.id,
      buyerBinding: "customer:" + validatedAuthContext.actorId,
    }
  }

  // An invalid/missing Medusa auth context with an attempted Authorization
  // header MUST NOT silently fall back to an unauthenticated guest quote.
  if (authorizationAttempted || trustedCart.customerId != null ||
    typeof guestCartProof !== "string" ||
    !cartPattern.test(guestCartProof)) return denied()
  const actual = Buffer.from(trustedCart.id, "utf8")
  const supplied = Buffer.from(guestCartProof, "utf8")
  if (actual.length !== supplied.length || !timingSafeEqual(actual, supplied)) return denied()
  const digest = createHmac("sha256", key)
    .update(JSON.stringify(["shqipshop-f07g-guest-v1", deploymentTenantId, trustedCart.id]))
    .digest("hex")
  return {
    tenantId: deploymentTenantId,
    cartId: trustedCart.id,
    buyerBinding: "guest:sha256:" + digest,
  }
}
