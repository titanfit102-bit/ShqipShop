import type { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import { randomBytes, randomUUID } from "node:crypto"
import {
  activeProof, ATTEMPT_TABLE, cartIdPattern, digest, DISPATCH_CLAIMED,
  forbiddenCredentialMode, GUEST_TABLE, isN03GuestCi, proofPattern,
} from "../../../middlewares/n03-guest-ci"

/**
 * N03 Stage 2b CI-only guest capability prototype. A secret is minted with a
 * NEW cart, never claimable with a preexisting cart ID. Only its keyed digest
 * is stored in isolated, disposable merchant PostgreSQL.
 *
 * NOT enabled in production; not guest cart mutation authorization, PSP,
 * all-device login, durable production migration or a completed N03 flow.
 */
const regionIdPattern = /^reg_[A-Za-z0-9_-]{8,}$/
const channelIdPattern = /^sc_[A-Za-z0-9_-]{8,}$/
const orderIdPattern = /^order_[A-Za-z0-9_-]{8,}$/
const TTL_HOURS = 4

const jsonOnly = (req: MedusaStoreRequest) =>
  typeof req.headers["content-type"] === "string" &&
  /^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers["content-type"])

const singleField = (value: unknown, field: string): value is Record<string,string> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === 1 &&
  typeof (value as Record<string,unknown>)[field] === "string"

const disallowCaching = (res: MedusaResponse) => {
  res.setHeader("Cache-Control", "private, no-store, max-age=0")
  res.setHeader("Pragma", "no-cache")
}

// Check an exact cart + proof match in the *current backend's* isolated DB;
// no client-supplied merchant can choose the database. All credentials are
// high-entropy and their raw values are NEVER stored in the database.
async function recoverRecord(req: MedusaStoreRequest, cartId: string, token: string) {
  const db: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const row = await activeProof(db, cartId, token).first("cart_id")
  return row ? db : null
}

/**
 * Create cart and capability together, before checkout. A caller may NOT bind
 * a new proof to a preexisting cart. The server does not accept an order ID.
 */
export const POST = async (req: MedusaStoreRequest, res: MedusaResponse) => {
  disallowCaching(res)
  if (!isN03GuestCi()) return res.sendStatus(404)
  if (forbiddenCredentialMode(req) ||
      req.headers["x-shqipshop-recovery-proof"] !== undefined) return res.sendStatus(401)
  if (!jsonOnly(req) || !singleField(req.body, "region_id") ||
      !regionIdPattern.test(req.body.region_id)) return res.sendStatus(400)
  const channels = req.publishable_key_context?.sales_channel_ids
  if (!Array.isArray(channels) || channels.length !== 1 ||
      typeof channels[0] !== "string" || !channelIdPattern.test(channels[0])) {
    return res.sendStatus(404)
  }
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: regions } = await query.graph({
      entity: "region", fields: ["id"], filters: { id: req.body.region_id },
    })
    if (regions.length !== 1 || regions[0].id !== req.body.region_id) return res.sendStatus(404)

    // Medusa controls the new cart and its sales channel. If the subsequent
    // DB capability insert fails, fail closed without exposing the orphan cart.
    const { result: cart } = await createCartWorkflow(req.scope).run({
      input: { region_id: req.body.region_id, sales_channel_id: channels[0] },
    })
    const id = cart?.id
    if (typeof id !== "string" || !cartIdPattern.test(id)) return res.sendStatus(503)
    const secret = randomBytes(32).toString("base64url")
    const db: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await db.transaction(async (trx: typeof db) => {
      await trx(GUEST_TABLE).insert({
        cart_id: id,
        proof_digest: digest(secret, id),
        expires_at: trx.raw("now() + interval '4 hours'"),
      })
      await trx(ATTEMPT_TABLE).insert({ attempt_id: randomUUID(), cart_id: id })
    })
    // This one-time delivery is required before cart completion; never log it.
    return res.status(201).json({
      cart_id: id,
      recovery_proof: secret,
      expires_in_seconds: TTL_HOURS * 3600,
    })
  } catch {
    return res.sendStatus(503)
  }
}

/** Reconcile only, with no new POST complete or payment mutation. */
export const GET = async (req: MedusaStoreRequest, res: MedusaResponse) => {
  disallowCaching(res)
  if (!isN03GuestCi()) return res.sendStatus(404)
  if (forbiddenCredentialMode(req)) return res.sendStatus(401)
  if (!singleField(req.query, "cart_id") ||
      !cartIdPattern.test(req.query.cart_id)) return res.sendStatus(404)
  const token = req.headers["x-shqipshop-recovery-proof"]
  if (typeof token !== "string" || !proofPattern.test(token)) return res.sendStatus(404)

  try {
    const cartId = req.query.cart_id
    const db = await recoverRecord(req, cartId, token)
    if (!db) return res.sendStatus(404)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: ["id", "customer_id", "order.id"],
      filters: { id: cartId },
    })
    // Unknown never means that there was no committed order.
    if (carts.length !== 1 || carts[0].id !== cartId) return res.status(200).json({ state: "unknown" })
    const cart = carts[0]
    if (cart.customer_id) {
      const { data: customers } = await query.graph({
        entity: "customer",
        fields: ["id", "has_account"],
        filters: { id: cart.customer_id },
      })
      if (customers.length !== 1 || customers[0].id !== cart.customer_id ||
          typeof customers[0].has_account !== "boolean") return res.sendStatus(503)
      // Account conversion invalidates a previous guest possession secret.
      if (customers[0].has_account) return res.sendStatus(404)
    }
    const orderId = cart.order?.id
    if (orderId == null) return res.status(200).json({ state: "unknown" })
    if (typeof orderId !== "string" || !orderIdPattern.test(orderId)) return res.sendStatus(503)
    const claim = await db(ATTEMPT_TABLE)
      .where({ cart_id: cartId, phase: DISPATCH_CLAIMED })
      .first("attempt_id")
    if (!claim) return res.status(200).json({ state: "unknown" })
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id", "cart.id"],
      filters: { id: orderId },
    })
    if (orders.length !== 1 || orders[0].id !== orderId ||
        orders[0].cart?.id !== cartId ||
        !cart.customer_id || orders[0].customer_id !== cart.customer_id) {
      return res.sendStatus(503)
    }
    return res.status(200).json({ state: "confirmed", order_id: orderId })
  } catch {
    return res.sendStatus(503)
  }
}

/** Capability revocation, authenticated by the capability itself. */
export const DELETE = async (req: MedusaStoreRequest, res: MedusaResponse) => {
  disallowCaching(res)
  if (!isN03GuestCi()) return res.sendStatus(404)
  if (forbiddenCredentialMode(req) || !jsonOnly(req)) return res.sendStatus(401)
  if (!singleField(req.body, "cart_id") ||
      !cartIdPattern.test(req.body.cart_id)) return res.sendStatus(404)
  const token = req.headers["x-shqipshop-recovery-proof"]
  if (typeof token !== "string" || !proofPattern.test(token)) return res.sendStatus(404)
  try {
    const db = await recoverRecord(req, req.body.cart_id, token)
    if (!db) return res.sendStatus(404)
    const changed = await activeProof(db, req.body.cart_id, token)
      .update({ revoked_at: db.fn.now() })
    if (changed !== 1) return res.sendStatus(404)
    return res.status(200).json({ revoked: true })
  } catch {
    return res.sendStatus(503)
  }
}
