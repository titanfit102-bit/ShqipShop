/**
 * F07g server-only principal/guest binding negative regression.
 * Synthetic fixtures, disposable Medusa CI. No HTTP/real authentication
 * token or customer data is read or issued by this script.
 */
import assert from "node:assert/strict"
import type { ExecArgs } from "@medusajs/framework/types"
import { bindVerifiedQuotePrincipal } from "../lib/checkout/quote-principal"

export default async function verify(_args: ExecArgs) {
  const required = {
    CI: "true", NODE_ENV: "development",
    SHQIPSHOP_REQUIRE_REDIS: "true",
    SHQIPSHOP_F07G_PRINCIPAL_CI: "true",
    DATABASE_URL: "postgres://medusa_ci:disposable_ci_password@127.0.0.1:5432/medusa_ci",
    REDIS_URL: "redis://127.0.0.1:6379",
  }
  for (const [key, value] of Object.entries(required)) {
    assert.equal(process.env[key], value, key)
  }
  const serverSecret = process.env.JWT_SECRET
  assert(serverSecret && /^[0-9a-f]{64}$/.test(serverSecret),
    "Only per-run cryptographic server secret is permitted")
  const cartId = "cart_ci_proof_0123456789"
  const guest = {
    deploymentTenantId: "merchant_A",
    trustedCart: { id: cartId, customerId: null },
    validatedAuthContext: null,
    authorizationAttempted: false,
    guestCartProof: cartId,
    serverSecret,
  }
  const denied = /F07g principal binding denied/
  const positive = bindVerifiedQuotePrincipal(guest)
  assert.equal(positive.tenantId, "merchant_A")
  assert.equal(positive.cartId, cartId)
  assert.match(positive.buyerBinding, /^guest:sha256:[a-f0-9]{64}$/)
  assert(!JSON.stringify(positive).includes(cartId.slice(5)),
    "Guest proof must not appear in persisted buyerBinding")
  assert.notEqual(positive.buyerBinding, bindVerifiedQuotePrincipal({
    ...guest, deploymentTenantId: "merchant_B",
  }).buyerBinding, "Guest scope must be tenant-specific")
  assert.notEqual(positive.buyerBinding, bindVerifiedQuotePrincipal({
    ...guest, serverSecret: "a".repeat(64),
  }).buyerBinding, "Server key rotation must invalidate old bindings")

  const negatives = [
    { ...guest, guestCartProof: "cart_foreign_0123456789" },
    { ...guest, guestCartProof: null },
    { ...guest, guestCartProof: "" },
    { ...guest, authorizationAttempted: true },
    { ...guest, trustedCart: { id: cartId, customerId: "cus_foreign_0123456789" } },
    { ...guest, validatedAuthContext: { actorType: "admin", actorId: "cus_0123456789" } },
    { ...guest, validatedAuthContext: { actorType: "customer", actorId: "cus_0123456789" } },
    { ...guest, deploymentTenantId: "../merchant_B" },
    { ...guest, serverSecret: "dev-secret" },
    { ...guest, trustedCart: { id: "cart_weak", customerId: null } },
  ]
  for (const attempt of negatives) {
    assert.throws(() => bindVerifiedQuotePrincipal(attempt), denied)
  }
  console.log("SHQIPSHOP_F07G_GUEST_CAPABILITY_TENANT_HMAC_AND_DOWNGRADE_DENIED")

  const customer = {
    ...guest,
    trustedCart: { id: cartId, customerId: "cus_0123456789" },
    validatedAuthContext: { actorType: "customer", actorId: "cus_0123456789" },
    authorizationAttempted: true,
    guestCartProof: null,
  }
  const authenticated = bindVerifiedQuotePrincipal(customer)
  assert.equal(authenticated.buyerBinding, "customer:cus_0123456789")
  assert.throws(() => bindVerifiedQuotePrincipal({
    ...customer, validatedAuthContext: { actorType: "customer", actorId: "cus_someoneelse" },
  }), denied)
  assert.throws(() => bindVerifiedQuotePrincipal({
    ...customer, validatedAuthContext: null, guestCartProof: cartId,
  }), denied)
  assert.throws(() => bindVerifiedQuotePrincipal({
    ...customer, trustedCart: { id: cartId, customerId: null },
  }), denied)
  console.log("SHQIPSHOP_F07G_CUSTOMER_MEDUSA_PRINCIPAL_OWNERSHIP_PASSED")
}
