import type { MedusaStoreRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createHmac } from "node:crypto"

export const ATTEMPT_TABLE = "shqipshop_n03_disposable_attempt"
export const DISPATCH_CLAIMED = "claimed_for_dispatch"
export const SEALED_BEFORE_DISPATCH = "sealed_before_dispatch"
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

export const isN03DisposableCi = (flag: string) => {
  const redis = CI_CONNECTIONS.get(process.env.DATABASE_URL ?? "")
  return redis !== undefined &&
    process.env.CI === "true" &&
    process.env.NODE_ENV === "development" &&
    process.env.SHQIPSHOP_REQUIRE_REDIS === "true" &&
    process.env[flag] === "true" &&
    process.env.REDIS_URL === redis &&
    /^[a-f0-9]{64}$/.test(process.env.JWT_SECRET ?? "")
}

export const isN03GuestCi = () => isN03DisposableCi("SHQIPSHOP_N03_GUEST_RECOVERY_CI")

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

export const jsonOnly = (req: MedusaStoreRequest) =>
  typeof req.headers["content-type"] === "string" &&
  /^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers["content-type"])

export const singleField = (value: unknown, field: string): value is Record<string,string> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === 1 &&
  typeof (value as Record<string,unknown>)[field] === "string"

export const hasN03CartChannel = (req: MedusaStoreRequest, channel: string | null | undefined) =>
  Boolean(channel && req.publishable_key_context?.sales_channel_ids?.includes(channel))

/** Use the same guest and sales-channel checks for claiming or sealing checkout. */
export async function getN03GuestCheckoutCart(req: MedusaStoreRequest, cartId: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "customer_id", "sales_channel_id", "order.id"],
    filters: { id: cartId },
  })
  const cart = carts[0]
  if (carts.length !== 1 || cart?.id !== cartId ||
      !hasN03CartChannel(req, cart.sales_channel_id)) return null

  if (cart.customer_id) {
    const { data: customers } = await query.graph({
      entity: "customer", fields: ["id", "has_account"], filters: { id: cart.customer_id },
    })
    if (customers.length !== 1 || customers[0].id !== cart.customer_id ||
        typeof customers[0].has_account !== "boolean") {
      throw new Error("Missing N03 guest customer classification")
    }
    if (customers[0].has_account) return null
  }
  return cart
}

/** Lock the same credential first for dispatch and cancellation. */
export async function transitionN03Attempt(
  db: any,
  cartId: string,
  token: string,
  phase: typeof DISPATCH_CLAIMED | typeof SEALED_BEFORE_DISPATCH,
) {
  return db.transaction(async (trx: typeof db) => {
    const proof = await activeProof(trx, cartId, token).forUpdate().first("cart_id")
    if (!proof) return 404
    return updateN03Attempt(trx, cartId, null, phase)
  })
}

export async function updateN03Attempt(
  trx: any,
  cartId: string,
  ownerId: string | null,
  phase: typeof DISPATCH_CLAIMED | typeof SEALED_BEFORE_DISPATCH,
) {
  const row = trx(ATTEMPT_TABLE).where({ cart_id: cartId, owner_customer_id: ownerId })
  const changed = await row.clone().where({ phase: "prepared" }).update({ phase })
  if (changed === 1) return 200
  if (phase === SEALED_BEFORE_DISPATCH) {
    const existing = await row.first("phase")
    if (existing?.phase === SEALED_BEFORE_DISPATCH) return 200
  }
  return 409
}
