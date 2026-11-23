import type { MedusaStoreRequest } from "@medusajs/framework/http"
import { createHmac } from "node:crypto"

export const ATTEMPT_TABLE = "shqipshop_n03_disposable_attempt"
export const DISPATCH_CLAIMED = "claimed_for_dispatch"
export const GUEST_TABLE = "shqipshop_n03_disposable_guest_recovery"
const CI_CONNECTIONS = new Map([
  [
    "postgres://shqipshop_ci_a:merchantA_disposable@127.0.0.1:5432/shqipshop_ci_a",
    "redis://127.0.0.1:6379",
  ],
  [
    "postgres://shqipshop_ci_b:merchantB_disposable@127.0.0.1:5432/shqipshop_ci_b",
    "redis://127.0.0.1:6381",
  ],
])
export const cartIdPattern = /^cart_[A-Za-z0-9_-]{8,}$/
export const proofPattern = /^[A-Za-z0-9_-]{43}$/

export const isN03GuestCi = () => {
  const redis = CI_CONNECTIONS.get(process.env.DATABASE_URL ?? "")
  return redis !== undefined &&
    process.env.CI === "true" &&
    process.env.NODE_ENV === "development" &&
    process.env.SHQIPSHOP_REQUIRE_REDIS === "true" &&
    process.env.SHQIPSHOP_N03_GUEST_RECOVERY_CI === "true" &&
    process.env.REDIS_URL === redis &&
    /^[a-f0-9]{64}$/.test(process.env.JWT_SECRET ?? "")
}

export const forbiddenCredentialMode = (req: MedusaStoreRequest) =>
  Boolean(req.headers.authorization || req.headers.cookie) ||
  req.headers["x-shqipshop-tenant-id"] !== undefined ||
  req.headers["x-merchant-id"] !== undefined ||
  req.headers["x-shqipshop-cart-proof"] !== undefined

export const digest = (token: string, cartId: string) =>
  createHmac("sha256", process.env.JWT_SECRET!)
    .update("shqipshop:n03:guest:v1:", "utf8")
    .update(cartId, "utf8")
    .update(":", "utf8")
    .update(token, "utf8")
    .digest("hex")

export const activeProof = (db: any, cartId: string, token: string) =>
  db(GUEST_TABLE)
    .where({ cart_id: cartId, proof_digest: digest(token, cartId) })
    .whereNull("revoked_at")
    .where("expires_at", ">", db.fn.now())
